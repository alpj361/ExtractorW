const { detectarCategoria } = require('./categorization');

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
          nombre: aboutInfo.nombre || trendName,
          tipo: aboutInfo.tipo || 'hashtag',
          relevancia: aboutInfo.relevancia?.toLowerCase() || 'media',
          razon_tendencia: aboutInfo.razon_tendencia || `Tendencia relacionada con ${trendName}`,
          fecha_evento: aboutInfo.fecha_evento || now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
          palabras_clave: aboutInfo.palabras_clave || [trendName],
          categoria: category,
          contexto_local: aboutInfo.contexto_local !== undefined ? aboutInfo.contexto_local : true,
          source: aboutInfo.source || 'perplexity-individual',
          model: aboutInfo.model || 'sonar'
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
      
      // Pausa entre llamadas para ser respetuoso con la API
      if (i < trends.length - 1) {
        console.log(`   ⏳ Pausa de 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando "${trendName}":`, error.message);
      
      // Agregar con valores por defecto manteniendo la estructura correcta
      processedTrends.push({
        name: trendName,
        volume: trend.volume || trend.count || 1,
        category: detectarCategoria(trendName),
        about: {
          nombre: trendName,
          tipo: 'hashtag',
          relevancia: 'baja',
          razon_tendencia: `Error procesando información sobre ${trendName}`,
          fecha_evento: now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
          palabras_clave: [trendName],
          categoria: detectarCategoria(trendName),
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
  generateStatistics
}; 