// ===================================================================
// RUTAS HÍBRIDAS PARA SISTEMA GEOGRÁFICO
// Trabaja con project_coverages existente + sistema híbrido
// ===================================================================

const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const hybridGeoService = require('../services/hybridGeographicAI');
const { createClient } = require('@supabase/supabase-js');
const { splitLocations } = require('../utils/geo-splitter');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===================================================================
// 1. ENDPOINT PRINCIPAL: DETECCIÓN AUTOMÁTICA HÍBRIDA
// ===================================================================

/**
 * POST /api/hybrid-coverages/auto-detect
 * Detecta ubicaciones geográficas usando IA híbrida y crea coberturas
 */
router.post('/auto-detect', verifyUserAccess, async (req, res) => {
    try {
        const { project_id, text_content, source_info = {} } = req.body;
        const startTime = Date.now();

        console.log('🧭 Iniciando detección híbrida de coberturas geográficas...');
        console.log(`   📄 Proyecto: ${project_id}`);
        console.log(`   📝 Contenido: ${text_content?.substring(0, 100)}...`);

        // Validaciones básicas
        if (!project_id || !text_content) {
            return res.status(400).json({
                error: 'project_id y text_content son requeridos'
            });
        }

        // Verificar que el proyecto existe y el usuario tiene acceso
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, title, user_id, collaborators')
            .eq('id', project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({
                error: 'Proyecto no encontrado o sin acceso'
            });
        }

        // Verificar permisos
        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({
                error: 'No tienes permisos para este proyecto'
            });
        }

        // ===================================================================
        // PASO 1: DETECCIÓN HÍBRIDA
        // ===================================================================
        console.log('🔍 Ejecutando detección geográfica híbrida...');
        
        const detectionOptions = {
            country_code: 'GTM',
            confidence_threshold: 0.6,
            max_results: 20,
            include_hierarchy: true,
            enable_ai: false, // Por ahora deshabilitado
            language: 'es'
        };

        const detectionResults = await hybridGeoService.detectGeographicLocationsHybrid(
            text_content, 
            detectionOptions
        );

        console.log(`📍 Detección completada: ${detectionResults.locations.length} ubicaciones encontradas`);

        // ---------------------------------------------------------------
        // NUEVO: división de ubicaciones con comas ("Quiché, Baja Verapaz")
        // ---------------------------------------------------------------
        const expandedLocations = [];

        for (const loc of detectionResults.locations) {
            if (loc.name.includes(',')) {
                const parts = splitLocations(loc.name);
                parts.forEach(p => {
                    expandedLocations.push({
                        ...loc,
                        name: p.name,
                        parent_name: p.parent || null,
                        details: {
                            ...loc.details,
                            hierarchy_level: p.type === 'pais' ? 1 : p.type === 'departamento' ? 2 : 3
                        }
                    });
                });
            } else {
                expandedLocations.push(loc);
            }
        }

        // Reemplazar lista de ubicaciones por la expandida
        detectionResults.locations = expandedLocations;

        // ===================================================================
        // PASO 2: CREAR COBERTURAS EN project_coverages
        // ===================================================================
        let coverageResults = {
            coverages: [],
            errors: [],
            total_processed: 0,
            success_count: 0,
            error_count: 0,
            duplicates_avoided: 0
        };

        if (detectionResults.locations.length > 0) {
            console.log('🔗 Creando coberturas en project_coverages...');
            
            for (const location of detectionResults.locations) {
                try {
                    coverageResults.total_processed++;

                    // Verificar si ya existe una cobertura para esta ubicación en este proyecto
                    const { data: existingCoverage } = await supabase
                        .from('project_coverages')
                        .select('id, location_id, name')
                        .eq('project_id', project_id)
                        .eq('location_id', location.location_id)
                        .single();

                    if (existingCoverage) {
                        console.log(`⚠️ Cobertura ya existe para ${location.name} (${location.location_id})`);
                        coverageResults.duplicates_avoided++;
                        continue;
                    }

                    // Determinar el tipo de cobertura basado en el nivel jerárquico
                    let coverage_type = 'city';
                    if (location.details?.hierarchy_level === 1) coverage_type = 'country';
                    else if (location.details?.hierarchy_level === 2) coverage_type = 'department';
                    else if (location.details?.hierarchy_level === 3) coverage_type = 'city';
                    else if (location.details?.hierarchy_level === 4) coverage_type = 'zone';

                    // Crear nueva cobertura
                    const newCoverage = {
                        project_id,
                        coverage_type,
                        name: location.name,
                        parent_name: location.parent_name || null,
                        description: `Detectado automáticamente: ${location.name}`,
                        relevance: location.combined_confidence >= 0.8 ? 'high' : 
                                  location.combined_confidence >= 0.6 ? 'medium' : 'low',
                        coordinates: location.coordinates || null,
                        tags: [location.detection_method, 'hybrid_detection'],
                        detection_source: 'hybrid_ai',
                        confidence_score: location.combined_confidence,
                        coverage_status: 'active',
                        source_card_id: source_info.card_id || null,
                        source_item_id: source_info.item_id || null,
                        discovery_context: text_content.substring(0, 500),
                        
                        // Campos nuevos del sistema híbrido
                        location_id: location.location_id,
                        hybrid_processed: true,
                        hierarchy_level: location.details?.hierarchy_level || null,
                        country_code: location.details?.country_code || 'GTM',
                        full_path: location.full_path,
                        capturados_count: 0,
                        local_name: location.nombre_local || null, // Nomenclatura local
                        hybrid_metadata: {
                            detection_method: location.detection_method,
                            original_confidence: location.combined_confidence,
                            processing_timestamp: new Date().toISOString(),
                            source_text_snippet: text_content.substring(0, 200),
                            local_name: location.nombre_local // Backup en metadata
                        }
                    };

                    const { data: insertedCoverage, error: insertError } = await supabase
                        .from('project_coverages')
                        .insert(newCoverage)
                        .select()
                        .single();

                    if (insertError) {
                        console.error(`❌ Error insertando cobertura para ${location.name}:`, insertError);
                        coverageResults.errors.push({
                            location: location.name,
                            error: insertError.message
                        });
                        coverageResults.error_count++;
                    } else {
                        console.log(`✅ Cobertura creada: ${location.name} (${location.location_id})`);
                        coverageResults.coverages.push(insertedCoverage);
                        coverageResults.success_count++;

                        // Sistema simplificado: no hay tabla de estadísticas
                    }

                } catch (error) {
                    console.error(`❌ Error procesando ubicación ${location.name}:`, error);
                    coverageResults.errors.push({
                        location: location.name,
                        error: error.message
                    });
                    coverageResults.error_count++;
                }
            }
        }

        // ===================================================================
        // PASO 2.5: VINCULAR TARJETAS CAPTURADO EXISTENTES
        // ===================================================================
        console.log('🔗 Vinculando capturado_cards existentes con coberturas...');

        for (const coverage of coverageResults.coverages) {
            try {
                let updateQuery = supabase
                    .from('capturado_cards')
                    .update({ coverage_id: coverage.id })
                    .eq('project_id', project_id)
                    .is('coverage_id', null);

                if (coverage.coverage_type === 'ciudad') {
                    updateQuery = updateQuery.eq('city', coverage.name);
                    if (coverage.parent_name) {
                        updateQuery = updateQuery.eq('department', coverage.parent_name);
                    }
                } else if (coverage.coverage_type === 'departamento') {
                    updateQuery = updateQuery.eq('department', coverage.name);
                } else if (coverage.coverage_type === 'pais') {
                    updateQuery = updateQuery.eq('pais', coverage.name);
                }

                const { data: updated, error: updateErr } = await updateQuery;

                if (updateErr) {
                    console.error('⚠️ Error vinculando capturado_cards:', updateErr.message);
                } else if (updated && updated.length > 0) {
                    console.log(`   • ${updated.length} tarjetas vinculadas a cobertura ${coverage.name}`);
                }

            } catch (linkErr) {
                console.error('⚠️ Error en vinculación de capturado_cards:', linkErr.message);
            }
        }

        // ===================================================================
        // PASO 3: RESPUESTA ESTRUCTURADA
        // ===================================================================
        const response = {
            success: true,
            project_id,
            processing_time_ms: Date.now() - startTime,
            
            // Resultados de detección
            detection: {
                total_found: detectionResults.metadata.total_found,
                methods_used: detectionResults.metadata.methods_used,
                performance: detectionResults.performance,
                locations: detectionResults.locations.map(loc => ({
                    location_id: loc.location_id,
                    name: loc.name,
                    full_path: loc.full_path,
                    confidence: loc.combined_confidence,
                    detection_method: loc.detection_method,
                    hierarchy_level: loc.details?.hierarchy_level || null,
                    level_code: loc.details?.level_code || null,
                    local_name: loc.nombre_local || null // Incluir nomenclatura local
                }))
            },
            
            // Resultados de coberturas
            coverage: {
                total_processed: coverageResults.total_processed,
                success_count: coverageResults.success_count,
                error_count: coverageResults.error_count,
                duplicates_avoided: coverageResults.duplicates_avoided,
                new_coverages: coverageResults.success_count,
                errors: coverageResults.errors
            },
            
            // Metadatos
            metadata: {
                source_info,
                detection_options: detectionOptions,
                project_title: project.title
            }
        };

        console.log(`✅ Detección híbrida completada exitosamente:`);
        console.log(`   🔍 ${response.detection.total_found} ubicaciones detectadas`);
        console.log(`   🔗 ${response.coverage.success_count} coberturas creadas`);
        console.log(`   🚫 ${response.coverage.duplicates_avoided} duplicados evitados`);
        console.log(`   ⏱️ Procesado en ${response.processing_time_ms}ms`);

        res.json(response);

    } catch (error) {
        console.error('Error en detección híbrida:', error);
        res.status(500).json({
            error: 'Error interno en detección híbrida',
            details: error.message
        });
    }
});

// ===================================================================
// 2. ENDPOINT: OBTENER COBERTURAS DE UN PROYECTO
// ===================================================================

/**
 * GET /api/hybrid-coverages/project/:project_id
 * Obtiene todas las coberturas geográficas de un proyecto con datos híbridos
 */
router.get('/project/:project_id', verifyUserAccess, async (req, res) => {
    try {
        const { project_id } = req.params;
        const { include_hierarchy = 'true', group_by_level = 'false', hybrid_only = 'false' } = req.query;

        console.log(`📊 Obteniendo coberturas del proyecto: ${project_id}`);

        // Verificar acceso al proyecto
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, title, user_id, collaborators, visibility')
            .eq('id', project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({
                error: 'Proyecto no encontrado'
            });
        }

        // Verificar permisos (incluyendo proyectos públicos)
        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id)) ||
                         project.visibility === 'public';

        if (!hasAccess) {
            return res.status(403).json({
                error: 'No tienes permisos para este proyecto'
            });
        }

        // Consulta base de coberturas (sistema simplificado)
        let query = supabase
            .from('project_coverages')
            .select('*')
            .eq('project_id', project_id);

        // Filtro opcional: solo coberturas procesadas por sistema híbrido
        if (hybrid_only === 'true') {
            query = query.eq('hybrid_processed', true);
        }

        query = query.order('created_at', { ascending: false });

        const { data: coverages, error: coveragesError } = await query;

        if (coveragesError) {
            console.error('Error obteniendo coberturas:', coveragesError);
            return res.status(500).json({
                error: 'Error obteniendo coberturas',
                details: coveragesError.message
            });
        }

        // ===================================================================
        // PROCESAMIENTO Y AGRUPACIÓN
        // ===================================================================
        let processedCoverages = coverages.map(coverage => ({
            ...coverage,
            // Datos híbridos enriquecidos
            hybrid_info: coverage.location_id ? {
                location_id: coverage.location_id,
                full_path: coverage.full_path,
                hierarchy_level: coverage.hierarchy_level,
                country_code: coverage.country_code,
                hybrid_metadata: coverage.hybrid_metadata
            } : null,
            
            // Indicadores de estado
            is_hybrid_processed: coverage.hybrid_processed || false,
            
            // Métricas
            confidence_score: coverage.confidence_score || 0,
            capturados_count: coverage.capturados_count || 0
        }));

        // Agrupación opcional por nivel jerárquico
        let response = {
            success: true,
            project_id,
            project_title: project.title,
            total_coverages: processedCoverages.length,
            hybrid_processed_count: processedCoverages.filter(c => c.is_hybrid_processed).length,
            coverages: processedCoverages
        };

        if (group_by_level === 'true') {
            const groupedByLevel = {};
            
            processedCoverages.forEach(coverage => {
                const level = coverage.hierarchy_level || 'unknown';
                const levelName = getHumanReadableLevelName(coverage.level_code || 'UNKNOWN');
                
                if (!groupedByLevel[level]) {
                    groupedByLevel[level] = {
                        level_code: coverage.level_code || 'UNKNOWN',
                        level_name: levelName,
                        count: 0,
                        coverages: []
                    };
                }
                
                groupedByLevel[level].count++;
                groupedByLevel[level].coverages.push(coverage);
            });

            response.grouped_by_level = groupedByLevel;
        }

        // Estadísticas adicionales
        response.statistics = {
            by_relevance: {
                high: processedCoverages.filter(c => c.relevance === 'high').length,
                medium: processedCoverages.filter(c => c.relevance === 'medium').length,
                low: processedCoverages.filter(c => c.relevance === 'low').length
            },
            by_detection_source: {
                hybrid_ai: processedCoverages.filter(c => c.detection_source === 'hybrid_ai').length,
                manual: processedCoverages.filter(c => c.detection_source === 'manual').length,
                ai_detection: processedCoverages.filter(c => c.detection_source === 'ai_detection').length
            },
            average_confidence: processedCoverages.length > 0 ? 
                processedCoverages.reduce((sum, c) => sum + (c.confidence_score || 0), 0) / processedCoverages.length : 0
        };

        console.log(`✅ Coberturas obtenidas: ${response.total_coverages} total, ${response.hybrid_processed_count} híbridas`);

        res.json(response);

    } catch (error) {
        console.error('Error obteniendo coberturas del proyecto:', error);
        res.status(500).json({
            error: 'Error interno obteniendo coberturas',
            details: error.message
        });
    }
});

// ===================================================================
// 3. ENDPOINT: BÚSQUEDA DE UBICACIONES
// ===================================================================

/**
 * GET /api/hybrid-coverages/search-locations
 * Busca ubicaciones usando el sistema híbrido
 */
router.get('/search-locations', verifyUserAccess, async (req, res) => {
    try {
        const { 
            query, 
            country_code = 'GTM', 
            limit = 20, 
            include_parents = 'true' 
        } = req.query;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                error: 'Query debe tener al menos 2 caracteres'
            });
        }

        console.log(`🔍 Búsqueda de ubicaciones: "${query}"`);

        const searchResults = await hybridGeoService.searchLocalLocations(query, {
            country_code,
            limit: parseInt(limit),
            includeParents: include_parents === 'true'
        });

        const response = {
            success: true,
            query,
            country_code,
            results: searchResults,
            total_found: searchResults.length,
            metadata: {
                search_options: {
                    country_code,
                    limit: parseInt(limit),
                    include_parents: include_parents === 'true'
                },
                generated_at: new Date().toISOString()
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error en búsqueda de ubicaciones:', error);
        res.status(500).json({
            error: 'Error en búsqueda de ubicaciones',
            details: error.message
        });
    }
});

// ===================================================================
// 4. ENDPOINT: JERARQUÍAS GEOGRÁFICAS DISPONIBLES
// ===================================================================

/**
 * GET /api/hybrid-coverages/hierarchies
 * Obtiene las jerarquías geográficas disponibles por país
 */
router.get('/hierarchies', async (req, res) => {
    try {
        const { country_code } = req.query;

        console.log(`📋 Obteniendo jerarquías geográficas...`);

        let query = supabase
            .from('geographic_hierarchies')
            .select('*')
            .order('level_order');

        if (country_code) {
            query = query.eq('country_code', country_code);
        }

        const { data: hierarchies, error } = await query;

        if (error) {
            throw error;
        }

        // Agrupar por país
        const groupedByCountry = hierarchies.reduce((acc, hierarchy) => {
            if (!acc[hierarchy.country_code]) {
                acc[hierarchy.country_code] = {
                    country_code: hierarchy.country_code,
                    country_name: hierarchy.country_name,
                    levels: []
                };
            }
            
            acc[hierarchy.country_code].levels.push({
                level_order: hierarchy.level_order,
                level_name: hierarchy.level_name,
                level_code: hierarchy.level_code,
                examples: hierarchy.examples
            });
            
            return acc;
        }, {});

        const response = {
            success: true,
            hierarchies: Object.values(groupedByCountry),
            total_countries: Object.keys(groupedByCountry).length,
            metadata: {
                country_filter: country_code || null,
                generated_at: new Date().toISOString()
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error obteniendo jerarquías:', error);
        res.status(500).json({
            error: 'Error obteniendo jerarquías geográficas',
            details: error.message
        });
    }
});

// ===================================================================
// 5. ENDPOINT: ESTADÍSTICAS GENERALES
// ===================================================================

/**
 * GET /api/hybrid-coverages/stats
 * Obtiene estadísticas generales del sistema geográfico
 */
router.get('/stats', verifyUserAccess, async (req, res) => {
    try {
        console.log('📊 Generando estadísticas del sistema geográfico...');

        // Estadísticas de ubicaciones
        const { data: locationStats } = await supabase
            .from('geographic_locations')
            .select('country_code, level_code, is_active')
            .eq('is_active', true);

        // Estadísticas de coberturas de proyectos del usuario
        const { data: coverageStats } = await supabase
            .from('project_geographic_coverage')
            .select(`
                detection_source, relevance, coverage_type,
                project:project_id(user_id, collaborators)
            `);

        // Filtrar coberturas del usuario
        const userCoverages = coverageStats.filter(coverage => 
            coverage.project.user_id === req.user.id ||
            (coverage.project.collaborators && coverage.project.collaborators.includes(req.user.id))
        );

        // Procesar estadísticas
        const stats = {
            locations: {
                total: locationStats.length,
                by_country: {},
                by_level: {}
            },
            user_coverages: {
                total: userCoverages.length,
                by_detection_source: {},
                by_relevance: {},
                by_coverage_type: {}
            }
        };

        // Estadísticas de ubicaciones
        locationStats.forEach(location => {
            stats.locations.by_country[location.country_code] = 
                (stats.locations.by_country[location.country_code] || 0) + 1;
            
            stats.locations.by_level[location.level_code] = 
                (stats.locations.by_level[location.level_code] || 0) + 1;
        });

        // Estadísticas de coberturas del usuario
        userCoverages.forEach(coverage => {
            stats.user_coverages.by_detection_source[coverage.detection_source] = 
                (stats.user_coverages.by_detection_source[coverage.detection_source] || 0) + 1;
            
            stats.user_coverages.by_relevance[coverage.relevance] = 
                (stats.user_coverages.by_relevance[coverage.relevance] || 0) + 1;
            
            stats.user_coverages.by_coverage_type[coverage.coverage_type] = 
                (stats.user_coverages.by_coverage_type[coverage.coverage_type] || 0) + 1;
        });

        const response = {
            success: true,
            statistics: stats,
            metadata: {
                user_id: req.user.id,
                generated_at: new Date().toISOString()
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error generando estadísticas:', error);
        res.status(500).json({
            error: 'Error generando estadísticas',
            details: error.message
        });
    }
});

// ===================================================================
// 6. FUNCIONES AUXILIARES
// ===================================================================

/**
 * Convierte códigos de nivel a nombres legibles
 */
function getHumanReadableLevelName(levelCode) {
    const levelNames = {
        'COUNTRY': 'País',
        'DEPARTMENT': 'Departamento',
        'MUNICIPALITY': 'Municipio',
        'ZONE': 'Zona/Aldea',
        'UNKNOWN': 'Desconocido'
    };
    
    return levelNames[levelCode] || levelCode;
}

module.exports = router; 