/**
 * OpenPipe Integration Module para Vizta
 * Integra el modelo fine-tuneado con la arquitectura existente de agentes
 */

const openPipeService = require('../../openPipeService');

class ViztaOpenPipeIntegration {
  constructor(viztaAgent) {
    this.vizta = viztaAgent;
    this.enabled = process.env.OPENPIPE_API_KEY ? true : false;
    
    console.log(`[VIZTA_OPENPIPE] ${this.enabled ? '✅ Integración habilitada' : '⚠️ Integración deshabilitada - falta API key'}`);
  }

  /**
   * Procesar consulta usando OpenPipe con integración completa de agentes
   */
  async processWithOpenPipe(userMessage, user, conversationId) {
    if (!this.enabled) {
      console.log(`[VIZTA_OPENPIPE] ⚠️ OpenPipe deshabilitado, delegando a sistema tradicional`);
      return await this.vizta.executeAgenticFallback(userMessage, user, conversationId);
    }

    try {
      console.log(`[VIZTA_OPENPIPE] 🎯 Procesando con modelo fine-tuneado: "${userMessage}"`);
      
      const startTime = Date.now();
      
      // PASO 1: Obtener decisión del modelo fine-tuneado
      const openPipeResult = await openPipeService.processViztaQuery(userMessage, user, conversationId);
      
      if (!openPipeResult.success) {
        console.log(`[VIZTA_OPENPIPE] ❌ Error en OpenPipe, usando fallback`);
        return await this.vizta.executeAgenticFallback(userMessage, user, conversationId);
      }

      // PASO 2: Si es conversacional, devolver respuesta directa
      if (openPipeResult.type === 'conversational') {
        console.log(`[VIZTA_OPENPIPE] 💬 Respuesta conversacional generada`);
        return {
          agent: 'Vizta',
          success: true,
          message: openPipeResult.message,
          type: 'conversational_ai',
          mode: 'openpipe_conversational',
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        };
      }

      // PASO 3: Si es function call, coordinar con agentes correspondientes
      if (openPipeResult.type === 'function_call') {
        console.log(`[VIZTA_OPENPIPE] 🔧 Function call detectado: ${openPipeResult.functionCall.name}`);
        
        const functionResult = await this.executeFunctionWithAgentCoordination(
          openPipeResult.functionCall,
          user,
          conversationId
        );

        // PASO 4: Orquestar respuesta usando el ResponseOrchestrator existente
        const orchestratedResponse = await this.vizta.responseOrchestrator.orchestrateResponse(
          [functionResult],
          userMessage,
          { agents: [functionResult.agent?.toLowerCase() || 'laura'] },
          { id: conversationId }
        );

        return {
          agent: orchestratedResponse.agent || 'Vizta',
          success: functionResult.success,
          message: orchestratedResponse.processedContent || functionResult.message,
          processedContent: orchestratedResponse.processedContent,
          type: 'function_response',
          mode: 'openpipe_function_call',
          functionUsed: openPipeResult.functionCall.name,
          data: functionResult.data,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          openPipeUsage: openPipeResult.usage
        };
      }

      // PASO 5: Fallback para casos no esperados
      console.log(`[VIZTA_OPENPIPE] ⚠️ Tipo de respuesta no reconocido: ${openPipeResult.type}`);
      return await this.vizta.executeAgenticFallback(userMessage, user, conversationId);

    } catch (error) {
      console.error(`[VIZTA_OPENPIPE] ❌ Error en integración:`, error);
      return await this.vizta.executeAgenticFallback(userMessage, user, conversationId);
    }
  }

  /**
   * Ejecutar function call coordinando con el agente apropiado
   */
  async executeFunctionWithAgentCoordination(functionCall, user, conversationId) {
    const { name: toolName, arguments: args } = functionCall;
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    
    console.log(`[VIZTA_OPENPIPE] 🎯 Coordinando ${toolName} con agente apropiado`);

    try {
      // Mapear herramientas a agentes específicos
      switch (toolName) {
        case 'nitter_context':
        case 'nitter_profile':
        case 'perplexity_search':
        case 'resolve_twitter_handle':
          return await this.delegateToLaura(toolName, parsedArgs, user, conversationId);
          
        case 'search_political_context':
          return await this.delegateToLauraMemory(toolName, parsedArgs, user, conversationId);
        case 'latest_trends':
          return await this.delegateToOpenPipeDirect(toolName, parsedArgs, user, conversationId);
          
        case 'user_projects':
        case 'user_codex':
        case 'project_findings':
        case 'project_coverages':
          return await this.delegateToRobert(toolName, parsedArgs, user, conversationId);
          
        default:
          throw new Error(`Herramienta no reconocida: ${toolName}`);
      }
      
    } catch (error) {
      console.error(`[VIZTA_OPENPIPE] ❌ Error en coordinación de agentes:`, error);
      return {
        success: false,
        agent: 'Vizta',
        tool: toolName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Delegar a Laura usando handlers existentes
   */
  async delegateToLaura(toolName, args, user, conversationId) {
    try {
      console.log(`[VIZTA_OPENPIPE] 👩‍🔬 Delegando ${toolName} a Laura`);
      
      // Crear tarea compatible con el sistema existente
      const task = {
        id: `openpipe_${toolName}_${Date.now()}`,
        agent: 'laura',
        tool: toolName,
        type: toolName === 'nitter_profile' ? 'profile' : 'monitoring',
        args: args,
        originalQuery: `OpenPipe function call: ${toolName}`,
        user: user,
        startTime: Date.now()
      };

      // Ejecutar usando el sistema existente de Laura
      const result = await this.vizta.laura.executeTask(task, user, this.getCurrentDate());
      
      return {
        success: true,
        agent: 'Laura',
        tool: toolName,
        type: result.type,
        data: result.data || result,
        message: result.message || result.analysis,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[VIZTA_OPENPIPE] ❌ Error delegando a Laura:`, error);
      return {
        success: false,
        agent: 'Laura',
        tool: toolName,
        error: error.message
      };
    }
  }

  /**
   * Delegar a Laura Memory usando cliente existente
   */
  async delegateToLauraMemory(toolName, args, user, conversationId) {
    try {
      console.log(`[VIZTA_OPENPIPE] 🧠 Delegando ${toolName} a Laura Memory`);
      
      const lauraMemoryClient = require('../../lauraMemoryClient');
      
      let result;
      if (toolName === 'search_political_context') {
        result = await lauraMemoryClient.searchPoliticalContext(args.query, args.limit || 5);
      }
      
      return {
        success: true,
        agent: 'LauraMemory',
        tool: toolName,
        data: result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[VIZTA_OPENPIPE] ❌ Error delegando a Laura Memory:`, error);
      return {
        success: false,
        agent: 'LauraMemory',
        tool: toolName,
        error: error.message
      };
    }
  }

  /**
   * Delegar a Robert usando handlers existentes
   */
  async delegateToRobert(toolName, args, user, conversationId) {
    try {
      console.log(`[VIZTA_OPENPIPE] 👨‍💼 Delegando ${toolName} a Robert`);
      
      // Crear tarea compatible con el sistema existente
      const task = {
        id: `openpipe_${toolName}_${Date.now()}`,
        agent: 'robert',
        tool: toolName === 'user_projects' ? 'user_projects' : 'codex_items',
        type: toolName === 'user_projects' ? 'projects' : 'codex',
        collection: toolName === 'user_projects' ? 'user_projects' : 'codex_items',
        args: args,
        user: user,
        startTime: Date.now()
      };

      // Ejecutar usando el sistema existente de Robert
      const result = await this.vizta.robert.executeTask(task, user);
      
      return {
        success: true,
        agent: 'Robert',
        tool: toolName,
        type: result.type,
        data: result.data || result,
        message: result.message || result.analysis,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[VIZTA_OPENPIPE] ❌ Error delegando a Robert:`, error);
      return {
        success: false,
        agent: 'Robert',
        tool: toolName,
        error: error.message
      };
    }
  }

  /**
   * Delegación directa a OpenPipe-executor genérico (para herramientas de solo lectura)
   */
  async delegateToOpenPipeDirect(toolName, args, user, conversationId) {
    try {
      console.log(`[VIZTA_OPENPIPE] 📡 Delegando ${toolName} a OpenPipeService.executeFunctionCall`);
      const result = await openPipeService.executeFunctionCall({ name: toolName, arguments: args }, user, conversationId);
      return {
        success: true,
        agent: 'Vizta',
        tool: toolName,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[VIZTA_OPENPIPE] ❌ Error delegando ${toolName} directo:`, error);
      return { success: false, agent: 'Vizta', tool: toolName, error: error.message };
    }
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
   * Verificar si OpenPipe está disponible
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * Obtener estadísticas de la integración
   */
  getStats() {
    return {
      enabled: this.enabled,
      hasApiKey: !!process.env.OPENPIPE_API_KEY,
      modelId: process.env.OPENPIPE_MODEL_ID || 'openpipe:vizta-function-calling-v1',
      integrationMode: 'agent_coordination'
    };
  }
}

module.exports = ViztaOpenPipeIntegration;