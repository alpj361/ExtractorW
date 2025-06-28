const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { processNitterContext } = require('../services/nitterContext');

/**
 * POST /api/nitter-context
 * Herramienta para obtener tweets usando nitter_context de ExtractorT
 * con análisis completo de sentimiento y guardado en recent_scrapes
 */
router.post('/nitter-context', verifyUserAccess, async (req, res) => {
  try {
    const { query, location = 'guatemala', limit = 10, session_id } = req.body;
    const userId = req.user.id;

    // Validación de parámetros
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "query" es requerido y debe ser un string no vacío'
      });
    }

    if (limit && (typeof limit !== 'number' || limit < 1 || limit > 50)) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "limit" debe ser un número entre 1 y 50'
      });
    }

    // Generar session_id si no se proporciona
    const finalSessionId = session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 Iniciando nitter_context para usuario ${userId}: "${query}"`);

    // Procesar con el servicio
    const result = await processNitterContext(
      query.trim(),
      userId,
      finalSessionId,
      location,
      parseInt(limit)
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Tweets obtenidos y analizados exitosamente',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        data: result.data
      });
    }

  } catch (error) {
    console.error('Error en /nitter-context:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * GET /api/nitter-context/test
 * Endpoint de prueba para verificar que el servicio funciona
 */
router.get('/test', verifyUserAccess, async (req, res) => {
  try {
    const testQuery = 'Guatemala';
    const userId = req.user.id;
    const sessionId = `test_${Date.now()}`;

    console.log(`🧪 Ejecutando prueba de nitter_context para usuario ${userId}`);

    const result = await processNitterContext(testQuery, userId, sessionId, 'guatemala', 3);

    res.json({
      success: true,
      message: 'Prueba de nitter_context completada',
      test_query: testQuery,
      result: result
    });

  } catch (error) {
    console.error('Error en prueba de nitter_context:', error);
    res.status(500).json({
      success: false,
      error: 'Error en prueba',
      details: error.message
    });
  }
});

module.exports = router; 