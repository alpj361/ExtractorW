const axios = require('axios');
const { processNitterContext } = require('./nitterContext');

// ===================================================================
// MCP SERVICE - Micro Command Processor
// Orquestador central de herramientas para agentes IA
// ===================================================================

// Configuración de servicios externos
const EXTRACTOR_T_URL = process.env.EXTRACTOR_T_URL || 'https://api.standatpd.com';

/**
 * Expansión inteligente de términos de búsqueda para Twitter
 * Convierte consultas generales en búsquedas estratégicas específicas
 */
function expandSearchTerms(originalQuery) {
  const query = originalQuery.toLowerCase().trim();
  
  // Diccionario de expansiones específicas para Guatemala
  const expansions = {
    // Eventos y marchas
    'marcha del orgullo': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad',
    'orgullo': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad',
    'pride': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad',
    
    // Política
    'elecciones': 'EleccionesGt OR TSE OR voto OR candidatos OR Elecciones2025 OR procesoelectoral',
    'presidente': 'BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR Presidencia',
    'gobierno': 'GobiernoGt OR BernardoArevalo OR CasaPresidencial OR Presidencia OR ejecutivo',
    'congreso': 'CongresoGt OR diputados OR legislativo OR plenaria OR bancada',
    
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
    // Política
    { keys: ['bernardo', 'arevalo'], expansion: 'BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial' },
    { keys: ['giammattei'], expansion: 'Giammattei OR expresidente OR gobiernoanterior' },
    { keys: ['tse'], expansion: 'TSE OR tribunal OR electoral OR elecciones OR voto' },
    { keys: ['mp', 'ministerio publico'], expansion: 'MP OR MinisterioPublico OR fiscalia OR ContraCosta' },
    
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

  // Si no hay expansión específica, agregar contexto guatemalteco
  const contextualizedQuery = `${originalQuery} OR ${originalQuery}Gt OR ${originalQuery}Guatemala`;
  console.log(`📝 Consulta contextualizada: "${originalQuery}" → "${contextualizedQuery}"`);
  
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
  getServerStatus,
  AVAILABLE_TOOLS
}; 