const { detectarCategoria } = require('./categorization');

/**
 * Normaliza categorías a un conjunto fijo de categorías principales
 * @param {string} category - Categoría original
 * @returns {string} - Categoría normalizada
 */
function normalizarCategoria(category) {
  console.log(`   🔧 normalizarCategoria llamada con: "${category}"`);
  
  if (!category || typeof category !== 'string') {
    console.log(`   🔧 Categoría inválida, devolviendo 'Otros'`);
    return 'Otros';
  }
  
  const categoryLower = category.toLowerCase().trim();
  console.log(`   🔧 Categoría en minúsculas: "${categoryLower}"`);
  
  // Mapeo estricto de palabras clave a categorías principales
  const CATEGORIA_PRINCIPAL = {
    // Política e Internacional (prioridad a Internacional si contiene ambas)
    'internacional': ['internacional', 'global', 'mundial', 'geopolítica', 'foreign', 'world'],
    'política': ['política', 'politica', 'político', 'politico', 'politics', 'government', 'gobierno', 'noticias/política'],
    
    // Deportes
    'deportes': ['deporte', 'deportes', 'sports', 'fútbol', 'futbol', 'football', 'soccer', 'basketball', 'béisbol', 'beisbol'],
    
    // Entretenimiento y Música (prioridad a Música si contiene ambas)
    'música': ['música', 'musica', 'music', 'k-pop', 'kpop', 'cantante', 'artista', 'concierto'],
    'entretenimiento': ['entretenimiento', 'entertainment', 'cine', 'película', 'pelicula', 'series', 'tv', 'television', 'show', 'noticias y eventos'],
    
    // Economía
    'economía': ['economía', 'economia', 'economy', 'finanzas', 'finance', 'mercado', 'market', 'negocios', 'business'],
    
    // Tecnología
    'tecnología': ['tecnología', 'tecnologia', 'technology', 'tech', 'software', 'hardware', 'digital', 'internet', 'app'],
    
    // Social
    'social': ['social', 'sociedad', 'society', 'cultural', 'community', 'trending', 'redes sociales', 'cultura popular', 'superstición']
  };

  // Primero intentar encontrar una coincidencia exacta
  for (const [categoria, keywords] of Object.entries(CATEGORIA_PRINCIPAL)) {
    if (keywords.includes(categoryLower)) {
      const result = categoria.charAt(0).toUpperCase() + categoria.slice(1);
      console.log(`   🔧 Coincidencia exacta encontrada: "${categoryLower}" → "${result}"`);
      return result;
    }
  }

  // Si no hay coincidencia exacta, buscar coincidencias parciales
  for (const [categoria, keywords] of Object.entries(CATEGORIA_PRINCIPAL)) {
    for (const keyword of keywords) {
      if (categoryLower.includes(keyword)) {
        const result = categoria.charAt(0).toUpperCase() + categoria.slice(1);
        console.log(`   🔧 Coincidencia parcial encontrada: "${categoryLower}" contiene "${keyword}" → "${result}"`);
        return result;
      }
    }
  }

  // Manejar casos especiales de categorías compuestas
  if (categoryLower.includes('internacional') || categoryLower.includes('global')) {
    console.log(`   🔧 Caso especial: internacional/global → "Internacional"`);
    return 'Internacional';
  }
  
  if (categoryLower.includes('música') || categoryLower.includes('musica')) {
    console.log(`   🔧 Caso especial: música → "Música"`);
    return 'Música';
  }

  if (categoryLower.includes('política') || categoryLower.includes('politic')) {
    console.log(`   🔧 Caso especial: política → "Política"`);
    return 'Política';
  }

  if (categoryLower.includes('deporte') || categoryLower.includes('sport')) {
    console.log(`   🔧 Caso especial: deporte → "Deportes"`);
    return 'Deportes';
  }

  if (categoryLower.includes('entretenimiento') || categoryLower.includes('entertainment')) {
    console.log(`   🔧 Caso especial: entretenimiento → "Entretenimiento"`);
    return 'Entretenimiento';
  }

  if (categoryLower.includes('social') || categoryLower.includes('redes')) {
    console.log(`   🔧 Caso especial: social → "Social"`);
    return 'Social';
  }

  if (categoryLower.includes('cultura') || categoryLower.includes('cultural')) {
    console.log(`   🔧 Caso especial: cultura → "Social"`);
    return 'Social';
  }

  // Si no hay coincidencia, devolver 'Otros'
  console.log(`   🔧 Sin coincidencias, devolviendo 'Otros'`);
  return 'Otros';
}

/**
 * Obtiene contexto de tweets reales de Supabase para una tendencia específica
 * @param {string} trendName - Nombre de la tendencia
 * @param {number} limite - Número máximo de tweets a obtener (default: 3)
 * @returns {string} - Contexto formateado de tweets o string vacío
 */
async function obtenerContextoTweets(trendName, limite = 3) {
  try {
    console.log(`🐦 Obteniendo contexto de tweets para: "${trendName}" (limite: ${limite})`);
    
    // Importar supabase si no está disponible
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️  Supabase no configurado, saltando contexto de tweets');
      return '';
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Sanitize trend name to prevent SQL injection and syntax errors
    const sanitizedTrendName = trendName.replace(/[%_'"\\]/g, '').trim();
    console.log(`🔍 Trend name sanitized: "${trendName}" -> "${sanitizedTrendName}"`);
    
    if (sanitizedTrendName.length < 3) {
      console.log('⚠️ Trend name too short after sanitization, skipping tweets search');
      return '';
    }
    
    // Buscar tweets relacionados con la tendencia
    // Buscar por trend_clean (término limpio) y trend_original
    const { data: tweets, error } = await supabase
      .from('trending_tweets')
      .select(`
        texto,
        likes,
        retweets,
        replies,
        usuario,
        verified,
        fecha_tweet,
        sentimiento,
        score_sentimiento
      `)
      .or(`trend_clean.ilike.*${trendName.replace(/[%_'"\\]/g, '').trim()}*,trend_original.ilike.*${trendName.replace(/[%_'"\\]/g, '').trim()}*,texto.ilike.*${trendName.replace(/[%_'"\\]/g, '').trim()}*`)
      .gte('fecha_captura', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 7 días
      .order('fecha_captura', { ascending: false })
      .limit(20); // Obtener más para poder filtrar mejor
    
    if (error) {
      console.error('❌ Error obteniendo tweets:', error);
      console.log('📭 Fallback: continuando sin tweets adicionales para Perplexity');
      return '';
    }
    
    if (!tweets || tweets.length === 0) {
      console.log(`📭 No se encontraron tweets para "${trendName}" (sanitized: "${sanitizedTrendName}")`);
      return '';
    }
    
    console.log(`✅ Encontrados ${tweets.length} tweets para la tendencia "${trendName}"`);
    
    console.log(`📊 Encontrados ${tweets.length} tweets, aplicando filtros...`);
    
    // Algoritmo de selección inteligente
    const tweetsConPuntuacion = tweets.map(tweet => {
      let puntuacion = 0;
      const engagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
      
      // Puntuación por engagement
      if (engagement >= 1000) puntuacion += 10;
      else if (engagement >= 500) puntuacion += 8;
      else if (engagement >= 100) puntuacion += 6;
      else if (engagement >= 50) puntuacion += 4;
      else if (engagement >= 10) puntuacion += 2;
      
      // Puntuación por usuario verificado
      if (tweet.verified) puntuacion += 5;
      
      // Puntuación por longitud del texto (ni muy corto ni muy largo)
      const textoLength = tweet.texto?.length || 0;
      if (textoLength >= 50 && textoLength <= 200) puntuacion += 3;
      else if (textoLength >= 30 && textoLength <= 280) puntuacion += 1;
      
      // Puntuación por recencia (últimas 24 horas)
      const fechaTweet = new Date(tweet.fecha_tweet);
      const horasDesde = (Date.now() - fechaTweet.getTime()) / (1000 * 60 * 60);
      if (horasDesde <= 24) puntuacion += 4;
      else if (horasDesde <= 48) puntuacion += 2;
      
      // Penalizar tweets muy negativos o spam
      if (tweet.score_sentimiento < -0.8) puntuacion -= 2;
      
      return {
        ...tweet,
        engagement,
        puntuacion
      };
    });
    
    // Seleccionar los mejores tweets
    const mejoresTweets = tweetsConPuntuacion
      .sort((a, b) => b.puntuacion - a.puntuacion)
      .slice(0, limite)
      .filter(tweet => tweet.texto && tweet.texto.length > 20); // Filtrar tweets muy cortos
    
    if (mejoresTweets.length === 0) {
      console.log(`📭 No se encontraron tweets de calidad para "${trendName}"`);
      return '';
    }
    
    // Formatear contexto compacto
    const contextoLineas = mejoresTweets.map((tweet, index) => {
      const engagement = tweet.engagement;
      const usuario = tweet.verified ? `@${tweet.usuario} ✓` : `@${tweet.usuario}`;
      const texto = tweet.texto.substring(0, 180).replace(/\n/g, ' ').trim();
      const engagementText = engagement > 0 ? `[${engagement}❤️]` : '';
      
      return `${index + 1}. ${engagementText} ${texto} - ${usuario}`;
    });
    
    const contexto = `
CONTEXTO DE TWEETS REALES sobre "${trendName}":
${contextoLineas.join('\n')}

INSTRUCCIÓN: Usa estos tweets reales para entender mejor POR QUÉ "${trendName}" es tendencia AHORA. Los tweets muestran lo que la gente realmente está diciendo.`;
    
    console.log(`✅ Contexto de tweets generado: ${mejoresTweets.length} tweets seleccionados`);
    return contexto;
    
  } catch (error) {
    console.error(`❌ Error en obtenerContextoTweets para "${trendName}":`, error);
    console.log('📭 Fallback: continuando sin contexto de tweets para Perplexity');
    return '';
  }
}

/**
 * Obtiene información contextualizada individual para una tendencia usando Perplexity
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} location - Ubicación para contexto (Guatemala)
 * @param {number} year - Año actual
 * @returns {Object} - Información estructurada sobre la tendencia
 */
async function getAboutFromPerplexityIndividual(trendName, location = 'Guatemala', year = 2025) {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    console.log(`⚠️  PERPLEXITY_API_KEY no configurada para ${trendName}`);
    const now = new Date();
    return {
      nombre: trendName,
      tipo: 'hashtag',
      relevancia: 'baja',
      razon_tendencia: `Tendencia relacionada con ${trendName}`,
      fecha_evento: now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      palabras_clave: [trendName],
      categoria: 'Otros',
      contexto_local: true,
      source: 'default',
      model: 'default'
    };
  }

  try {
    console.log(`🔍 Buscando información individual para: "${trendName}"`);
    
    // Obtener fecha actual dinámica
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Obtener contexto de tweets reales
    const contextoTweets = await obtenerContextoTweets(trendName, 3);
    
    // Construir consulta específica para búsqueda web
    const searchQuery = `${trendName} ${location} ${currentMonth} ${currentYear} noticias actualidad`;
    
    // Consultas adicionales para mejorar la búsqueda
    const alternativeQueries = [
      `${trendName} fútbol ${currentMonth} ${currentYear}`, // Para deportes
      `${trendName} retiro futbol ${currentMonth} ${currentYear}`, // Para retiros
      `${trendName} jugador ${currentMonth} ${currentYear}`, // Para jugadores
      `${trendName} noticia mayo 2025`, // Búsqueda directa por fecha
      `"${trendName}" trending ${currentMonth} 2025` // Búsqueda exacta
    ];
    
    // Prompt mejorado con fecha dinámica, contexto de tweets y análisis de controversia integrado
    const prompt = `Analiza la tendencia "${trendName}" y explica POR QUÉ está siendo tendencia ESPECÍFICAMENTE en ${currentMonth} ${currentYear}.

FECHA ACTUAL: ${currentDate}
${contextoTweets}

INSTRUCCIONES ESPECÍFICAS:
1. "${trendName}" puede ser:
   - Un APODO de una persona famosa (ej: jugador de fútbol, artista, político)
   - Un nombre completo de persona
   - Un evento, equipo, película, álbum, etc.
   
2. Si es un APODO, identifica la persona real detrás del apodo
   - Ejemplo: "Lukita" podría ser el apodo de un futbolista
   - Busca tanto el apodo como posibles nombres reales
   
3. Busca eventos ESPECÍFICOS y RECIENTES (${currentMonth} ${currentYear}):
   - Retiros de deportistas
   - Lanzamientos (álbums, películas, productos)  
   - Transferencias de jugadores
   - Noticias actuales (política, escándalos, declaraciones)
   - Eventos deportivos (partidos, lesiones, controversias)
   
4. Si no encuentras información específica para ${currentMonth} ${currentYear}, busca:
   - Eventos recientes en 2025
   - Anuncios importantes
   - Cambios de carrera o retiros
   
5. Determina si es:
   - TENDENCIA LOCAL: Relacionada directamente con ${location}
   - TENDENCIA GLOBAL: Internacional pero que interesa en ${location}
   
6. REQUISITO CRÍTICO: La "razon_tendencia" DEBE ser ESPECÍFICA y DETALLADA:
   ❌ MAL: "Por su popularidad en redes sociales"
   ❌ MAL: "Por ser una figura conocida"
   ❌ MAL: "Por eventos recientes"
   ✅ BIEN: "Anunció oficialmente su retiro del fútbol profesional el 15 de mayo de 2025 después de 20 años de carrera"
   ✅ BIEN: "Lanzó su nuevo álbum 'Corazón Latino' el 12 de mayo de 2025 que incluye colaboración con Bad Bunny"
   ✅ BIEN: "Fue arrestado el 14 de mayo de 2025 por presunta corrupción en contratos gubernamentales"
   
7. NO digas "no hay información" - busca más profundo
8. SÉ ESPECÍFICO sobre el evento que causó la tendencia

ANÁLISIS DE CONTROVERSIA:
Además del análisis básico, evalúa también:
- ¿Qué tan polarizante es este tema?
- ¿Genera debate o división de opiniones?
- ¿Qué factores causan controversia?
- ¿Qué porcentaje de reacciones son positivas vs negativas?
- ¿Qué grupos o bandos se oponen?

EJEMPLOS DE ANÁLISIS PRECISO:
- Si es deportes: ¿Retiro? ¿Transferencia? ¿Lesión? ¿Partido importante?
- Si es apodo de jugador: ¿Quién es realmente? ¿Qué pasó con él?
- Si es política: ¿Qué declaración? ¿Qué acción? ¿Qué investigación?
- Si es entretenimiento: ¿Qué se estrenó? ¿Qué se anunció?

Responde en formato JSON:
{
  "nombre": "Nombre completo/real si es un apodo, sino el nombre limpio",
  "apodo": "${trendName}" (si es diferente del nombre real),
  "tipo": "persona|evento|hashtag|tema|equipo|película|serie|música|álbum|artista|futbolista",
  "categoria": "Categoría específica",
  "resumen": "Explicación de 2-3 oraciones sobre QUÉ ES y POR QUÉ es tendencia AHORA en ${currentMonth} ${currentYear}. SÉ ESPECÍFICO sobre el evento exacto.",
  "relevancia": "alta|media|baja",
  "contexto_local": true/false,
  "razon_tendencia": "DEBE SER MUY ESPECÍFICA: Evento exacto con fecha, acción concreta, anuncio específico, etc. NO generalidades.",
  "fecha_evento": "Fecha aproximada del evento que causó la tendencia",
  "palabras_clave": ["palabra1", "palabra2", "palabra3"],
  "controversy_analysis": {
    "controversy_score": "1-10 (1=no controversial, 10=muy controversial)",
    "controversy_level": "muy_baja|baja|media|alta|muy_alta",
    "polarization_factors": [
      {
        "factor": "Nombre del factor que causa polarización",
        "intensity": "1-10",
        "description": "Descripción del factor"
      }
    ],
    "sentiment_distribution": {
      "positive": "Porcentaje de sentimientos positivos (0-100)",
      "negative": "Porcentaje de sentimientos negativos (0-100)",
      "neutral": "Porcentaje de sentimientos neutrales (0-100)"
    },
    "opposing_sides": [
      {
        "side": "Nombre del bando/grupo",
        "percentage": "Porcentaje de apoyo (0-100)",
        "main_arguments": ["Argumento principal 1", "Argumento principal 2"]
      }
    ]
  }
}`;

    const payload = {
      model: 'sonar',
      messages: [
                  {
            role: 'system',
            content: `Eres un analista de tendencias especializado en identificar POR QUÉ algo es tendencia en redes sociales EN ESTE MOMENTO (${currentMonth} ${currentYear}). Tu expertise incluye:

- Detectar eventos actuales ESPECÍFICOS que generan tendencias (lanzamientos, controversias, partidos, noticias, anuncios)
- Identificar APODOS y nombres reales de personas famosas (especialmente deportistas)
- Distinguir entre tendencias locales de ${location} vs tendencias globales que interesan en ${location}
- Identificar el contexto temporal EXACTO (¿qué pasó HOY/ESTA SEMANA/ESTE MES que lo hizo tendencia?)
- Analizar tweets reales para entender el contexto social y las conversaciones actuales
- No rendirse fácilmente - buscar información profundamente
- Ser PRECISO sobre la relevancia real para el público de ${location}
- Enfocarte en EVENTOS ESPECÍFICOS no generalidades
- ANÁLISIS DE CONTROVERSIA: Evaluar qué tan polarizante es cada tema, factores que generan debate, distribución de sentimientos, y grupos que se oponen

FECHA ACTUAL: ${currentDate}
Enfócate en la ACTUALIDAD y en eventos ESPECÍFICOS Y EXACTOS que explican por qué algo es tendencia AHORA.

IMPORTANTE: 
- Si "${trendName}" parece ser un apodo, busca tanto el apodo como el nombre real de la persona.
- Si tienes contexto de tweets reales, úsalos para entender mejor la conversación actual y la razón específica de la tendencia.
- La "razon_tendencia" DEBE ser específica con fechas, eventos concretos, anuncios exactos - NO generalidades.
- SIEMPRE incluye análisis de controversia evaluando el nivel de polarización y debate que genera el tema.
- RESPONDE SOLO CON JSON VÁLIDO, SIN EXPLICACIONES ADICIONALES.
- Limita el campo "resumen" a **máximo 2 oraciones** y **≤280 caracteres**.
- Limita las listas polarization_factors, opposing_sides y palabras_clave a **máximo 3 elementos** cada una.
- NO uses "..." para cortar información; responde el JSON COMPLETO.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      search_context: {
        search_queries: [searchQuery, ...alternativeQueries]
      },
      temperature: 0.3,
      max_tokens: 1200 // Aumentar tokens para evitar cortes
    };

    console.log(`   📡 Realizando consulta a Perplexity...`);
    
    // Implementar retry con backoff exponencial
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          break; // Éxito, salir del loop
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (fetchError) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(`Falló después de ${maxRetries} intentos: ${fetchError.message}`);
        }
        
        const delay = Math.pow(2, retryCount) * 1000; // Backoff exponencial
        console.log(`   ⏳ Intento ${retryCount} falló, reintentando en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        let rawResponse = data.choices[0].message.content;
        console.log(`   ✅ Respuesta recibida para ${trendName}`);
        
        try {
          // Mejorar la extracción de JSON - buscar múltiples patrones
          let jsonString = null;
          
          // Patrón 1: JSON completo entre llaves
          const jsonMatch1 = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch1) {
            jsonString = jsonMatch1[0];
            console.log(`   🔍 JSON encontrado (patrón 1), parseando...`);
          }
          
          // Patrón 2: JSON después de ``` (código JSON)
          if (!jsonString) {
            const jsonMatch2 = rawResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch2) {
              jsonString = jsonMatch2[1];
              console.log(`   🔍 JSON encontrado (patrón 2 - markdown), parseando...`);
            }
          }
          
          // Patrón 3: JSON después de cualquier código
          if (!jsonString) {
            const jsonMatch3 = rawResponse.match(/```\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch3) {
              jsonString = jsonMatch3[1];
              console.log(`   🔍 JSON encontrado (patrón 3 - código), parseando...`);
            }
          }
          
          if (jsonString) {
            // Limpiar JSON antes de parsear
            jsonString = jsonString.trim();
            
            // Intentar reparar JSON común con problemas
            jsonString = jsonString.replace(/,\s*}/g, '}'); // Quitar comas finales
            jsonString = jsonString.replace(/,\s*]/g, ']'); // Quitar comas finales en arrays
            
            console.log(`   🧹 JSON limpiado, intentando parsear...`);
            
            let parsed;
            try {
              parsed = JSON.parse(jsonString);
            } catch (firstParseError) {
              console.log(`   ⚠️ Primer intento falló, intentando reparar JSON...`);
              
              // Intentar reparar JSON incompleto
              if (!jsonString.endsWith('}')) {
                // Si no termina con }, intentar cerrarlo
                const openBraces = (jsonString.match(/\{/g) || []).length;
                const closeBraces = (jsonString.match(/\}/g) || []).length;
                const missingBraces = openBraces - closeBraces;
                
                if (missingBraces > 0) {
                  jsonString += '}'.repeat(missingBraces);
                  console.log(`   🔧 Agregadas ${missingBraces} llaves faltantes`);
                }
              }
              
              try {
                parsed = JSON.parse(jsonString);
                console.log(`   ✅ JSON reparado exitosamente`);
              } catch (secondParseError) {
                throw new Error(`No se pudo reparar el JSON: ${secondParseError.message}`);
              }
            }
            
            // Validar que el JSON tenga las propiedades mínimas requeridas
            if (!parsed || typeof parsed !== 'object') {
              throw new Error('JSON parseado no es un objeto válido');
            }
            
            // Asegurar propiedades mínimas
            const requiredFields = ['nombre', 'categoria', 'resumen', 'relevancia'];
            const missingFields = requiredFields.filter(field => !parsed[field]);
            
            if (missingFields.length > 0) {
              console.log(`   ⚠️ Campos faltantes: ${missingFields.join(', ')}, agregando defaults...`);
              
              // Agregar campos faltantes con defaults
              if (!parsed.nombre) parsed.nombre = trendName;
              if (!parsed.categoria) parsed.categoria = 'Otros';
              if (!parsed.resumen) parsed.resumen = `Información sobre ${trendName}`;
              if (!parsed.relevancia) parsed.relevancia = 'media';
            }
            
            // Forzar la normalización de la categoría aquí, justo después de recibir la respuesta
            const originalCategory = parsed.categoria || 'Otros';
            console.log(`   📝 Categoría original de Perplexity: "${originalCategory}"`);
            
            parsed.categoria = normalizarCategoria(originalCategory);
            console.log(`   🔄 Normalización: "${originalCategory}" → "${parsed.categoria}"`);
            
            // Determinar si es contexto local basado en el contenido
            const isLocalContext = 
              parsed.resumen?.toLowerCase().includes(location.toLowerCase()) ||
              parsed.razon_tendencia?.toLowerCase().includes(location.toLowerCase()) ||
              trendName.toLowerCase().includes(location.toLowerCase()) ||
              (typeof parsed.contexto_local === 'boolean' ? parsed.contexto_local : undefined);
            
            // Enriquecer con metadata
            const enriched = {
              ...parsed,
              source: 'perplexity',
              model: 'sonar',
              search_query: searchQuery,
              timestamp: new Date().toISOString(),
              raw_response: rawResponse,
              contexto_local: isLocalContext
            };
            
            console.log(`   📊 ${trendName}: Categoría FINAL=${enriched.categoria}, Relevancia=${enriched.relevancia}`);
            return enriched;
          } else {
            console.log(`   ⚠️ No se encontró JSON en ningún patrón`);
            console.log(`   🔍 Respuesta completa: ${rawResponse.substring(0, 300)}...`);
          }
        } catch (parseError) {
          console.error(`   ⚠️  Error parseando JSON para ${trendName}:`, parseError.message);
          console.log(`   🔍 Respuesta raw que falló: ${rawResponse.substring(0, 200)}...`);
        }
        
        // Si no se puede parsear JSON, crear estructura manual
        return {
          nombre: trendName,
          tipo: 'hashtag',
          categoria: normalizarCategoria('Otros'),
          resumen: rawResponse.substring(0, 300),
          relevancia: 'media',
          contexto_local: rawResponse.toLowerCase().includes('guatemala'),
          palabras_clave: [trendName],
          source: 'perplexity',
          model: 'sonar',
          raw_response: rawResponse
        };
      }
    } else {
      const errorText = await response.text();
      console.error(`   ❌ Error Perplexity para ${trendName}:`, errorText.substring(0, 200));
    }

    // Fallback en caso de error
    return {
      nombre: trendName,
      resumen: `Tendencia relacionada con ${trendName}`,
      categoria: normalizarCategoria('Otros'),
      tipo: 'hashtag',
      relevancia: 'baja',
      contexto_local: false,
      source: 'default',
      model: 'default'
    };
  } catch (error) {
    console.error(`   ❌ Error en getAboutFromPerplexityIndividual para ${trendName}:`, error.message);
    
    return {
      nombre: trendName,
      resumen: `Error procesando información sobre ${trendName}`,
      categoria: normalizarCategoria('Otros'),
      tipo: 'hashtag',
      relevancia: 'baja',
      contexto_local: false,
      source: 'error',
      error_message: error.message
    };
  }
}

/**
 * Categoriza una tendencia usando Perplexity con contexto específico
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} location - Ubicación para contexto
 * @returns {string} - Categoría en español
 */
async function categorizeTrendWithPerplexityIndividual(trendName, location = 'Guatemala') {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    return detectarCategoria(trendName);
  }

  try {
    console.log(`🏷️  Categorizando con Perplexity: "${trendName}"`);
    
    const prompt = `Categoriza la siguiente tendencia en el contexto de ${location}:

TENDENCIA: "${trendName}"

Analiza el término y determina la categoría más específica. Considera:
- Si es una persona (política, deporte, entretenimiento, etc.)
- Si es un evento (político, deportivo, cultural, etc.)
- Si es un tema de actualidad
- Su relevancia para Guatemala

CATEGORÍAS DISPONIBLES:
Política, Deportes, Música, Entretenimiento, Economía, Tecnología, Salud, 
Educación, Cultura, Sociedad, Internacional, Ciencia, Justicia, Seguridad, 
Medio ambiente, Moda, Farándula, Otros

Responde ÚNICAMENTE con el nombre de la categoría, sin explicación.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en categorización de tendencias para ${location}. Respondes solo con el nombre de la categoría más adecuada.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 20
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const category = data.choices[0].message.content.trim().replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, '');
        console.log(`   ✅ Categoría: ${category}`);
        return category;
      }
    }

    return detectarCategoria(trendName);
  } catch (error) {
    console.error(`   ❌ Error categorizando ${trendName}:`, error.message);
    return detectarCategoria(trendName);
  }
}

/**
 * Procesa múltiples tendencias usando llamadas individuales a Perplexity
 * @param {Array} trends - Array de tendencias
 * @param {string} location - Ubicación para contexto
 * @returns {Array} - Tendencias procesadas
 */
async function processWithPerplexityIndividual(trends, location = 'Guatemala') {
  console.log(`\n🔍 INICIANDO PROCESAMIENTO: PERPLEXITY INDIVIDUAL (${trends.length} tendencias)`);
  console.log('='.repeat(80));
  
  const processedTrends = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.toLocaleString('es-ES', { month: 'long' });

  console.log(`📅 Fecha actual: ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  console.log(`🌍 Ubicación: ${location}`);

  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const trendName = trend.name || trend.keyword || trend.text || `Tendencia ${i+1}`;
    
    console.log(`\n📊 Procesando ${i+1}/${trends.length}: "${trendName}"`);
    console.log('─'.repeat(60));
    
    try {
      // 1. Obtener información completa
      const aboutInfo = await getAboutFromPerplexityIndividual(trendName, location, currentYear);
      
      // 2. La categoría ya viene normalizada de getAboutFromPerplexityIndividual
      const normalizedCategory = aboutInfo.categoria || 'Otros';
      
      const processedTrend = {
        name: trendName,
        volume: trend.volume ?? trend.count ?? 1,
        category: normalizedCategory, // Usar la categoría ya normalizada
        about: {
          nombre: aboutInfo.nombre || trendName,
          tipo: aboutInfo.tipo || 'hashtag',
          relevancia: aboutInfo.relevancia?.toLowerCase() || 'media',
          razon_tendencia: aboutInfo.razon_tendencia || `Tendencia relacionada con ${trendName}`,
          fecha_evento: aboutInfo.fecha_evento || now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
          palabras_clave: aboutInfo.palabras_clave || [trendName],
          categoria: normalizedCategory, // Usar la categoría ya normalizada
          contexto_local: aboutInfo.contexto_local === undefined ? 
            aboutInfo.resumen?.toLowerCase().includes(location.toLowerCase()) || 
            trendName.toLowerCase().includes(location.toLowerCase()) : 
            aboutInfo.contexto_local,
          source: aboutInfo.source || 'perplexity-individual',
          model: aboutInfo.model || 'sonar',
          // NUEVO: Análisis de controversia integrado
          controversy_analysis: aboutInfo.controversy_analysis || {
            controversy_score: 1,
            controversy_level: 'muy_baja',
            polarization_factors: [],
            sentiment_distribution: { positive: 60, negative: 20, neutral: 20 },
            opposing_sides: []
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          location: location,
          year: currentYear,
          month: currentMonth
        },
        original: trend
      };
      
      processedTrends.push(processedTrend);
      
      console.log(`   ✅ Categoría FINAL: ${normalizedCategory}`);
      console.log(`   🎯 Relevancia: ${aboutInfo.relevancia}`);
      console.log(`   🌍 Contexto local: ${aboutInfo.contexto_local ? 'Sí' : 'No'}`);
      console.log(`   💥 Razón: ${aboutInfo.razon_tendencia || 'No especificada'}`);
      
      // Pausa entre llamadas para ser respetuoso con la API
      if (i < trends.length - 1) {
        console.log(`   ⏳ Pausa de 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando "${trendName}":`, error.message);
      
      // Agregar con valores por defecto manteniendo la estructura correcta
      const defaultCategory = normalizarCategoria(detectarCategoria(trendName));
      processedTrends.push({
        name: trendName,
        volume: trend.volume || trend.count || 1,
        category: defaultCategory,
        about: {
          nombre: trendName,
          tipo: 'hashtag',
          relevancia: 'baja',
          razon_tendencia: `Error procesando información sobre ${trendName}`,
          fecha_evento: now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
          palabras_clave: [trendName],
          categoria: defaultCategory,
          contexto_local: true,
          source: 'error',
          model: 'error'
        },
        original: trend
      });
    }
  }
  
  console.log('\n✅ PROCESAMIENTO PERPLEXITY INDIVIDUAL COMPLETADO');
  console.log('='.repeat(80));
  
  return processedTrends;
}

/**
 * Genera estadísticas a partir de las tendencias procesadas
 * @param {Array} processedTrends - Tendencias procesadas
 * @returns {Object} - Estadísticas generadas
 */
function generateStatistics(processedTrends) {
  console.log(`🔢 Generando estadísticas para ${processedTrends.length} tendencias...`);
  
  // Inicializar estadísticas
  const stats = {
    total: processedTrends.length,
    categorias: {},
    relevancia: { alta: 0, media: 0, baja: 0 },
    contexto: { local: 0, global: 0 },
    tipos: {},
    timestamp: new Date().toISOString()
  };
  
  // Procesar cada tendencia
  processedTrends.forEach(trend => {
    // Categorías
    const category = trend.category || 'Otros';
    stats.categorias[category] = (stats.categorias[category] || 0) + 1;
    
    // Relevancia
    if (trend.about && trend.about.relevancia) {
      const relevancia = trend.about.relevancia.toLowerCase();
      if (['alta', 'media', 'baja'].includes(relevancia)) {
        stats.relevancia[relevancia] = (stats.relevancia[relevancia] || 0) + 1;
      }
    }
    
    // Contexto local vs global
    if (trend.about && trend.about.contexto_local !== undefined) {
      if (trend.about.contexto_local) {
        stats.contexto.local += 1;
      } else {
        stats.contexto.global += 1;
      }
    }
    
    // Tipos
    if (trend.about && trend.about.tipo) {
      const tipo = trend.about.tipo;
      stats.tipos[tipo] = (stats.tipos[tipo] || 0) + 1;
    }
  });
  
  console.log('📊 Estadísticas generadas:', JSON.stringify({
    total: stats.total,
    categorias_count: Object.keys(stats.categorias).length,
    relevancia: stats.relevancia,
    contexto: stats.contexto
  }, null, 2));
  
  return stats;
}

// Funciones auxiliares para determinar los valores correctos
function determinarTipo(trendName) {
  // Lógica para determinar el tipo basado en el nombre y contenido
  if (trendName.match(/^[A-Z][a-z]+ ?[A-Z][a-z]+$/)) return 'persona';
  if (trendName.match(/^#/)) return 'hashtag';
  if (trendName.match(/^[A-Z][a-z]+ ?\d{4}$/)) return 'evento';
  if (trendName.match(/^[A-Z][a-z]+$/)) return 'lugar';
  return 'tema';
}

function determinarRelevancia() {
  // Por ahora retornamos un valor aleatorio entre Alta, Media, Baja
  const relevancia = ['Alta', 'Media', 'Baja'];
  return relevancia[Math.floor(Math.random() * relevancia.length)];
}

function obtenerRazonTendencia() {
  // Aquí iría la lógica para extraer la razón de tendencia del análisis de Perplexity
  return 'Análisis en proceso...';
}

function obtenerFechaEvento() {
  // Aquí iría la lógica para extraer la fecha del evento si existe
  const now = new Date();
  return now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function obtenerPalabrasClave() {
  // Aquí iría la lógica para extraer palabras clave relevantes
  return [];
}

function determinarContextoLocal(location) {
  // Por defecto asumimos que es contexto local
  return true;
}

module.exports = {
  getAboutFromPerplexityIndividual,
  categorizeTrendWithPerplexityIndividual,
  processWithPerplexityIndividual,
  generateStatistics,
  obtenerContextoTweets,
  normalizarCategoria
}; 