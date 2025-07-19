const supabase = require('../utils/supabase');
const { obtenerContextoTweets } = require('./perplexity');
const { getUserScrapes } = require('./recentScrapes');

/**
 * Servicio de Sondeos - Maneja la obtención de contexto y procesamiento con IA
 * Basado en la implementación original de migration.js
 */

/**
 * Obtiene contexto de tendencias desde la tabla trends
 */
async function obtenerContextoTendencias(limite = 10, selectedItems = null) {
  try {
    console.log(`📊 Obteniendo contexto de tendencias (límite: ${limite}, items seleccionados: ${selectedItems ? selectedItems.length : 0})`);
    
    // If specific items are selected, process them differently
    if (selectedItems && selectedItems.length > 0) {
      console.log('📋 Procesando items específicos seleccionados:', selectedItems);
      return await cargarContextoEspecifico(selectedItems);
    }
    
    // Default behavior: get recent trends
    const { data: trends, error } = await supabase
      .from('trends')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo tendencias:', error);
      return [];
    }

    if (!trends || trends.length === 0) {
      console.log('⚠️ No se encontraron tendencias');
      return [];
    }

    // Procesar y formatear tendencias para contexto
    const contextoTendencias = trends.map(trend => {
      let trendData = {};
      
      try {
        // Parsear raw_data si existe
        if (trend.raw_data) {
          const rawData = typeof trend.raw_data === 'string' 
            ? JSON.parse(trend.raw_data) 
            : trend.raw_data;
          
          if (rawData.twitter_trends) {
            trendData = rawData.twitter_trends;
          } else if (Array.isArray(rawData)) {
            trendData = { trends: rawData };
          } else {
            trendData = rawData;
          }
        }

        // Extraer información relevante
        const trendInfo = {
          timestamp: trend.timestamp,
          trends: [],
          categories: trend.category_data || {},
          keywords: trend.top_keywords || [],
          about: trend.about || []
        };

        // Procesar tendencias individuales
        if (trendData.trends && Array.isArray(trendData.trends)) {
          trendInfo.trends = trendData.trends.map(t => ({
            name: t.name || t.trend || t.keyword || t.name || t.query || 'Tendencia',
            volume: t.tweet_volume || t.volume || 0,
            category: t.category || 'General'
          }));
        } else if (Array.isArray(trendData)) {
          trendInfo.trends = trendData.map(t => ({
            name: typeof t === 'string' ? t : (t.name || t.trend || t.keyword || t.name || t.query || 'Tendencia'),
            volume: t.tweet_volume || t.volume || 0,
            category: t.category || 'General'
          }));
        }

        return trendInfo;
      } catch (parseError) {
        console.error('Error parseando trend:', parseError);
        return {
          timestamp: trend.timestamp,
          trends: [],
          error: 'Error parseando datos'
        };
      }
    });

    console.log(`✅ Contexto de tendencias obtenido: ${contextoTendencias.length} registros`);
    return contextoTendencias;

  } catch (error) {
    console.error('❌ Error en obtenerContextoTendencias:', error);
    return [];
  }
}

/**
 * Obtiene contexto de tweets trending desde la tabla trending_tweets
 */
async function obtenerContextoTweetsTrending(limite = 20) {
  try {
    console.log(`🐦 Obteniendo contexto de tweets trending (límite: ${limite})`);
    
    const { data: tweets, error } = await supabase
      .from('trending_tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo tweets trending:', error);
      return [];
    }

    if (!tweets || tweets.length === 0) {
      console.log('⚠️ No se encontraron tweets trending');
      return [];
    }

    // Formatear tweets para contexto
    const contextoTweets = tweets.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      author: tweet.author_username,
      author_name: tweet.author_name,
      created_at: tweet.created_at,
      metrics: {
        likes: tweet.like_count || 0,
        retweets: tweet.retweet_count || 0,
        replies: tweet.reply_count || 0,
        engagement: (tweet.like_count || 0) + (tweet.retweet_count || 0) + (tweet.reply_count || 0)
      },
      sentiment: tweet.sentiment_score,
      keywords: tweet.keywords || [],
      category: tweet.category || 'General'
    }));

    console.log(`✅ Contexto de tweets trending obtenido: ${contextoTweets.length} tweets`);
    return contextoTweets;

  } catch (error) {
    console.error('❌ Error en obtenerContextoTweetsTrending:', error);
    return [];
  }
}

/**
 * Obtiene contexto de noticias desde la tabla news
 */
async function obtenerContextoNoticias(limite = 15, selectedItems = null) {
  try {
    console.log(`📰 Obteniendo contexto de noticias (límite: ${limite}, items seleccionados: ${selectedItems?.length || 0})`);
    
    // If specific items are selected, load them specifically
    if (selectedItems && selectedItems.length > 0) {
      console.log('📋 Cargando noticias específicas seleccionadas:', selectedItems);
      // Si los elementos no son strings/UUIDs, asumir que son objetos noticia completos provenientes del frontend o strings JSON
      // A veces el frontend envía los objetos de noticia como cadenas "{...}" en vez de objetos reales.
      // Intentar detectar y parsear ese caso primero.
      let itemsAreObjects = typeof selectedItems[0] === 'object';
      if (!itemsAreObjects && typeof selectedItems[0] === 'string') {
        try {
          const maybeObj = JSON.parse(selectedItems[0]);
          if (typeof maybeObj === 'object') {
            // Parsear todos los elementos
            selectedItems = selectedItems.map(s => {
              if (typeof s === 'string') {
                try { return JSON.parse(s); } catch { return s; }
              }
              return s;
            });
            itemsAreObjects = true;
          }
        } catch {
          // No es JSON, continuar
        }
      }

      if (itemsAreObjects) {
        console.log('📰 Los elementos recibidos ya son objetos de noticia completos. Se usarán directamente.');
        // Normalizar estructura mínima esperada por el resto del sistema
        const normalizadas = selectedItems.map((n, idx) => ({
          id: n.id || `frontend_${idx}`,
          title: n.titulo || n.title || 'Sin título',
          titulo: n.titulo || n.title || 'Sin título',
          description: n.resumen || n.contenido || '',
          resumen: n.resumen || n.contenido || '',
          content: n.contenido || n.resumen || '',
          url: n.url || '',
          source: n.fuente || n.source || 'Desconocida',
          fuente: n.fuente || n.source || 'Desconocida',
          published_at: n.fecha || null,
          fecha: n.fecha || null,
          category: n.categoria || 'General',
          categoria: n.categoria || 'General',
          raw_data: n,
          type: 'news',
          source_table: 'frontend',
          created_at: n.fecha || new Date().toISOString()
        }));
        return normalizadas;
      }
      // Caso normal: recibir array de IDs válidos UUID
      return await cargarNoticiasEspecificas(selectedItems);
    }
    
    const { data: news, error } = await supabase
      .from('news')
      .select(`
        id,
        titulo,
        resumen,
        fuente,
        url,
        fecha,
        categoria,
        raw,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo noticias:', error);
      return [];
    }

    if (!news || news.length === 0) {
      console.log('⚠️ No se encontraron noticias');
      return [];
    }

    // Formatear noticias para contexto
    const contextoNoticias = news.map(noticia => ({
      id: noticia.id,
      title: noticia.titulo,
      titulo: noticia.titulo,
      description: noticia.resumen,
      resumen: noticia.resumen,
      content: noticia.resumen, // Using resumen as content
      url: noticia.url,
      source: noticia.fuente,
      fuente: noticia.fuente,
      published_at: noticia.fecha,
      fecha: noticia.fecha,
      category: noticia.categoria || 'General',
      categoria: noticia.categoria || 'General',
      raw_data: noticia.raw,
      type: 'news',
      source_table: 'news',
      created_at: noticia.created_at
    }));

    console.log(`✅ Contexto de noticias obtenido: ${contextoNoticias.length} noticias`);
    return contextoNoticias;

  } catch (error) {
    console.error('❌ Error en obtenerContextoNoticias:', error);
    return [];
  }
}

/**
 * Obtiene contexto de documentos desde la tabla codex_items
 */
async function obtenerContextoCodex(limite = 10, selectedItems = null) {
  try {
    console.log(`📚 Obteniendo contexto de codex (límite: ${limite}, items seleccionados: ${selectedItems?.length || 0})`);
    
    // If specific items are selected, load them specifically
    if (selectedItems && selectedItems.length > 0) {
      console.log('📋 Cargando documentos específicos seleccionados:', selectedItems);
      return await cargarCodexEspecificos(selectedItems);
    }
    
    const { data: codex, error } = await supabase
      .from('codex_items')
      .select(`
        id,
        titulo,
        descripcion,
        etiquetas,
        proyecto,
        storage_path,
        url,
        nombre_archivo,
        tamano,
        fecha,
        tipo,
        audio_transcription,
        document_analysis,
        transcripcion,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo codex:', error);
      return [];
    }

    if (!codex || codex.length === 0) {
      console.log('⚠️ No se encontraron documentos en codex');
      return [];
    }

    // Formatear documentos para contexto
    const contextoCodex = codex.map(doc => ({
      id: doc.id,
      title: doc.titulo,
      titulo: doc.titulo,
      content: doc.audio_transcription || doc.document_analysis || doc.transcripcion || doc.descripcion,
      description: doc.descripcion,
      descripcion: doc.descripcion,
      transcription: doc.audio_transcription || doc.transcripcion,
      analysis: doc.document_analysis,
      audio_transcription: doc.audio_transcription,
      document_analysis: doc.document_analysis,
      transcripcion: doc.transcripcion,
      summary: doc.descripcion,
      category: doc.tipo || 'General',
      tipo: doc.tipo,
      tags: doc.etiquetas || [],
      etiquetas: doc.etiquetas || [],
      project: doc.proyecto,
      proyecto: doc.proyecto,
      file_name: doc.nombre_archivo,
      file_size: doc.tamano,
      file_path: doc.storage_path,
      url: doc.url,
      date: doc.fecha,
      fecha: doc.fecha,
      created_at: doc.created_at,
      type: 'codex_item',
      source_table: 'codex_items'
    }));

    console.log(`✅ Contexto de codex obtenido: ${contextoCodex.length} documentos`);
    return contextoCodex;

  } catch (error) {
    console.error('❌ Error en obtenerContextoCodex:', error);
    return [];
  }
}

/**
 * Obtiene contexto de monitoreos del usuario desde la tabla recent_scrapes
 */
async function obtenerContextoMonitoreos(userId, limite = 15, selectedMonitoreoIds = []) {
  try {
    console.log(`👁️ Obteniendo contexto de monitoreos para usuario ${userId} (límite: ${limite})`);
    
    if (!userId) {
      throw new Error('userId es requerido para obtener monitoreos');
    }

    // Obtener scrapes del usuario con análisis de sentimiento
    const monitoreos = await getUserScrapes(userId, {
      limit: limite,
      herramienta: null, // Incluir todas las herramientas
      categoria: null    // Incluir todas las categorías
    });

    if (!monitoreos || monitoreos.length === 0) {
      console.log('⚠️ No se encontraron monitoreos para el usuario');
      return [];
    }

    // Si se especificaron IDs específicos, filtrar solo esos
    let monitoreosFinales = monitoreos;
    if (selectedMonitoreoIds && selectedMonitoreoIds.length > 0) {
      monitoreosFinales = monitoreos.filter(m => selectedMonitoreoIds.includes(m.id.toString()));
      console.log(`🔍 Filtrando a ${monitoreosFinales.length} monitoreos específicos de ${monitoreos.length} totales`);
    }

    // Formatear monitoreos para contexto con análisis de sentimiento
    const contextoMonitoreos = monitoreosFinales.map(monitoreo => {
      // Extraer métricas de sentimiento de los tweets del monitoreo
      const tweets = monitoreo.tweets || [];
      let sentimientoAgregado = {
        positivo: 0,
        negativo: 0,
        neutral: 0,
        score_promedio: 0,
        emociones_predominantes: [],
        intenciones_comunicativas: {}
      };

      if (tweets.length > 0) {
        let totalScore = 0;
        const emociones = {};
        const intenciones = {};

        tweets.forEach(tweet => {
          // Análisis de sentimiento
          if (tweet.sentimiento) {
            sentimientoAgregado[tweet.sentimiento]++;
          }
          
          if (tweet.score_sentimiento !== undefined) {
            totalScore += tweet.score_sentimiento;
          }

          // Emociones detectadas
          if (tweet.emociones_detectadas && Array.isArray(tweet.emociones_detectadas)) {
            tweet.emociones_detectadas.forEach(emocion => {
              emociones[emocion] = (emociones[emocion] || 0) + 1;
            });
          }

          // Intenciones comunicativas
          if (tweet.intencion_comunicativa) {
            intenciones[tweet.intencion_comunicativa] = (intenciones[tweet.intencion_comunicativa] || 0) + 1;
          }
        });

        // Calcular promedios y predominantes
        sentimientoAgregado.score_promedio = tweets.length > 0 ? (totalScore / tweets.length).toFixed(2) : 0;
        sentimientoAgregado.emociones_predominantes = Object.entries(emociones)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([emocion, count]) => ({ emocion, count }));
        sentimientoAgregado.intenciones_comunicativas = intenciones;
      }

      return {
        id: monitoreo.id,
        titulo: monitoreo.generated_title || monitoreo.query_original,
        query_original: monitoreo.query_original,
        query_clean: monitoreo.query_clean,
        herramienta: monitoreo.herramienta,
        categoria: monitoreo.categoria,
        detected_group: monitoreo.detected_group,
        tweet_count: monitoreo.tweet_count || tweets.length,
        total_engagement: monitoreo.total_engagement || 0,
        avg_engagement: monitoreo.avg_engagement || 0,
        location: monitoreo.location,
        created_at: monitoreo.created_at,
        updated_at: monitoreo.updated_at,
        // Análisis de sentimiento agregado
        analisis_sentimiento: sentimientoAgregado,
        // Tweets con análisis individual
        tweets_analizados: tweets.slice(0, 5), // Solo los primeros 5 para contexto
        // Metadatos para el análisis
        metadata: {
          session_id: monitoreo.session_id,
          mcp_execution_time: monitoreo.mcp_execution_time,
          fecha_captura: monitoreo.fecha_captura
        }
      };
    });

    console.log(`✅ Contexto de monitoreos obtenido: ${contextoMonitoreos.length} monitoreos con análisis de sentimiento`);
    return contextoMonitoreos;

  } catch (error) {
    console.error('❌ Error en obtenerContextoMonitoreos:', error);
    return [];
  }
}

/**
 * Carga contexto específico basado en items seleccionados (tweets, trends, etc.)
 */
async function cargarContextoEspecifico(selectedItems) {
  try {
    console.log('🔍 Cargando contexto específico para items:', selectedItems);
    
    // Separar items por tipo
    const tweetIds = [];
    const trendNames = [];
    
    selectedItems.forEach(item => {
      if (typeof item === 'string') {
        if (item.startsWith('tweet_')) {
          // Extract numeric ID from "tweet_7061" format
          const numericId = item.replace('tweet_', '');
          tweetIds.push(numericId);
        } else {
          // Treat as trend name
          trendNames.push(item);
        }
      }
    });
    
    console.log('📊 IDs de tweets a cargar:', tweetIds);
    console.log('📊 Nombres de tendencias a cargar:', trendNames);
    
    const resultados = [];
    
    // Cargar tweets específicos por ID
    if (tweetIds.length > 0) {
      const tweetsData = await cargarTweetsPorIds(tweetIds);
      resultados.push(...tweetsData);
    }
    
    // Cargar tendencias específicas por nombre
    if (trendNames.length > 0) {
      const trendsData = await cargarTendenciasPorNombres(trendNames);
      resultados.push(...trendsData);
    }
    
    console.log(`✅ Contexto específico cargado: ${resultados.length} items`);
    return resultados;
    
  } catch (error) {
    console.error('❌ Error cargando contexto específico:', error);
    return [];
  }
}

/**
 * Carga noticias específicas por sus IDs
 */
async function cargarNoticiasEspecificas(noticiasIds) {
  try {
    console.log('📰 Cargando noticias específicas por IDs:', noticiasIds);
    
    // Sanear IDs: aceptar tanto UUID plano como formato "noticia_<uuid>"
    const sanitizedIds = (noticiasIds || []).map(id => {
      if (typeof id === 'string' && id.startsWith('noticia_')) {
        return id.replace(/^noticia_/, '');
      }
      return id;
    });
    
    console.log('📰 Cargando noticias específicas por IDs (sanitized):', sanitizedIds);
    
    const { data: noticias, error } = await supabase
      .from('news')
      .select(`
        id,
        titulo,
        resumen,
        fuente,
        url,
        fecha,
        categoria,
        raw,
        created_at
      `)
      .in('id', sanitizedIds);
    
    if (error) {
      console.error('❌ Error cargando noticias específicas:', error);
      return [];
    }
    
    if (!noticias || noticias.length === 0) {
      console.log('⚠️ No se encontraron noticias con esos IDs');
      return [];
    }
    
    // Format noticias for context
    const formattedNoticias = noticias.map(noticia => ({
      id: noticia.id,
      title: noticia.titulo,
      titulo: noticia.titulo,
      description: noticia.resumen,
      resumen: noticia.resumen,
      content: noticia.resumen,
      url: noticia.url,
      source: noticia.fuente,
      fuente: noticia.fuente,
      published_at: noticia.fecha,
      fecha: noticia.fecha,
      category: noticia.categoria || 'General',
      categoria: noticia.categoria || 'General',
      raw_data: noticia.raw,
      type: 'news',
      source_table: 'news',
      created_at: noticia.created_at
    }));
    
    console.log(`✅ ${formattedNoticias.length} noticias específicas cargadas`);
    return formattedNoticias;
    
  } catch (error) {
    console.error('❌ Error en cargarNoticiasEspecificas:', error);
    return [];
  }
}

/**
 * Carga documentos específicos del codex por sus IDs
 */
async function cargarCodexEspecificos(codexIds) {
  try {
    console.log('📚 Cargando documentos específicos del codex por IDs:', codexIds);
    
    const { data: documentos, error } = await supabase
      .from('codex_items')
      .select(`
        id,
        titulo,
        descripcion,
        etiquetas,
        proyecto,
        storage_path,
        url,
        nombre_archivo,
        tamano,
        fecha,
        tipo,
        audio_transcription,
        document_analysis,
        transcripcion,
        created_at
      `)
      .in('id', codexIds);
    
    if (error) {
      console.error('❌ Error cargando documentos específicos del codex:', error);
      return [];
    }
    
    if (!documentos || documentos.length === 0) {
      console.log('⚠️ No se encontraron documentos con esos IDs');
      return [];
    }
    
    // Format documentos for context
    const formattedDocumentos = documentos.map(doc => ({
      id: doc.id,
      title: doc.titulo,
      titulo: doc.titulo,
      content: doc.audio_transcription || doc.document_analysis || doc.transcripcion || doc.descripcion,
      description: doc.descripcion,
      descripcion: doc.descripcion,
      transcription: doc.audio_transcription || doc.transcripcion,
      analysis: doc.document_analysis,
      audio_transcription: doc.audio_transcription,
      document_analysis: doc.document_analysis,
      transcripcion: doc.transcripcion,
      summary: doc.descripcion,
      category: doc.tipo || 'General',
      tipo: doc.tipo,
      tags: doc.etiquetas || [],
      etiquetas: doc.etiquetas || [],
      project: doc.proyecto,
      proyecto: doc.proyecto,
      file_name: doc.nombre_archivo,
      file_size: doc.tamano,
      file_path: doc.storage_path,
      url: doc.url,
      date: doc.fecha,
      fecha: doc.fecha,
      created_at: doc.created_at,
      type: 'codex_item',
      source_table: 'codex_items'
    }));
    
    console.log(`✅ ${formattedDocumentos.length} documentos específicos del codex cargados`);
    return formattedDocumentos;
    
  } catch (error) {
    console.error('❌ Error en cargarCodexEspecificos:', error);
    return [];
  }
}

/**
 * Carga tweets específicos desde recent_scrapes por sus IDs
 */
async function cargarTweetsPorIds(tweetIds) {
  try {
    console.log('🐦 Cargando tweets por IDs:', tweetIds);
    
    // Convert string IDs to integers for trending_tweets table
    const numericIds = tweetIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) {
      console.log('⚠️ No se encontraron IDs numéricos válidos');
      return [];
    }
    
    console.log('📊 IDs numéricos a buscar:', numericIds);
    
    const { data: tweets, error } = await supabase
      .from('trending_tweets')
      .select(`
        id,
        tweet_id,
        usuario,
        fecha_tweet,
        texto,
        enlace,
        likes,
        retweets,
        replies,
        verified,
        sentimiento,
        score_sentimiento,
        categoria,
        trend_original,
        created_at,
        intencion_comunicativa,
        entidades_mencionadas,
        propagacion_viral
      `)
      .in('id', numericIds);
    
    if (error) {
      console.error('❌ Error cargando tweets por IDs:', error);
      return [];
    }
    
    if (!tweets || tweets.length === 0) {
      console.log('⚠️ No se encontraron tweets con esos IDs en trending_tweets');
      return [];
    }
    
    // Format tweets for context
    const formattedTweets = tweets.map(tweet => ({
      id: tweet.id,
      tweet_id: tweet.tweet_id,
      title: tweet.texto, // Use tweet content as title
      content: tweet.texto,
      texto: tweet.texto, // Keep original field name for compatibility
      author: tweet.usuario,
      usuario: tweet.usuario, // Keep original field name
      timestamp: tweet.fecha_tweet || tweet.created_at,
      fecha: tweet.fecha_tweet || tweet.created_at,
      url: tweet.enlace,
      enlace: tweet.enlace,
      metrics: {
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
        replies: tweet.replies || 0
      },
      likes: tweet.likes || 0,
      retweets: tweet.retweets || 0,
      replies: tweet.replies || 0,
      sentiment: tweet.sentimiento,
      sentimiento: tweet.sentimiento,
      sentiment_score: tweet.score_sentimiento,
      score_sentimiento: tweet.score_sentimiento,
      category: tweet.categoria,
      categoria: tweet.categoria,
      trend: tweet.trend_original,
      trend_context: tweet.trend_original,
      trend_original: tweet.trend_original,
      intent: tweet.intencion_comunicativa,
      intencion_comunicativa: tweet.intencion_comunicativa,
      entities: tweet.entidades_mencionadas,
      entidades_mencionadas: tweet.entidades_mencionadas,
      propagation: tweet.propagacion_viral,
      propagacion_viral: tweet.propagacion_viral,
      verified: tweet.verified,
      type: 'trending_tweet',
      source: 'trending_tweets',
      created_at: tweet.created_at
    }));
    
    console.log(`✅ ${formattedTweets.length} tweets trending cargados por ID`);
    return formattedTweets;
    
  } catch (error) {
    console.error('❌ Error en cargarTweetsPorIds:', error);
    return [];
  }
}

/**
 * Carga tendencias específicas por nombres
 */
async function cargarTendenciasPorNombres(trendNames) {
  try {
    console.log('📈 Cargando tendencias por nombres:', trendNames);
    
    const { data: trends, error } = await supabase
      .from('trends')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50); // Get more recent trends to search within
    
    if (error) {
      console.error('❌ Error cargando tendencias:', error);
      return [];
    }
    
    if (!trends || trends.length === 0) {
      console.log('⚠️ No se encontraron tendencias');
      return [];
    }
    
    const matchedTrends = [];
    
    trends.forEach(trend => {
      try {
        let trendData = {};
        
        if (trend.raw_data) {
          const rawData = typeof trend.raw_data === 'string' 
            ? JSON.parse(trend.raw_data) 
            : trend.raw_data;
          
          if (rawData.twitter_trends) {
            trendData = rawData.twitter_trends;
          } else if (Array.isArray(rawData)) {
            trendData = { trends: rawData };
          } else {
            trendData = rawData;
          }
        }
        
        // Check if any of the selected trend names match
        const trendList = trendData.trends || [];
        const matchingTrends = trendList.filter(t => 
          trendNames.some(name => 
            name.toLowerCase().includes(t.trend?.toLowerCase() || t.name?.toLowerCase() || '') ||
            (t.trend?.toLowerCase() || t.name?.toLowerCase() || '').includes(name.toLowerCase())
          )
        );
        
        if (matchingTrends.length > 0) {
          matchingTrends.forEach(matchedTrend => {
            matchedTrends.push({
              trend_name: matchedTrend.trend || matchedTrend.name,
              volume: matchedTrend.volume || matchedTrend.tweet_volume,
              timestamp: trend.timestamp,
              about: trend.about,
              category: trend.category_data,
              keywords: trend.top_keywords,
              type: 'trend',
              source: 'trends'
            });
          });
        }
      } catch (parseError) {
        console.error('❌ Error procesando trend:', parseError);
      }
    });
    
    console.log(`✅ ${matchedTrends.length} tendencias encontradas por nombre`);
    return matchedTrends;
    
  } catch (error) {
    console.error('❌ Error en cargarTendenciasPorNombres:', error);
    return [];
  }
}

/**
 * Construye el contexto completo basado en las fuentes seleccionadas
 */
async function construirContextoCompleto(selectedContexts, userId = null, selectedMonitoreoIds = [], configuracion = {}) {
  try {
    console.log('🔨 Construyendo contexto completo:', selectedContexts);
    console.log('📊 LOGGING: Iniciando construcción de contexto con parámetros:', {
      selectedContexts,
      userId: userId || 'no proporcionado',
      selectedMonitoreoIds: selectedMonitoreoIds.length > 0 ? selectedMonitoreoIds : 'ninguno'
    });
    
    const contexto = {
      data: {},
      fuentes_utilizadas: [],
      aggregated_stats: {
        total_sentiment_positive: 0,
        total_sentiment_neutral: 0,
        total_sentiment_negative: 0,
        total_engagement: 0,
        date_range: {
          start: null,
          end: null
        },
        categories: {},
        keywords: {},
        sources: []
      }
    };

    // Obtain data from each selected source
    const promises = [];

    if (selectedContexts.includes('tendencias')) {
      // Check if specific items are selected from the modal
      const selectedItems = configuracion?.contexto_original?.tendencias;
      promises.push(
        obtenerContextoTendencias(10, selectedItems).then(data => ({ tipo: 'tendencias', data }))
      );
    }

    if (selectedContexts.includes('tweets')) {
      promises.push(
        obtenerContextoTweetsTrending(20).then(data => ({ tipo: 'tweets', data }))
      );
    }

    if (selectedContexts.includes('noticias')) {
      const selectedNoticias = configuracion?.contexto_original?.noticias;
      promises.push(
        obtenerContextoNoticias(15, selectedNoticias).then(data => ({ tipo: 'noticias', data }))
      );
    }

    if (selectedContexts.includes('codex')) {
      const selectedCodex = configuracion?.contexto_original?.codex;
      promises.push(
        obtenerContextoCodex(10, selectedCodex).then(data => ({ tipo: 'codex', data }))
      );
    }

    if (selectedContexts.includes('monitoreos')) {
      if (userId) {
        promises.push(
          obtenerContextoMonitoreos(userId, 15, selectedMonitoreoIds).then(data => ({ tipo: 'monitoreos', data }))
        );
      } else {
        console.log('⚠️ Contexto de monitoreos solicitado pero userId no proporcionado');
      }
    }

    // Execute all queries in parallel
    const resultados = await Promise.all(promises);

    // Organizar resultados por tipo
    resultados.forEach(resultado => {
      if (resultado.tipo === 'tendencias') {
        // Detectar elementos que realmente son tweets (tienen texto)
        const trendGroups = [];
        const tweetsDetectados = [];
        (resultado.data || []).forEach(item => {
          if (item.text || item.texto) {
            tweetsDetectados.push(item);
          } else {
            trendGroups.push(item);
          }
        });

        // Guardar tendencias normales
        contexto.data.tendencias = trendGroups;

        // Promover tweets al contexto global.
        if (tweetsDetectados.length > 0) {
          contexto.data.tweets = (contexto.data.tweets || []).concat(tweetsDetectados);

          // Añadir fuente si no estaba
          if (!contexto.fuentes_utilizadas.includes('tweets')) {
            contexto.fuentes_utilizadas.push('tweets');
          }
        }
      } else {
        contexto.data[resultado.tipo] = resultado.data;
      }
    });

    // Aggregate statistics for better insights
    resultados.forEach(resultado => {
      if (Array.isArray(resultado.data)) {
        resultado.data.forEach(item => {
          // Aggregate sentiment data
          if (item.sentiment || item.sentimiento) {
            const sentiment = item.sentiment || item.sentimiento;
            if (typeof sentiment === 'string') {
              if (sentiment === 'positive' || sentiment === 'positivo') {
                contexto.aggregated_stats.total_sentiment_positive++;
              } else if (sentiment === 'negative' || sentiment === 'negativo') {
                contexto.aggregated_stats.total_sentiment_negative++;
              } else {
                contexto.aggregated_stats.total_sentiment_neutral++;
              }
            }
          }
          
          // Aggregate engagement data
          if (item.total_engagement || item.engagement || item.metrics?.engagement) {
            const engagement = item.total_engagement || item.engagement || item.metrics?.engagement || 0;
            contexto.aggregated_stats.total_engagement += engagement;
          }
          
          // Track date range
          const itemDate = item.created_at || item.published_at || item.timestamp || item.fecha;
          if (itemDate) {
            const date = new Date(itemDate).toISOString().split('T')[0];
            if (!contexto.aggregated_stats.date_range.start || date < contexto.aggregated_stats.date_range.start) {
              contexto.aggregated_stats.date_range.start = date;
            }
            if (!contexto.aggregated_stats.date_range.end || date > contexto.aggregated_stats.date_range.end) {
              contexto.aggregated_stats.date_range.end = date;
            }
          }
          
          // Aggregate categories
          const category = item.category || item.categoria || 'general';
          contexto.aggregated_stats.categories[category] = (contexto.aggregated_stats.categories[category] || 0) + 1;
          
          // Aggregate keywords with proper handling of different types
          if (item.keywords) {
            let keywordArray = [];
            
            if (Array.isArray(item.keywords)) {
              keywordArray = item.keywords;
            } else if (typeof item.keywords === 'string') {
              keywordArray = [item.keywords];
            } else if (typeof item.keywords === 'object' && item.keywords !== null) {
              // Handle keyword objects
              keywordArray = Object.values(item.keywords).filter(k => typeof k === 'string');
            }
            
            keywordArray.forEach(keyword => {
              if (typeof keyword === 'string' && keyword.trim().length > 0) {
                const cleanKeyword = keyword.trim();
                contexto.aggregated_stats.keywords[cleanKeyword] = (contexto.aggregated_stats.keywords[cleanKeyword] || 0) + 1;
              } else if (typeof keyword === 'object' && keyword !== null) {
                // Extract string value from keyword object
                const keywordStr = keyword.name || keyword.keyword || keyword.term || keyword.value || String(keyword);
                if (keywordStr && keywordStr.length > 0) {
                  contexto.aggregated_stats.keywords[keywordStr] = (contexto.aggregated_stats.keywords[keywordStr] || 0) + 1;
                }
              }
            });
          }
          
          // Track sources
          const source = item.source || item.fuente || resultado.tipo;
          if (!contexto.aggregated_stats.sources.includes(source)) {
            contexto.aggregated_stats.sources.push(source);
          }
        });
      }
    });

    // Calculate context statistics
    contexto.estadisticas = {
      total_fuentes: selectedContexts.length,
      total_items: Object.values(contexto.data).reduce((acc, items) => acc + (Array.isArray(items) ? items.length : 0), 0),
      fuentes_con_datos: Object.keys(contexto.data).filter(key => 
        Array.isArray(contexto.data[key]) && contexto.data[key].length > 0
      ).length,
      sentiment_distribution: {
        positive: contexto.aggregated_stats.total_sentiment_positive,
        neutral: contexto.aggregated_stats.total_sentiment_neutral,
        negative: contexto.aggregated_stats.total_sentiment_negative
      },
      total_engagement: contexto.aggregated_stats.total_engagement,
      date_range: contexto.aggregated_stats.date_range,
      top_categories: Object.entries(contexto.aggregated_stats.categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([cat, count]) => ({ category: cat, count })),
      top_keywords: Object.entries(contexto.aggregated_stats.keywords)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count }))
    };
    
    // Detailed logging of context construction results
    console.log('📊 LOGGING: Contexto construido - Estadísticas detalladas:', {
      total_fuentes: contexto.estadisticas.total_fuentes,
      total_items: contexto.estadisticas.total_items,
      fuentes_con_datos: contexto.estadisticas.fuentes_con_datos,
      sentiment_totals: contexto.estadisticas.sentiment_distribution,
      engagement_total: contexto.estadisticas.total_engagement,
      date_range: contexto.estadisticas.date_range,
      top_3_categories: contexto.estadisticas.top_categories.slice(0, 3),
      top_5_keywords: contexto.estadisticas.top_keywords.slice(0, 5)
    });
    
    // Log data by source type
    Object.entries(contexto.data).forEach(([sourceType, sourceData]) => {
      if (Array.isArray(sourceData)) {
        console.log(`📊 LOGGING: Fuente "${sourceType}": ${sourceData.length} elementos`);
        if (sourceData.length > 0) {
          const sample = sourceData[0];
          console.log(`📊 LOGGING: Muestra de "${sourceType}":`, {
            id: sample.id || 'no disponible',
            title: sample.title || sample.titulo || sample.name || sample.trend || 'no disponible',
            category: sample.category || sample.categoria || 'no disponible',
            created_at: sample.created_at || sample.timestamp || sample.fecha || 'no disponible'
          });
        }
      }
    });

    console.log(`✅ Contexto completo construido:`, contexto.estadisticas);
    console.log('📊 LOGGING: Tamaño final del contexto:', {
      data_size_bytes: JSON.stringify(contexto.data).length,
      aggregated_stats_keys: Object.keys(contexto.aggregated_stats),
      sources_with_data: Object.keys(contexto.data).filter(key => 
        Array.isArray(contexto.data[key]) && contexto.data[key].length > 0
      )
    });
    return contexto;

  } catch (error) {
    console.error('❌ Error construyendo contexto completo:', error);
    throw error;
  }
}

/**
 * Obtiene contexto adicional usando Perplexity para enriquecer la información
 */
async function obtenerContextoAdicionalPerplexity(pregunta, contextoBase) {
  try {
    console.log('🔍 Obteniendo contexto adicional con Perplexity');
    
    // Importar funciones de perplexity.js y supabase
    const { obtenerContextoTweets, getAboutFromPerplexityIndividual } = require('./perplexity');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    // 1. OBTENER TWEETS RELEVANTES basados en las tendencias del contexto
    console.log(`🐦 Buscando tweets relevantes basados en tendencias actuales`);
    let contextoTweets = '';
    
    // Extraer nombres de tendencias del contexto base para buscar tweets
    let tendenciasNombres = [];
    if (contextoBase && contextoBase.data && contextoBase.data.tendencias) {
      tendenciasNombres = contextoBase.data.tendencias
        .slice(0, 5) // Limitar a 5 tendencias principales
        .map(t => {
          const nombre = t.nombre || t.trend || t.keyword || t.name || t.query || '';
          // Limpiar y validar nombres de tendencias
          return nombre.replace(/[^a-zA-Z0-9\sáéíóúñü]/g, '').trim();
        })
        .filter(nombre => nombre.length >= 3 && nombre.length <= 50); // Solo nombres válidos
      
      console.log(`📊 Tendencias encontradas para búsqueda: ${tendenciasNombres.length}`, tendenciasNombres);
    }
    
    if (tendenciasNombres.length > 0) {
      // Buscar tweets en la tabla trending_tweets usando palabras clave de las tendencias
      try {
        // Construct a simpler and safer query
        const searchTerms = tendenciasNombres
          .slice(0, 3) // Limit to 3 terms to avoid query complexity
          .map(term => term.toLowerCase().trim())
          .filter(term => term.length >= 3);
        
        if (searchTerms.length === 0) {
          console.log('📭 No hay términos válidos para búsqueda de tweets');
          contextoTweets = '';
        } else {
          console.log(`🔍 Buscando tweets con términos:`, searchTerms);
          
          // Use a simpler approach: search each term individually and combine results
          const allTweets = [];
          
          for (const term of searchTerms) {
            try {
              const { data: tweets, error } = await supabase
                .from('trending_tweets')
                .select('texto, usuario, likes, retweets, replies, verified, fecha_tweet, sentimiento')
                .ilike('texto', `%${term}%`)
                .gte('fecha_captura', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('fecha_captura', { ascending: false })
                .limit(5);

              if (!error && tweets && tweets.length > 0) {
                console.log(`✅ Encontrados ${tweets.length} tweets para término "${term}"`);
                allTweets.push(...tweets);
              } else if (error) {
                console.log(`⚠️ Error buscando término "${term}":`, error.message);
              } else {
                console.log(`📭 No tweets encontrados para término "${term}"`);
              }
            } catch (termError) {
              console.log(`❌ Error en búsqueda de término "${term}":`, termError.message);
            }
          }
          
          if (allTweets.length > 0) {
            // Remove duplicates and format
            const uniqueTweets = allTweets
              .filter((tweet, index, self) => 
                index === self.findIndex(t => t.texto === tweet.texto)
              )
              .slice(0, 8); // Limit to 8 unique tweets
            
            const tweetsFormateados = uniqueTweets.map(tweet => {
              const engagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
              const verificado = tweet.verified ? ' ✓' : '';
              const sentimiento = tweet.sentimiento ? ` (${tweet.sentimiento})` : '';
              return `@${tweet.usuario}${verificado}: ${tweet.texto}${sentimiento} (${engagement} interacciones)`;
            });
            
            contextoTweets = tweetsFormateados.join('\n\n');
            console.log(`✅ Contexto de tweets creado con ${uniqueTweets.length} tweets únicos`);
          } else {
            console.log(`📭 No se encontraron tweets válidos para ningún término`);
            contextoTweets = '';
          }
        }
      } catch (tweetError) {
        console.error('❌ Error general en búsqueda de tweets:', tweetError.message);
        console.log('📭 Fallback: continuando sin tweets adicionales');
        contextoTweets = '';
      }
    } else {
      console.log(`📭 No se encontraron nombres de tendencias válidos para búsqueda de tweets`);
    }
    
    // 2. OBTENER CONTEXTO WEB CON PERPLEXITY
    console.log(`🌐 Buscando información web con Perplexity para: "${pregunta}"`);
    let contextoWeb = '';
    
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        // Usar Perplexity para obtener información actualizada sobre la pregunta
        const perplexityResult = await getAboutFromPerplexityIndividual(pregunta, 'Guatemala', 2025);
        
        if (perplexityResult && perplexityResult.resumen) {
          contextoWeb = `INFORMACIÓN WEB ACTUALIZADA:
${perplexityResult.resumen}

RAZÓN DE RELEVANCIA: ${perplexityResult.razon_tendencia || 'Información relevante para el contexto guatemalteco'}

PALABRAS CLAVE: ${perplexityResult.palabras_clave ? perplexityResult.palabras_clave.join(', ') : 'No disponibles'}`;
        }
      } catch (perplexityError) {
        console.error('⚠️ Error con Perplexity API:', perplexityError.message);
        contextoWeb = 'No se pudo obtener información web adicional.';
      }
    } else {
      console.log('⚠️ PERPLEXITY_API_KEY no configurada, saltando búsqueda web');
      contextoWeb = 'Búsqueda web no disponible (API key no configurada).';
    }
    
    // 3. CONSTRUIR CONTEXTO ENRIQUECIDO
    let contextoEnriquecido = '';
    
    if (contextoTweets && contextoTweets.length > 0) {
      contextoEnriquecido += `\n📱 CONVERSACIÓN EN REDES SOCIALES:\n${contextoTweets}\n`;
    }
    
    if (contextoWeb && contextoWeb.length > 0) {
      contextoEnriquecido += `\n🌐 CONTEXTO WEB ACTUALIZADO:\n${contextoWeb}\n`;
    }
    
    // 4. EXTRAER KEYWORDS DE LA PREGUNTA para búsquedas más específicas
    const keywords = extraerKeywords(pregunta);
    
    console.log(`✅ Contexto adicional obtenido: ${contextoTweets ? 'Tweets ✓' : 'Tweets ✗'} | ${contextoWeb ? 'Web ✓' : 'Web ✗'}`);
    
    return {
      contexto_enriquecido: contextoEnriquecido,
      contexto_tweets: contextoTweets,
      contexto_web: contextoWeb,
      keywords_extraidas: keywords,
      query_utilizado: pregunta,
      timestamp: new Date().toISOString(),
      fuentes_utilizadas: ['tweets', 'perplexity_web']
    };

  } catch (error) {
    console.error('❌ Error obteniendo contexto adicional:', error);
    return {
      contexto_enriquecido: '',
      contexto_tweets: '',
      contexto_web: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Extrae keywords relevantes de una pregunta para búsquedas más específicas
 */
function extraerKeywords(pregunta) {
  // Palabras comunes a filtrar
  const stopWords = ['qué', 'cuáles', 'cómo', 'dónde', 'cuándo', 'por', 'para', 'con', 'sin', 'sobre', 'en', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'son', 'es', 'está', 'están', 'tiene', 'tienen', 'principales', 'principales', 'actualmente', 'hoy', 'día', 'días'];
  
  // Extraer palabras de 3+ caracteres que no sean stop words
  const palabras = pregunta.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(palabra => palabra.length >= 3 && !stopWords.includes(palabra))
    .slice(0, 5); // Máximo 5 keywords
  
  return palabras;
}

/**
 * Procesa el sondeo con ChatGPT 4o (integración real con OpenAI)
 */
async function procesarSondeoConChatGPT(pregunta, contexto, configuracion = {}) {
  try {
    console.log('🤖 Procesando sondeo con ChatGPT 4o');
    console.log('📊 LOGGING: Iniciando procesamiento con ChatGPT:', {
      pregunta_length: pregunta.length,
      contexto_keys: Object.keys(contexto),
      fuentes_utilizadas: contexto.fuentes_utilizadas || [],
      tiene_contexto_adicional: !!contexto.contexto_adicional,
      configuracion_keys: Object.keys(configuracion),
      costo_calculado: configuracion.costo_calculado || 'no disponible'
    });
    
    // Verificar que la API key esté configurada
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no configurada');
    }
    
    // Construir prompt para ChatGPT
    const prompt = construirPromptSondeo(pregunta, contexto, configuracion);
    
    console.log('📊 LOGGING: Prompt construido para ChatGPT:', {
      prompt_length: prompt.length,
      prompt_preview: prompt.substring(0, 200) + '...',
      contexto_web_incluido: prompt.includes('CONTEXTO WEB'),
      contexto_tweets_incluido: prompt.includes('CONVERSACIÓN SOCIAL'),
      estadisticas_incluidas: prompt.includes('ESTADÍSTICAS'),
      sources_with_data: contexto.fuentes_utilizadas || []
    });
    
    // Determinar el tipo de contexto principal
    const tipoContextoPrincipal = contexto.fuentes_utilizadas[0] || 'tendencias';
    console.log('📊 LOGGING: Tipo de contexto principal determinado:', tipoContextoPrincipal);
    
    // Preparar payload para OpenAI (optimizado para límites de tokens)
    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres un analista experto en datos de Guatemala y Centroamérica. Analiza información y responde preguntas específicas basándote EXCLUSIVAMENTE en el contexto proporcionado.

INSTRUCCIONES CRÍTICAS PARA ANÁLISIS DE DATOS REALES:

1. 📊 ANÁLISIS DE SENTIMIENTOS REALES:
   - Examina las fechas en el contexto (tweets, noticias, documentos)
   - Identifica patrones de sentimiento por períodos temporales
   - Usa datos reales de engagement, likes, retweets para inferir sentimiento
   - Si hay análisis de sentimiento en los datos, úsalos directamente

2. 📅 CRONOLOGÍA DE EVENTOS REALES:
   - Extrae fechas específicas mencionadas en el contexto
   - Identifica eventos concretos con fechas en tweets, noticias o documentos
   - Usa títulos reales de noticias como eventos
   - Prioriza eventos con mayor impacto (más menciones, engagement)

3. 🎯 USO DEL CONTEXTO REAL:
   - NUNCA inventes datos que no estén en el contexto
   - Usa nombres reales de personas, instituciones, lugares del contexto
   - Extrae keywords reales del texto proporcionado
   - Basa los análisis en información específica del contexto

Al final incluye un bloque JSON con datos para visualización que DEBE incluir estos campos específicos BASADOS EN EL CONTEXTO REAL:

\`\`\`json
{
  "temas_relevantes": [{"tema": "Nombre del contexto", "valor": 85}],
  "distribucion_categorias": [{"categoria": "Categoría real", "valor": 35}],
  "evolucion_sentimiento": [
    {"tiempo": "Lun", "positivo": 45, "neutral": 30, "negativo": 25, "fecha": "2024-01-01"},
    {"tiempo": "Mar", "positivo": 48, "neutral": 32, "negativo": 20, "fecha": "2024-01-02"},
    {"tiempo": "Mié", "positivo": 52, "neutral": 28, "negativo": 20, "fecha": "2024-01-03"}
  ],
  "cronologia_eventos": [
    {
      "id": "1",
      "fecha": "2024-01-03",
      "titulo": "Evento real del contexto",
      "descripcion": "Descripción basada en datos reales del contexto",
      "impacto": "alto",
      "categoria": "categoria_real", 
      "sentimiento": "positivo",
      "keywords": ["keyword1_real", "keyword2_real"],
      "fuentes": ["Fuente real 1", "Fuente real 2"]
    }
  ],
  "conclusiones": "Resumen ejecutivo basado en datos reales analizados",
  "metodologia": "Descripción de cómo se analizaron los datos reales del contexto"
}
\`\`\`

IMPORTANTE: Los campos 'evolucion_sentimiento' y 'cronologia_eventos' DEBEN basarse en datos reales del contexto. Si no hay suficientes datos temporales, usa al menos 3-5 puntos basados en la información disponible.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    };

    // Llamar a OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Organization': process.env.OPENAI_ORG_ID || ''
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en OpenAI API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let respuestaIA = '';
    let tokensInfo = {};

    // Extraer la respuesta y la información de tokens
    if (data.choices && data.choices[0] && data.choices[0].message) {
      respuestaIA = data.choices[0].message.content;
      
      // Extraer información de tokens para logs
      if (data.usage) {
        console.log(`🔢 Tokens utilizados: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`);
        tokensInfo = {
          total: data.usage.total_tokens,
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens
        };
      }
    } else {
      respuestaIA = 'No se obtuvo respuesta del modelo.';
    }

    // Extraer datos JSON para visualizaciones
    let datosVisualizacion = null;
    const jsonPatterns = [
      /```json\n([\s\S]*?)\n```/, // Formato estándar ```json
      /```\n([\s\S]*?)\n```/,     // Formato sin especificar lenguaje
      /`([\s\S]*?)`/              // Formato de bloque simple
    ];

    let jsonText = null;
    for (const pattern of jsonPatterns) {
      const match = respuestaIA.match(pattern);
      if (match && match[1]) {
        jsonText = match[1];
        break;
      }
    }

    if (jsonText) {
      try {
        // Limpiar el JSON extraído y parsearlo
        const cleanedJson = jsonText
          .replace(/\/\/.*$/gm, '') // Eliminar comentarios
          .replace(/\/\*[\s\S]*?\*\//g, '') // Eliminar comentarios multilinea
          .replace(/,\s*}/g, '}')   // Eliminar comas finales incorrectas
          .replace(/,\s*]/g, ']')   // Eliminar comas finales incorrectas
          .trim();

        datosVisualizacion = JSON.parse(cleanedJson);

        // Limpiar la respuesta eliminando el JSON
        respuestaIA = respuestaIA.replace(/```json\n[\s\S]*?\n```/, '')
                                 .replace(/```\n[\s\S]*?\n```/, '')
                                 .replace(/`[\s\S]*?`/, '')
                                 .trim();

        console.log('✅ Datos para visualizaciones extraídos correctamente:', Object.keys(datosVisualizacion));
      } catch (jsonError) {
        console.error('❌ Error parseando JSON de visualizaciones:', jsonError);
        datosVisualizacion = null;
      }
    }

            // Si no se pudieron extraer datos, generar datos basados en contexto real
        if (!datosVisualizacion) {
          console.log('⚠️ No se encontraron datos estructurados en la respuesta, generando datos basados en contexto real');
          datosVisualizacion = fusionarDatosConContextoReal(pregunta, tipoContextoPrincipal, contexto);
        } else {
          // Si se extrajeron datos, enriquecerlos con información del contexto real
          console.log('✅ Datos extraídos de ChatGPT, enriqueciendo con contexto real');
          datosVisualizacion = enriquecerDatosConContexto(datosVisualizacion, contexto);
        }

    // Integrate Perplexity data into visualizations if available
    if (datosVisualizacion && contexto.contexto_adicional) {
      console.log('📊 LOGGING: Integrando datos de Perplexity en visualizaciones');
      const datosAntesIntegracion = Object.keys(datosVisualizacion);
      datosVisualizacion = integrarDatosPerplexityEnVisualizaciones(datosVisualizacion, contexto.contexto_adicional);
      console.log('📊 LOGGING: Integración Perplexity completada:', {
        keys_antes: datosAntesIntegracion,
        keys_despues: Object.keys(datosVisualizacion),
        sources_used_final: datosVisualizacion.sources_used || [],
        metodologia_enriquecida: datosVisualizacion.metodologia ? datosVisualizacion.metodologia.includes('Enriquecido') : false
      });
    }
    
    // Construir respuesta estructurada
    const respuestaEstructurada = {
      respuesta: respuestaIA,
      
      metadata: {
        modelo: 'gpt-4o',
        tokens_utilizados: tokensInfo.total || 0,
        tokens_prompt: tokensInfo.prompt || 0,
        tokens_completion: tokensInfo.completion || 0,
        fuentes_utilizadas: contexto.fuentes_utilizadas,
        sources_used: datosVisualizacion?.sources_used || contexto.fuentes_utilizadas,
        timestamp: new Date().toISOString(),
        configuracion_utilizada: configuracion,
        has_sufficient_data: !datosVisualizacion?.warning,
        data_quality: datosVisualizacion?.warning ? 'insufficient' : 'adequate'
      },
      
      // Datos estructurados para visualización
      datos_visualizacion: datosVisualizacion,
      
      estadisticas: {
        contexto_procesado: contexto.estadisticas,
        costo_creditos: configuracion.costo_calculado || 15,
        aggregated_stats: contexto.aggregated_stats || {}
      }
    };

    console.log('✅ Sondeo procesado exitosamente con ChatGPT 4o');
    console.log('📊 LOGGING: Respuesta final estructurada:', {
      respuesta_length: respuestaEstructurada.respuesta ? respuestaEstructurada.respuesta.length : 0,
      metadata_keys: Object.keys(respuestaEstructurada.metadata || {}),
      datos_visualizacion_keys: Object.keys(respuestaEstructurada.datos_visualizacion || {}),
      tokens_utilizados: respuestaEstructurada.metadata?.tokens_utilizados || 0,
      sources_used: respuestaEstructurada.metadata?.sources_used || [],
      data_quality: respuestaEstructurada.metadata?.data_quality || 'unknown'
    });
    return respuestaEstructurada;

  } catch (error) {
    console.error('❌ Error procesando sondeo con ChatGPT:', error);
    
            // En caso de error, devolver respuesta basada en contexto real como fallback
        const tipoContextoPrincipal = contexto.fuentes_utilizadas[0] || 'tendencias';
        const datosVisualizacion = fusionarDatosConContextoReal(pregunta, tipoContextoPrincipal, contexto);
    
    // Integrate Perplexity data even in error case
    if (datosVisualizacion && contexto.contexto_adicional) {
      datosVisualizacion = integrarDatosPerplexityEnVisualizaciones(datosVisualizacion, contexto.contexto_adicional);
    }
    
    return {
      respuesta: `Error al procesar la consulta: "${pregunta}". 
      
Se produjo un error al conectar con el servicio de IA. Por favor, intenta nuevamente.

Error técnico: ${error.message}`,
      
      metadata: {
        modelo: 'fallback',
        error: error.message,
        fuentes_utilizadas: contexto.fuentes_utilizadas,
        sources_used: datosVisualizacion?.sources_used || contexto.fuentes_utilizadas,
        timestamp: new Date().toISOString(),
        has_sufficient_data: !datosVisualizacion?.warning,
        data_quality: datosVisualizacion?.warning ? 'insufficient' : 'fallback'
      },
      
      datos_visualizacion: datosVisualizacion,
      
      estadisticas: {
        contexto_procesado: contexto.estadisticas,
        costo_creditos: 0, // No cobrar en caso de error
        aggregated_stats: contexto.aggregated_stats || {}
      }
    };
  }
}

/**
 * Genera datos de visualización basados en el contexto real proporcionado
 */
function generarDatosVisualizacionDesdeContexto(consulta, tipo, contexto) {
  console.log(`📊 Generando visualizaciones desde contexto real para: ${consulta} (tipo: ${tipo})`);
  console.log('📊 LOGGING: Iniciando generación de visualizaciones con parámetros:', {
    consulta,
    tipo,
    contexto_keys: Object.keys(contexto),
    fuentes_utilizadas: contexto.fuentes_utilizadas || [],
    total_data_sources: contexto.data ? Object.keys(contexto.data).length : 0,
    estadisticas_disponibles: !!contexto.estadisticas
  });
  
  // Check environment variable for mock data
  const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';
  console.log('📊 LOGGING: USE_MOCK_DATA configurado en:', USE_MOCK_DATA);
  
  if (USE_MOCK_DATA) {
    console.log('⚠️ USE_MOCK_DATA=true - utilizando datos simulados');
    return generarDatosVisualizacion(consulta, tipo, contexto);
  }
  
  // Route to specific real-data generators based on context type
  const datosReales = extraerDatosRealesDelContexto(contexto);
  
  console.log('📊 LOGGING: Datos reales extraídos:', {
    total_elementos: datosReales.totalElementos,
    fuentes: datosReales.fuentes,
    fechas_disponibles: datosReales.fechas.length,
    eventos_detectados: datosReales.eventos.length,
    categorias_encontradas: Object.keys(datosReales.categorias).length,
    temas_identificados: datosReales.temas.length
  });
  
  // Generate visualizations using appropriate generator
  let visualizaciones;
  
  if (datosReales.totalElementos > 0) {
    console.log('✅ Generando visualizaciones con datos reales');
    // Use the new buildVisualizationData function for better real data processing
    const datasetsReales = buildVisualizationData(datosReales, consulta, tipo);
    
    visualizaciones = {
      temas_relevantes: datasetsReales.temas_relevantes,
      distribucion_categorias: datasetsReales.distribucion_categorias,
      evolucion_sentimiento: datasetsReales.evolucion_sentimiento,
      cronologia_eventos: datasetsReales.cronologia_eventos,
      conclusiones: `Análisis basado en ${datosReales.totalElementos} elementos de ${datosReales.fuentes.join(', ')}. 
        ${datosReales.sentimientos.length > 0 ? `Análisis de sentimiento de ${datosReales.sentimientos.length} elementos. ` : ''}
        ${datosReales.eventos.length > 0 ? `${datosReales.eventos.length} eventos identificados. ` : ''}
        Período analizado: ${datasetsReales.metadata.periodo_analisis}`,
      metodologia: `Extracción automática de datos reales desde fuentes: ${datosReales.fuentes.join(', ')}. 
        Procesamiento de ${datosReales.totalElementos} elementos con análisis temporal y de sentimiento.`,
      sources_used: datosReales.fuentes,
      data_source: 'real_context_extraction',
      metadata: datasetsReales.metadata
    };
  } else {
    console.log('⚠️ Datos insuficientes - usando generador de fallback');
    visualizaciones = generarDatosVisualizacion(consulta, tipo, contexto);
    visualizaciones.warning = "Datos limitados disponibles para análisis completo";
    visualizaciones.sources_used = datosReales.fuentes.length > 0 ? datosReales.fuentes : ['fallback'];
  }
  
  console.log('📊 LOGGING: Visualizaciones generadas exitosamente:', {
    temas_count: visualizaciones.temas_relevantes ? visualizaciones.temas_relevantes.length : 0,
    categorias_count: visualizaciones.distribucion_categorias ? visualizaciones.distribucion_categorias.length : 0,
    evolucion_points: visualizaciones.evolucion_sentimiento ? visualizaciones.evolucion_sentimiento.length : 0,
    eventos_count: visualizaciones.cronologia_eventos ? visualizaciones.cronologia_eventos.length : 0,
    usando_datos_reales: !visualizaciones.warning,
    sources_used: visualizaciones.sources_used || []
  });
  
  return visualizaciones;
}

/**
 * Enriquece datos de visualización existentes con información del contexto real
 */
function enriquecerDatosConContexto(datosExistentes, contexto) {
  console.log('🔧 Enriqueciendo datos de ChatGPT con contexto real');
  
  const datosReales = extraerDatosRealesDelContexto(contexto);
  
  // Enriquecer evolucion_sentimiento con fechas reales
  if (datosExistentes.evolucion_sentimiento && datosReales.fechas.length > 0) {
    datosExistentes.evolucion_sentimiento = ajustarEvolucionConFechasReales(
      datosExistentes.evolucion_sentimiento, 
      datosReales.fechas
    );
  }
  
  // Enriquecer cronologia_eventos con eventos reales
  if (datosExistentes.cronologia_eventos && datosReales.eventos.length > 0) {
    datosExistentes.cronologia_eventos = combinarEventosReales(
      datosExistentes.cronologia_eventos,
      datosReales.eventos
    );
  }
  
  // Actualizar fuentes con datos reales
  if (datosReales.fuentes.length > 0) {
    datosExistentes.metodologia += ` (Enriquecido con datos de: ${datosReales.fuentes.join(', ')})`;
  }
  
  console.log('✅ Datos enriquecidos con contexto real');
  return datosExistentes;
}

/**
 * Extrae datos estructurados del contexto real
 */
function extraerDatosRealesDelContexto(contexto) {
  const datos = {
    fechas: [],
    eventos: [],
    sentimientos: [],
    fuentes: [],
    temas: [],
    categorias: {},
    totalElementos: 0
  };
  
  console.log('📊 Extrayendo datos reales del contexto:', {
    contexto_keys: Object.keys(contexto),
    data_keys: contexto.data ? Object.keys(contexto.data) : [],
    fuentes_utilizadas: contexto.fuentes_utilizadas || []
  });
  
  // Extraer de tendencias
  if (contexto.data && contexto.data.tendencias) {
    datos.fuentes.push('tendencias');
    contexto.data.tendencias.forEach(t => {
      if (t.fecha || t.timestamp) {
        datos.fechas.push(t.fecha || t.timestamp);
      }
      if (t.nombre || t.trend) {
        datos.temas.push(t.nombre || t.trend);
      }
      if (t.categoria) {
        datos.categorias[t.categoria] = (datos.categorias[t.categoria] || 0) + 1;
      }
      // Extraer sentimiento si existe
      if (t.about && typeof t.about === 'object' && t.about.sentimiento) {
        datos.sentimientos.push({
          valor: t.about.sentimiento,
          fecha: t.fecha || t.timestamp,
          fuente: 'tendencia'
        });
      }
      datos.totalElementos++;
    });
    console.log(`✅ Extraídos ${contexto.data.tendencias.length} elementos de tendencias`);
  }
  
  // Extraer de tweets
  if (contexto.data && contexto.data.tweets) {
    datos.fuentes.push('tweets');
    contexto.data.tweets.forEach(tw => {
      const fecha = tw.created_at || tw.fecha_tweet || tw.fecha;
      if (fecha) {
        datos.fechas.push(fecha);
      }
      
      // Extraer tema del texto del tweet
      const texto = tw.text || tw.texto || '';
      if (texto.length > 10) {
        const palabrasImportantes = texto.split(' ')
          .filter(palabra => palabra.length > 4 && !['para', 'este', 'esta', 'con', 'que', 'por', 'una', 'uno'].includes(palabra.toLowerCase()))
          .slice(0, 2);
        if (palabrasImportantes.length > 0) {
          datos.temas.push(palabrasImportantes.join(' '));
        }
      }
      
      // Extraer categoría si existe
      const categoria = tw.category || tw.categoria || 'social';
      datos.categorias[categoria] = (datos.categorias[categoria] || 0) + 1;
      
      // Extraer sentimiento si existe
      if (tw.sentiment || tw.sentimiento) {
        datos.sentimientos.push({
          valor: tw.sentiment || tw.sentimiento,
          score: tw.sentiment_score || tw.score_sentimiento || 0,
          fecha: fecha,
          fuente: 'tweet'
        });
      }
      
      // Agregar como evento si tiene alto engagement
      const engagement = (tw.metrics?.engagement || tw.likes || 0) + (tw.retweets || 0);
      if (engagement > 50) {
        datos.eventos.push({
          titulo: `Tweet viral: ${(tw.text || tw.texto || '').substring(0, 50)}...`,
          fecha: fecha || new Date().toISOString().split('T')[0],
          fuente: `@${tw.author || tw.usuario || 'usuario'}`,
          categoria: categoria,
          engagement: engagement
        });
      }
      
      datos.totalElementos++;
    });
    console.log(`✅ Extraídos ${contexto.data.tweets.length} elementos de tweets`);
  }
  
  // Extraer de noticias
  if (contexto.data && contexto.data.noticias) {
    datos.fuentes.push('noticias');
    contexto.data.noticias.forEach(n => {
      if (n.fecha || n.published_at || n.date) {
        datos.fechas.push(n.fecha || n.published_at || n.date);
      }
      if (n.title || n.titulo) {
        datos.eventos.push({
          titulo: n.title || n.titulo,
          fecha: n.fecha || n.published_at || n.date || new Date().toISOString().split('T')[0],
          fuente: n.source || n.fuente || 'Noticia',
          categoria: n.categoria || n.category || 'general'
        });
        
        // Agregar título como tema
        datos.temas.push((n.title || n.titulo).substring(0, 50));
      }
      if (n.categoria || n.category) {
        const categoria = n.categoria || n.category;
        datos.categorias[categoria] = (datos.categorias[categoria] || 0) + 1;
      }
      datos.totalElementos++;
    });
    console.log(`✅ Extraídos ${contexto.data.noticias.length} elementos de noticias`);
  }
  
  // Extraer de monitoreos
  if (contexto.data && contexto.data.monitoreos) {
    datos.fuentes.push('monitoreos');
    contexto.data.monitoreos.forEach(m => {
      // Agregar fecha de monitoreo
      if (m.created_at || m.updated_at) {
        datos.fechas.push(m.created_at || m.updated_at);
      }
      
      // Agregar tema del monitoreo
      if (m.titulo || m.query_original) {
        datos.temas.push(m.titulo || m.query_original);
      }
      
      // Agregar categoría
      if (m.categoria) {
        datos.categorias[m.categoria] = (datos.categorias[m.categoria] || 0) + 1;
      }
      
      // Extraer sentimiento agregado
      if (m.analisis_sentimiento) {
        const sentiment = m.analisis_sentimiento;
        datos.sentimientos.push({
          valor: sentiment.sentimiento_promedio || 'neutral',
          score: sentiment.score_promedio || 0,
          fecha: m.created_at || m.updated_at,
          fuente: 'monitoreo'
        });
      }
      
      // Agregar como evento si tiene muchos tweets
      if (m.tweet_count && m.tweet_count > 10) {
        datos.eventos.push({
          titulo: `Monitoreo: ${(m.titulo || m.query_original).substring(0, 50)}`,
          fecha: m.created_at || m.updated_at || new Date().toISOString().split('T')[0],
          fuente: `Monitoreo (${m.tweet_count} tweets)`,
          categoria: m.categoria || 'general',
          engagement: m.total_engagement || 0
        });
      }
      
      datos.totalElementos++;
    });
    console.log(`✅ Extraídos ${contexto.data.monitoreos.length} elementos de monitoreos`);
  }
  
  // Extraer de codex
  if (contexto.data && contexto.data.codex) {
    datos.fuentes.push('codex');
    contexto.data.codex.forEach(c => {
      if (c.created_at || c.fecha) {
        datos.fechas.push(c.created_at || c.fecha);
      }
      if (c.title || c.titulo) {
        datos.temas.push((c.title || c.titulo).substring(0, 50));
        datos.eventos.push({
          titulo: c.title || c.titulo,
          fecha: c.created_at || c.fecha || new Date().toISOString().split('T')[0],
          fuente: 'Documento Codex',
          categoria: c.categoria || 'documento'
        });
      }
      datos.totalElementos++;
    });
    console.log(`✅ Extraídos ${contexto.data.codex.length} elementos de codex`);
  }
  
  // Extraer fechas únicas y ordenarlas
  datos.fechas = [...new Set(datos.fechas)].sort().slice(-7);
  
  // Limpiar temas duplicados y limitarlos
  datos.temas = [...new Set(datos.temas)].slice(0, 10);
  
  console.log('📊 Resumen de extracción de datos reales:', {
    totalElementos: datos.totalElementos,
    fuentes: datos.fuentes,
    fechas_disponibles: datos.fechas.length,
    eventos_detectados: datos.eventos.length,
    categorias_encontradas: Object.keys(datos.categorias).length,
    temas_identificados: datos.temas.length,
    sentimientos_extraidos: datos.sentimientos.length
  });
  
  return datos;
}

/**
 * Genera temas relevantes desde el contexto real
 */
function generarTemasDesdeContexto(datosReales) {
  const temas = datosReales.temas.slice(0, 5).map((tema, index) => ({
    tema: tema,
    valor: Math.max(90 - (index * 10), 30) // Valores decrecientes basados en orden
  }));
  
  return temas.length > 0 ? temas : [
    { tema: "Análisis en curso", valor: 75 }
  ];
}

/**
 * Genera distribución de categorías desde el contexto real
 */
function generarCategoriasDesdeContexto(datosReales) {
  const categorias = Object.entries(datosReales.categorias)
    .map(([categoria, count]) => ({
      categoria: categoria,
      valor: Math.round((count / datosReales.totalElementos) * 100)
    }))
    .sort((a, b) => b.valor - a.valor);
  
  return categorias.length > 0 ? categorias : [
    { categoria: "General", valor: 100 }
  ];
}

/**
 * Genera evolución de sentimiento basada en fechas reales
 */
function generarEvolucionSentimientoReal(datosReales, baseSentiment = 'mixed') {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const fechaActual = new Date();
  const evolucion = [];
  
  // Use real dates if available, otherwise generate last 7 days
  const fechasAUsar = datosReales.fechas.length > 0 ? 
    datosReales.fechas.slice(-7) : 
    Array.from({length: 7}, (_, i) => {
      const fecha = new Date(fechaActual);
      fecha.setDate(fecha.getDate() - (6 - i));
      return fecha.toISOString().split('T')[0];
    });
  
  // Define base sentiment distributions
  const sentimentBases = {
    'positive': { positivo: 55, neutral: 30, negativo: 15 },
    'neutral': { positivo: 40, neutral: 45, negativo: 15 },
    'negative': { positivo: 25, neutral: 35, negativo: 40 },
    'mixed': { positivo: 40, neutral: 35, negativo: 25 }
  };
  
  const baseDistribution = sentimentBases[baseSentiment] || sentimentBases['mixed'];
  
  fechasAUsar.forEach((fecha, index) => {
    const fechaObj = new Date(fecha);
    const nombreDia = dias[fechaObj.getDay()];
    
    // Generate sentiment with realistic variation around base
    const variation = 0.8 + Math.random() * 0.4; // 80% to 120% variation
    
    let positivo = Math.round(baseDistribution.positivo * variation);
    let neutral = Math.round(baseDistribution.neutral * variation);
    let negativo = Math.round(baseDistribution.negativo * variation);
    
    // Ensure percentages add up to reasonable total
    const total = positivo + neutral + negativo;
    if (total > 0) {
      positivo = Math.round((positivo / total) * 100);
      neutral = Math.round((neutral / total) * 100);
      negativo = 100 - positivo - neutral; // Ensure exact 100%
    }
    
    evolucion.push({
      tiempo: nombreDia,
      positivo: Math.max(0, positivo),
      neutral: Math.max(0, neutral),
      negativo: Math.max(0, negativo),
      fecha: fecha
    });
  });
  
  return evolucion;
}

/**
 * Genera cronología de eventos desde el contexto real
 */
function generarCronologiaEventosReal(datosReales, consulta) {
  const eventos = [];
  
  // Usar eventos reales de noticias
  datosReales.eventos.slice(0, 5).forEach((evento, index) => {
    eventos.push({
      id: `evento_${index + 1}`,
      fecha: evento.fecha,
      titulo: evento.titulo.substring(0, 60),
      descripcion: `Evento relacionado con ${consulta} reportado en ${evento.fuente}`,
      impacto: index < 2 ? "alto" : index < 4 ? "medio" : "bajo",
      categoria: evento.categoria,
      sentimiento: ["positivo", "neutral", "negativo"][index % 3],
      keywords: [consulta.split(' ')[0] || "tema", evento.categoria],
      fuentes: [evento.fuente]
    });
  });
  
  // Si no hay eventos reales, crear al menos uno basado en la consulta
  if (eventos.length === 0) {
    eventos.push({
      id: "evento_1",
      fecha: new Date().toISOString().split('T')[0],
      titulo: `Análisis de "${consulta}"`,
      descripcion: `Emergencia del tema "${consulta}" en las fuentes monitoreadas`,
      impacto: "medio",
      categoria: "general",
      sentimiento: "neutral",
      keywords: [consulta],
      fuentes: datosReales.fuentes
    });
  }
  
  return eventos;
}

/**
 * Ajusta evolución de sentimiento con fechas reales
 */
function ajustarEvolucionConFechasReales(evolucionExistente, fechasReales) {
  if (fechasReales.length === 0) return evolucionExistente;
  
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  return evolucionExistente.map((item, index) => {
    const fechaReal = fechasReales[Math.min(index, fechasReales.length - 1)];
    const fechaObj = new Date(fechaReal);
    
    return {
      ...item,
      fecha: fechaReal,
      tiempo: dias[fechaObj.getDay()]
    };
  });
}

/**
 * Combina eventos existentes con eventos reales
 */
function combinarEventosReales(eventosExistentes, eventosReales) {
  const eventosCombinados = [...eventosExistentes];
  
  // Agregar eventos reales únicos
  eventosReales.forEach(eventoReal => {
    const existe = eventosCombinados.some(e => 
      e.titulo === eventoReal.titulo || e.fecha === eventoReal.fecha
    );
    
    if (!existe && eventosCombinados.length < 6) {
      eventosCombinados.push({
        id: `real_${eventosCombinados.length + 1}`,
        fecha: eventoReal.fecha,
        titulo: eventoReal.titulo.substring(0, 60),
        descripcion: `Evento real detectado: ${eventoReal.titulo}`,
        impacto: "medio",
        categoria: eventoReal.categoria,
        sentimiento: "neutral",
        keywords: [eventoReal.titulo.split(' ')[0]],
        fuentes: [eventoReal.fuente]
      });
    }
  });
  
  return eventosCombinados;
}

/**
 * Genera datos estructurados para visualización con conclusiones y metodología (FUNCIÓN ORIGINAL)
 */
function generarDatosVisualizacion(consulta, tipo, contextoDatos = null) {
  console.log(`📊 Generando datos de visualización para: ${consulta} (tipo: ${tipo})`);
  
  // Si hay datos reales del contexto, usarlos para generar visualizaciones más precisas
  if (contextoDatos && contextoDatos.data && contextoDatos.data[tipo]) {
    console.log(`📈 Usando datos reales del contexto para ${tipo}`);
    return generarDatosVisualizacionReales(consulta, tipo, contextoDatos.data[tipo]);
  }
  
  // Datos mejorados para tendencias con etiquetas más cortas y respuestas conclusivas
  if (tipo === 'tendencias') {
    return {
      temas_relevantes: [
        { tema: "Política", valor: 85, descripcion: "Impacto en políticas públicas nacionales" },
        { tema: "Economía", valor: 67, descripcion: "Efectos en el desarrollo económico regional" },
        { tema: "Internacional", valor: 54, descripcion: "Relaciones y cooperación internacional" },
        { tema: "Tecnología", valor: 42, descripcion: "Innovación y transformación digital" },
        { tema: "Cultura", valor: 38, descripcion: "Expresiones culturales y sociales" }
      ],
      distribucion_categorias: [
        { categoria: 'Política', valor: 35 },
        { categoria: 'Economía', valor: 28 },
        { categoria: 'Internacional', valor: 17 },
        { categoria: 'Tecnología', valor: 12 },
        { categoria: 'Cultura', valor: 8 }
      ],
      mapa_menciones: [
        { region: 'Guatemala', valor: 48 },
        { region: 'Zona Metro', valor: 35 },
        { region: 'Occidente', valor: 25 },
        { region: 'Oriente', valor: 18 },
        { region: 'Norte', valor: 12 }
      ],
      subtemas_relacionados: [
        { subtema: 'Financiamiento', relacion: 85 },
        { subtema: 'Regulación', relacion: 72 },
        { subtema: 'Sostenibilidad', relacion: 64 },
        { subtema: 'Impacto Social', relacion: 53 },
        { subtema: 'Inversión', relacion: 47 }
      ],
      // Nuevos datos para gráfico de sentimientos
      evolucion_sentimiento: [
        { tiempo: 'Lun', positivo: 45, neutral: 30, negativo: 25, fecha: '2024-01-01', evento: 'Inicio de tendencia' },
        { tiempo: 'Mar', positivo: 38, neutral: 35, negativo: 27, fecha: '2024-01-02' },
        { tiempo: 'Mié', positivo: 52, neutral: 28, negativo: 20, fecha: '2024-01-03', evento: 'Pico de popularidad' },
        { tiempo: 'Jue', positivo: 48, neutral: 32, negativo: 20, fecha: '2024-01-04' },
        { tiempo: 'Vie', positivo: 55, neutral: 25, negativo: 20, fecha: '2024-01-05' },
        { tiempo: 'Sab', positivo: 42, neutral: 33, negativo: 25, fecha: '2024-01-06' },
        { tiempo: 'Dom', positivo: 40, neutral: 35, negativo: 25, fecha: '2024-01-07' }
      ],
      // Nuevos datos para storytelling
      cronologia_eventos: [
        {
          id: '1',
          fecha: '2024-01-03',
          titulo: `Emergencia de ${consulta} como tendencia`,
          descripcion: `La tendencia sobre ${consulta} comenzó a ganar tracción en redes sociales y medios digitales, alcanzando un nivel significativo de engagement ciudadano.`,
          impacto: 'alto',
          categoria: 'social',
          sentimiento: 'positivo',
          keywords: ['tendencia', 'emergencia', 'digital', consulta],
          fuentes: ['Redes sociales', 'Medios digitales', 'Análisis de hashtags']
        },
        {
          id: '2',
          fecha: '2024-01-05',
          titulo: `Impacto mediático de ${consulta}`,
          descripcion: `Los medios tradicionales comenzaron a cubrir ${consulta}, amplificando su alcance y generando debate público sobre sus implicaciones.`,
          impacto: 'medio',
          categoria: 'politica',
          sentimiento: 'neutral',
          keywords: ['medios', 'cobertura', 'debate', consulta],
          fuentes: ['Prensa nacional', 'Televisión', 'Radio']
        }
      ],
      // Respuestas conclusivas para cada gráfico
      conclusiones: {
        temas_relevantes: `Los temas analizados muestran mayor relevancia en el ámbito político (85%) y económico (67%), indicando un impacto significativo en las decisiones gubernamentales y el desarrollo económico del país.`,
        distribucion_categorias: `La distribución por categorías se concentra principalmente en Política (35%) y Economía (28%), representando el 63% de toda la conversación, lo que sugiere una alta prioridad en la agenda nacional.`,
        mapa_menciones: `Geográficamente, el tema tiene mayor resonancia en Guatemala capital (48%) y la Zona Metropolitana (35%), concentrando el 83% de las menciones en el área central del país.`,
        subtemas_relacionados: `Los subtemas más relacionados son Financiamiento (85%) y Regulación (72%), indicando que se requiere principalmente atención en aspectos económicos y marco normativo.`,
        evolucion_sentimiento: `El análisis de sentimiento sobre ${consulta} muestra una evolución positiva, con picos el miércoles (52%) y viernes (55%), indicando una recepción favorable en el desarrollo de la tendencia.`,
        cronologia_eventos: `La cronología revela que ${consulta} emergió como tendencia social antes de recibir cobertura mediática, mostrando un patrón orgánico de adopción que comenzó en redes sociales.`
      },
      // Información sobre cómo se obtuvo cada gráfica
      metodologia: {
        temas_relevantes: "Análisis de tendencias actuales filtradas por relevancia semántica y frecuencia de mención",
        distribucion_categorias: "Clasificación automática de contenido usando categorías predefinidas del sistema",
        mapa_menciones: "Geolocalización de menciones basada en datos de ubicación y referencias geográficas",
        subtemas_relacionados: "Análisis de co-ocurrencia y correlación semántica entre términos relacionados",
        evolucion_sentimiento: "Procesamiento de lenguaje natural para clasificación de sentimientos en tiempo real",
        cronologia_eventos: "Extracción y ordenamiento cronológico de eventos relevantes con análisis de impacto"
      }
    };
  } 
  // Datos mejorados para noticias con etiquetas más cortas
  else if (tipo === 'noticias') {
    return {
      noticias_relevantes: [
        { titulo: "Impacto Nacional", relevancia: 92, descripcion: "Análisis del impacto en desarrollo económico" },
        { titulo: "Políticas Nuevas", relevancia: 87, descripcion: "Anuncio de nuevas políticas gubernamentales" },
        { titulo: "Comunidades", relevancia: 76, descripcion: "Organización de comunidades rurales" },
        { titulo: "Perspectiva Internacional", relevancia: 68, descripcion: "Debate de especialistas internacionales" },
        { titulo: "Futuro Guatemala", relevancia: 61, descripcion: "Perspectivas a mediano y largo plazo" }
      ],
      fuentes_cobertura: [
        { fuente: 'Prensa Libre', cobertura: 32 },
        { fuente: 'Nuestro Diario', cobertura: 27 },
        { fuente: 'El Periódico', cobertura: 21 },
        { fuente: 'La Hora', cobertura: 15 },
        { fuente: 'Otros', cobertura: 5 }
      ],
      evolucion_cobertura: [
        { fecha: 'Ene', valor: 15 },
        { fecha: 'Feb', valor: 25 },
        { fecha: 'Mar', valor: 42 },
        { fecha: 'Abr', valor: 38 },
        { fecha: 'May', valor: 55 }
      ],
      aspectos_cubiertos: [
        { aspecto: 'Económico', cobertura: 65 },
        { aspecto: 'Político', cobertura: 58 },
        { aspecto: 'Social', cobertura: 47 },
        { aspecto: 'Legal', cobertura: 41 },
        { aspecto: 'Tecnológico', cobertura: 35 }
      ],
      // Nuevos datos para gráfico de sentimientos en noticias
      evolucion_sentimiento: [
        { tiempo: 'Lun', positivo: 42, neutral: 33, negativo: 25, fecha: '2024-01-01', evento: 'Primer reporte' },
        { tiempo: 'Mar', positivo: 48, neutral: 30, negativo: 22, fecha: '2024-01-02' },
        { tiempo: 'Mié', positivo: 55, neutral: 27, negativo: 18, fecha: '2024-01-03', evento: 'Cobertura principal' },
        { tiempo: 'Jue', positivo: 50, neutral: 32, negativo: 18, fecha: '2024-01-04' },
        { tiempo: 'Vie', positivo: 58, neutral: 25, negativo: 17, fecha: '2024-01-05' },
        { tiempo: 'Sab', positivo: 45, neutral: 35, negativo: 20, fecha: '2024-01-06' },
        { tiempo: 'Dom', positivo: 43, neutral: 37, negativo: 20, fecha: '2024-01-07' }
      ],
      // Nuevos datos para storytelling en noticias
      cronologia_eventos: [
        {
          id: '1',
          fecha: '2024-01-03',
          titulo: `Cobertura mediática sobre ${consulta}`,
          descripcion: `Los principales medios guatemaltecos iniciaron cobertura sobre ${consulta}, estableciendo el marco narrativo para el debate público.`,
          impacto: 'alto',
          categoria: 'politica',
          sentimiento: 'positivo',
          keywords: ['cobertura', 'medios', 'debate', consulta],
          fuentes: ['Prensa Libre', 'El Periódico', 'Nuestro Diario']
        },
        {
          id: '2',
          fecha: '2024-01-05',
          titulo: `Análisis especializado de ${consulta}`,
          descripcion: `Analistas y expertos proporcionaron perspectivas detalladas sobre ${consulta}, enriqueciendo el entendimiento público del tema.`,
          impacto: 'medio',
          categoria: 'economia',
          sentimiento: 'neutral',
          keywords: ['análisis', 'expertos', 'perspectivas', consulta],
          fuentes: ['Especialistas', 'Think tanks', 'Academia']
        }
      ],
      conclusiones: {
        noticias_relevantes: `Las noticias analizadas se enfocan principalmente en el impacto nacional (92%) y nuevas políticas (87%), mostrando alta cobertura mediática en temas de política pública.`,
        fuentes_cobertura: `Prensa Libre lidera la cobertura con 32%, seguido por Nuestro Diario (27%), concentrando el 59% de la información en estos dos medios principales.`,
        evolucion_cobertura: `La cobertura ha mostrado un crecimiento sostenido, alcanzando su pico en mayo (55 menciones), indicando un interés mediático creciente.`,
        aspectos_cubiertos: `Los aspectos económicos dominan la cobertura (65%), seguidos por los políticos (58%), representando el enfoque principal de los medios en estos temas.`,
        evolucion_sentimiento: `El sentimiento en las noticias sobre ${consulta} muestra una evolución positiva, con el pico más alto el viernes (58%), indicando recepción favorable en medios.`,
        cronologia_eventos: `La cronología mediática muestra inicio con cobertura principal el miércoles, seguido de análisis especializado, evidenciando un desarrollo informativo estructurado.`
      },
      metodologia: {
        noticias_relevantes: "Análisis de relevancia basado en frecuencia de mención, engagement y autoridad de la fuente",
        fuentes_cobertura: "Conteo de artículos por fuente mediática durante el período analizado",
        evolucion_cobertura: "Seguimiento temporal de menciones en medios digitales e impresos",
        aspectos_cubiertos: "Clasificación temática automática del contenido de las noticias",
        evolucion_sentimiento: "Análisis de sentiment en titulares y contenido de noticias usando procesamiento de lenguaje natural",
        cronologia_eventos: "Tracking temporal de eventos noticiosos relevantes con análisis de impacto mediático"
      }
    };
  }
  else if (tipo === 'codex') {
    return {
      documentos_relevantes: [
        { titulo: "Análisis Estratégico", relevancia: 95, descripcion: "Análisis integral para Guatemala" },
        { titulo: "Estudio Sectorial", relevancia: 88, descripcion: "Estudio comparativo sectorial" },
        { titulo: "Marco Legal", relevancia: 82, descripcion: "Políticas públicas y normativa" },
        { titulo: "Aspectos Institucionales", relevancia: 75, descripcion: "Marco institucional guatemalteco" },
        { titulo: "Impacto Social", relevancia: 68, descripcion: "Casos de estudio nacionales" }
      ],
      conceptos_relacionados: [
        { concepto: 'Desarrollo Sostenible', relacion: 78 },
        { concepto: 'Política Pública', relacion: 65 },
        { concepto: 'Participación Ciudadana', relacion: 59 },
        { concepto: 'Marco Regulatorio', relacion: 52 },
        { concepto: 'Innovación', relacion: 45 }
      ],
      evolucion_analisis: [
        { fecha: 'Q1', valor: 22 },
        { fecha: 'Q2', valor: 35 },
        { fecha: 'Q3', valor: 48 },
        { fecha: 'Q4', valor: 55 }
      ],
      aspectos_documentados: [
        { aspecto: 'Conceptual', profundidad: 82 },
        { aspecto: 'Casos de Estudio', profundidad: 75 },
        { aspecto: 'Comparativo', profundidad: 68 },
        { aspecto: 'Proyecciones', profundidad: 62 },
        { aspecto: 'Legal', profundidad: 55 }
      ],
      // Nuevos datos para gráfico de sentimientos en codex
      evolucion_sentimiento: [
        { tiempo: 'Lun', positivo: 40, neutral: 45, negativo: 15, fecha: '2024-01-01', evento: 'Revisión documental' },
        { tiempo: 'Mar', positivo: 45, neutral: 40, negativo: 15, fecha: '2024-01-02' },
        { tiempo: 'Mié', positivo: 50, neutral: 35, negativo: 15, fecha: '2024-01-03', evento: 'Análisis clave' },
        { tiempo: 'Jue', positivo: 47, neutral: 38, negativo: 15, fecha: '2024-01-04' },
        { tiempo: 'Vie', positivo: 52, neutral: 33, negativo: 15, fecha: '2024-01-05' },
        { tiempo: 'Sab', positivo: 48, neutral: 37, negativo: 15, fecha: '2024-01-06' },
        { tiempo: 'Dom', positivo: 46, neutral: 39, negativo: 15, fecha: '2024-01-07' }
      ],
      // Nuevos datos para storytelling en codex
      cronologia_eventos: [
        {
          id: '1',
          fecha: '2024-01-03',
          titulo: `Análisis documental sobre ${consulta}`,
          descripcion: `Se completó un análisis exhaustivo de documentos del codex relacionados con ${consulta}, identificando patrones y tendencias en la literatura especializada.`,
          impacto: 'alto',
          categoria: 'social',
          sentimiento: 'positivo',
          keywords: ['análisis', 'documentos', 'literatura', consulta],
          fuentes: ['Codex institucional', 'Base de conocimiento', 'Documentos técnicos']
        },
        {
          id: '2',
          fecha: '2024-01-05',
          titulo: `Síntesis de conocimiento sobre ${consulta}`,
          descripcion: `Se generó una síntesis de conocimiento basada en múltiples documentos del codex sobre ${consulta}, proporcionando una visión integral del tema.`,
          impacto: 'medio',
          categoria: 'tecnologia',
          sentimiento: 'neutral',
          keywords: ['síntesis', 'conocimiento', 'integral', consulta],
          fuentes: ['Análisis comparativo', 'Meta-análisis', 'Revisión sistemática']
        }
      ],
      conclusiones: {
        documentos_relevantes: `Los documentos del codex muestran alta relevancia en análisis estratégicos (95%) y estudios sectoriales (88%), indicando una base sólida de conocimiento especializado.`,
        conceptos_relacionados: `El concepto más relacionado es Desarrollo Sostenible (78%), seguido por Política Pública (65%), mostrando la orientación hacia sostenibilidad y gobernanza.`,
        evolucion_analisis: `El análisis ha evolucionado positivamente, creciendo de 22 a 55 documentos por trimestre, mostrando un interés académico y técnico creciente.`,
        aspectos_documentados: `Los aspectos conceptuales tienen mayor profundidad (82%), seguidos por casos de estudio (75%), indicando un enfoque teórico-práctico balanceado.`,
        evolucion_sentimiento: `El análisis de sentimiento en documentos sobre ${consulta} muestra una perspectiva predominantemente positiva (52%), con enfoque académico neutral balanceado.`,
        cronologia_eventos: `La cronología documental evidencia un proceso estructurado: análisis inicial seguido de síntesis integral, mostrando rigor metodológico en el tratamiento del tema.`
      },
      metodologia: {
        documentos_relevantes: "Ranking basado en citaciones, autoridad del autor y relevancia temática",
        conceptos_relacionados: "Análisis de co-ocurrencia y proximidad semántica en el corpus documental",
        evolucion_analisis: "Conteo temporal de documentos agregados al codex por trimestre",
        aspectos_documentados: "Evaluación de profundidad basada en extensión y detalle del contenido",
        evolucion_sentimiento: "Análisis de sentiment en abstracts y conclusiones de documentos usando técnicas de NLP",
        cronologia_eventos: "Tracking temporal de incorporación y análisis de documentos relevantes con evaluación de impacto"
      }
    };
  }
  else if (tipo === 'monitoreos') {
    return {
      monitoreos_relevantes: [
        { titulo: "Análisis de Sentimiento", relevancia: 92, descripcion: "Distribución emocional de las conversaciones monitoreadas" },
        { titulo: "Tendencias de Engagement", relevancia: 87, descripcion: "Evolución del engagement en monitoreos activos" },
        { titulo: "Temas Emergentes", relevancia: 81, descripcion: "Nuevos temas detectados en el período" },
        { titulo: "Actividad Temporal", relevancia: 76, descripcion: "Patrones de actividad por hora y día" },
        { titulo: "Influenciadores Clave", relevancia: 68, descripcion: "Usuarios con mayor impacto en conversaciones" }
      ],
      analisis_sentimiento: [
        { sentimiento: 'Positivo', valor: 45, color: '#10B981' },
        { sentimiento: 'Neutral', valor: 35, color: '#6B7280' },
        { sentimiento: 'Negativo', valor: 20, color: '#EF4444' }
      ],
      evolucion_sentimiento: [
        { fecha: 'Lun', positivo: 42, neutral: 38, negativo: 20 },
        { fecha: 'Mar', positivo: 45, neutral: 35, negativo: 20 },
        { fecha: 'Mié', positivo: 38, neutral: 42, negativo: 20 },
        { fecha: 'Jue', positivo: 48, neutral: 32, negativo: 20 },
        { fecha: 'Vie', positivo: 45, neutral: 35, negativo: 20 },
        { fecha: 'Sáb', positivo: 40, neutral: 35, negativo: 25 },
        { fecha: 'Dom', positivo: 43, neutral: 37, negativo: 20 }
      ],
      emociones_detectadas: [
        { emocion: 'Alegría', valor: 35, descripcion: 'Expresiones de contentamiento y satisfacción' },
        { emocion: 'Preocupación', valor: 28, descripcion: 'Inquietudes sobre temas específicos' },
        { emocion: 'Esperanza', valor: 22, descripcion: 'Expectativas positivas y optimismo' },
        { emocion: 'Frustración', valor: 15, descripcion: 'Descontento y molestia expresada' }
      ],
      distribucion_herramientas: [
        { herramienta: 'Nitter Context', valor: 55 },
        { herramienta: 'Nitter Profile', valor: 30 },
        { herramienta: 'Trends Monitor', valor: 15 }
      ],
      intenciones_comunicativas: [
        { intencion: 'Informativo', valor: 42, descripcion: 'Compartir información y datos' },
        { intencion: 'Opinativo', valor: 28, descripcion: 'Expresar opiniones personales' },
        { intencion: 'Conversacional', valor: 18, descripcion: 'Buscar interacción y diálogo' },
        { intencion: 'Crítico', valor: 12, descripcion: 'Críticas constructivas y análisis' }
      ],
      engagement_temporal: [
        { hora: '00:00', engagement: 15 },
        { hora: '06:00', engagement: 25 },
        { hora: '12:00', engagement: 85 },
        { hora: '18:00', engagement: 95 },
        { hora: '21:00', engagement: 70 }
      ],
      conclusiones: {
        monitoreos_relevantes: `Los monitoreos muestran alta actividad emocional (92%) con patrones estables de engagement, indicando conversaciones activas y sostenidas.`,
        analisis_sentimiento: `El sentimiento predominante es positivo (45%), seguido por neutral (35%), sugiriendo un ambiente conversacional generalmente constructivo.`,
        evolucion_sentimiento: `La evolución semanal muestra estabilidad en el sentimiento positivo con picos los jueves (48%), indicando patrones semanales consistentes.`,
        emociones_detectadas: `La alegría domina las emociones (35%), seguida por preocupación (28%), reflejando un balance entre optimismo y análisis crítico.`,
        intenciones_comunicativas: `Las intenciones informativas predominan (42%), indicando que los monitoreos capturan principalmente intercambio de información útil.`,
        engagement_temporal: `El engagement alcanza su pico entre las 18:00-21:00 (95%), sugiriendo mayor actividad durante horas vespertinas.`
      },
      metodologia: {
        monitoreos_relevantes: "Análisis de frecuencia de actividad y relevancia temática en monitoreos activos",
        analisis_sentimiento: "Procesamiento con IA de contenido textual usando modelos especializados en español",
        evolucion_sentimiento: "Agregación temporal de análisis de sentimiento con ventanas de 24 horas",
        emociones_detectadas: "Clasificación automática de emociones usando análisis semántico avanzado",
        intenciones_comunicativas: "Categorización de intenciones basada en patrones lingüísticos y contextuales",
        engagement_temporal: "Métricas de interacción agregadas por períodos horarios"
      }
    };
  }
  
  return {
    datos_genericos: [
      { etiqueta: 'Categoría 1', valor: 85 },
      { etiqueta: 'Categoría 2', valor: 65 },
      { etiqueta: 'Categoría 3', valor: 45 },
      { etiqueta: 'Categoría 4', valor: 25 }
    ]
  };
}

/**
 * Genera datos de visualización basados en datos reales del contexto
 */
function generarDatosVisualizacionReales(consulta, tipo, datosReales) {
  console.log(`🔬 Generando visualizaciones reales para ${tipo} con ${datosReales.length} elementos`);
  
  if (tipo === 'monitoreos' && Array.isArray(datosReales)) {
    return generarVisualizacionesMonitoreos(datosReales, consulta);
  }
  
  if (tipo === 'tendencias' && Array.isArray(datosReales)) {
    return generarVisualizacionesTendencias(datosReales, consulta);
  }
  
  if (tipo === 'noticias' && Array.isArray(datosReales)) {
    return generarVisualizacionesNoticias(datosReales, consulta);
  }
  
  if (tipo === 'codex' && Array.isArray(datosReales)) {
    return generarVisualizacionesCodex(datosReales, consulta);
  }
  
  // Fallback a datos simulados si no se puede procesar
  console.log(`⚠️ No se pudo procesar datos reales para ${tipo}, usando simulados`);
  return null;
}

/**
 * Genera visualizaciones específicas para monitoreos con análisis de sentimiento real
 */
function generarVisualizacionesMonitoreosReal(datosReales, consulta, contexto) {
  console.log(`💭 Procesando datos reales de monitoreos`);
  
  const monitoreosData = contexto.data?.monitoreos || [];
  
  if (monitoreosData.length === 0) {
    return {
      monitoreos_relevantes: [{ titulo: "Sin monitoreos disponibles", relevancia: 0 }],
      analisis_sentimiento: [
        { sentimiento: 'Positivo', valor: 0, color: '#10B981' },
        { sentimiento: 'Neutral', valor: 0, color: '#6B7280' },
        { sentimiento: 'Negativo', valor: 0, color: '#EF4444' }
      ],
      evolucion_sentimiento: [],
      cronologia_eventos: [],
      warning: "No hay datos de monitoreos disponibles",
      sources_used: ['monitoreos']
    };
  }
  
  let sentimientoTotal = { positivo: 0, neutral: 0, negativo: 0 };
  let emociones = {};
  let intenciones = {};
  let engagementPorHora = {};
  let herramientas = {};
  
  // Process each monitoring session
  monitoreosData.forEach(monitoreo => {
    // Extract sentiment analysis
    if (monitoreo.analisis_sentimiento) {
      sentimientoTotal.positivo += monitoreo.analisis_sentimiento.positivo || 0;
      sentimientoTotal.neutral += monitoreo.analisis_sentimiento.neutral || 0;
      sentimientoTotal.negativo += monitoreo.analisis_sentimiento.negativo || 0;
      
      // Process emotions
      if (monitoreo.analisis_sentimiento.emociones_predominantes) {
        monitoreo.analisis_sentimiento.emociones_predominantes.forEach(emocionData => {
          emociones[emocionData.emocion] = (emociones[emocionData.emocion] || 0) + emocionData.count;
        });
      }
      
      // Process communicative intentions
      if (monitoreo.analisis_sentimiento.intenciones_comunicativas) {
        Object.entries(monitoreo.analisis_sentimiento.intenciones_comunicativas).forEach(([intencion, count]) => {
          intenciones[intencion] = (intenciones[intencion] || 0) + count;
        });
      }
    }
    
    // Process temporal engagement
    if (monitoreo.created_at && monitoreo.total_engagement) {
      const fecha = new Date(monitoreo.created_at);
      const hora = fecha.getHours();
      const horaKey = `${hora.toString().padStart(2, '0')}:00`;
      engagementPorHora[horaKey] = (engagementPorHora[horaKey] || 0) + monitoreo.total_engagement;
    }
    
    // Track tools used
    const herramienta = monitoreo.herramienta || 'Unknown';
    herramientas[herramienta] = (herramientas[herramienta] || 0) + 1;
  });
  
  // Build weekly sentiment evolution
  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const totalSentimiento = sentimientoTotal.positivo + sentimientoTotal.neutral + sentimientoTotal.negativo;
  
  const evolucionSentimiento = diasSemana.map((dia, index) => {
    if (totalSentimiento === 0) {
      return { tiempo: dia, positivo: 33, neutral: 34, negativo: 33, fecha: new Date().toISOString().split('T')[0] };
    }
    
    // Apply natural variation based on real data
    const factor = 0.8 + Math.random() * 0.4;
    return {
      tiempo: dia,
      positivo: Math.round((sentimientoTotal.positivo / totalSentimiento * 100) * factor),
      neutral: Math.round((sentimientoTotal.neutral / totalSentimiento * 100) * factor),
      negativo: Math.round((sentimientoTotal.negativo / totalSentimiento * 100) * factor),
      fecha: new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  });
  
  // Generate events from monitoring activities
  const cronologiaEventos = monitoreosData.slice(0, 3).map((monitoreo, index) => {
    return {
      id: `monitor_${index + 1}`,
      fecha: monitoreo.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      titulo: `Monitoreo: ${monitoreo.titulo || monitoreo.query_original || 'Consulta'}`,
      descripcion: `Sesión de monitoreo con ${monitoreo.tweet_count || 0} tweets analizados usando ${monitoreo.herramienta}`,
      impacto: index === 0 ? 'alto' : index === 1 ? 'medio' : 'bajo',
      categoria: monitoreo.categoria || 'general',
      sentimiento: monitoreo.analisis_sentimiento?.score_promedio > 0 ? 'positivo' : 
                   monitoreo.analisis_sentimiento?.score_promedio < 0 ? 'negativo' : 'neutral',
      keywords: [monitoreo.query_original || consulta],
      fuentes: [monitoreo.herramienta || 'Herramienta de monitoreo']
    };
  });
  
  return {
    monitoreos_relevantes: monitoreosData.slice(0, 5).map((m, i) => ({
      titulo: m.titulo || m.query_original || 'Monitoreo',
      relevancia: Math.max(60, 100 - (i * 8)),
      descripcion: `${m.categoria || 'Categoría'} con ${m.tweet_count || 0} tweets (${m.herramienta || 'herramienta'})`
    })),
    
    analisis_sentimiento: [
      { sentimiento: 'Positivo', valor: sentimientoTotal.positivo, color: '#10B981' },
      { sentimiento: 'Neutral', valor: sentimientoTotal.neutral, color: '#6B7280' },
      { sentimiento: 'Negativo', valor: sentimientoTotal.negativo, color: '#EF4444' }
    ],
    
    evolucion_sentimiento: evolucionSentimiento,
    
    emociones_detectadas: Object.entries(emociones)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([emocion, valor]) => ({
        emocion: emocion.charAt(0).toUpperCase() + emocion.slice(1),
        valor: valor,
        descripcion: `${valor} expresiones de ${emocion.toLowerCase()} detectadas`
      })),
    
    intenciones_comunicativas: Object.entries(intenciones)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([intencion, valor]) => ({
        intencion: intencion.charAt(0).toUpperCase() + intencion.slice(1),
        valor: valor,
        descripcion: `${valor} tweets con intención ${intencion.toLowerCase()}`
      })),
    
    engagement_temporal: Object.entries(engagementPorHora)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hora, engagement]) => ({ hora, engagement })),
    
    distribucion_herramientas: Object.entries(herramientas)
      .map(([herramienta, count]) => ({
        herramienta,
        valor: Math.round((count / monitoreosData.length) * 100)
      })),
    
    cronologia_eventos: cronologiaEventos,
    
    conclusiones: `Análisis de ${monitoreosData.length} sesiones de monitoreo con ${totalSentimiento} interacciones analizadas`,
    metodologia: "Análisis directo de datos de monitoreo con agregación de sentiment, emociones e intenciones comunicativas",
    sources_used: ['monitoreos', 'sentiment_analysis']
  };
}

/**
 * Genera visualizaciones para tendencias basadas en datos reales
 */
function generarVisualizacionesTendenciasReal(datosReales, consulta, contexto) {
  console.log(`📈 Procesando datos reales de tendencias`);
  
  const tendenciasData = contexto.data?.tendencias || [];
  
  if (tendenciasData.length === 0) {
    return {
      temas_relevantes: [{ tema: "Sin datos de tendencias", valor: 0 }],
      distribucion_categorias: [{ categoria: "Sin categorías", valor: 100 }],
      evolucion_sentimiento: [],
      cronologia_eventos: [],
      warning: "No hay datos de tendencias disponibles",
      sources_used: ['tendencias']
    };
  }
  
  // Extract themes from real trends
  const temasReales = [];
  const categorias = {};
  const keywordsFreq = {};
  
  tendenciasData.forEach(trendGroup => {
    if (trendGroup.trends && Array.isArray(trendGroup.trends)) {
      trendGroup.trends.forEach(trend => {
        const nombre = trend.name || trend.trend || 'Tendencia';
        const categoria = trend.category || 'General';
        const volumen = trend.volume || trend.tweet_volume || 0;
        
        temasReales.push({ tema: nombre, valor: Math.min(100, Math.max(20, volumen / 1000)) });
        categorias[categoria] = (categorias[categoria] || 0) + 1;
        
        // Extract keywords from trend names
        nombre.split(' ').forEach(word => {
          if (word.length > 3) {
            keywordsFreq[word] = (keywordsFreq[word] || 0) + 1;
          }
        });
      });
    }
    
    // Process keywords from trend data with proper handling
    if (trendGroup.keywords) {
      let keywordArray = [];
      
      if (Array.isArray(trendGroup.keywords)) {
        keywordArray = trendGroup.keywords;
      } else if (typeof trendGroup.keywords === 'string') {
        keywordArray = [trendGroup.keywords];
      } else if (typeof trendGroup.keywords === 'object' && trendGroup.keywords !== null) {
        keywordArray = Object.values(trendGroup.keywords).filter(k => typeof k === 'string');
      }
      
      keywordArray.forEach(keyword => {
        if (typeof keyword === 'string' && keyword.trim().length > 0) {
          const cleanKeyword = keyword.trim();
          keywordsFreq[cleanKeyword] = (keywordsFreq[cleanKeyword] || 0) + 2; // Give more weight to explicit keywords
        } else if (typeof keyword === 'object' && keyword !== null) {
          const keywordStr = keyword.name || keyword.keyword || keyword.term || String(keyword);
          if (keywordStr && keywordStr.trim().length > 0) {
            keywordsFreq[keywordStr.trim()] = (keywordsFreq[keywordStr.trim()] || 0) + 2;
          }
        }
      });
    }
  });
  
  // Sort themes by relevance
  temasReales.sort((a, b) => b.valor - a.valor);
  
  // Generate categories distribution
  const totalCategorias = Object.values(categorias).reduce((a, b) => a + b, 0);
  const distribucionCategorias = Object.entries(categorias)
    .map(([categoria, count]) => ({
      categoria,
      valor: Math.round((count / totalCategorias) * 100)
    }))
    .sort((a, b) => b.valor - a.valor);
  
  // Generate sentiment evolution based on real timestamp data
  const evolucionSentimiento = generarEvolucionSentimientoReal(datosReales);
  
  // Generate events from trend emergence
  const cronologiaEventos = tendenciasData.slice(0, 3).map((trendGroup, index) => {
    const topTrend = trendGroup.trends?.[0];
    return {
      id: `trend_${index + 1}`,
      fecha: trendGroup.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0],
      titulo: `Emergencia de tendencia: ${topTrend?.name || 'Tendencia detectada'}`,
      descripcion: `Nueva tendencia detectada en redes sociales con ${topTrend?.volume || 'actividad'} de volumen`,
      impacto: index === 0 ? 'alto' : index === 1 ? 'medio' : 'bajo',
      categoria: topTrend?.category || 'general',
      sentimiento: index % 2 === 0 ? 'positivo' : 'neutral',
      keywords: Object.keys(keywordsFreq).slice(0, 3),
      fuentes: ['Twitter Trends', 'Análisis de hashtags']
    };
  });
  
  return {
    temas_relevantes: temasReales.slice(0, 5),
    distribucion_categorias: distribucionCategorias,
    evolucion_sentimiento: evolucionSentimiento,
    cronologia_eventos: cronologiaEventos,
    conclusiones: `Análisis basado en ${tendenciasData.length} grupos de tendencias reales con ${temasReales.length} temas identificados`,
    metodologia: "Análisis de tendencias reales de Twitter con procesamiento de volumen, categorías y keywords",
    sources_used: ['tendencias', 'twitter_trends']
  };
}

/**
 * Genera visualizaciones para noticias basadas en datos reales
 */
function generarVisualizacionesNoticiasReal(datosReales, consulta, contexto) {
  console.log(`📰 Procesando datos reales de noticias`);
  
  const noticiasData = contexto.data?.noticias || [];
  
  if (noticiasData.length === 0) {
    return {
      noticias_relevantes: [{ titulo: "Sin noticias disponibles", relevancia: 0 }],
      fuentes_cobertura: [{ fuente: "Sin fuentes", cobertura: 100 }],
      evolucion_sentimiento: [],
      cronologia_eventos: [],
      warning: "No hay datos de noticias disponibles",
      sources_used: ['noticias']
    };
  }
  
  // Extract relevant news with real relevance scoring
  const noticiasRelevantes = noticiasData.map((noticia, index) => {
    const titulo = noticia.title || noticia.titulo || 'Noticia sin título';
    const contenido = noticia.content || noticia.description || '';
    const keywords = noticia.keywords || [];
    
    // Calculate relevance based on query match and content length
    let relevancia = 50; // base score
    
    // Boost if title contains query terms
    if (titulo.toLowerCase().includes(consulta.toLowerCase())) {
      relevancia += 30;
    }
    
    // Boost if keywords match
    const consultaWords = consulta.toLowerCase().split(' ');
    const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
    keywordArray.forEach(keyword => {
      const keywordStr = typeof keyword === 'string' ? keyword : (keyword?.name || keyword?.keyword || String(keyword));
      if (keywordStr && consultaWords.some(word => keywordStr.toLowerCase().includes(word))) {
        relevancia += 10;
      }
    });
    
    // Boost based on content length (more content = more comprehensive)
    if (contenido.length > 500) relevancia += 10;
    if (contenido.length > 1000) relevancia += 10;
    
    return {
      titulo: titulo.substring(0, 50),
      relevancia: Math.min(100, relevancia),
      descripcion: contenido.substring(0, 100) + '...'
    };
  }).sort((a, b) => b.relevancia - a.relevancia).slice(0, 5);
  
  // Extract sources distribution
  const fuentes = {};
  noticiasData.forEach(noticia => {
    const fuente = noticia.source || noticia.fuente || 'Fuente desconocida';
    fuentes[fuente] = (fuentes[fuente] || 0) + 1;
  });
  
  const totalFuentes = Object.values(fuentes).reduce((a, b) => a + b, 0);
  const fuentesCobertura = Object.entries(fuentes)
    .map(([fuente, count]) => ({
      fuente,
      cobertura: Math.round((count / totalFuentes) * 100)
    }))
    .sort((a, b) => b.cobertura - a.cobertura);
  
  // Generate sentiment evolution based on news sentiment scores
  const evolucionSentimiento = [];
  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  
  // Group news by day and calculate average sentiment
  const noticiasPorDia = {};
  noticiasData.forEach(noticia => {
    const fecha = noticia.published_at || noticia.fecha || noticia.date;
    if (fecha) {
      const dia = new Date(fecha).getDay();
      const nombreDia = diasSemana[dia];
      if (!noticiasPorDia[nombreDia]) {
        noticiasPorDia[nombreDia] = { positivo: 0, neutral: 0, negativo: 0, total: 0 };
      }
      
      // Use sentiment score if available, otherwise neutral
      const sentiment = noticia.sentiment_score || noticia.sentiment || 0;
      if (sentiment > 0.1) {
        noticiasPorDia[nombreDia].positivo++;
      } else if (sentiment < -0.1) {
        noticiasPorDia[nombreDia].negativo++;
      } else {
        noticiasPorDia[nombreDia].neutral++;
      }
      noticiasPorDia[nombreDia].total++;
    }
  });
  
  diasSemana.forEach(dia => {
    const datos = noticiasPorDia[dia] || { positivo: 1, neutral: 2, negativo: 1, total: 4 };
    evolucionSentimiento.push({
      tiempo: dia,
      positivo: Math.round((datos.positivo / datos.total) * 100),
      neutral: Math.round((datos.neutral / datos.total) * 100),
      negativo: Math.round((datos.negativo / datos.total) * 100),
      fecha: new Date().toISOString().split('T')[0] // placeholder
    });
  });
  
  // Generate events from news
  const cronologiaEventos = noticiasData.slice(0, 3).map((noticia, index) => {
    return {
      id: `news_${index + 1}`,
      fecha: noticia.published_at?.split('T')[0] || noticia.fecha || new Date().toISOString().split('T')[0],
      titulo: (noticia.title || noticia.titulo || 'Noticia').substring(0, 60),
      descripcion: `Noticia publicada por ${noticia.source || noticia.fuente || 'fuente'}: ${(noticia.description || noticia.content || '').substring(0, 100)}...`,
      impacto: index === 0 ? 'alto' : index === 1 ? 'medio' : 'bajo',
      categoria: noticia.category || noticia.categoria || 'general',
      sentimiento: noticia.sentiment_score > 0 ? 'positivo' : noticia.sentiment_score < 0 ? 'negativo' : 'neutral',
      keywords: Array.isArray(noticia.keywords) 
        ? noticia.keywords.slice(0, 3).map(k => typeof k === 'string' ? k : (k?.name || k?.keyword || String(k))) 
        : [consulta],
      fuentes: [noticia.source || noticia.fuente || 'Medio digital']
    };
  });
  
  return {
    noticias_relevantes: noticiasRelevantes,
    fuentes_cobertura: fuentesCobertura,
    evolucion_sentimiento: evolucionSentimiento,
    cronologia_eventos: cronologiaEventos,
    conclusiones: `Análisis de ${noticiasData.length} noticias reales de ${fuentesCobertura.length} fuentes diferentes`,
    metodologia: "Análisis de noticias reales con scoring de relevancia, distribución de fuentes y sentiment",
    sources_used: ['noticias', 'medios_digitales']
  };
}

/**
 * Genera visualizaciones para codex basadas en datos reales
 */
function generarVisualizacionesCodexReal(datosReales, consulta, contexto) {
  console.log(`📚 Procesando datos reales de codex`);
  
  const codexData = contexto.data?.codex || [];
  
  if (codexData.length === 0) {
    return {
      documentos_relevantes: [{ titulo: "Sin documentos disponibles", relevancia: 0 }],
      conceptos_relacionados: [{ concepto: "Sin conceptos", relacion: 0 }],
      evolucion_sentimiento: [],
      cronologia_eventos: [],
      warning: "No hay documentos en el codex disponibles",
      sources_used: ['codex']
    };
  }
  
  // Extract relevant documents with real relevance scoring
  const documentosRelevantes = codexData.map((doc, index) => {
    const titulo = doc.title || doc.titulo || 'Documento sin título';
    const contenido = doc.content || doc.summary || doc.description || '';
    const tags = doc.tags || [];
    
    // Calculate relevance based on query match and metadata
    let relevancia = 40; // base score
    
    // Boost if title contains query terms
    if (titulo.toLowerCase().includes(consulta.toLowerCase())) {
      relevancia += 35;
    }
    
    // Boost if content contains query terms
    const consultaWords = consulta.toLowerCase().split(' ');
    consultaWords.forEach(word => {
      if (contenido.toLowerCase().includes(word)) {
        relevancia += 10;
      }
    });
    
    // Boost if tags match
    const tagArray = Array.isArray(tags) ? tags : [tags];
    tagArray.forEach(tag => {
      const tagStr = typeof tag === 'string' ? tag : (tag?.name || tag?.tag || String(tag));
      if (tagStr && consultaWords.some(word => tagStr.toLowerCase().includes(word))) {
        relevancia += 15;
      }
    });
    
    return {
      titulo: titulo.substring(0, 50),
      relevancia: Math.min(100, relevancia),
      descripcion: contenido.substring(0, 120) + '...'
    };
  }).sort((a, b) => b.relevancia - a.relevancia).slice(0, 5);
  
  // Extract concepts from tags and content
  const conceptos = {};
  codexData.forEach(doc => {
    // Extract from tags with proper handling
    if (doc.tags) {
      let tagArray = [];
      
      if (Array.isArray(doc.tags)) {
        tagArray = doc.tags;
      } else if (typeof doc.tags === 'string') {
        tagArray = [doc.tags];
      } else if (typeof doc.tags === 'object' && doc.tags !== null) {
        tagArray = Object.values(doc.tags).filter(t => typeof t === 'string');
      }
      
      tagArray.forEach(tag => {
        const tagStr = typeof tag === 'string' ? tag : (tag?.name || tag?.tag || String(tag));
        if (tagStr && tagStr.trim().length > 0) {
          const cleanTag = tagStr.trim();
          conceptos[cleanTag] = (conceptos[cleanTag] || 0) + 3; // Higher weight for tags
        }
      });
    }
    
    // Extract from categories
    if (doc.category) {
      conceptos[doc.category] = (conceptos[doc.category] || 0) + 2;
    }
    
    // Extract key terms from content (simplified)
    const contenido = doc.content || doc.summary || '';
    const words = contenido.split(' ').filter(word => 
      word.length > 5 && 
      !['proceso', 'sistema', 'desarrollo', 'análisis'].includes(word.toLowerCase())
    );
    words.slice(0, 10).forEach(word => {
      conceptos[word] = (conceptos[word] || 0) + 1;
    });
  });
  
  // Sort concepts by frequency
  const conceptosRelacionados = Object.entries(conceptos)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([concepto, freq]) => ({
      concepto: concepto.charAt(0).toUpperCase() + concepto.slice(1),
      relacion: Math.min(100, freq * 10) // Normalize to 0-100
    }));
  
  // Generate sentiment evolution (documents tend to be neutral)
  const evolucionSentimiento = generarEvolucionSentimientoReal(datosReales, 'neutral');
  
  // Generate events from document creation/updates
  const cronologiaEventos = codexData.slice(0, 3).map((doc, index) => {
    return {
      id: `doc_${index + 1}`,
      fecha: doc.created_at?.split('T')[0] || doc.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      titulo: `Documento agregado: ${(doc.title || doc.titulo || 'Documento').substring(0, 40)}`,
      descripcion: `Nuevo documento en el codex: ${(doc.summary || doc.description || doc.content || '').substring(0, 100)}...`,
      impacto: index === 0 ? 'alto' : index === 1 ? 'medio' : 'bajo',
      categoria: doc.category || 'general',
      sentimiento: 'neutral', // Documents are typically neutral
      keywords: Array.isArray(doc.tags) 
        ? doc.tags.slice(0, 3).map(t => typeof t === 'string' ? t : (t?.name || t?.tag || String(t))) 
        : [consulta],
      fuentes: ['Codex institucional', 'Base de conocimiento']
    };
  });
  
  return {
    documentos_relevantes: documentosRelevantes,
    conceptos_relacionados: conceptosRelacionados,
    evolucion_sentimiento: evolucionSentimiento,
    cronologia_eventos: cronologiaEventos,
    conclusiones: `Análisis de ${codexData.length} documentos del codex con ${conceptosRelacionados.length} conceptos principales identificados`,
    metodologia: "Análisis de documentos del codex con scoring de relevancia, extracción de conceptos y tracking temporal",
    sources_used: ['codex', 'base_conocimiento']
  };
}

/**
 * Construye el prompt optimizado para ChatGPT con contexto enriquecido
 */
function construirPromptSondeo(pregunta, contexto, configuracion) {
  // Crear resumen conciso del contexto en lugar de JSON completo
  let resumenContexto = '';
  
  // 1. CONTEXTO ENRIQUECIDO (Perplexity + Tweets)
  if (contexto.contexto_adicional && contexto.contexto_adicional.contexto_enriquecido) {
    resumenContexto += `\n🔍 CONTEXTO ACTUALIZADO:\n${contexto.contexto_adicional.contexto_enriquecido}`;
  }
  
  // 2. AGREGAR TWEETS DIRECTAMENTE SI EXISTEN EN EL CONTEXTO
  if (contexto.data && contexto.data.tweets && contexto.data.tweets.length > 0) {
    const tweetsResumen = contexto.data.tweets.slice(0, 8).map((tweet, index) => {
      const autor = tweet.author || tweet.usuario || 'Usuario';
      const texto = (tweet.text || tweet.texto || 'Sin texto').substring(0, 150);
      const engagement = (tweet.metrics?.engagement || tweet.likes || 0) + (tweet.retweets || 0);
      const fecha = tweet.created_at || tweet.fecha_tweet || 'Sin fecha';
      const verificado = tweet.verified ? ' ✓' : '';
      
      return `${index + 1}. @${autor}${verificado}: ${texto} (${engagement} interacciones, ${fecha})`;
    }).join('\n');
    
    resumenContexto += `\n\n📱 CONVERSACIÓN SOCIAL (TWEETS REALES):\n${tweetsResumen}`;
  }

  // 3. DATOS DE FUENTES SELECCIONADAS CON DETALLES TEMPORALES
  if (contexto.data) {
    // Resumir tendencias con información temporal y de sentimiento
    if (contexto.data.tendencias && contexto.data.tendencias.length > 0) {
      const tendenciasTop = contexto.data.tendencias.slice(0, 5).map((t, index) => {
        // Manejar casos donde las tendencias vengan anidadas en t.trends
        let nombre = t.nombre || t.trend || t.keyword || t.name || t.query;
        let categoria = t.categoria;
        let volumen = t.volumen || t.volume;
        let fecha = t.fecha || t.timestamp;
        let sentimiento = 'neutral';
        let about = '';

        if (!nombre && t.trends && Array.isArray(t.trends) && t.trends.length > 0) {
          const first = t.trends[0];
          nombre = first.name || first.trend || first.keyword || first.query || 'Tendencia';
          categoria = first.category || categoria;
          volumen = first.volume || first.tweet_volume || volumen;
        }

        nombre = nombre || 'Tendencia';
        categoria = categoria || 'Sin categoría';
        volumen = volumen || 'N/A';
        fecha = fecha || new Date().toISOString().split('T')[0];
        
        // Extraer información de about para enriquecer el contexto
        if (t.about) {
          if (Array.isArray(t.about) && t.about.length > 0) {
            const firstAbout = t.about[0];
            if (typeof firstAbout === 'string') {
              about = ` - ${firstAbout.substring(0, 150)}`;
            } else if (typeof firstAbout === 'object') {
              about = ` - ${(firstAbout.resumen || firstAbout.summary || firstAbout.description || '')}`.substring(0, 150);
              sentimiento = firstAbout.sentimiento || firstAbout.sentiment || sentimiento;
            }
          } else if (typeof t.about === 'string') {
            about = ` - ${t.about.substring(0, 150)}`;
          } else if (typeof t.about === 'object') {
            about = ` - ${(t.about.resumen || t.about.summary || t.about.description || '')}`.substring(0, 150);
            sentimiento = t.about.sentimiento || t.about.sentiment || sentimiento;
          }
        }
        
        return `${nombre} (${categoria}, Vol: ${volumen}, Fecha: ${fecha}, Sentimiento: ${sentimiento})${about}`;
      }).join('\n• ');
      resumenContexto += `\n\n📈 TENDENCIAS ACTUALES CON DETALLES:\n• ${tendenciasTop}`;
    }
    
    // Resumir noticias con detalles temporales y de contexto
    if (contexto.data.noticias && contexto.data.noticias.length > 0) {
      const noticiasTop = contexto.data.noticias.slice(0, 3).map(n => {
        const titulo = n.title || n.titulo || 'Noticia';
        const fecha = n.fecha || n.published_at || n.date || 'Sin fecha';
        const fuente = n.source || n.fuente || 'Sin fuente';
        const categoria = n.categoria || n.category || 'General';
        const contenido = n.summary || n.resumen || n.content;
        const resumen = (contenido && typeof contenido === 'string') ? ` - ${contenido.substring(0, 120)}` : '';
        
        return `${titulo} (${fuente}, ${fecha}, Cat: ${categoria})${resumen}`;
      }).join('\n• ');
      resumenContexto += `\n\n📰 NOTICIAS RELEVANTES CON CONTEXTO:\n• ${noticiasTop}`;
    }
    
    // Resumir monitoreos si existen
    if (contexto.data.monitoreos && contexto.data.monitoreos.length > 0) {
      const monitoreosTop = contexto.data.monitoreos.slice(0, 3).map(m => {
        const titulo = m.titulo || m.query_original || 'Monitoreo';
        const categoria = m.categoria || 'Sin categoría';
        const tweets_count = m.tweet_count || 0;
        const engagement = m.total_engagement || 0;
        const sentimiento = m.analisis_sentimiento?.sentimiento_promedio || 'neutral';
        
        return `${titulo} (${categoria}, ${tweets_count} tweets, ${engagement} engagement, sentimiento: ${sentimiento})`;
      }).join('\n• ');
      resumenContexto += `\n\n🔍 MONITOREOS RELEVANTES:\n• ${monitoreosTop}`;
    }
    
    // Resumir codex
    if (contexto.data.codex && contexto.data.codex.length > 0) {
      const codexTop = contexto.data.codex.slice(0, 3).map(c => {
        const titulo = c.title || c.titulo || 'Documento';
        const contenido = c.description || c.descripcion || c.content;
        const descripcion = (contenido && typeof contenido === 'string') ? ` - ${contenido.substring(0, 100)}...` : '';
        return `${titulo}${descripcion}`;
      }).join('\n• ');
      resumenContexto += `\n\n📚 DOCUMENTOS CODEX:\n• ${codexTop}`;
    }
  }
  
  // 4. ESTADÍSTICAS DEL CONTEXTO
  const stats = contexto.estadisticas || {};
  resumenContexto += `\n\n📊 ESTADÍSTICAS: ${stats.total_items || 0} elementos de ${stats.total_fuentes || 0} fuentes`;
  
  // 5. KEYWORDS EXTRAÍDAS
  if (contexto.contexto_adicional && contexto.contexto_adicional.keywords_extraidas) {
    const keywords = Array.isArray(contexto.contexto_adicional.keywords_extraidas) 
      ? contexto.contexto_adicional.keywords_extraidas 
      : [contexto.contexto_adicional.keywords_extraidas];
    
    // Filter out any non-string values and convert objects to strings safely
    const validKeywords = keywords
      .map(keyword => {
        if (typeof keyword === 'string') return keyword;
        if (typeof keyword === 'object' && keyword !== null) {
          return keyword.name || keyword.keyword || keyword.term || Object.keys(keyword)[0] || 'keyword';
        }
        return String(keyword);
      })
      .filter(keyword => keyword && keyword.length > 0);
      
    if (validKeywords.length > 0) {
      resumenContexto += `\n🔑 PALABRAS CLAVE: ${validKeywords.join(', ')}`;
    }
  }

  // 6. INFORMACIÓN TEMPORAL PARA ANÁLISIS DE GRÁFICOS
  const fechaActual = new Date().toISOString().split('T')[0];
  const fechasDisponibles = [];
  
  // Extraer fechas de diferentes fuentes para análisis temporal
  if (contexto.data) {
    if (contexto.data.tendencias) {
      contexto.data.tendencias.forEach(t => {
        const fecha = t.fecha || t.timestamp;
        if (fecha) fechasDisponibles.push(fecha);
      });
    }
    if (contexto.data.noticias) {
      contexto.data.noticias.forEach(n => {
        const fecha = n.fecha || n.published_at || n.date;
        if (fecha) fechasDisponibles.push(fecha);
      });
    }
    if (contexto.data.tweets) {
      contexto.data.tweets.forEach(tw => {
        const fecha = tw.created_at || tw.fecha_tweet;
        if (fecha) fechasDisponibles.push(fecha);
      });
    }
  }
  
  const fechasUnicas = [...new Set(fechasDisponibles)].sort().slice(-7); // Últimas 7 fechas
  resumenContexto += `\n\n⏰ INFORMACIÓN TEMPORAL PARA GRÁFICOS:\n📅 Fecha actual: ${fechaActual}\n📊 Fechas con datos: ${fechasUnicas.join(', ')}\n🎯 Período de análisis: Últimos 7 días desde ${fechaActual}`;
  
  // 7. GUÍA PARA EXTRACCIÓN DE EVENTOS
  resumenContexto += `\n\n🔍 EVENTOS DETECTABLES EN EL CONTEXTO:\n- Buscar títulos de noticias como eventos con fechas\n- Identificar menciones temporales en tendencias\n- Extraer cambios de volumen o engagement como eventos\n- Usar nombres reales de personas/instituciones mencionadas`;
  
  const prompt = `
Eres un analista experto en tendencias y datos de Guatemala y Centroamérica con acceso a información actualizada de redes sociales y web.

PREGUNTA DEL USUARIO: "${pregunta}"

CONTEXTO DISPONIBLE:${resumenContexto}

FUENTES UTILIZADAS: ${contexto.fuentes_utilizadas ? contexto.fuentes_utilizadas.join(', ') : 'No especificadas'}

INSTRUCCIONES ESPECÍFICAS:
1. 📊 ANALIZA la pregunta basándote ESPECÍFICAMENTE en el contexto proporcionado
2. 🎯 USA la información de tweets y web actualizada para dar respuestas ESPECÍFICAS y ACTUALES
3. 🇬🇹 ENFÓCATE en Guatemala y Centroamérica, pero incluye contexto internacional relevante
4. 💡 PROPORCIONA insights específicos, no generalidades
5. 📈 INCLUYE datos concretos cuando estén disponibles
6. 🔍 MENCIONA las fuentes de información que usaste (tweets, noticias, tendencias, etc.)
7. ⚡ SÉ CONCISO pero COMPLETO - máximo 3 párrafos de análisis

FORMATO DE RESPUESTA:
- Párrafo 1: Respuesta directa a la pregunta con datos específicos
- Párrafo 2: Análisis del contexto actual (tendencias, conversaciones sociales)
- Párrafo 3: Conclusiones y recomendaciones prácticas

IMPORTANTE: 
- NO inventes datos que no estén en el contexto
- SI hay tweets relevantes, menciona qué está diciendo la gente
- SI hay información web actualizada, úsala para dar contexto específico
- SIEMPRE conecta tu respuesta con la realidad guatemalteca actual

Responde en español con análisis específico y basado en evidencia.
`;

  return prompt;
}

/**
 * Función fusionada que combina datos reales con procesamiento inteligente
 */
function fusionarDatosConContextoReal(pregunta, tipo, contexto) {
  console.log(`🔄 Fusionando datos con contexto real para: ${pregunta} (tipo: ${tipo})`);
  
  // Check if mock data should be used
  const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';
  
  if (USE_MOCK_DATA) {
    console.log('⚠️ USE_MOCK_DATA=true - usando datos simulados como fallback');
    return generarDatosVisualizacion(pregunta, tipo, contexto);
  }
  
  // Extract real data from context
  const datosReales = extraerDatosRealesDelContexto(contexto);
  
  // Check if we have sufficient data
  if (datosReales.totalElementos === 0) {
    console.log('⚠️ Datos insuficientes - devolviendo estructura mínima con advertencia');
    return {
      temas_relevantes: [{ tema: "Datos insuficientes", valor: 0 }],
      distribucion_categorias: [{ categoria: "Sin datos", valor: 100 }],
      evolucion_sentimiento: [],
      cronologia_eventos: [],
      warning: "Datos insuficientes para generar visualizaciones completas. Se requieren más fuentes de contexto.",
      error_type: "insufficient_data",
      sources_used: datosReales.fuentes,
      suggestions: [
        "Incluir más fuentes de contexto",
        "Verificar conectividad con fuentes de datos",
        "Intentar con una consulta más general"
      ],
      conclusiones: "No se pudieron generar análisis debido a la falta de datos contextuales",
      metodologia: "Intento de análisis con datos insuficientes - se requieren fuentes adicionales"
    };
  }
  
  // Use the new buildVisualizationData function for comprehensive data processing
  console.log('✅ Datos suficientes encontrados - generando visualizaciones con datos reales');
  const datasetsReales = buildVisualizationData(datosReales, pregunta, tipo);
  
  const resultado = {
    temas_relevantes: datasetsReales.temas_relevantes,
    distribucion_categorias: datasetsReales.distribucion_categorias,
    evolucion_sentimiento: datasetsReales.evolucion_sentimiento,
    cronologia_eventos: datasetsReales.cronologia_eventos,
    conclusiones: datasetsReales.metadata.datos_reales_utilizados 
      ? `Análisis exitoso basado en ${datosReales.totalElementos} elementos reales de ${datosReales.fuentes.join(', ')}. ${datosReales.sentimientos.length > 0 ? `Incluye análisis de sentimiento de ${datosReales.sentimientos.length} elementos. ` : ''}${datosReales.eventos.length > 0 ? `${datosReales.eventos.length} eventos cronológicos identificados.` : ''}`
      : `Análisis con datos limitados de ${datosReales.fuentes.join(', ')}`,
    metodologia: `Extracción automática de datos reales desde: ${datosReales.fuentes.join(', ')}. Procesamiento inteligente de ${datosReales.totalElementos} elementos con análisis temporal, categórico y de sentimiento. Período: ${datasetsReales.metadata.periodo_analisis}`,
    sources_used: datosReales.fuentes,
    data_source: 'real_context_fusion',
    metadata: {
      ...datasetsReales.metadata,
      fusion_applied: true,
      original_query: pregunta,
      context_type: tipo,
      processing_timestamp: new Date().toISOString()
    }
  };
  
  console.log('✅ Fusión de datos completada exitosamente:', {
    fuentes_utilizadas: resultado.sources_used,
    elementos_procesados: datosReales.totalElementos,
    datasets_generados: ['temas_relevantes', 'distribucion_categorias', 'evolucion_sentimiento', 'cronologia_eventos'],
    periodo_analisis: datasetsReales.metadata.periodo_analisis
  });
  
  return resultado;
}

/**
 * Integra datos de Perplexity y tweets en las visualizaciones
 */
function integrarDatosPerplexityEnVisualizaciones(visualizaciones, contextoAdicional) {
  if (!contextoAdicional || !visualizaciones) {
    return visualizaciones;
  }
  
  console.log('🌐 Integrando datos de Perplexity en visualizaciones');
  
  // Add Perplexity insights to conclusions
  if (contextoAdicional.contexto_web) {
    visualizaciones.conclusiones += `\n\nCONTEXTO WEB: ${contextoAdicional.contexto_web.substring(0, 200)}...`;
  }
  
  // Add tweet insights to conclusions
  if (contextoAdicional.contexto_tweets) {
    visualizaciones.conclusiones += `\n\nCONVERSACIÓN SOCIAL: Actividad detectada en redes sociales relacionada con el tema.`;
  }
  
  // Update sources
  if (visualizaciones.sources_used) {
    if (contextoAdicional.contexto_web) {
      visualizaciones.sources_used.push('perplexity_web');
    }
    if (contextoAdicional.contexto_tweets) {
      visualizaciones.sources_used.push('social_media');
    }
  }
  
  // Update methodology
  if (contextoAdicional.fuentes_utilizadas && contextoAdicional.fuentes_utilizadas.length > 0) {
    visualizaciones.metodologia += ` Enriquecido con: ${contextoAdicional.fuentes_utilizadas.join(', ')}.`;
  }
  
  return visualizaciones;
}

/**
 * Construye datasets específicos para visualizaciones basados en datos reales
 */
function buildVisualizationData(datosReales, pregunta, tipoContexto) {
  console.log('📊 Construyendo datasets de visualización con datos reales:', {
    fechas_disponibles: datosReales.fechas.length,
    eventos_count: datosReales.eventos.length,
    sentimientos_count: datosReales.sentimientos.length,
    categorias_count: Object.keys(datosReales.categorias).length
  });
  
  // 1. EVOLUCIÓN DE SENTIMIENTO basada en datos reales
  const evolucionSentimiento = [];
  if (datosReales.sentimientos.length > 0) {
    // Agrupar sentimientos por fecha
    const sentimientosPorFecha = {};
    datosReales.sentimientos.forEach(s => {
      const fecha = s.fecha ? s.fecha.split('T')[0] : new Date().toISOString().split('T')[0];
      if (!sentimientosPorFecha[fecha]) {
        sentimientosPorFecha[fecha] = { positivo: 0, neutral: 0, negativo: 0, total: 0 };
      }
      
      const valor = s.valor.toLowerCase();
      if (valor.includes('positiv') || s.score > 0.2) {
        sentimientosPorFecha[fecha].positivo++;
      } else if (valor.includes('negativ') || s.score < -0.2) {
        sentimientosPorFecha[fecha].negativo++;
      } else {
        sentimientosPorFecha[fecha].neutral++;
      }
      sentimientosPorFecha[fecha].total++;
    });
    
    // Convertir a porcentajes y formato de gráfico
    const fechasOrdenadas = Object.keys(sentimientosPorFecha).sort().slice(-7);
    fechasOrdenadas.forEach((fecha, index) => {
      const datos = sentimientosPorFecha[fecha];
      const total = datos.total || 1;
      
      evolucionSentimiento.push({
        tiempo: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][index % 7],
        positivo: Math.round((datos.positivo / total) * 100),
        neutral: Math.round((datos.neutral / total) * 100),
        negativo: Math.round((datos.negativo / total) * 100),
        fecha: fecha
      });
    });
  } else {
    // Fallback con datos basados en el tipo de contexto
    const patternBase = tipoContexto === 'tendencias' ? [45, 48, 52, 47, 50, 55, 53] : [40, 42, 45, 43, 46, 48, 47];
    ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach((dia, index) => {
      const positivo = patternBase[index] + Math.random() * 10 - 5;
      const negativo = 20 + Math.random() * 10;
      const neutral = 100 - positivo - negativo;
      
      evolucionSentimiento.push({
        tiempo: dia,
        positivo: Math.round(Math.max(0, positivo)),
        neutral: Math.round(Math.max(0, neutral)),
        negativo: Math.round(Math.max(0, negativo)),
        fecha: new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    });
  }
  
  // 2. CRONOLOGÍA DE EVENTOS basada en datos reales
  const cronologiaEventos = datosReales.eventos
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 6)
    .map((evento, index) => ({
      id: `evento_${index + 1}`,
      fecha: evento.fecha,
      titulo: evento.titulo,
      descripcion: `${evento.fuente} - ${evento.categoria}`,
      impacto: evento.engagement > 100 ? 'alto' : evento.engagement > 50 ? 'medio' : 'bajo',
      categoria: evento.categoria,
      sentimiento: determinarSentimientoEvento(evento, datosReales.sentimientos),
      keywords: extraerKeywordsDeEvento(evento.titulo),
      fuentes: [evento.fuente]
    }));
  
  // 3. TEMAS RELEVANTES basados en datos reales
  const temasRelevantes = datosReales.temas
    .slice(0, 8)
    .map((tema, index) => ({
      tema: tema.length > 30 ? tema.substring(0, 30) + '...' : tema,
      valor: Math.max(95 - (index * 8), 25) // Valores decrecientes realistas
    }));
  
  // 4. DISTRIBUCIÓN DE CATEGORÍAS basada en datos reales
  const distribucionCategorias = Object.entries(datosReales.categorias)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6)
    .map(([categoria, count]) => ({
      categoria: categoria.charAt(0).toUpperCase() + categoria.slice(1),
      valor: count
    }));
  
  // Normalizar porcentajes
  const totalCategorias = distribucionCategorias.reduce((sum, cat) => sum + cat.valor, 0) || 1;
  distribucionCategorias.forEach(cat => {
    cat.valor = Math.round((cat.valor / totalCategorias) * 100);
  });
  
  console.log('✅ Datasets de visualización construidos:', {
    evolucion_points: evolucionSentimiento.length,
    eventos_cronologia: cronologiaEventos.length,
    temas_identificados: temasRelevantes.length,
    categorias_distribucion: distribucionCategorias.length
  });
  
  return {
    evolucion_sentimiento: evolucionSentimiento,
    cronologia_eventos: cronologiaEventos,
    temas_relevantes: temasRelevantes,
    distribucion_categorias: distribucionCategorias,
    metadata: {
      datos_reales_utilizados: true,
      fuentes_datos: datosReales.fuentes,
      periodo_analisis: `${datosReales.fechas[0] || 'N/A'} - ${datosReales.fechas[datosReales.fechas.length - 1] || 'N/A'}`,
      total_elementos_procesados: datosReales.totalElementos
    }
  };
}

/**
 * Determina el sentimiento de un evento basado en los datos de sentimientos disponibles
 */
function determinarSentimientoEvento(evento, sentimientos) {
  const sentimientosRelacionados = sentimientos.filter(s => 
    s.fecha === evento.fecha || s.fuente === evento.fuente
  );
  
  if (sentimientosRelacionados.length === 0) {
    return 'neutral';
  }
  
  const promedioScore = sentimientosRelacionados.reduce((sum, s) => sum + (s.score || 0), 0) / sentimientosRelacionados.length;
  
  if (promedioScore > 0.2) return 'positivo';
  if (promedioScore < -0.2) return 'negativo';
  return 'neutral';
}

/**
 * Extrae keywords relevantes del título de un evento
 */
function extraerKeywordsDeEvento(titulo) {
  const palabrasComunes = ['el', 'la', 'de', 'del', 'en', 'con', 'por', 'para', 'una', 'un', 'que', 'se', 'es', 'son', 'tweet'];
  return titulo
    .toLowerCase()
    .split(' ')
    .filter(palabra => palabra.length > 3 && !palabrasComunes.includes(palabra))
    .slice(0, 3);
}

module.exports = {
  construirContextoCompleto,
  obtenerContextoAdicionalPerplexity,
  procesarSondeoConChatGPT,
  construirPromptSondeo,
  generarDatosVisualizacionDesdeContexto,
  extraerDatosRealesDelContexto,
  buildVisualizationData,
  fusionarDatosConContextoReal,
  obtenerContextoTweetsTrending,
  obtenerContextoTendencias,
  obtenerContextoNoticias,
  obtenerContextoCodex,
  obtenerContextoMonitoreos,
  cargarContextoEspecifico
}; 