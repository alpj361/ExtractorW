// ===================================================================
// RUTAS PARA AGENTE MAPS - EXPERTO EN GEOGRAFÍA GUATEMALTECA
// Endpoints para normalización y detección geográfica
// ===================================================================

const express = require('express');
const { verifyUserAccess } = require('../middlewares/auth');
const { logUsage } = require('../services/logs');
const mapsAgent = require('../services/mapsAgent');

const router = express.Router();

// ===================================================================
// ENDPOINTS PRINCIPALES
// ===================================================================

/**
 * POST /api/maps/normalize
 * Normaliza información geográfica
 */
router.post('/normalize', verifyUserAccess, async (req, res) => {
  try {
    const { location, context } = req.body;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        example: { city: 'Guatemala', department: 'Guatemala', pais: 'Guatemala' }
      });
    }
    
    console.log(`🗺️ [MAPS] Normalizando: ${JSON.stringify(location)}`);
    
    const result = mapsAgent.normalizeGeographicInfo(location);
    
    // Log de usage
    await logUsage(req.user.id, 'maps_normalize', {
      input: location,
      output: result,
      context: context || null
    });
    
    res.json({
      success: true,
      input: location,
      output: result,
      is_guatemalan: mapsAgent.isGuatemalan(result),
      detection_method: 'manual_mapping'
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en normalización:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/maps/normalize-batch
 * Normaliza múltiples ubicaciones en lote
 */
router.post('/normalize-batch', verifyUserAccess, async (req, res) => {
  try {
    const { locations, context } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        error: 'Locations array is required',
        example: [
          { city: 'Guatemala', department: 'Guatemala' },
          { city: 'Xela', department: null }
        ]
      });
    }
    
    if (locations.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 locations per batch'
      });
    }
    
    console.log(`🗺️ [MAPS] Normalizando lote de ${locations.length} ubicaciones...`);
    
    const results = await mapsAgent.batchNormalizeGeography(locations);
    
    // Log de usage
    await logUsage(req.user.id, 'maps_normalize_batch', {
      input_count: locations.length,
      output_count: results.length,
      context: context || null
    });
    
    res.json({
      success: true,
      input_count: locations.length,
      output_count: results.length,
      results: results,
      statistics: {
        manual_detections: results.filter(r => r.detection_method === 'manual').length,
        ai_detections: results.filter(r => r.detection_method === 'ai').length,
        error_count: results.filter(r => r.detection_method === 'error').length
      }
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en normalización batch:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/maps/normalize-country
 * Normaliza nombre de país específicamente
 */
router.post('/normalize-country', verifyUserAccess, async (req, res) => {
  try {
    const { country } = req.body;
    
    if (!country) {
      return res.status(400).json({
        error: 'Country is required',
        example: { country: 'guatemala' }
      });
    }
    
    console.log(`🗺️ [MAPS] Normalizando país: ${country}`);
    
    const result = mapsAgent.normalizeCountryName(country);
    
    // Log de usage
    await logUsage(req.user.id, 'maps_normalize_country', {
      input: country,
      output: result
    });
    
    res.json({
      success: true,
      input: country,
      output: result,
      is_guatemalan: result === 'Guatemala'
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en normalización de país:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/maps/detect-department
 * Detecta departamento para una ciudad
 */
router.post('/detect-department', verifyUserAccess, async (req, res) => {
  try {
    const { city } = req.body;
    
    if (!city) {
      return res.status(400).json({
        error: 'City is required',
        example: { city: 'Cobán' }
      });
    }
    
    console.log(`🗺️ [MAPS] Detectando departamento para: ${city}`);
    
    const department = mapsAgent.getDepartmentForCity(city);
    
    // Log de usage
    await logUsage(req.user.id, 'maps_detect_department', {
      input: city,
      output: department
    });
    
    res.json({
      success: true,
      input: city,
      output: department,
      found: !!department
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en detección de departamento:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/maps/detect-location-type
 * Detecta tipo de ubicación (city, department, country, zone)
 */
router.post('/detect-location-type', verifyUserAccess, async (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        example: { location: 'Zona Viva' }
      });
    }
    
    console.log(`🗺️ [MAPS] Detectando tipo de ubicación: ${location}`);
    
    const type = mapsAgent.detectLocationType(location);
    const locationInfo = mapsAgent.getLocationInfo({ city: location });
    
    // Log de usage
    await logUsage(req.user.id, 'maps_detect_location_type', {
      input: location,
      output: type,
      info: locationInfo
    });
    
    res.json({
      success: true,
      input: location,
      output: type,
      info: locationInfo
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en detección de tipo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/maps/find-similar
 * Busca ubicaciones similares
 */
router.post('/find-similar', verifyUserAccess, async (req, res) => {
  try {
    const { location, maxResults = 5 } = req.body;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        example: { location: 'Guate' }
      });
    }
    
    console.log(`🗺️ [MAPS] Buscando similares a: ${location}`);
    
    const results = mapsAgent.findSimilarLocations(location, maxResults);
    
    // Log de usage
    await logUsage(req.user.id, 'maps_find_similar', {
      input: location,
      output: results,
      count: results.length
    });
    
    res.json({
      success: true,
      input: location,
      output: results,
      count: results.length
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en búsqueda de similares:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/maps/detect-with-ai
 * Usa IA para detectar geografía cuando mapeo manual falla
 */
router.post('/detect-with-ai', verifyUserAccess, async (req, res) => {
  try {
    const { location, context } = req.body;
    
    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        example: { location: 'Puerto' }
      });
    }
    
    console.log(`🗺️ [MAPS] Detectando con IA: ${location}`);
    
    const result = await mapsAgent.detectGeographyWithAI(location, context);
    
    // Log de usage
    await logUsage(req.user.id, 'maps_detect_with_ai', {
      input: location,
      context: context || null,
      output: result
    });
    
    res.json({
      success: true,
      input: location,
      context: context || null,
      output: result
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en detección con IA:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/maps/mapping-info
 * Obtiene información del mapeo disponible
 */
router.get('/mapping-info', verifyUserAccess, async (req, res) => {
  try {
    const mapping = mapsAgent.GUATEMALA_MAPPING;
    
    const info = {
      departments: Object.keys(mapping.departments).length,
      total_municipalities: Object.values(mapping.departments).reduce((acc, dept) => 
        acc + (dept.municipalities ? dept.municipalities.length : 0), 0),
      cultural_aliases: Object.keys(mapping.cultural_aliases).length,
      countries: Object.keys(mapping.countries).length,
      department_names: Object.keys(mapping.departments),
      sample_aliases: Object.keys(mapping.cultural_aliases).slice(0, 10)
    };
    
    res.json({
      success: true,
      info: info,
      note: 'Agente Maps con mapeo completo de Guatemala disponible'
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error obteniendo info del mapeo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/maps/health
 * Health check del agente Maps
 */
router.get('/health', async (req, res) => {
  try {
    // Prueba básica de funcionalidad
    const testResult = mapsAgent.normalizeGeographicInfo({ city: 'Guatemala' });
    
    res.json({
      success: true,
      status: 'healthy',
      agent: 'Maps - Experto en Geografía Guatemalteca',
      test_result: testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en health check:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router; 