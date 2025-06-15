const supabase = require('../utils/supabase');
const { obtenerContextoTweets } = require('./perplexity');

/**
 * Servicio de Sondeos - Maneja la obtención de contexto y procesamiento con IA
 * Basado en la implementación original de migration.js
 */

/**
 * Obtiene contexto de tendencias desde la tabla trends
 */
async function obtenerContextoTendencias(limite = 10) {
  try {
    console.log(`📊 Obteniendo contexto de tendencias (límite: ${limite})`);
    
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
            name: t.name || t.trend || t,
            volume: t.tweet_volume || t.volume || 0,
            category: t.category || 'General'
          }));
        } else if (Array.isArray(trendData)) {
          trendInfo.trends = trendData.map(t => ({
            name: typeof t === 'string' ? t : (t.name || t.trend || 'Sin nombre'),
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
async function obtenerContextoNoticias(limite = 15) {
  try {
    console.log(`📰 Obteniendo contexto de noticias (límite: ${limite})`);
    
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .order('published_at', { ascending: false })
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
      title: noticia.title,
      description: noticia.description,
      content: noticia.content,
      url: noticia.url,
      source: noticia.source,
      published_at: noticia.published_at,
      category: noticia.category || 'General',
      keywords: noticia.keywords || [],
      sentiment: noticia.sentiment_score
    }));

    console.log(`✅ Contexto de noticias obtenido: ${contextoNoticias.length} noticias`);
    return contextoNoticias;

  } catch (error) {
    console.error('❌ Error en obtenerContextoNoticias:', error);
    return [];
  }
}

/**
 * Obtiene contexto de documentos desde la tabla codex
 */
async function obtenerContextoCodex(limite = 10) {
  try {
    console.log(`📚 Obteniendo contexto de codex (límite: ${limite})`);
    
    const { data: codex, error } = await supabase
      .from('codex')
      .select('*')
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
      title: doc.title,
      content: doc.content,
      summary: doc.summary,
      category: doc.category || 'General',
      tags: doc.tags || [],
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      metadata: doc.metadata || {}
    }));

    console.log(`✅ Contexto de codex obtenido: ${contextoCodex.length} documentos`);
    return contextoCodex;

  } catch (error) {
    console.error('❌ Error en obtenerContextoCodex:', error);
    return [];
  }
}

/**
 * Construye el contexto completo basado en las fuentes seleccionadas
 */
async function construirContextoCompleto(selectedContexts) {
  try {
    console.log('🔨 Construyendo contexto completo:', selectedContexts);
    
    const contexto = {
      fuentes_utilizadas: selectedContexts,
      timestamp: new Date().toISOString(),
      data: {}
    };

    // Obtener datos de cada fuente seleccionada
    const promises = [];

    if (selectedContexts.includes('tendencias')) {
      promises.push(
        obtenerContextoTendencias(10).then(data => ({ tipo: 'tendencias', data }))
      );
    }

    if (selectedContexts.includes('tweets')) {
      promises.push(
        obtenerContextoTweetsTrending(20).then(data => ({ tipo: 'tweets', data }))
      );
    }

    if (selectedContexts.includes('noticias')) {
      promises.push(
        obtenerContextoNoticias(15).then(data => ({ tipo: 'noticias', data }))
      );
    }

    if (selectedContexts.includes('codex')) {
      promises.push(
        obtenerContextoCodex(10).then(data => ({ tipo: 'codex', data }))
      );
    }

    // Ejecutar todas las consultas en paralelo
    const resultados = await Promise.all(promises);

    // Organizar resultados por tipo
    resultados.forEach(resultado => {
      contexto.data[resultado.tipo] = resultado.data;
    });

    // Calcular estadísticas del contexto
    contexto.estadisticas = {
      total_fuentes: selectedContexts.length,
      total_items: Object.values(contexto.data).reduce((acc, items) => acc + (Array.isArray(items) ? items.length : 0), 0),
      fuentes_con_datos: Object.keys(contexto.data).filter(key => 
        Array.isArray(contexto.data[key]) && contexto.data[key].length > 0
      ).length
    };

    console.log(`✅ Contexto completo construido:`, contexto.estadisticas);
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
    
    // Usar la función existente de perplexity.js para obtener contexto de tweets
    const contextoTweets = await obtenerContextoTweets();
    
    // Construir query para Perplexity basado en la pregunta y contexto
    const query = `Contexto sobre: ${pregunta}. 
    Información adicional relevante para Guatemala y Centroamérica.
    Contexto de redes sociales: ${contextoTweets}`;

    // Aquí se podría integrar con Perplexity API si está disponible
    // Por ahora retornamos el contexto de tweets
    return {
      contexto_tweets: contextoTweets,
      query_utilizado: query,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error obteniendo contexto adicional:', error);
    return {
      contexto_tweets: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Procesa el sondeo con ChatGPT 4o (simulado por ahora)
 */
async function procesarSondeoConChatGPT(pregunta, contexto, configuracion = {}) {
  try {
    console.log('🤖 Procesando sondeo con ChatGPT 4o');
    
    // Construir prompt para ChatGPT
    const prompt = construirPromptSondeo(pregunta, contexto, configuracion);
    
    // NOTA: Aquí se integraría con la API de OpenAI ChatGPT 4o
    // Por ahora simulamos la respuesta
    const respuestaSimulada = {
      respuesta: `Análisis de: "${pregunta}"
      
Basado en el contexto proporcionado de ${contexto.fuentes_utilizadas.join(', ')}, se puede observar:

1. **Tendencias Principales**: ${contexto.estadisticas.total_items} elementos analizados
2. **Fuentes Consultadas**: ${contexto.estadisticas.total_fuentes} fuentes de datos
3. **Análisis Contextual**: Información relevante para Guatemala y región

**Conclusiones**:
- El tema muestra relevancia en las fuentes consultadas
- Se identifican patrones en los datos analizados
- Recomendaciones basadas en el contexto actual

*Nota: Esta es una respuesta simulada. La integración real con ChatGPT 4o se implementará próximamente.*`,
      
      metadata: {
        modelo: 'ChatGPT-4o (simulado)',
        tokens_estimados: Math.ceil(JSON.stringify(contexto).length / 4),
        fuentes_utilizadas: contexto.fuentes_utilizadas,
        timestamp: new Date().toISOString(),
        configuracion_utilizada: configuracion
      },
      
      estadisticas: {
        contexto_procesado: contexto.estadisticas,
        costo_creditos: configuracion.costo_calculado || 15
      }
    };

    console.log('✅ Sondeo procesado exitosamente');
    return respuestaSimulada;

  } catch (error) {
    console.error('❌ Error procesando sondeo:', error);
    throw error;
  }
}

/**
 * Construye el prompt optimizado para ChatGPT
 */
function construirPromptSondeo(pregunta, contexto, configuracion) {
  const prompt = `
Eres un analista experto en tendencias y datos de Guatemala y Centroamérica.

PREGUNTA A ANALIZAR: "${pregunta}"

CONTEXTO DISPONIBLE:
${JSON.stringify(contexto, null, 2)}

INSTRUCCIONES:
1. Analiza la pregunta en el contexto de los datos proporcionados
2. Identifica patrones y tendencias relevantes
3. Proporciona insights específicos para Guatemala/Centroamérica
4. Incluye recomendaciones basadas en evidencia
5. Mantén un tono profesional pero accesible

FORMATO DE RESPUESTA:
- Análisis principal
- Tendencias identificadas
- Conclusiones y recomendaciones
- Fuentes de datos utilizadas

Responde en español y enfócate en información práctica y accionable.
`;

  return prompt;
}

module.exports = {
  obtenerContextoTendencias,
  obtenerContextoTweetsTrending,
  obtenerContextoNoticias,
  obtenerContextoCodex,
  construirContextoCompleto,
  obtenerContextoAdicionalPerplexity,
  procesarSondeoConChatGPT,
  construirPromptSondeo
}; 