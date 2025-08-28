const fetch = require('node-fetch');
const supabase = require('../utils/supabase');
const { categorizeTrend } = require('./categorization');

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
const PROFILE_MODEL = (process.env.NITTER_PROFILE_MODEL || 'gpt-5').trim();

// Log de configuración
console.log(`🔗 ExtractorT URL configurada para Profile: ${EXTRACTOR_T_URL}`);

/**
 * Analiza el sentimiento de un tweet específico usando Gemini AI
 * Optimizado para perfiles de usuarios guatemaltecos
 */
async function analyzeTweetSentimentProfile(tweet, profileContext) {
  try {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️ OPENAI_API_KEY no configurada, usando análisis básico');
      return {
        sentimiento: 'neutral',
        score_sentimiento: 0.0,
        confianza_sentimiento: 0.5,
        emociones_detectadas: [],
        intencion_comunicativa: 'informativo',
        entidades_mencionadas: [],
        analisis_ai_metadata: {
          model: 'fallback',
          timestamp: new Date().toISOString(),
          context: 'sin_openai'
        }
      };
    }

    const tweetText = tweet.text || tweet.texto || '';
    const username = tweet.author || tweet.usuario || 'usuario';
    if (tweetText.length < 10) {
      return {
        sentimiento: 'neutral',
        score_sentimiento: 0.0,
        confianza_sentimiento: 0.3,
        emociones_detectadas: [],
        intencion_comunicativa: 'informativo',
        entidades_mencionadas: [],
        analisis_ai_metadata: {
          model: PROFILE_MODEL,
          timestamp: new Date().toISOString(),
          context: 'tweet_muy_corto'
        }
      };
    }

    const system = 'Eres un analista de redes sociales en contexto guatemalteco. Responde solo JSON válido.';
    const user = `CONTEXTO DEL PERFIL: ${profileContext}\nUSUARIO: @${username}\nTWEET: "${tweetText}"\n\nDevuelve JSON: {"sentimiento":"positivo|negativo|neutral","score":0.0,"confianza":0.0,"emociones":["..."],"intencion_comunicativa":"...","entidades_mencionadas":["..."],"contexto_local":"...","intensidad":"baja|media|alta"}`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: PROFILE_MODEL, messages: [{ role:'system', content: system }, { role:'user', content: user }], temperature: 0.2, max_tokens: 500 })
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`OpenAI error: ${resp.status} ${resp.statusText} - ${t}`);
    }
    const data = await resp.json();
    let clean = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    let analysis;
    try { analysis = JSON.parse(clean); }
    catch {
      const sentimientoMatch = clean.match(/"?sentimiento"?\s*:\s*"?(\w+)"?/i);
      const scoreMatch = clean.match(/"?score"?\s*:\s*(-?\d*\.?\d+)/i);
      const confMatch = clean.match(/"?confianza"?\s*:\s*(\d*\.?\d+)/i);
      const intencionMatch = clean.match(/"?intencion_comunicativa"?\s*:\s*"?(\w+)"?/i);
      analysis = {
        sentimiento: sentimientoMatch ? sentimientoMatch[1] : 'neutral',
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.0,
        confianza: confMatch ? parseFloat(confMatch[1]) : 0.5,
        emociones: [],
        intencion_comunicativa: intencionMatch ? intencionMatch[1] : 'informativo',
        entidades_mencionadas: [],
        contexto_local: 'Análisis básico',
        intensidad: 'media'
      };
    }

    const sentimiento = ['positivo', 'negativo', 'neutral'].includes(analysis.sentimiento) ? analysis.sentimiento : 'neutral';
    const score = typeof analysis.score === 'number' && analysis.score >= -1 && analysis.score <= 1 ? analysis.score : 0.0;
    const confianza = typeof analysis.confianza === 'number' && analysis.confianza >= 0 && analysis.confianza <= 1 ? analysis.confianza : 0.5;
    const emociones = Array.isArray(analysis.emociones) ? analysis.emociones.slice(0, 5) : [];
    const entidades = Array.isArray(analysis.entidades_mencionadas) ? analysis.entidades_mencionadas.slice(0, 10) : [];

    return {
      sentimiento: sentimiento,
      score_sentimiento: score,
      confianza_sentimiento: confianza,
      emociones_detectadas: emociones,
      intencion_comunicativa: analysis.intencion_comunicativa || 'informativo',
      entidades_mencionadas: entidades,
      analisis_ai_metadata: {
        model: PROFILE_MODEL,
        timestamp: new Date().toISOString(),
        context: 'nitter_profile',
        profile_context: profileContext,
        username: username,
        contexto_local: analysis.contexto_local || 'Sin contexto específico',
        intensidad: analysis.intensidad || 'media'
      }
    };
  } catch (error) {
    console.error(`Error analizando sentimiento del tweet de perfil:`, error.message);
    return {
      sentimiento: 'neutral',
      score_sentimiento: 0.0,
      confianza_sentimiento: 0.2,
      emociones_detectadas: [],
      intencion_comunicativa: 'informativo',
      entidades_mencionadas: [],
      analisis_ai_metadata: {
        model: 'fallback',
        timestamp: new Date().toISOString(),
        context: 'error_analysis',
        error: error.message
      }
    };
  }
}

// Categorización específica para perfiles de usuarios guatemaltecos
const categorizeProfile = (username) => {
  const user = username.toLowerCase();
  
  // Perfiles Políticos
  if (['guatemalagob', 'congresoguetemala', 'mingobgt', 'senadeguatemala', 'quorumgt', 
       'presidenciagtm', 'mpguatemala', 'presidencia', 'congresogt'].includes(user)) {
    return 'Política';
  }
  
  // Perfiles Económicos
  if (['minfin_gt', 'banguat', 'economia_gt', 'guatemala_invest', 'invest_guatemala'].includes(user)) {
    return 'Económica';
  }
  
  // Perfiles Deportivos
  if (['fedefutguate', 'selecciongt', 'deportes_gt', 'liganguatemala'].includes(user)) {
    return 'Deportes';
  }
  
  // Perfiles de Medios
  if (user.includes('news') || user.includes('noticias') || user.includes('prensa') || 
      user.includes('periodico') || user.includes('radio') || user.includes('tv')) {
    return 'Medios';
  }
  
  // Perfiles Educativos
  if (user.includes('usac') || user.includes('url') || user.includes('mariano') || 
      user.includes('landívar') || user.includes('universidad') || user.includes('educacion')) {
    return 'Educación';
  }
  
  return 'Usuario';
};

// Función para convertir fecha de Nitter a formato ISO
const parseNitterDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // 0) Detectar cadenas ISO válidas (que contengan "T" y sigan patrón AAAA-MM-DDTHH)
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateString)) {
      // Asegurar sufijo "Z" para UTC
      return /Z$/.test(dateString) ? dateString : `${dateString}Z`;
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
    
    // Formato típico de Nitter. Si falta año lo agregamos.
    const currentYear = new Date().getFullYear();
    let cleanDate = dateString.replace(' · ', ' ').replace(' UTC', '');

    // Si no hay dígitos de 4 cifras (año), añadir año actual
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

// Función principal para procesar nitter_profile
async function processNitterProfile(username, userId, sessionId, limit = 10, includeRetweets = false, includeReplies = false) {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Procesando nitter_profile: "@${username}" para usuario ${userId}`);
    
    // 1. Llamar a ExtractorT para obtener tweets del perfil (usando GET)
    const cleanUsername = username.replace('@', '');
    const params = new URLSearchParams({
      username: cleanUsername,
      limit: limit.toString(),
      include_retweets: includeRetweets.toString(),
      include_replies: includeReplies.toString()
    });
    
    const nitterUrl = `${EXTRACTOR_T_URL}/api/nitter_profile/?${params}`;
    console.log(`📡 Llamando a ExtractorT Profile (GET): ${nitterUrl}`);
    
    const nitterResponse = await fetch(nitterUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'ExtractorW-NitterProfile/1.0'
      }
    });
    
    if (!nitterResponse.ok) {
      throw new Error(`ExtractorT error: ${nitterResponse.status} ${nitterResponse.statusText}`);
    }
    
    const nitterData = await nitterResponse.json();
    
    // ✅ CORREGIDO: ExtractorT envía "status": "success", no "success": true
    if (nitterData.status !== 'success' || !nitterData.tweets) {
      throw new Error(nitterData.message || 'No tweets found for profile');
    }
    
    const tweets = nitterData.tweets;
    console.log(`📊 Obtenidos ${tweets.length} tweets del perfil @${username}`);
    
    // 2. Determinar categoría del perfil
    const categoria = categorizeProfile(username);
    console.log(`🏷️ Categoría de perfil detectada: ${categoria}`);

    // 2b. Mapear categoría a grupo detectado para agrupaciones inteligentes
    const groupMapping = {
      'Política': 'politica-guatemala',
      'Económica': 'economia-guatemala',
      'Deportes': 'deportes-guatemala',
      'Medios': 'medios-guatemala',
      'Educación': 'educacion-guatemala',
      'Usuario': 'perfiles-usuarios'
    };
    const detectedGroup = groupMapping[categoria] || 'perfiles-usuarios';
    console.log(`🏷️ Grupo detectado (mapeo): ${detectedGroup}`);
    
    // 3. Contexto del perfil para análisis
    const profileContext = `Perfil de @${username} - Categoría: ${categoria} - Usuario guatemalteco`;
    
    // 4. Analizar cada tweet y guardarlo individualmente en recent_scrapes
    const processedTweets = [];
    let totalEngagement = 0;
    let savedCount = 0;
    
    for (const [index, tweet] of tweets.entries()) {
      try {
        console.log(`🔄 Procesando tweet ${index + 1}/${tweets.length} del perfil @${username}`);
        console.log(`📝 Tweet data: ID=${tweet.tweet_id}, texto="${tweet.texto?.substring(0, 50)}..."`);
        
        // Log fecha cruda y parseada para depuración
        const parsedFecha = parseNitterDate(tweet.fecha);
        console.log(`🕒 Fecha raw recibida: "${tweet.fecha}" -> parseada a: ${parsedFecha}`);

        // Analizar sentimiento específico para perfil
        console.log(`🧠 Iniciando análisis de sentimiento para tweet ${tweet.tweet_id}`);
        const sentimentData = await analyzeTweetSentimentProfile(tweet, profileContext);
        console.log(`✅ Análisis completado: sentimiento=${sentimentData.sentimiento}, score=${sentimentData.score_sentimiento}`);
        
        // Calcular engagement
        const likes = tweet.likes || 0;
        const retweets = tweet.retweets || 0;
        const replies = tweet.replies || 0;
        const engagement = likes + retweets + replies;
        totalEngagement += engagement;
        
        // Preparar objeto de tweet para la base de datos (estructura individual)
        const tweetData = {
          query_original: `@${username}`,
          query_clean: username,
          herramienta: 'nitter_profile',
          categoria: categoria,
          detected_group: detectedGroup,
          tweet_id: tweet.tweet_id,
          usuario: username,
          fecha_tweet: parsedFecha,
          fecha: parsedFecha, // compatibilidad
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
          // Campos específicos de perfil
          profile: username,
          profile_link: `https://twitter.com/${username}`,
          // Campos de sesión y metadatos
          user_id: userId,
          session_id: sessionId,
          mcp_request_id: `nitter_profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          mcp_execution_time: Date.now() - startTime, // Tiempo parcial
          location: 'guatemala',
          fecha_captura: new Date().toISOString()
        };
        
        // Guardar tweet individual en la base de datos
        console.log(`🔄 Guardando tweet individual ${tweet.tweet_id} con texto: "${tweet.texto?.substring(0, 50)}..."`);
        const { data: insertData, error: insertError } = await supabase
          .from('recent_scrapes')
          .insert([tweetData])
          .select();
        
        if (insertError) {
          console.error(`❌ Error guardando tweet ${tweet.tweet_id}:`, insertError.message);
          console.error(`❌ Datos que causaron error:`, JSON.stringify(tweetData, null, 2));
        } else {
          console.log(`✅ Tweet ${tweet.tweet_id} guardado exitosamente`);
          savedCount++;
          processedTweets.push({
            // Usar los campos corregidos de ExtractorT
            tweet_id: tweet.tweet_id,
            id: tweet.tweet_id, // Para MagicTweetCard
            usuario: username,
            fecha: tweet.fecha,
            fecha_tweet: parsedFecha,
            texto: tweet.texto,
            enlace: tweet.enlace,
            likes: tweet.likes || 0,
            retweets: tweet.retweets || 0,
            replies: tweet.replies || 0,
            verified: tweet.verified || false,
            // Campos de análisis
            sentimiento: sentimentData.sentimiento,
            score_sentimiento: sentimentData.score_sentimiento,
            intencion_comunicativa: sentimentData.intencion_comunicativa,
            entidades_mencionadas: sentimentData.entidades_mencionadas,
            engagement: engagement,
            categoria: categoria
          });
        }
        
      } catch (tweetError) {
        console.error(`Error procesando tweet ${index + 1}:`, tweetError.message);
      }
    }
    
    // 4. Calcular métricas finales
    const avgEngagement = processedTweets.length > 0 ? Math.round(totalEngagement / processedTweets.length) : 0;
    const executionTime = Date.now() - startTime;
    
    // 5. Crear registro resumen del perfil (como en nitter_context)
    try {
      const summaryData = {
        query_original: `@${username}`,
        query_clean: username,
        herramienta: 'nitter_profile',
        categoria: categoria,
        detected_group: detectedGroup,
        // CAMPOS CLAVE PARA REGISTRO RESUMEN
        tweet_id: null, // NULL indica que es un registro resumen
        tweet_count: processedTweets.length,
        total_engagement: totalEngagement,
        avg_engagement: avgEngagement,
        // Información del perfil para el resumen
        usuario: username,
        fecha_tweet: null,
        texto: `Análisis de perfil @${username} - ${processedTweets.length} tweets analizados`,
        enlace: `https://twitter.com/${username}`,
        likes: 0, // Las métricas van en total_engagement
        retweets: 0,
        replies: 0,
        verified: false,
        profile: username,
        profile_link: `https://twitter.com/${username}`,
        // Campos de sesión y metadatos
        user_id: userId,
        session_id: sessionId,
        mcp_request_id: `nitter_profile_summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mcp_execution_time: executionTime,
        location: 'guatemala',
        fecha_captura: new Date().toISOString(),
        // Campo JSONB con todos los tweets (como en nitter_context)
        tweets: processedTweets.map(tweet => ({
          id: tweet.tweet_id, // MagicTweetCard necesita 'id' no 'tweet_id'
          tweet_id: tweet.tweet_id,
          usuario: username,
          fecha_tweet: tweet.fecha_tweet,
          texto: tweet.texto,
          enlace: tweet.enlace,
          likes: tweet.likes || 0,
          retweets: tweet.retweets || 0,
          replies: tweet.replies || 0,
          verified: tweet.verified || false,
          sentimiento: tweet.sentimiento,
          score_sentimiento: tweet.score_sentimiento,
          intencion_comunicativa: tweet.intencion_comunicativa,
          categoria: tweet.categoria // Agregar categoría para MagicTweetCard
        })),
        raw_data: {
          profile_analysis: true,
          username: username,
          categoria: categoria,
          total_tweets: processedTweets.length,
          total_engagement: totalEngagement,
          avg_engagement: avgEngagement,
          execution_time_ms: executionTime,
          include_retweets: includeRetweets,
          include_replies: includeReplies,
          profile_info: nitterData.profile_info || {}
        }
      };
      
      const { data: summaryInsertData, error: summaryError } = await supabase
        .from('recent_scrapes')
        .insert([summaryData])
        .select();
      
      if (summaryError) {
        console.error(`Error creando registro de resumen para perfil: ${summaryError.message}`);
      } else {
        console.log(`✅ Registro resumen de perfil creado exitosamente`);
      }
      
    } catch (summaryError) {
      console.error(`Error creando registro de resumen de perfil: ${summaryError.message}`);
    }
    
    // 6. Retornar resultado para el chat
    return {
      success: true,
      data: {
        username: username,
        categoria: categoria,
        detected_group: detectedGroup,
        tweets_found: processedTweets.length,
        tweets_saved: savedCount,
        total_engagement: totalEngagement,
        avg_engagement: avgEngagement,
        execution_time_ms: executionTime,
        tweets: processedTweets, // Todos los tweets para análisis completo
        profile_info: nitterData.profile_info || {},
        summary: `Se analizaron ${processedTweets.length} tweets del perfil @${username} en la categoría ${categoria}. ${savedCount} tweets guardados exitosamente con análisis completo de IA. Engagement promedio: ${avgEngagement}.`
      }
    };
    
  } catch (error) {
    console.error(`Error en processNitterProfile: ${error.message}`);
    return {
      success: false,
      error: error.message,
      data: {
        username: username,
        tweets_found: 0,
        tweets_saved: 0,
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

module.exports = {
  processNitterProfile,
  analyzeTweetSentimentProfile,
  categorizeProfile,
  parseNitterDate
}; 