const axios = require('axios');
const { processNitterContext } = require('./nitterContext');

// ===================================================================
// MCP SERVICE - Micro Command Processor
// Orquestador central de herramientas para agentes IA
// ===================================================================

// Configuración de servicios externos
const EXTRACTOR_T_URL = process.env.EXTRACTOR_T_URL || 'https://api.standatpd.com';

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
    
    // Generar session_id si no se proporciona
    const finalSessionId = sessionId || `mcp_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Usar el servicio completo de nitterContext
    const result = await processNitterContext(
      query.trim(),
      user.id,
      finalSessionId,
      location,
      parseInt(limit)
    );

    if (result.success) {
      console.log(`✅ Nitter context procesado exitosamente: ${result.data.tweets_found} tweets analizados`);
      
      // Formatear respuesta para el agente AI
      const formattedTweets = result.data.tweets.map(tweet => 
        `@${tweet.usuario} (${tweet.fecha_tweet}): ${tweet.texto}\n` +
        `   📊 Sentimiento: ${tweet.sentimiento} (${tweet.score_sentimiento}) | ` +
        `Intención: ${tweet.intencion_comunicativa}\n` +
        `   💬 Engagement: ❤️${tweet.likes} 🔄${tweet.retweets} 💬${tweet.replies} | ` +
        `Entidades: ${tweet.entidades_mencionadas.length}\n`
      ).join('\n');
      
      return {
        success: true,
        content: `Análisis completo de ${result.data.tweets_found} tweets sobre "${query}" en ${location}:\n\n` +
                 `📊 Categoría: ${result.data.categoria}\n` +
                 `💬 Engagement total: ${result.data.total_engagement}\n` +
                 `📈 Engagement promedio: ${result.data.avg_engagement}\n` +
                 `⏱️ Tiempo de procesamiento: ${result.data.execution_time}ms\n\n` +
                 `🐦 Tweets analizados:\n${formattedTweets}\n` +
                 `📝 ${result.data.summary}`,
        query: query,
        location: location,
        session_id: finalSessionId,
        categoria: result.data.categoria,
        tweet_count: result.data.tweets_found,
        tweets_saved: result.data.tweets_saved,
        total_engagement: result.data.total_engagement,
        avg_engagement: result.data.avg_engagement,
        execution_time: result.data.execution_time,
        tweets: result.data.tweets,
        summary: result.data.summary,
        message: `${result.data.tweets_found} tweets analizados y guardados con Gemini AI`
      };
    } else {
      throw new Error(result.error || 'Error procesando nitter_context');
    }
  } catch (error) {
    console.error('❌ Error ejecutando nitter_context MCP:', error);
    
    // Manejar errores específicos
    if (error.message.includes('ExtractorT no está disponible')) {
      throw new Error('ExtractorT no está disponible. Verifique que el servicio esté ejecutándose.');
    }
    
    if (error.message.includes('GEMINI_API_KEY')) {
      throw new Error('Configuración de Gemini AI requerida. Verifique GEMINI_API_KEY.');
    }
    
    if (error.message.includes('SUPABASE')) {
      throw new Error('Error de base de datos. Verifique configuración de Supabase.');
    }
    
    throw new Error(`Error obteniendo contexto de Nitter: ${error.message}`);
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