const axios = require('axios');
const { processNitterContext } = require('./nitterContext');

// Importar fetch para Node.js
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  // Fallback para Node.js 18+ que tiene fetch nativo
  fetch = global.fetch;
}

// ===================================================================
// MCP SERVICE - Micro Command Processor
// Orquestador central de herramientas para agentes IA
// ===================================================================

// Configuración de servicios externos
const EXTRACTOR_T_URL = process.env.EXTRACTOR_T_URL || 'https://api.standatpd.com';

/**
 * Mejora la expansión de términos usando Perplexity para contexto adicional
 * @param {string} originalQuery - Query original del usuario
 * @param {boolean} usePerplexity - Si usar Perplexity para mejorar la expansión
 * @returns {Promise<string>} - Query expandido con contexto de Perplexity
 */
async function enhanceSearchTermsWithPerplexity(originalQuery, usePerplexity = false) {
  try {
    if (!usePerplexity) {
      return expandSearchTerms(originalQuery);
    }

    console.log(`🔍 Mejorando expansión de términos con Perplexity: "${originalQuery}"`);
    
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      console.log('⚠️ PERPLEXITY_API_KEY no disponible, usando expansión básica');
      return expandSearchTerms(originalQuery);
    }

    // Obtener fecha actual
    const now = new Date();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

         const enhancementPrompt = `Analiza la consulta "${originalQuery}" y sugiere términos de búsqueda optimizados para Twitter/X en Guatemala.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}, Guatemala**
**OBJETIVO: Optimizar búsqueda para obtener tweets RECIENTES y relevantes**

⚠️ FILTRO TEMPORAL CRÍTICO:
- SOLO incluye hashtags y términos que estén siendo usados en ${currentMonth} ${currentYear}
- Agrega modificadores temporales como "2025", "${currentMonth}", "actual", "ahora"
- Incluye hashtags que probablemente estén trending HOY

INSTRUCCIONES:
1. Si es sobre una persona, incluye variaciones de su nombre, apodos, cargos Y su estado ACTUAL en ${currentYear}
2. Si es sobre eventos, incluye hashtags probables CON fechas de ${currentMonth} ${currentYear}
3. Si es sobre temas políticos, incluye instituciones y términos oficiales CON contexto de ${currentYear}
4. Si es sobre deportes, incluye equipos, competencias y hashtags deportivos de la temporada ${currentYear}
5. Incluye términos en español que usan los guatemaltecos ACTUALMENTE
6. Considera abreviaciones comunes (GT, Guate, Chapin) con contexto temporal
7. Incluye hashtags que probablemente estén trending en ${currentMonth} ${currentYear}
8. AGREGA SIEMPRE modificadores temporales: "2025", "${currentMonth}", "actual", "reciente"

EJEMPLOS ACTUALIZADOS:
- "marcha del orgullo" → "Orgullo2025 OR MarchadelOrgullo OR Pride OR LGBTI OR diversidad OR #OrguIIoGt OR Orgullo${currentMonth} OR Pride2025 OR OrgulloActual"
- "presidente guatemala" → "BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR PresidenciaGt OR Arevalo2025 OR GobiernoActual OR Presidente${currentMonth}"

Responde SOLO con los términos de búsqueda optimizados separados por "OR", sin explicaciones.`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `Eres un experto en optimización de búsquedas en redes sociales para Guatemala. 

Tu trabajo es convertir consultas generales en términos de búsqueda específicos que capturen las conversaciones reales de los guatemaltecos en Twitter/X.

Características:
- Conoces los apodos y nombres comunes usados en Guatemala
- Identificas hashtags que probablemente estén trending
- Incluyes variaciones de nombres oficiales vs populares
- Consideras el contexto temporal actual
- Usas operadores OR para máxima cobertura

FECHA ACTUAL: ${currentMonth} ${currentYear}
CONTEXTO: Guatemala`
        },
        {
          role: 'user',
          content: enhancementPrompt
        }
      ],
      temperature: 0.2,
      max_tokens: 200
    };

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
        const enhancedTerms = data.choices[0].message.content.trim();
        console.log(`🚀 Términos mejorados con Perplexity: "${enhancedTerms}"`);
        return enhancedTerms;
      }
    }

    console.log('⚠️ Error con Perplexity, usando expansión básica');
    return expandSearchTerms(originalQuery);

  } catch (error) {
    console.error('❌ Error mejorando términos con Perplexity:', error);
    return expandSearchTerms(originalQuery);
  }
}

/**
 * Expansión inteligente de términos de búsqueda para Twitter
 * Convierte consultas generales en búsquedas estratégicas específicas
 */
function expandSearchTerms(originalQuery) {
  const query = originalQuery.toLowerCase().trim();
  
  // Diccionario de expansiones específicas para Guatemala
  const expansions = {
    // Eventos y marchas (con contexto temporal actual)
    'marcha del orgullo': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad OR OrgulloActual OR Pride2025',
    'orgullo': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad OR OrgulloActual OR Pride2025',
    'pride': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad OR OrgulloActual OR Pride2025',
    
    // Política (con contexto temporal actual)
    'elecciones': 'EleccionesGt OR TSE OR voto OR candidatos OR Elecciones2025 OR procesoelectoral OR EleccionesActuales',
    'presidente': 'BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR Presidencia OR Arevalo2025 OR PresidenteActual',
    'gobierno': 'GobiernoGt OR BernardoArevalo OR CasaPresidencial OR Presidencia OR ejecutivo OR GobiernoActual OR Arevalo2025',
    'congreso': 'CongresoGt OR diputados OR legislativo OR plenaria OR bancada OR Congreso2025 OR LegislativoActual',
    
    // Economía
    'economia': 'economiaGt OR PIB OR inflacion OR empleo OR QuetzalGt OR BancoGuatemala',
    'inflación': 'inflacion OR precios OR carestia OR QuetzalGt OR poder OR adquisitivo',
    'empleo': 'empleo OR trabajo OR desempleo OR MinTrabajo OR OportunidadesGt',
    
    // Deportes
    'futbol': 'SeleccionGt OR GuatemalaFC OR LigaNacional OR Fedefut OR bicolor',
    'seleccion': 'SeleccionGt OR bicolor OR Fedefut OR eliminatorias OR futbolGt',
    
    // Seguridad
    'seguridad': 'seguridadGt OR PNC OR delincuencia OR violencia OR MinGob',
    'violencia': 'violencia OR delincuencia OR inseguridad OR crimenes OR PNC',
    
    // Educación
    'educacion': 'educacionGt OR Mineduc OR estudiantes OR maestros OR escuelas',
    'universidad': 'universidadesGt OR USAC OR URL OR UVG OR estudiantes',
    
    // Salud
    'salud': 'saludGt OR MSPAS OR hospitales OR medicos OR MinSalud',
    'covid': 'covid OR pandemia OR vacunas OR MinSalud OR CovidGt',
    
    // Cultura
    'cultura': 'culturaGt OR tradiciones OR artesanias OR Micude OR patrimonioGt',
    'musica': 'musicaGt OR artistas OR conciertos OR cantantes OR chapin'
  };

  // Buscar coincidencias exactas primero
  for (const [key, expansion] of Object.entries(expansions)) {
    if (query.includes(key)) {
      console.log(`🎯 Expansión exacta encontrada: "${key}" → "${expansion}"`);
      return expansion;
    }
  }

  // Búsquedas por palabras clave
  const keywords = [
    // Política (con contexto temporal)
    { keys: ['bernardo', 'arevalo'], expansion: 'BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR Arevalo2025 OR PresidenteActual' },
    { keys: ['giammattei'], expansion: 'Giammattei OR expresidente OR gobiernoanterior' }, // Mantener histórico para ex-presidente
    { keys: ['tse'], expansion: 'TSE OR tribunal OR electoral OR elecciones OR voto OR TSE2025 OR ElectoralActual' },
    { keys: ['mp', 'ministerio publico'], expansion: 'MP OR MinisterioPublico OR fiscalia OR ContraCosta OR MP2025 OR FiscaliaActual' },
    
    // Eventos específicos
    { keys: ['festival', 'cervantino'], expansion: 'FIC OR CervantinOGuatemala OR festivalcervantino OR cultura' },
    { keys: ['independencia'], expansion: 'IndependenciaGt OR 15septiembre OR patria OR antorcha' },
    { keys: ['navidad'], expansion: 'NavidadGt OR posadas OR aguinaldo OR fiestas' },
    
    // Ubicaciones
    { keys: ['zona viva'], expansion: 'ZonaViva OR zona10 OR entretenimiento OR restaurantes' },
    { keys: ['antigua'], expansion: 'Antigua OR LaAntigua OR patrimonio OR turismo' },
    { keys: ['lago atitlan'], expansion: 'Atitlan OR lago OR turismo OR Solola' },
    
    // Hashtags comunes
    { keys: ['guatemala'], expansion: 'Guatemala OR GuatemalaGt OR Guate OR Chapin OR GT' },
    { keys: ['chapín', 'chapin'], expansion: 'Chapin OR Guatemala OR Guate OR GuatemalaGt' },
  ];

  // Buscar palabras clave
  for (const keywordObj of keywords) {
    if (keywordObj.keys.some(keyword => query.includes(keyword))) {
      console.log(`🔍 Palabra clave encontrada: ${keywordObj.keys.join('/')} → "${keywordObj.expansion}"`);
      return keywordObj.expansion;
    }
  }

  // Si no hay expansión específica, agregar contexto guatemalteco Y temporal
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
  
  const contextualizedQuery = `${originalQuery} OR ${originalQuery}Gt OR ${originalQuery}Guatemala OR ${originalQuery}${currentYear} OR ${originalQuery}Actual OR ${originalQuery}${currentMonth}`;
  console.log(`📝 Consulta contextualizada temporal: "${originalQuery}" → "${contextualizedQuery}"`);
  
  return contextualizedQuery;
}

/**
 * Optimiza límites de tweets basado en el tipo de consulta
 */
function optimizeTweetLimit(query, requestedLimit = 10) {
  const query_lower = query.toLowerCase();
  
  // Para análisis de sentimiento o temas controversiales, usar más tweets
  const needMoreTweets = [
    'sentimiento', 'opinion', 'que dicen', 'que piensan', 'reaccion',
    'politica', 'elecciones', 'gobierno', 'presidente', 'congreso',
    'protestas', 'marchas', 'manifestacion', 'crisis'
  ];
  
  if (needMoreTweets.some(term => query_lower.includes(term))) {
    return Math.max(requestedLimit, 20); // Mínimo 20 tweets para análisis completo
  }
  
  // Para consultas específicas, 15 tweets es suficiente
  return Math.max(requestedLimit, 15);
}

// Registro de herramientas disponibles
const AVAILABLE_TOOLS = {
  nitter_context: {
    name: 'nitter_context',
    description: 'Obtiene tweets usando Nitter, los analiza con Gemini AI (sentimiento, intención, entidades) y los guarda en la base de datos',
    parameters: {
      q: {
        type: 'string',
        required: true,
        description: 'Término de búsqueda para obtener tweets contextuales'
      },
      location: {
        type: 'string',
        required: false,
        default: 'guatemala',
        description: 'Ubicación para filtrar resultados (guatemala, mexico, us, etc.)'
      },
      limit: {
        type: 'integer',
        required: false,
        default: 10,
        min: 5,
        max: 50,
        description: 'Número máximo de tweets a obtener'
      },
      session_id: {
        type: 'string',
        required: false,
        description: 'ID de sesión del chat (se genera automáticamente si no se proporciona)'
      }
    },
    service_endpoint: '/api/nitter_context',
    service_url: 'internal',
    category: 'social_media_analysis',
    usage_credits: 5,
    features: [
      'Extracción de tweets con Nitter',
      'Análisis de sentimiento con Gemini AI',
      'Detección de intención comunicativa',
      'Extracción de entidades mencionadas',
      'Guardado individual en base de datos',
      'Categorización automática'
    ]
  },
  
  perplexity_search: {
    name: 'perplexity_search',
    description: 'Realiza búsquedas web inteligentes usando Perplexity AI para obtener información actualizada y contextualizada sobre cualquier tema',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Consulta de búsqueda web para investigar'
      },
      location: {
        type: 'string',
        required: false,
        default: 'Guatemala',
        description: 'Contexto geográfico para la búsqueda (Guatemala, Mexico, etc.)'
      },
      focus: {
        type: 'string',
        required: false,
        default: 'general',
        description: 'Enfoque específico: general, noticias, eventos, deportes, politica, economia, cultura'
      },
      improve_nitter_search: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Si true, además de la búsqueda web, optimiza términos para mejorar búsquedas en Nitter'
      }
    },
    service_endpoint: '/api/perplexity_search', 
    service_url: 'internal',
    category: 'web_research',
    usage_credits: 3,
    features: [
      'Búsqueda web en tiempo real',
      'Información contextualizada por ubicación',
      'Análisis de eventos actuales',
      'Optimización de términos para redes sociales',
      'Detección de hashtags relevantes',
      'Contexto guatemalteco especializado'
    ]
  }
};

/**
 * Lista todas las herramientas disponibles en el MCP Server
 * @returns {Array} Array de herramientas con su información
 */
async function listAvailableTools() {
  try {
    const tools = Object.values(AVAILABLE_TOOLS).map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      usage_credits: tool.usage_credits
    }));

    console.log(`📋 Listando ${tools.length} herramientas MCP disponibles`);
    return tools;
  } catch (error) {
    console.error('❌ Error listando herramientas MCP:', error);
    throw error;
  }
}

/**
 * Obtiene información detallada de una herramienta específica
 * @param {string} toolName - Nombre de la herramienta
 * @returns {Object|null} Información de la herramienta o null si no existe
 */
async function getToolInfo(toolName) {
  try {
    const tool = AVAILABLE_TOOLS[toolName];
    
    if (!tool) {
      console.log(`⚠️ Herramienta '${toolName}' no encontrada`);
      return null;
    }

    console.log(`📖 Obteniendo información de herramienta: ${toolName}`);
    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      usage_credits: tool.usage_credits,
      service_info: {
        endpoint: tool.service_endpoint,
        url: tool.service_url
      }
    };
  } catch (error) {
    console.error(`❌ Error obteniendo info de herramienta ${toolName}:`, error);
    throw error;
  }
}

/**
 * Ejecuta una herramienta específica del MCP Server
 * @param {string} toolName - Nombre de la herramienta
 * @param {Object} parameters - Parámetros para la herramienta
 * @param {Object} user - Información del usuario autenticado
 * @returns {Object} Resultado de la ejecución
 */
async function executeTool(toolName, parameters = {}, user = null) {
  try {
    const tool = AVAILABLE_TOOLS[toolName];
    
    if (!tool) {
      throw new Error(`Herramienta '${toolName}' no encontrada`);
    }

    console.log(`🔧 Ejecutando herramienta: ${toolName} para usuario: ${user?.email || 'anónimo'}`);
    
    // Validar parámetros requeridos
    const validationResult = validateToolParameters(tool, parameters);
    if (!validationResult.valid) {
      throw new Error(`Parámetros inválidos: ${validationResult.errors.join(', ')}`);
    }

    // Ejecutar herramienta específica
    let result;
    switch (toolName) {
      case 'nitter_context':
        result = await executeNitterContext(
          parameters.q, 
          parameters.location || 'guatemala', 
          parameters.limit || 10,
          parameters.session_id,
          user
        );
        break;
      case 'perplexity_search':
        result = await executePerplexitySearch(
          parameters.query,
          parameters.location || 'Guatemala',
          parameters.focus || 'general',
          parameters.improve_nitter_search || false,
          user
        );
        break;
      default:
        throw new Error(`Ejecutor no implementado para herramienta: ${toolName}`);
    }

    console.log(`✅ Herramienta ${toolName} ejecutada exitosamente`);
    return result;
  } catch (error) {
    console.error(`❌ Error ejecutando herramienta ${toolName}:`, error);
    throw error;
  }
}

/**
 * Ejecuta específicamente la herramienta nitter_context con análisis completo
 * @param {string} query - Término de búsqueda
 * @param {string} location - Ubicación para filtrar
 * @param {number} limit - Límite de tweets
 * @param {string} sessionId - ID de sesión del chat
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultado de nitter_context con análisis completo
 */
async function executeNitterContext(query, location = 'guatemala', limit = 10, sessionId = null, user = null) {
  try {
    console.log(`🐦 Ejecutando nitter_context MCP: query="${query}", location="${location}", limit=${limit}`);
    
    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar nitter_context');
    }
    
    // MEJORAR: Expansión inteligente de términos de búsqueda
    const expandedQuery = expandSearchTerms(query);
    const optimizedLimit = optimizeTweetLimit(query, limit);
    
    console.log(`🎯 Query original: "${query}"`);
    console.log(`🚀 Query expandido: "${expandedQuery}"`);
    console.log(`📊 Límite optimizado: ${optimizedLimit} tweets`);
    
    // Generar session_id si no se proporciona
    const finalSessionId = sessionId || `mcp_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Usar el servicio completo de nitterContext con términos mejorados
    const result = await processNitterContext(
      expandedQuery, // Usar la query expandida en lugar de query original
      user.id,
      finalSessionId,
      location,
      optimizedLimit // Usar el límite optimizado
    );

    if (result.success) {
      console.log(`✅ Nitter context procesado exitosamente: ${result.data.tweets_found} tweets analizados`);
      
      // Formatear respuesta para el agente AI con información adicional sobre la mejora
      const formattedTweets = result.data.tweets.map(tweet => 
        `@${tweet.usuario} (${tweet.fecha_tweet}): ${tweet.texto}\n` +
        `   📊 Sentimiento: ${tweet.sentimiento} (${tweet.score_sentimiento}) | ` +
        `Intención: ${tweet.intencion_comunicativa}\n` +
        `   💬 Engagement: ❤️${tweet.likes} 🔄${tweet.retweets} 💬${tweet.replies} | ` +
        `Entidades: ${tweet.entidades_mencionadas.length}\n`
      ).join('\n');
      
      return {
        success: true,
        tweets: result.data.tweets,
        tweets_found: result.data.tweets_found,
        query_original: query,
        query_expanded: expandedQuery,
        limit_requested: limit,
        limit_used: optimizedLimit,
        session_id: finalSessionId,
        formatted_context: `BÚSQUEDA INTELIGENTE EJECUTADA:
Query original del usuario: "${query}"
Query expandida estratégicamente: "${expandedQuery}"
Tweets analizados: ${result.data.tweets_found}/${optimizedLimit}
Ubicación: ${location}

TWEETS ENCONTRADOS Y ANALIZADOS:
${formattedTweets}

ANÁLISIS CONTEXTUAL:
- Se expandió automáticamente la consulta para obtener mejores resultados
- Se optimizó el límite basado en el tipo de análisis requerido
- Todos los tweets incluyen análisis de sentimiento e intención comunicativa
- Las entidades mencionadas han sido extraídas automáticamente`,
        analysis_metadata: {
          query_expansion_applied: expandedQuery !== query,
          limit_optimization_applied: optimizedLimit !== limit,
          tweets_analyzed: result.data.tweets_found,
          sentiment_distribution: result.data.tweets.reduce((acc, tweet) => {
            acc[tweet.sentimiento] = (acc[tweet.sentimiento] || 0) + 1;
            return acc;
          }, {}),
          average_engagement: result.data.tweets.reduce((sum, tweet) => 
            sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0
          ) / result.data.tweets.length || 0
        }
      };
    } else {
      throw new Error(result.error || 'Error procesando nitter_context');
    }

  } catch (error) {
    console.error(`❌ Error ejecutando nitter_context MCP:`, error);
    throw error;
  }
}

/**
 * Ejecuta específicamente la herramienta perplexity_search para búsquedas web inteligentes
 * @param {string} query - Consulta de búsqueda web
 * @param {string} location - Contexto geográfico
 * @param {string} focus - Enfoque específico de la búsqueda
 * @param {boolean} improveNitterSearch - Si también generar términos optimizados para Nitter
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultado de la búsqueda web con Perplexity
 */
async function executePerplexitySearch(query, location = 'Guatemala', focus = 'general', improveNitterSearch = false, user = null) {
  try {
    console.log(`🔍 Ejecutando perplexity_search MCP: query="${query}", location="${location}", focus="${focus}", improveNitter=${improveNitterSearch}`);
    
    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar perplexity_search');
    }

    // Importar el servicio de Perplexity 
    const perplexityService = require('./perplexity');
    
    // Obtener fecha actual para contexto temporal
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    
         // Construir consulta optimizada basada en el enfoque - SIEMPRE CON FILTRO TEMPORAL
     let optimizedQuery = query;
     let searchContext = '';
     
     // FILTRO TEMPORAL OBLIGATORIO: Agregar contexto temporal actual SIEMPRE
     const temporalContext = `${currentMonth} ${currentYear} actual reciente`;
     
     switch (focus) {
       case 'noticias':
         optimizedQuery = `${query} noticias ${location} ${temporalContext} últimas`;
         searchContext = `noticias actuales y eventos recientes de ${currentMonth} ${currentYear}`;
         break;
       case 'eventos':
         optimizedQuery = `${query} eventos ${location} ${temporalContext} próximos`;
         searchContext = `eventos y actividades actuales de ${currentMonth} ${currentYear}`;
         break;
       case 'deportes':
         optimizedQuery = `${query} deportes ${location} ${temporalContext} temporada`;
         searchContext = `deportes y competencias actuales de ${currentMonth} ${currentYear}`;
         break;
       case 'politica':
         optimizedQuery = `${query} política ${location} ${temporalContext} gobierno`;
         searchContext = `política y gobierno actual de ${currentMonth} ${currentYear}`;
         break;
       case 'economia':
         optimizedQuery = `${query} economía ${location} ${temporalContext} últimas cifras`;
         searchContext = `economía y finanzas actuales de ${currentMonth} ${currentYear}`;
         break;
       case 'cultura':
         optimizedQuery = `${query} cultura ${location} ${temporalContext} entretenimiento`;
         searchContext = `cultura y entretenimiento actual de ${currentMonth} ${currentYear}`;
         break;
       default:
         optimizedQuery = `${query} ${location} ${temporalContext} información`;
         searchContext = `información general actualizada de ${currentMonth} ${currentYear}`;
     }

    console.log(`🎯 Consulta optimizada: "${optimizedQuery}"`);
    
         // Preparar prompt especializado para búsquedas web generales - CON ENFOQUE TEMPORAL
     const webSearchPrompt = `Analiza la consulta "${query}" y proporciona información completa y ACTUALIZADA.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}**
**CONTEXTO GEOGRÁFICO: ${location}**
**ENFOQUE: ${searchContext}**

⚠️ CRÍTICO - FILTRO TEMPORAL:
- SOLO busca información de ${currentMonth} ${currentYear} o MUY RECIENTE
- NO incluyas información histórica o de años anteriores
- Prioriza eventos, noticias y desarrollos ACTUALES
- Si no hay información reciente, especifica claramente que no hay datos actuales

INSTRUCCIONES ESPECÍFICAS:
1. Busca información ACTUALIZADA sobre "${query}" en el contexto de ${location} para ${currentMonth} ${currentYear}
2. Enfócate específicamente en ${searchContext}
3. Proporciona datos concretos de ${currentMonth} ${currentYear}, fechas específicas recientes
4. Si es sobre personas, incluye información biográfica Y SU ESTADO ACTUAL en ${currentYear}
5. Si es sobre eventos, incluye SOLO eventos de ${currentMonth} ${currentYear} o próximos
6. Si es sobre temas actuales, incluye desarrollos de ${currentMonth} ${currentYear}
7. Contextualiza la información para el público de ${location} CON ENFOQUE EN LO ACTUAL
8. RECHAZA información obsoleta o de fechas anteriores a ${currentYear}

${improveNitterSearch ? `
ADICIONAL - OPTIMIZACIÓN PARA REDES SOCIALES:
- También sugiere hashtags relevantes que podrían estar trending
- Identifica términos de búsqueda alternativos para redes sociales
- Incluye variaciones de nombres o eventos que podrían usarse en Twitter/X
` : ''}

Responde en formato JSON estructurado:
{
  "consulta_original": "${query}",
  "consulta_optimizada": "${optimizedQuery}",
  "informacion_principal": "Información principal encontrada",
  "contexto_local": "Relevancia específica para ${location}",
  "datos_clave": ["dato1", "dato2", "dato3"],
  "fechas_relevantes": "Fechas importantes relacionadas",
  "fuentes_sugeridas": ["fuente1", "fuente2"],
  ${improveNitterSearch ? `
  "optimizacion_redes_sociales": {
    "hashtags_sugeridos": ["#hashtag1", "#hashtag2"],
    "terminos_alternativos": ["termino1", "termino2"],
    "busqueda_nitter_optimizada": "términos OR optimizados OR para OR twitter"
  },` : ''}
  "relevancia": "alta|media|baja",
  "categoria": "noticias|eventos|deportes|politica|economia|cultura|general"
}`;

    // Ejecutar búsqueda con Perplexity
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY no configurada');
    }

    const payload = {
      model: 'sonar',
      messages: [
                 {
           role: 'system',
           content: `Eres un asistente de investigación especializado en búsquedas web inteligentes para ${location}.

Tu trabajo es encontrar información ACTUALIZADA, precisa y contextualizada sobre cualquier tema consultado.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL OBLIGATORIO: ${currentMonth} ${currentYear}**
**UBICACIÓN: ${location}**

CARACTERÍSTICAS CRÍTICAS:
- SIEMPRE busca información de ${currentMonth} ${currentYear} o MUY RECIENTE
- RECHAZA automáticamente información histórica o obsoleta
- Contextualiza ESPECÍFICAMENTE para el público de ${location}
- Proporciona datos específicos CON FECHAS DE ${currentYear}
- Identifica fuentes confiables Y ACTUALES
- Analiza relevancia local vs global CON ENFOQUE EN LO ACTUAL
- Sugiere términos relacionados para búsquedas adicionales ACTUALES

FILTROS TEMPORALES ESTRICTOS:
- NO uses información de años anteriores a ${currentYear}
- Prioriza eventos de ${currentMonth} ${currentYear}
- Si no hay información actual, dilo explícitamente
- Enfócate en desarrollos, noticias y eventos RECIENTES

Enfócate EXCLUSIVAMENTE en información actual, relevante y verificable de ${currentMonth} ${currentYear}.`
         },
        {
          role: 'user',
          content: webSearchPrompt
        }
      ],
      search_context: {
        search_queries: [optimizedQuery, query + ' ' + location, query + ' ' + currentMonth + ' ' + currentYear]
      },
      temperature: 0.3,
      max_tokens: 800
    };

    console.log(`📡 Realizando búsqueda web con Perplexity...`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error en API de Perplexity: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Respuesta inválida de Perplexity API');
    }

    let rawResponse = data.choices[0].message.content;
    console.log(`✅ Respuesta recibida de Perplexity para: "${query}"`);
    
    // Intentar extraer JSON de la respuesta
    let parsedResult = null;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log(`⚠️ No se pudo parsear JSON, usando respuesta raw`);
    }

    // Optimizar términos para Nitter si se solicitó
    let nitterOptimization = null;
    if (improveNitterSearch && parsedResult?.optimizacion_redes_sociales?.busqueda_nitter_optimizada) {
      nitterOptimization = {
        original_query: query,
        optimized_query: parsedResult.optimizacion_redes_sociales.busqueda_nitter_optimizada,
        suggested_hashtags: parsedResult.optimizacion_redes_sociales.hashtags_sugeridos || [],
        alternative_terms: parsedResult.optimizacion_redes_sociales.terminos_alternativos || []
      };
    }

    // Formatear respuesta para el agente AI
    const formattedResponse = parsedResult ? 
      `BÚSQUEDA WEB COMPLETADA PARA: "${query}"

INFORMACIÓN PRINCIPAL:
${parsedResult.informacion_principal}

CONTEXTO LOCAL (${location}):
${parsedResult.contexto_local}

DATOS CLAVE:
${parsedResult.datos_clave ? parsedResult.datos_clave.map(dato => `• ${dato}`).join('\n') : 'No disponible'}

FECHAS RELEVANTES:
${parsedResult.fechas_relevantes || 'No especificadas'}

FUENTES SUGERIDAS:
${parsedResult.fuentes_sugeridas ? parsedResult.fuentes_sugeridas.map(fuente => `• ${fuente}`).join('\n') : 'No disponible'}

${nitterOptimization ? `
OPTIMIZACIÓN PARA REDES SOCIALES:
• Búsqueda optimizada para Twitter/X: "${nitterOptimization.optimized_query}"
• Hashtags sugeridos: ${nitterOptimization.suggested_hashtags.join(', ')}
• Términos alternativos: ${nitterOptimization.alternative_terms.join(', ')}
` : ''}

RELEVANCIA: ${parsedResult.relevancia || 'No determinada'}
CATEGORÍA: ${parsedResult.categoria || 'general'}` 
    : 
      `BÚSQUEDA WEB COMPLETADA PARA: "${query}"

${rawResponse}

Consulta optimizada: "${optimizedQuery}"
Enfoque: ${searchContext}
Contexto: ${location}`;

    return {
      success: true,
      query_original: query,
      query_optimized: optimizedQuery,
      location: location,
      focus: focus,
      web_search_result: parsedResult || { raw_response: rawResponse },
      nitter_optimization: nitterOptimization,
      formatted_response: formattedResponse,
      metadata: {
        search_performed: true,
        perplexity_model: 'sonar',
        response_length: rawResponse.length,
        json_parsed: parsedResult !== null,
        nitter_optimization_included: nitterOptimization !== null,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando perplexity_search MCP:`, error);
    throw error;
  }
}

/**
 * Valida los parámetros de una herramienta
 * @param {Object} tool - Configuración de la herramienta
 * @param {Object} parameters - Parámetros a validar
 * @returns {Object} Resultado de validación
 */
function validateToolParameters(tool, parameters) {
  const errors = [];
  
  for (const [paramName, paramConfig] of Object.entries(tool.parameters)) {
    const value = parameters[paramName];
    
    // Verificar parámetros requeridos
    if (paramConfig.required && (value === undefined || value === null || value === '')) {
      errors.push(`Parámetro requerido faltante: ${paramName}`);
      continue;
    }
    
    // Si el parámetro no es requerido y no está presente, continuar
    if (!paramConfig.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Validar tipo
    if (paramConfig.type === 'string' && typeof value !== 'string') {
      errors.push(`${paramName} debe ser una cadena de texto`);
    }
    
    if (paramConfig.type === 'integer' && (!Number.isInteger(value) || value < 0)) {
      errors.push(`${paramName} debe ser un número entero positivo`);
    }
    
    // Validar rangos para enteros
    if (paramConfig.type === 'integer' && typeof value === 'number') {
      if (paramConfig.min !== undefined && value < paramConfig.min) {
        errors.push(`${paramName} debe ser mayor o igual a ${paramConfig.min}`);
      }
      if (paramConfig.max !== undefined && value > paramConfig.max) {
        errors.push(`${paramName} debe ser menor o igual a ${paramConfig.max}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Obtiene el estado general del MCP Server
 * @returns {Object} Estado del servidor
 */
async function getServerStatus() {
  try {
    const status = {
      server_name: 'ExtractorW MCP Server',
      version: '1.0.0',
      status: 'running',
      available_tools: Object.keys(AVAILABLE_TOOLS).length,
      tools_list: Object.keys(AVAILABLE_TOOLS),
      external_services: {}
    };

    // Verificar conectividad con ExtractorT
    try {
      const extractorTResponse = await axios.get(`${EXTRACTOR_T_URL}/status`, { timeout: 5000 });
      status.external_services.extractor_t = {
        url: EXTRACTOR_T_URL,
        status: 'connected',
        response_time: extractorTResponse.headers['x-process-time'] || 'unknown'
      };
    } catch (error) {
      status.external_services.extractor_t = {
        url: EXTRACTOR_T_URL,
        status: 'disconnected',
        error: error.message
      };
    }

    console.log('📊 Estado del MCP Server obtenido');
    return status;
  } catch (error) {
    console.error('❌ Error obteniendo estado MCP:', error);
    throw error;
  }
}

module.exports = {
  listAvailableTools,
  getToolInfo,
  executeTool,
  executeNitterContext,
  executePerplexitySearch,
  getServerStatus,
  expandSearchTerms,
  enhanceSearchTermsWithPerplexity,
  AVAILABLE_TOOLS
}; 