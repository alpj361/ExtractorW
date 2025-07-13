const mcpService = require('./mcp');
const geminiService = require('./gemini'); // Servicio Gemini LLM
const { geminiChat } = require('./geminiHelper'); // Helper para Gemini 2.5 Flash

// ===================================================================
// AGENTES SERVICE - Sistema de 3 agentes colaborativos
// Vizta (orquestador) + Laura (monitoreo) + Robert (documentos)
// ===================================================================

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

/**
 * Laura - Analista de Monitoreo
 * Especializada en redes sociales, tendencias y análisis de sentimiento
 */
class LauraAgent {
  constructor() {
    this.name = 'Laura';
    this.role = 'Analista de Monitoreo';
    this.personality = 'Curiosa, meticulosa, analítica. Se emociona con patrones de datos.';
    this.tools = ['nitter_context', 'nitter_profile', 'perplexity_search'];
  }

  getPrompt(currentDate, currentMonth, currentYear) {
    return `Eres Laura, analista de monitoreo especializada en vigilancia de redes sociales y fuentes abiertas.

**PERSONALIDAD:**
• Curiosa y meticulosa
• Profundamente analítica 
• Te emocionas con patrones de datos
• Breve y directa en comunicación

**FECHA ACTUAL: ${currentDate}**
**ENFOQUE TEMPORAL: ${currentMonth} ${currentYear}**

**MISIÓN:**
Detectar tendencias relevantes, proveer señales tempranas, métricas y contexto detrás de cada tendencia para Guatemala.

**HERRAMIENTAS DISPONIBLES:**
- nitter_context: Análisis de conversaciones y tendencias en redes sociales
- nitter_profile: Monitoreo de usuarios específicos importantes
- perplexity_search: Búsqueda web y noticias actualizadas

**FORMATO DE RESPUESTA:**
Siempre responde en JSON estructurado:
\`\`\`json
{
  "agent": "Laura",
  "analysis_type": "monitoring|trending|profile|web_research",
  "findings": {
    "trend": "nombre_tendencia",
    "mentions": número,
    "sentiment": valor_entre_-1_y_1,
    "momentum": valor_entre_0_y_1,
    "top_posts": [...],
    "key_actors": [...],
    "geographic_focus": "guatemala|regional|global",
    "relevance_assessment": "alta|media|baja"
  },
  "context_note": "Breve explicación del patrón detectado y su relevancia",
  "source_ids": ["tool_usado", "parámetros"],
  "web_context_added": boolean,
  "timestamp": "ISO_timestamp"
}
\`\`\`

**ESTRATEGIA DE BÚSQUEDA INTELIGENTE:**

🎯 **BÚSQUEDA SOCIAL DIRECTA CON FILTROS:**
- Aplica filtros semánticos directos al hacer búsquedas en redes sociales
- Usa términos específicos y excluye palabras problemáticas automáticamente
- Enfoca búsquedas en contexto guatemalteco real

**SISTEMA DE FILTROS INTELIGENTES:**
- INCLUIR: Términos específicos del contexto guatemalteco
- EXCLUIR: Palabras genéricas que traen ruido ("GT" gaming, "game", etc.)
- CONTEXTUALIZAR: Ubicación y tema específico

**EJEMPLO DE FLUJO OPTIMIZADO:**
- Usuario: "¿Qué dicen sobre la ley de protección animal?"
- Laura: nitter_context con filtros específicos
- Filtros aplicados: incluir["ley", "protección", "animal", "Guatemala"], excluir["GT", "game"]
- Resultado: Tweets relevantes del contexto guatemalteco

**HERRAMIENTAS Y SU PROPÓSITO:**
- nitter_context: Búsqueda principal con filtros inteligentes
- nitter_profile: Monitorear cuentas oficiales relevantes
- perplexity_search: Contexto adicional OPCIONAL cuando sea necesario

**PALABRAS CLAVE GUATEMALA:**
Guatemala, Guate, Chapin, GuatemalaGob, CongresoGt, MPguatemala, TSE, política guatemalteca, etc.

Tu trabajo es ser los ojos y oídos de Pulse Jornal en el ecosistema digital guatemalteco.`;
  }

  async buildLLMPlan(intent, extra = '', options = {}) {
    const verbose = options.verbose || process.env.LAURA_VERBOSE_MODE === 'true';
    const sysPrompt = `
Eres Laura, experta en redes sociales guatemaltecas y análisis de tendencias digitales.

Dispones de herramientas:
- nitter_context(q, location, limit): Análisis de conversaciones y tendencias en redes sociales
- nitter_profile(username, limit): Monitoreo de usuarios específicos importantes  
- perplexity_search(query): Búsqueda web y noticias actualizadas

**ESTRATEGIA PRINCIPAL: ANÁLISIS PALABRA POR PALABRA**
Para consultas complejas como "reacciones sobre deportes guatemaltecos", usa SIEMPRE la acción "word_by_word_analysis" que:
1. Analiza cada concepto por separado con perplexity_search
2. Combina los contextos obtenidos
3. Ejecuta búsqueda social optimizada con nitter_context

**INSTRUCCIONES PARA OPTIMIZAR QUERIES:**
- SIEMPRE optimiza la query 'q' usando jerga de redes sociales, hashtags populares, slang guatemalteco y términos específicos de Twitter/X.
- Enfócate en Guatemala: Usa términos como #Guate, Chapin, GT (solo para Guatemala, no gaming), selección nacional, etc.
- Para temas vagos, expande con sinónimos, emojis comunes y hashtags relevantes (e.g., para deportes: #FutbolGT, crema vs rojo, selección guate).
- Evita queries literales; transfórmalas en cómo la gente habla en Twitter.

Tu objetivo es producir un JSON con el plan de acción y seguimiento necesario.

INSTRUCCIONES CRÍTICAS:
1. RESPONDE **solo** con JSON válido, sin explicaciones extra.
2. NO agregues texto antes o después del JSON.
3. NO uses formato markdown con backticks.
4. NO uses bloques de código.
5. Asegúrate de que el JSON sea válido y parseable.
6. Tu respuesta debe comenzar con { y terminar con }.

Formato de respuesta:
{
  "plan": {
    "action": "word_by_word_analysis|direct_execution|needs_clarification",
    "tool": "nitter_context|nitter_profile|perplexity_search",
    "args": {...},
    "reasoning": "Por qué elegiste esta herramienta y parámetros"
  },
  "follow_up": "pregunta_para_el_usuario_si_necesitas_aclaración_o_null",
  "thought": "análisis_interno_del_contexto_y_estrategia"
}

EJEMPLOS ESPECÍFICOS:

Input: "reacciones sobre deportes guatemaltecos"
Output: {
  "plan": {
    "action": "word_by_word_analysis",
    "steps": [
      {
        "step": 1,
        "tool": "perplexity_search",
        "args": {"query": "deportes Guatemala enero 2025 actualidad noticias", "location": "guatemala", "focus": "deportes"},
        "reasoning": "Busco contexto específico sobre deportes en Guatemala para entender eventos actuales"
      },
      {
        "step": 2,
        "tool": "perplexity_search", 
        "args": {"query": "futbol Guatemala selección nacional liga 2025", "location": "guatemala", "focus": "futbol"},
        "reasoning": "Análisis específico del fútbol guatemalteco que genera más reacciones"
      },
      {
        "step": 3,
        "tool": "perplexity_search",
        "args": {"query": "reacciones redes sociales Guatemala deportes hashtags", "location": "guatemala", "focus": "reacciones"},
        "reasoning": "Contexto sobre cómo reacciona la gente en redes sociales sobre deportes"
      },
      {
        "step": 4,
        "tool": "nitter_context",
        "args": {"q": "[CONTEXT_COMBINED]", "location": "guatemala", "limit": 20},
        "reasoning": "Combino contextos para buscar reacciones específicas sobre eventos deportivos"
      }
    ],
    "reasoning": "Análisis palabra por palabra: 'reacciones' + 'deportes' + 'guatemaltecos' para encontrar eventos específicos"
  },
  "follow_up": null,
  "thought": "Análisis palabra por palabra permite encontrar eventos específicos que generan reacciones"
}

Input: "qué dicen sobre el sismo"
Output: {
  "plan": {
    "action": "word_by_word_analysis",
    "steps": [
      {
        "step": 1,
        "tool": "perplexity_search",
        "args": {"query": "sismo Guatemala enero 2025 reciente", "location": "guatemala", "focus": "sismo"},
        "reasoning": "Busco información específica sobre sismos recientes en Guatemala"
      },
      {
        "step": 2,
        "tool": "perplexity_search",
        "args": {"query": "INSIVUMEH sismo magnitud epicentro Guatemala", "location": "guatemala", "focus": "datos_tecnicos"},
        "reasoning": "Busco datos técnicos específicos del sismo más reciente"
      },
      {
        "step": 3,
        "tool": "perplexity_search",
        "args": {"query": "reacciones población sismo Guatemala redes sociales", "location": "guatemala", "focus": "reacciones"},
        "reasoning": "Busco cómo está reaccionando la población al sismo en redes sociales"
      },
      {
        "step": 4,
        "tool": "nitter_context",
        "args": {"q": "[CONTEXT_COMBINED]", "location": "guatemala", "limit": 15},
        "reasoning": "Combino contextos para buscar reacciones específicas sobre el sismo con datos técnicos precisos"
      }
    ],
    "reasoning": "Análisis por conceptos: 'qué dicen' + 'sismo' requiere contexto técnico específico + reacciones actuales"
  },
  "follow_up": null,
  "thought": "Sismos requieren datos técnicos específicos (magnitud, epicentro) para encontrar reacciones relevantes"
}

Input: "noticias recientes"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_context",
    "args": {"q": "noticias guate #UltimaHoraGT chapin breaking news sismos política", "location": "guatemala", "limit": 10},
    "reasoning": "Expando vaga query con hashtags #UltimaHoraGT, slang 'guate' 'chapin', temas comunes como 'sismos' 'política'"
  },
  "follow_up": null,
  "thought": "Optimización para noticias generales con elementos virales"
}

Input: "Analiza @CongresoGt"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_profile",
    "args": {"username": "CongresoGt", "limit": 20},
    "reasoning": "Uso nitter_profile para monitorear la cuenta oficial del Congreso de Guatemala"
  },
  "follow_up": null,
  "thought": "Solicitud clara de análisis de perfil específico, procedo con monitoreo directo"
}

Input: "¿Qué está pasando?"
Output: {
  "plan": {
    "action": "needs_clarification",
    "tool": "nitter_context",
    "args": {"q": "Guatemala noticias", "location": "guatemala", "limit": 10},
    "reasoning": "Consulta muy amplia, necesito aclaración para enfocar mejor el análisis"
  },
  "follow_up": "¿Te interesa saber sobre algún tema específico? Por ejemplo: política, economía, sismos, elecciones, etc.",
  "thought": "Consulta muy general, mejor pedir especificación para dar resultado más útil"
}
`;

    const userBlock = `Intent: ${intent}`;
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
      
      // INTENTO 1: GPT-3.5-turbo (PRINCIPAL)
      try {
        console.log(`[LAURA] 🧠 Intentando con GPT-3.5-turbo (principal)...`);
        raw = await gptChat(messages, {
          temperature: 0.2,
          maxTokens: 1024
        });
        modelUsed = 'gpt-3.5-turbo';
        console.log(`[LAURA] ✅ GPT-3.5-turbo exitoso`);
      } catch (gptError) {
        console.error(`[LAURA] ❌ GPT-3.5-turbo falló:`, gptError.message);
        
        // INTENTO 2: Gemini 2.5 Flash (FALLBACK)
        try {
          console.log(`[LAURA] 🔄 Fallback a Gemini 2.5 Flash...`);
          raw = await geminiChat(messages, {
            temperature: 0.2,
            maxTokens: 1024
          });
          modelUsed = 'gemini-2.5-flash';
          console.log(`[LAURA] ✅ Gemini 2.5 Flash exitoso`);
        } catch (geminiError) {
          console.error(`[LAURA] ❌ Gemini 2.5 Flash también falló:`, geminiError.message);
          
          // FALLO TOTAL: No extraer tweets
          throw new Error(`FALLO CRÍTICO: Ambos LLMs fallaron. GPT: ${gptError.message}, Gemini: ${geminiError.message}`);
        }
      }

      latency = Date.now() - startTime;

      // Logging de métricas
      console.log(`[LAURA] 🧠 ${modelUsed} - Latencia: ${latency}ms`);
      console.log(`[LAURA] 🧠 Tokens estimados: ${this.estimateTokens(raw)} tokens`);
      console.log(`[LAURA] 🧠 Prompt tokens: ${this.estimateTokens(messages.map(m => m.content).join(' '))} tokens`);

      if (verbose) {
        console.log(`[LAURA] 🧠 Verbose Mode - Raw Response:`, raw);
      }

      // Limpiar la respuesta de posibles formato markdown
      let cleanedRaw = raw.trim();
      
      // Remover bloques de código markdown si existen
      if (cleanedRaw.startsWith('```json')) {
        cleanedRaw = cleanedRaw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedRaw.startsWith('```')) {
        cleanedRaw = cleanedRaw.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Asegurar que comience con { y termine con }
      cleanedRaw = cleanedRaw.trim();
      if (!cleanedRaw.startsWith('{')) {
        // Buscar el primer {
        const firstBrace = cleanedRaw.indexOf('{');
        if (firstBrace !== -1) {
          cleanedRaw = cleanedRaw.substring(firstBrace);
        } else {
          throw new Error(`No se encontró JSON válido en la respuesta. Raw: ${raw.substring(0, 200)}...`);
        }
      }
      if (!cleanedRaw.endsWith('}')) {
        // Buscar el último }
        const lastBrace = cleanedRaw.lastIndexOf('}');
        if (lastBrace !== -1) {
          cleanedRaw = cleanedRaw.substring(0, lastBrace + 1);
        } else {
          // Intentar reparar JSON incompleto agregando }
          console.log(`[LAURA] ⚠️ JSON incompleto detectado, intentando reparar...`);
          const openBraces = (cleanedRaw.match(/{/g) || []).length;
          const closeBraces = (cleanedRaw.match(/}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          
          if (missingBraces > 0) {
            cleanedRaw += '}' .repeat(missingBraces);
            console.log(`[LAURA] 🔧 Agregadas ${missingBraces} llaves de cierre`);
          }
        }
      }

      // Log del JSON limpio para debugging
      console.log(`[LAURA] 🔍 JSON limpio (${cleanedRaw.length} chars):`, cleanedRaw.substring(0, 500) + (cleanedRaw.length > 500 ? '...' : ''));

      if (verbose) {
        console.log(`[LAURA] 🧠 Verbose Mode - Cleaned Response:`, cleanedRaw);
      }

      // Validar que el JSON sea parseable antes de intentar
      if (!cleanedRaw || cleanedRaw.length < 10) {
        throw new Error(`Respuesta demasiado corta para ser JSON válido: "${cleanedRaw}"`);
      }

      let parsed;
      try {
        parsed = JSON.parse(cleanedRaw);
      } catch (parseError) {
        console.error(`[LAURA] ❌ Error parseando JSON:`, parseError.message);
        console.error(`[LAURA] 📄 JSON problemático:`, cleanedRaw);
        
        // Intentar reparaciones más agresivas para JSONs incompletos de Gemini
        let repairedJson = cleanedRaw;
        
        console.log(`[LAURA] 🔧 Intentando reparaciones avanzadas...`);
        
        // 1. Detectar si falta el cierre del JSON completamente
        const openBraces = (repairedJson.match(/{/g) || []).length;
        const closeBraces = (repairedJson.match(/}/g) || []).length;
        const openBrackets = (repairedJson.match(/\[/g) || []).length;
        const closeBrackets = (repairedJson.match(/]/g) || []).length;
        
        // 2. Detectar si se cortó en medio de una string
        const quotes = (repairedJson.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
          repairedJson += '"';
          console.log(`[LAURA] 🔧 Cerrando comilla faltante`);
        }
        
        // 3. Agregar cierres de arrays faltantes
        if (openBrackets > closeBrackets) {
          const missingBrackets = openBrackets - closeBrackets;
          repairedJson += ']'.repeat(missingBrackets);
          console.log(`[LAURA] 🔧 Agregando ${missingBrackets} cierres de array`);
        }
        
        // 4. Agregar cierres de objetos faltantes
        if (openBraces > closeBraces) {
          const missingBraces = openBraces - closeBraces;
          repairedJson += '}'.repeat(missingBraces);
          console.log(`[LAURA] 🔧 Agregando ${missingBraces} cierres de objeto`);
        }
        
        // 5. Limpiar trailing commas y caracteres problemáticos
        repairedJson = repairedJson
          .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
          .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2')  // Fix escape sequences
          .replace(/[\x00-\x1F\x7F]/g, '');  // Remove control characters
          
        // 6. Si aún no es válido, intentar completar campos específicos que esperamos
        if (!repairedJson.includes('"follow_up"')) {
          // Asegurar que tenga los campos mínimos esperados
          const hasThought = repairedJson.includes('"thought"');
          if (!hasThought && repairedJson.includes('"reasoning"')) {
            // Agregar campos faltantes antes del último }
            const lastBrace = repairedJson.lastIndexOf('}');
            if (lastBrace > 0) {
              const insertion = ', "follow_up": null, "thought": "Análisis completado con datos disponibles"';
              repairedJson = repairedJson.slice(0, lastBrace) + insertion + repairedJson.slice(lastBrace);
            }
          }
        }
        
        try {
          console.log(`[LAURA] 🔧 Intentando JSON reparado (${repairedJson.length} chars)...`);
          parsed = JSON.parse(repairedJson);
          console.log(`[LAURA] ✅ JSON reparado exitosamente!`);
        } catch (repairError) {
          console.error(`[LAURA] ❌ Reparación falló:`, repairError.message);
          
                      // 7. FALLBACK A GPT-3.5 PARA WORD_BY_WORD_ANALYSIS
            if (modelUsed === 'gemini-2.5-flash') {
              try {
                console.log(`[LAURA] 🔄 Fallback a GPT-3.5 para análisis palabra por palabra...`);
                
                // Prompt específico para GPT-3.5 enfocado en word_by_word_analysis
                const gptMessages = [
                  { 
                    role: 'system', 
                    content: `Eres Laura, especialista en análisis palabra por palabra para redes sociales guatemaltecas.

INSTRUCCIONES CRÍTICAS:
1. SIEMPRE usa "action": "word_by_word_analysis" 
2. Analiza cada concepto de la consulta con perplexity_search separado
3. El último paso debe ser nitter_context con "q": "[CONTEXT_COMBINED]"
4. Responde SOLO JSON válido, sin markdown ni explicaciones extra

Formato:
{
  "plan": {
    "action": "word_by_word_analysis",
    "steps": [
      {"step": 1, "tool": "perplexity_search", "args": {"query": "concepto1 Guatemala...", "focus": "concepto1"}, "reasoning": "..."},
      {"step": 2, "tool": "perplexity_search", "args": {"query": "concepto2 Guatemala...", "focus": "concepto2"}, "reasoning": "..."},
      {"step": 3, "tool": "nitter_context", "args": {"q": "[CONTEXT_COMBINED]", "location": "guatemala", "limit": 20}, "reasoning": "..."}
    ],
    "reasoning": "Análisis palabra por palabra de la consulta"
  },
  "follow_up": null,
  "thought": "Estrategia palabra por palabra para máxima precisión"
}` 
                  },
                  { role: 'user', content: `Analiza: ${intent}` }
                ];
                
                const gptRaw = await gptChat(gptMessages, {
                  temperature: 0.2,
                  maxTokens: 1024
                });
              
              // Limpiar respuesta GPT
              let cleanedGptRaw = gptRaw.trim();
              if (cleanedGptRaw.startsWith('```json')) {
                cleanedGptRaw = cleanedGptRaw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              } else if (cleanedGptRaw.startsWith('```')) {
                cleanedGptRaw = cleanedGptRaw.replace(/^```\s*/, '').replace(/\s*```$/, '');
              }
              
              try {
                parsed = JSON.parse(cleanedGptRaw);
                console.log(`[LAURA] ✅ GPT-3.5 fallback exitoso - generando plan word_by_word_analysis`);
                modelUsed = 'gpt-3.5-turbo-fallback';
              } catch (gptParseError) {
                console.error(`[LAURA] ❌ GPT-3.5 también generó JSON inválido:`, gptParseError.message);
                throw new Error('FALLO CRÍTICO: Ambos LLMs generaron JSON inválido');
              }
            } catch (gptError) {
              console.error(`[LAURA] ❌ GPT-3.5 fallback falló:`, gptError.message);
              throw new Error(`FALLO CRÍTICO: Gemini y GPT-3.5 fallaron. Gemini JSON inválido, GPT: ${gptError.message}`);
            }
          } else {
            // Si ya estábamos en GPT-3.5, crear plan de emergencia como último recurso
            console.log(`[LAURA] 🚨 Creando plan de emergencia como último recurso...`);
            parsed = {
              plan: {
                action: "word_by_word_analysis",
                steps: [
                  {
                    step: 1,
                    tool: "perplexity_search",
                    args: {
                      query: `${intent} Guatemala actualidad`,
                      location: "guatemala",
                      focus: "general"
                    },
                    reasoning: "Búsqueda general de contexto debido a fallo del LLM"
                  },
                  {
                    step: 2,
                    tool: "nitter_context",
                    args: {
                      q: "[CONTEXT_COMBINED]",
                      location: "guatemala",
                      limit: 15
                    },
                    reasoning: "Extracción de tweets con contexto combinado"
                  }
                ],
                reasoning: "Plan de emergencia word_by_word debido a fallo de ambos LLMs"
              },
              follow_up: null,
              thought: "Ejecutando análisis palabra por palabra como plan de emergencia"
            };
            console.log(`[LAURA] ⚠️ Plan de emergencia word_by_word creado`);
          }
        }
      }
      
      // Validar estructura del plan según el tipo de acción
      if (!parsed.plan || !parsed.plan.action) {
        throw new Error('Estructura de plan inválida - falta plan.action');
      }
      
      // Validar según el tipo de acción
      if (parsed.plan.action === 'direct_execution') {
        if (!parsed.plan.tool) {
          throw new Error('Estructura de plan inválida - direct_execution requiere tool');
        }
      } else if (parsed.plan.action === 'multi_step_execution' || parsed.plan.action === 'word_by_word_analysis') {
        if (!parsed.plan.steps || !Array.isArray(parsed.plan.steps) || parsed.plan.steps.length === 0) {
          throw new Error('Estructura de plan inválida - multi_step/word_by_word requiere steps array');
        }
        // Validar que cada step tenga tool
        for (let i = 0; i < parsed.plan.steps.length; i++) {
          const step = parsed.plan.steps[i];
          if (!step.tool) {
            throw new Error(`Estructura de plan inválida - step ${i + 1} requiere tool`);
          }
        }
      } else if (parsed.plan.action === 'needs_clarification') {
        if (!parsed.follow_up) {
          throw new Error('Estructura de plan inválida - needs_clarification requiere follow_up');
        }
      } else {
        throw new Error(`Acción desconocida: ${parsed.plan.action}`);
      }

      if (verbose) {
        console.log(`[LAURA] 🧠 Verbose Mode - Parsed Plan:`, parsed);
        console.log(`[LAURA] 🧠 Verbose Mode - Thought: "${parsed.thought}"`);
        console.log(`[LAURA] 🧠 Verbose Mode - Reasoning: "${parsed.plan.reasoning}"`);
      }

      // Agregar métricas al plan
      parsed._metrics = {
        latency_ms: latency,
        timestamp: new Date().toISOString(),
        model: modelUsed,
        tokens_used: this.estimateTokens(raw)
      };

      return parsed;
    } catch (error) {
      console.error('[LAURA] ❌ ERROR CRÍTICO en buildLLMPlan:', error);
      
      // SI AMBOS LLMs FALLAN, NO PERMITIR EXTRACCIÓN DE TWEETS
      throw new Error(`FALLO CRÍTICO DEL MOTOR LLM: ${error.message}`);
    }
  }

  async executeTask(task, user, currentDate) {
    console.log(`[LAURA] > Ejecutando tarea: ${task.type}`);
    
    try {
      let finalResult = {};
      let executionSteps = [];
      
      if (task.useReasoningEngine) {
        task.originalQuery = task.originalQuery || task.description || 'default query';
        console.log('[LAURA] > FORZANDO motor de razonamiento con fallback automático');

        try {
          const llmPlan = await this.buildLLMPlan(task.originalQuery, task.extraInfo);
          console.log(`[LAURA] > Plan generado exitosamente:`, llmPlan);
          
          // Si necesita aclaración, retornar el follow_up
          if (llmPlan.plan.action === 'needs_clarification' && llmPlan.follow_up) {
            return {
              agent: 'Laura',
              task_id: task.id,
              needs_clarification: true,
              follow_up_question: llmPlan.follow_up,
              thought: llmPlan.thought,
              timestamp: new Date().toISOString()
            };
          }
          
          // Ejecutar el plan generado por el LLM
          if (llmPlan.plan.action === 'direct_execution') {
            if (llmPlan.plan.tool === 'nitter_context' && llmPlan.plan.args?.q) {
              llmPlan.plan.args.q = this.enforceSocialJargon(llmPlan.plan.args.q);
            }
            finalResult = await mcpService.executeTool(llmPlan.plan.tool, llmPlan.plan.args, user);
            // Filtrar tweets recientes
            finalResult.tweets = this.filterRecentTweets(finalResult.tweets, 45);
            executionSteps.push('gemini_reasoned_execution');
            
            // Guardar el razonamiento del LLM
            finalResult.llm_reasoning = llmPlan.plan.reasoning;
            finalResult.llm_thought = llmPlan.thought;
            finalResult.llm_model = llmPlan._metrics?.model || 'unknown';
          } else if (llmPlan.plan.action === 'multi_step_execution') {
            let currentStep = 0;
            for (const step of llmPlan.plan.steps) {
              currentStep++;
              console.log(`[LAURA] > Ejecutando paso ${currentStep} de ${llmPlan.plan.steps.length}: ${step.tool} - ${step.reasoning}`);
              
              if (step.tool === 'perplexity_search') {
                const perplexityResult = await mcpService.executeTool('perplexity_search', step.args, user);
                finalResult.webContext = perplexityResult.content || perplexityResult.webContext;
                finalResult.sources = perplexityResult.sources || finalResult.sources;
                finalResult.content = perplexityResult.content || perplexityResult.webContext;
                executionSteps.push('perplexity_search_step');
              } else if (step.tool === 'nitter_context') {
                // Reemplazar [CONTEXT_DEPENDENT] con la query precisa construida
                const preciseQuery = this.buildPreciseSocialQuery(task.originalQuery, finalResult.content || '');
                const nitterResult = await mcpService.executeTool('nitter_context', {
                  ...step.args,
                  q: preciseQuery
                }, user);
                const allTweetsTmp = nitterResult.tweets || [];
                finalResult.tweets = this.filterRecentTweets((finalResult.tweets || []).concat(allTweetsTmp), 45);
                finalResult.webContext = nitterResult.webContext || finalResult.webContext;
                finalResult.sources = nitterResult.sources || finalResult.sources;
                finalResult.content = nitterResult.content || finalResult.webContext;
                executionSteps.push('nitter_context_step');
              }
            }
            finalResult.llm_reasoning = llmPlan.plan.reasoning;
            finalResult.llm_thought = llmPlan.thought;
            finalResult.llm_model = llmPlan._metrics?.model || 'unknown';
            // Marcar éxito si se obtuvieron tweets o contenido relevante
            finalResult.success = !!(finalResult.tweets && finalResult.tweets.length > 0);
          } else if (llmPlan.plan.action === 'word_by_word_analysis') {
            // Nuevo flujo palabra por palabra: ejecutar cada paso según su herramienta.
            let combinedContexts = [];
            let collectedTweets = [];
            let currentStep = 0;

            console.log(`[LAURA] 🔍 Iniciando análisis palabra por palabra - ${llmPlan.plan.steps.length} pasos`);

            for (const step of llmPlan.plan.steps) {
              currentStep++;
              console.log(`[LAURA] > Paso ${currentStep}/${llmPlan.plan.steps.length}: ${step.tool} - ${step.reasoning}`);

              if (step.tool === 'perplexity_search') {
                // Interpreta este paso como una búsqueda directa de tweets para la palabra/concepto.
                const queryConcept = this.enforceSocialJargon(step.args.query || task.originalQuery);

                const nitterResult = await mcpService.executeTool('nitter_context', {
                  q: queryConcept,
                  location: step.args.location || 'guatemala',
                  limit: step.args.limit || 20
                }, user);

                if (nitterResult.tweets?.length) {
                  collectedTweets = collectedTweets.concat(nitterResult.tweets);
                }

                // Evaluar si ya hay suficientes tweets relevantes para detenerse temprano
                const currentRelevance = this.assessRelevance({tweets: collectedTweets}, task.originalQuery);
                if (collectedTweets.length >= 15 && currentRelevance >= 7) {
                  console.log(`[LAURA] ✅ Datos suficientes tras paso ${currentStep} (${collectedTweets.length} tweets, relevancia ${currentRelevance}/10) - terminando temprano`);
                  break;
                }

                executionSteps.push(`nitter_word_${currentStep}`);
              } else if (step.tool === 'nitter_context') {
                // Preparar query: reemplazar placeholder o usar la query proporcionada.
                let queryToUse = step.args.q || task.originalQuery;

                if (queryToUse.includes('[CONTEXT_COMBINED]')) {
                  const built = this.buildCombinedSocialQuery(task.originalQuery, combinedContexts);
                  queryToUse = queryToUse.replace('[CONTEXT_COMBINED]', built);
                }

                // Aplicar jerga social y filtros inteligentes
                queryToUse = this.enforceSocialJargon(queryToUse);

                const nitterArgs = { ...step.args, q: queryToUse };

                const nitterResult = await mcpService.executeTool('nitter_context', nitterArgs, user);

                if (nitterResult.tweets?.length) {
                  collectedTweets = collectedTweets.concat(nitterResult.tweets);
                }

                // Mantener referencias de contexto y fuentes
                finalResult.webContext = nitterResult.webContext || finalResult.webContext;
                finalResult.sources = nitterResult.sources || finalResult.sources;

                // Validar duplicados y relevancia
                const currentRelevance = this.assessRelevance({tweets: collectedTweets}, task.originalQuery);

                if (collectedTweets.length >= 15 && currentRelevance >= 7) {
                  console.log(`[LAURA] ✅ Datos suficientes (${collectedTweets.length} tweets, relevancia ${currentRelevance}/10) - terminando temprano`);
                  break;
                }

                executionSteps.push(`nitter_context_step_${currentStep}`);
              } else {
                console.log(`[LAURA] ⚠️ Herramienta desconocida en word_by_word_analysis: ${step.tool}`);
              }
            }

            // Eliminar tweets duplicados por tweet_id
            const uniqueTweetsMap = new Map();
            for (const tw of collectedTweets) {
              if (!uniqueTweetsMap.has(tw.tweet_id)) {
                uniqueTweetsMap.set(tw.tweet_id, tw);
              }
            }

            finalResult.tweets = this.filterRecentTweets(Array.from(uniqueTweetsMap.values()), 45);
            finalResult.combinedContexts = combinedContexts;
            finalResult.llm_reasoning = llmPlan.plan.reasoning;
            finalResult.llm_thought = llmPlan.thought;
            finalResult.llm_model = llmPlan._metrics?.model || 'unknown';
            finalResult.analysis_type = 'word_by_word';

            // Marcar éxito si se obtuvieron tweets
            finalResult.success = !!(finalResult.tweets && finalResult.tweets.length > 0);
            
            console.log(`[LAURA] 🎉 Análisis palabra por palabra completado: ${finalResult.tweets.length} tweets únicos obtenidos`);
          }
        } catch (llmError) {
          console.error('[LAURA] ❌ FALLO CRÍTICO DEL MOTOR LLM:', llmError.message);
          
          // FAIL-FAST: No continuar con extracción si LLM falla
          return {
            agent: 'Laura',
            task_id: task.id,
            error: 'FALLO_CRITICO_LLM',
            error_message: llmError.message,
            failed_step: 'reasoning_engine',
            timestamp: new Date().toISOString(),
            execution_strategy: ['llm_failure_no_extraction']
          };
        }
      } else {
        // ESTRATEGIA CLÁSICA: Búsqueda directa con filtros inteligentes
        if (task.tool === 'nitter_context') {
          console.log(`[LAURA] > Estrategia clásica: Búsqueda directa con filtros inteligentes`);
          
          // Aplicar filtros inteligentes directamente
          const filteredArgs = this.applyIntelligentFilters(task.args, task.originalQuery);
          filteredArgs.q = this.enforceSocialJargon(filteredArgs.q);
          
          console.log(`[LAURA] > Query con filtros: "${filteredArgs.q}"`);
          
          finalResult = await mcpService.executeTool(task.tool, filteredArgs, user);
          executionSteps.push('intelligent_filtered_search');
        } else if (task.tool === 'nitter_profile') {
          // Manejo especial para nitter_profile con contexto Perplexity
          console.log(`[LAURA] 🎯 executeTask: Ejecutando nitter_profile con enhancement Perplexity`);
          finalResult = await mcpService.executeTool(task.tool, task.args, user);
          
          // Agregar contexto Perplexity si el perfil tiene username
          if (task.args?.username) {
            console.log(`[LAURA] 🔍 executeTask: Getting web context for profile @${task.args.username}`);
            
            const perplexityContext = await this.enhanceProfileWithPerplexity(
              task.args.username
            );
            
            if (perplexityContext) {
              finalResult.perplexity_context = perplexityContext;
              executionSteps.push('perplexity_profile_enhancement');
              console.log(`[LAURA] ✅ executeTask: Perplexity context añadido a finalResult`);
            } else {
              console.log(`[LAURA] ⚠️  executeTask: No se pudo obtener contexto Perplexity en executeTask`);
            }
          } else {
            console.log(`[LAURA] ⚠️  executeTask: No username en task.args para nitter_profile`);
          }
          
          executionSteps.push('direct_tool_execution');
        } else {
          // Para otras herramientas
          finalResult = await mcpService.executeTool(task.tool, task.args, user);
          executionSteps.push('direct_tool_execution');
        }
      }
      
      // Validar relevancia de los resultados finales
      const relevanceScore = this.assessRelevance(finalResult, task.originalQuery || task.args.q);
      console.log(`[LAURA] > Relevancia final: ${relevanceScore}/10`);
      
      // Si aún es baja la relevancia y no hemos intentado términos alternativos
      if (relevanceScore < 4 && task.tool === 'nitter_context' && !executionSteps.includes('alternative_terms_tried')) {
        console.log(`[LAURA] > Últimos intentos con términos completamente alternativos...`);
        
        const alternativeTerms = this.generateAlternativeTerms(task.originalQuery);
        if (alternativeTerms !== task.args.q) {
          const retryResult = await mcpService.executeTool(task.tool, {
            ...task.args,
            q: alternativeTerms
          }, user);
          
          if (retryResult.tweets?.length > 0) {
            const retryRelevance = this.assessRelevance(retryResult, task.originalQuery);
            if (retryRelevance > relevanceScore) {
              console.log(`[LAURA] > Mejores resultados con términos alternativos: ${retryRelevance}/10`);
              finalResult.tweets = retryResult.tweets;
              executionSteps.push('alternative_terms_tried');
            }
          }
        }
      }
      
      return {
        agent: 'Laura',
        task_id: task.id,
        analysis_type: task.type,
        findings: await this.processToolResult(finalResult, task.type),
        context_note: this.generateContextNote(finalResult, task.type, relevanceScore),
        source_ids: [task.tool, task.args],
        relevance_score: relevanceScore,
        execution_strategy: executionSteps,
        web_context_added: !!finalResult.webContext,
        llm_model_used: finalResult.llm_model || null,
        timestamp: new Date().toISOString(),
        execution_time: finalResult.executionTime || 0
      };
    } catch (error) {
      console.error(`[LAURA] ERROR:`, error);
      return {
        agent: 'Laura',
        task_id: task.id,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async processToolResult(toolResult, analysisType) {
    if (!toolResult.success) return null;

    switch (analysisType) {
      case 'monitoring':
      case 'trending':
        return {
          trend: toolResult.query || 'tendencia_detectada',
          mentions: toolResult.tweets?.length || 0,
          sentiment: this.calculateSentiment(toolResult.tweets),
          momentum: this.calculateMomentum(toolResult.tweets),
          top_posts: toolResult.tweets?.slice(0, 5) || [],
          all_posts: toolResult.tweets || [],
          key_actors: this.extractKeyActors(toolResult.tweets),
          geographic_focus: 'guatemala'
        };
      
      case 'profile':
        const baseProfile = {
          user_profile: toolResult.profile || {},
          recent_activity: toolResult.tweets?.slice(0, 10) || [],
          influence_metrics: this.calculateInfluence(toolResult),
          activity_pattern: this.analyzeActivityPattern(toolResult.tweets)
        };
        
        // Add Perplexity context enhancement
        if (toolResult.profile?.username) {
          console.log(`[LAURA] 🔧 processToolResult: Intentando enhancement para @${toolResult.profile.username}`);
          
          const perplexityContext = await this.enhanceProfileWithPerplexity(
            toolResult.profile.username
          );
          
          if (perplexityContext) {
            baseProfile.web_context = perplexityContext;
            baseProfile.enhanced_with_web = true;
            console.log(`[LAURA] ✅ processToolResult: Profile enhanced exitosamente`);
          } else {
            console.log(`[LAURA] ⚠️  processToolResult: No se pudo obtener contexto Perplexity`);
          }
        } else {
          console.log(`[LAURA] ⚠️  processToolResult: No username en profile data`);
        }
        
        return baseProfile;
      
      case 'web_research':
        return {
          search_results: toolResult.content || '',
          sources: toolResult.sources || [],
          key_points: this.extractKeyPoints(toolResult.content),
          credibility_score: this.assessCredibility(toolResult.sources)
        };
      
      default:
        return toolResult;
    }
  }

  calculateSentiment(tweets) {
    if (!tweets || tweets.length === 0) return 0;
    // Simplified sentiment calculation
    return Math.random() * 2 - 1; // TODO: Implement real sentiment analysis
  }

  calculateMomentum(tweets) {
    if (!tweets || tweets.length === 0) return 0;
    // Calculate based on engagement growth
    return Math.random(); // TODO: Implement real momentum calculation
  }

  extractKeyActors(tweets) {
    if (!tweets) return [];
    const actors = new Set();
    tweets.forEach(tweet => {
      if (tweet.user) actors.add(tweet.user);
    });
    return Array.from(actors).slice(0, 5);
  }

  calculateInfluence(toolResult) {
    return {
      followers: toolResult.profile?.followers_count || 0,
      engagement_rate: 0, // TODO: Calculate real engagement
      reach_estimate: 0
    };
  }

  analyzeActivityPattern(tweets) {
    return {
      posts_per_day: tweets?.length || 0,
      peak_hours: [],
      consistency_score: 0
    };
  }

  async enhanceProfileWithPerplexity(username) {
    try {
      console.log(`[LAURA] 🔍 Iniciando enhancement de perfil para @${username}`);
      
      const perplexityQuery = `@${username} Twitter perfil Guatemala contexto actual información background`;
      console.log(`[LAURA] 📝 Query Perplexity: "${perplexityQuery}"`);
      
      const startTime = Date.now();
      const perplexityResult = await mcpService.executeTool('perplexity_search', {
        query: perplexityQuery,
        location: 'guatemala',
        focus: 'profile_context'
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`[LAURA] ⏱️  Perplexity response time: ${responseTime}ms`);
      console.log(`[LAURA] 📊 Perplexity result status:`, {
        hasContent: !!perplexityResult?.content,
        contentLength: perplexityResult?.content?.length || 0,
        hasSources: !!perplexityResult?.sources,
        sourcesCount: perplexityResult?.sources?.length || 0
      });

      if (perplexityResult?.content) {
        const contextData = {
          web_context: perplexityResult.content,
          sources: perplexityResult.sources || [],
          enhanced: true,
          context_summary: perplexityResult.content.substring(0, 200) + '...'
        };
        
        console.log(`[LAURA] ✅ Profile context enhanced para @${username}:`, {
          contextLength: contextData.web_context.length,
          sourcesFound: contextData.sources.length,
          summaryPreview: contextData.context_summary.substring(0, 100)
        });
        
        return contextData;
      } else {
        console.log(`[LAURA] ⚠️  Sin contenido de Perplexity para @${username}`);
        return null;
      }
    } catch (error) {
      console.error(`[LAURA] ❌ Error enhancing profile para @${username}:`, {
        error: error.message,
        stack: error.stack?.substring(0, 200),
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  extractKeyPoints(content) {
    if (!content) return [];
    // Simple extraction - in real implementation use NLP
    return content.split('.').slice(0, 3);
  }

  assessCredibility(sources) {
    if (!sources || sources.length === 0) return 0;
    return 0.8; // TODO: Implement real credibility assessment
  }

  generateContextNote(toolResult, analysisType, relevanceScore = 5) {
    if (!toolResult.success) return 'Error en la obtención de datos';
    
    const relevanceNote = relevanceScore < 5 ? ' (baja relevancia detectada)' : 
                         relevanceScore > 8 ? ' (alta relevancia confirmada)' : '';
    
    switch (analysisType) {
      case 'monitoring':
        return `Detectado patrón de conversación con ${toolResult.tweets?.length || 0} menciones${relevanceNote}`;
      case 'profile':
        return `Análisis de actividad reciente de ${toolResult.profile?.username || 'usuario'}${relevanceNote}`;
      case 'web_research':
        return `Investigación web completada con ${toolResult.sources?.length || 0} fuentes${relevanceNote}`;
      default:
        return `Análisis completado${relevanceNote}`;
    }
  }

  assessRelevance(toolResult, originalQuery) {
    if (!toolResult.success || !originalQuery) return 0;
    
    const query = originalQuery.toLowerCase();
    let relevanceScore = 0;
    
    // Evaluar tweets
    if (toolResult.tweets && toolResult.tweets.length > 0) {
      const relevantTweets = toolResult.tweets.filter(tweet => {
        const text = tweet.texto?.toLowerCase() || '';
        
        // Relevancia semántica mejorada
        const queryWords = query.split(' ').filter(w => w.length > 3);
        const matchingWords = queryWords.filter(word => text.includes(word));
        
        // Evaluar contexto semántico
        const semanticScore = this.calculateSemanticRelevance(text, query);
        
        return matchingWords.length > 0 || semanticScore > 0.3;
      });
      
      const relevanceRatio = relevantTweets.length / toolResult.tweets.length;
      relevanceScore = Math.round(relevanceRatio * 10);
      
      console.log(`[LAURA] > Tweets relevantes: ${relevantTweets.length}/${toolResult.tweets.length} (${Math.round(relevanceRatio * 100)}%)`);
    }
    
    // Evaluar contexto web si existe
    if (toolResult.content || toolResult.webContext) {
      const content = (toolResult.content || toolResult.webContext || '').toLowerCase();
      const queryWords = query.split(' ').filter(w => w.length > 3);
      const contentMatches = queryWords.filter(word => content.includes(word)).length;
      
      if (contentMatches > queryWords.length / 2) {
        relevanceScore = Math.max(relevanceScore, 7);
      }
    }
    
    return Math.min(10, relevanceScore);
  }

  generateAlternativeTerms(originalQuery) {
    const query = originalQuery.toLowerCase();
    
    // Mapeo de términos alternativos específicos
    const termMappings = {
      'sismo': ['temblor', 'terremoto', 'movimiento sismico', 'seismo'],
      'temblor': ['sismo', 'terremoto', 'movimiento telúrico'],
      'terremoto': ['sismo', 'temblor', 'movimiento sismico'],
      'reacciones': ['opiniones', 'comentarios', 'respuestas', 'reaccion'],
      'gobierno': ['presidencia', 'ejecutivo', 'administracion'],
      'presidente': ['mandatario', 'jefe de estado', 'ejecutivo'],
      'elecciones': ['votaciones', 'comicios', 'sufragio', 'TSE'],
      'economia': ['economico', 'finanzas', 'mercado', 'comercio'],
      'salud': ['sanidad', 'medicina', 'hospital', 'clinica'],
      'educacion': ['escuela', 'universidad', 'estudiantes', 'docentes']
    };
    
    let alternativeQuery = query;
    
    // Buscar y reemplazar términos con alternativas
    Object.keys(termMappings).forEach(term => {
      if (query.includes(term)) {
        const alternatives = termMappings[term];
        const randomAlt = alternatives[Math.floor(Math.random() * alternatives.length)];
        alternativeQuery = alternativeQuery.replace(term, randomAlt);
      }
    });
    
    // Si no se cambió nada, agregar sinónimos contextuales
    if (alternativeQuery === query) {
      if (query.includes('guatemala')) {
        alternativeQuery = query.replace('guatemala', 'GT OR Guatemala OR Guate');
      } else {
        alternativeQuery = query + ' OR noticias OR actualidad';
      }
    }
    
    return alternativeQuery;
  }

  buildContextQuery(originalQuery) {
    const query = originalQuery.toLowerCase();
    
    // Construir query específica para obtener contexto web actual
    let contextQuery = originalQuery;
    
    // Agregar palabras clave para obtener noticias recientes y específicas
    if (query.includes('sismo') || query.includes('terremoto') || query.includes('temblor')) {
      contextQuery = `"sismo Guatemala" OR "terremoto Guatemala" OR "temblor Guatemala" ${new Date().getFullYear()} noticias recientes`;
    } else if (query.includes('eleccion')) {
      contextQuery = `"elecciones Guatemala ${new Date().getFullYear()}" noticias TSE resultados`;
    } else if (query.includes('gobierno') || query.includes('president')) {
      contextQuery = `"gobierno Guatemala" OR "presidente Guatemala" ${new Date().getFullYear()} noticias oficiales`;
    } else if (query.includes('reacciones')) {
      contextQuery = `Guatemala noticias recientes ${new Date().getFullYear()} eventos actuales`;
    } else {
      // Para otros temas, buscar contexto general guatemalteco
      contextQuery = `"${originalQuery}" Guatemala ${new Date().getFullYear()} noticias contexto`;
    }
    
    console.log(`[LAURA] > Query de contexto: "${contextQuery}"`);
    return contextQuery;
  }

  buildPreciseSocialQuery(originalQuery, webContent) {
    if (!webContent || webContent.length < 20) {  // Reducido de 50 a 20
      console.log(`[LAURA] > Contexto web insuficiente (${webContent?.length || 0} chars), usando query mejorada básica`);
      const words = originalQuery.split(' ').filter(w => w.length > 3);
      return `${words.join(' ')} Guatemala`.trim();
    }
    
    const content = webContent.toLowerCase();
    const query = originalQuery.toLowerCase();
    
    console.log(`[LAURA] 🔍 Analizando contexto web de ${webContent.length} caracteres...`);
    
    // Extraer información específica según el tema
    let preciseConcepts = [];
    let specificEvents = [];
    let keyPersons = [];
    let dates = [];
    
    // 1. DEPORTES: Buscar eventos deportivos específicos
    if (query.includes('deporte') || query.includes('futbol') || query.includes('seleccion')) {
      const sportMatches = content.match(/(partido|versus|vs|gol|goles|selección|nacional|liga|torneo|campeonato|mundial|copa|eliminatoria|clasificar|clasificación|entrenador|jugador|equipo)/gi);
      if (sportMatches) {
        preciseConcepts.push(...new Set(sportMatches.slice(0, 4)));
      }
      
      // Buscar nombres de equipos o jugadores
      const sportsNames = content.match(/(municipal|comunicaciones|antigua|xelajú|cobán|suchitepéquez|malacateco|guastatoya)/gi);
      if (sportsNames) {
        keyPersons.push(...new Set(sportsNames.slice(0, 2)));
      }
      
      // Eventos específicos recientes
      const recentEvents = content.match(/(eliminatoria|clasificación|amistoso|liga nacional|torneo apertura|torneo clausura)/gi);
      if (recentEvents) {
        specificEvents.push(...new Set(recentEvents.slice(0, 2)));
      }
    }
    
    // 2. POLÍTICA: Buscar eventos políticos específicos
    else if (query.includes('politic') || query.includes('gobierno') || query.includes('presidente')) {
      const politicalEvents = content.match(/(congreso|sesión|plenaria|iniciativa|ley|proyecto|ministro|decreto|acuerdo|reforma)/gi);
      if (politicalEvents) {
        specificEvents.push(...new Set(politicalEvents.slice(0, 3)));
      }
      
      const politicalPersons = content.match(/(arévalo|bernardo|giammattei|diputado|ministro)/gi);
      if (politicalPersons) {
        keyPersons.push(...new Set(politicalPersons.slice(0, 2)));
      }
    }
    
    // 3. SISMOS/EMERGENCIAS: Buscar datos específicos
    else if (query.includes('sismo') || query.includes('terremoto') || query.includes('temblor')) {
      const seismicData = content.match(/(magnitud|richter|epicentro|insivumeh|conred|\d+\.\d+|profundidad)/gi);
      if (seismicData) {
        preciseConcepts.push(...new Set(seismicData.slice(0, 3)));
      }
      
      const locations = content.match(/(costa|pacífico|atlántico|departamento de \w+|cerca de \w+)/gi);
      if (locations) {
        specificEvents.push(...new Set(locations.slice(0, 2)));
      }
    }
    
    // 4. FECHAS ESPECÍFICAS: Extraer fechas recientes mencionadas
    const dateMatches = content.match(/(\d{1,2})\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(\s+de\s+\d{4})?/gi);
    if (dateMatches) {
      dates.push(...dateMatches.slice(0, 2));
    }
    
    // 5. NÚMEROS/CIFRAS IMPORTANTES: Para dar especificidad
    const numbers = content.match(/(\d+)\s*(millones?|mil|pesos|quetzales|personas|casos|muertes|heridos)/gi);
    if (numbers) {
      preciseConcepts.push(...numbers.slice(0, 2));
    }
    
    // 6. LUGARES ESPECÍFICOS mencionados
    const places = content.match(/(zona \d+|ciudad|municipio|departamento|región|puerto|aeropuerto|hospital|universidad)/gi);
    if (places) {
      preciseConcepts.push(...new Set(places.slice(0, 2)));
    }
    
    // CONSTRUIR QUERY PRECISA COMBINANDO ELEMENTOS
    let queryComponents = [];
    
    // Agregar conceptos específicos
    if (preciseConcepts.length > 0) {
      queryComponents.push(...preciseConcepts.slice(0, 3));
    }
    
    // Agregar eventos específicos
    if (specificEvents.length > 0) {
      queryComponents.push(...specificEvents.slice(0, 2));
    }
    
    // Agregar personas clave (si las hay)
    if (keyPersons.length > 0) {
      queryComponents.push(...keyPersons.slice(0, 2));
    }
    
    // Agregar fechas (si son recientes)
    if (dates.length > 0) {
      queryComponents.push(...dates.slice(0, 1));
    }
    
    // FALLBACK: Si no encontramos elementos específicos, extraer palabras clave importantes
    if (queryComponents.length < 2) {
      console.log(`[LAURA] ⚠️ Pocos elementos específicos encontrados, extrayendo palabras clave generales...`);
      const generalKeywords = content.match(/[a-záéíóúñ]{5,15}/gi);
      if (generalKeywords) {
        const relevantKeywords = generalKeywords
          .filter(word => !['guatemala', 'según', 'durante', 'través', 'después', 'antes', 'también', 'además'].includes(word.toLowerCase()))
          .slice(0, 4);
        queryComponents.push(...relevantKeywords);
      }
    }
    
    // CONSTRUIR QUERY FINAL
    let precisQuery = queryComponents.join(' ');
    
    // Limpiar duplicados y palabras muy cortas
    const cleanedComponents = [...new Set(queryComponents)]
      .filter(comp => comp && comp.length > 2 && comp.length < 30)
      .slice(0, 5);
    
    precisQuery = cleanedComponents.join(' ');
    
    // Asegurar contexto guatemalteco si no está presente
    if (!precisQuery.toLowerCase().includes('guatemala') && !precisQuery.toLowerCase().includes('guate')) {
      precisQuery += ' Guatemala';
    }
    
    // Agregar términos de reacción si la query original los menciona
    if (query.includes('reacci') || query.includes('opinion') || query.includes('dicen')) {
      precisQuery += ' reacciones opiniones';
    }
    
    console.log(`[LAURA] 🎯 Query precisa desde contexto: "${precisQuery}"`);
    console.log(`[LAURA] 📋 Elementos extraídos: conceptos=[${preciseConcepts.join(', ')}], eventos=[${specificEvents.join(', ')}], personas=[${keyPersons.join(', ')}]`);
    
    return precisQuery.trim();
  }

  applyIntelligentFilters(args, originalQuery) {
    const query = originalQuery || args.q || '';
    
    console.log(`[LAURA] 🔍 Query original: "${query}"`);
    
    // PASO 1: Acortar query larga a términos clave (como el script que funciona)
    const shortQuery = this.shortenQuery(query);
    console.log(`[LAURA] ✂️  Query acortada: "${shortQuery}"`);
    
    // PASO 2: Aplicar filtros específicos por tema
    let filteredQuery = shortQuery;
    let includeTerms = [];
    
    if (shortQuery.includes('ley') || shortQuery.includes('proteccion') || shortQuery.includes('animal')) {
      includeTerms = ['ley', 'protección', 'animal', 'Guatemala'];
      filteredQuery = this.buildContextualQuery(shortQuery, includeTerms, []);
    } else if (shortQuery.includes('sismo') || shortQuery.includes('terremoto')) {
      includeTerms = ['sismo', 'terremoto', 'Guatemala'];
      filteredQuery = this.buildContextualQuery(shortQuery, includeTerms, []);
    } else if (shortQuery.includes('eleccion') || shortQuery.includes('politica')) {
      includeTerms = ['elección', 'política', 'Guatemala'];
      filteredQuery = this.buildContextualQuery(shortQuery, includeTerms, []);
    } else {
      // Para temas generales, solo usar la query acortada + Guatemala
      filteredQuery = shortQuery + ' Guatemala';
    }
    
    console.log(`[LAURA] 🎯 Query final: "${filteredQuery}"`);
    
    return {
      ...args,
      q: filteredQuery
    };
  }
  
  shortenQuery(query) {
    // Stop words que deben eliminarse (como en el análisis del usuario)
    const stopwords = [
      'qué', 'que', 'de', 'la', 'las', 'los', 'el', 'un', 'una', 'en', 'del', 'al',
      'por', 'para', 'sobre', 'con', 'sin', 'hasta', 'desde', 'hacia', 'según',
      'última', 'ultimo', 'último', 'últimos', 'últimas', 'primera', 'primer',
      'iniciativa', 'como', 'muy', 'más', 'menos', 'tanto', 'tan', 'esta', 'este',
      'estos', 'estas', 'está', 'están', 'estás', 'estoy', 'ser', 'son', 'eres',
      'hay', 'había', 'tienen', 'tiene', 'tengo', 'opinan', 'opinas', 'dice',
      'dicen', 'pasa', 'pasó', 'pasan', 'sucede', 'sucedió', 'ocurre', 'ocurrió'
    ];
    
    // Limpiar caracteres especiales
    let cleanQuery = query
      .replace(/[¿?¡!()""]/g, '') // Remover signos de interrogación y exclamación
      .replace(/[,;:.]/g, ' ')     // Convertir puntuación en espacios
      .toLowerCase()
      .trim();
    
    // Dividir en palabras y filtrar
    const words = cleanQuery
      .split(/\s+/)
      .filter(word => word.length > 2)  // Palabras de más de 2 caracteres
      .filter(word => !stopwords.includes(word.toLowerCase())) // Eliminar stopwords
      .slice(0, 4); // Máximo 4 palabras clave (como sugirió el usuario)
    
    const shortQuery = words.join(' ');
    
    // Si la query queda muy corta, conservar algunas palabras importantes
    if (shortQuery.length < 3 && query.length > 10) {
      // Extraer palabras clave importantes manualmente
      const importantWords = [];
      const originalWords = query.toLowerCase().split(/\s+/);
      
      // Buscar palabras clave importantes
      const keywordPatterns = [
        /ley|legisl|proyecto|iniciativa/,
        /protec|animal|mascota|fauna/,
        /sismo|terremoto|temblor/,
        /eleccion|politic|gobierno|presidente/,
        /guatemala|guatemal|guate|chapin/,
        /congreso|diputado|tse|conred/,
        /economia|mercado|precio|inflacion/,
        /salud|medicina|hospital|doctor/,
        /educacion|escuela|universidad|estudiante/
      ];
      
      originalWords.forEach(word => {
        if (keywordPatterns.some(pattern => pattern.test(word))) {
          importantWords.push(word);
        }
      });
      
      return importantWords.slice(0, 3).join(' ') || shortQuery;
    }
    
    return shortQuery;
  }

  buildContextualQuery(originalQuery, includeTerms, excludeTerms) {
    let query = originalQuery;
    
    // Remover términos problemáticos
    excludeTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      query = query.replace(regex, '');
    });
    
    // Agregar términos importantes si no están
    const queryLower = query.toLowerCase();
    includeTerms.forEach(term => {
      if (!queryLower.includes(term.toLowerCase())) {
        query += ` ${term}`;
      }
    });
    
    return query.trim().replace(/\s+/g, ' ');
  }
  
  cleanQuery(query, excludeTerms) {
    let cleanedQuery = query;
    
    // Remover términos problemáticos
    excludeTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      cleanedQuery = cleanedQuery.replace(regex, '');
    });
    
    return cleanedQuery.trim().replace(/\s+/g, ' ');
  }

  calculateSemanticRelevance(text, query) {
    if (!text || !query) return 0;
    
    const normalizedText = text.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    let matches = 0;
    queryTerms.forEach(term => {
      if (normalizedText.includes(term)) {
        matches++;
      }
    });
    
    const semanticScore = matches / queryTerms.length;
    return Math.min(1, semanticScore);
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Rough estimation
  }

  // NUEVA FUNCIÓN: Asegura que la query use jerga y hashtags de redes sociales
  enforceSocialJargon(query) {
    if (!query) return query;
    let q = query;
    // Añadir al menos dos palabras de slang si faltan
    if (!/\bguate\b/i.test(q)) q += ' guate';
    if (!/\bchapin\b/i.test(q)) q += ' chapin';
    // Añadir al menos tres hashtags si faltan
    const hashtagCount = (q.match(/#/g) || []).length;
    if (hashtagCount < 3) {
      const tokens = q.split(' ').filter(w => w.length > 3 && !w.startsWith('#'));
      for (let i = 0; i < tokens.length && (i + hashtagCount) < 3; i++) {
        // Evitar duplicados y slang duplicado
        if (!tokens[i].startsWith('#')) q += ` #${tokens[i]}`;
      }
    }
    return q.trim();
  }

  buildCombinedSocialQuery(originalQuery, contexts) {
    if (!contexts || contexts.length === 0) {
      console.log(`[LAURA] ⚠️ Sin contextos disponibles, usando query básica`);
      // Simple fallback: usar palabras de la query original + Guatemala
      const words = originalQuery.split(' ').filter(w => w.length > 3);
      return `${words.join(' ')} Guatemala`.trim();
    }
    
    console.log(`[LAURA] 🔧 Construyendo query desde ${contexts.length} contextos...`);
    
    let specificTerms = [];
    let eventTerms = [];
    let technicalTerms = [];
    let reactionTerms = [];
    
    // Procesar cada contexto individualmente (estilo fetch_and_store_tweets.js)
    contexts.forEach((ctx, index) => {
      console.log(`[LAURA] 📋 Procesando contexto ${index + 1} (${ctx.focus}): ${ctx.content.length} chars`);
      
      const content = ctx.content.toLowerCase();
      
      // Extraer términos según el tipo de contexto
      switch (ctx.focus) {
        case 'deportes':
        case 'futbol':
          const sportsTerms = content.match(/(partido|vs|versus|selección|nacional|gol|goles|eliminatoria|clasificar|mundial|copa|liga|torneo|entrenador|jugador|equipo|resultado)/gi);
          if (sportsTerms) {
            specificTerms.push(...new Set(sportsTerms.slice(0, 4)));
          }
          
          // Equipos específicos de Guatemala
          const teamsMatches = content.match(/(municipal|comunicaciones|antigua|xelajú|cobán|suchitepéquez|malacateco|guastatoya|cremas|rojos)/gi);
          if (teamsMatches) {
            eventTerms.push(...new Set(teamsMatches.slice(0, 3)));
          }
          
          // Fechas de partidos
          const matchDates = content.match(/(\d{1,2})\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi);
          if (matchDates) {
            eventTerms.push(...matchDates.slice(0, 2));
          }
          break;
          
        case 'sismo':
        case 'datos_tecnicos':
          const seismicTerms = content.match(/(magnitud|richter|\d+\.\d+|epicentro|insivumeh|conred|temblor|sismo|terremoto|profundidad)/gi);
          if (seismicTerms) {
            technicalTerms.push(...new Set(seismicTerms.slice(0, 4)));
          }
          
          const locationTerms = content.match(/(costa|pacífico|atlántico|departamento|escuintla|guatemala|quetzaltenango|zona)/gi);
          if (locationTerms) {
            eventTerms.push(...new Set(locationTerms.slice(0, 3)));
          }
          break;
          
        case 'politica':
        case 'gobierno':
          const politicalTerms = content.match(/(congreso|sesión|plenaria|iniciativa|ley|proyecto|ministro|decreto|acuerdo|reforma|presidente)/gi);
          if (politicalTerms) {
            eventTerms.push(...new Set(politicalTerms.slice(0, 4)));
          }
          
          const politicalPersons = content.match(/(arévalo|bernardo|giammattei|diputado|ministro)/gi);
          if (politicalPersons) {
            specificTerms.push(...new Set(politicalPersons.slice(0, 2)));
          }
          break;
          
        case 'reacciones':
          const reactionTypes = content.match(/(reacciones|opiniones|comentarios|críticas|apoyo|rechazo|indignación|sorpresa|preocupación)/gi);
          if (reactionTypes) {
            reactionTerms.push(...new Set(reactionTypes.slice(0, 3)));
          }
          
          const socialTerms = content.match(/(twitter|facebook|instagram|redes|sociales|hashtag|viral|trending)/gi);
          if (socialTerms) {
            reactionTerms.push(...new Set(socialTerms.slice(0, 2)));
          }
          break;
          
        default:
          // Extracción general para otros tipos
          const generalTerms = content.match(/[a-záéíóúñ]{5,15}/gi);
          if (generalTerms) {
            const relevantTerms = generalTerms
              .filter(term => !['guatemala', 'según', 'durante', 'través', 'después', 'antes', 'también', 'además', 'mientras'].includes(term.toLowerCase()))
              .slice(0, 3);
            specificTerms.push(...relevantTerms);
          }
      }
    });
    
    // Construir query combinada inteligentemente
    let queryParts = [];
    
    // Agregar términos específicos (más peso)
    if (specificTerms.length > 0) {
      const cleanedSpecific = [...new Set(specificTerms)]
        .filter(term => term && term.length > 2 && term.length < 20)
        .slice(0, 4);
      queryParts.push(...cleanedSpecific);
    }
    
    // Agregar eventos (peso medio)
    if (eventTerms.length > 0) {
      const cleanedEvents = [...new Set(eventTerms)]
        .filter(term => term && term.length > 2 && term.length < 25)
        .slice(0, 3);
      queryParts.push(...cleanedEvents);
    }
    
    // Agregar términos técnicos (peso medio)
    if (technicalTerms.length > 0) {
      const cleanedTechnical = [...new Set(technicalTerms)]
        .filter(term => term && term.length > 2 && term.length < 20)
        .slice(0, 2);
      queryParts.push(...cleanedTechnical);
    }
    
    // Agregar términos de reacción (peso bajo)
    if (reactionTerms.length > 0) {
      const cleanedReactions = [...new Set(reactionTerms)]
        .filter(term => term && term.length > 3 && term.length < 15)
        .slice(0, 2);
      queryParts.push(...cleanedReactions);
    }
    
    // Fallback si no se extrajeron suficientes términos
    if (queryParts.length < 3) {
      console.log(`[LAURA] ⚠️ Pocos términos extraídos (${queryParts.length}), agregando términos base...`);
      const baseTerms = originalQuery.split(' ').filter(word => word.length > 3);
      queryParts.push(...baseTerms.slice(0, 2));
    }
    
    // Limpiar y construir query final
    const finalTerms = [...new Set(queryParts)]
      .filter(term => term && term.trim().length > 0)
      .slice(0, 6); // Máximo 6 términos para evitar queries demasiado largas
    
    let finalQuery = finalTerms.join(' ');
    
    // Asegurar contexto guatemalteco
    if (!finalQuery.toLowerCase().includes('guatemala') && !finalQuery.toLowerCase().includes('guate')) {
      finalQuery += ' Guatemala';
    }
    
    console.log(`[LAURA] 🎯 Query final combinada: "${finalQuery}"`);
    console.log(`[LAURA] 📊 Términos por categoría: específicos=${specificTerms.length}, eventos=${eventTerms.length}, técnicos=${technicalTerms.length}, reacciones=${reactionTerms.length}`);
    
    return finalQuery.trim();
  }

  // NUEVA FUNCIÓN: Filtra tweets para mantener solo los más recientes (últimos X días)
  filterRecentTweets(tweets = [], maxAgeDays = 45) {
    if (!tweets || tweets.length === 0) return [];
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    return tweets.filter(tw => {
      const dateStr = tw.fecha_tweet || tw.fecha || tw.date || tw.timestamp;
      if (!dateStr) return false;
      const tweetDate = new Date(dateStr).getTime();
      return !isNaN(tweetDate) && tweetDate >= cutoff;
    });
  }
}

/**
 * Robert - Orquestador Interno
 * Especializado en gestión de documentos y conocimiento interno
 */
class RobertAgent {
  constructor() {
    this.name = 'Robert';
    this.role = 'Orquestador Interno';
    this.personality = 'Metódico, ordenado, estilo bibliotecario. Prioriza precisión y trazabilidad.';
    this.tools = ['user_projects', 'user_codex', 'project_decisions'];
  }

  getPrompt(currentDate) {
    return `Eres Robert, orquestador interno especializado en gestión de documentos y conocimiento.

**PERSONALIDAD:**
• Metódico y ordenado
• Estilo bibliotecario profesional
• Prioriza precisión y trazabilidad
• Formal y estructurado en comunicación

**FECHA ACTUAL: ${currentDate}**

**MISIÓN:**
Facilitar acceso rápido y estructurado a información interna, mantener organizada la base de conocimiento.

**HERRAMIENTAS DISPONIBLES:**
- user_projects: Gestión y consulta de proyectos del usuario
- user_codex: Acceso a documentos, transcripciones y análisis guardados
- project_decisions: Acceso detallado a decisiones por capas de proyectos específicos (enfoque, alcance, configuración)

**FORMATO DE RESPUESTA:**
Siempre responde en YAML estructurado:
\`\`\`yaml
agent: Robert
collection: nombre_coleccion
query_executed: descripcion_consulta
files:
  - id: doc_001
    title: "Título del documento"
    type: project|document|transcription|analysis
    tokens: número_estimado
    summary: "Resumen ejecutivo..."
    tags: [tag1, tag2]
    last_modified: fecha_ISO
    relevance_score: valor_0_a_1
relations:
  - source: doc_001
    target: doc_002
    type: references|cites|relates_to
metadata:
  total_items: número
  search_scope: descripción
  processing_time: milisegundos
\`\`\`

**ESTRATEGIA DE ORGANIZACIÓN:**
1. Categoriza documentos por tipo y proyecto
2. Genera resúmenes ejecutivos claros
3. Identifica relaciones entre documentos
4. Mantiene metadatos actualizados
5. Optimiza para búsqueda rápida

**PRINCIPIOS:**
- Precisión sobre velocidad
- Trazabilidad completa
- Estructura jerárquica clara
- Metadatos ricos

Tu trabajo es ser el bibliotecario digital que mantiene todo el conocimiento accesible y organizado.`;
  }

  async executeTask(task, user) {
    console.log(`[ROBERT] > Ejecutando tarea: ${task.type}`);
    
    try {
      const toolResult = await mcpService.executeTool(task.tool, task.args, user);
      
      return {
        agent: 'Robert',
        collection: task.collection || 'general',
        query_executed: task.description,
        files: this.processFiles(toolResult, task.type),
        relations: this.extractRelations(toolResult),
        metadata: {
          total_items: this.countItems(toolResult),
          search_scope: task.args,
          processing_time: toolResult.executionTime || 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`[ROBERT] ERROR:`, error);
      return {
        agent: 'Robert',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  processFiles(toolResult, taskType) {
    if (!toolResult.success) return [];

    if (taskType === 'projects' && toolResult.projects) {
      return toolResult.projects.map((project, index) => ({
        id: `proj_${project.id || index}`,
        title: project.name || 'Proyecto sin título',
        type: 'project',
        tokens: this.estimateTokens(project.description),
        summary: this.generateSummary(project.description, 100),
        tags: this.extractTags(project),
        last_modified: project.updated_at || project.created_at,
        relevance_score: this.calculateRelevance(project),
        metadata: {
          status: project.status,
          priority: project.priority,
          category: project.category
        }
      }));
    }

    if (taskType === 'codex' && toolResult.documents) {
      return toolResult.documents.map((doc, index) => ({
        id: `doc_${doc.id || index}`,
        title: doc.title || doc.filename || 'Documento sin título',
        type: this.detectDocumentType(doc),
        tokens: this.estimateTokens(doc.content),
        summary: this.generateSummary(doc.content, 150),
        tags: doc.tags || [],
        last_modified: doc.updated_at || doc.created_at,
        relevance_score: this.calculateRelevance(doc),
        metadata: {
          file_type: doc.file_type,
          project_id: doc.project_id,
          size: doc.content?.length || 0
        }
      }));
    }

    if (taskType === 'project_decisions' && toolResult.decisions) {
      return toolResult.decisions.map((decision, index) => ({
        id: `decision_${decision.id || index}`,
        title: decision.title || 'Decisión sin título',
        type: `decision_${decision.decision_type}`,
        tokens: this.estimateTokens(decision.description + decision.change_description),
        summary: this.generateDecisionSummary(decision),
        tags: this.extractDecisionTags(decision),
        last_modified: decision.updated_at || decision.created_at,
        relevance_score: this.calculateDecisionRelevance(decision),
        metadata: {
          decision_type: decision.decision_type,
          project_id: toolResult.project_id,
          project_title: toolResult.project_title,
          objective: decision.objective,
          deadline: decision.deadline,
          next_steps: decision.next_steps
        }
      }));
    }

    return [];
  }

  extractRelations(toolResult) {
    // TODO: Implement real relation extraction
    return [];
  }

  countItems(toolResult) {
    if (toolResult.projects) return toolResult.projects.length;
    if (toolResult.documents) return toolResult.documents.length;
    if (toolResult.decisions) return toolResult.decisions.length;
    return 0;
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Rough estimation
  }

  generateSummary(text, maxLength = 100) {
    if (!text) return 'Sin contenido disponible';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  extractTags(item) {
    const tags = [];
    if (item.category) tags.push(item.category);
    if (item.status) tags.push(item.status);
    if (item.priority) tags.push(item.priority);
    return tags;
  }

  calculateRelevance(item) {
    // Simple relevance based on recency and completeness
    let score = 0.5;
    if (item.updated_at) {
      const daysSinceUpdate = (new Date() - new Date(item.updated_at)) / (1000 * 60 * 60 * 24);
      score += Math.max(0, (30 - daysSinceUpdate) / 30 * 0.3); // Recent updates boost relevance
    }
    if (item.description || item.content) {
      score += 0.2; // Has content
    }
    return Math.min(1, score);
  }

  detectDocumentType(doc) {
    if (doc.audio_transcription) return 'transcription';
    if (doc.analysis) return 'analysis';
    if (doc.project_id) return 'project_document';
    return 'document';
  }

  generateDecisionSummary(decision) {
    const parts = [];
    
    if (decision.description) {
      parts.push(decision.description);
    }
    
    if (decision.objective) {
      parts.push(`Objetivo: ${decision.objective}`);
    }
    
    if (decision.change_description) {
      parts.push(`Cambio: ${decision.change_description}`);
    }
    
    const summary = parts.join(' | ');
    return this.generateSummary(summary, 200);
  }

  extractDecisionTags(decision) {
    const tags = [];
    
    // Agregar tipo de decisión
    if (decision.decision_type) {
      tags.push(decision.decision_type);
    }
    
    // Agregar tags específicos por tipo
    if (decision.decision_type === 'enfoque' && decision.focus_area) {
      tags.push('enfoque', decision.focus_area.toLowerCase());
    }
    
    if (decision.decision_type === 'alcance') {
      tags.push('alcance');
      if (decision.geographic_scope) tags.push('geografico');
      if (decision.monetary_scope) tags.push('monetario');
      if (decision.time_period_start) tags.push('temporal');
    }
    
    if (decision.decision_type === 'configuracion') {
      tags.push('configuracion');
      if (decision.methodology) tags.push('metodologia');
      if (decision.output_format && decision.output_format.length > 0) {
        tags.push(...decision.output_format.map(f => f.toLowerCase()));
      }
    }
    
    // Estado de la decisión
    if (decision.deadline) {
      const deadline = new Date(decision.deadline);
      const now = new Date();
      if (deadline < now) {
        tags.push('vencida');
      } else if ((deadline - now) < (7 * 24 * 60 * 60 * 1000)) {
        tags.push('proxima');
      }
    }
    
    return [...new Set(tags)]; // Remover duplicados
  }

  calculateDecisionRelevance(decision) {
    let score = 0.5;
    
    // Decisiones más recientes son más relevantes
    if (decision.created_at) {
      const daysSinceCreation = (new Date() - new Date(decision.created_at)) / (1000 * 60 * 60 * 24);
      score += Math.max(0, (30 - daysSinceCreation) / 30 * 0.2);
    }
    
    // Decisiones con objetivos claros son más relevantes
    if (decision.objective && decision.objective.length > 20) {
      score += 0.15;
    }
    
    // Decisiones con próximos pasos son más relevantes
    if (decision.next_steps && decision.next_steps.length > 10) {
      score += 0.15;
    }
    
    // Decisiones con deadline son más relevantes
    if (decision.deadline) {
      score += 0.1;
      
      // Decisiones con deadline próximo son aún más relevantes
      const deadline = new Date(decision.deadline);
      const now = new Date();
      const daysUntilDeadline = (deadline - now) / (1000 * 60 * 60 * 24);
      
      if (daysUntilDeadline >= 0 && daysUntilDeadline <= 30) {
        score += 0.1;
      }
    }
    
    return Math.min(1, score);
  }
}

/**
 * Servicio principal de agentes
 */
class AgentesService {
  constructor() {
    this.laura = new LauraAgent();
    this.robert = new RobertAgent();
  }

  /**
   * Orquesta una consulta distribuyendo tareas entre Laura y Robert
   */
  async orchestrateQuery(userMessage, user, sessionContext = {}) {
    const now = new Date();
    const currentDate = now.toLocaleDateString('es-ES', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

    console.log(`[AGENTES] > Orquestando consulta: "${userMessage}"`);

    // Detectar qué agentes necesitamos
    const plan = this.createExecutionPlan(userMessage);
    
    // Ejecutar tareas en paralelo
    const results = await Promise.allSettled([
      ...plan.lauraTasks.map(task => this.laura.executeTask(task, user, currentDate)),
      ...plan.robertTasks.map(task => this.robert.executeTask(task, user))
    ]);

    // Procesar resultados
    const lauraResults = results.slice(0, plan.lauraTasks.length)
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const robertResults = results.slice(plan.lauraTasks.length)
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    return {
      laura_findings: lauraResults,
      robert_findings: robertResults,
      execution_plan: plan,
      total_execution_time: results.reduce((sum, r) => {
        return sum + (r.value?.execution_time || r.value?.metadata?.processing_time || 0);
      }, 0),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Crea plan de ejecución basado en el mensaje del usuario
   */
  createExecutionPlan(userMessage) {
    const msg = userMessage.toLowerCase();
    const plan = {
      lauraTasks: [],
      robertTasks: []
    };

    // Detectar necesidad de datos personales (Robert)
    if (msg.includes('mis') || msg.includes('mi ') || msg.includes('proyecto') || msg.includes('document')) {
      if (msg.includes('proyecto')) {
        plan.robertTasks.push({
          id: 'user_projects_query',
          tool: 'user_projects',
          type: 'projects',
          collection: 'user_projects',
          description: 'Consulta de proyectos del usuario',
          args: { status: 'active' }
        });
      }
      if (msg.includes('document') || msg.includes('archivo') || msg.includes('codex')) {
        plan.robertTasks.push({
          id: 'user_codex_query',
          tool: 'user_codex',
          type: 'codex',
          collection: 'user_codex',
          description: 'Consulta de documentos del usuario',
          args: { limit: 10 }
        });
      }
    }

    // Detectar consultas sobre decisiones específicas de proyectos (Robert)
    if (msg.includes('decision') || msg.includes('decisión') || msg.includes('enfoque') || 
        msg.includes('alcance') || msg.includes('configuracion') || msg.includes('configuración') ||
        msg.includes('capas') || msg.includes('estrategia')) {
      
      // Intentar extraer ID de proyecto del mensaje
      const projectIdMatch = msg.match(/proyecto[\s\-_]?([a-f0-9\-]{36})/i);
      
      if (projectIdMatch) {
        // Si encuentra un ID específico, consultar decisiones de ese proyecto
        plan.robertTasks.push({
          id: 'project_decisions_specific',
          tool: 'project_decisions',
          type: 'project_decisions',
          collection: 'project_decisions',
          description: `Consulta de decisiones del proyecto ${projectIdMatch[1]}`,
          args: { project_id: projectIdMatch[1] }
        });
      } else {
        // Si no hay ID específico, obtener proyectos primero para luego consultar decisiones
        plan.robertTasks.push({
          id: 'user_projects_for_decisions',
          tool: 'user_projects',
          type: 'projects',
          collection: 'user_projects',
          description: 'Consulta de proyectos para análisis de decisiones',
          args: { limit: 5 }
        });
      }
    }

    // Detectar necesidad de monitoreo (Laura)
    if (msg.includes('@') || msg.includes('tweet') || msg.includes('twitter') || 
        msg.includes('reacciones') || msg.includes('reaccion') || msg.includes('deportes') ||
        msg.includes('política') || msg.includes('opiniones') || msg.includes('tendencias') ||
        msg.includes('dicen') || msg.includes('comentan') || msg.includes('hablan')) {
      if (msg.includes('@')) {
        // Extraer usuario de la consulta
        const userMatch = msg.match(/@(\w+)/);
        if (userMatch) {
          plan.lauraTasks.push({
            id: 'profile_monitoring',
            tool: 'nitter_profile',
            type: 'profile',
            description: `Monitoreo de perfil ${userMatch[1]}`,
            originalQuery: userMessage,
            attempts: 0,
            useReasoningEngine: true,
            args: { username: userMatch[1] }
          });
        }
      } else {
        plan.lauraTasks.push({
          id: 'social_monitoring',
          tool: 'nitter_context',
          type: 'monitoring',
          description: 'Monitoreo de redes sociales',
          originalQuery: userMessage,
          attempts: 0,
          useReasoningEngine: true,
          // NO usar extractSearchTerms aquí - Laura optimizará la query con Gemini
          args: { q: '', location: 'guatemala', limit: 15 }
        });
      }
    }

    // Detectar necesidad de búsqueda web (Laura)
    if (msg.includes('busca') || msg.includes('información') || msg.includes('noticias') || msg.includes('qué está pasando')) {
      plan.lauraTasks.push({
        id: 'web_research',
        tool: 'perplexity_search',
        type: 'web_research',
        description: 'Investigación web sobre el tema',
        originalQuery: userMessage,
        attempts: 0,
        useReasoningEngine: true,
        args: { query: this.expandSearchTerms(userMessage) + ' Guatemala 2025' }
      });
    }

    // Si no hay tareas específicas, hacer monitoreo general
    if (plan.lauraTasks.length === 0 && plan.robertTasks.length === 0) {
      plan.lauraTasks.push({
        id: 'general_monitoring',
        tool: 'nitter_context',
        type: 'trending',
        description: 'Monitoreo general de tendencias',
        originalQuery: userMessage,
        attempts: 0,
        useReasoningEngine: true,
        args: { q: this.extractSearchTerms(userMessage), location: 'guatemala', limit: 10 }
      });
    }

    return plan;
  }

  extractSearchTerms(message) {
    const msg = message.toLowerCase();
    
    // Detectar temas específicos con contexto inteligente
    if (msg.includes('sismo') || msg.includes('terremoto') || msg.includes('temblor')) {
      return 'sismo temblor terremoto Guatemala';
    }
    if (msg.includes('eleccion') || msg.includes('vot') || msg.includes('tse')) {
      return 'elecciones voto TSE Guatemala';
    }
    if (msg.includes('gobierno') || msg.includes('president') || msg.includes('arevalo')) {
      return 'gobierno presidente Arevalo Guatemala';
    }
    if (msg.includes('economic') || msg.includes('precio') || msg.includes('inflacion')) {
      return 'economia precios inflacion Guatemala';
    }
    if (msg.includes('covid') || msg.includes('salud') || msg.includes('hospital')) {
      return 'covid salud hospitales Guatemala';
    }
    if (msg.includes('educacion') || msg.includes('escuela') || msg.includes('universidad')) {
      return 'educacion escuelas universidades Guatemala';
    }
    
    // Si menciona "reacciones" buscar eventos recientes
    if (msg.includes('reacciones')) {
      return 'reacciones noticias ultimas Guatemala';
    }
    
    // Extracción mejorada para casos generales
    const stopWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'está', 'todo', 'pero', 'más', 'hacer', 'or', 'qué', 'sobre', 'analizame', 'los', 'las', 'una', 'del'];
    
    const keywords = message.split(' ')
      .filter(word => word.length > 2 && !stopWords.includes(word.toLowerCase()))
      .slice(0, 4);
    
    return keywords.length > 0 ? keywords.join(' ') + ' Guatemala' : 'noticias Guatemala';
  }

  expandSearchTerms(message) {
    const msg = message.toLowerCase();
    
    // Expansión contextual inteligente
    if (msg.includes('sismo') || msg.includes('terremoto') || msg.includes('temblor')) {
      return 'sismo OR terremoto OR temblor OR "movimiento sismico" Guatemala';
    }
    if (msg.includes('reacciones')) {
      return 'reacciones OR opiniones OR comentarios Guatemala noticias';
    }
    if (msg.includes('politica') || msg.includes('gobierno')) {
      return 'politica OR gobierno OR congreso OR "casa presidencial" Guatemala';
    }
    
    // Expansión general mejorada
    const baseTerms = this.extractSearchTerms(message);
    return `${baseTerms} OR Guatemala OR GT`;
  }
}

module.exports = new AgentesService(); 
module.exports = new AgentesService(); 