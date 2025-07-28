/**
 * Motor de Razonamiento LLM para Laura
 * Maneja decisiones inteligentes sobre qué herramientas usar
 */

const { geminiChat } = require('../../geminiHelper');

// Helper para GPT-3.5-turbo como fallback
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

class ReasoningEngine {
  constructor(lauraAgent) {
    this.laura = lauraAgent;
    this.config = lauraAgent.config.reasoningEngine;
  }

  /**
   * Construir plan de ejecución usando LLM
   */
  async buildPlan(intent, extra = '', options = {}) {
    if (!this.config.enabled) {
      throw new Error('Reasoning engine está deshabilitado');
    }

    const verbose = options.verbose || false;
    
    // Preprocesar intent
    const preprocessedIntent = this.preprocessIntent(intent);
    
    const sysPrompt = this.buildSystemPrompt();
    const userBlock = `Intent: ${preprocessedIntent}\n\nIMPORTANTE: Responde únicamente con JSON válido, sin explicaciones adicionales.`;
    const extraBlock = extra ? `ExtraUserInfo: ${extra}` : '';

    const messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userBlock }
    ];

    if (extra) {
      messages.push({ role: 'user', content: extraBlock });
    }

    let raw, modelUsed, latency = 0;

    try {
      const startTime = Date.now();
      
      if (verbose) {
        console.log(`[LAURA] 🧠 Verbose Mode - Input Intent: "${intent}"`);
        console.log(`[LAURA] 🧠 Verbose Mode - Extra Info: "${extra}"`);
        console.log(`[LAURA] 🧠 Verbose Mode - Messages:`, messages);
      }
      
      // INTENTO 1: Gemini 2.5 Flash (PRINCIPAL)
      try {
        console.log(`[LAURA] 🧠 Intentando con Gemini 2.5 Flash (principal)...`);
        raw = await geminiChat(messages, {
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        });
        modelUsed = 'gemini-2.5-flash';
        console.log(`[LAURA] ✅ Gemini 2.5 Flash exitoso`);
      } catch (geminiError) {
        console.error(`[LAURA] ❌ Gemini 2.5 Flash falló:`, geminiError.message);
        
        // INTENTO 2: GPT-3.5-turbo (FALLBACK)
        try {
          console.log(`[LAURA] 🔄 Fallback a GPT-3.5-turbo...`);
          raw = await gptChat(messages, {
            temperature: this.config.temperature,
            maxTokens: 1024
          });
          modelUsed = 'gpt-3.5-turbo';
          console.log(`[LAURA] ✅ GPT-3.5-turbo exitoso (fallback)`);
        } catch (gptError) {
          console.error(`[LAURA] ❌ GPT-3.5-turbo también falló:`, gptError.message);
          throw new Error(`FALLO CRÍTICO: Ambos LLMs fallaron. GPT: ${gptError.message}, Gemini: ${geminiError.message}`);
        }
      }

      latency = Date.now() - startTime;

      if (verbose) {
        console.log(`[LAURA] 🧠 Verbose Mode - Raw Response (${modelUsed}):`, raw);
        console.log(`[LAURA] 🧠 Verbose Mode - Latencia: ${latency}ms`);
      }

      // Parsear respuesta JSON
      const cleanedResponse = this.cleanJsonResponse(raw);
      let parsed;
      
      try {
        parsed = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error(`[LAURA] ❌ Error parsing JSON:`, parseError.message);
        console.error(`[LAURA] 📄 Raw response:`, raw);
        console.error(`[LAURA] 🧹 Cleaned response:`, cleanedResponse);
        
        throw new Error(`JSON parsing failed: ${parseError.message}. Raw: ${raw.substring(0, 200)}`);
      }

      // Validar estructura
      if (!parsed.plan || !parsed.plan.action) {
        throw new Error(`Invalid plan structure: ${JSON.stringify(parsed)}`);
      }

      // Agregar métricas
      parsed._metrics = {
        model: modelUsed,
        latency: latency,
        timestamp: new Date().toISOString()
      };

      console.log(`[LAURA] ✅ Plan generado exitosamente con ${modelUsed} (${latency}ms)`);
      
      if (verbose) {
        console.log(`[LAURA] 🧠 Verbose Mode - Final Parsed:`, parsed);
      }

      return parsed;

    } catch (error) {
      console.error(`[LAURA] ❌ Error crítico en reasoning engine:`, error);
      throw error;
    }
  }

  /**
   * Construir prompt del sistema
   */
  buildSystemPrompt() {
    const currentDate = new Date().toLocaleDateString('es-ES', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    return `
CRÍTICO: SIEMPRE RESPONDE SOLO EN FORMATO JSON VÁLIDO. NO agregues texto explicativo ni saludos.

Eres Laura, analista especializada en monitoreo de redes sociales guatemaltecas.

**INSTRUCCIÓN FUNDAMENTAL: Tu respuesta DEBE ser JSON válido que empiece con { y termine con }**

**FECHA ACTUAL: ${currentDate}**

**HERRAMIENTAS:**
- nitter_context: Buscar conversaciones sobre temas
- nitter_profile: Obtener tweets de usuarios específicos  
- perplexity_search: Investigar personas o temas desconocidos
- resolve_twitter_handle: Resolver nombres ambiguos a handles específicos

**DECISIÓN SIMPLE EN 2 PASOS:**

1. **CLASIFICACIÓN:**
   - ¿Contiene @username? → nitter_profile
   - ¿Busca tweets "de" alguien? → nitter_profile o resolve_twitter_handle (depende si es @handle o nombre)
   - ¿Busca tweets "sobre" algo? → nitter_context

2. **RESOLUCIÓN DE NOMBRES:**
   - Nombres con @handle → nitter_profile directamente
   - Nombres conocidos CON @handle → usar directamente
   - **Nombres SIN @handle → resolve_twitter_handle primero**
   - **Cargos/roles SIN @handle → resolve_twitter_handle primero**
   - **NUNCA uses perplexity_search para personas o cargos - SIEMPRE resolve_twitter_handle**
   - Temas generales o contexto → perplexity_search

**PERSONAS CONOCIDAS CON @HANDLE (usar nitter_profile directamente):**
- Sandra Torres → @sandralto7  
- Congreso → @CongresoGt
- MP → @MP_Guatemala

**OPTIMIZACIÓN DE QUERIES:**
- Cuando el tema sea genérico (≤2 palabras), agregar hashtags guatemaltecos: #Guate, chapin, GT
- Para temas específicos, usar query directa

**FORMATO DE RESPUESTA (siempre JSON):**
- Para @handles conocidos: usa nitter_profile directamente
- Para nombres SIN @: usa resolve_twitter_handle primero

**MANEJO DE USERNAMES (REGLAS CRÍTICAS):**
- HANDLES EXPLÍCITOS (@username): SIEMPRE usa nitter_profile directamente
- Ejemplos: "@DiegoEspana_" → nitter_profile con "DiegoEspana_"
- NOMBRES PROPIOS SIN @: SIEMPRE usa resolve_twitter_handle primero
- Ejemplos: "Diego España", "Pia Flores" → resolve_twitter_handle, luego auto-continúa nitter_profile
- CARGOS/ROLES: SIEMPRE usa resolve_twitter_handle primero
- Ejemplos: "presidente de Guatemala", "ministro de salud" → resolve_twitter_handle, luego auto-continúa nitter_profile
- REGLA FUNDAMENTAL: nitter_profile SOLO acepta @handles reales, NO nombres de personas ni cargos

**FORMATO JSON OBLIGATORIO:**
RESPONDE ÚNICAMENTE con este JSON (sin texto adicional):
{
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_context|nitter_profile|resolve_twitter_handle",
    "args": {...},
    "reasoning": "Por qué elegí esta herramienta"
  },
  "follow_up": null,
  "thought": "Mi análisis de la consulta"
}

PROHIBIDO: No añadas saludos, explicaciones o texto fuera del JSON.

**EJEMPLOS CORREGIDOS:**

Input: "tweets de Sandra Torres"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_profile",
    "args": {"username": "sandralto7", "limit": 20},
    "reasoning": "Persona conocida con @handle conocido - tweets DE Sandra Torres"
  },
  "follow_up": null,
  "thought": "Solicitud directa de perfil conocido con handle"
}

Input: "tweets de Diego España"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "resolve_twitter_handle",
    "args": {"name": "Diego España", "context": "", "sector": ""},
    "reasoning": "Nombre propio SIN @ - necesita resolución de handle antes de obtener perfil"
  },
  "follow_up": null,
  "thought": "Persona sin handle conocido que requiere búsqueda de handle"
}

Input: "extraeme lo que puedas del presidente de Guatemala"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "resolve_twitter_handle",
    "args": {"name": "presidente de Guatemala", "context": "cargo político", "sector": "gobierno"},
    "reasoning": "Cargo político SIN @ - necesita resolución de handle antes de obtener perfil"
  },
  "follow_up": null,
  "thought": "Cargo político que requiere búsqueda de handle del ocupante actual"
}

Input: "tweets de @CongresoGt"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_profile",
    "args": {"username": "CongresoGt", "limit": 20},
    "reasoning": "Handle explícito proporcionado - usar directamente nitter_profile"
  },
  "follow_up": null,
  "thought": "Handle directo, no necesita resolución"
}

Input: "qué dicen sobre sismos"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_context",
    "args": {"q": "sismo guatemala #Guatemala sismos", "location": "guatemala", "limit": 15},
    "reasoning": "Tema general - buscar conversación sobre sismos"
  },
  "follow_up": null,
  "thought": "Buscar reacciones y conversación sobre sismos"
}

RECORDATORIO FINAL: Responde SOLO con JSON válido, SIN texto adicional.
`;
  }

  /**
   * Preprocesar intent del usuario
   */
  preprocessIntent(intent) {
    // Limpiar y normalizar el intent
    return intent.trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  /**
   * Limpiar respuesta JSON
   */
  cleanJsonResponse(response) {
    if (!response) {
      throw new Error('Respuesta vacía del LLM');
    }

    let cleaned = response.trim();
    
    // Remover texto antes del primer {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) {
      cleaned = cleaned.substring(firstBrace);
    }
    
    // Remover texto después del último }
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    }
    
    // Remover bloques de código markdown si existen
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/\s*```/g, '');
    
    return cleaned;
  }

  /**
   * Validar plan generado
   */
  validatePlan(plan) {
    if (!plan || typeof plan !== 'object') {
      throw new Error('Plan debe ser un objeto');
    }

    if (!plan.plan || typeof plan.plan !== 'object') {
      throw new Error('Plan debe tener propiedad "plan"');
    }

    if (!plan.plan.action) {
      throw new Error('Plan debe especificar "action"');
    }

    const validActions = ['direct_execution', 'multi_step_execution', 'needs_clarification'];
    if (!validActions.includes(plan.plan.action)) {
      throw new Error(`Action debe ser uno de: ${validActions.join(', ')}`);
    }

    if (plan.plan.action === 'direct_execution') {
      if (!plan.plan.tool) {
        throw new Error('direct_execution requiere "tool"');
      }
      
      const validTools = this.laura.config.tools;
      if (!validTools.includes(plan.plan.tool)) {
        throw new Error(`Tool debe ser uno de: ${validTools.join(', ')}`);
      }
    }

    return true;
  }

  /**
   * Obtener estadísticas del motor
   */
  getStats() {
    return {
      enabled: this.config.enabled,
      models: this.config.models,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    };
  }
}

module.exports = {
  ReasoningEngine
}; 