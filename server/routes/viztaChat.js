const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const mcpService = require('../services/mcp');
const recentScrapesService = require('../services/recentScrapes');
const memoriesService = require('../services/memories');
const agentesService = require('../services/agentesService');
const supabase = require('../utils/supabase');

// ===================================================================
// VIZTA CHAT ROUTES
// Endpoints para el chat inteligente con integración MCP
// ===================================================================

/**
 * Post-procesa respuestas del chat para asegurar formato consistente
 */
function formatChatResponse(response, toolResult = null) {
  try {
    // Si es un objeto de respuesta modular, mantener su estructura
    if (typeof response === 'object' && response !== null) {
      // Si ya tiene la estructura correcta, devolverlo como está
      if (response.response && response.response.message) {
        return response;
      }
      
      // Si es una respuesta directa, darle la estructura correcta
      if (response.message) {
        return {
          success: true,
          response: {
            agent: response.agent || 'Vizta',
            message: response.message,
            type: response.type || 'chat_response',
            timestamp: response.timestamp || new Date().toISOString()
          },
          metadata: response.metadata || {}
        };
      }
    }

    // Si es string, aplicar el formateo
    let formattedText = response;

    // Limpiar respuesta muy larga
    if (formattedText && formattedText.length > 2000) {
      console.log('⚠️ Respuesta muy larga, truncando...');
      formattedText = formattedText.substring(0, 1800) + '\n\n*[Respuesta truncada para mejor legibilidad]*';
    }

    // Asegurar que tenga formato markdown básico si no lo tiene
    if (typeof formattedText === 'string' && !formattedText.includes('##') && !formattedText.includes('###')) {
      const lines = formattedText.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        let formatted = `## 📊 Análisis\n\n`;
        formatted += lines.join('\n\n');
        
        // Agregar resumen de datos si disponible
        if (toolResult && toolResult.tweets_found) {
          formatted += `\n\n### 📊 Datos analizados:\n• ${toolResult.tweets_found} tweets encontrados`;
          if (toolResult.analysis_metadata?.sentiment_distribution) {
            const sentiments = Object.entries(toolResult.analysis_metadata.sentiment_distribution);
            if (sentiments.length > 0) {
              formatted += `\n• Sentimientos: ${sentiments.map(([s, c]) => `${s} (${c})`).join(', ')}`;
            }
          }
        }
        
        formattedText = formatted;
      }
    }

    // Si es string, limpiar formato
    if (typeof formattedText === 'string') {
      // Limpiar texto muy corrido (sin espacios entre párrafos)
      formattedText = formattedText
        .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea consecutivos
        .replace(/(\w)(\n)(### |## |\*\*)/g, '$1\n\n$3') // Espacios antes de headers
        .replace(/(\w)(\n)(• )/g, '$1\n\n$3') // Espacios antes de bullets
        .trim();

      // Asegurar que los emojis tengan espacio después
      formattedText = formattedText.replace(/([📊📈💭⚡🎯🔍])([A-Za-z])/g, '$1 $2');
    }

    // Devolver con estructura estándar
    return {
      success: true,
      response: {
        agent: 'Vizta',
        message: formattedText || 'No hay respuesta disponible',
        type: 'chat_response',
        timestamp: new Date().toISOString()
      },
      metadata: {
        formatted: true,
        hasToolResult: !!toolResult
      }
    };

  } catch (error) {
    console.error('❌ Error formateando respuesta:', error);
    return {
      success: false,
      response: {
        agent: 'Vizta',
        message: typeof response === 'string' ? response : response?.message || 'Error formateando respuesta',
        type: 'error',
        timestamp: new Date().toISOString()
      },
      metadata: {
        error: true,
        errorMessage: error.message
      }
    };
  }
}

// Cargar dependencias de forma condicional
let OpenAI, openai, uuidv4, openPipeService;

try {
  OpenAI = require('openai');
  const { v4 } = require('uuid');
  uuidv4 = v4;
  
  // Configurar OpenAI (para fallback)
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  // Configurar OpenPipe Service
  openPipeService = require('../services/openPipeService');
  
  console.log('✅ Dependencias de Vizta Chat cargadas correctamente');
  console.log('🎯 OpenPipe Service inicializado para function calling');
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
          limit: 25
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

    // 1. Guardar mensaje del usuario en memories
    await memoriesService.saveMessage({
      sessionId: chatSessionId,
      userId: userId,
      role: 'user',
      content: message,
      messageType: 'message',
      modelUsed: 'gpt-4o-mini',
      metadata: { requestId: requestId }
    });

    // 2. Obtener los últimos 10 mensajes de la conversación para contexto
    const conversationHistory = await memoriesService.getSessionMessages(chatSessionId, 10);
    const previousMessages = memoriesService.formatMessagesForOpenAI(conversationHistory);

    console.log('🎯 Iniciando orquestación con sistema modular...');
    
    const startTime = Date.now();
    
    // PASO 1: Clasificar intención con LLM
    const intentClassification = await classifyIntentWithLLM(message);
    console.log(`🧠 Intención detectada: ${intentClassification.intent} (${intentClassification.confidence})`);
    console.log(`💭 Razonamiento: ${intentClassification.reasoning}`);

    let result;
    
    if (intentClassification.intent === 'casual_chat') {
      // Manejar conversación casual directamente
      result = {
        success: true,
        response: {
          agent: 'Vizta',
          message: await generateCasualResponse(message),
          type: 'casual_conversation',
          timestamp: new Date().toISOString()
        },
        conversationId: chatSessionId,
        metadata: {
          conversationType: 'casual',
          processingTime: Date.now() - startTime
        }
      };

      // Guardar respuesta casual en el historial
      await saveToHistory(req.user.id, message, result.response.message, chatSessionId);

    } else if (intentClassification.intent === 'codex_search') {
      // PASO 2: Búsqueda en Codex
      result = await processCodexSearch(message, req.user, chatSessionId);
      
    } else if (intentClassification.intent === 'project_search') {
      // PASO 3: Búsqueda en Proyectos
      result = await processProjectSearch(message, req.user, chatSessionId);
      
    } else {
      // PASO 3: Para consultas no casuales, usar OpenPipe con function calling
      console.log('🎯 Usando OpenPipe para function calling optimizado...');
      
      const openPipeResult = await openPipeService.processViztaQuery(message, req.user, chatSessionId);
      
      if (openPipeResult.success && openPipeResult.type === 'function_call') {
        // Ejecutar TODAS las herramientas decididas por el modelo en orden
        const toolCalls = Array.isArray(openPipeResult.allFunctionCalls) && openPipeResult.allFunctionCalls.length > 0
          ? openPipeResult.allFunctionCalls
          : [openPipeResult.functionCall];
        
        const toolExecutions = [];
        for (const call of toolCalls) {
          // Normalizar estructura de tool_call del SDK de OpenAI/OpenPipe
          const normalized = call.function
            ? { name: call.function.name, arguments: call.function.arguments }
            : call; // ya viene como { name, arguments }
          
          const toolName = normalized.name || 'desconocido';
          let argsObj = undefined;
          try {
            argsObj = typeof normalized.arguments === 'string'
              ? JSON.parse(normalized.arguments || '{}')
              : (normalized.arguments || {});
          } catch (e) {
            console.warn(`⚠️ No se pudo parsear arguments de ${toolName}:`, e.message);
          }

          console.log(`🔧 Ejecutando función: ${toolName}`);
          const exec = await openPipeService.executeFunctionCall(
            { name: toolName, arguments: argsObj },
            req.user,
            chatSessionId
          );
          toolExecutions.push({ call: normalized, exec });
          
          // Persistir breve rastro de cada ejecución en memories
          try {
            await memoriesService.saveMessage({
              userId: req.user.id,
              sessionId: chatSessionId,
              role: 'assistant',
              content: exec?.success ? `✅ Herramienta ${toolName} ejecutada` : `❌ Error ejecutando ${toolName}: ${exec?.error || 'desconocido'}`,
              messageType: 'function_result',
              metadata: {
                conversationType: 'function_call',
                functionCall: call,
                functionResult: exec
              }
            });
          } catch (e) {
            console.warn('⚠️ No se pudo guardar rastro de ejecución en memories:', e.message);
          }
        }
        
        // Construir respuesta final priorizando la última herramienta ejecutada
        const last = toolExecutions[toolExecutions.length - 1];
        const lastToolName = last?.call?.name || last?.call?.function?.name || 'desconocido';
        const lastExec = last?.exec || {};
        
        result = {
          success: lastExec.success,
          response: {
            agent: lastExec.agent || 'Vizta',
            message: await formatFunctionResult(lastExec, message),
            type: 'function_response',
            timestamp: new Date().toISOString(),
            functionUsed: lastToolName,
            data: lastExec.data
          },
          conversationId: chatSessionId,
          metadata: {
            conversationType: 'function_call',
            functionCalls: toolCalls,
            executions: toolExecutions.map(te => ({
              tool: te.call?.name || te.call?.function?.name,
              success: !!te.exec?.success
            })),
            agent: lastExec.agent,
            processingTime: Date.now() - startTime,
            openPipeUsage: openPipeResult.usage
          }
        };
        
      } else if (openPipeResult.success && openPipeResult.type === 'conversational') {
        // Respuesta conversacional directa de OpenPipe
        result = {
          success: true,
          response: {
            agent: 'Vizta',
            message: openPipeResult.message,
            type: 'conversational_ai',
            timestamp: new Date().toISOString()
          },
          conversationId: chatSessionId,
          metadata: {
            conversationType: 'ai_conversational',
            processingTime: Date.now() - startTime,
            openPipeUsage: openPipeResult.usage
          }
        };
        
      } else {
        // Fallback al sistema modular si OpenPipe falla
        console.log('⚠️ OpenPipe falló, usando fallback al sistema modular');
        result = await agentesService.processUserQuery(message, req.user, {
          sessionId: chatSessionId,
          previousMessages: previousMessages
        });
      }
    }

    // Formatear respuesta para el chat y asegurar estructura correcta
    const finalResponse = formatChatResponse(result);

    // Guardar en historial si no es casual
    if (intentClassification.intent !== 'casual_chat') {
      // Extraer solo el texto del mensaje para guardar
      const messageToSave = typeof finalResponse.response?.message === 'string' 
        ? finalResponse.response.message 
        : JSON.stringify(finalResponse.response);

      await saveToHistory(req.user.id, message, messageToSave, chatSessionId);
    }
    
    return res.json(finalResponse);

  } catch (error) {
    console.error('❌ Error en consulta Vizta Chat:', error);
    return res.status(500).json({
      error: 'Error procesando consulta',
      details: error.message
    });
  }
});

// Función helper para guardar en historial
async function saveToHistory(userId, message, response, sessionId) {
  try {
    await memoriesService.saveMessage({
      sessionId: sessionId,
      userId: userId,
      role: 'assistant',
      content: response,
      messageType: 'message',
      modelUsed: 'modular-system',
      metadata: {
        type: 'chat_response',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error guardando en historial:', error);
    // No lanzar el error para no interrumpir el flujo principal
  }
}

// Función para formatear resultados de function calling
async function formatFunctionResult(functionResult, originalQuery) {
  try {
    if (!functionResult.success) {
      return `❌ Error ejecutando ${functionResult.tool}: ${functionResult.error}`;
    }

    const { agent, tool, data } = functionResult;
    
    switch (tool) {
      case 'nitter_context':
        if (data.tweets && data.tweets.length > 0) {
          return `📊 **Análisis de ${data.tweets.length} tweets sobre "${originalQuery}"**\n\n` +
                 `✅ Encontré conversaciones relevantes en Twitter sobre este tema.\n` +
                 `🎯 **Tendencias detectadas:** ${data.tweets.slice(0, 3).map(t => t.text?.substring(0, 100) + '...').join('\n• ')}\n\n` +
                 `💡 Los datos han sido procesados por ${agent} y están disponibles para análisis detallado.`;
        } else {
          return `🔍 No se encontraron tweets recientes sobre "${originalQuery}". Intenta con términos diferentes o más específicos.`;
        }
        
      case 'nitter_profile':
        if (data.tweets && data.tweets.length > 0) {
          return `👤 **Posts recientes de @${data.username || 'usuario'}**\n\n` +
                 `📝 Últimos ${data.tweets.length} posts analizados por ${agent}.\n` +
                 `🗓️ Desde: ${new Date(data.tweets[data.tweets.length - 1]?.created_at || Date.now()).toLocaleDateString()}\n\n` +
                 `💬 **Contenido reciente:** ${data.tweets.slice(0, 2).map(t => `"${t.text?.substring(0, 150) + '...'}"`).join('\n• ')}\n\n` +
                 `✅ Análisis completo disponible en el sistema.`;
        } else {
          return `❌ No se pudieron obtener posts del perfil solicitado. El usuario podría tener perfil privado o no existir.`;
        }
        
      case 'perplexity_search':
        if (data.answer) {
          return `🔍 **Información encontrada sobre "${originalQuery}"**\n\n${data.answer}\n\n` +
                 `📚 *Investigación realizada por ${agent} usando fuentes web actualizadas.*`;
        } else {
          return `🔍 Búsqueda realizada por ${agent}, pero no se encontró información específica sobre "${originalQuery}".`;
        }
        
      case 'search_political_context':
        if (data && data.length > 0) {
          return `🧠 **Información en memoria política**\n\n` +
                 `✅ Encontré ${data.length} resultado(s) relevante(s) en mi memoria sobre "${originalQuery}":\n\n` +
                 `${data.slice(0, 3).map((item, i) => `${i + 1}. ${item.substring(0, 200) + '...'}`).join('\n')}\n\n` +
                 `💭 *Datos recuperados por ${agent} desde la sesión pulse-politics.*`;
        } else {
          return `🧠 Busqué en mi memoria política pero no encontré información específica sobre "${originalQuery}". Podría estar en fuentes externas.`;
        }
        
      case 'resolve_twitter_handle':
        if (data.handle) {
          return `🔍 **Handle encontrado:** @${data.handle}\n\n` +
                 `✅ ${agent} identificó la cuenta de Twitter asociada con "${originalQuery}".\n` +
                 `📱 Ahora puedo extraer sus posts si lo necesitas.`;
        } else {
          return `❌ No se pudo encontrar el handle de Twitter para "${originalQuery}". La persona podría no tener cuenta pública.`;
        }
        
      case 'user_projects':
        if (data.projects && data.projects.length > 0) {
          const activeProjects = data.projects.filter(p => p.status === 'active').length;
          return `📋 **Tus Proyectos**\n\n` +
                 `✅ Tienes **${data.count}** proyecto(s) total, **${activeProjects}** activo(s).\n\n` +
                 `🎯 **Proyectos recientes:**\n${data.projects.slice(0, 5).map(p => `• ${p.title} (${p.status})`).join('\n')}\n\n` +
                 `📊 *Datos gestionados por ${agent}.*`;
        } else {
          return `📋 No tienes proyectos registrados aún. ¿Te gustaría que te ayude a crear uno?`;
        }
        
      case 'user_codex':
        if (data.items && data.items.length > 0) {
          return `📚 **Elementos encontrados en tu Codex**\n\n` +
                 `✅ Encontré **${data.count}** elemento(s) relacionado(s) con "${originalQuery}":\n\n` +
                 `${data.items.slice(0, 5).map(item => `📄 ${item.titulo} (${item.tipo})\n   ${item.descripcion?.substring(0, 100) + '...' || 'Sin descripción'}`).join('\n\n')}\n\n` +
                 `🔍 *Búsqueda realizada por ${agent} en tu biblioteca personal.*`;
        } else {
          return `📚 No encontré elementos en tu Codex relacionados con "${originalQuery}". Intenta con términos diferentes.`;
        }
        
      default:
        return `✅ ${agent} procesó tu consulta usando ${tool}. Resultado disponible en el sistema.`;
    }
    
  } catch (error) {
    console.error('❌ Error formateando resultado de función:', error);
    return `✅ Función ejecutada por ${functionResult.agent || 'Agente'}, pero hubo un error formateando la respuesta.`;
  }
}

// Función para clasificar intención con LLM
async function classifyIntentWithLLM(message) {
  const classificationPrompt = `
Analiza el siguiente mensaje del usuario y clasifica su intención principal.

TIPOS DE INTENCIÓN:
1. codex_search - Usuario quiere buscar, revisar o consultar algo específico en el Codex
2. project_search - Usuario quiere buscar, revisar o consultar información sobre sus proyectos
3. agent_request - Usuario solicita un agente especializado o herramienta específica  
4. casual_chat - Conversación casual, saludo, charla general sin objetivo específico
5. technical_help - Ayuda técnica, programación, configuración
6. information_query - Pregunta informativa general

INSTRUCCIONES:
- Ignora el tono informal o formal del mensaje
- Enfócate en la INTENCIÓN REAL detrás de las palabras
- Si menciona "Codex" o quiere "revisar/ver/buscar algo en el codex", es codex_search
- Si menciona "proyectos", "proyecto", "tareas", "decisiones", "colaboradores", es project_search
- Si es solo saludo sin objetivo específico, es casual_chat

Mensaje del usuario: "${message}"

Responde SOLO en este formato JSON:
{
  "intent": "tipo_de_intencion",
  "confidence": 0.95,
  "reasoning": "Breve explicación de por qué clasificaste así"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: classificationPrompt }],
      temperature: 0.1,
      max_tokens: 150
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Validación básica
    const validIntents = ['codex_search', 'project_search', 'agent_request', 'casual_chat', 'technical_help', 'information_query'];
    if (!validIntents.includes(result.intent)) {
      throw new Error('Intent no válido recibido del LLM');
    }

    return result;
    
  } catch (error) {
    console.error('❌ Error en clasificación de intención:', error);
    // Fallback seguro
    return {
      intent: 'casual_chat',
      confidence: 0.5,
      reasoning: 'Error en clasificación, usando fallback'
    };
  }
}

// Función para procesar búsquedas en Codex con análisis LLM
async function processCodexSearch(message, user, sessionId) {
  try {
    console.log('🔍 Procesando búsqueda contextual en Codex...');
    
    // PASO 1: LLM genera términos de búsqueda contextuales con historial
    const conversationHistory = await memoriesService.getSessionMessages(sessionId, 5);
    const searchTerms = await generateContextualSearchTerms(message, conversationHistory);
    console.log(`🧠 Términos contextuales generados:`, searchTerms);
    
    // PASO 2: Buscar con múltiples términos contextuales y relaciones
    const codexResults = await searchCodexWithTerms(searchTerms, user.id, conversationHistory);
    console.log(`📊 Encontrados ${codexResults?.length || 0} resultados en Codex`);

    // PASO 3: LLM analiza relevancia de resultados
    if (codexResults && codexResults.length > 0) {
      const analysisResult = await analyzeCodexRelevance(message, codexResults);
      return analysisResult;
    }

    // Sin resultados
    return {
      success: true,
      response: {
        agent: 'Codex',
        message: `🔍 **Búsqueda contextual en Codex**\n\n❌ No encontré elementos relacionados con tu consulta en el Codex.\n\n**Tu consulta:** "${message}"\n**Términos analizados:** ${searchTerms.join(', ')}\n\n💡 **Sugerencias:**\n• Intenta con una descripción diferente\n• Usa sinónimos o términos relacionados\n• Pregunta sobre temas más específicos`,
        type: 'codex_search',
        timestamp: new Date().toISOString()
      },
      metadata: {
        searchTerms: searchTerms,
        originalMessage: message,
        resultsCount: 0,
        userId: user.id,
        sessionId: sessionId
      }
    };
    
  } catch (error) {
    console.error('❌ Error en búsqueda contextual Codex:', error);
    return {
      success: false,
      response: {
        agent: 'Codex',
        message: `❌ **Error en búsqueda del Codex**\n\nNo pude completar la búsqueda debido a un error técnico:\n${error.message}\n\nPor favor, intenta nuevamente.`,
        type: 'error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Función para generar términos de búsqueda contextuales con LLM
async function generateContextualSearchTerms(userQuery, conversationHistory = []) {
  const contextMessages = conversationHistory
    .slice(-5) // últimos 5 mensajes
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  const searchPrompt = `
Analiza la siguiente consulta del usuario y genera términos de búsqueda contextuales inteligentes.

CONSULTA ACTUAL: "${userQuery}"

HISTORIAL DE CONVERSACIÓN RECIENTE:
${contextMessages}

INSTRUCCIONES:
- Si el usuario usa referencias como "ese proyecto", "eso", "lo anterior", usa el historial para identificar a qué se refiere específicamente
- Identifica el tema/concepto principal que busca
- Genera 3-5 términos de búsqueda relacionados basados en el contexto completo
- Incluye sinónimos, términos relacionados y variaciones
- NO uses palabras vacías como "hola", "revisame", "tengo", "algo de"
- Enfócate en sustantivos, conceptos y términos específicos
- Si hay nombres de proyectos o conceptos específicos mencionados antes, inclúyelos

EJEMPLO:
Historial: "user: cuántos proyectos tengo? assistant: Tienes 3 proyectos: Marketing Digital (activo)..."
Consulta: "dime elementos del codex de ese proyecto"
Términos: ["Marketing Digital", "marketing", "digital", "proyecto marketing", "elementos codex"]

Responde SOLO con un array JSON de términos:
["término1", "término2", "término3"]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: searchPrompt }],
      temperature: 0.3,
      max_tokens: 300
    });

    let responseText = response.choices[0].message.content.trim();
    
    // Limpiar formato markdown si existe
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    responseText = responseText.replace(/`/g, '');
    
    const termsArray = JSON.parse(responseText);
    return Array.isArray(termsArray) ? termsArray : [userQuery];
    
  } catch (error) {
    console.error('❌ Error generando términos contextuales:', error);
    // Fallback básico
    return [userQuery.replace(/[¿?]/g, '').trim()];
  }
}

// Función para buscar en Codex con múltiples términos y relaciones
async function searchCodexWithTerms(searchTerms, userId, conversationHistory = []) {
  try {
    const allResults = [];
    
    // PASO 1: Intentar búsqueda relacional inteligente basada en contexto
    const relationalResults = await performRelationalCodexSearch(searchTerms, userId, conversationHistory);
    if (relationalResults.length > 0) {
      console.log(`🔗 Encontrados ${relationalResults.length} resultados relacionales`);
      allResults.push(...relationalResults);
    }
    
    // PASO 2: Búsqueda tradicional por términos
    for (const term of searchTerms) {
      const { data: results } = await supabase
        .from('codex_items')
        .select(`
          id, titulo, descripcion, tipo, etiquetas, proyecto, project_id,
          audio_transcription, document_analysis, created_at, fecha
        `)
        .eq('user_id', userId)
        .or(`titulo.ilike.%${term}%,descripcion.ilike.%${term}%,audio_transcription.ilike.%${term}%,document_analysis.ilike.%${term}%`)
        .limit(6);
        
      if (results) {
        allResults.push(...results);
      }
    }
    
    // Eliminar duplicados y ordenar
    const uniqueResults = allResults.filter((item, index, self) => 
      index === self.findIndex(i => i.id === item.id)
    );
    
    return uniqueResults
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 15);
      
  } catch (error) {
    console.error('❌ Error en búsqueda con términos:', error);
    return [];
  }
}

// Función para búsqueda relacional inteligente en Codex
async function performRelationalCodexSearch(searchTerms, userId, conversationHistory) {
  try {
    console.log('🔗 Intentando búsqueda relacional...');
    
    // Detectar si hay referencia a proyectos en el historial
    const projectContext = await extractProjectContext(conversationHistory, searchTerms);
    
    if (projectContext.projectName) {
      console.log(`🎯 Proyecto identificado: ${projectContext.projectName}`);
      
      // Buscar el proyecto específico
      const { data: project } = await supabase
        .from('projects')
        .select('id, title')
        .eq('user_id', userId)
        .ilike('title', `%${projectContext.projectName}%`)
        .single();
        
      if (project) {
        console.log(`✅ Proyecto encontrado: ${project.title} (${project.id})`);
        
        // Buscar elementos del codex asociados a este proyecto
        const { data: codexItems } = await supabase
          .from('codex_items')
          .select(`
            id, titulo, descripcion, tipo, etiquetas, proyecto, project_id,
            audio_transcription, document_analysis, created_at, fecha
          `)
          .eq('user_id', userId)
          .eq('project_id', project.id)
          .limit(10);
          
        if (codexItems && codexItems.length > 0) {
          console.log(`🎉 Encontrados ${codexItems.length} elementos del codex para proyecto ${project.title}`);
          return codexItems;
        }
      }
    }
    
    return [];
    
  } catch (error) {
    console.error('❌ Error en búsqueda relacional:', error);
    return [];
  }
}

// Función para extraer contexto de proyecto del historial
async function extractProjectContext(conversationHistory, searchTerms) {
  const contextPrompt = `
Analiza el historial de conversación y los términos de búsqueda para identificar si hay una referencia específica a un proyecto.

HISTORIAL:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

TÉRMINOS DE BÚSQUEDA: ${searchTerms.join(', ')}

INSTRUCCIONES:
- Busca nombres específicos de proyectos mencionados en el historial
- Si hay referencia a "ese proyecto", "mi proyecto", identifica cuál proyecto específico
- Extrae el nombre exacto del proyecto si está disponible
- Si no hay referencia clara a un proyecto específico, devuelve null

Responde SOLO en formato JSON:
{
  "projectName": "nombre exacto del proyecto o null",
  "confidence": 0.0-1.0,
  "reasoning": "explicación breve"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: contextPrompt }],
      temperature: 0.2,
      max_tokens: 150
    });

    let responseText = response.choices[0].message.content.trim();
    
    // Limpiar formato markdown si existe
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    responseText = responseText.replace(/`/g, '');
    
    console.log('🔍 Respuesta del LLM para contexto:', responseText);
    
    const context = JSON.parse(responseText);
    return context;
    
  } catch (error) {
    console.error('❌ Error extrayendo contexto de proyecto:', error);
    console.error('❌ Respuesta problemática:', response?.choices?.[0]?.message?.content);
    return { projectName: null, confidence: 0, reasoning: 'Error en análisis' };
  }
}

// Función para analizar relevancia con LLM
async function analyzeCodexRelevance(userQuery, codexResults) {
  const analysisPrompt = `
Responde de forma simple y directa sobre estos elementos del Codex del usuario.

CONSULTA: "${userQuery}"

ELEMENTOS ENCONTRADOS:
${codexResults.map((item, index) => `
${index + 1}. ${item.titulo} (${item.tipo})
   ${item.descripcion || ''}
   ${item.audio_transcription ? `Transcripción: ${item.audio_transcription.substring(0, 300)}...` : ''}
   ${item.document_analysis ? `Análisis: ${item.document_analysis.substring(0, 300)}...` : ''}
`).join('\n')}

INSTRUCCIONES:
- Responde en máximo 3-4 líneas
- Sé directo: "Encontré X elementos sobre Y"
- Menciona solo lo más relevante
- Tono casual y amigable
- NO hagas análisis extensos ni explicaciones largas

Ejemplo: "Encontré 2 elementos sobre LGBT. Hay una transcripción que habla de AESDI y la lucha estudiantil LGBT, y un enlace que parece no funcionar."

Responde de forma simple:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    return {
      success: true,
      response: {
        agent: 'Codex',
        message: response.choices[0].message.content,
        type: 'codex_search',
        timestamp: new Date().toISOString()
      },
      metadata: {
        originalMessage: userQuery,
        resultsCount: codexResults.length,
        results: codexResults
      }
    };
    
  } catch (error) {
    console.error('❌ Error en análisis de relevancia:', error);
    
    // Fallback con formato básico
    let message = `🔍 **Búsqueda en Codex**\n\n✅ Encontré **${codexResults.length}** elemento(s) relacionado(s):\n\n`;
    
    codexResults.slice(0, 5).forEach((item, index) => {
      message += `**${index + 1}. ${item.titulo}**\n`;
      message += `   📂 ${item.tipo} • 📅 ${new Date(item.created_at).toLocaleDateString()}\n`;
      if (item.descripcion) {
        message += `   📝 ${item.descripcion.substring(0, 150)}...\n`;
      }
      message += `\n`;
    });
    
    return {
      success: true,
      response: {
        agent: 'Codex',
        message: message,
        type: 'codex_search',
        timestamp: new Date().toISOString()
      },
      metadata: {
        originalMessage: userQuery,
        resultsCount: codexResults.length,
        results: codexResults
      }
    };
  }
}

// Función para procesar búsquedas en Proyectos con análisis LLM
async function processProjectSearch(message, user, sessionId) {
  try {
    console.log('🔍 Procesando búsqueda contextual en Proyectos...');
    
    // PASO 1: LLM analiza el tipo de consulta sobre proyectos
    const queryAnalysis = await analyzeProjectQueryType(message);
    console.log(`🧠 Análisis de consulta:`, queryAnalysis);
    
    if (queryAnalysis.type === 'statistics') {
      // Manejo especial para consultas de estadísticas
      const statsResult = await processProjectStatsWithLLM(message, user.id, queryAnalysis);
      return statsResult;
    }
    
    // PASO 2: LLM genera términos de búsqueda contextuales para proyectos con historial
    const conversationHistory = await memoriesService.getSessionMessages(sessionId, 5);
    const searchTerms = await generateProjectSearchTerms(message, conversationHistory);
    console.log(`🧠 Términos de proyecto generados:`, searchTerms);
    
    // PASO 3: Buscar en múltiples tablas de proyectos
    const projectResults = await searchProjectsWithTerms(searchTerms, user.id);
    console.log(`📊 Encontrados ${projectResults?.totalResults || 0} resultados en Proyectos`);

    // PASO 3: LLM analiza relevancia de resultados de proyectos
    if (projectResults && projectResults.totalResults > 0) {
      const analysisResult = await analyzeProjectRelevance(message, projectResults);
      return analysisResult;
    }

    // Sin resultados
    return {
      success: true,
      response: {
        agent: 'Projects',
        message: `🔍 **Búsqueda en Proyectos**\n\n❌ No encontré información relacionada con tu consulta en tus proyectos.\n\n**Tu consulta:** "${message}"\n**Términos analizados:** ${searchTerms.join(', ')}\n\n💡 **Sugerencias:**\n• Intenta con el nombre específico del proyecto\n• Pregunta sobre tareas, decisiones o colaboradores\n• Usa términos más generales`,
        type: 'project_search',
        timestamp: new Date().toISOString()
      },
      metadata: {
        searchTerms: searchTerms,
        originalMessage: message,
        resultsCount: 0,
        userId: user.id,
        sessionId: sessionId
      }
    };
    
  } catch (error) {
    console.error('❌ Error en búsqueda contextual Proyectos:', error);
    return {
      success: false,
      response: {
        agent: 'Projects',
        message: `❌ **Error en búsqueda de Proyectos**\n\nNo pude completar la búsqueda debido a un error técnico:\n${error.message}\n\nPor favor, intenta nuevamente.`,
        type: 'error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Función para analizar tipo de consulta sobre proyectos con LLM
async function analyzeProjectQueryType(message) {
  const analysisPrompt = `
Analiza la siguiente consulta del usuario sobre proyectos y determina el tipo de respuesta necesaria.

CONSULTA: "${message}"

TIPOS DE CONSULTA:
1. "statistics" - Usuario quiere estadísticas, conteos, resúmenes o información cuantitativa sobre sus proyectos
2. "search" - Usuario busca proyectos específicos por nombre, contenido, características o filtros
3. "management" - Usuario quiere crear, editar, eliminar o gestionar proyectos
4. "details" - Usuario quiere detalles específicos de un proyecto particular

EJEMPLOS:
- "cuántos proyectos tengo" → statistics
- "mis proyectos activos" → statistics  
- "busca proyecto Guatemala" → search
- "proyecto de marketing" → search
- "crea nuevo proyecto" → management
- "detalles del proyecto X" → details

INSTRUCCIONES:
- Analiza la intención real, no solo palabras clave
- Si pide conteos, totales, listas completas → statistics
- Si busca algo específico por características → search
- Responde en JSON con el tipo y explicación breve

Responde SOLO en formato JSON:
{
  "type": "statistics|search|management|details",
  "reasoning": "explicación breve de por qué",
  "focus": "qué aspecto específico busca el usuario"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.2,
      max_tokens: 200
    });

    let responseText = response.choices[0].message.content.trim();
    
    // Limpiar formato markdown si existe
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    responseText = responseText.replace(/`/g, '');
    
    const analysis = JSON.parse(responseText);
    return analysis;
    
  } catch (error) {
    console.error('❌ Error analizando tipo de consulta:', error);
    return {
      type: 'search',
      reasoning: 'Error en análisis, usando búsqueda por defecto',
      focus: 'general'
    };
  }
}

// Función para procesar estadísticas de proyectos con análisis LLM
async function processProjectStatsWithLLM(message, userId, queryAnalysis) {
  try {
    console.log('📊 Obteniendo estadísticas de proyectos...');
    
    // Obtener conteos de todas las tablas de proyectos
    const [projectsCount, contextsCount, decisionsCount, coveragesCount, cardsCount] = await Promise.all([
      // Contar proyectos
      supabase.from('projects').select('id', { count: 'exact' }).eq('user_id', userId),
      
      // Contar contextos  
      supabase.from('project_contexts')
        .select('id', { count: 'exact' })
        .eq('projects.user_id', userId),
        
      // Contar decisiones
      supabase.from('project_decisions')
        .select('id', { count: 'exact' })
        .eq('projects.user_id', userId),
        
      // Contar coberturas
      supabase.from('project_coverages')
        .select('id', { count: 'exact' })
        .eq('projects.user_id', userId),
        
      // Contar hallazgos
      supabase.from('capturado_cards')
        .select('id', { count: 'exact' })
        .eq('projects.user_id', userId)
    ]);

    // También obtener proyectos con detalles para estadísticas adicionales
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, title, status, priority, category, created_at')
      .eq('user_id', userId);

    const stats = {
      totalProjects: projectsCount.count || 0,
      totalContexts: contextsCount.count || 0, 
      totalDecisions: decisionsCount.count || 0,
      totalCoverages: coveragesCount.count || 0,
      totalCards: cardsCount.count || 0,
      projects: projectsData || []
    };

    // Estadísticas por estado
    const statusStats = {};
    if (projectsData) {
      projectsData.forEach(p => {
        statusStats[p.status] = (statusStats[p.status] || 0) + 1;
      });
    }

    // Generar respuesta con LLM usando análisis contextual
    const responseMessage = await generateStatsResponseWithContext(message, stats, statusStats, queryAnalysis);
    
    return {
      success: true,
      response: {
        agent: 'Projects',
        message: responseMessage,
        type: 'project_stats',
        timestamp: new Date().toISOString()
      },
      metadata: {
        originalMessage: message,
        stats: stats,
        statusBreakdown: statusStats,
        userId: userId
      }
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de proyectos:', error);
    return {
      success: false,
      response: {
        agent: 'Projects',
        message: `❌ Error obteniendo estadísticas de proyectos: ${error.message}`,
        type: 'error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Función para generar respuesta de estadísticas con contexto LLM
async function generateStatsResponseWithContext(userQuery, stats, statusStats, queryAnalysis) {
  const statsPrompt = `
El usuario pregunta sobre estadísticas de sus proyectos. Usa el análisis de contexto para personalizar tu respuesta.

CONSULTA: "${userQuery}"
ANÁLISIS DE CONTEXTO: ${queryAnalysis.reasoning}
ENFOQUE ESPECÍFICO: ${queryAnalysis.focus}

ESTADÍSTICAS DISPONIBLES:
- Total de proyectos: ${stats.totalProjects}
- Contextos de proyecto: ${stats.totalContexts}
- Decisiones registradas: ${stats.totalDecisions}
- Coberturas geográficas: ${stats.totalCoverages}
- Hallazgos/descubrimientos: ${stats.totalCards}

PROYECTOS POR ESTADO:
${Object.entries(statusStats).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

PROYECTOS RECIENTES:
${stats.projects.slice(0, 3).map(p => `- "${p.title}" (${p.status}) - creado ${new Date(p.created_at).toLocaleDateString()}`).join('\n')}

INSTRUCCIONES:
- Responde basándote en lo que específicamente pregunta el usuario
- Usa el análisis de contexto para enfocar tu respuesta
- Máximo 3-4 líneas, tono casual y directo
- Si pregunta cantidad específica, da el número exacto
- Si quiere resumen general, incluye breakdown por estado
- Menciona proyectos específicos si es relevante

Responde de forma simple y contextual:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: statsPrompt }],
      temperature: 0.3,
      max_tokens: 300
    });

    return response.choices[0].message.content;
    
  } catch (error) {
    console.error('❌ Error generando respuesta de estadísticas:', error);
    
    // Fallback básico
    return `📊 **Estadísticas de Proyectos**\n\nTienes **${stats.totalProjects}** proyecto(s) en total.\n\n**Por estado:** ${Object.entries(statusStats).map(([s, c]) => `${s} (${c})`).join(', ')}\n\n**Otros elementos:** ${stats.totalDecisions} decisiones, ${stats.totalCards} hallazgos`;
  }
}

// Función para generar términos de búsqueda contextuales para proyectos
async function generateProjectSearchTerms(userQuery, conversationHistory = []) {
  const contextMessages = conversationHistory
    .slice(-5) // últimos 5 mensajes
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  const searchPrompt = `
Analiza la siguiente consulta del usuario sobre PROYECTOS y genera términos de búsqueda contextuales.

CONSULTA ACTUAL: "${userQuery}"

HISTORIAL DE CONVERSACIÓN RECIENTE:
${contextMessages}

CONTEXTO: El usuario quiere buscar información sobre sus proyectos personales, que pueden incluir:
- Nombres y títulos de proyectos
- Estados (activo, pausado, completado, archivado)  
- Tareas y decisiones del proyecto
- Colaboradores y roles
- Categorías y etiquetas
- Ubicaciones geográficas
- Fechas y plazos
- Hallazgos y descubrimientos

INSTRUCCIONES:
- Si usa referencias como "ese proyecto", "mi proyecto anterior", usa el historial para identificar el proyecto específico
- Identifica qué aspecto de los proyectos busca (nombre, estado, tareas, etc.)
- Genera 3-5 términos de búsqueda relacionados basados en el contexto completo
- Incluye sinónimos y variaciones
- NO uses palabras vacías como "mis", "tengo", "muéstrame"
- Enfócate en sustantivos y conceptos específicos de proyectos
- Si hay nombres específicos de proyectos mencionados antes, inclúyelos

EJEMPLO:
Historial: "assistant: Tienes 3 proyectos: Marketing Digital (activo), Análisis Guatemala..."
Consulta: "elementos del codex de ese proyecto"
Términos: ["Marketing Digital", "marketing", "digital", "elementos", "codex"]

Responde SOLO con un array JSON de términos:
["término1", "término2", "término3"]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: searchPrompt }],
      temperature: 0.3,
      max_tokens: 250
    });

    let responseText = response.choices[0].message.content.trim();
    
    // Limpiar formato markdown si existe
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    responseText = responseText.replace(/`/g, '');
    
    const termsArray = JSON.parse(responseText);
    return Array.isArray(termsArray) ? termsArray : [userQuery];
    
  } catch (error) {
    console.error('❌ Error generando términos de proyecto:', error);
    return [userQuery.replace(/[¿?]/g, '').trim()];
  }
}

// Función para buscar en todas las tablas de proyectos
async function searchProjectsWithTerms(searchTerms, userId) {
  try {
    const allResults = {
      projects: [],
      contexts: [],
      decisions: [],
      coverages: [],
      memory: [],
      cards: [],
      totalResults: 0
    };
    
    // Buscar en cada tabla con cada término contextual
    for (const term of searchTerms) {
      console.log(`🔎 Buscando "${term}" en tablas de proyectos...`);
      
      // 1. Buscar en projects
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, description, status, priority, category, tags, start_date, target_date, created_at')
        .eq('user_id', userId)
        .or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`)
        .limit(5);
        
      if (projects) allResults.projects.push(...projects);

      // 2. Buscar en project_contexts
      const { data: contexts } = await supabase
        .from('project_contexts')
        .select(`
          id, project_id, situation_description, main_problem, 
          geographic_scope, time_frame, context_type, version,
          projects!inner(title)
        `)
        .eq('projects.user_id', userId)
        .or(`situation_description.ilike.%${term}%,main_problem.ilike.%${term}%,geographic_scope.ilike.%${term}%`)
        .limit(3);
        
      if (contexts) allResults.contexts.push(...contexts);

      // 3. Buscar en project_decisions
      const { data: decisions } = await supabase
        .from('project_decisions')
        .select(`
          id, project_id, title, description, decision_type, status,
          rationale, expected_impact, urgency, created_at,
          projects!inner(title)
        `)
        .eq('projects.user_id', userId)
        .or(`title.ilike.%${term}%,description.ilike.%${term}%,rationale.ilike.%${term}%`)
        .limit(3);
        
      if (decisions) allResults.decisions.push(...decisions);

      // 4. Buscar en project_coverages
      const { data: coverages } = await supabase
        .from('project_coverages')
        .select(`
          id, project_id, coverage_type, name, parent_name, 
          description, relevance, topic, created_at,
          projects!inner(title)
        `)
        .eq('projects.user_id', userId)
        .or(`name.ilike.%${term}%,description.ilike.%${term}%,topic.ilike.%${term}%`)
        .limit(3);
        
      if (coverages) allResults.coverages.push(...coverages);

      // 5. Buscar en capturado_cards (hallazgos)
      const { data: cards } = await supabase
        .from('capturado_cards')
        .select(`
          id, project_id, entity, city, department, pais, 
          discovery, title, topic, description, created_at,
          projects!inner(title)
        `)
        .eq('projects.user_id', userId)
        .or(`entity.ilike.%${term}%,discovery.ilike.%${term}%,title.ilike.%${term}%,topic.ilike.%${term}%`)
        .limit(3);
        
      if (cards) allResults.cards.push(...cards);
    }
    
    // Eliminar duplicados de cada categoría
    ['projects', 'contexts', 'decisions', 'coverages', 'cards'].forEach(category => {
      allResults[category] = allResults[category].filter((item, index, self) => 
        index === self.findIndex(i => i.id === item.id)
      );
    });
    
    // Calcular total de resultados
    allResults.totalResults = Object.values(allResults)
      .filter(val => Array.isArray(val))
      .reduce((total, arr) => total + arr.length, 0);
    
    return allResults;
      
  } catch (error) {
    console.error('❌ Error en búsqueda de proyectos:', error);
    return { totalResults: 0 };
  }
}

// Función para analizar relevancia de proyectos con LLM
async function analyzeProjectRelevance(userQuery, projectResults) {
  const analysisPrompt = `
Responde de forma simple y directa sobre estos elementos de proyectos del usuario.

CONSULTA: "${userQuery}"

ELEMENTOS ENCONTRADOS:

PROYECTOS (${projectResults.projects.length}):
${projectResults.projects.map(p => `- ${p.title} (${p.status}) - ${p.description || 'Sin descripción'}`).join('\n')}

CONTEXTOS (${projectResults.contexts.length}):
${projectResults.contexts.map(c => `- ${c.projects.title}: ${c.situation_description?.substring(0, 100)}...`).join('\n')}

DECISIONES (${projectResults.decisions.length}):
${projectResults.decisions.map(d => `- ${d.projects.title}: ${d.title} (${d.status})`).join('\n')}

COBERTURA GEOGRÁFICA (${projectResults.coverages.length}):
${projectResults.coverages.map(c => `- ${c.projects.title}: ${c.name} (${c.coverage_type})`).join('\n')}

HALLAZGOS (${projectResults.cards.length}):
${projectResults.cards.map(c => `- ${c.projects.title}: ${c.title || c.discovery}`).join('\n')}

INSTRUCCIONES:
- Responde en máximo 4-5 líneas
- Sé directo: "Encontré X proyectos sobre Y"
- Menciona solo lo más relevante
- Tono casual y amigable
- Agrupa la información por proyecto cuando sea posible

Ejemplo: "Encontré 2 proyectos relacionados: 'Marketing Digital' (activo) con 3 decisiones pendientes, y 'Análisis Guatemala' con hallazgos en 5 ciudades."

Responde de forma simple:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    return {
      success: true,
      response: {
        agent: 'Projects',
        message: response.choices[0].message.content,
        type: 'project_search',
        timestamp: new Date().toISOString()
      },
      metadata: {
        originalMessage: userQuery,
        resultsCount: projectResults.totalResults,
        results: projectResults
      }
    };
    
  } catch (error) {
    console.error('❌ Error en análisis de relevancia de proyectos:', error);
    
    // Fallback con formato básico
    let message = `🔍 **Búsqueda en Proyectos**\n\n✅ Encontré **${projectResults.totalResults}** elemento(s) relacionado(s):\n\n`;
    
    if (projectResults.projects.length > 0) {
      message += `**Proyectos (${projectResults.projects.length}):**\n`;
      projectResults.projects.slice(0, 3).forEach(p => {
        message += `• ${p.title} (${p.status})\n`;
      });
      message += `\n`;
    }
    
    if (projectResults.decisions.length > 0) {
      message += `**Decisiones (${projectResults.decisions.length}):**\n`;
      projectResults.decisions.slice(0, 2).forEach(d => {
        message += `• ${d.title} - ${d.projects.title}\n`;
      });
    }
    
    return {
      success: true,
      response: {
        agent: 'Projects',
        message: message,
        type: 'project_search',
        timestamp: new Date().toISOString()
      },
      metadata: {
        originalMessage: userQuery,
        resultsCount: projectResults.totalResults,
        results: projectResults
      }
    };
  }
}

// Función helper para generar respuestas casuales
async function generateCasualResponse(message) {
  const responses = {
    greetings: [
      "¡Hola! 👋 Soy Vizta, tu asistente inteligente. ¿En qué puedo ayudarte hoy?",
      "¡Hola! 😊 Me alegra verte. Estoy aquí para ayudarte con análisis social y gestión de datos.",
      "¡Bienvenido! 🌟 Soy Vizta, y junto con Laura y Robert podemos ayudarte con análisis de tendencias y más.",
      "¡Hola! 🤖 ¿Qué te gustaría analizar hoy?"
    ],
    howAreYou: [
      "¡Muy bien, gracias! 💪 Mis sistemas están funcionando perfectamente. ¿En qué puedo ayudarte?",
      "¡Excelente! 🚀 Laura y Robert están listos para cualquier análisis que necesites.",
      "¡Todo perfecto! 😊 Listo para ayudarte con análisis social, tendencias o tus proyectos personales."
    ]
  };

  const msgLower = message.toLowerCase();
  let responseArray;

  if (msgLower.includes('qué tal') || msgLower.includes('como estas') || msgLower.includes('que tal')) {
    responseArray = responses.howAreYou;
  } else {
    responseArray = responses.greetings;
  }

  const randomIndex = Math.floor(Math.random() * responseArray.length);
  return responseArray[randomIndex];
}

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

/**
 * GET /api/vizta-chat/conversations
 * Obtener lista de conversaciones del usuario
 */
router.get('/conversations', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit } = req.query;

    const sessions = await memoriesService.getUserSessions(userId, parseInt(limit) || 20);

    res.json({
      success: true,
      conversations: sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo conversaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo conversaciones',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/conversation/:sessionId
 * Obtener mensajes de una conversación específica
 */
router.get('/conversation/:sessionId', verifyUserAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;

    const messages = await memoriesService.getSessionMessages(sessionId, parseInt(limit) || 50);

    res.json({
      success: true,
      messages: messages,
      sessionId: sessionId,
      count: messages.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo mensajes de conversación:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo mensajes de conversación',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/memory-stats
 * Obtener estadísticas de uso de memoria del usuario
 */
router.get('/memory-stats', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await memoriesService.getUserMemoryStats(userId);

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de memoria:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas de memoria',
      error: error.message
    });
  }
});

/**
 * DELETE /api/vizta-chat/conversation/:sessionId
 * Eliminar una conversación completa
 */
router.delete('/conversation/:sessionId', verifyUserAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verificar que la sesión pertenece al usuario
    const messages = await memoriesService.getSessionMessages(sessionId, 1);
    if (messages.length === 0 || messages[0].user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      });
    }

    // Eliminar todos los mensajes de la sesión
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Conversación eliminada exitosamente',
      sessionId: sessionId
    });

  } catch (error) {
    console.error('❌ Error eliminando conversación:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando conversación',
      error: error.message
    });
  }
});

/**
 * POST /api/vizta-chat/test-expansion
 * Endpoint de prueba para probar la expansión inteligente de términos
 */
router.post('/test-expansion', verifyUserAccess, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro "query" es requerido y debe ser un string no vacío'
      });
    }

    // Obtener herramientas disponibles del MCP
    const availableTools = await mcpService.listAvailableTools();
    
    // Simular el proceso de expansión que haría GPT-4o mini
    const originalQuery = query.trim();
    
    // Usar las funciones de expansión del MCP para mostrar cómo funcionarían
    console.log(`🧪 Prueba de expansión para: "${originalQuery}"`);
    
    // Crear un prompt de ejemplo mostrando cómo GPT-4o mini debería procesar
    const examplePrompt = `USUARIO: "${originalQuery}"

ANÁLISIS ESTRATÉGICO:
1. Términos detectados: ${originalQuery.toLowerCase().split(' ').join(', ')}
2. Contexto inferido: Guatemala, redes sociales
3. Tipo de consulta: ${originalQuery.toLowerCase().includes('sentimiento') || originalQuery.toLowerCase().includes('opinion') ? 'Análisis de sentimiento' : 'Búsqueda de contenido'}

EXPANSIÓN SUGERIDA:
- Original: "${originalQuery}"
- Expandido: [Se simularía la expansión aquí]
- Hashtags probables: #Guatemala, #GuatemalaGt
- Términos relacionados: [Se agregarían términos específicos]
- Límite recomendado: ${originalQuery.toLowerCase().includes('sentimiento') ? '20-25 tweets' : '15 tweets'}

HERRAMIENTAS A USAR:
- nitter_context con parámetros optimizados
- location: guatemala
- limit: optimizado según tipo de consulta`;

    res.json({
      success: true,
      test_results: {
        original_query: originalQuery,
        analysis_type: originalQuery.toLowerCase().includes('sentimiento') || originalQuery.toLowerCase().includes('opinion') ? 'sentiment_analysis' : 'content_search',
        suggested_improvements: {
          should_expand_terms: true,
          should_include_hashtags: true,
          should_add_guatemalan_context: true,
          recommended_limit: originalQuery.toLowerCase().includes('sentimiento') ? 20 : 15
        },
        example_prompt: examplePrompt,
        available_tools: availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          optimizations_applied: tool.name === 'nitter_context' ? [
            'Expansión inteligente de términos',
            'Optimización automática de límites',
            'Contexto guatemalteco añadido',
            'Análisis de sentimiento incluido'
          ] : []
        }))
      },
      instructions: {
        next_steps: [
          'El sistema ahora expandirá automáticamente los términos de búsqueda',
          'GPT-4o mini usará estrategias inteligentes en lugar de términos literales',
          'Los límites se optimizarán según el tipo de análisis',
          'Se incluirá contexto guatemalteco automáticamente'
        ],
        example_expansions: {
          'marcha del orgullo': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad',
          'elecciones': 'EleccionesGt OR TSE OR voto OR candidatos OR Elecciones2025 OR procesoelectoral',
          'presidente': 'BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR Presidencia'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en test de expansión:', error);
    res.status(500).json({
      success: false,
      message: 'Error probando expansión de términos',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/scrapes/grouped
 * Obtener scrapes agrupados inteligentemente
 */
router.get('/scrapes/grouped', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset, detectedGroup, categoria } = req.query;

    const groupedScrapes = await recentScrapesService.getGroupedScrapes(userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      detectedGroup,
      categoria
    });

    res.json({
      success: true,
      groups: groupedScrapes,
      count: groupedScrapes.length,
      metadata: {
        totalGroups: groupedScrapes.length,
        requestedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo scrapes agrupados:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo scrapes agrupados',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/scrapes/grouped-stats
 * Obtener estadísticas de agrupación
 */
router.get('/scrapes/grouped-stats', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await recentScrapesService.getGroupedStats(userId);

    res.json({
      success: true,
      stats: stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas agrupadas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas agrupadas',
      error: error.message
    });
  }
});

/**
 * POST /api/vizta-chat/test-user-discovery
 * Endpoint de prueba para verificar User Discovery
 */
router.post('/test-user-discovery', verifyUserAccess, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro "message" es requerido'
      });
    }

    console.log(`🧪 TEST USER DISCOVERY: "${message}"`);

    // Procesar el mensaje usando el sistema completo
    const result = await agentesService.processUserQuery(message, req.user);

    res.json({
      success: true,
      test_input: message,
      intent_detected: result.metadata?.intent,
      intent_confidence: result.metadata?.intentConfidence,
      intent_method: result.metadata?.intentMethod,
      mode: result.metadata?.mode,
      agent_response: result.response?.agent,
      processing_time: result.metadata?.processingTime,
      user_discovery_activated: result.metadata?.intent === 'user_discovery',
      response_preview: result.response?.message?.substring(0, 200) + '...',
      full_result: process.env.NODE_ENV === 'development' ? result : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en test user discovery:', error);
    res.status(500).json({
      success: false,
      message: 'Error probando user discovery',
      error: error.message
    });
  }
});

/**
 * POST /api/vizta-chat/test-openpipe
 * Endpoint de prueba para verificar integración con OpenPipe
 */
router.post('/test-openpipe', verifyUserAccess, async (req, res) => {
  try {
    if (!openPipeService) {
      return res.status(503).json({
        success: false,
        message: 'OpenPipe service no disponible',
        error: 'Dependencias no cargadas'
      });
    }

    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro "message" es requerido'
      });
    }

    console.log(`🧪 TEST OPENPIPE: "${message}"`);

    const startTime = Date.now();
    
    // Procesar con OpenPipe
    const openPipeResult = await openPipeService.processViztaQuery(message, req.user, 'test_session');
    
    let testResult = {
      success: true,
      test_input: message,
      openpipe_result: openPipeResult,
      processing_time: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Si hay function call, ejecutarlo
    if (openPipeResult.success && openPipeResult.type === 'function_call') {
      console.log(`🔧 Ejecutando función de prueba: ${openPipeResult.functionCall.name}`);
      
      const functionResult = await openPipeService.executeFunctionCall(
        openPipeResult.functionCall,
        req.user,
        'test_session'
      );
      
      testResult.function_execution = functionResult;
      testResult.formatted_response = await formatFunctionResult(functionResult, message);
    }

    res.json(testResult);

  } catch (error) {
    console.error('❌ Error en test OpenPipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error probando OpenPipe',
      error: error.message
    });
  }
});

/**
 * DELETE /api/vizta-chat/scrapes/:scrapeId
 * Eliminar un scrape específico del usuario
 */
router.delete('/scrapes/:scrapeId', verifyUserAccess, async (req, res) => {
  try {
    const { scrapeId } = req.params;
    const userId = req.user.id;

    // Validar parámetros
    if (!scrapeId || scrapeId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'ID del scrape es requerido'
      });
    }

    console.log(`🗑️ Solicitud de eliminación de scrape ${scrapeId} por usuario ${userId}`);

    // Eliminar scrape usando el servicio
    const result = await recentScrapesService.deleteScrape(scrapeId.trim(), userId);

    res.json({
      success: true,
      message: result.message,
      deletedScrape: result.deletedScrape,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error eliminando scrape:', error);
    
    // Manejar errores específicos
    if (error.message.includes('no encontrado') || error.message.includes('no tienes permisos')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error eliminando scrape',
      error: error.message
    });
  }
});

module.exports = router;
