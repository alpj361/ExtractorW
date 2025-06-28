const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const mcpService = require('../services/mcp');
const recentScrapesService = require('../services/recentScrapes');

// ===================================================================
// VIZTA CHAT ROUTES
// Endpoints para el chat inteligente con integración MCP
// ===================================================================

// Cargar dependencias de forma condicional
let OpenAI, openai, uuidv4;

try {
  OpenAI = require('openai');
  const { v4 } = require('uuid');
  uuidv4 = v4;
  
  // Configurar OpenAI
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  console.log('✅ Dependencias de Vizta Chat cargadas correctamente');
} catch (error) {
  console.warn('⚠️ Dependencias de Vizta Chat no disponibles:', error.message);
  console.warn('📦 Instala las dependencias con: npm install openai uuid');
}

/**
 * POST /api/vizta-chat/query
 * Endpoint principal para consultas de Vizta Chat
 */
router.post('/query', verifyUserAccess, async (req, res) => {
  try {
    // Verificar que las dependencias estén disponibles
    if (!openai || !uuidv4) {
      // Fallback temporal sin OpenAI
      console.log('⚠️ Usando fallback sin OpenAI para Vizta Chat');
      
      const fallbackSessionId = sessionId || `fallback_${Date.now()}`;
      
      // Usar directamente nitter_context como herramienta por defecto
      try {
        const toolResult = await mcpService.executeTool('nitter_context', {
          q: message,
          location: 'guatemala',
          limit: 5
        }, req.user);
        
        if (toolResult.success && toolResult.tweets) {
          // Guardar en recent_scrapes
          await recentScrapesService.saveScrape({
            queryOriginal: message,
            queryClean: message,
            herramienta: 'nitter_context',
            categoria: 'General',
            tweets: toolResult.tweets,
            userId: userId,
            sessionId: fallbackSessionId,
            mcpRequestId: `fallback_${Date.now()}`,
            mcpExecutionTime: 0,
            location: 'guatemala'
          });
          
          return res.json({
            success: true,
            response: `He encontrado ${toolResult.tweets.length} tweets relacionados con "${message}". Los datos han sido guardados y están disponibles para análisis.`,
            toolUsed: 'nitter_context',
            toolArgs: { q: message, location: 'guatemala', limit: 5 },
            toolResult: toolResult,
            sessionId: fallbackSessionId,
            requestId: `fallback_${Date.now()}`,
            executionTime: 0,
            timestamp: new Date().toISOString(),
            mode: 'fallback'
          });
        } else {
          throw new Error('No se pudieron obtener tweets');
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Error en modo fallback: ' + error.message,
          error: 'Instala las dependencias con: npm run install-vizta'
        });
      }
    }

    const { message, sessionId } = req.body;
    const userId = req.user.id;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es requerido'
      });
    }

    console.log(`🤖 Nueva consulta Vizta Chat de usuario ${userId}: "${message}"`);

    // Generar IDs únicos
    const requestId = uuidv4();
    const chatSessionId = sessionId || uuidv4();

    // Obtener herramientas disponibles del MCP
    const availableTools = await mcpService.listAvailableTools();
    
    // Preparar funciones para GPT-4o mini
    const functions = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters,
        required: Object.keys(tool.parameters).filter(key => 
          tool.parameters[key].required === true
        )
      }
    }));

    // Llamar a GPT-4o mini con function calling
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres Vizta, un asistente de investigación especializado en análisis de redes sociales y tendencias en Guatemala. 

Tu trabajo es ayudar a los usuarios a obtener y analizar información de redes sociales usando las herramientas disponibles.

Herramientas disponibles:
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Cuando el usuario solicite información sobre tweets, tendencias, o análisis social, usa la herramienta nitter_context para obtener datos relevantes.

Instrucciones:
1. Analiza la consulta del usuario
2. Si necesitas datos de Twitter/X, usa nitter_context con parámetros apropiados
3. Proporciona análisis contextual y insights útiles
4. Mantén un tono profesional pero amigable
5. Enfócate en Guatemala cuando sea relevante`
        },
        {
          role: 'user',
          content: message
        }
      ],
      functions: functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    });

    const assistantMessage = completion.choices[0].message;

    // Si GPT decidió usar una función
    if (assistantMessage.function_call) {
      const functionName = assistantMessage.function_call.name;
      const functionArgs = JSON.parse(assistantMessage.function_call.arguments);
      
      console.log(`🔧 GPT decidió usar herramienta: ${functionName} con args:`, functionArgs);

      // Ejecutar la herramienta MCP
      const startTime = Date.now();
      const toolResult = await mcpService.executeTool(functionName, functionArgs, req.user);
      const executionTime = Date.now() - startTime;

      // Guardar en recent_scrapes si la herramienta devolvió tweets
      if (toolResult.success && toolResult.tweets) {
        await recentScrapesService.saveScrape({
          queryOriginal: message,
          queryClean: functionArgs.q || message,
          herramienta: functionName,
          categoria: 'General', // TODO: Implementar categorización automática
          tweets: toolResult.tweets,
          userId: userId,
          sessionId: chatSessionId,
          mcpRequestId: requestId,
          mcpExecutionTime: executionTime,
          location: functionArgs.location || 'guatemala'
        });
      }

      // Generar respuesta final con contexto
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres Vizta, un asistente de investigación. El usuario hizo una consulta y obtuviste datos usando la herramienta ${functionName}. 

Analiza los datos obtenidos y proporciona:
1. Un resumen claro de los hallazgos
2. Insights y patrones relevantes
3. Contexto sobre la situación en Guatemala
4. Recomendaciones si es apropiado

Datos obtenidos: ${JSON.stringify(toolResult, null, 2)}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const finalResponse = finalCompletion.choices[0].message.content;

      res.json({
        success: true,
        response: finalResponse,
        toolUsed: functionName,
        toolArgs: functionArgs,
        toolResult: toolResult,
        sessionId: chatSessionId,
        requestId: requestId,
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      });

    } else {
      // Respuesta directa sin usar herramientas
      res.json({
        success: true,
        response: assistantMessage.content,
        toolUsed: null,
        sessionId: chatSessionId,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Error en consulta Vizta Chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando consulta',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/scrapes
 * Obtener scrapes del usuario
 */
router.get('/scrapes', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset, herramienta, categoria, sessionId } = req.query;

    const scrapes = await recentScrapesService.getUserScrapes(userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      herramienta,
      categoria,
      sessionId
    });

    res.json({
      success: true,
      scrapes: scrapes,
      count: scrapes.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo scrapes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo scrapes',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/stats
 * Obtener estadísticas de scrapes del usuario
 */
router.get('/stats', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await recentScrapesService.getUserScrapeStats(userId);

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/session/:sessionId
 * Obtener scrapes de una sesión específica
 */
router.get('/session/:sessionId', verifyUserAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const scrapes = await recentScrapesService.getSessionScrapes(sessionId);

    res.json({
      success: true,
      scrapes: scrapes,
      sessionId: sessionId,
      count: scrapes.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo scrapes de sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo scrapes de sesión',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/tools
 * Obtener herramientas MCP disponibles
 */
router.get('/tools', verifyUserAccess, async (req, res) => {
  try {
    const tools = await mcpService.listAvailableTools();

    res.json({
      success: true,
      tools: tools,
      count: tools.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo herramientas MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo herramientas',
      error: error.message
    });
  }
});

module.exports = router; 