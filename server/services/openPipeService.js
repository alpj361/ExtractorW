/**
 * OpenPipe Service - Integración con modelo fine-tuneado para function calling
 * Utiliza el modelo entrenado específicamente para Vizta con capacidades agénticas
 */

const OpenAI = require('openai');

class OpenPipeService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENPIPE_API_KEY,
      baseURL: 'https://app.openpipe.ai/api/v1'
    });
    
    // ID del modelo fine-tuneado específico para Vizta
    this.modelId = process.env.OPENPIPE_MODEL_ID || 'openpipe:vizta-function-calling-v1';
    
    console.log(`[OPENPIPE] 🎯 Inicializado con modelo: ${this.modelId}`);
  }

  /**
   * Procesar consulta del usuario usando el modelo fine-tuneado de Vizta
   * Incluye function calling optimizado para herramientas específicas
   */
  async processViztaQuery(userMessage, user, sessionId = null) {
    try {
      console.log(`[OPENPIPE] 🤖 Procesando consulta Vizta: "${userMessage}"`);
      
      const systemPrompt = this.buildViztaSystemPrompt();
      
      const messages = [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: userMessage
        }
      ];

      // Herramientas disponibles para function calling
      const tools = this.getViztaTools();

      // Inyectar SIEMPRE contexto de memoria (Zep) antes del bucle de tools
      try {
        const { InternalMemoryClient } = require('./agents/laura/internalMemoryClient');
        const zep = new InternalMemoryClient();
        const memResults = await zep.searchPoliticalContext(userMessage, 5);
        if (Array.isArray(memResults) && memResults.length > 0) {
          const snippet = JSON.stringify(memResults.slice(0, 5));
          messages.splice(1, 0, {
            role: 'system',
            content: `[MEMORIA_ZEP] Contexto político relacionado (top ${Math.min(5, memResults.length)}): ${snippet}`
          });
        } else {
          messages.splice(1, 0, {
            role: 'system',
            content: `[MEMORIA_ZEP] Sin resultados directos para esta consulta`
          });
        }
      } catch (memErr) {
        console.warn('[OPENPIPE] ⚠️ No se pudo cargar contexto de memoria Zep:', memErr?.message || memErr);
      }

      // Bucle de encadenamiento de tool-calls: permitir que el LLM llame varias herramientas antes de responder
      let loopMessages = messages;
      let safetyHops = 0;
      const maxHops = 3; // <= 2 hops planificados, 3 por seguridad

      while (safetyHops < maxHops) {
        safetyHops += 1;

        const resp = await this.openai.chat.completions.create({
          model: this.modelId,
          messages: loopMessages,
          tools,
          tool_choice: "auto",
          temperature: 0.1,
          max_tokens: 600,
          user: sessionId || 'vizta_session'
        });

        const choice = resp.choices[0];

        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          console.log(`[OPENPIPE] 🔧 Function calling detectado: ${choice.message.tool_calls.length} herramientas`);

          // Ejecutar cada tool_call en secuencia y agregar su salida como role=tool
          for (const raw of choice.message.tool_calls) {
            // Normalizar estructura de tool_call: OpenAI-compatible {type:'function', function:{name, arguments}}
            const tc = (() => {
              if (raw.function && raw.function.name) return raw;
              // Algunos providers devuelven {name, arguments} directo
              return { id: raw.id, function: { name: raw.name, arguments: raw.arguments } };
            })();

            const fnName = tc.function?.name;
            const fnArgs = tc.function?.arguments;

            if (!fnName) {
              console.warn('[OPENPIPE] ⚠️ tool_call sin nombre de función. Ignorando este call.', raw);
              // Inyectar resultado vacío para que el modelo rectifique
              loopMessages = [
                ...loopMessages,
                {
                  role: "assistant",
                  content: choice.message.content || null,
                  tool_calls: [tc]
                },
                {
                  role: "tool",
                  tool_call_id: tc.id || undefined,
                  name: "unknown_function",
                  content: JSON.stringify({ error: "missing_function_name" })
                }
              ];
              continue;
            }

            // Ejecutar la función con args parseados de forma segura
            let parsedArgs;
            try {
              parsedArgs = typeof fnArgs === 'string' ? JSON.parse(fnArgs || '{}') : (fnArgs || {});
            } catch (e) {
              console.warn('[OPENPIPE] ⚠️ argumentos de función no JSON. Usando objeto vacío.', fnArgs);
              parsedArgs = {};
            }

            const execResult = await this.executeFunctionCall(
              { name: fnName, arguments: parsedArgs },
              user,
              sessionId
            );

            // Payload mínimo y normativo para guiar al LLM
            const toolPayload = execResult?.data ?? execResult ?? {};
            loopMessages = [
              ...loopMessages,
              {
                role: "assistant",
                content: choice.message.content || null,
                tool_calls: [tc]
              },
              {
                role: "tool",
                tool_call_id: tc.id || undefined,
                name: fnName,
                content: JSON.stringify(toolPayload)
              }
            ];
          }

          // Continúa el loop para permitir que el modelo decida otro tool_call o emita respuesta final
          continue;
        }

        // Sin más tool_calls: devolvemos la respuesta final del assistant
        return {
          success: true,
          type: 'conversational',
          message: choice.message.content,
          usage: resp.usage,
          sessionId
        };
      }

      // Seguridad: si excedimos hops, devolvemos última respuesta conocida
      return {
        success: true,
        type: 'conversational',
        message: 'He realizado el máximo de pasos de herramientas configurado. Si necesitas más detalle, reformula tu consulta.',
        usage: undefined,
        sessionId
      };

    } catch (error) {
      console.error(`[OPENPIPE] ❌ Error procesando consulta:`, error);
      
      return {
        success: false,
        error: error.message,
        type: 'error',
        message: 'Lo siento, hubo un error procesando tu consulta. Por favor, intenta nuevamente.',
        sessionId: sessionId
      };
    }
  }

  /**
   * Construir system prompt optimizado para Vizta
   */
  buildViztaSystemPrompt() {
    const currentYear = new Date().getFullYear();
    
    return `Eres Vizta, un asistente especializado en análisis político y social de Guatemala. Tienes acceso a las siguientes herramientas:

- nitter_context: Para buscar tweets sobre TEMAS/PALABRAS CLAVE (no personas específicas)
- nitter_profile: Para extraer posts de usuarios específicos de Twitter
- perplexity_search: Para buscar INFORMACIÓN sobre personas, eventos o temas
- search_political_context: Para buscar en tu memoria política (session: pulse-politics)
- resolve_twitter_handle: Para encontrar handles de Twitter por nombre
- user_projects: Para consultar proyectos del usuario
- user_codex: Para buscar en documentos del usuario

REGLAS IMPORTANTES (CHAIN-OF-TOOLS):
0) Consultas sobre TEMAS/TENDENCIAS (no personas específicas):
   a. PRIMERO usa perplexity_search para identificar palabras clave, sinónimos, hashtags y entidades relevantes (mes/año actual y "Guatemala").
    b. Con esos términos, luego usa nitter_context con formato OR palabra-por-palabra y hashtags pertinentes.
    c. Devuelve al usuario: qué está pasando, señales relevantes y menciones relacionadas en redes (enfocadas al tema). Máximo 2 hops.
    d. REGLA GENERALIZADA: Cuando el tema implique consultas dependientes de contexto local/temporal (p.ej. elecciones universitarias, convocatorias, procesos internos, eventos locales), encadena: search_political_context (si aplica) → perplexity_search (improve_nitter_search=true) → nitter_context. Adapta términos a jerga/hashtags del dominio y evita frases completas.
1) Cargos/posiciones y datos institucionales:
   a. Ejecuta primero search_political_context (memoria política Zep, grupo pulse-politics) con la consulta del usuario.
   b. Si la herramienta devuelve count==0 o evidencia insuficiente, NO respondas aún; ejecuta luego perplexity_search con un query enriquecido:
      - Formato: "{consulta} Guatemala ${currentYear} cargo actual"
      - location="Guatemala", focus="institucional"
   c. Solo emite la respuesta final después de ejecutar las herramientas necesarias. No generes una respuesta intermedia.
2) "Extráeme lo que dice X": si incluye @, usa nitter_profile. Si no incluye @, usa resolve_twitter_handle y luego nitter_profile.
3) nitter_context SOLO para temas/palabras clave, NO para personas específicas. Idealmente precedido por perplexity_search para construir buena query.
4) Siempre usa "Guatemala" como location cuando corresponda.
5) No asumas; valida con herramientas incluso si tú "sabes" la respuesta.
6) Máximo 2 hops de herramientas por consulta: memoria → web, o perplexity → nitter.

AÑO_ACTUAL = ${currentYear}

`;
  }

  /**
   * Definir herramientas disponibles para function calling
   */
  getViztaTools() {
    return [
      {
        type: "function",
        function: {
          name: "nitter_context",
          description: "Buscar tweets sobre temas, palabras clave o tendencias (NO para personas específicas)",
          parameters: {
            type: "object",
            properties: {
              q: {
                type: "string",
                description: "Términos de búsqueda expandidos inteligentemente con OR, hashtags y sinónimos"
              },
              location: {
                type: "string", 
                description: "Ubicación para contextualizar búsqueda",
                default: "guatemala"
              },
              limit: {
                type: "number",
                description: "Número de tweets a obtener (15-30 recomendado)",
                default: 25
              }
            },
            required: ["q"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "nitter_profile",
          description: "Extraer posts de un usuario específico de Twitter usando su handle",
          parameters: {
            type: "object",
            properties: {
              username: {
                type: "string",
                description: "Handle de Twitter sin el símbolo @"
              },
              limit: {
                type: "number",
                description: "Número de posts a extraer",
                default: 15
              },
              include_retweets: {
                type: "boolean",
                description: "Incluir retweets en los resultados",
                default: false
              }
            },
            required: ["username"]
          }
        }
      },
      {
        type: "function", 
        function: {
          name: "perplexity_search",
          description: "Buscar información actualizada sobre personas, eventos o temas usando web search",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Consulta optimizada para búsqueda web con contexto y año actual"
              },
              location: {
                type: "string",
                description: "Ubicación para contextualizar búsqueda",
                default: "Guatemala"
              },
              focus: {
                type: "string", 
                description: "Enfoque específico de la búsqueda",
                enum: ["política", "biografía", "actualidad", "institucional", "económico", "social", "internacional"]
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_political_context",
          description: "Buscar en la memoria política del sistema (session: pulse-politics)",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Términos de búsqueda en la memoria política"
              },
              limit: {
                type: "number",
                description: "Número máximo de resultados",
                default: 5
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "resolve_twitter_handle",
          description: "Encontrar el handle de Twitter de una persona por su nombre",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Nombre completo de la persona"
              },
              context: {
                type: "string",
                description: "Contexto adicional (cargo, partido, sector)"
              },
              sector: {
                type: "string",
                description: "Sector al que pertenece",
                enum: ["política", "música", "deportes", "medios", "empresa", "academia"]
              }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "user_projects",
          description: "Consultar los proyectos del usuario",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                description: "Filtrar por estado del proyecto",
                enum: ["active", "completed", "paused", "archived"]
              },
              limit: {
                type: "number",
                description: "Número máximo de proyectos a obtener",
                default: 50
              },
              priority: {
                type: "string",
                description: "Filtrar por prioridad",
                enum: ["high", "medium", "low"]
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "user_codex",
          description: "Buscar en los documentos del usuario (Codex)",
          parameters: {
            type: "object",
            properties: {
              searchQuery: {
                type: "string",
                description: "Términos de búsqueda en documentos"
              },
              limit: {
                type: "number",
                description: "Número máximo de documentos a obtener",
                default: 20
              },
              type: {
                type: "string",
                description: "Tipo de documento a buscar",
                enum: ["audio", "document", "link", "note"]
              },
              tags: {
                type: "string",
                description: "Etiquetas específicas para filtrar"
              }
            },
            required: ["searchQuery"]
          }
        }
      }
    ];
  }

  /**
   * Ejecutar function call usando el sistema MCP correspondiente
   */
  async executeFunctionCall(functionCall, user, sessionId = null) {
    try {
      if (!functionCall || !functionCall.name) {
        throw new Error('tool_call inválido: falta name');
      }
      const name = functionCall.name;
      const args = functionCall.arguments ?? {};
      const parsedArgs = typeof args === 'string' ? JSON.parse(args || '{}') : args;

      console.log(`[OPENPIPE] 🔧 Ejecutando función: ${name} con args:`, parsedArgs);

      // Mapear function calls a los servicios correspondientes
      switch (name) {
        case 'nitter_context':
        case 'nitter_profile':
        case 'perplexity_search':
        case 'resolve_twitter_handle':
          // Estas herramientas van a Laura
          return await this.delegateToLaura(name, parsedArgs, user, sessionId);
          
        case 'search_political_context':
          // Esta herramienta va a Laura Memory
          return await this.delegateToLauraMemory(name, parsedArgs, user, sessionId);
          
        case 'user_projects':
        case 'user_codex':
          // Estas herramientas van a Robert
          return await this.delegateToRobert(name, parsedArgs, user, sessionId);
          
        default:
          throw new Error(`Función desconocida: ${name}`);
      }
      
    } catch (error) {
      console.error(`[OPENPIPE] ❌ Error ejecutando function call:`, error);
      return {
        success: false,
        error: error.message,
        function: functionCall.name
      };
    }
  }

  /**
   * Delegar herramientas a Laura Agent
   */
  async delegateToLaura(toolName, args, user, sessionId) {
    const mcpService = require('./mcp');
    
    try {
      console.log(`[OPENPIPE] 👩‍🔬 Delegando ${toolName} a Laura`);
      
      const result = await mcpService.executeTool(toolName, args, user);
      
      return {
        success: true,
        agent: 'Laura',
        tool: toolName,
        data: result,
        sessionId: sessionId
      };
      
    } catch (error) {
      console.error(`[OPENPIPE] ❌ Error en delegación a Laura:`, error);
      return {
        success: false,
        agent: 'Laura',
        tool: toolName,
        error: error.message
      };
    }
  }

  /**
   * Delegar herramientas a Laura Memory Service
   */
  async delegateToLauraMemory(toolName, args, user, sessionId) {
    // Usar SIEMPRE la memoria interna de Laura (Zep) para contexto político del grupo pulse-politics
    // Reemplaza al cliente anterior que no exponía searchPoliticalContext()
    const { InternalMemoryClient } = require('./agents/laura/internalMemoryClient');
    const zep = new InternalMemoryClient();

    try {
      console.log(`[OPENPIPE] 🧠 Delegando ${toolName} a Laura Memory (Zep group: pulse-politics)`);

      let result;

      if (toolName === 'search_political_context') {
        // Preferir group graph (pulse-politics) tal como indicó el usuario
        const groupId = process.env.PULSE_POLITICS_SESSION_ID || 'group:pulsepolitics';

        // InternalMemoryClient expone searchPoliticalContext(query, limit) que llama a Python 'search_pulsepolitics'
        const edges = await zep.searchPoliticalContext(args.query, args.limit || 5);
        const count = Array.isArray(edges) ? edges.length : 0;

        // Si el routing por LLM está forzado, NO aplicar fallback programático.
        const forceLLMRoute = String(process.env.VIZTA_FORCE_LLM_TOOL_ROUTING || 'true') === 'true';
        if (forceLLMRoute) {
          result = {
            groupId,
            query: args.query,
            count,
            sufficient: count >= 1,
            results: edges
          };
        } else {
          // Fallback programático como red de seguridad
          if (count === 0) {
            console.log('[OPENPIPE] 🔄 Sin resultados en LauraMemory. Activando fallback a perplexity_search (programático)');
            const fallbackCall = {
              name: 'perplexity_search',
              arguments: {
                query: `${args.query} guatemala ${new Date().getFullYear()} cargo actual`,
                location: 'Guatemala',
                focus: 'institucional'
              }
            };
            const fallback = await this.executeFunctionCall(fallbackCall, user, sessionId);
            return {
              success: true,
              agent: 'LauraMemory',
              tool: toolName,
              data: {
                groupId,
                query: args.query,
                count: 0,
                sufficient: false,
                results: [],
                fallback: {
                  used: 'perplexity_search',
                  payload: fallback
                }
              },
              sessionId
            };
          }
          result = {
            groupId,
            query: args.query,
            count,
            sufficient: count >= 1,
            results: edges
          };
        }
      } else {
        throw new Error(`Herramienta no soportada por LauraMemory: ${toolName}`);
      }

      return {
        success: true,
        agent: 'LauraMemory',
        tool: toolName,
        data: result,
        sessionId: sessionId
      };

    } catch (error) {
      console.error(`[OPENPIPE] ❌ Error en delegación a Laura Memory (Zep):`, error);
      return {
        success: false,
        agent: 'LauraMemory',
        tool: toolName,
        error: error.message
      };
    }
  }

  /**
   * Delegar herramientas a Robert Agent
   */
  async delegateToRobert(toolName, args, user, sessionId) {
    const supabase = require('../utils/supabase');
    
    try {
      console.log(`[OPENPIPE] 👨‍💼 Delegando ${toolName} a Robert`);
      
      let result;
      
      if (toolName === 'user_projects') {
        const query = supabase
          .from('projects')
          .select('id, title, description, status, priority, category, created_at')
          .eq('user_id', user.id);
          
        if (args.status) {
          query.eq('status', args.status);
        }
        if (args.priority) {
          query.eq('priority', args.priority);
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(args.limit || 50);
          
        if (error) throw error;
        result = { projects: data || [], count: data?.length || 0 };
        
      } else if (toolName === 'user_codex') {
        const query = supabase
          .from('codex_items')
          .select('id, titulo, descripcion, tipo, etiquetas, created_at')
          .eq('user_id', user.id);
          
        if (args.type) {
          query.eq('tipo', args.type);
        }
        
        // Búsqueda en múltiples campos
        const searchTerm = `%${args.searchQuery}%`;
        query.or(`titulo.ilike.${searchTerm},descripcion.ilike.${searchTerm},etiquetas.ilike.${searchTerm}`);
        
        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(args.limit || 20);
          
        if (error) throw error;
        result = { items: data || [], count: data?.length || 0 };
      }
      
      return {
        success: true,
        agent: 'Robert',
        tool: toolName,
        data: result,
        sessionId: sessionId
      };
      
    } catch (error) {
      console.error(`[OPENPIPE] ❌ Error en delegación a Robert:`, error);
      return {
        success: false,
        agent: 'Robert',
        tool: toolName,
        error: error.message
      };
    }
  }

  /**
   * Obtener estadísticas del servicio OpenPipe
   */
  getStats() {
    return {
      service: 'OpenPipe',
      modelId: this.modelId,
      functionsAvailable: this.getViztaTools().length,
      status: 'active'
    };
  }
}

module.exports = new OpenPipeService();
