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
      generatedTitle,
      detectedGroup,
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
      generated_title: generatedTitle || queryOriginal,
      detected_group: detectedGroup || 'general',
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

    console.log(`💾 Guardando scrape: "${generatedTitle}" con ${tweetCount} tweets (grupo: ${detectedGroup})`);

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

/**
 * Obtiene scrapes agrupados inteligentemente por tema/grupo
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de filtrado
 * @returns {Array} Lista de grupos con sus scrapes
 */
async function getGroupedScrapes(userId, options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      detectedGroup,
      categoria
    } = options;

    console.log(`📋 Obteniendo scrapes agrupados para usuario ${userId}`);

    let query = supabase
      .from('recent_scrapes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Aplicar filtros opcionales
    if (detectedGroup) {
      query = query.eq('detected_group', detectedGroup);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error obteniendo scrapes agrupados: ${error.message}`);
    }

    // Agrupar scrapes por detected_group
    const groupsMap = {};
    
    data.forEach(scrape => {
      const group = scrape.detected_group || 'general';
      
      if (!groupsMap[group]) {
        groupsMap[group] = {
          groupName: group,
          displayName: getGroupDisplayName(group),
          groupEmoji: getGroupEmoji(group),
          scrapes: [],
          totalTweets: 0,
          totalEngagement: 0,
          lastActivity: null,
          uniqueTopics: new Set()
        };
      }
      
      groupsMap[group].scrapes.push(scrape);
      groupsMap[group].totalTweets += scrape.tweet_count || 0;
      groupsMap[group].totalEngagement += scrape.total_engagement || 0;
      groupsMap[group].uniqueTopics.add(scrape.generated_title || scrape.query_original);
      
      // Actualizar última actividad
      const scrapeDate = new Date(scrape.created_at);
      if (!groupsMap[group].lastActivity || scrapeDate > new Date(groupsMap[group].lastActivity)) {
        groupsMap[group].lastActivity = scrape.created_at;
      }
    });

    // Convertir a array y agregar métricas finales
    const groupedScrapes = Object.values(groupsMap).map(group => ({
      ...group,
      scrapesCount: group.scrapes.length,
      avgEngagement: group.totalTweets > 0 ? Math.round(group.totalEngagement / group.totalTweets) : 0,
      uniqueTopicsCount: group.uniqueTopics.size,
      topTopics: Array.from(group.uniqueTopics).slice(0, 3) // Mostrar hasta 3 temas principales
    }));

    // Ordenar grupos por última actividad
    groupedScrapes.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    // Aplicar paginación
    const paginatedGroups = groupedScrapes.slice(offset, offset + limit);

    console.log(`✅ ${paginatedGroups.length} grupos obtenidos de ${groupedScrapes.length} totales`);
    return paginatedGroups;

  } catch (error) {
    console.error('❌ Error obteniendo scrapes agrupados:', error);
    throw error;
  }
}

/**
 * Obtiene nombre de visualización para un grupo
 */
function getGroupDisplayName(group) {
  const displayNames = {
    'politica-guatemala': 'Política Nacional',
    'economia-guatemala': 'Economía y Finanzas',
    'deportes-guatemala': 'Deportes Guatemala',
    'cultura-guatemala': 'Cultura y Tradiciones',
    'social-guatemala': 'Movimientos Sociales',
    'tecnologia': 'Tecnología e Innovación',
    'internacional': 'Noticias Internacionales',
    'entretenimiento': 'Entretenimiento y Espectáculos',
    'general': 'Temas Generales'
  };
  return displayNames[group] || group.charAt(0).toUpperCase() + group.slice(1);
}

/**
 * Obtiene emoji representativo para un grupo
 */
function getGroupEmoji(group) {
  const emojis = {
    'politica-guatemala': '🏛️',
    'economia-guatemala': '💰',
    'deportes-guatemala': '⚽',
    'cultura-guatemala': '🎭',
    'social-guatemala': '✊',
    'tecnologia': '💻',
    'internacional': '🌍',
    'entretenimiento': '🎬',
    'general': '📱'
  };
  return emojis[group] || '📊';
}

/**
 * Obtiene estadísticas de agrupación
 * @param {string} userId - ID del usuario
 * @returns {Object} Estadísticas de agrupación
 */
async function getGroupedStats(userId) {
  try {
    console.log(`📊 Obteniendo estadísticas agrupadas para usuario ${userId}`);

    const { data: stats, error } = await supabase
      .from('recent_scrapes')
      .select('detected_group, tweet_count, total_engagement, created_at')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Error obteniendo estadísticas agrupadas: ${error.message}`);
    }

    // Agrupar estadísticas
    const groupStats = {};
    let totalGroups = 0;
    let totalScrapes = 0;

    stats.forEach(s => {
      const group = s.detected_group || 'general';
      
      if (!groupStats[group]) {
        groupStats[group] = {
          groupName: group,
          displayName: getGroupDisplayName(group),
          emoji: getGroupEmoji(group),
          scrapesCount: 0,
          totalTweets: 0,
          totalEngagement: 0
        };
        totalGroups++;
      }
      
      groupStats[group].scrapesCount++;
      groupStats[group].totalTweets += s.tweet_count || 0;
      groupStats[group].totalEngagement += s.total_engagement || 0;
      totalScrapes++;
    });

    // Convertir a array ordenado por número de scrapes
    const groupsArray = Object.values(groupStats)
      .sort((a, b) => b.scrapesCount - a.scrapesCount);

    return {
      totalGroups,
      totalScrapes,
      topGroups: groupsArray.slice(0, 5), // Top 5 grupos
      allGroups: groupsArray
    };

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas agrupadas:', error);
    throw error;
  }
}

/**
 * Elimina un scrape específico del usuario
 * @param {string} scrapeId - ID del scrape a eliminar
 * @param {string} userId - ID del usuario (para verificar propiedad)
 * @returns {Object} Resultado de la operación
 */
async function deleteScrape(scrapeId, userId) {
  try {
    console.log(`🗑️ Eliminando scrape ${scrapeId} del usuario ${userId}`);

    // Verificar que el scrape existe y pertenece al usuario
    const { data: scrape, error: fetchError } = await supabase
      .from('recent_scrapes')
      .select('id, user_id, query_original')
      .eq('id', scrapeId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('Scrape no encontrado o no tienes permisos para eliminarlo');
      }
      throw new Error(`Error verificando scrape: ${fetchError.message}`);
    }

    // Eliminar el scrape
    const { error: deleteError } = await supabase
      .from('recent_scrapes')
      .delete()
      .eq('id', scrapeId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Error eliminando scrape: ${deleteError.message}`);
    }

    console.log(`✅ Scrape eliminado exitosamente: "${scrape.query_original}"`);
    return {
      success: true,
      message: 'Scrape eliminado exitosamente',
      deletedScrape: {
        id: scrapeId,
        query_original: scrape.query_original
      }
    };

  } catch (error) {
    console.error('❌ Error eliminando scrape:', error);
    throw error;
  }
}

module.exports = {
  saveScrape,
  getUserScrapes,
  getUserScrapeStats,
  getSessionScrapes,
  cleanupOldScrapes,
  getGroupedScrapes,
  getGroupedStats,
  deleteScrape
}; 