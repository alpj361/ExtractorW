/**
 * Laura Agent - Módulo Principal
 * Especializada en análisis de redes sociales, tendencias y monitoreo
 */

const { AGENT_CAPABILITIES } = require('../config/agentCapabilities');
const { communicationBus } = require('../shared/agentCommunication');
const mcpService = require('../../mcp');
const { LauraMemoryClient } = require('./memoryClient');
const { InternalMemoryClient } = require('./internalMemoryClient');

// Módulos especializados de Laura
const { SocialAnalysisEngine } = require('./socialAnalysis');
const { TrendMonitoringEngine } = require('./trendMonitoring');
const { SentimentEngine } = require('./sentimentEngine');
const { ReasoningEngine } = require('./reasoningEngine');
const { UserDiscoveryEngine } = require('./userDiscovery');

class LauraAgent {
  constructor(agentesService) {
    this.name = 'Laura';
    this.config = AGENT_CAPABILITIES.laura;
    this.agentesService = agentesService;
    
    // Usar cliente HTTP que ya funciona perfectamente
    this.memoryClient = new LauraMemoryClient({
      baseURL: process.env.LAURA_MEMORY_URL || 'http://localhost:5001',
      enabled: (process.env.LAURA_MEMORY_ENABLED || 'true').toLowerCase() === 'true'
    });
    console.log(`[LAURA] 🧠 Cliente de memoria HTTP configurado: ${process.env.LAURA_MEMORY_URL || 'http://localhost:5001'}`);
    
    // Cliente interno para UserHandles (Zep search/save)
    this.internalMemoryClient = new InternalMemoryClient({
      enabled: (process.env.LAURA_MEMORY_ENABLED || 'true').toLowerCase() === 'true',
      baseUrl: process.env.LAURA_MEMORY_URL || 'http://localhost:5001'
    });
    console.log(`[LAURA] 🔍 Cliente interno de memoria configurado para UserHandles`);
    
    // Inicializar motores especializados
    this.socialAnalysis = new SocialAnalysisEngine(this);
    this.trendMonitoring = new TrendMonitoringEngine(this);
    this.sentimentEngine = new SentimentEngine(this);
    this.reasoningEngine = new ReasoningEngine(this);
    this.userDiscovery = new UserDiscoveryEngine(this);
    
    // Estado interno
    this.currentTasks = new Map();
    this.sessionContext = new Map();
    
    console.log(`[LAURA] 🤖 Laura Agent inicializada con ${this.config.tools.length} herramientas`);
    console.log(`[LAURA] 🧠 Memoria integrada: ${this.memoryClient.enabled ? 'ACTIVADA' : 'DESACTIVADA'}`);
  }

  /**
   * Punto de entrada principal para ejecutar tareas
   */
  async executeTask(task, user, currentDate) {
    const taskId = task.id || `task_${Date.now()}`;
    console.log(`[LAURA] 🎯 Ejecutando tarea: ${task.type} con herramienta: ${task.tool}`);
    
    // Registrar tarea
    this.currentTasks.set(taskId, { 
      ...task, 
      startTime: Date.now(), 
      status: 'executing',
      user,
      currentDate 
    });

    try {
      // Validar herramienta
      if (!task.tool) {
        throw new Error('Tarea sin herramienta definida');
      }

      if (!this.config.tools.includes(task.tool)) {
        throw new Error(`Herramienta ${task.tool} no disponible para Laura`);
      }

      // Mejorar query con memoria si está habilitado
      let enhancedQuery = task.originalQuery;
      if (this.config.memoryIntegration.enabled && this.config.memoryIntegration.contextEnhancement) {
        const memoryEnhancement = await this.enhanceWithMemory(task.originalQuery);
        if (memoryEnhancement.enhanced) {
          enhancedQuery = memoryEnhancement.enhancedQuery;
          task.memoryContext = memoryEnhancement.memoryContext;
        }
      }

      let result;

      // Routing basado en configuración de reasoning engine
      if (task.useReasoningEngine && this.config.reasoningEngine.enabled) {
        result = await this.executeWithReasoningEngine(task, user, enhancedQuery);
      } else {
        result = await this.executeDirectTool(task, user, enhancedQuery);
      }

      // Procesar resultado según tipo de análisis
      console.log(`[LAURA_DEBUG] 📊 Before processToolResult - result.analysis_type:`, result.analysis_type);
      console.log(`[LAURA_DEBUG] 📊 Before processToolResult - task.type:`, task.type);
      
      // Use result.analysis_type if available, otherwise fall back to task.type
      const analysisType = result.analysis_type || task.type;
      console.log(`[LAURA_DEBUG] 📊 Using analysisType:`, analysisType);
      
      const processedResult = await this.processToolResult(result, analysisType, task, user);
      console.log(`[LAURA_DEBUG] 📤 After processToolResult - processedResult.analysis_type:`, processedResult.analysis_type);

      // Guardar en memoria si está configurado
      if (this.config.memoryIntegration.autoSave && processedResult.success) {
        await this.saveToMemory(task.originalQuery, processedResult, task.tool);
      }

      // Actualizar estado de tarea
      this.currentTasks.set(taskId, { 
        ...this.currentTasks.get(taskId), 
        status: 'completed',
        result: processedResult,
        endTime: Date.now()
      });

      return processedResult;

    } catch (error) {
      console.error(`[LAURA] ❌ Error ejecutando tarea ${taskId}:`, error);
      
      // Actualizar estado de error
      this.currentTasks.set(taskId, { 
        ...this.currentTasks.get(taskId), 
        status: 'error',
        error: error.message,
        endTime: Date.now()
      });

      return {
        agent: 'Laura',
        task_id: taskId,
        success: false,
        error: error.name,
        error_message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Wrapper para buildPlan del reasoningEngine (compatibilidad con API legacy)
   */
  async buildLLMPlan(intent, extra = '', options = {}) {
    console.log(`[LAURA] 🧠 Llamada a buildLLMPlan (wrapper) con intent: "${intent}"`);
    return await this.reasoningEngine.buildPlan(intent, extra, options);
  }

  /**
   * Ejecutar con motor de razonamiento
   */
  async executeWithReasoningEngine(task, user, query) {
    console.log('[LAURA] 🧠 Ejecutando con motor de razonamiento');
    
    // Generar plan con LLM
    const plan = await this.reasoningEngine.buildPlan(query, task.extraInfo);
    
    if (plan.plan.action === 'needs_clarification') {
      return {
        agent: 'Laura',
        task_id: task.id,
        needs_clarification: true,
        follow_up_question: plan.follow_up,
        thought: plan.thought,
        timestamp: new Date().toISOString()
      };
    }

    // Ejecutar plan
    let result;
    if (plan.plan.action === 'direct_execution') {
      result = await this.executeToolWithArgs(plan.plan.tool, plan.plan.args, user);
      result.llm_reasoning = plan.plan.reasoning;
      result.llm_thought = plan.thought;
    } else if (plan.plan.action === 'multi_step_execution') {
      result = await this.executeMultiStepPlan(plan.plan.steps, user, query);
      result.llm_reasoning = plan.plan.reasoning;
      result.llm_thought = plan.thought;
    }

    return result;
  }

  /**
   * Ejecutar herramienta directamente
   */
  async executeDirectTool(task, user, query) {
    console.log(`[LAURA] 🔧 Ejecutando herramienta directa: ${task.tool}`);
    
    // Aplicar filtros inteligentes según la herramienta
    let args = { ...task.args };
    
    if (task.tool === 'nitter_context') {
      args = this.socialAnalysis.applyIntelligentFilters(args, query);
    } else if (task.tool === 'nitter_profile') {
      // Verificar si necesita resolución de usuario
      if (args.username && !args.username.startsWith('@')) {
        const resolvedUser = await this.userDiscovery.enhancedUserDetection(args.username, user);
        if (resolvedUser) {
          args.username = resolvedUser;
        }
      }
    }

    let result = await this.executeToolWithArgs(task.tool, args, user);
    
    // Post-procesar según herramienta
    if (task.tool === 'nitter_profile' && result.success) {
      result = await this.enhanceProfileResult(result, args.username, user);
      // IMPORTANTE: Asignar el analysis_type correcto para el responseOrchestrator
      result.analysis_type = 'profile';
      console.log(`[LAURA_DEBUG] ✅ analysis_type asignado:`, result.analysis_type);
      console.log(`[LAURA_DEBUG] 🔍 Result keys:`, Object.keys(result));
    }

    return result;
  }

  /**
   * Ejecutar herramienta con argumentos
   */
  async executeToolWithArgs(tool, args, user) {
    try {
      return await mcpService.executeTool(tool, args, user);
    } catch (error) {
      console.error(`[LAURA] ❌ Error ejecutando ${tool}:`, error);
      return {
        success: false,
        error: error.message,
        tool: tool,
        args: args
      };
    }
  }

  /**
   * Ejecutar plan multi-paso
   */
  async executeMultiStepPlan(steps, user, originalQuery) {
    console.log(`[LAURA] 🔍 Ejecutando plan multi-paso: ${steps.length} pasos`);
    
    let combinedResult = {
      success: false,
      steps_executed: [],
      tweets: [],
      content: '',
      sources: []
    };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[LAURA] > Paso ${i + 1}/${steps.length}: ${step.tool} - ${step.reasoning}`);

      try {
        const stepResult = await this.executeToolWithArgs(step.tool, step.args, user);
        
        if (stepResult.success) {
          // Combinar resultados
          if (stepResult.tweets) {
            combinedResult.tweets = combinedResult.tweets.concat(stepResult.tweets);
          }
          if (stepResult.content) {
            combinedResult.content += stepResult.content + '\n';
          }
          if (stepResult.sources) {
            combinedResult.sources = combinedResult.sources.concat(stepResult.sources);
          }
          
          combinedResult.steps_executed.push({
            step: i + 1,
            tool: step.tool,
            success: true,
            reasoning: step.reasoning
          });
          
          combinedResult.success = true;
        } else {
          combinedResult.steps_executed.push({
            step: i + 1,
            tool: step.tool,
            success: false,
            error: stepResult.error
          });
        }

        // Evaluación temprana de suficiencia de datos
        if (combinedResult.tweets.length >= 15) {
          const relevance = this.socialAnalysis.assessRelevance(combinedResult, originalQuery);
          if (relevance >= 7) {
            console.log(`[LAURA] ✅ Datos suficientes tras paso ${i + 1} - terminando temprano`);
            break;
          }
        }

      } catch (error) {
        console.error(`[LAURA] ❌ Error en paso ${i + 1}:`, error);
        combinedResult.steps_executed.push({
          step: i + 1,
          tool: step.tool,
          success: false,
          error: error.message
        });
      }
    }

    // Filtrar tweets finales
    if (combinedResult.tweets.length > 0) {
      combinedResult.tweets = this.socialAnalysis.filterRecentTweets(
        combinedResult.tweets, 
        originalQuery
      );
    }

    return combinedResult;
  }

  /**
   * Mejorar resultado de perfil con contexto adicional
   */
  async enhanceProfileResult(result, username, user) {
    console.log(`[LAURA] 🎯 Mejorando resultado de perfil para @${username}`);
    
    try {
      // Obtener contexto web adicional
      const perplexityContext = await this.userDiscovery.enhanceProfileWithPerplexity(username, user);
      if (perplexityContext) {
        result.perplexity_context = perplexityContext;
      }

      // Análisis de sentimientos si hay tweets
      if (result.tweets && result.tweets.length > 0) {
        result.sentiment_analysis = this.sentimentEngine.calculateSentiment(result.tweets);
        result.key_actors = this.socialAnalysis.extractKeyActors(result.tweets);
      }

      return result;
    } catch (error) {
      console.error(`[LAURA] ⚠️ Error mejorando perfil:`, error);
      return result; // Retornar resultado original si falla mejora
    }
  }

  /**
   * Procesar resultado de herramienta según tipo de análisis
   */
  async processToolResult(toolResult, analysisType, taskArgs = {}, user = null) {
    if (!toolResult.success) {
      return {
        agent: 'Laura',
        success: false,
        error: toolResult.error,
        analysis_type: analysisType,
        timestamp: new Date().toISOString()
      };
    }

    const baseResult = {
      agent: 'Laura',
      analysis_type: analysisType,
      success: true,
      timestamp: new Date().toISOString()
    };

    switch (analysisType) {
      case 'monitoring':
      case 'trending':
        return {
          ...baseResult,
          findings: {
            trend: toolResult.query || 'tendencia_detectada',
            mentions: toolResult.tweets?.length || 0,
            sentiment: this.sentimentEngine.calculateSentiment(toolResult.tweets),
            momentum: this.trendMonitoring.calculateMomentum(toolResult.tweets),
            top_posts: toolResult.tweets || [],
            key_actors: this.socialAnalysis.extractKeyActors(toolResult.tweets),
            geographic_focus: 'guatemala',
            relevance_assessment: this.socialAnalysis.assessRelevance(toolResult, taskArgs.originalQuery) >= 7 ? 'alta' : 'media'
          },
          context_note: this.generateContextNote(toolResult, analysisType),
          source_ids: [taskArgs.tool || 'unknown'],
          web_context_added: !!toolResult.perplexity_context
        };

      case 'profile':
        return await this.processProfileResult(toolResult, taskArgs, user, baseResult);

      default:
        return {
          ...baseResult,
          findings: toolResult,
          context_note: 'Análisis general completado'
        };
    }
  }

  /**
   * Procesar resultado específico de perfil
   */
  async processProfileResult(toolResult, taskArgs, user, baseResult) {
    let profileData = toolResult.profile_data || toolResult;
    let profileInfo = profileData.profile || {};
    let tweets = profileData.tweets || [];

    // Manejar auto-continuación desde resolve_twitter_handle
    if (toolResult.auto_continued && toolResult.profile_data) {
      profileInfo = toolResult.profile_data.profile || {};
      tweets = toolResult.profile_data.tweets || [];
    }

    const hasValidTweets = tweets && tweets.length > 0;
    const hasProfileData = profileInfo && Object.keys(profileInfo).length > 0;

    if (!hasValidTweets && !hasProfileData) {
      return {
        ...baseResult,
        success: false,
        error: 'No se obtuvieron datos válidos del perfil'
      };
    }

    // Análisis adicional con Gemini si hay tweets suficientes
    let geminiAnalysis = null;
    if (hasValidTweets && tweets.length >= 3) {
      try {
        geminiAnalysis = await this.socialAnalysis.analyzeWithGemini(tweets, taskArgs.originalQuery);
      } catch (error) {
        console.error(`[LAURA] ⚠️ Error en análisis Gemini:`, error);
      }
    }

    return {
      ...baseResult,
      findings: {
        profile: profileInfo,
        tweets: tweets,
        tweet_count: tweets.length,
        sentiment: hasValidTweets ? this.sentimentEngine.calculateSentiment(tweets) : 0,
        key_topics: hasValidTweets ? this.socialAnalysis.extractKeyTopics(tweets) : [],
        activity_level: hasValidTweets ? this.calculateActivityLevel(tweets) : 'unknown',
        gemini_analysis: geminiAnalysis
      },
      context_note: this.generateProfileContextNote(profileInfo, tweets.length),
      source_ids: ['nitter_profile'],
      web_context_added: !!toolResult.perplexity_context,
      perplexity_context: toolResult.perplexity_context
    };
  }

  /**
   * Generar nota de contexto
   */
  generateContextNote(toolResult, analysisType) {
    const tweetCount = toolResult.tweets?.length || 0;
    const hasWebContext = !!toolResult.perplexity_context;
    
    let note = `Análisis ${analysisType} completado`;
    if (tweetCount > 0) {
      note += ` con ${tweetCount} tweets encontrados`;
    }
    if (hasWebContext) {
      note += `, enriquecido con contexto web`;
    }
    
    return note;
  }

  /**
   * Generar nota de contexto para perfil
   */
  generateProfileContextNote(profileInfo, tweetCount) {
    let note = 'Perfil analizado';
    
    if (profileInfo.name) {
      note += ` para ${profileInfo.name}`;
    }
    
    if (tweetCount > 0) {
      note += ` con ${tweetCount} tweets recientes`;
    }
    
    return note;
  }

  /**
   * Calcular nivel de actividad
   */
  calculateActivityLevel(tweets) {
    if (!tweets || tweets.length === 0) return 'none';
    
    const recentTweets = tweets.filter(tweet => {
      const tweetDate = new Date(tweet.fecha_tweet);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return tweetDate > weekAgo;
    });

    if (recentTweets.length >= 10) return 'high';
    if (recentTweets.length >= 5) return 'medium';
    if (recentTweets.length >= 1) return 'low';
    return 'very_low';
  }

  /**
   * Mejorar query con memoria
   */
  async enhanceWithMemory(query) {
    if (!this.memoryClient.isAvailable()) {
      return { enhanced: false, enhancedQuery: query };
    }

    try {
      const memoryEnhancement = await this.memoryClient.enhanceQueryWithMemory(query);
      
      if (memoryEnhancement.memory_results && memoryEnhancement.memory_results.length > 0) {
        return {
          enhanced: true,
          enhancedQuery: memoryEnhancement.enhanced_query,
          memoryContext: memoryEnhancement.memory_context
        };
      }
      
      return { enhanced: false, enhancedQuery: query };
    } catch (error) {
      console.error(`[LAURA] ⚠️ Error mejorando con memoria:`, error);
      return { enhanced: false, enhancedQuery: query };
    }
  }

  /**
   * Guardar resultado en memoria
   */
  async saveToMemory(originalQuery, result, tool) {
    if (!this.memoryClient.isAvailable() || !result.success) {
      return;
    }

    try {
      await this.memoryClient.processToolResult(tool, result, originalQuery);
    } catch (error) {
      console.error(`[LAURA] ⚠️ Error guardando en memoria:`, error);
    }
  }

  /**
   * Obtener estadísticas del agente
   */
  getStats() {
    return {
      name: this.name,
      activeTasks: this.currentTasks.size,
      toolsAvailable: this.config.tools.length,
      capabilitiesCount: this.config.capabilities.length,
      memoryEnabled: this.config.memoryIntegration.enabled,
      reasoningEnabled: this.config.reasoningEngine.enabled
    };
  }

  /**
   * Limpiar estado
   */
  cleanup() {
    // Limpiar tareas completadas hace más de 1 hora
    const oneHourAgo = Date.now() - 3600000;
    
    for (const [taskId, task] of this.currentTasks) {
      if (task.endTime && task.endTime < oneHourAgo) {
        this.currentTasks.delete(taskId);
      }
    }
  }
}

module.exports = {
  LauraAgent
}; 