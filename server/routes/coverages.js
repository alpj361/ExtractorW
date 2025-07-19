// ===================================================================
// RUTAS PARA GESTIÓN DE COBERTURAS DE PROYECTOS
// Maneja zonas geográficas detectadas y agregadas manualmente
// ===================================================================

const express = require('express');
const supabase = require('../utils/supabase');
const { verifyUserAccess } = require('../middlewares/auth');
const { logUsage } = require('../services/logs');
const { normalizeGeographicInfo, normalizeGeographicInfoSync, batchNormalizeGeography, normalizeGeographicInfoWithCoordinates } = require('../services/mapsAgent');
const { normalizeCoverageInput } = require('../utils/coverageNormalization');

const router = express.Router();

// ===================================================================
// ENDPOINTS PRINCIPALES
// ===================================================================

// GET /api/coverages?project_id=UUID - Obtener coberturas de un proyecto
router.get('/', verifyUserAccess, async (req, res) => {
    try {
        const { project_id, type, status, source } = req.query;
        
        if (!project_id) {
            return res.status(400).json({ 
                error: 'project_id es requerido' 
            });
        }

        // Construir query base
        let query = supabase
            .from('project_coverages')
            .select(`
                *,
                projects!inner(id, title, user_id)
            `)
            .eq('project_id', project_id)
            .order('created_at', { ascending: false });

        // Aplicar filtros opcionales
        if (type) {
            query = query.eq('coverage_type', type);
        }
        if (status) {
            query = query.eq('coverage_status', status);
        }
        if (source) {
            query = query.eq('detection_source', source);
        }

        const { data: coverages, error } = await query;

        if (error) {
            console.error('Error fetching coverages:', error);
            return res.status(500).json({ 
                error: 'Error al obtener coberturas',
                details: error.message 
            });
        }

        // Agrupar por tipo para estadísticas
        const stats = {
            total: coverages.length,
            by_type: {},
            by_source: {},
            by_status: {}
        };

        coverages.forEach(coverage => {
            // Por tipo
            stats.by_type[coverage.coverage_type] = (stats.by_type[coverage.coverage_type] || 0) + 1;
            // Por fuente
            stats.by_source[coverage.detection_source] = (stats.by_source[coverage.detection_source] || 0) + 1;
            // Por estado
            stats.by_status[coverage.coverage_status] = (stats.by_status[coverage.coverage_status] || 0) + 1;
        });

        // Log de uso
        await logUsage(req.user, 'coverage_list', 0, req);

        res.json({
            success: true,
            coverages,
            stats,
            filters: { type, status, source }
        });

    } catch (error) {
        console.error('Error in GET /coverages:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// POST /api/coverages - Crear nueva cobertura manualmente
router.post('/', verifyUserAccess, async (req, res) => {
    try {
        const {
            project_id,
            coverage_type,
            name,
            parent_name,
            description,
            relevance = 'medium',
            coordinates,
            tags = [],
            source_card_id,
            source_item_id
        } = req.body;

        // Normalizar campos clave para evitar duplicados por variaciones de formato
        const normalized = normalizeCoverageInput({
            coverage_type,
            name,
            parent_name
        });

        const normalizedType = normalized.coverage_type;
        const normalizedName = normalized.name;
        const normalizedParent = normalized.parent_name;

        // Validaciones básicas
        if (!project_id || !normalizedType || !normalizedName) {
            return res.status(400).json({
                error: 'project_id, coverage_type y name son requeridos'
            });
        }

        const validTypes = ['pais', 'departamento', 'ciudad', 'zona', 'region'];
        if (!validTypes.includes(normalizedType)) {
            return res.status(400).json({
                error: `coverage_type debe ser uno de: ${validTypes.join(', ')}`
            });
        }

        // Verificar que el usuario tiene acceso al proyecto
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id, collaborators')
            .eq('id', project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ 
                error: 'Proyecto no encontrado' 
            });
        }

        // Verificar permisos
        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'No tienes permisos para agregar coberturas a este proyecto' 
            });
        }

        // NORMALIZACIÓN GEOGRÁFICA: Si es una cobertura geográfica, validar usando mapsAgent
        let geoNormalized = { 
            city: normalizedName, 
            department: normalizedParent, 
            pais: null 
        };
        let confidence = 1.0;
        let detectionMethod = 'manual';

        if (['pais', 'departamento', 'ciudad'].includes(normalizedType)) {
            try {
                // Construir objeto para normalización según el tipo
                const geoInput = {};
                if (normalizedType === 'ciudad') {
                    geoInput.city = normalizedName;
                    geoInput.department = normalizedParent;
                } else if (normalizedType === 'departamento') {
                    geoInput.department = normalizedName;
                    geoInput.pais = normalizedParent || 'Guatemala';
                } else if (normalizedType === 'pais') {
                    geoInput.pais = normalizedName;
                }

                // Normalizar con mapsAgent (usar versión sync para crear cobertura manual)
                geoNormalized = normalizeGeographicInfoSync(geoInput);
                
                // Si la normalización detectó información adicional, usarla
                if (geoNormalized.city && normalizedType === 'ciudad') {
                    normalizedName = geoNormalized.city;
                    if (geoNormalized.department) {
                        normalizedParent = geoNormalized.department;
                    }
                } else if (geoNormalized.department && normalizedType === 'departamento') {
                    normalizedName = geoNormalized.department;
                    if (geoNormalized.pais) {
                        normalizedParent = geoNormalized.pais;
                    }
                } else if (geoNormalized.pais && normalizedType === 'pais') {
                    normalizedName = geoNormalized.pais;
                }

                confidence = 0.95; // Alta confianza para ubicaciones normalizadas
                detectionMethod = 'maps_agent';
                
                console.log(`🗺️ [COVERAGE] Ubicación normalizada: ${normalizedType} "${normalizedName}" → ${JSON.stringify(geoNormalized)}`);
                
            } catch (geoError) {
                console.warn(`⚠️ [COVERAGE] Error en normalización geográfica: ${geoError.message}. Continuando con valores originales.`);
                // Continúa con los valores originales si falla la normalización
            }
        }

        // Crear la cobertura
        const { data: coverage, error: insertError } = await supabase
            .from('project_coverages')
            .insert({
                project_id,
                coverage_type: normalizedType,
                name: normalizedName,
                parent_name: normalizedParent,
                description: description?.trim() || null,
                relevance,
                coordinates: coordinates || null,
                tags: tags || [],
                detection_source: detectionMethod,
                confidence_score: confidence,
                source_card_id: source_card_id || null,
                source_item_id: source_item_id || null,
                discovery_context: 'Agregado manualmente por usuario'
            })
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '23505') { // Duplicate key error
                return res.status(409).json({
                    error: 'Esta cobertura ya existe en el proyecto',
                    details: 'Ya tienes una cobertura con el mismo tipo, nombre y ubicación padre'
                });
            }
            
            console.error('Error creating coverage:', insertError);
            return res.status(500).json({ 
                error: 'Error al crear cobertura',
                details: insertError.message 
            });
        }

        // Log de uso
        await logUsage(req.user, 'coverage_create', 0, req);

        res.status(201).json({
            success: true,
            coverage,
            message: 'Cobertura creada exitosamente'
        });

    } catch (error) {
        console.error('Error in POST /coverages:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// POST /api/coverages/detect - Detectar coberturas automáticamente desde texto
router.post('/detect', verifyUserAccess, async (req, res) => {
    try {
        const {
            project_id,
            text,
            source_type = 'ai_detection',
            source_item_id,
            source_card_id
        } = req.body;

        if (!project_id || !text) {
            return res.status(400).json({
                error: 'project_id y text son requeridos'
            });
        }

        // Verificar acceso al proyecto
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id, collaborators')
            .eq('id', project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ 
                error: 'Proyecto no encontrado' 
            });
        }

        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'No tienes permisos para detectar coberturas en este proyecto' 
            });
        }

        // NUEVA LÓGICA: Detección geográfica con JavaScript (sin RPC)
        console.log(`🔍 [DETECT] Analizando texto para extraer ubicaciones: "${text.substring(0, 100)}..."`);
        
        // Extraer posibles ubicaciones del texto usando patrones
        const locationPatterns = [
            // Patrones para ciudades/municipios
            /(?:en|de|desde|hacia|municipio de|ciudad de|localidad de)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+?)(?:\s|,|\.|\||$)/gi,
            // Patrones para departamentos
            /(?:departamento de|depto\.|dpto\.)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+?)(?:\s|,|\.|\||$)/gi,
            // Nombres propios que podrían ser ubicaciones
            /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\b/g
        ];
        
        const potentialLocations = new Set();
        
        // Extraer ubicaciones usando patrones
        locationPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const location = match[1].trim();
                if (location.length > 2 && location.length < 50) {
                    potentialLocations.add(location);
                }
            }
        });
        
        console.log(`🎯 [DETECT] Ubicaciones potenciales encontradas: ${Array.from(potentialLocations).join(', ')}`);
        
        const createdCoverages = [];
        const detectionResults = [];
        
        // Procesar cada ubicación potencial
        for (const location of potentialLocations) {
            try {
                // Intentar normalizar como ciudad primero
                const normalized = await normalizeGeographicInfo({ 
                    city: location, 
                    department: null, 
                    pais: 'Guatemala' 
                });
                
                // Solo crear cobertura si es una ubicación geográfica válida
                if (normalized.city && normalized.department && normalized.pais) {
                    // Verificar si ya existe esta cobertura
                    const { data: existing } = await supabase
                        .from('project_coverages')
                        .select('id')
                        .eq('project_id', project_id)
                        .eq('coverage_type', 'ciudad')
                        .eq('name', normalized.city)
                        .eq('parent_name', normalized.department)
                        .single();
                    
                    if (!existing) {
                        // Crear nueva cobertura
                        const { data: newCoverage, error: createError } = await supabase
                            .from('project_coverages')
                            .insert({
                                project_id,
                                coverage_type: 'ciudad',
                                name: normalized.city,
                                parent_name: normalized.department,
                                description: `Detectado automáticamente del texto: "${location}"`,
                                detection_source: source_type,
                                confidence_score: 0.8,
                                source_card_id: source_card_id || null,
                                source_item_id: source_item_id || null,
                                discovery_context: `Extraído del texto mediante análisis geográfico`
                            })
                            .select()
                            .single();
                        
                        if (!createError && newCoverage) {
                            createdCoverages.push(newCoverage);
                            detectionResults.push({
                                original: location,
                                normalized: normalized.city,
                                department: normalized.department,
                                type: 'ciudad'
                            });
                        }
                    }
                }
            } catch (normalizeError) {
                console.warn(`⚠️ [DETECT] No se pudo normalizar "${location}": ${normalizeError.message}`);
                // Continuar con la siguiente ubicación
            }
        }
        
        console.log(`✅ [DETECT] Creadas ${createdCoverages.length} nuevas coberturas geográficas`);
        
        // Log de uso
        await logUsage(req.user, 'coverage_detect', 0, req);

        res.json({
            success: true,
            detected_count: createdCoverages.length,
            coverage_types: ['ciudad'],
            new_coverages: createdCoverages,
            detection_details: detectionResults,
            message: createdCoverages.length > 0 
                ? `Se detectaron ${createdCoverages.length} nuevas ubicaciones geográficas válidas`
                : 'No se detectaron ubicaciones geográficas válidas en el texto'
        });

    } catch (error) {
        console.error('Error in POST /coverages/detect:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// POST /api/coverages/from-card - Crear cobertura desde información de una card
router.post('/from-card', verifyUserAccess, async (req, res) => {
    try {
        const { card_id, project_id } = req.body;

        if (!card_id || !project_id) {
            return res.status(400).json({
                error: 'card_id y project_id son requeridos'
            });
        }

        console.log(`🔍 Buscando card con ID: ${card_id}`);

        // Obtener información de la card
        const { data: card, error: cardError } = await supabase
            .from('capturado_cards')
            .select('*')
            .eq('id', card_id)
            .single();

        if (cardError) {
            console.error('❌ Error consultando capturado_cards:', cardError);
            if (cardError.code === 'PGRST116') {
                return res.status(404).json({ 
                    error: 'Card no encontrada',
                    details: `No existe una card con ID: ${card_id}`,
                    debug_info: {
                        card_id,
                        error_code: cardError.code,
                        error_message: cardError.message
                    }
                });
            }
            return res.status(500).json({ 
                error: 'Error consultando la base de datos',
                details: cardError.message 
            });
        }

        if (!card) {
            console.warn('⚠️ Card no encontrada - respuesta vacía');
            return res.status(404).json({ 
                error: 'Card no encontrada',
                details: `No existe una card con ID: ${card_id}`,
                debug_info: {
                    card_id,
                    query_result: 'empty'
                }
            });
        }

        console.log(`✅ Card encontrada: ${card.entity || 'Sin entidad'} - ${card.city || 'Sin ciudad'}, ${card.department || 'Sin departamento'}`);

        // Verificar acceso al proyecto
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id, collaborators')
            .eq('id', project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ 
                error: 'Proyecto no encontrado' 
            });
        }

        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'No tienes permisos para agregar coberturas a este proyecto' 
            });
        }

        // Extraer información geográfica de la card
        const coveragesToCreate = [];

        // País
        if (card.pais) {
            coveragesToCreate.push({
                coverage_type: 'pais',
                name: card.pais,
                parent_name: null,
                description: `Detectado desde: ${card.discovery || card.description || 'Card capturada'}`,
                relevance: 'high'
            });
        }

        // Ciudad
        if (card.city) {
            coveragesToCreate.push({
                coverage_type: 'ciudad',
                name: card.city,
                parent_name: card.department || null,
                description: `Detectado desde: ${card.discovery || card.description || 'Card capturada'}`,
                relevance: 'medium'
            });
        }

        // Departamento
        if (card.department) {
            coveragesToCreate.push({
                coverage_type: 'departamento',
                name: card.department,
                parent_name: card.pais || 'Guatemala',
                description: `Detectado desde: ${card.discovery || card.description || 'Card capturada'}`,
                relevance: 'medium'
            });
        }

        if (coveragesToCreate.length === 0) {
            return res.status(400).json({
                error: 'La card no contiene información geográfica válida',
                details: 'Se requiere al menos país, ciudad o departamento',
                card_data: {
                    pais: card.pais,
                    city: card.city,
                    department: card.department,
                    entity: card.entity
                }
            });
        }

        // Crear las coberturas
        const createdCoverages = [];
        const errors = [];

        for (const coverageData of coveragesToCreate) {
            try {
                const { data: coverage, error: insertError } = await supabase
                    .from('project_coverages')
                    .insert({
                        project_id,
                        ...coverageData,
                        detection_source: 'document_analysis',
                        confidence_score: 0.85,
                        source_card_id: card_id,
                        source_item_id: card.codex_item_id,
                        discovery_context: `Extraído de card: ${card.entity || 'Sin entidad'} - ${card.discovery || 'Sin descripción'}`
                    })
                    .select()
                    .single();

                if (insertError) {
                    if (insertError.code === '23505') {
                        // Cobertura duplicada, no es error crítico
                        errors.push(`Cobertura ${coverageData.coverage_type}:${coverageData.name} ya existe`);
                    } else {
                        throw insertError;
                    }
                } else {
                    createdCoverages.push(coverage);
                }
            } catch (error) {
                console.error(`Error creating coverage ${coverageData.name}:`, error);
                errors.push(`Error creando ${coverageData.coverage_type}:${coverageData.name}`);
            }
        }

        // Log de uso
        await logUsage(req.user, 'coverage_from_card', 0, req);

        res.json({
            success: true,
            created_coverages: createdCoverages,
            created_count: createdCoverages.length,
            errors: errors.length > 0 ? errors : undefined,
            message: createdCoverages.length > 0 
                ? `Se crearon ${createdCoverages.length} coberturas desde la card`
                : 'No se pudieron crear coberturas desde la card'
        });

    } catch (error) {
        console.error('Error in POST /coverages/from-card:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// PUT /api/coverages/:id - Actualizar cobertura
router.put('/:id', verifyUserAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            parent_name,
            description,
            relevance,
            coverage_status,
            coordinates,
            tags
        } = req.body;

        // Verificar que la cobertura existe y el usuario tiene permisos
        const { data: coverage, error: fetchError } = await supabase
            .from('project_coverages')
            .select(`
                *,
                projects!inner(id, user_id, collaborators)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !coverage) {
            return res.status(404).json({ 
                error: 'Cobertura no encontrada' 
            });
        }

        const project = coverage.projects;
        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'No tienes permisos para modificar esta cobertura' 
            });
        }

        // Preparar datos de actualización
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (parent_name !== undefined) updateData.parent_name = parent_name?.trim() || null;
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (relevance !== undefined) updateData.relevance = relevance;
        if (coverage_status !== undefined) updateData.coverage_status = coverage_status;
        if (coordinates !== undefined) updateData.coordinates = coordinates;
        if (tags !== undefined) updateData.tags = tags;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                error: 'No se proporcionaron campos para actualizar'
            });
        }

        // Actualizar la cobertura
        const { data: updatedCoverage, error: updateError } = await supabase
            .from('project_coverages')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating coverage:', updateError);
            return res.status(500).json({ 
                error: 'Error al actualizar cobertura',
                details: updateError.message 
            });
        }

        // Log de uso
        await logUsage(req.user, 'coverage_update', 0, req);

        res.json({
            success: true,
            coverage: updatedCoverage,
            message: 'Cobertura actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error in PUT /coverages/:id:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// DELETE /api/coverages/:id - Eliminar cobertura
router.delete('/:id', verifyUserAccess, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que la cobertura existe y el usuario tiene permisos
        const { data: coverage, error: fetchError } = await supabase
            .from('project_coverages')
            .select(`
                *,
                projects!inner(id, user_id, collaborators)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !coverage) {
            return res.status(404).json({ 
                error: 'Cobertura no encontrada' 
            });
        }

        const project = coverage.projects;
        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'No tienes permisos para eliminar esta cobertura' 
            });
        }

        // Eliminar la cobertura
        const { error: deleteError } = await supabase
            .from('project_coverages')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting coverage:', deleteError);
            return res.status(500).json({ 
                error: 'Error al eliminar cobertura',
                details: deleteError.message 
            });
        }

        // Log de uso
        await logUsage(req.user, 'coverage_delete', 0, req);

        res.json({
            success: true,
            message: 'Cobertura eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error in DELETE /coverages/:id:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// GET /api/coverages/stats/:project_id - Estadísticas de coberturas de un proyecto
router.get('/stats/:project_id', verifyUserAccess, async (req, res) => {
    try {
        const { project_id } = req.params;

        // Verificar acceso al proyecto
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id, collaborators')
            .eq('id', project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ 
                error: 'Proyecto no encontrado' 
            });
        }

        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'No tienes permisos para ver estadísticas de este proyecto' 
            });
        }

        // Obtener estadísticas
        const { data: coverages, error: statsError } = await supabase
            .from('project_coverages')
            .select('coverage_type, detection_source, coverage_status, relevance, created_at')
            .eq('project_id', project_id);

        if (statsError) {
            console.error('Error fetching coverage stats:', statsError);
            return res.status(500).json({ 
                error: 'Error al obtener estadísticas',
                details: statsError.message 
            });
        }

        // Procesar estadísticas
        const stats = {
            total: coverages.length,
            by_type: {},
            by_source: {},
            by_status: {},
            by_relevance: {},
            timeline: {}
        };

        coverages.forEach(coverage => {
            // Por tipo
            stats.by_type[coverage.coverage_type] = (stats.by_type[coverage.coverage_type] || 0) + 1;
            
            // Por fuente
            stats.by_source[coverage.detection_source] = (stats.by_source[coverage.detection_source] || 0) + 1;
            
            // Por estado
            stats.by_status[coverage.coverage_status] = (stats.by_status[coverage.coverage_status] || 0) + 1;
            
            // Por relevancia
            stats.by_relevance[coverage.relevance] = (stats.by_relevance[coverage.relevance] || 0) + 1;
            
            // Timeline (por mes)
            const month = coverage.created_at.substring(0, 7); // YYYY-MM
            stats.timeline[month] = (stats.timeline[month] || 0) + 1;
        });

        res.json({
            success: true,
            project_id,
            stats
        });

    } catch (error) {
        console.error('Error in GET /coverages/stats/:project_id:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// POST /api/coverages/auto-detect - Detectar coberturas automáticamente desde hallazgos agrupadas por tema
// 🆓 OPERACIÓN GRATUITA - No consume créditos del usuario
router.post('/auto-detect', verifyUserAccess, async (req, res) => {
    try {
        const { project_id } = req.body;

        if (!project_id) {
            return res.status(400).json({
                error: 'project_id es requerido'
            });
        }

        // Verificar acceso al proyecto
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id, collaborators')
            .eq('id', project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ 
                error: 'Proyecto no encontrado' 
            });
        }

        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'No tienes permisos para detectar coberturas en este proyecto' 
            });
        }

        // Obtener todos los hallazgos del proyecto con información geográfica
        const { data: cards, error: cardsError } = await supabase
            .from('capturado_cards')
            .select('id, topic, pais, city, department, entity, discovery, description, created_at')
            .eq('project_id', project_id)
            .or('pais.not.is.null,city.not.is.null,department.not.is.null');

        if (cardsError) {
            console.error('Error fetching cards:', cardsError);
            return res.status(500).json({ 
                error: 'Error al obtener hallazgos',
                details: cardsError.message 
            });
        }

        if (!cards || cards.length === 0) {
            return res.json({
                success: true,
                message: 'No se encontraron hallazgos con información geográfica',
                coverage_groups: [],
                created_count: 0
            });
        }

        // 🌎 NORMALIZACIÓN GEOGRÁFICA CON MAPSAGENT
        console.log(`🗺️ [AUTO-DETECT] Normalizando geografía con mapsAgent para ${cards.length} hallazgos...`);
        
        // Declarar variables fuera del bloque try para que estén disponibles globalmente
        let coverageGroups = {};
        let createdCoverages = [];
        let errors = [];
        let normalizedCards = [];
        
        try {
            // Normalizar con mapsAgent en lugar de IA antigua (INCLUYE GEOCODIFICACIÓN)
            normalizedCards = await Promise.all(cards.map(async card => {
                const normalized = await normalizeGeographicInfoWithCoordinates({
                    city: card.city,
                    department: card.department,
                    pais: card.pais
                });
                
                // Solo crear cobertura si es una ubicación geográfica válida
                const isValidLocation = normalized.city || normalized.department || normalized.pais;
                const isInstitution = card.city && (
                    card.city.toLowerCase().includes('comisión') ||
                    card.city.toLowerCase().includes('departamento de') ||
                    card.city.toLowerCase().includes('ministerio') ||
                    card.city.toLowerCase().includes('banco') ||
                    card.city.toLowerCase().includes('empresa')
                );
                
                if (isInstitution) {
                    console.log(`🚫 [AUTO-DETECT] Rechazando institución: "${card.city}"`);
                    return null; // Rechazar instituciones
                }
                
                return {
                    ...card,
                    city: normalized.city,
                    department: normalized.department,
                    pais: normalized.pais,
                    _detection_method: normalized.detection_method || 'mapsAgent',
                    _confidence: normalized.confidence || 0.95
                };
            })).then(cards => cards.filter(card => card !== null)); // Filtrar instituciones rechazadas

            console.log(`✅ [AUTO-DETECT] Normalización geográfica completada con mapsAgent. ${normalizedCards.length} ubicaciones válidas.`);

            // Estadísticas de detección
            const detectionStats = {
                ai_detections: normalizedCards.filter(c => c._detection_method === 'gemini_ai').length,
                manual_fallback: normalizedCards.filter(c => c._detection_method === 'manual_fallback').length,
                original: normalizedCards.filter(c => c._detection_method === 'original').length
            };
            
            console.log(`📊 Estadísticas de detección automática:`, detectionStats);

            // PASO 1: Agrupar hallazgos por ubicación (no por tema) para crear coberturas que agrupen TODOS los hallazgos de una ubicación
            const locationGroups = {
                countries: new Map(), // key: country name, value: cards array
                departments: new Map(), // key: department name, value: cards array  
                cities: new Map() // key: city name, value: {cards, department}
            };

            // Agrupar por ubicaciones reales
            for (const geoCard of normalizedCards) {
                // Agrupar por país
                if (geoCard.pais) {
                    if (!locationGroups.countries.has(geoCard.pais)) {
                        locationGroups.countries.set(geoCard.pais, []);
                    }
                    locationGroups.countries.get(geoCard.pais).push(geoCard);
                }

                // Agrupar por departamento
                if (geoCard.department) {
                    if (!locationGroups.departments.has(geoCard.department)) {
                        locationGroups.departments.set(geoCard.department, []);
                    }
                    locationGroups.departments.get(geoCard.department).push(geoCard);
                }

                // Agrupar por ciudad
                if (geoCard.city) {
                    if (!locationGroups.cities.has(geoCard.city)) {
                        locationGroups.cities.set(geoCard.city, {
                        cards: [],
                            department: geoCard.department || null
                        });
                    }
                    locationGroups.cities.get(geoCard.city).cards.push(geoCard);
                }
            }

            console.log(`📊 Ubicaciones agrupadas:`, {
                countries: locationGroups.countries.size,
                departments: locationGroups.departments.size,
                cities: locationGroups.cities.size
            });

            // PASO 2: Crear coberturas únicas por ubicación (todas las cartas de esa ubicación)
                const coveragesToCreate = [];

            // Crear una cobertura por país único
            for (const [countryName, cardsForCountry] of locationGroups.countries) {
                const themes = [...new Set(cardsForCountry.map(c => c.topic || 'General'))];
                    coveragesToCreate.push({
                        coverage_type: 'pais',
                    name: countryName,
                        parent_name: null,
                        relevance: 'high',
                    cards: cardsForCountry,
                    themes
                    });
                }

            // Crear una cobertura por departamento único
            for (const [departmentName, cardsForDepartment] of locationGroups.departments) {
                const themes = [...new Set(cardsForDepartment.map(c => c.topic || 'General'))];
                    coveragesToCreate.push({
                        coverage_type: 'departamento',
                    name: departmentName,
                    parent_name: 'Guatemala',
                        relevance: 'medium',
                    cards: cardsForDepartment,
                    themes
                    });
                }

            // Crear una cobertura por ciudad única
            for (const [cityName, cityData] of locationGroups.cities) {
                const themes = [...new Set(cityData.cards.map(c => c.topic || 'General'))];
                    coveragesToCreate.push({
                        coverage_type: 'ciudad',
                    name: cityName,
                    parent_name: cityData.department,
                        relevance: 'medium',
                    cards: cityData.cards,
                    themes
                    });
                }

            console.log(`🏗️ Creando/actualizando ${coveragesToCreate.length} coberturas únicas...`);

            // PASO 3: Crear o actualizar cada cobertura única usando UPSERT atómico
            let newCoveragesCount = 0;
            let updatedCoveragesCount = 0;

            for (const coverageData of coveragesToCreate) {
                try {
                    // Card representativa (primera del grupo)
                    const representativeCard = coverageData.cards[0];
                    
                    // Preparar datos estructurados por tema
                    const themeBreakdown = {};
                    coverageData.cards.forEach(card => {
                        const theme = card.topic || 'General';
                        if (!themeBreakdown[theme]) {
                            themeBreakdown[theme] = {
                                theme_name: theme,
                                cards_count: 0,
                                sample_cards: []
                            };
                        }
                        themeBreakdown[theme].cards_count++;
                        
                        // Guardar hasta 3 cards como muestra para cada tema
                        if (themeBreakdown[theme].sample_cards.length < 3) {
                            themeBreakdown[theme].sample_cards.push({
                                id: card.id,
                                entity: card.entity,
                                discovery: card.discovery?.substring(0, 200) || card.description?.substring(0, 200) || 'Sin descripción',
                                created_at: card.created_at
                            });
                        }
                    });

                    // VERIFICAR PRIMERO SI EXISTE para determinar si es nueva o actualización
                    const { data: existingCoverage } = await supabase
                        .from('project_coverages')
                        .select('id')
                        .eq('project_id', project_id)
                        .eq('coverage_type', coverageData.coverage_type)
                        .eq('name', coverageData.name)
                        .eq('parent_name', coverageData.parent_name || null)
                        .maybeSingle(); // maybeSingle no falla si no encuentra nada

                    const isNew = !existingCoverage;

                    // Obtener coordenadas del primer card con coordenadas válidas
                    const coordinatesFromCards = coverageData.cards
                        .map(card => card.coordinates)
                        .find(coords => coords && coords.lat && coords.lng);
                    
                    // UPSERT ATÓMICO - esto previene duplicados por completo (INCLUYE COORDENADAS)
                    const { data: coverage, error: upsertError } = await supabase
                        .from('project_coverages')
                        .upsert({
                            project_id,
                            coverage_type: coverageData.coverage_type,
                            name: coverageData.name,
                            parent_name: coverageData.parent_name,
                            relevance: coverageData.relevance,
                            coordinates: coordinatesFromCards || null, // ✅ AGREGAR COORDENADAS
                            description: `Detectado automáticamente desde ${coverageData.cards.length} hallazgo(s) en ${coverageData.themes.length} tema(s): ${coverageData.themes.join(', ')}`,
                            detection_source: 'mapsAgent',
                            confidence_score: 0.90,
                            source_card_id: representativeCard.id,
                            discovery_context: JSON.stringify(themeBreakdown), // Guardar estructura completa
                            tags: [...coverageData.themes, 'auto-detectado'],
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'project_id,coverage_type,name,parent_name',
                            ignoreDuplicates: false
                        })
                        .select()
                        .single();

                    if (upsertError) {
                        console.error(`❌ Error en upsert para cobertura ${coverageData.name}:`, upsertError);
                        errors.push(`Error procesando ${coverageData.coverage_type}:${coverageData.name}`);
                    } else {
                        if (isNew) {
                        createdCoverages.push(coverage);
                            newCoveragesCount++;
                            console.log(`✅ Nueva cobertura creada: ${coverageData.coverage_type}:${coverageData.name} (${coverageData.cards.length} hallazgos, ${coverageData.themes.length} temas)`);
                        } else {
                            updatedCoveragesCount++;
                            console.log(`🔄 Cobertura actualizada: ${coverageData.coverage_type}:${coverageData.name} (${coverageData.cards.length} hallazgos, ${coverageData.themes.length} temas)`);
                        }
                        
                        // Reorganizar para mantener compatibilidad con el resto del código
                        coverageData.themes.forEach(theme => {
                            if (!coverageGroups[theme]) {
                                coverageGroups[theme] = {
                                    topic: theme,
                                    cards: [],
                                    countries: new Set(),
                                    departments: new Set(),
                                    cities: new Set(),
                                    coverages_created: []
                                };
                            }
                            // Solo agregar la cobertura una vez al primer tema
                            if (theme === coverageData.themes[0]) {
                                coverageGroups[theme].coverages_created.push({...coverage, _isNew: isNew});
                            }
                        });
                    }
                } catch (error) {
                    console.error(`❌ Error processing coverage ${coverageData.name}:`, error);
                    errors.push(`Error procesando ${coverageData.coverage_type}:${coverageData.name}`);
                }
            }

            console.log(`📊 Resultado del procesamiento: ${newCoveragesCount} nuevas, ${updatedCoveragesCount} actualizadas`);

        } catch (geoError) {
            console.error(`❌ Error en normalización geográfica con IA:`, geoError.message);
            console.log(`🔄 Fallback a procesamiento manual sin IA...`);
             
             // Fallback: procesar sin normalización de IA usando las variables ya declaradas
             coverageGroups = {};
             createdCoverages = [];
             errors = [];

             // PASO 1: Agrupar hallazgos por ubicación usando fallback manual
             const locationGroups = {
                 countries: new Map(),
                 departments: new Map(),
                 cities: new Map()
             };

             // Procesar con normalización manual
             for (const card of cards) {
                 // Usar normalización manual como fallback
                 const manualNormalized = normalizeGeographicInfoSync({
                     city: card.city,
                     department: card.department,
                     pais: card.pais
                 });

                 const geoCard = {
                     ...card,
                     city: manualNormalized.city,
                     department: manualNormalized.department,
                     pais: manualNormalized.pais
                 };

                 // Agrupar por ubicaciones (igual que con IA)
                 if (geoCard.pais) {
                     if (!locationGroups.countries.has(geoCard.pais)) {
                         locationGroups.countries.set(geoCard.pais, []);
                     }
                     locationGroups.countries.get(geoCard.pais).push(geoCard);
                 }

                 if (geoCard.department) {
                     if (!locationGroups.departments.has(geoCard.department)) {
                         locationGroups.departments.set(geoCard.department, []);
                     }
                     locationGroups.departments.get(geoCard.department).push(geoCard);
                 }

                 if (geoCard.city) {
                     if (!locationGroups.cities.has(geoCard.city)) {
                         locationGroups.cities.set(geoCard.city, {
                             cards: [],
                             department: geoCard.department || null
                         });
                     }
                     locationGroups.cities.get(geoCard.city).cards.push(geoCard);
                 }
             }

             console.log(`📊 Ubicaciones agrupadas (fallback):`, {
                 countries: locationGroups.countries.size,
                 departments: locationGroups.departments.size,
                 cities: locationGroups.cities.size
             });
        }

        // Convertir Sets a Arrays para respuesta
        Object.values(coverageGroups).forEach(group => {
            group.countries = Array.from(group.countries);
            group.departments = Array.from(group.departments);
            group.cities = Array.from(group.cities);
            group.total_cards = group.cards.length;
            delete group.cards; // No enviar las cards completas en la respuesta
        });

        // Calcular estadísticas finales
        const totalProcessed = Object.values(coverageGroups).reduce((sum, group) => sum + group.coverages_created.length, 0);
        const newCoverages = createdCoverages.length;
        const updatedCoverages = totalProcessed - newCoverages;

        res.json({
            success: true,
            coverage_groups: Object.values(coverageGroups),
            created_count: newCoverages,
            updated_count: updatedCoverages,
            total_processed: totalProcessed,
            themes_count: Object.keys(coverageGroups).length,
            cards_processed: cards.length,
            errors: errors.length > 0 ? errors : undefined,
            message: `Se procesaron ${Object.keys(coverageGroups).length} temas: ${newCoverages} coberturas nuevas creadas, ${updatedCoverages} existentes actualizadas`
        });

    } catch (error) {
        console.error('Error in POST /coverages/auto-detect:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

module.exports = router;