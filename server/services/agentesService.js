const mcpService = require('./mcp');
const geminiService = require('./gemini'); // Servicio Gemini LLM
const { geminiChat } = require('./geminiHelper'); // Helper para Gemini 2.5 Flash
const lauraMemoryClient = require('./lauraMemoryClient'); // Cliente para Laura Memory

// ===================================================================
// AGENTES SERVICE - Sistema Modular de Agentes v2.0
// Usando Vizta como orquestador principal con Laura, Robert y comunicación inter-agente
// ===================================================================

// Importar sistema modular de agentes
const { ViztaAgent } = require('./agents/vizta');

/**
 * Servicio de Agentes Modernizado - Punto de entrada principal
 * Delega toda la lógica al sistema modular con Vizta como orquestador
 */
class AgentesService {
  constructor() {
    // Inicializar Vizta como orquestador principal
    this.vizta = new ViztaAgent();
    
    // Mantener referencia al sistema legacy para compatibilidad
    this.legacyMode = process.env.LEGACY_AGENTS_MODE === 'true';
    
    console.log(`[AGENTES_SERVICE] 🚀 Inicializado en modo ${this.legacyMode ? 'Legacy' : 'Modular v2.0'}`);
    console.log(`[AGENTES_SERVICE] 🎯 Punto de entrada: ${this.legacyMode ? 'Legacy Classes' : 'Vizta Orchestrator'}`);
  }

  /**
   * Método principal de procesamiento - Nuevo sistema modular
   */
  async processUserQuery(userMessage, user, sessionId = null) {
    try {
      // Usar Vizta como punto de entrada principal
      console.log(`[AGENTES_SERVICE] 📨 Procesando: "${userMessage}" para usuario ${user.id}`);
      
      const result = await this.vizta.processUserQuery(userMessage, user, sessionId);
      
      console.log(`[AGENTES_SERVICE] ✅ Procesamiento completado en ${result.metadata?.processingTime || 0}ms`);
      
      return result;
      
    } catch (error) {
      console.error(`[AGENTES_SERVICE] ❌ Error en procesamiento modular:`, error);
      
      // Fallback elegante
      return {
        conversationId: sessionId || `fallback_${Date.now()}`,
        response: {
          agent: 'AgentesService',
          success: false,
          error: 'processing_error',
          message: 'Lo siento, hubo un error procesando tu consulta. Por favor, intenta nuevamente.',
          details: error.message,
          timestamp: new Date().toISOString()
        },
        metadata: {
          error: true,
          errorType: error.name,
          fallback: true
        }
      };
    }
  }

  /**
   * Método de compatibilidad con API legacy
   */
  async processWithLegacyCompatibility(userMessage, user, currentDate) {
    const result = await this.processUserQuery(userMessage, user);
    
    // Convertir formato modular a legacy para compatibilidad
    return {
      success: result.response?.success !== false,
      agent: result.response?.agent || 'Vizta',
      message: result.response?.message || result.response?.analysis || 'Procesado exitosamente',
      data: result.response?.data || result.response,
      conversationId: result.conversationId,
      metadata: result.metadata
    };
  }

  /**
   * Obtener estadísticas del sistema
   */
  getSystemStats() {
    if (!this.vizta) {
      return { error: 'Sistema no inicializado' };
    }
    
    return {
      system: 'Modular Agents v2.0',
      orchestrator: this.vizta.getStats(),
      laura: this.vizta.laura?.userDiscovery?.getStats() || null,
      robert: this.vizta.robert?.getStats() || null,
      communication: this.vizta.communicationBus?.getStats() || null,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Limpiar recursos
   */
  cleanup() {
    if (this.vizta) {
      this.vizta.cleanup();
    }
    console.log(`[AGENTES_SERVICE] 🧹 Cleanup completado`);
  }

  // MÉTODOS LEGACY para compatibilidad con rutas existentes
  
  /**
   * Método legacy: queryLaura
   */
  async queryLaura(userMessage, user, currentDate) {
    console.log(`[AGENTES_SERVICE] 🔄 Llamada legacy a queryLaura, redirigiendo a sistema modular`);
    
    const result = await this.processUserQuery(userMessage, user);
    
    // Convertir al formato legacy esperado
    return {
      success: result.response?.success !== false,
      agent: 'Laura',
      analysis: result.response?.message || result.response?.analysis || 'Análisis completado',
      data: result.response?.data || result.response,
      timestamp: result.metadata?.timestamp || new Date().toISOString()
    };
  }

  /**
   * Método legacy: queryRobert  
   */
  async queryRobert(userMessage, user) {
    console.log(`[AGENTES_SERVICE] 🔄 Llamada legacy a queryRobert, redirigiendo a sistema modular`);
    
    const result = await this.processUserQuery(userMessage, user);
    
    // Convertir al formato legacy esperado
    return {
      success: result.response?.success !== false,
      agent: 'Robert',
      data: result.response?.data || result.response,
      message: result.response?.message || 'Datos procesados exitosamente',
      timestamp: result.metadata?.timestamp || new Date().toISOString()
    };
  }

  /**
   * Método legacy: orchestrateAgents
   */
  async orchestrateAgents(userMessage, user, currentDate) {
    console.log(`[AGENTES_SERVICE] 🔄 Llamada legacy a orchestrateAgents, redirigiendo a sistema modular`);
    return await this.processWithLegacyCompatibility(userMessage, user, currentDate);
  }

  /**
   * Método legacy: processWithLauraDecision
   */
  async processWithLauraDecision(userMessage, user, lauraDecision, sessionId) {
    console.log(`[AGENTES_SERVICE] 🧠 Procesando con decisión de Laura (legacy): ${lauraDecision?.plan?.tool}`);
    
    // El sistema modular ya maneja las decisiones de Laura internamente
    return await this.processUserQuery(userMessage, user, sessionId);
  }
}

// Helper para GPT-3.5-turbo como fallback (mantenido para compatibilidad)
async function gptChat(messages, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurado');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: options.temperature || 0.2,
      max_tokens: options.maxTokens || 1024,
      top_p: options.topP || 0.95
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Exportar instancia del servicio modular
const agentesServiceInstance = new AgentesService();

module.exports = agentesServiceInstance;

// Exportaciones adicionales para compatibilidad y testing
module.exports.AgentesService = AgentesService;
module.exports.ViztaAgent = require('./agents/vizta').ViztaAgent;
module.exports.LauraAgent = require('./agents/laura').LauraAgent;
module.exports.RobertAgent = require('./agents/robert').RobertAgent;

// Helper exports
module.exports.gptChat = gptChat; 