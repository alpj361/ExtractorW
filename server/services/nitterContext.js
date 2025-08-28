const fetch = require('node-fetch');
const supabase = require('../utils/supabase');

// Configuración de la API de ExtractorT
function getExtractorTUrl() {
  // Verificar variables de entorno específicas primero
  if (process.env.EXTRACTOR_T_URL) {
    return process.env.EXTRACTOR_T_URL;
  }
  
  // Detectar entorno automáticamente
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // PRODUCCIÓN: Usar URL externa
    return process.env.EXTRACTORT_URL || 'https://api.standatpd.com';
  } else {
    // DESARROLLO: Usar contenedor local con IP del host
    return process.env.EXTRACTORT_LOCAL_URL || 'http://127.0.0.1:8000';
  }
}

const EXTRACTOR_T_URL = getExtractorTUrl();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_SENTIMENT_MODEL = (process.env.NITTER_SENTIMENT_MODEL || 'gpt-5').trim();

// Log de configuración
console.log(`🔗 ExtractorT URL configurada: ${EXTRACTOR_T_URL}`);

// Función para análisis de sentimiento con OpenAI (GPT‑5 preferido; fallback configurado)
async function analyzeTweetSentiment(tweet, categoria) {
  const configuredModel = OPENAI_SENTIMENT_MODEL || 'gpt-5';
  const fallbackModel = 'gpt-4o-mini';
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY no configurada, usando datos por defecto');
    return getDefaultSentimentData('API no configurada');
  }

  async function callOpenAI(model) {
    const system = 'Eres un analista de comunicación política en Guatemala. Responde solo JSON válido.';
    const user = [
      `Categoría: ${categoria}`,
      `Usuario: @${tweet.usuario}`,
      `Fecha: ${tweet.fecha}`,
      `Likes: ${tweet.likes || 0}, Retweets: ${tweet.retweets || 0}, Replies: ${tweet.replies || 0}`,
      `Tweet: "${tweet.texto}"`,
      '',
      'Devuelve un JSON válido con:',
      '{',
      '  "sentimiento": "positivo|negativo|neutral",',
      '  "score": 0.0,',
      '  "confianza": 0.0,',
      '  "emociones": [],',
      '  "intencion_comunicativa": "informativo|opinativo|humoristico|alarmista|critico|promocional|conversacional|protesta",',
      '  "entidades_mencionadas": [{"nombre":"","tipo":"","contexto":""}],',
      '  "contexto_local": "",',
      '  "intensidad": "alta|media|baja"',
      '}'
    ].join('\n');

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        max_tokens: 350
      })
    });
    return resp;
  }

  try {
    console.log(`🧠 Analizando sentimiento (OpenAI:${configuredModel}→${fallbackModel} fallback): @${tweet.usuario} - ${String(tweet.texto).substring(0, 50)}...`);

    let resp = await callOpenAI(configuredModel);
    if (!resp.ok) {
      const firstText = await resp.text();
      console.warn(`OpenAI(${configuredModel}) fallo: ${resp.status} ${resp.statusText} - ${firstText}. Probando fallback ${fallbackModel}...`);
      resp = await callOpenAI(fallbackModel);
      if (!resp.ok) {
        const secondText = await resp.text();
        throw new Error(`OpenAI fallback error (${fallbackModel}): ${resp.status} ${resp.statusText} - ${secondText}`);
      }
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || '';

    let clean = raw.replace(/```json|```/g, '').trim();
    let analysis;
    try {
      analysis = JSON.parse(clean);
    } catch (e) {
      const sentimientoMatch = clean.match(/"?sentimiento"?\s*:\s*"?(\w+)"?/i);
      const scoreMatch = clean.match(/"?score"?\s*:\s*(-?\d*\.?\d+)/i);
      const confMatch = clean.match(/"?confianza"?\s*:\s*(\d*\.?\d+)/i);
      const intencionMatch = clean.match(/"?intencion_comunicativa"?\s*:\s*"?([\w|]+)"?/i);
      analysis = {
        sentimiento: sentimientoMatch ? sentimientoMatch[1] : 'neutral',
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.0,
        confianza: confMatch ? parseFloat(confMatch[1]) : 0.5,
        emociones: [],
        intencion_comunicativa: intencionMatch ? intencionMatch[1] : 'informativo',
        entidades_mencionadas: [],
        contexto_local: '',
        intensidad: 'media'
      };
    }

    const sentimiento = ['positivo', 'negativo', 'neutral'].includes(analysis.sentimiento) ? analysis.sentimiento : 'neutral';
    const score = typeof analysis.score === 'number' ? Math.max(-1, Math.min(1, analysis.score)) : 0.0;
    const confianza = typeof analysis.confianza === 'number' ? Math.max(0, Math.min(1, analysis.confianza)) : 0.5;
    const intencionesValidas = ['informativo', 'opinativo', 'humoristico', 'alarmista', 'critico', 'promocional', 'conversacional', 'protesta'];
    const intencion = intencionesValidas.includes(analysis.intencion_comunicativa) ? analysis.intencion_comunicativa : 'informativo';
    const entidades = Array.isArray(analysis.entidades_mencionadas) ? analysis.entidades_mencionadas.filter(e => e && e.nombre && e.tipo) : [];

    console.log(`✅ Análisis (OpenAI): ${sentimiento} (${score}) | ${intencion} | ${entidades.length} entidades`);

    return {
      sentimiento,
      score_sentimiento: score,
      confianza_sentimiento: confianza,
      emociones_detectadas: Array.isArray(analysis.emociones) ? analysis.emociones : [],
      intencion_comunicativa: intencion,
      entidades_mencionadas: entidades,
      analisis_ai_metadata: {
        modelo: configuredModel,
        fallback_model: fallbackModel,
        timestamp: new Date().toISOString(),
        categoria
      }
    };
  } catch (error) {
    console.error(`Error analizando sentimiento: ${error.message}`);
    return getDefaultSentimentData(error.message);
  }
}

// Función de fallback para datos por defecto
function getDefaultSentimentData(error) {
  return {
    sentimiento: 'neutral',
    score_sentimiento: 0.0,
    confianza_sentimiento: 0.3,
    emociones_detectadas: [],
    intencion_comunicativa: 'informativo',
    entidades_mencionadas: [],
    analisis_ai_metadata: {
      error: error,
      timestamp: new Date().toISOString(),
      modelo: 'fallback'
    }
  };
}

// Mapeo de categorías basado en contenido
const categorizeTrend = (trendText) => {
  const text = trendText.toLowerCase();
  
  // Política
  if (text.includes('política') || text.includes('político') || text.includes('congreso') || 
      text.includes('gobierno') || text.includes('presidente') || text.includes('ley') ||
      text.includes('elecciones') || text.includes('partido') || text.includes('diputado') ||
      text.includes('ministerio') || text.includes('ministra') || text.includes('ministro') ||
      text.includes('corrupción') || text.includes('tse') || text.includes('mp') ||
      text.includes('cicig') || text.includes('senado') || text.includes('alcalde') ||
      text.includes('giammattei') || text.includes('arévalo') || text.includes('semilla') ||
      text.includes('vamos') || text.includes('une') || text.includes('valor') ||
      text.includes('todos') || text.includes('winaq') || text.includes('líder') ||
      text.includes('guatemala') || text.includes('nombramiento') || text.includes('renuncia')) {
    return 'Política';
  }
  
  // Económica
  if (text.includes('finanzas') || text.includes('economía') || text.includes('banco') ||
      text.includes('impuesto') || text.includes('precio') || text.includes('dólar') ||
      text.includes('inflación') || text.includes('comercio') || text.includes('empleo') ||
      text.includes('trabajo') || text.includes('salario') || text.includes('banguat') ||
      text.includes('superintendencia') || text.includes('inversión') || text.includes('exportación') ||
      text.includes('pib') || text.includes('bolsa') || text.includes('empresa') ||
      text.includes('quetzal') || text.includes('mercado') || text.includes('negocios')) {
    return 'Económica';
  }
  
  // Sociales
  if (text.includes('educación') || text.includes('salud') || text.includes('familia') ||
      text.includes('sociedad') || text.includes('comunidad') || text.includes('cultura') ||
      text.includes('derechos') || text.includes('violencia') || text.includes('mujer') ||
      text.includes('niños') || text.includes('juventud') || text.includes('universidad') ||
      text.includes('hospital') || text.includes('medicina') || text.includes('covid') ||
      text.includes('vacuna') || text.includes('usac') || text.includes('url') ||
      text.includes('mariano') || text.includes('landívar') || text.includes('rafael') ||
      text.includes('social') || text.includes('maya') || text.includes('indígena') ||
      text.includes('xinca') || text.includes('garífuna') || text.includes('discriminación')) {
    return 'Sociales';
  }
  
  // Tecnología
  if (text.includes('tecnología') || text.includes('software') || text.includes('app') ||
      text.includes('inteligencia') || text.includes('artificial') || text.includes('digital') ||
      text.includes('internet') || text.includes('programación') || text.includes('desarrollo')) {
    return 'Tecnología';
  }
  
  // Deportes
  if (text.includes('fútbol') || text.includes('deporte') || text.includes('liga') ||
      text.includes('mundial') || text.includes('selección') || text.includes('gol')) {
    return 'Deportes';
  }
  
  return 'General';
};

// Función para convertir fecha de Nitter a formato ISO
const parseNitterDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // 0) Si la cadena ya es ISO (contiene "T" y se parsea correctamente), devolverla tal cual en UTC
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateString)) {
      const isoDate = new Date(dateString);
      if (!isNaN(isoDate.getTime())) {
        // Si no incluye zona, asumimos que la hora ya viene en UTC y simplemente añadimos 'Z'
        if (/Z$/.test(dateString)) {
          return dateString; // ya tiene Z
        }
        return dateString + 'Z';
      }
    }

    // 1) Manejar fechas relativas: "3m", "16m", "2h", etc.
    if (/^\d+[mhsdwy]$/.test(dateString)) {
      const now = new Date();
      const value = parseInt(dateString);
      const unit = dateString.slice(-1);
      
      switch (unit) {
        case 'm': // minutos
          now.setMinutes(now.getMinutes() - value);
          break;
        case 'h': // horas  
          now.setHours(now.getHours() - value);
          break;
        case 'd': // días
          now.setDate(now.getDate() - value);
          break;
        case 'w': // semanas
          now.setDate(now.getDate() - (value * 7));
          break;
        case 'y': // años
          now.setFullYear(now.getFullYear() - value);
          break;
        case 's': // segundos
          now.setSeconds(now.getSeconds() - value);
          break;
        default:
          return new Date().toISOString();
      }
      
      return now.toISOString();
    }
    
    const currentYear = new Date().getFullYear();
    let cleanDate = dateString.replace(' · ', ' ').replace(' UTC', '');
    if (!/\d{4}/.test(cleanDate)) {
      cleanDate = `${cleanDate} ${currentYear}`;
    }
    const date = new Date(`${cleanDate} UTC`);
    
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    
    return date.toISOString();
  } catch (error) {
    console.error(`Error parseando fecha "${dateString}":`, error.message);
    return new Date().toISOString();
  }
};

// Función principal para procesar nitter_context
async function processNitterContext(query, userId, sessionId, location = 'guatemala', limit = 10) {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Procesando nitter_context: "${query}" para usuario ${userId}`);
    
    // 1. Llamar a ExtractorT para obtener tweets
    const nitterUrl = `${EXTRACTOR_T_URL}/api/nitter_context?q=${encodeURIComponent(query)}&location=${location}&limit=${limit}`;
    console.log(`📡 Llamando a ExtractorT: ${nitterUrl}`);
    
    const nitterResponse = await fetch(nitterUrl);
    
    if (!nitterResponse.ok) {
      throw new Error(`ExtractorT error: ${nitterResponse.status} ${nitterResponse.statusText}`);
    }
    
    const nitterData = await nitterResponse.json();
    
    if (nitterData.status !== 'success' || !nitterData.tweets) {
      throw new Error(nitterData.message || 'No tweets found');
    }
    
    const tweets = nitterData.tweets;
    console.log(`📊 Obtenidos ${tweets.length} tweets de ExtractorT`);
    
    // 2. Determinar categoría del query
    const categoria = categorizeTrend(query);
    console.log(`🏷️ Categoría detectada: ${categoria}`);

    // 2b. Mapear categoría a grupo detectado para agrupaciones inteligentes
    const groupMapping = {
      'Política': 'politica-guatemala',
      'Económica': 'economia-guatemala',
      'Sociales': 'social-guatemala',
      'Tecnología': 'tecnologia',
      'Deportes': 'deportes-guatemala',
      'General': 'general'
    };
    const detectedGroup = groupMapping[categoria] || 'general';
    console.log(`🏷️ Grupo detectado (mapeo): ${detectedGroup}`);
    
    // 3. Analizar cada tweet y guardarlo individualmente en recent_scrapes
    const processedTweets = [];
    let totalEngagement = 0;
    let savedCount = 0;
    
    for (const [index, tweet] of tweets.entries()) {
      try {
        console.log(`🔄 Procesando tweet ${index + 1}/${tweets.length}: @${tweet.usuario}`);
        
        // Log fecha cruda y parseada para depuración
        const parsedFecha = parseNitterDate(tweet.fecha);
        console.log(`🕒 Fecha raw recibida: "${tweet.fecha}" -> parseada a: ${parsedFecha}`);

        // Analizar sentimiento
        const sentimentData = await analyzeTweetSentiment(tweet, categoria);
        
        // Calcular engagement
        const likes = tweet.likes || 0;
        const retweets = tweet.retweets || 0;
        const replies = tweet.replies || 0;
        const engagement = likes + retweets + replies;
        totalEngagement += engagement;
        
        // Preparar objeto de tweet para la base de datos (estructura individual)
        const tweetData = {
          query_original: query,
          query_clean: query.trim(),
          herramienta: 'nitter_context',
          categoria: categoria,
          detected_group: detectedGroup,
          tweet_id: tweet.tweet_id,
          usuario: tweet.usuario,
          fecha_tweet: parsedFecha,
          fecha: parsedFecha,
          texto: tweet.texto,
          enlace: tweet.enlace,
          likes: likes,
          retweets: retweets,
          replies: replies,
          verified: tweet.verified || false,
          // Campos de análisis
          sentimiento: sentimentData.sentimiento,
          score_sentimiento: sentimentData.score_sentimiento,
          confianza_sentimiento: sentimentData.confianza_sentimiento,
          emociones_detectadas: sentimentData.emociones_detectadas,
          intencion_comunicativa: sentimentData.intencion_comunicativa,
          entidades_mencionadas: sentimentData.entidades_mencionadas,
          analisis_ai_metadata: sentimentData.analisis_ai_metadata,
          // Campos de sesión y metadatos
          user_id: userId,
          session_id: sessionId,
          mcp_request_id: `nitter_context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          mcp_execution_time: Date.now() - startTime, // Tiempo parcial
          location: location,
          fecha_captura: new Date().toISOString(),
          raw_data: tweet,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Guardar tweet individual en recent_scrapes
        const { data, error } = await supabase
          .from('recent_scrapes')
          .insert(tweetData)
          .select();
        
        if (error) {
          console.error(`❌ Error guardando tweet ${tweet.tweet_id}:`, error.message);
          continue;
        }
        
        savedCount++;
        console.log(`✅ Tweet guardado: @${tweet.usuario} - ${sentimentData.sentimiento} (${sentimentData.score_sentimiento}) | ${sentimentData.intencion_comunicativa}`);
        
        // Preparar objeto de tweet para respuesta (sin campos internos)
        const processedTweet = {
          tweet_id: tweet.tweet_id,
          usuario: tweet.usuario,
          fecha_tweet: parsedFecha,
          fecha: parsedFecha,
          texto: tweet.texto,
          enlace: tweet.enlace,
          likes: likes,
          retweets: retweets,
          replies: replies,
          verified: tweet.verified || false,
          // Campos de análisis
          sentimiento: sentimentData.sentimiento,
          score_sentimiento: sentimentData.score_sentimiento,
          confianza_sentimiento: sentimentData.confianza_sentimiento,
          emociones_detectadas: sentimentData.emociones_detectadas,
          intencion_comunicativa: sentimentData.intencion_comunicativa,
          entidades_mencionadas: sentimentData.entidades_mencionadas,
          analisis_ai_metadata: sentimentData.analisis_ai_metadata
        };
        
        processedTweets.push(processedTweet);
        
        // Pausa breve entre análisis
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error procesando tweet individual: ${error.message}`);
        continue;
      }
    }
    
    const avgEngagement = processedTweets.length > 0 ? Math.round(totalEngagement / processedTweets.length) : 0;
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Guardado exitoso en recent_scrapes: ${savedCount}/${tweets.length} tweets, engagement promedio: ${avgEngagement}`);
    
    // 4. Crear registro de resumen (tweet_id: null) para el frontend
    try {
      const summaryData = {
        query_original: query,
        query_clean: query.trim(),
        herramienta: 'nitter_context',
        categoria: categoria,
        detected_group: detectedGroup,
        tweet_count: processedTweets.length,
        total_engagement: totalEngagement,
        avg_engagement: avgEngagement,
        tweet_id: null, // IMPORTANTE: null para registro de resumen
        usuario: null,
        fecha_tweet: null,
        texto: null,
        enlace: null,
        likes: null,
        retweets: null,
        replies: null,
        verified: null,
        // Campos de sesión y metadatos
        user_id: userId,
        session_id: sessionId,
        mcp_request_id: `nitter_summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mcp_execution_time: executionTime,
        location: location,
        fecha_captura: new Date().toISOString(),
        tweets: processedTweets, // Array JSONB con todos los tweets analizados
        raw_data: { summary: true, total_tweets: processedTweets.length, total_engagement: totalEngagement },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: summaryRecord, error: summaryError } = await supabase
        .from('recent_scrapes')
        .insert(summaryData)
        .select();
      
      if (summaryError) {
        console.error(`❌ Error guardando registro de resumen:`, summaryError.message);
      } else {
        console.log(`✅ Registro de resumen creado exitosamente con ID: ${summaryRecord[0].id}`);
      }
      
    } catch (summaryError) {
      console.error(`Error creando registro de resumen: ${summaryError.message}`);
    }
    
    // 5. Retornar resultado para el chat
    return {
      success: true,
      data: {
        query: query,
        categoria: categoria,
        detected_group: detectedGroup,
        tweets_found: processedTweets.length,
        tweets_saved: savedCount,
        total_engagement: totalEngagement,
        avg_engagement: avgEngagement,
        execution_time_ms: executionTime,
        tweets: processedTweets, // Todos los tweets para análisis completo
        summary: `Se encontraron ${processedTweets.length} tweets sobre "${query}" en la categoría ${categoria}. ${savedCount} tweets guardados exitosamente. Engagement promedio: ${avgEngagement}. Los tweets han sido analizados y guardados para futura referencia.`
      }
    };
    
  } catch (error) {
    console.error(`Error en processNitterContext: ${error.message}`);
    return {
      success: false,
      error: error.message,
      data: {
        query: query,
        tweets_found: 0,
        tweets_saved: 0,
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

module.exports = {
  processNitterContext,
  analyzeTweetSentiment,
  categorizeTrend
}; 