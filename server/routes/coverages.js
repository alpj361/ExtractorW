// ===================================================================
// RUTAS PARA GESTIÓN DE COBERTURAS DE PROYECTOS
// Maneja zonas geográficas detectadas y agregadas manualmente
// ===================================================================

const express = require('express');
const supabase = require('../utils/supabase');
const { verifyUserAccess } = require('../middlewares/auth');
const { logUsage } = require('../services/logs');
const { normalizeGeographicInfoWithAI, batchNormalizeGeography } = require('../utils/geographic-ai-detector');
const { normalizeGeographicInfo: manualNormalize, getDepartmentForCity } = require('../utils/guatemala-geography');

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
        await logUsage(req.user.id, 'coverage_list', {
            project_id,
            total_coverages: coverages.length,
            filters_applied: { type, status, source }
        });

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

        // Validaciones básicas
        if (!project_id || !coverage_type || !name) {
            return res.status(400).json({
                error: 'project_id, coverage_type y name son requeridos'
            });
        }

        const validTypes = ['pais', 'departamento', 'ciudad', 'zona', 'region'];
        if (!validTypes.includes(coverage_type)) {
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

        // Crear la cobertura
        const { data: coverage, error: insertError } = await supabase
            .from('project_coverages')
            .insert({
                project_id,
                coverage_type,
                name: name.trim(),
                parent_name: parent_name?.trim() || null,
                description: description?.trim() || null,
                relevance,
                coordinates: coordinates || null,
                tags: tags || [],
                detection_source: 'manual',
                confidence_score: 1.0,
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
        await logUsage(req.user.id, 'coverage_create', {
            project_id,
            coverage_type,
            name,
            detection_source: 'manual'
        });

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

        // Llamar a la función de detección
        const { data: result, error: detectError } = await supabase
            .rpc('detect_coverage_from_text', {
                input_text: text,
                project_uuid: project_id,
                source_type,
                source_item_uuid: source_item_id || null,
                source_card_uuid: source_card_id || null
            });

        if (detectError) {
            console.error('Error in coverage detection:', detectError);
            return res.status(500).json({ 
                error: 'Error al detectar coberturas',
                details: detectError.message 
            });
        }

        const detectionResult = result[0] || { detected_count: 0, coverage_types: [] };

        // Obtener las coberturas recién creadas
        const { data: newCoverages, error: fetchError } = await supabase
            .from('project_coverages')
            .select('*')
            .eq('project_id', project_id)
            .in('detection_source', [source_type])
            .order('created_at', { ascending: false })
            .limit(detectionResult.detected_count || 10);

        if (fetchError) {
            console.warn('Error fetching new coverages:', fetchError);
        }

        // Log de uso
        await logUsage(req.user.id, 'coverage_detect', {
            project_id,
            text_length: text.length,
            detected_count: detectionResult.detected_count,
            source_type,
            coverage_types: detectionResult.coverage_types
        });

        res.json({
            success: true,
            detected_count: detectionResult.detected_count,
            coverage_types: detectionResult.coverage_types,
            new_coverages: newCoverages || [],
            message: detectionResult.detected_count > 0 
                ? `Se detectaron ${detectionResult.detected_count} nuevas coberturas`
                : 'No se detectaron nuevas coberturas en el texto'
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
        await logUsage(req.user.id, 'coverage_from_card', {
            project_id,
            card_id,
            created_count: createdCoverages.length,
            errors_count: errors.length
        });

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
        await logUsage(req.user.id, 'coverage_update', {
            coverage_id: id,
            project_id: coverage.project_id,
            updated_fields: Object.keys(updateData)
        });

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
        await logUsage(req.user.id, 'coverage_delete', {
            coverage_id: id,
            project_id: coverage.project_id,
            coverage_type: coverage.coverage_type,
            name: coverage.name
        });

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

        // 🌎 NORMALIZACIÓN GEOGRÁFICA CON IA EN LOTE
        console.log(`🤖 Normalizando geografía con IA para ${cards.length} hallazgos...`);
        
        // Declarar variables fuera del bloque try para que estén disponibles globalmente
        let coverageGroups = {};
        let createdCoverages = [];
        let errors = [];
        let normalizedCards = [];
        
        try {
            // Extraer información geográfica para normalización en lote
            const geoData = cards.map(card => ({
                city: card.city,
                department: card.department,
                pais: card.pais
            }));

            // Normalizar con IA en lote
            const normalizedGeoData = await batchNormalizeGeography(geoData);

            // Aplicar resultados normalizados a las cards
            normalizedCards = cards.map((card, index) => {
                const normalized = normalizedGeoData[index];
                return {
                    ...card,
                    city: normalized.city,
                    department: normalized.department,
                    pais: normalized.pais,
                    _detection_method: normalized.detection_method,
                    _confidence: normalized.confidence
                };
            });

            console.log(`✅ Normalización geográfica completada con IA`);

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

            // PASO 3: Crear o actualizar cada cobertura única
            for (const coverageData of coveragesToCreate) {
                try {
                    // Verificar si la cobertura ya existe
                    const { data: existingCoverage, error: checkError } = await supabase
                        .from('project_coverages')
                        .select('id, updated_at')
                        .eq('project_id', project_id)
                        .eq('coverage_type', coverageData.coverage_type)
                        .eq('name', coverageData.name)
                        .eq('parent_name', coverageData.parent_name || null)
                        .single();

                    let isNew = !existingCoverage || checkError;
                    
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

                        // Usar UPSERT para insertar o actualizar
                        const { data: coverage, error: upsertError } = await supabase
                            .from('project_coverages')
                            .upsert({
                                project_id,
                                coverage_type: coverageData.coverage_type,
                                name: coverageData.name,
                                parent_name: coverageData.parent_name,
                                relevance: coverageData.relevance,
                                description: `Detectado automáticamente desde ${coverageData.cards.length} hallazgo(s) en ${coverageData.themes.length} tema(s): ${coverageData.themes.join(', ')}`,
                                detection_source: 'ai_detection',
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
                        console.error(`Error en upsert para cobertura ${coverageData.name}:`, upsertError);
                        errors.push(`Error procesando ${coverageData.coverage_type}:${coverageData.name}`);
                    } else {
                        if (isNew) {
                            createdCoverages.push(coverage);
                            console.log(`✅ Nueva cobertura creada: ${coverageData.coverage_type}:${coverageData.name} (${coverageData.cards.length} hallazgos, ${coverageData.themes.length} temas)`);
                        } else {
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
                    console.error(`Error processing coverage ${coverageData.name}:`, error);
                    errors.push(`Error procesando ${coverageData.coverage_type}:${coverageData.name}`);
                }
            }

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
                const manualNormalized = manualNormalize({
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

            // PASO 2: Crear coberturas únicas por ubicación (fallback)
            const coveragesToCreate = [];

            // Países
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

            // Departamentos
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

            // Ciudades
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

            console.log(`🏗️ Creando/actualizando ${coveragesToCreate.length} coberturas únicas (fallback)...`);

            // PASO 3: Crear o actualizar cada cobertura única (fallback)
            for (const coverageData of coveragesToCreate) {
                try {
                    // Verificar si la cobertura ya existe
                    const { data: existingCoverage, error: checkError } = await supabase
                        .from('project_coverages')
                        .select('id, updated_at')
                        .eq('project_id', project_id)
                        .eq('coverage_type', coverageData.coverage_type)
                        .eq('name', coverageData.name)
                        .eq('parent_name', coverageData.parent_name || null)
                        .single();

                    let isNew = !existingCoverage || checkError;

                    // Card representativa
                    const representativeCard = coverageData.cards[0];

                    // Preparar datos estructurados por tema (fallback)
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

                    // Usar UPSERT para insertar o actualizar si existe
                    const { data: coverage, error: upsertError } = await supabase
                        .from('project_coverages')
                        .upsert({
                            project_id,
                            coverage_type: coverageData.coverage_type,
                            name: coverageData.name,
                            parent_name: coverageData.parent_name,
                            relevance: coverageData.relevance,
                            description: `Detectado con fallback manual desde ${coverageData.cards.length} hallazgo(s) en ${coverageData.themes.length} tema(s): ${coverageData.themes.join(', ')}`,
                            detection_source: 'manual_fallback',
                            confidence_score: 0.75,
                            source_card_id: representativeCard.id,
                            discovery_context: JSON.stringify(themeBreakdown), // Guardar estructura completa
                            tags: [...coverageData.themes, 'fallback-manual'],
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'project_id,coverage_type,name,parent_name',
                            ignoreDuplicates: false
                        })
                        .select()
                        .single();

                    if (upsertError) {
                        console.error(`Error en upsert fallback para cobertura ${coverageData.name}:`, upsertError);
                        errors.push(`Error procesando ${coverageData.coverage_type}:${coverageData.name} (fallback)`);
                    } else {
                        if (isNew) {
                            createdCoverages.push(coverage);
                            console.log(`✅ Nueva cobertura creada (fallback): ${coverageData.coverage_type}:${coverageData.name} (${coverageData.cards.length} hallazgos, ${coverageData.themes.length} temas)`);
                        } else {
                            console.log(`🔄 Cobertura actualizada (fallback): ${coverageData.coverage_type}:${coverageData.name} (${coverageData.cards.length} hallazgos, ${coverageData.themes.length} temas)`);
                        }
                        
                        // Reorganizar para mantener compatibilidad
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
                    console.error(`Error processing fallback coverage ${coverageData.name}:`, error);
                    errors.push(`Error procesando ${coverageData.coverage_type}:${coverageData.name} (fallback)`);
                }
            }
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

// POST /api/coverages/update-geography - Actualizar información geográfica de hallazgos existentes  
// 🆓 OPERACIÓN GRATUITA - No consume créditos del usuario
router.post('/update-geography', verifyUserAccess, async (req, res) => {
    try {
        const { project_id, card_ids } = req.body;

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
                error: 'No tienes permisos para actualizar hallazgos de este proyecto' 
            });
        }

        // Construir query para obtener hallazgos
        let query = supabase
            .from('capturado_cards')
            .select('id, city, department, pais, topic, entity, discovery, description')
            .eq('project_id', project_id);

        // Si se especifican IDs específicos, filtrar por ellos
        if (card_ids && Array.isArray(card_ids) && card_ids.length > 0) {
            query = query.in('id', card_ids);
            console.log(`🎯 Actualizando ${card_ids.length} hallazgos específicos`);
        } else {
            console.log('🔄 Actualizando todos los hallazgos del proyecto');
        }

        const { data: cards, error: cardsError } = await query;

        if (cardsError) {
            console.error('Error fetching cards for update:', cardsError);
            return res.status(500).json({ 
                error: 'Error al obtener hallazgos',
                details: cardsError.message 
            });
        }

        if (!cards || cards.length === 0) {
            return res.json({
                success: true,
                message: 'No se encontraron hallazgos para actualizar',
                updated_count: 0
            });
        }

        console.log(`🤖 Actualizando geografía con IA para ${cards.length} hallazgos...`);

        try {
            // Extraer información geográfica actual
            const geoData = cards.map(card => ({
                city: card.city,
                department: card.department,
                pais: card.pais
            }));

            // Normalizar con IA en lote
            const normalizedGeoData = await batchNormalizeGeography(geoData);

            // Actualizar hallazgos en base de datos
            const updatePromises = cards.map(async (card, index) => {
                const normalized = normalizedGeoData[index];
                
                // Solo actualizar si hay cambios
                const hasChanges = 
                    normalized.city !== card.city ||
                    normalized.department !== card.department ||
                    normalized.pais !== card.pais;

                if (hasChanges) {
                    const { error: updateError } = await supabase
                        .from('capturado_cards')
                        .update({
                            city: normalized.city,
                            department: normalized.department,
                            pais: normalized.pais
                        })
                        .eq('id', card.id);

                    if (updateError) {
                        console.error(`Error updating card ${card.id}:`, updateError);
                        return { 
                            card_id: card.id, 
                            success: false, 
                            error: updateError.message 
                        };
                    }

                    return {
                        card_id: card.id,
                        success: true,
                        changes: {
                            original: { city: card.city, department: card.department, pais: card.pais },
                            updated: { city: normalized.city, department: normalized.department, pais: normalized.pais },
                            detection_method: normalized.detection_method,
                            confidence: normalized.confidence
                        }
                    };
                } else {
                    return {
                        card_id: card.id,
                        success: true,
                        changes: null // Sin cambios
                    };
                }
            });

            const updateResults = await Promise.all(updatePromises);

            // Calcular estadísticas
            const stats = {
                total_processed: updateResults.length,
                updated_count: updateResults.filter(r => r.success && r.changes).length,
                no_changes_count: updateResults.filter(r => r.success && !r.changes).length,
                error_count: updateResults.filter(r => !r.success).length,
                ai_detections: updateResults.filter(r => r.changes?.detection_method === 'gemini_ai').length,
                manual_fallback: updateResults.filter(r => r.changes?.detection_method === 'manual_fallback').length
            };

            res.json({
                success: true,
                message: `Actualización completada: ${stats.updated_count} hallazgos actualizados, ${stats.no_changes_count} sin cambios`,
                stats,
                details: updateResults.map(r => ({
                    card_id: r.card_id,
                    updated: !!r.changes,
                    detection_method: r.changes?.detection_method,
                    confidence: r.changes?.confidence
                }))
            });

        } catch (geoError) {
            console.error(`❌ Error en actualización geográfica:`, geoError.message);
            
            // Intentar con fallback manual
            const fallbackPromises = cards.map(async (card) => {
                try {
                    const manualNormalized = manualNormalize({
                        city: card.city,
                        department: card.department,
                        pais: card.pais
                    });

                    const hasChanges = 
                        manualNormalized.city !== card.city ||
                        manualNormalized.department !== card.department ||
                        manualNormalized.pais !== card.pais;

                    if (hasChanges) {
                        const { error: updateError } = await supabase
                            .from('capturado_cards')
                            .update({
                                city: manualNormalized.city,
                                department: manualNormalized.department,
                                pais: manualNormalized.pais
                            })
                            .eq('id', card.id);

                        if (updateError) throw updateError;

                        return { card_id: card.id, success: true, fallback: true };
                    }

                    return { card_id: card.id, success: true, no_changes: true };
                } catch (error) {
                    return { card_id: card.id, success: false, error: error.message };
                }
            });

            const fallbackResults = await Promise.all(fallbackPromises);
            const fallbackStats = {
                total_processed: fallbackResults.length,
                updated_count: fallbackResults.filter(r => r.success && !r.no_changes).length,
                error_count: fallbackResults.filter(r => !r.success).length
            };

            res.json({
                success: true,
                message: `Actualización completada con fallback manual: ${fallbackStats.updated_count} hallazgos actualizados`,
                stats: fallbackStats,
                fallback_used: true,
                warning: 'Se usó fallback manual debido a error en IA'
            });
        }

    } catch (error) {
        console.error('Error in POST /coverages/update-geography:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// GET /api/coverages/:coverage_id/details - Obtener detalles estructurados de una cobertura específica
router.get('/:coverage_id/details', verifyUserAccess, async (req, res) => {
    try {
        const { coverage_id } = req.params;

        if (!coverage_id) {
            return res.status(400).json({
                error: 'coverage_id es requerido'
            });
        }

        // Obtener la cobertura con verificación de acceso
        const { data: coverage, error: coverageError } = await supabase
            .from('project_coverages')
            .select(`
                *,
                projects!inner(id, title, user_id, collaborators)
            `)
            .eq('id', coverage_id)
            .single();

        if (coverageError || !coverage) {
            return res.status(404).json({
                error: 'Cobertura no encontrada'
            });
        }

        // Verificar acceso al proyecto
        const project = coverage.projects;
        const hasAccess = project.user_id === req.user.id || 
                         (project.collaborators && project.collaborators.includes(req.user.id));

        if (!hasAccess) {
            return res.status(403).json({
                error: 'No tienes permisos para ver esta cobertura'
            });
        }

        // Parsear los datos estructurados por tema
        let themeBreakdown = {};
        try {
            if (coverage.discovery_context && coverage.discovery_context.startsWith('{')) {
                themeBreakdown = JSON.parse(coverage.discovery_context);
            } else {
                // Fallback para coberturas sin estructura JSON
                themeBreakdown = {
                    'General': {
                        theme_name: 'General',
                        cards_count: 1,
                        sample_cards: [{
                            id: coverage.source_card_id,
                            entity: 'No disponible',
                            discovery: coverage.discovery_context || 'No disponible',
                            created_at: coverage.created_at
                        }]
                    }
                };
            }
        } catch (parseError) {
            console.error('Error parseando discovery_context:', parseError);
            themeBreakdown = {
                'Error': {
                    theme_name: 'Error de parsing',
                    cards_count: 0,
                    sample_cards: []
                }
            };
        }

        // Obtener hallazgos completos si es necesario (opcional, para expandir)
        const { data: fullCards, error: cardsError } = await supabase
            .from('capturado_cards')
            .select('id, topic, entity, discovery, description, created_at, pais, department, city')
            .eq('project_id', project.id)
            .or(`pais.eq.${coverage.name},department.eq.${coverage.name},city.eq.${coverage.name}`)
            .order('created_at', { ascending: false });

        if (cardsError) {
            console.error('Error fetching full cards:', cardsError);
        }

        // Agrupar hallazgos completos por tema
        const fullThemeBreakdown = {};
        if (fullCards) {
            fullCards.forEach(card => {
                const theme = card.topic || 'General';
                if (!fullThemeBreakdown[theme]) {
                    fullThemeBreakdown[theme] = {
                        theme_name: theme,
                        cards_count: 0,
                        cards: []
                    };
                }
                fullThemeBreakdown[theme].cards_count++;
                fullThemeBreakdown[theme].cards.push({
                    id: card.id,
                    entity: card.entity,
                    discovery: card.discovery,
                    description: card.description,
                    location: {
                        pais: card.pais,
                        department: card.department,
                        city: card.city
                    },
                    created_at: card.created_at
                });
            });
        }

        res.json({
            success: true,
            coverage: {
                ...coverage,
                projects: undefined // Remover datos del proyecto duplicados
            },
            project: {
                id: project.id,
                title: project.title
            },
            theme_summary: themeBreakdown,
            full_breakdown: fullThemeBreakdown,
            stats: {
                total_themes: Object.keys(fullThemeBreakdown).length,
                total_cards: Object.values(fullThemeBreakdown).reduce((sum, theme) => sum + theme.cards_count, 0),
                coverage_type: coverage.coverage_type,
                detection_source: coverage.detection_source
            }
        });

    } catch (error) {
        console.error('Error in GET /coverages/:coverage_id/details:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

module.exports = router; 