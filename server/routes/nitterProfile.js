const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { processNitterProfile } = require('../services/nitterProfile');

// Importar fetch para Node.js
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  // Fallback para Node.js 18+ que tiene fetch nativo
  fetch = global.fetch;
}

/**
 * POST /api/nitter-profile
 * Herramienta para obtener tweets de perfil usando nitter_profile de ExtractorT
 * con análisis completo de sentimiento y guardado en recent_scrapes
 */
router.post('/nitter-profile', verifyUserAccess, async (req, res) => {
  try {
    const { username, limit = 10, include_retweets = false, include_replies = false, session_id } = req.body;
    const userId = req.user.id;

    // Validación de parámetros
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "username" es requerido y debe ser un string no vacío'
      });
    }

    if (limit && (typeof limit !== 'number' || limit < 1 || limit > 50)) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "limit" debe ser un número entre 1 y 50'
      });
    }

    // Limpiar username
    const cleanUsername = username.replace('@', '').trim();

    // Generar session_id si no se proporciona
    const finalSessionId = session_id || `profile_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 Iniciando nitter_profile para usuario ${userId}: "@${cleanUsername}"`);

    // Procesar con el servicio
    const result = await processNitterProfile(
      cleanUsername,
      userId,
      finalSessionId,
      parseInt(limit),
      include_retweets,
      include_replies
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Tweets de perfil obtenidos y analizados exitosamente',
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
    console.error('Error en /nitter-profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * GET /api/nitter-profile/test
 * Endpoint de prueba para verificar conectividad con ExtractorT
 */
router.get('/nitter-profile/test', async (req, res) => {
  try {
    const testUsername = 'GuatemalaGob';
    
    console.log(`🧪 Probando conectividad de nitter_profile con @${testUsername}`);
    
    // Hacer una prueba básica sin guardar en BD
    const testResponse = await fetch(`${process.env.EXTRACTOR_T_URL || 'http://localhost:8000'}/api/nitter_profile/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ExtractorW-Test/1.0'
      },
      body: JSON.stringify({
        username: testUsername,
        limit: 3,
        include_retweets: false,
        include_replies: false
      })
    });
    
    if (testResponse.ok) {
      const testData = await testResponse.json();
      res.json({
        success: true,
        message: 'Conectividad con ExtractorT exitosa',
        test_data: {
          username: testUsername,
          tweets_found: testData.tweets?.length || 0,
          extractorT_status: testData.success ? 'funcionando' : 'error',
          extractorT_url: process.env.EXTRACTOR_T_URL || 'http://localhost:8000'
        }
      });
    } else {
      throw new Error(`ExtractorT error: ${testResponse.status}`);
    }
    
  } catch (error) {
    console.error('Error en prueba de nitter_profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error de conectividad con ExtractorT',
      details: error.message
    });
  }
});

/**
 * GET /api/nitter-profile/stats/:userId
 * Obtiene estadísticas de uso de nitter_profile para un usuario
 */
router.get('/stats/:userId', verifyUserAccess, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;
    
    // Solo permitir ver stats propias o si es admin
    if (userId !== requestingUserId && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver estadísticas de otro usuario'
      });
    }
    
    const supabase = require('../utils/supabase');
    
    // Obtener estadísticas de recent_scrapes para nitter_profile
    const { data: profileStats, error } = await supabase
      .from('recent_scrapes')
      .select('*')
      .eq('user_id', userId)
      .eq('herramienta', 'nitter_profile')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
    
    const totalProfiles = profileStats.filter(item => item.tweet_id === null).length; // Registros resumen
    const totalTweets = profileStats.filter(item => item.tweet_id !== null).length; // Tweets individuales
    const totalEngagement = profileStats.reduce((sum, item) => sum + (item.total_engagement || 0), 0);
    
    // Perfiles más analizados
    const profileCounts = {};
    profileStats
      .filter(item => item.tweet_id === null) // Solo registros resumen
      .forEach(item => {
        profileCounts[item.usuario] = (profileCounts[item.usuario] || 0) + 1;
      });
    
    const topProfiles = Object.entries(profileCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([profile, count]) => ({ profile, analisis_count: count }));
    
    res.json({
      success: true,
      stats: {
        user_id: userId,
        total_profiles_analyzed: totalProfiles,
        total_tweets_processed: totalTweets,
        total_engagement: totalEngagement,
        avg_engagement_per_profile: totalProfiles > 0 ? Math.round(totalEngagement / totalProfiles) : 0,
        top_analyzed_profiles: topProfiles,
        last_analysis: profileStats.length > 0 ? profileStats[0].created_at : null
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas de nitter_profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

module.exports = router; 