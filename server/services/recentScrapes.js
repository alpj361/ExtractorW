const supabase = require('../utils/supabase');

// ===================================================================
// RECENT SCRAPES SERVICE
// Gestión de scrapes recientes para Vizta Chat
// ===================================================================

/**
 * Guarda un nuevo scrape en la base de datos
 * @param {Object} scrapeData - Datos del scrape
 * @returns {Object} Resultado de la operación
 */
async function saveScrape(scrapeData) {
  try {
    const {
      queryOriginal,
      queryClean,
      herramienta,
      categoria,
      tweets,
      userId,
      sessionId,
      mcpRequestId,
      mcpExecutionTime,
      location
    } = scrapeData;

    // Calcular métricas automáticas
    const tweetCount = tweets ? tweets.length : 0;
    const totalEngagement = tweets ? tweets.reduce((sum, tweet) => 
      sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0
    ) : 0;

    const avgEngagement = tweetCount > 0 ? Math.round(totalEngagement / tweetCount) : 0;

    // Preparar datos para insertar
    const insertData = {
      query_original: queryOriginal,
      query_clean: queryClean,
      herramienta: herramienta,
      categoria: categoria,
      tweet_count: tweetCount,
      total_engagement: totalEngagement,
      avg_engagement: avgEngagement,
      user_id: userId,
      session_id: sessionId,
      mcp_request_id: mcpRequestId,
      mcp_execution_time: mcpExecutionTime,
      location: location,
      tweets: tweets, // JSONB array
      created_at: new Date().toISOString()
    };

    console.log(`💾 Guardando scrape: ${tweetCount} tweets para query "${queryOriginal}"`);

    const { data, error } = await supabase
      .from('recent_scrapes')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error insertando scrape: ${error.message}`);
    }

    console.log(`✅ Scrape guardado con ID: ${data.id}`);
    return {
      success: true,
      scrapeId: data.id,
      data: data
    };

  } catch (error) {
    console.error('❌ Error guardando scrape:', error);
    throw error;
  }
}

/**
 * Obtiene scrapes del usuario con filtros opcionales
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de filtrado
 * @returns {Array} Lista de scrapes
 */
async function getUserScrapes(userId, options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      herramienta,
      categoria,
      sessionId
    } = options;

    console.log(`📋 Obteniendo scrapes para usuario ${userId}`);

    let query = supabase
      .from('recent_scrapes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros opcionales
    if (herramienta) {
      query = query.eq('herramienta', herramienta);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error obteniendo scrapes: ${error.message}`);
    }

    console.log(`✅ ${data.length} scrapes obtenidos`);
    return data;

  } catch (error) {
    console.error('❌ Error obteniendo scrapes del usuario:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de uso del usuario
 * @param {string} userId - ID del usuario
 * @returns {Object} Estadísticas de uso
 */
async function getUserScrapeStats(userId) {
  try {
    console.log(`📊 Obteniendo estadísticas para usuario ${userId}`);

    // Obtener estadísticas básicas
    const { data: stats, error: statsError } = await supabase
      .from('recent_scrapes')
      .select('herramienta, categoria, tweet_count, total_engagement, created_at')
      .eq('user_id', userId);

    if (statsError) {
      throw new Error(`Error obteniendo estadísticas: ${statsError.message}`);
    }

    // Calcular métricas
    const totalScrapes = stats.length;
    const totalTweets = stats.reduce((sum, s) => sum + (s.tweet_count || 0), 0);
    const totalEngagement = stats.reduce((sum, s) => sum + (s.total_engagement || 0), 0);

    // Herramientas más usadas
    const herramientasCount = {};
    stats.forEach(s => {
      herramientasCount[s.herramienta] = (herramientasCount[s.herramienta] || 0) + 1;
    });

    // Categorías más usadas
    const categoriasCount = {};
    stats.forEach(s => {
      categoriasCount[s.categoria] = (categoriasCount[s.categoria] || 0) + 1;
    });

    // Scrapes por día (últimos 7 días)
    const scrapesPorDia = {};
    const hoy = new Date();
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toISOString().split('T')[0];
      scrapesPorDia[fechaStr] = 0;
    }

    stats.forEach(s => {
      const fecha = s.created_at.split('T')[0];
      if (scrapesPorDia.hasOwnProperty(fecha)) {
        scrapesPorDia[fecha]++;
      }
    });

    const result = {
      totalScrapes,
      totalTweets,
      totalEngagement,
      avgTweetsPerScrape: totalScrapes > 0 ? Math.round(totalTweets / totalScrapes) : 0,
      avgEngagementPerScrape: totalScrapes > 0 ? Math.round(totalEngagement / totalScrapes) : 0,
      herramientasCount,
      categoriasCount,
      scrapesPorDia
    };

    console.log(`✅ Estadísticas calculadas: ${totalScrapes} scrapes totales`);
    return result;

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    throw error;
  }
}

/**
 * Obtiene scrapes de una sesión específica
 * @param {string} sessionId - ID de la sesión
 * @returns {Array} Scrapes de la sesión
 */
async function getSessionScrapes(sessionId) {
  try {
    console.log(`🔍 Obteniendo scrapes de sesión: ${sessionId}`);

    const { data, error } = await supabase
      .from('recent_scrapes')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error obteniendo scrapes de sesión: ${error.message}`);
    }

    console.log(`✅ ${data.length} scrapes de sesión obtenidos`);
    return data;

  } catch (error) {
    console.error('❌ Error obteniendo scrapes de sesión:', error);
    throw error;
  }
}

/**
 * Limpia scrapes antiguos (más de 30 días)
 * @returns {Object} Resultado de la limpieza
 */
async function cleanupOldScrapes() {
  try {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 30);

    console.log(`🧹 Limpiando scrapes anteriores a: ${fechaLimite.toISOString()}`);

    const { data, error } = await supabase
      .from('recent_scrapes')
      .delete()
      .lt('created_at', fechaLimite.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Error limpiando scrapes: ${error.message}`);
    }

    const deletedCount = data ? data.length : 0;
    console.log(`✅ ${deletedCount} scrapes antiguos eliminados`);

    return {
      success: true,
      deletedCount
    };

  } catch (error) {
    console.error('❌ Error limpiando scrapes:', error);
    throw error;
  }
}

module.exports = {
  saveScrape,
  getUserScrapes,
  getUserScrapeStats,
  getSessionScrapes,
  cleanupOldScrapes
}; 