/**
 * Clasificador de intenciones basado en LLM
 * Usa OpenAI para entender la intención del usuario con mayor precisión
 */

const OpenAI = require('openai');

class LLMIntentClassifier {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.model = 'gpt-3.5-turbo';
    this.maxTokens = 50;
    this.temperature = 0.1; // Baja temperatura para respuestas consistentes
  }

  /**
   * Prompt principal para clasificación de intenciones
   */
  getClassificationPrompt(message) {
    return `Eres un clasificador de intenciones para un asistente de IA llamado Vizta.

Clasifica el siguiente mensaje del usuario en UNA de estas categorías exactas:

MODO CONVERSACIONAL (respuesta directa de Vizta):
- "casual_conversation" → saludos, despedidas, conversación casual
- "capability_question" → preguntas sobre qué puede hacer el asistente
- "help_request" → solicitudes de ayuda general o comandos
- "small_talk" → charla casual, chistes, comentarios generales

MODO AGÉNTICO (delegar a agentes especializados):
- "nitter_search" → buscar en Twitter/X, hashtags, trending topics
- "twitter_analysis" → analizar sentimientos, tendencias en Twitter
- "twitter_profile" → buscar perfiles específicos en Twitter
- "web_search" → investigar información general en internet
- "search_codex" → buscar en documentos personales/codex del usuario
- "search_projects" → consultar proyectos activos del usuario
- "analyze_document" → analizar documentos específicos
- "mixed_analysis" → tareas que requieren múltiples agentes

ESPECIALES:
- "unknown" → si no encaja en ninguna categoría anterior

Mensaje del usuario: "${message}"

Responde SOLO con la categoría correspondiente (ejemplo: "casual_conversation").`;
  }

  /**
   * Clasifica la intención usando OpenAI
   */
  async classifyIntent(message, conversationHistory = []) {
    try {
      console.log(`[LLM_CLASSIFIER] 🧠 Clasificando: "${message}"`);
      
      const startTime = Date.now();
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getClassificationPrompt(message)
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const intent = response.choices[0]?.message?.content?.trim();
      const processingTime = Date.now() - startTime;
      
      console.log(`[LLM_CLASSIFIER] ✅ Intención detectada: "${intent}" (${processingTime}ms)`);
      
      // Validar que la respuesta sea una de las categorías válidas
      const validIntents = [
        'casual_conversation', 'capability_question', 'help_request', 'small_talk',
        'nitter_search', 'twitter_analysis', 'twitter_profile', 'web_search',
        'search_codex', 'search_projects', 'analyze_document', 'mixed_analysis',
        'unknown'
      ];
      
      if (!validIntents.includes(intent)) {
        console.warn(`[LLM_CLASSIFIER] ⚠️ Intención inválida "${intent}", usando fallback`);
        return this.fallbackClassification(message);
      }
      
      return {
        intent,
        confidence: 0.85, // Alta confianza para LLM
        processingTime,
        method: 'llm',
        model: this.model
      };
      
    } catch (error) {
      console.error(`[LLM_CLASSIFIER] ❌ Error en clasificación LLM:`, error);
      
      // Fallback a clasificación por regex
      return this.fallbackClassification(message);
    }
  }

  /**
   * Clasificación de fallback usando regex (backup)
   */
  fallbackClassification(message) {
    console.log(`[LLM_CLASSIFIER] 🔄 Usando clasificación fallback para: "${message}"`);
    
    const text = message.toLowerCase().trim();
    
    // Conversacional
    if (/hola|hi|hello|buenos días|buenas tardes|cómo estás|qué tal|gracias|adiós/i.test(text)) {
      return { intent: 'casual_conversation', confidence: 0.7, method: 'fallback' };
    }
    
    if (/qué puedes hacer|quién eres|para qué sirves|qué haces|ayuda|help/i.test(text)) {
      return { intent: 'capability_question', confidence: 0.7, method: 'fallback' };
    }
    
    // Agéntico
    if (/buscar en twitter|twitter|nitter|trending|hashtag|viral/i.test(text)) {
      return { intent: 'nitter_search', confidence: 0.6, method: 'fallback' };
    }
    
    if (/analiza.*twitter|sentimiento.*twitter/i.test(text)) {
      return { intent: 'twitter_analysis', confidence: 0.6, method: 'fallback' };
    }
    
    if (/perfil.*twitter|usuario.*twitter/i.test(text)) {
      return { intent: 'twitter_profile', confidence: 0.6, method: 'fallback' };
    }
    
    if (/busca información|investiga sobre|búsqueda web/i.test(text)) {
      return { intent: 'web_search', confidence: 0.6, method: 'fallback' };
    }
    
    if (/codex|mis documentos|archivos personales/i.test(text)) {
      return { intent: 'search_codex', confidence: 0.6, method: 'fallback' };
    }
    
    if (/mis proyectos|proyectos activos/i.test(text)) {
      return { intent: 'search_projects', confidence: 0.6, method: 'fallback' };
    }
    
    if (/analiza.*documento|resumen.*documento/i.test(text)) {
      return { intent: 'analyze_document', confidence: 0.6, method: 'fallback' };
    }
    
    // Default
    return { intent: 'unknown', confidence: 0.3, method: 'fallback' };
  }

  /**
   * Genera respuesta conversacional usando LLM
   */
  async generateConversationalResponse(message, intent, conversationHistory = []) {
    try {
      const contextPrompt = this.getConversationalPrompt(intent);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: contextPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content?.trim();
      
    } catch (error) {
      console.error(`[LLM_CLASSIFIER] ❌ Error generando respuesta conversacional:`, error);
      return this.getFallbackResponse(intent);
    }
  }

  /**
   * Prompts para respuestas conversacionales
   */
  getConversationalPrompt(intent) {
    const prompts = {
      casual_conversation: `Eres Vizta, un asistente de IA amigable y profesional especializado en análisis de redes sociales y gestión de documentos. Responde de manera natural y cálida a saludos y conversación casual. Mantén un tono profesional pero cercano. Máximo 50 palabras.`,
      
      capability_question: `Eres Vizta, un asistente especializado en análisis de redes sociales y gestión de documentos. Explica detalladamente que puedes hacer:

FUNCIONES PRINCIPALES:
🐦 Twitter/X: Buscar tweets, analizar tendencias, sentimientos, perfiles de usuarios
📚 Codex Personal: Consultar documentos personales del usuario
📋 Proyectos: Revisar estado y información de proyectos activos  
🔍 Investigación: Buscar información actualizada en internet

Incluye ejemplos específicos de comandos que el usuario puede usar. Tono profesional y útil. Máximo 120 palabras.`,
      
      help_request: `Eres Vizta, un asistente de IA especializado. Ofrece ayuda específica con ejemplos concretos de comandos que el usuario puede usar:
- Ejemplos de búsquedas en Twitter
- Comandos para consultar el Codex
- Cómo revisar proyectos
- Tipos de investigación disponibles

Sé específico y práctico. Máximo 100 palabras.`,
      
      small_talk: `Eres Vizta, responde de manera amigable pero profesional a charla casual. Mantén el foco en cómo puedes ayudar al usuario con análisis de redes sociales, documentos o investigación. Máximo 50 palabras.`
    };
    
    return prompts[intent] || prompts.small_talk;
  }

  /**
   * Respuestas de fallback predefinidas
   */
  getFallbackResponse(intent) {
    const responses = {
      casual_conversation: "¡Hola! 👋 Soy Vizta, tu asistente inteligente. ¿En qué puedo ayudarte hoy?",
      
      capability_question: `Puedo ayudarte con:
🐦 **Twitter/X**: Buscar tweets, analizar tendencias, perfiles
📚 **Tu Codex**: Consultar tus documentos personales
📋 **Proyectos**: Revisar el estado de tus proyectos activos
🔍 **Investigación**: Buscar información actualizada en internet

¿Qué necesitas hacer?`,

      help_request: `¡Por supuesto! Te puedo ayudar con:

**Comandos de ejemplo:**
• "busca en twitter sobre guatemala"
• "analiza el sentimiento sobre las elecciones"
• "busca en mi codex información sobre migración"
• "¿cuáles son mis proyectos activos?"
• "investiga sobre la economía guatemalteca"

¿Qué te gustaría hacer?`,

      small_talk: "¡Gracias! ¿Hay algo específico en lo que pueda asistirte hoy? Puedo ayudarte con análisis de redes sociales, consultas de documentos o investigación."
    };
    
    return responses[intent] || "¿En qué puedo ayudarte?";
  }
}

module.exports = new LLMIntentClassifier(); 