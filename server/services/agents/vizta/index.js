/**
 * Vizta - Orquestador Principal del Sistema de Agentes
 * Coordina comunicación entre Laura, Robert y maneja experiencia unificada del usuario
 */

const { AGENT_CAPABILITIES, ROUTING_PATTERNS, TOOL_TO_AGENT_MAPPING } = require('../config/agentCapabilities');
const { communicationBus } = require('../shared/agentCommunication');
const { LauraAgent } = require('../laura');
const { RobertAgent } = require('../robert');
const { ResponseOrchestrator } = require('./responseOrchestrator');
const { RoutingEngine } = require('./routingEngine');
const { ConversationManager } = require('./conversationManager');
const llmIntentClassifier = require('./helpers/llmIntentClassifier');
const { LauraHandlers, RobertHandlers, MixedHandlers } = require('./agentHandlers');

class ViztaAgent {
  constructor() {
    this.name = 'Vizta';
    this.config = AGENT_CAPABILITIES.vizta;
    
    // Inicializar agentes especializados
    this.laura = new LauraAgent(this);
    this.robert = new RobertAgent();
    
    // Inicializar módulos de orquestación
    this.responseOrchestrator = new ResponseOrchestrator(this);
    this.routingEngine = new RoutingEngine(this);
    this.conversationManager = new ConversationManager(this);
    
    // Inicializar handlers para modo agéntico
    this.lauraHandlers = new LauraHandlers(this.laura);
    this.robertHandlers = new RobertHandlers(this.robert);
    this.mixedHandlers = new MixedHandlers(this.laura, this.robert);
    
    // Estado interno
    this.activeConversations = new Map();
    this.agentStates = new Map();
    
    console.log(`[VIZTA] 🧠 Vizta Orquestador Principal inicializado con modo híbrido LLM`);
  }

  /**
   * Punto de entrada principal para procesar consultas del usuario
   * Modo híbrido: LLM para clasificación de intenciones + Agentes especializados
   */
  async processUserQuery(userMessage, user, sessionId = null) {
    const conversationId = sessionId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[VIZTA] 🎯 Procesando consulta con LLM híbrido en conversación: ${conversationId}`);
    console.log(`[VIZTA] 📝 Mensaje: "${userMessage}"`);
    
    try {
      // PASO 1: Clasificación de intención con LLM
      const intentAnalysis = await llmIntentClassifier.classifyIntent(userMessage);
      console.log(`[VIZTA] 🧠 Intención detectada: "${intentAnalysis.intent}" (${intentAnalysis.method}, confianza: ${intentAnalysis.confidence})`);
      
      let response;
      let conversation;
      
      // PASO 2: Decisión de modo según intención
      console.log(`[VIZTA_DEBUG] 🔍 Evaluando intent: "${intentAnalysis.intent}" - isConversational: ${this.isConversationalIntent(intentAnalysis.intent)}`);
      
      if (this.isConversationalIntent(intentAnalysis.intent)) {
        // MODO CONVERSACIONAL - Vizta responde directamente SIN AGENTES
        console.log(`[VIZTA] 💬 Modo conversacional directo para: ${intentAnalysis.intent}`);
        
        // Para respuestas conversacionales, solo inicializamos conversación mínima
        conversation = { id: conversationId };
        
        const conversationalMessage = await llmIntentClassifier.generateConversationalResponse(
          userMessage, 
          intentAnalysis.intent
        );
        
        response = {
          agent: 'Vizta',
          message: conversationalMessage,
          type: 'conversational',
          intent: intentAnalysis.intent,
          mode: 'conversational',
          timestamp: new Date().toISOString()
        };
        
      } else {
        // MODO AGÉNTICO - Requiere inicialización completa y agentes
        console.log(`[VIZTA] 🤖 Modo agéntico activado para: ${intentAnalysis.intent}`);
        
        // Inicializar conversación completa solo para modo agéntico
        conversation = await this.conversationManager.initializeConversation(
          conversationId, 
          { userMessage, user, startTime, intent: intentAnalysis }
        );
        
        // IMPORTANTE: Inicializar también en AgentCommunicationBus antes de registrar agentes
        communicationBus.initializeConversation(conversation.id, {
          userMessage, user, startTime, intent: intentAnalysis.intent
        });
        
        // Registrar agentes solo cuando se necesiten
        communicationBus.registerAgent(conversation.id, 'vizta');
        communicationBus.registerAgent(conversation.id, 'laura');
        communicationBus.registerAgent(conversation.id, 'robert');
        
        // Ejecutar modo agéntico y devolver inmediatamente si está procesado
        const agenticResponse = await this.executeAgenticMode(userMessage, user, conversation.id, intentAnalysis.intent);
        
        // Si el modo agéntico devuelve contenido procesado, usarlo directamente
        if (agenticResponse && agenticResponse.mode === 'agential_processed') {
          console.log(`[VIZTA] ✅ Devolviendo respuesta agéntica procesada directamente`);
          return {
            conversationId: conversation.id,
            response: {
              agent: agenticResponse.agent || 'Vizta',
              message: agenticResponse.message,
              type: agenticResponse.type || 'chat_response',
              timestamp: agenticResponse.timestamp || new Date().toISOString()
            },
            metadata: {
              intent: intentAnalysis.intent,
              intentConfidence: intentAnalysis.confidence,
              intentMethod: intentAnalysis.method,
              mode: agenticResponse.mode,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString()
            }
          };
        }
        
        response = agenticResponse;
      }
      
      // Actualizar contexto de conversación solo si no es modo conversacional simple
      if (response.mode !== 'conversational') {
        await this.conversationManager.updateConversationContext(
          conversation.id, 
          userMessage, 
          response, 
          []
        );
      }
      
      // Extraer mensaje procesado si viene del responseOrchestrator
      let finalMessage = response.message;
      if (response.processedContent) {
        // Si responseOrchestrator generó contenido procesado, usarlo como mensaje principal
        finalMessage = response.processedContent;
      }

      return {
        conversationId: conversation.id,
        response: {
          agent: response.agent || 'Vizta',
          message: finalMessage,
          type: response.type || 'chat_response',
          timestamp: response.timestamp || new Date().toISOString()
        },
        metadata: {
          intent: intentAnalysis.intent,
          intentConfidence: intentAnalysis.confidence,
          intentMethod: intentAnalysis.method,
          mode: response.mode || 'conversational',
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error(`[VIZTA] ❌ Error procesando consulta:`, error);
      
      return {
        conversationId: conversationId, // En caso de error, usar el conversationId original
        response: {
          agent: 'Vizta',
          error: 'processing_error',
          message: 'Lo siento, hubo un error procesando tu consulta. Por favor, intenta nuevamente.',
          details: error.message,
          timestamp: new Date().toISOString()
        },
        metadata: {
          error: true,
          errorType: error.name,
          processingTime: 0
        }
      };
    }
  }

  /**
   * Crear plan de ejecución basado en decisión de routing
   */
  createExecutionPlan(routingDecision, userMessage, user) {
    const plan = {
      tasks: [],
      agentsInvolved: [],
      executionMode: routingDecision.executionMode || 'parallel',
      priority: routingDecision.priority || 'normal'
    };
    
    // Crear tareas para Laura si es necesario
    if (routingDecision.agents.includes('laura')) {
      const lauraTask = this.createLauraTask(routingDecision, userMessage, user);
      plan.tasks.push(lauraTask);
      plan.agentsInvolved.push('laura');
    }
    
    // Crear tareas para Robert si es necesario
    if (routingDecision.agents.includes('robert')) {
      const robertTasks = this.createRobertTasks(routingDecision, userMessage, user);
      plan.tasks.push(...robertTasks);
      if (robertTasks.length > 0) {
        plan.agentsInvolved.push('robert');
      }
    }
    
    return plan;
  }

  /**
   * Crear tarea para Laura
   */
  createLauraTask(routingDecision, userMessage, user) {
    const baseTask = {
      id: `laura_${Date.now()}`,
      agent: 'laura',
      originalQuery: userMessage,
      user: user,
      attempts: 0,
      startTime: Date.now()
    };
    
    // Si hay decisión específica de Laura's reasoning engine, usarla
    if (routingDecision.lauraDecision && routingDecision.lauraDecision.plan) {
      return {
        ...baseTask,
        tool: routingDecision.lauraDecision.plan.tool,
        type: routingDecision.lauraDecision.plan.tool === 'nitter_profile' ? 'profile' : 'monitoring',
        args: routingDecision.lauraDecision.plan.args || {},
        useReasoningEngine: false, // Ya se usó
        llmReasoning: routingDecision.lauraDecision.plan.reasoning,
        llmThought: routingDecision.lauraDecision.thought
      };
    }
    
    // Determinar herramienta basada en patrones
    const socialPattern = this.matchPattern(userMessage, 'social');
    if (socialPattern) {
      const inferredTool = this.inferToolFromQuery(userMessage);
      
      // Si inferToolFromQuery devuelve null, forzar uso de reasoning engine
      if (!inferredTool) {
        return {
          ...baseTask,
          tool: 'nitter_context', // Temporal, será reemplazado por reasoning engine
          type: 'monitoring',
          args: { q: userMessage, location: 'guatemala', limit: 20 },
          useReasoningEngine: true,
          forceReasoningEngine: true // Flag especial para forzar reasoning
        };
      }
      
      return {
        ...baseTask,
        tool: inferredTool,
        type: inferredTool === 'nitter_profile' ? 'profile' : 'monitoring',
        args: this.buildToolArgs(userMessage),
        useReasoningEngine: false // No usar reasoning si ya hay herramienta específica
      };
    }
    
    // Fallback: usar reasoning engine
    return {
      ...baseTask,
      tool: 'nitter_context', // Temporal, será reemplazado por reasoning engine
      type: 'monitoring',
      args: { q: userMessage, location: 'guatemala', limit: 20 },
      useReasoningEngine: true
    };
  }

  /**
   * Crear tareas para Robert
   */
  createRobertTasks(routingDecision, userMessage, user) {
    const tasks = [];
    const msg = userMessage.toLowerCase();
    
    // Detectar necesidad de datos personales
    if (msg.includes('mis') || msg.includes('mi ') || msg.includes('proyecto')) {
      tasks.push({
        id: `robert_projects_${Date.now()}`,
        agent: 'robert',
        tool: 'user_projects',
        type: 'projects',
        collection: 'user_projects',
        description: 'Consulta de proyectos del usuario',
        args: { status: 'active' },
        user: user
      });
    }
    
    if (msg.includes('documento') || msg.includes('archivo') || msg.includes('codex')) {
      tasks.push({
        id: `robert_codex_${Date.now()}`,
        agent: 'robert',
        tool: 'codex_items',
        type: 'codex',
        collection: 'codex_items',
        description: 'Consulta de documentos del usuario',
        args: { limit: 10 },
        user: user
      });
    }
    
    return tasks;
  }

  /**
   * Ejecutar plan de tareas
   */
  async executeTaskPlan(executionPlan, conversationId) {
    const results = [];
    
    if (executionPlan.executionMode === 'parallel') {
      // Ejecución paralela
      console.log(`[VIZTA] ⚡ Ejecutando ${executionPlan.tasks.length} tareas en paralelo`);
      
      const promises = executionPlan.tasks.map(task => this.executeAgentTask(task, conversationId));
      const settledResults = await Promise.allSettled(promises);
      
      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({
            taskId: executionPlan.tasks[index].id,
            agent: executionPlan.tasks[index].agent,
            success: true,
            data: result.value,
            executionTime: Date.now() - executionPlan.tasks[index].startTime
          });
        } else {
          results.push({
            taskId: executionPlan.tasks[index].id,
            agent: executionPlan.tasks[index].agent,
            success: false,
            error: result.reason.message,
            executionTime: Date.now() - executionPlan.tasks[index].startTime
          });
        }
      });
      
    } else {
      // Ejecución secuencial
      console.log(`[VIZTA] 🔄 Ejecutando ${executionPlan.tasks.length} tareas secuencialmente`);
      
      for (const task of executionPlan.tasks) {
        try {
          const result = await this.executeAgentTask(task, conversationId);
          results.push({
            taskId: task.id,
            agent: task.agent,
            success: true,
            data: result,
            executionTime: Date.now() - task.startTime
          });
        } catch (error) {
          results.push({
            taskId: task.id,
            agent: task.agent,
            success: false,
            error: error.message,
            executionTime: Date.now() - task.startTime
          });
          
          // Decidir si continuar o parar en caso de error
          if (executionPlan.priority === 'critical') {
            console.log(`[VIZTA] ❌ Tarea crítica falló, deteniendo ejecución secuencial`);
            break;
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Ejecutar tarea de agente específico
   */
  async executeAgentTask(task, conversationId) {
    const startTime = Date.now();
    
    // Actualizar estado del agente
    communicationBus.updateAgentState(conversationId, task.agent, {
      status: 'executing',
      currentTask: task.id
    });
    
    try {
      let result;
      
      if (task.agent === 'laura') {
        result = await this.laura.executeTask(task, task.user, this.getCurrentDate());
      } else if (task.agent === 'robert') {
        result = await this.robert.executeTask(task, task.user);
      } else {
        throw new Error(`Agente desconocido: ${task.agent}`);
      }
      
      // Agregar resultados al contexto compartido
      communicationBus.addAgentResults(conversationId, task.agent, result);
      
      // Actualizar estado del agente
      communicationBus.updateAgentState(conversationId, task.agent, {
        status: 'completed',
        lastExecution: Date.now(),
        executionTime: Date.now() - startTime
      });
      
      return result;
      
    } catch (error) {
      // Actualizar estado de error
      communicationBus.updateAgentState(conversationId, task.agent, {
        status: 'error',
        lastError: error.message,
        executionTime: Date.now() - startTime
      });
      
      throw error;
    }
  }

  /**
   * Inferir herramienta basada en query
   */
  inferToolFromQuery(query) {
    const q = query.toLowerCase();
    
    // Detectar handles explícitos (@username)
    if (q.includes('@')) {
      return 'nitter_profile';
    }
    
    // Detectar nombres conocidos directamente
    if (q.includes('bernardo arevalo') || q.includes('bernardo arévalo')) {
      return 'nitter_context';
    }
    
    // Detectar búsqueda de tweets con nombres - intentar nitter_context primero
    if (q.includes('tweets de') || q.includes('extrame') || q.includes('extrae')) {
      return 'nitter_context';
    }
    
    // Solo usar perplexity para búsquedas ambiguas
    if (q.includes('busca a') || q.includes('encuentra a')) {
      return 'perplexity_search';
    }
    
    // Detectar investigación general
    if (q.includes('investiga') || q.includes('información sobre') || q.includes('quién es')) {
      return 'perplexity_search';
    }
    
    // Default: usar reasoning engine de Laura para decidir
    return null; // Esto forzará el uso del reasoning engine
  }

  /**
   * Construir argumentos para herramientas
   */
  buildToolArgs(query) {
    const tool = this.inferToolFromQuery(query);
    
    switch (tool) {
      case 'nitter_context':
        return {
          q: query,
          location: 'guatemala',
          limit: 20
        };
        
      case 'nitter_profile':
        // Extraer username si está presente
        const usernameMatch = query.match(/@(\w+)/);
        return {
          username: usernameMatch ? usernameMatch[1] : query,
          limit: 20
        };
        
      case 'resolve_twitter_handle':
        return {
          name: query.replace(/busca a|encuentra a|tweets de/gi, '').trim(),
          context: '',
          sector: ''
        };
        
      case 'perplexity_search':
        // Si es búsqueda de usuario, optimizar query para encontrar handle
        const userSearchMatch = query.match(/(?:tweets de|perfil de|extrame|extrae)\s+(.+?)(?:\s|$)/i);
        if (userSearchMatch) {
          const name = userSearchMatch[1].trim();
          return {
            query: `Twitter handle @username para ${name} Guatemala perfil oficial`,
            location: 'Guatemala',
            focus: 'social_media'
          };
        }
        return {
          query: query,
          location: 'Guatemala'
        };
        
      default:
        return { q: query };
    }
  }

  /**
   * Coincidencia de patrones
   */
  matchPattern(query, patternType) {
    const pattern = ROUTING_PATTERNS[patternType];
    if (!pattern) return false;
    
    const queryLower = query.toLowerCase();
    return pattern.keywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Obtener fecha actual formateada
   */
  getCurrentDate() {
    const now = new Date();
    return now.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  /**
   * Limpiar estado si es necesario
   */
  cleanupIfNeeded(conversationId) {
    // Limpiar conversaciones inactivas después de 1 hora
    setTimeout(() => {
      const conversation = this.activeConversations.get(conversationId);
      if (conversation && Date.now() - conversation.lastActivity > 3600000) {
        this.conversationManager.cleanupConversation(conversationId);
        communicationBus.cleanupConversation(conversationId, 'timeout');
      }
    }, 3600000); // 1 hora
  }

  /**
   * Procesar handoff entre agentes
   */
  async processAgentHandoff(fromAgent, toAgent, handoffData, conversationId) {
    console.log(`[VIZTA] 🔄 Procesando handoff: ${fromAgent} → ${toAgent}`);
    
    try {
      // Coordinar handoff a través del bus de comunicación
      const handoffMessage = await communicationBus.coordinateHandoff(
        conversationId, 
        fromAgent, 
        toAgent, 
        handoffData
      );
      
      // Ejecutar tarea en el agente destino
      const handoffTask = {
        id: `handoff_${Date.now()}`,
        agent: toAgent,
        originalQuery: handoffData.userQuery,
        args: handoffData.instructions,
        user: handoffData.user,
        handoffContext: handoffData.context
      };
      
      const result = await this.executeAgentTask(handoffTask, conversationId);
      
      console.log(`[VIZTA] ✅ Handoff completado exitosamente: ${fromAgent} → ${toAgent}`);
      
      return {
        success: true,
        handoffMessage: handoffMessage,
        result: result
      };
      
    } catch (error) {
      console.error(`[VIZTA] ❌ Error en handoff ${fromAgent} → ${toAgent}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener estado de conversación
   */
  getConversationState(conversationId) {
    const busContext = communicationBus.getConversationContext(conversationId);
    const managerContext = this.conversationManager.getConversationState(conversationId);
    
    return {
      conversationId: conversationId,
      busState: busContext,
      managerState: managerContext,
      viztaStats: this.getStats()
    };
  }

  /**
   * Obtener estadísticas del orquestador
   */
  getStats() {
    const busStats = communicationBus.getStats();
    
    return {
      name: 'Vizta',
      role: 'Orquestador Principal',
      activeConversations: this.activeConversations.size,
      agentStates: this.agentStates.size,
      busStats: busStats,
      capabilities: this.config.capabilities,
      coordinationCriteria: this.config.coordinationCriteria
    };
  }

  /**
   * Determina si una intención requiere modo conversacional
   */
  isConversationalIntent(intent) {
    const conversationalIntents = [
      'casual_conversation',
      'capability_question', 
      'help_request',
      'small_talk'
    ];
    
    return conversationalIntents.includes(intent);
  }

  /**
   * Ejecuta modo agéntico para intenciones que requieren agentes especializados
   */
  async executeAgenticMode(userMessage, user, conversationId, intent) {
    console.log(`[VIZTA] 🔧 Ejecutando modo agéntico para: ${intent}`);
    
    try {
      switch (intent) {
        case 'nitter_search':
          return await this.lauraHandlers.handleNitterSearch(userMessage, user, conversationId);
          
        case 'twitter_analysis':
          return await this.lauraHandlers.handleTwitterAnalysis(userMessage, user, conversationId);
          
        case 'user_discovery':
          console.log(`[VIZTA] 🔍 Ejecutando User Discovery para: "${userMessage}"`);
          const userDiscoveryResult = await this.lauraHandlers.handleUserDiscovery(userMessage, user, conversationId);
          
          // Procesar resultado a través del responseOrchestrator
          if (userDiscoveryResult && userDiscoveryResult.data) {
            const orchestratedResponse = await this.responseOrchestrator.orchestrateResponse(
              [userDiscoveryResult], 
              userMessage, 
              { agents: ['laura'] },
              { id: conversationId }
            );
            
            return {
              agent: orchestratedResponse.agent || 'Vizta',
              message: orchestratedResponse.processedContent,
              processedContent: orchestratedResponse.processedContent,
              type: userDiscoveryResult.type,
              timestamp: userDiscoveryResult.timestamp,
              mode: 'agential_processed'
            };
          }
          
          return userDiscoveryResult;

        case 'twitter_profile':
          const profileResult = await this.lauraHandlers.handleTwitterProfile(userMessage, user, conversationId);
          
          console.log(`[VIZTA_DEBUG] 📊 ProfileResult:`, {
            success: profileResult.success,
            hasData: !!profileResult.data,
            agent: profileResult.agent,
            type: profileResult.type
          });
          
          // Procesar a través del responseOrchestrator para obtener contenido formateado
          if (profileResult && profileResult.data) {
            console.log(`[VIZTA_DEBUG] 🔧 Llamando responseOrchestrator con:`, {
              resultsCount: 1,
              userMessage: userMessage.substring(0, 50) + '...',
              conversationId
            });
            
            const orchestratedResponse = await this.responseOrchestrator.orchestrateResponse(
              [profileResult], 
              userMessage, 
              { agents: ['laura'] },
              { id: conversationId }
            );
            
            console.log(`[VIZTA_DEBUG] 📤 OrchestatedResponse:`, {
              success: orchestratedResponse.success,
              hasProcessedContent: !!orchestratedResponse.processedContent,
              processedContentLength: orchestratedResponse.processedContent?.length || 0,
              agentContributionsCount: orchestratedResponse.agentContributions?.length || 0
            });
            
            if (orchestratedResponse.processedContent) {
              console.log(`[VIZTA_DEBUG] ✅ Contenido procesado (primeros 100 chars):`, 
                orchestratedResponse.processedContent.substring(0, 100) + '...');
            } else {
              console.log(`[VIZTA_DEBUG] ❌ NO HAY processedContent`);
            }
            
            return {
              agent: orchestratedResponse.agent || 'Vizta',
              message: orchestratedResponse.processedContent,
              processedContent: orchestratedResponse.processedContent,
              type: profileResult.type,
              timestamp: profileResult.timestamp,
              mode: 'agential_processed'
            };
          }
          
          console.log(`[VIZTA_DEBUG] ❌ ProfileResult no válido, devolviendo resultado original`);
          return profileResult;
          
        case 'web_search':
          return await this.lauraHandlers.handleWebSearch(userMessage, user, conversationId);
          
        case 'search_codex':
          return await this.robertHandlers.handleSearchCodex(userMessage, user, conversationId);
          
        case 'search_projects':
          return await this.robertHandlers.handleSearchProjects(userMessage, user, conversationId);
          
        case 'analyze_document':
          return await this.robertHandlers.handleAnalyzeDocument(userMessage, user, conversationId);
          
        case 'mixed_analysis':
          return await this.mixedHandlers.handleMixedAnalysis(userMessage, user, conversationId);
          
        default:
          // Para intenciones desconocidas, usar el motor de routing original como fallback
          console.log(`[VIZTA] ⚠️ Intención "${intent}" no tiene handler específico, usando fallback`);
          return await this.executeAgenticFallback(userMessage, user, conversationId);
      }
      
    } catch (error) {
      console.error(`[VIZTA] ❌ Error en modo agéntico para ${intent}:`, error);
      
      return {
        agent: 'Vizta',
        success: false,
        message: `Lo siento, hubo un error procesando tu solicitud sobre "${userMessage}". Por favor, intenta de nuevo.`,
        error: error.message,
        intent: intent,
        mode: 'agential_error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fallback para intenciones agénticas no reconocidas
   */
  async executeAgenticFallback(userMessage, user, conversationId) {
    console.log(`[VIZTA] 🔄 Ejecutando fallback agéntico para: "${userMessage}"`);
    
    try {
      // Usar el motor de routing original como fallback
      const conversation = { userMessage, user, startTime: Date.now() };
      const routingDecision = await this.routingEngine.analyzeAndRoute(userMessage, conversation);
      
      if (routingDecision.directResponse) {
        return {
          agent: 'Vizta',
          success: true,
          message: routingDecision.directResponse.message,
          type: 'fallback_direct',
          mode: 'agential_fallback',
          timestamp: new Date().toISOString()
        };
      }
      
      // Ejecutar plan basado en routing engine
      const executionPlan = this.createExecutionPlan(routingDecision, userMessage, user);
      const results = await this.executeTaskPlan(executionPlan, conversationId);
      
      // Orquestar respuesta
      console.log(`[VIZTA_DEBUG] 🔍 Calling responseOrchestrator with results:`, results.length, 'results');
      const unifiedResponse = await this.responseOrchestrator.orchestrateResponse(
        results, 
        userMessage, 
        routingDecision, 
        conversation
      );
      console.log(`[VIZTA_DEBUG] 📤 ResponseOrchestrator returned:`, {
        agent: unifiedResponse.agent,
        processedContent: unifiedResponse.processedContent ? unifiedResponse.processedContent.substring(0, 100) + '...' : 'undefined',
        message: unifiedResponse.message ? unifiedResponse.message.substring(0, 100) + '...' : 'undefined',
        keys: Object.keys(unifiedResponse)
      });
      
      return {
        ...unifiedResponse,
        mode: 'agential_fallback',
        fallbackUsed: true
      };
      
    } catch (error) {
      console.error(`[VIZTA] ❌ Error en fallback agéntico:`, error);
      
      return {
        agent: 'Vizta',
        success: false,
        message: 'Lo siento, no pude procesar tu solicitud en este momento. ¿Podrías reformularla?',
        error: error.message,
        mode: 'agential_fallback_error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Limpiar todos los estados
   */
  cleanup() {
    // Limpiar conversaciones activas
    this.activeConversations.clear();
    this.agentStates.clear();
    
    // Limpiar módulos especializados
    this.conversationManager.cleanup();
    
    console.log(`[VIZTA] 🧹 Cleanup completado`);
  }
}

module.exports = {
  ViztaAgent
}; 