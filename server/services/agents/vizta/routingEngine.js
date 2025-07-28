/**
 * Motor de Routing Inteligente para Vizta
 * Analiza consultas y decide qué agentes deben intervenir
 */
class RoutingEngine {
  constructor(viztaAgent) {
    this.vizta = viztaAgent;
    this.patterns = require('../config/agentCapabilities').ROUTING_PATTERNS;
  }

  /**
   * Analizar consulta y determinar routing
   */
  async analyzeAndRoute(userMessage, conversation) {
    console.log(`[ROUTING] 🔍 Analizando consulta: "${userMessage}"`);
    
    try {
      // PASO 1: Normalizar mensaje
      const normalizedMessage = userMessage.toLowerCase().trim();
      
      // PASO 2: Detectar patrones de respuesta directa
      for (const [patternType, pattern] of Object.entries(this.patterns)) {
        if (pattern.directResponse && this.matchesPattern(normalizedMessage, pattern)) {
          console.log(`[ROUTING] 💬 Detectado patrón de respuesta directa: ${patternType}`);
          
          const directResponse = await this.generateDirectResponse(patternType, userMessage);
          
          return {
            agents: ['vizta'],
            executionMode: 'direct',
            priority: 'immediate',
            directResponse: {
              type: patternType,
              ...directResponse
            }
          };
        }
      }
      
      // PASO 3: Detectar patrones sociales (Laura)
      const socialMatch = this.matchesPattern(normalizedMessage, this.patterns.social);
      if (socialMatch) {
        return {
          agents: ['laura'],
          executionMode: 'parallel',
          priority: 'normal',
          enhanceWithMemory: true
        };
      }
      
      // PASO 4: Detectar patrones personales (Robert)
      const personalMatch = this.matchesPattern(normalizedMessage, this.patterns.personal);
      if (personalMatch) {
        return {
          agents: ['robert'],
          executionMode: 'parallel',
          priority: 'normal'
        };
      }
      
      // PASO 5: Detectar patrones políticos (Laura con memoria)
      const politicalMatch = this.matchesPattern(normalizedMessage, this.patterns.political);
      if (politicalMatch) {
        return {
          agents: ['laura'],
          executionMode: 'parallel',
          priority: 'normal',
          enhanceWithMemory: true,
          usePulsePolitics: true
        };
      }
      
      // PASO 6: Detectar patrones mixtos (Laura + Robert)
      const mixedMatch = this.matchesPattern(normalizedMessage, this.patterns.mixed);
      if (mixedMatch) {
        return {
          agents: ['laura', 'robert'],
          executionMode: 'parallel',
          priority: 'normal'
        };
      }
      
      // PASO 7: Fallback a Laura para consultas ambiguas
      return {
        agents: ['laura'],
        executionMode: 'parallel',
        priority: 'low',
        fallback: true
      };
      
    } catch (error) {
      console.error(`[ROUTING] ❌ Error en análisis:`, error);
      return {
        agents: ['laura'],
        executionMode: 'parallel',
        priority: 'low',
        error: error.message
      };
    }
  }

  /**
   * Verificar si un mensaje coincide con un patrón
   */
  matchesPattern(message, pattern) {
    if (!pattern || !pattern.keywords) return false;
    return pattern.keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Generar respuesta directa para patrones conversacionales
   */
  async generateDirectResponse(type, message) {
    const responses = {
      greeting: [
        "¡Hola! 👋 Soy Vizta, tu asistente inteligente. ¿En qué puedo ayudarte hoy?",
        "¡Hola! 😊 Me alegra verte. Estoy aquí para ayudarte con análisis social y gestión de datos.",
        "¡Bienvenido! 🌟 Soy Vizta, y junto con Laura y Robert podemos ayudarte con análisis de tendencias y más.",
        "¡Hola! 🤖 ¿Qué te gustaría analizar hoy?"
      ],
      
      casual: [
        "¡Muy bien, gracias! 💪 Mis sistemas están funcionando perfectamente. ¿En qué puedo ayudarte?",
        "¡Excelente! 🚀 Laura y Robert están listos para cualquier análisis que necesites.",
        "¡Todo perfecto! 😊 Listo para ayudarte con análisis social, tendencias o tus proyectos personales."
      ],
      
      help: [
        `🎯 **Soy Vizta, tu orquestador inteligente**

**Puedo ayudarte con:**
• 📱 **Análisis social:** Tendencias, tweets, usuarios políticos (vía Laura)
• 📊 **Tus datos:** Proyectos, documentos, codex personal (vía Robert)  
• 🏛️ **Contexto político:** Información del ecosistema PulsePolitics

**Ejemplos de consultas:**
- "Analiza los tweets sobre el congreso"
- "¿Qué dice el presidente Giammattei?"
- "Muéstrame mis proyectos activos"
- "Busca información sobre la nueva ley"

**Solo escribe lo que necesitas y yo me encargo del resto!** ✨`,

        `🤖 **Sistema de Agentes Modular**

**Mi equipo:**
• **Laura** 🕵️‍♀️ - Especialista en redes sociales y política
• **Robert** 📋 - Gestor de tus datos personales y proyectos

**Capacidades especiales:**
- Memoria contextual con PulsePolitics
- Descubrimiento inteligente de usuarios
- Análisis de tendencias en tiempo real
- Gestión de tu codex personal

**¡Pregúntame lo que necesites!** 🚀`
      ]
    };

    const typeResponses = responses[type] || responses.greeting;
    const randomIndex = Math.floor(Math.random() * typeResponses.length);
    
    return {
      message: typeResponses[randomIndex],
      type: type,
      timestamp: new Date().toISOString(),
      agent: 'Vizta',
      direct: true
    };
  }
}

module.exports = {
  RoutingEngine
}; 