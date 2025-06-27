const express = require('express');
const cors = require('cors');
// Usa fetch nativo si tienes Node 18+, si no, descomenta la siguiente línea:
// const fetch = require('node-fetch');

// 📧 NUEVA DEPENDENCIA PARA EMAIL
const nodemailer = require('nodemailer');

// Colores para la nube de palabras
const COLORS = [
  '#3B82F6', '#0EA5E9', '#14B8A6', '#10B981', '#F97316', 
  '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#84CC16'
];

/**
 * Detecta una categoría basada en palabras clave presentes en el nombre de la tendencia
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} context - Contexto adicional (opcional)
 * @returns {string} - Categoría detectada
 */
function detectarCategoria(trendName, context = '') {
  const text = (trendName + ' ' + context).toLowerCase();
  
  const categorias = {
    'Política': ['presidente', 'congreso', 'gobierno', 'ministro', 'alcalde', 'elección', 'política', 'giammattei', 'aguirre', 'diputado'],
    'Deportes': ['fútbol', 'liga', 'serie a', 'napoli', 'mctominay', 'deporte', 'equipo', 'partido', 'futbol', 'uefa', 'champions', 'jugador', 'futbolista', 'retiro', 'transferencia', 'lukita'],
    'Música': ['cantante', 'banda', 'concierto', 'música', 'morat', 'álbum', 'canción', 'pop', 'rock'],
    'Entretenimiento': ['actor', 'película', 'serie', 'tv', 'famoso', 'celebridad', 'lilo', 'disney', 'cine', 'estreno'],
    'Justicia': ['corte', 'juez', 'tribunal', 'legal', 'derecho', 'satterthwaite', 'onu', 'derechos humanos'],
    'Sociedad': ['comunidad', 'social', 'cultural', 'santa maría', 'jesús', 'municipio', 'tradición'],
    'Internacional': ['mundial', 'internacional', 'global', 'extranjero', 'europa', 'italia'],
    'Religión': ['iglesia', 'religioso', 'santo', 'santa', 'dios', 'jesús', 'maría']
  };

  for (const [categoria, palabras] of Object.entries(categorias)) {
    if (palabras.some(palabra => text.includes(palabra))) {
      return categoria;
    }
  }

  return 'Otros';
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
    return {
      nombre: trendName,
      resumen: `Tendencia relacionada con ${trendName}`,
      categoria: 'Otros',
      tipo: 'hashtag',
      relevancia: 'baja',
      contexto_local: false,
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
    
    // Prompt mejorado con fecha dinámica y mejor enfoque en la razón exacta
    const prompt = `Analiza la tendencia "${trendName}" y explica POR QUÉ está siendo tendencia ESPECÍFICAMENTE en ${currentMonth} ${currentYear}.

FECHA ACTUAL: ${currentDate}

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
   
6. NO digas "no hay información" - busca más profundo
7. SÉ ESPECÍFICO sobre el evento que causó la tendencia

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
  "razon_tendencia": "Evento específico y exacto que causó que sea tendencia ahora",
  "fecha_evento": "Fecha aproximada del evento que causó la tendencia",
  "palabras_clave": ["palabra1", "palabra2", "palabra3"]
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
- No rendirse fácilmente - buscar información profundamente
- Ser PRECISO sobre la relevancia real para el público de ${location}
- Enfocarte en EVENTOS ESPECÍFICOS no generalidades

FECHA ACTUAL: ${currentDate}
Enfócate en la ACTUALIDAD y en eventos ESPECÍFICOS Y EXACTOS que explican por qué algo es tendencia AHORA.

IMPORTANTE: Si "${trendName}" parece ser un apodo, busca tanto el apodo como el nombre real de la persona.`
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
      max_tokens: 500
    };

    console.log(`   📡 Realizando consulta a Perplexity...`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        let rawResponse = data.choices[0].message.content;
        console.log(`   ✅ Respuesta recibida para ${trendName}`);
        
        try {
          // Intentar extraer JSON de la respuesta
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Enriquecer con metadata
            const enriched = {
              ...parsed,
              source: 'perplexity',
              model: 'sonar',
              search_query: searchQuery,
              timestamp: new Date().toISOString(),
              raw_response: rawResponse
            };
            
            console.log(`   📊 ${trendName}: Categoría=${enriched.categoria}, Relevancia=${enriched.relevancia}`);
            return enriched;
          }
        } catch (parseError) {
          console.log(`   ⚠️  Error parseando JSON para ${trendName}, usando respuesta raw`);
        }
        
        // Si no se puede parsear JSON, crear estructura manual
        return {
          nombre: trendName,
          tipo: 'hashtag',
          categoria: detectarCategoria(trendName, rawResponse),
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
      categoria: detectarCategoria(trendName),
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
      categoria: detectarCategoria(trendName),
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
      
      // 2. Categorizar (usar la categoría del about si está disponible)
      const category = aboutInfo.categoria || await categorizeTrendWithPerplexityIndividual(trendName, location);
      
      const processedTrend = {
        name: trendName,
        volume: trend.volume || trend.count || 1,
        category: category,
        about: {
          summary: aboutInfo.resumen,
          tipo: aboutInfo.tipo,
          relevancia: aboutInfo.relevancia,
          contexto_local: aboutInfo.contexto_local,
          razon_tendencia: aboutInfo.razon_tendencia,
          fecha_evento: aboutInfo.fecha_evento,
          palabras_clave: aboutInfo.palabras_clave,
          source: 'perplexity-individual',
          model: 'sonar',
          search_query: aboutInfo.search_query
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
      
      console.log(`   ✅ Categoría: ${category}`);
      console.log(`   🎯 Relevancia: ${aboutInfo.relevancia}`);
      console.log(`   🌍 Contexto local: ${aboutInfo.contexto_local ? 'Sí' : 'No'}`);
      console.log(`   💥 Razón: ${aboutInfo.razon_tendencia || 'No especificada'}`);
      console.log(`   📝 Resumen: ${aboutInfo.resumen.substring(0, 100)}...`);
      
      // Pausa entre llamadas para ser respetuoso con la API
      if (i < trends.length - 1) {
        console.log(`   ⏳ Pausa de 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando "${trendName}":`, error.message);
      
      // Agregar con valores por defecto
      processedTrends.push({
        name: trendName,
        volume: trend.volume || trend.count || 1,
        category: detectarCategoria(trendName),
        about: {
          summary: `Error procesando información sobre ${trendName}`,
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

// Registrar proceso y errores
process.on('uncaughtException', (error) => {
  console.error('ERROR NO CAPTURADO:', error);
  // No terminar el proceso para mantener el servidor en ejecución
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PROMESA RECHAZADA NO MANEJADA:', reason);
  // No terminar el proceso para mantener el servidor en ejecución
});

// Imprimir variables de entorno disponibles (sin valores sensibles)
console.log('Variables de entorno disponibles:');
console.log('PORT:', process.env.PORT || '8080 (default)');
console.log('NODE_ENV:', process.env.NODE_ENV || 'no configurado');
console.log('OPENAI_API_KEY configurada:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_ORG_ID configurada:', !!process.env.OPENAI_ORG_ID);
console.log('SUPABASE_URL configurada:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY configurada:', !!process.env.SUPABASE_ANON_KEY);

// ============ ENDPOINT GRATUITO PARA CRON JOBS AUTOMATIZADOS ============

// Endpoint específico para cron jobs automatizados del sistema (SIN autenticación, SIN créditos)
app.post('/api/cron/processTrends', async (req, res) => {
  const startTime = Date.now();
  console.log(`🤖 [CRON JOB] Solicitud automatizada de procesamiento de tendencias - ${new Date().toISOString()}`);

  try {
    // 1. Obtener datos crudos
    let rawData = req.body.rawData;

    if (!rawData) {
      console.log('🤖 [CRON] Generando datos mock para procesamiento automatizado');
      rawData = { 
        twitter_trends: Array(15).fill().map((_, i) => `${i+1}. Tendencia Auto ${i+1} ${100-i*5}k`)
      };
    }

    // 2. Procesar los datos usando las funciones existentes
    console.log('🤖 [CRON] Iniciando procesamiento automático...');
    
    // Extraer tendencias del formato de datos
    let trends = [];
    
    if (rawData.twitter_trends && Array.isArray(rawData.twitter_trends)) {
      trends = rawData.twitter_trends.map((trendString, index) => {
        // Extraer número de tendencia y volumen si está presente
        const match = trendString.match(/^(\d+)\.\s*([^0-9]*)(\d+[kK])?/);
        
        if (match) {
          const position = parseInt(match[1]) || 0;
          const name = match[2].trim();
          let volume = 1000 - (position * 10); // Valor por defecto basado en la posición
          
          // Si hay un número con K al final, usarlo como volumen
          if (match[3]) {
            const volStr = match[3].replace(/[kK]$/, '');
            volume = parseInt(volStr) * 1000;
          }
          
          return {
            name: name,
            volume: volume,
            position: position
          };
        }
        
        return {
          name: trendString.replace(/^\d+\.\s*/, '').trim(),
          volume: 1000 - (index * 10),
          position: index + 1
        };
      });
    } else {
      trends = Array(10).fill().map((_, i) => ({
        name: `Tendencia ${i+1}`,
        volume: 1000 - (i * 100)
      }));
    }

    console.log(`✅ Se encontraron ${trends.length} tendencias para procesar`);

    // 3. Procesar con Perplexity Individual
    const processedTrends = await processWithPerplexityIndividual(trends.slice(0, 10), 'Guatemala');
    
    // 4. Generar estadísticas
    const statistics = generateStatistics(processedTrends);
    
    // 5. Preparar datos para respuesta
    const processingTimestamp = new Date().toISOString();
    
    // Generar wordCloud data
    const wordCloudData = processedTrends.map(trend => ({
      text: trend.name,
      value: trend.volume || 1,
      category: trend.category
    }));
    
    // Top keywords
    const topKeywords = processedTrends.map(trend => ({
      keyword: trend.name,
      count: trend.volume || 1,
      category: trend.category,
      about: {
        nombre: trend.name,
        resumen: trend.about.summary,
        categoria: trend.category,
        tipo: trend.about.tipo,
        relevancia: trend.about.relevancia,
        contexto_local: trend.about.contexto_local,
        source: trend.about.source,
        model: trend.about.model
      }
    }));
    
    // Category data
    const categoryData = Object.entries(statistics.categorias).map(([name, count]) => ({
      name,
      value: count
    }));

    // About array simplificado
    const aboutArray = processedTrends.map((trend) => {
      const about = trend.about || {};
      
      return {
        nombre: trend.name,
        tipo: about.tipo || 'hashtag',
        relevancia: about.relevancia || 'Media',
        razon_tendencia: about.razon_tendencia || '',
        fecha_evento: about.fecha_evento || '',
        palabras_clave: about.palabras_clave || [],
        categoria: trend.category,
        contexto_local: Boolean(about.contexto_local),
        source: about.source || 'perplexity-individual',
        model: about.model || 'sonar'
      };
    });

    // 6. Guardar en Supabase si está disponible
    let recordId = null;
    if (supabase) {
      try {
        console.log('🤖 [CRON] Guardando datos en Supabase...');
        const { data, error } = await supabase
          .from('trends')
          .insert([{
            timestamp: processingTimestamp,
            word_cloud_data: wordCloudData,
            top_keywords: topKeywords,
            category_data: categoryData,
            about: aboutArray,
            statistics: statistics,
            processing_status: 'complete',
            raw_data: {
              trends: trends,
              statistics: statistics,
              location: 'guatemala',
              processing_time: (Date.now() - startTime) / 1000,
              source: 'cron-automated'
            }
          }])
          .select();

        if (error) {
          console.error('🤖 [CRON] Error guardando en Supabase:', error);
        } else {
          console.log('🤖 [CRON] Datos guardados exitosamente');
          recordId = data && data[0] ? data[0].id : null;
        }
      } catch (err) {
        console.error('🤖 [CRON] Error al guardar en Supabase:', err);
      }
    }

    const executionTime = Date.now() - startTime;
    console.log('🤖 [CRON] ✅ Procesamiento automatizado completado exitosamente');

    res.json({
      success: true,
      message: 'Tendencias procesadas automáticamente',
      source: 'cron_job_automated',
      timestamp: processingTimestamp,
      data: {
        wordCloudData,
        topKeywords,
        categoryData,
        about: aboutArray,
        statistics
      },
      record_id: recordId,
      execution_time: `${executionTime}ms`,
      note: 'Procesamiento automatizado del sistema - Sin costo de créditos'
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('🤖 [CRON] ❌ Error en procesamiento automatizado:', error);

    res.status(500).json({ 
      success: false,
      error: 'Error en procesamiento automatizado', 
      message: error.message,
      source: 'cron_job_automated',
      execution_time: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

// ============ FIN ENDPOINT CRON JOBS ============

// Iniciar el servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Servidor iniciado en puerto ${PORT}`);
  console.log(`📊 Endpoints de tendencias disponibles:`);
  console.log(`   - POST /api/processTrends`);
  console.log(`   - POST /api/cron/processTrends (GRATUITO)`);
  console.log(`   - POST /api/sondeo`);
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && supabase) {
    console.log(`- Supabase configurado: ${process.env.SUPABASE_URL}`);
  } else {
    console.log('- Supabase no configurado o no inicializado, no se guardarán datos');
  }
});

// Exportar para testing y depuración
module.exports = { app };

