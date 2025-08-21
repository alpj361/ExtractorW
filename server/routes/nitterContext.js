const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { processNitterContext } = require('../services/nitterContext');

// Importar fetch para Node.js (compatibilidad como en nitterProfile)
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  fetch = global.fetch;
}

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
router.get('/nitter-context/test', async (req, res) => {
  try {
    const testQuery = 'Guatemala';

    console.log('🧪 Probando conectividad de nitter_context');

    // Llamada directa a ExtractorT (compat GET /nitter_context)
    const extractorBase = process.env.EXTRACTOR_T_URL || 'http://localhost:8000';
    const url = `${extractorBase}/nitter_context?q=${encodeURIComponent(testQuery)}&location=guatemala&limit=3`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'ExtractorW-Test/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`ExtractorT error: ${response.status}`);
    }

    const data = await response.json();

    res.json({
      success: true,
      message: 'Conectividad con ExtractorT (nitter_context) exitosa',
      test_query: testQuery,
      extractorT_status: data.status || 'desconocido',
      tweets_found: Array.isArray(data.tweets) ? data.tweets.length : 0,
      extractorT_url: extractorBase
    });

  } catch (error) {
    console.error('Error en prueba de nitter_context:', error);
    res.status(500).json({
      success: false,
      error: 'Error de conectividad con ExtractorT',
      details: error.message
    });
  }
});

/**
 * GET /api/nitter-context/stats/:userId
 * Obtiene estadísticas de uso de nitter_context para un usuario
 */
router.get('/nitter-context/stats/:userId', verifyUserAccess, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;

    if (userId !== requestingUserId && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver estadísticas de otro usuario'
      });
    }

    const supabase = require('../utils/supabase');

    const { data: contextStats, error } = await supabase
      .from('recent_scrapes')
      .select('*')
      .eq('user_id', userId)
      .eq('herramienta', 'nitter_context')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }

    const totalSessions = contextStats.filter(item => item.tweet_id === null).length;
    const totalTweets = contextStats.filter(item => item.tweet_id !== null).length;
    const totalEngagement = contextStats.reduce((sum, item) => sum + (item.total_engagement || 0), 0);

    const topQueriesCount = {};
    contextStats
      .filter(item => item.tweet_id === null)
      .forEach(item => {
        const key = item.query || 'desconocido';
        topQueriesCount[key] = (topQueriesCount[key] || 0) + 1;
      });

    const topQueries = Object.entries(topQueriesCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([query, count]) => ({ query, analisis_count: count }));

    res.json({
      success: true,
      stats: {
        user_id: userId,
        total_sessions: totalSessions,
        total_tweets_processed: totalTweets,
        total_engagement: totalEngagement,
        avg_engagement_per_session: totalSessions > 0 ? Math.round(totalEngagement / totalSessions) : 0,
        top_queries: topQueries,
        last_analysis: contextStats.length > 0 ? contextStats[0].created_at : null
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de nitter_context:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

module.exports = router; 