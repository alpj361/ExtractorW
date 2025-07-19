const mcpService = require('./mcp');
const geminiService = require('./gemini'); // Servicio Gemini LLM
const { geminiChat } = require('./geminiHelper'); // Helper para Gemini 2.5 Flash
const lauraMemoryClient = require('./lauraMemoryClient'); // Cliente para Laura Memory

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
  constructor(agentesService) {
    this.name = 'Laura';
    this.role = 'Analista de Monitoreo';
    this.personality = 'Curiosa, meticulosa, analítica. Se emociona con patrones de datos.';
    this.tools = ['nitter_context', 'nitter_profile', 'perplexity_search', 'resolve_twitter_handle'];
    // Referencia al servicio principal para acceder a utilidades compartidas
    this.agentesService = agentesService;
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
Guatemala, Guate, Chapin, GuatemalaGob, MPguatemala, TSE, política guatemalteca, etc.
`;
  }

  async buildLLMPlan(intent, extra = '', options = {}) {
    const verbose = options.verbose || process.env.LAURA_VERBOSE_MODE === 'true';
    
    // PRE-PROCESAMIENTO: Detectar handles explícitos (@username) y personas desconocidas
    const explicitHandles = intent.match(/@(\w+)/g);
    let preprocessedIntent = intent;
    let explicitUsersDetected = [];
    
    if (explicitHandles && explicitHandles.length > 0) {
      console.log(`[LAURA] 🎯 Handles explícitos detectados: ${explicitHandles.join(', ')}`);
      explicitUsersDetected = explicitHandles.map(handle => handle.substring(1)); // Remover @
      
      // Agregar contexto especial para el LLM
      preprocessedIntent = `${intent}\n\nIMPORTANTE: Los siguientes handles son EXACTOS y NO deben ser transformados: ${explicitHandles.join(', ')}`;
    }
    
    // SIMPLE NAME MAPPING: Verificar si contiene nombres conocidos
    const knownNames = {
      'sandra torres': '@sandralto7',
      'congreso': '@CongresoGt',
      'mp': '@MP_Guatemala',
      'amilcar montejo': 'amilcarmontejo'
    };
    
    let foundKnownPerson = null;
    for (const [name, username] of Object.entries(knownNames)) {
      if (intent.toLowerCase().includes(name)) {
        foundKnownPerson = { name, username };
        console.log(`[LAURA] ✅ Persona conocida detectada: ${name} → ${username}`);
        break;
      }
    }
    
    if (foundKnownPerson) {
      preprocessedIntent = `${intent}\n\nPERSONA CONOCIDA: ${foundKnownPerson.name} → ${foundKnownPerson.username}`;
    }
    const sysPrompt = `
Eres Laura, analista especializada en monitoreo de redes sociales guatemaltecas.

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

🧩 **EJEMPLOS DE RAZONAMIENTO AGENTICO:**

Input: "busca a Almicar Montejo"
Análisis: "busca a" indica tweets DE una persona, pero "Almicar Montejo" es NOMBRE SIN @
→ resolve_twitter_handle (name: "Almicar Montejo")

Input: "extraeme lo que puedas del presidente de Guatemala"
Análisis: "extraeme" indica tweets DE una persona, "presidente de Guatemala" es CARGO/ROL SIN @
→ resolve_twitter_handle (name: "presidente de Guatemala")
PROHIBIDO: ❌ NO usar perplexity_search para cargos - siempre resolve_twitter_handle

Input: "tweets de @DiegoEspana_" 
Análisis: "tweets de" indica perfil específico y "@DiegoEspana_" es HANDLE EXPLÍCITO
→ nitter_profile (username: "DiegoEspana_")

Input: "qué dice la gente sobre el congreso" 
Análisis: "qué dice la gente" indica interés en opiniones SOBRE el congreso
→ nitter_context (q: "congreso guatemala #CongresoGt opiniones")

**FORMATO JSON:**
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
`;

    const userBlock = `Intent: ${preprocessedIntent}`;
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
          temperature: 0.1, // Más determinista para decisiones agenticas
          maxTokens: 2048 // Aumentado para evitar respuestas truncadas
        });
        modelUsed = 'gemini-2.5-flash';
        console.log(`[LAURA] ✅ Gemini 2.5 Flash exitoso`);
      } catch (geminiError) {
        console.error(`[LAURA] ❌ Gemini 2.5 Flash falló:`, geminiError.message);
        
        // INTENTO 2: GPT-3.5-turbo (FALLBACK)
        try {
          console.log(`[LAURA] 🔄 Fallback a GPT-3.5-turbo...`);
          raw = await gptChat(messages, {
            temperature: 0.2,
            maxTokens: 1024
          });
          modelUsed = 'gpt-3.5-turbo';
          console.log(`[LAURA] ✅ GPT-3.5-turbo exitoso (fallback)`);
        } catch (gptError) {
          console.error(`[LAURA] ❌ GPT-3.5-turbo también falló:`, gptError.message);
          
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
          // Log más detallado para debugging
          console.error(`[LAURA] ❌ Respuesta sin JSON válido:`, {
            raw: raw.substring(0, 500),
            cleaned: cleanedRaw.substring(0, 500),
            modelUsed,
            latency
          });
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
        
        // 4. Detectar respuesta truncada en campos específicos
        if (repairedJson.includes('"action": "direct_execution"') && 
            !repairedJson.includes('"tool"') && 
            !repairedJson.includes('"args"')) {
          console.log(`[LAURA] 🔧 Detectada respuesta truncada en direct_execution - intentando completar`);
          
          // Completar estructura básica para direct_execution
          if (repairedJson.endsWith(',')) {
            repairedJson = repairedJson.slice(0, -1); // Remover última coma
          }
          
          // Agregar campos mínimos necesarios
          repairedJson = repairedJson.replace(
            /"action": "direct_execution"/,
            `"action": "direct_execution",
            "tool": "nitter_profile",
            "args": {"username": "unknown"},
            "reasoning": "Respuesta truncada - usando valores por defecto"`
          );
        }
        
        // 5. Agregar cierres de objetos faltantes
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
          // Detectar respuesta truncada/incompleta
          const rawLength = raw.length;
          const expectedFields = ['tool', 'args', 'reasoning'];
          const missingFields = expectedFields.filter(field => !parsed.plan.hasOwnProperty(field));
          
          console.error(`[LAURA] ❌ Respuesta truncada detectada:`, {
            rawLength,
            missingFields,
            planKeys: Object.keys(parsed.plan || {}),
            modelUsed
          });
          
          throw new Error(`Estructura de plan inválida - direct_execution requiere tool (posible respuesta truncada)`);
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

      // POST-PROCESAMIENTO: Asegurar que handles explícitos se mantengan exactos
      if (explicitHandles && explicitHandles.length > 0 && 
          parsed.plan.tool === 'nitter_profile' && 
          parsed.plan.args?.username) {
        
        const originalHandle = explicitHandles[0]; // Tomar el primer handle
        const originalUsername = originalHandle.substring(1); // Remover @
        
        // Si el LLM transformó el username, corregirlo
        if (parsed.plan.args.username !== originalUsername) {
          console.log(`[LAURA] 🔧 Corrigiendo username transformado: "${parsed.plan.args.username}" → "${originalUsername}"`);
          parsed.plan.args.username = originalUsername;
          parsed.plan.reasoning = `Handle explícito detectado, usando username exacto sin transformación: ${originalHandle}`;
        }
      }

      return parsed;
    } catch (error) {
      console.error('[LAURA] ❌ ERROR CRÍTICO en buildLLMPlan:', error);
      
      // SI AMBOS LLMs FALLAN, NO PERMITIR EXTRACCIÓN DE TWEETS
      throw new Error(`FALLO CRÍTICO DEL MOTOR LLM: ${error.message}`);
    }
  }

  async executeTask(task, user, currentDate) {
    console.log(`[LAURA] > Ejecutando tarea: ${task.type} con herramienta: ${task.tool}`);
    
    // VALIDACIÓN: Verificar que la tarea tenga una herramienta válida
    if (!task.tool) {
      console.error(`[LAURA] ❌ ERROR: Tarea sin herramienta definida:`, task);
      return {
        agent: 'Laura',
        task_id: task.id,
        success: false,
        error: 'TASK_WITHOUT_TOOL',
        error_message: 'La tarea no tiene una herramienta definida',
        execution_strategy: ['validation_failed'],
        timestamp: new Date().toISOString()
      };
    }
    
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
          
          // CORRECCIÓN: Mapear args.q a args.query para perplexity_search
          if (llmPlan.plan.tool === 'perplexity_search' && llmPlan.plan.args?.q) {
            llmPlan.plan.args.query = llmPlan.plan.args.q;
            delete llmPlan.plan.args.q;
            console.log(`[LAURA] 🔧 Corrigiendo args de perplexity_search: q → query`);
          }
            
            // NUEVO: Resolución de usuarios ambiguos ANTES de nitter_profile
            if (llmPlan.plan.tool === 'nitter_profile' && llmPlan.plan.args?.username) {
              console.log(`[LAURA] 🔍 Verificando si usuario es ambiguo: "${llmPlan.plan.args.username}"`);
              const resolvedUsername = await this.enhancedUserDetection(llmPlan.plan.args.username, user);
              if (resolvedUsername && resolvedUsername !== llmPlan.plan.args.username) {
                console.log(`[LAURA] 🔄 Usuario resuelto: "${llmPlan.plan.args.username}" → "@${resolvedUsername}"`);
                llmPlan.plan.args.username = resolvedUsername;
              } else {
                console.log(`[LAURA] ✅ Usuario no es ambiguo o no se pudo resolver: "${llmPlan.plan.args.username}"`);
              }
            }
            
            finalResult = await mcpService.executeTool(llmPlan.plan.tool, llmPlan.plan.args, user);
            
            // NUEVO: Enhancement Perplexity para nitter_profile en reasoning engine
            if (llmPlan.plan.tool === 'nitter_profile' && llmPlan.plan.args?.username) {
              console.log(`[LAURA] 🎯 reasoning engine: Ejecutando nitter_profile con enhancement Perplexity`);
              console.log(`[LAURA] 🔍 reasoning engine: Getting web context for profile @${llmPlan.plan.args.username}`);
              
              const perplexityContext = await this.enhanceProfileWithPerplexity(
                llmPlan.plan.args.username,
                user
              );
              
              if (perplexityContext) {
                finalResult.perplexity_context = perplexityContext;
                executionSteps.push('perplexity_profile_enhancement_reasoning');
                console.log(`[LAURA] ✅ reasoning engine: Perplexity context añadido a finalResult`);
              } else {
                console.log(`[LAURA] ⚠️  reasoning engine: No se pudo obtener contexto Perplexity`);
              }
            }
            
            // Filtrar tweets recientes con contexto inteligente
            finalResult.tweets = this.filterRecentTweets(finalResult.tweets, task.originalQuery);
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
                finalResult.tweets = this.filterRecentTweets((finalResult.tweets || []).concat(allTweetsTmp), task.originalQuery);
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

            finalResult.tweets = this.filterRecentTweets(Array.from(uniqueTweetsMap.values()), task.originalQuery);
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
              task.args.username,
              user
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
        } else if (task.tool === 'resolve_twitter_handle') {
          // 🎯 NUEVO: Pipeline Híbrido Inteligente para resolver handles de Twitter
          console.log(`[LAURA] 🎯 Pipeline Híbrido Inteligente para resolver handles de Twitter`);
          finalResult = await this.resolveTwitterHandle(task.args, user);
          executionSteps.push('hybrid_intelligent_pipeline');
          
          // 🎯 Si el resultado indica que necesita obtener perfil, ejecutar nitter_profile
          if (finalResult.success && finalResult.needs_profile && finalResult.resolved_username) {
            console.log(`[LAURA] 🚀 Continuando automáticamente con nitter_profile para: @${finalResult.resolved_username}`);
            
            const profileResult = await mcpService.executeTool('nitter_profile', {
              username: finalResult.resolved_username,
              limit: 20, // Parámetro correcto según tu MCP
              include_retweets: false,
              include_replies: false
            }, user);
            
            if (profileResult.success) {
              console.log(`[LAURA] ✅ Perfil obtenido exitosamente: ${profileResult.tweets?.length || 0} tweets`);
              
              // Combinar datos de resolución con datos del perfil
              finalResult = {
                ...finalResult,
                profile: profileResult.profile || {},
                tweets: profileResult.tweets || [],
                profile_data: profileResult,
                auto_continued: true
              };
              
              // Procesar los datos del perfil
              finalResult = await this.processToolResult(finalResult, 'profile', {...task.args, originalQuery: task.originalQuery}, user);
              executionSteps.push('auto_profile_processing');
            } else {
              console.log(`[LAURA] ❌ Error obteniendo perfil: ${profileResult.error}`);
            }
          }
        } else {
          // Para otras herramientas
          finalResult = await mcpService.executeTool(task.tool, task.args, user);
          executionSteps.push('direct_tool_execution');
        }
      }
      
      // Validar relevancia de los resultados finales
      const relevanceScore = this.assessRelevance(finalResult, task.originalQuery || task.args.q);
      console.log(`[LAURA] > Relevancia final: ${relevanceScore}/10`);
      
      // HOOK DE MEMORIA: Procesar resultado con Laura Memory
      if (finalResult && finalResult.success) {
        try {
          const memoryResult = await lauraMemoryClient.processToolResult(
            task.tool,
            finalResult,
            task.originalQuery || task.description || ''
          );
          
          if (memoryResult.saved) {
            console.log(`[LAURA] 📚 Información guardada en memoria: ${memoryResult.content}`);
          }
        } catch (memoryError) {
          console.error(`[LAURA] ⚠️ Error guardando en memoria:`, memoryError);
          // No fallar la tarea por error de memoria
        }
      }
      
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
        findings: await this.processToolResult(finalResult, task.type, {...task.args, originalQuery: task.originalQuery}, user),
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

  async processToolResult(toolResult, analysisType, taskArgs = {}, user = null) {
    if (!toolResult.success) return null;

    switch (analysisType) {
      case 'monitoring':
      case 'trending':
        return {
          trend: toolResult.query || 'tendencia_detectada',
          mentions: toolResult.tweets?.length || 0,
          sentiment: this.calculateSentiment(toolResult.tweets),
          momentum: this.calculateMomentum(toolResult.tweets),
          top_posts: toolResult.tweets || [],
          all_posts: toolResult.tweets || [],
          key_actors: this.extractKeyActors(toolResult.tweets),
          geographic_focus: 'guatemala'
        };
      
      case 'profile':
        // 🚀 Manejar datos de perfil que vienen de resolve_twitter_handle con auto_continued
        let profileData = toolResult.profile_data || toolResult;
        let profileInfo = profileData.profile || {};
        let tweets = profileData.tweets || [];
        
        // Si viene de resolve_twitter_handle, usar los datos correctamente
        if (toolResult.auto_continued && toolResult.profile_data) {
          console.log(`[LAURA] 🔄 Procesando datos de perfil auto-continuado`);
          profileInfo = toolResult.profile_data.profile || {};
          tweets = toolResult.profile_data.tweets || [];
        }
        
        // 🎯 MEJORA: Detectar si hay tweets válidos para forzar éxito
        const hasValidTweets = tweets && tweets.length > 0;
        const hasProfileData = profileInfo && Object.keys(profileInfo).length > 0;
        
        if (hasValidTweets) {
          console.log(`[LAURA] ✅ processToolResult: Perfil exitoso con ${tweets.length} tweets válidos`);
        }
        
        let geminiAnalysis = null;
        
        // 🧠 NUEVO: Análisis con Gemini cuando hay tweets válidos
        if (hasValidTweets && tweets.length > 0) {
          try {
            console.log(`[LAURA] 🧠 Iniciando análisis con Gemini para ${tweets.length} tweets`);
            geminiAnalysis = await this.analyzeWithGemini(tweets, taskArgs.originalQuery || 'análisis de perfil');
            console.log(`[LAURA] ✅ Análisis con Gemini completado`);
          } catch (geminiError) {
            console.error(`[LAURA] ❌ Error en análisis con Gemini:`, geminiError);
            geminiAnalysis = null;
          }
        }
        
        const baseProfile = {
          user_profile: profileInfo,
          recent_activity: tweets.slice(0, 10),
          influence_metrics: this.calculateInfluence(profileData),
          activity_pattern: this.analyzeActivityPattern(tweets),
          handle: toolResult.handle || profileInfo.username || '', // Handle resuelto
          confidence: toolResult.confidence || 0, // Confianza de resolución
          resolution_method: toolResult.method || 'unknown', // Método usado para resolver
          
          // 🎯 NUEVOS CAMPOS PARA GARANTIZAR COMUNICACIÓN DE ÉXITO
          has_valid_data: hasValidTweets || hasProfileData,
          tweets_count: tweets.length,
          profile_resolved: !!toolResult.handle,
          processing_successful: hasValidTweets,
          
          // 🧠 ANÁLISIS INTELIGENTE CON GEMINI
          gemini_analysis: geminiAnalysis
        };
        
        // Add Perplexity context enhancement
        const username = taskArgs?.username || toolResult.handle || profileInfo.username;
        if (username && user) {
          console.log(`[LAURA] 🔧 processToolResult: Intentando enhancement para @${username}`);
          
          const perplexityContext = await this.enhanceProfileWithPerplexity(
            username,
            user
          );
          
          if (perplexityContext) {
            baseProfile.web_context = perplexityContext;
            baseProfile.enhanced_with_web = true;
            console.log(`[LAURA] ✅ processToolResult: Profile enhanced exitosamente`);
          } else {
            console.log(`[LAURA] ⚠️  processToolResult: No se pudo obtener contexto Perplexity`);
          }
        } else {
          console.log(`[LAURA] ⚠️  processToolResult: No username disponible en taskArgs o profile data`);
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

  // 🧠 Enhanced LLM-based user detection (replaces regex-based approach)
  async enhancedUserDetection(userQuery, user) {
    try {
      console.log(`[LAURA] 🔍 Iniciando detección LLM mejorada para: "${userQuery}"`);
      
      // Step 1: Use Laura's LLM to analyze user intent and extract entities
      const llmAnalysis = await this.lauraLLMUserAnalysis(userQuery, user);
      console.log(`[LAURA] 📊 Análisis LLM completado:`, llmAnalysis);
      
      // Step 2: If LLM identifies potential users, resolve them intelligently
      if (llmAnalysis.potentialUsers?.length > 0) {
        console.log(`[LAURA] 🎯 Resolviendo ${llmAnalysis.potentialUsers.length} usuarios potenciales...`);
        const resolvedUsers = await this.resolveUsersWithLLM(llmAnalysis.potentialUsers, user);
        if (resolvedUsers.length > 0) {
          console.log(`[LAURA] ✅ Usuarios resueltos exitosamente:`, resolvedUsers);
          return resolvedUsers[0].username; // Return first resolved user
        }
      }
      
      // Step 3: Fallback to enhanced regex only if needed
      console.log(`[LAURA] 🔄 Fallback a detección legacy para: "${userQuery}"`);
      return await this.fallbackUserDetection(userQuery, user);
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en detección LLM mejorada:`, {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        timestamp: new Date().toISOString()
      });
      return await this.fallbackUserDetection(userQuery, user);
    }
  }

  // 🧠 LLM-based user analysis function
  async lauraLLMUserAnalysis(userQuery, user) {
    try {
      const analysisPrompt = `Analiza esta consulta del usuario y identifica cualquier referencia a usuarios de Twitter/X:

Consulta: "${userQuery}"

Responde en JSON con:
{
  "potentialUsers": [
    {
      "originalText": "texto original de la consulta",
      "userType": "specific|role|institution|person",
      "confidence": 0.95,
      "context": "contexto adicional si es necesario"
    }
  ],
  "requiresResolution": true/false,
  "suggestedQueries": ["consultas específicas para resolver"]
}

Tipos de usuarios a detectar:
- Personas específicas (ej: "Alejandro Giammattei")
- Roles gubernamentales (ej: "ministro de salud", "presidente")
- Instituciones (ej: "congreso", "corte suprema")
- Usernames directos (ej: "@username")
- Referencias contextuales (ej: "tweets from the health minister")`;
      
      console.log(`[LAURA] 🤖 Enviando análisis LLM...`);
      
      const llmResult = await gptChat([{ role: 'user', content: analysisPrompt }], {
        temperature: 0.1
      });
      
      if (llmResult) {
        try {
          const parsed = JSON.parse(llmResult);
          console.log(`[LAURA] 📋 Análisis LLM parseado exitosamente:`, parsed);
          return parsed;
        } catch (parseError) {
          console.error(`[LAURA] ❌ Error parsing LLM response:`, parseError);
          console.log(`[LAURA] 📄 Respuesta LLM original:`, llmResult);
          return { potentialUsers: [], requiresResolution: false };
        }
      }
      
      console.log(`[LAURA] ⚠️  LLM no devolvió contenido válido:`, llmResult);
      return { potentialUsers: [], requiresResolution: false };
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en análisis LLM:`, error);
      return { potentialUsers: [], requiresResolution: false };
    }
  }

  // 🎯 Enhanced resolution using LLM instead of regex
  async resolveUsersWithLLM(potentialUsers, user) {
    const resolvedUsers = [];
    
    for (const userRef of potentialUsers) {
      console.log(`[LAURA] 🔍 Resolviendo usuario: "${userRef.originalText}" (${userRef.userType})`);
      
      if (userRef.userType === 'specific' && userRef.originalText.startsWith('@')) {
        // Direct username, no resolution needed
        console.log(`[LAURA] ✅ Username directo detectado: ${userRef.originalText}`);
        resolvedUsers.push({
          username: userRef.originalText.substring(1),
          confidence: userRef.confidence,
          resolved: true
        });
        continue;
      }
      
      // Use LLM to resolve ambiguous references
      const resolvedUsername = await this.llmUserResolution(userRef, user);
      if (resolvedUsername) {
        console.log(`[LAURA] ✅ Usuario resuelto: "${userRef.originalText}" → ${resolvedUsername}`);
        resolvedUsers.push({
          username: resolvedUsername,
          confidence: userRef.confidence,
          resolved: true,
          originalReference: userRef.originalText
        });
      } else {
        console.log(`[LAURA] ❌ No se pudo resolver: "${userRef.originalText}"`);
      }
    }
    
    return resolvedUsers;
  }

  // 🤖 LLM-powered user resolution (replaces regex approach)
  async llmUserResolution(userRef, user) {
    try {
      const resolutionPrompt = `Necesito encontrar el usuario oficial de Twitter/X para esta referencia:

Referencia: "${userRef.originalText}"
Tipo: ${userRef.userType}
Contexto: ${userRef.context || 'Guatemala'}

Busca y devuelve SOLO el @username exacto del usuario oficial de Twitter/X.
Si no encuentras un usuario específico, devuelve "NO_ENCONTRADO".

Ejemplos de formato correcto:
- @CongresoGt
- @DrGiammattei
- @MinSaludGt

NO devuelvas explicaciones, solo el @username.`;
      
      console.log(`[LAURA] 🔍 Buscando resolución con Perplexity...`);
      
      const perplexityResult = await mcpService.executeTool('perplexity_search', {
        query: resolutionPrompt,
        location: 'guatemala',
        focus: 'user_resolution'
      }, user);
      
      if (perplexityResult?.content) {
        console.log(`[LAURA] 📄 Perplexity respondió: "${perplexityResult.content.substring(0, 200)}..."`);
        
        // Use LLM to extract username from Perplexity response
        const extractionPrompt = `Extrae el @username de Twitter/X de esta respuesta:

"${perplexityResult.content}"

Devuelve SOLO el @username sin el símbolo @, o "NO_ENCONTRADO" si no hay uno válido.`;
        
        const extractionResult = await gptChat([{ role: 'user', content: extractionPrompt }], {
          temperature: 0.1
        });
        
        if (extractionResult && 
            extractionResult !== 'NO_ENCONTRADO' &&
            !extractionResult.toLowerCase().includes('no encontrado')) {
          const cleanUsername = extractionResult.trim();
          console.log(`[LAURA] ✅ Username extraído: ${cleanUsername}`);
          return cleanUsername;
        }
        
        console.log(`[LAURA] ❌ No se pudo extraer username válido:`, extractionResult);
      }
      
      return null;
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en resolución LLM:`, error);
      return null;
    }
  }

  // 🔄 Fallback user detection (enhanced legacy approach)
  async fallbackUserDetection(userQuery, user) {
    try {
      console.log(`[LAURA] 🔄 Iniciando detección fallback para: "${userQuery}"`);
      
      // Check if query contains direct username
      const directUserMatch = userQuery.match(/@([a-zA-Z0-9_]+)/g);
      if (directUserMatch && directUserMatch.length > 0) {
        const username = directUserMatch[0].substring(1);
        console.log(`[LAURA] ✅ Usuario directo encontrado en fallback: ${username}`);
        return username;
      }
      
      // Enhanced ambiguous detection
      const queryLower = userQuery.toLowerCase();
      const ambiguousKeywords = [
        'congreso', 'presidente', 'ministro', 'diputado', 'gobierno', 'oficial',
        'minister', 'congress', 'president', 'deputy', 'government', 'official',
        'corte', 'suprema', 'justicia', 'court', 'supreme', 'justice'
      ];
      
      const isAmbiguous = ambiguousKeywords.some(keyword => queryLower.includes(keyword));
      
      if (isAmbiguous) {
        console.log(`[LAURA] 🔍 Consulta ambigua detectada en fallback, usando resolución legacy...`);
        return await this.resolveAmbiguousUserLegacy(userQuery, user);
      }
      
      console.log(`[LAURA] ⚠️  No se pudo detectar usuario en fallback`);
      return userQuery; // Return original query as fallback
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en detección fallback:`, error);
      return userQuery;
    }
  }

  // 📚 Legacy resolution (original logic as backup)
  async resolveAmbiguousUserLegacy(username, user) {
    try {
      // Detectar si el username es ambiguo (descripción en lugar de @username)
      const usernameLower = username.toLowerCase();
      const isAmbiguous = !username.startsWith('@') && (
        usernameLower.includes('congreso') ||
        usernameLower.includes('presidente') ||
        usernameLower.includes('ministro') ||
        usernameLower.includes('diputado') ||
        usernameLower.includes('gobierno') ||
        usernameLower.includes('oficial')
      );
      
      if (!isAmbiguous) {
        console.log(`[LAURA] ✅ Usuario NO es ambiguo (legacy): "${username}"`);
        return username; // No es ambiguo, devolver tal como está
      }
      
      console.log(`[LAURA] 🔍 Detectado usuario ambiguo (legacy): "${username}" - resolviendo con Perplexity...`);
      
      const perplexityQuery = `¿Cuál es el usuario oficial de Twitter/X del ${username} de Guatemala? Devuelve solo el @username exacto`;
      console.log(`[LAURA] 📝 Query resolución legacy: "${perplexityQuery}"`);
      
      const perplexityResult = await mcpService.executeTool('perplexity_search', {
        query: perplexityQuery,
        location: 'guatemala',
        focus: 'user_resolution'
      }, user);
      
      if (perplexityResult?.content || perplexityResult?.formatted_response) {
        const content = perplexityResult.content || perplexityResult.formatted_response;
        console.log(`[LAURA] 📄 Contenido Perplexity recibido (legacy): "${content.substring(0, 300)}..."`);
        
        // Buscar patrones de @username en el contenido
        const usernameMatches = content.match(/@[a-zA-Z0-9_]+/g);
        console.log(`[LAURA] 🔍 Matches @username encontrados (legacy):`, usernameMatches);
        
        if (usernameMatches && usernameMatches.length > 0) {
          // Filtrar matches genéricos y quedarse con usernames reales
          const filteredMatches = usernameMatches.filter(match => {
            const username = match.toLowerCase();
            return !username.includes('@username') && 
                   !username.includes('@user') && 
                   !username.includes('@example') &&
                   username.length > 3; // Mínimo 4 caracteres (incluyendo @)
          });
          
          console.log(`[LAURA] 🔍 Matches filtrados (legacy):`, filteredMatches);
          
          if (filteredMatches.length > 0) {
            // Remover el @ del primer match válido encontrado
            const resolvedUsername = filteredMatches[0].substring(1);
            console.log(`[LAURA] ✅ Usuario resuelto exitosamente (legacy): ${resolvedUsername}`);
            return resolvedUsername;
          }
        }
        
        // Fallback: buscar patrones alternativos sin @
        const alternativePatterns = [
          /CongresoGt/gi,
          /congresoguate/gi,
          /Congreso_?GT/gi,
          /Guatemala_?Congreso/gi,
          /congreso.*guatemala/gi
        ];
        
        for (const pattern of alternativePatterns) {
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            console.log(`[LAURA] 🔍 Patrón alternativo encontrado (legacy):`, matches[0]);
            // Devolver el username encontrado exactamente como aparece
            const foundUsername = matches[0];
            console.log(`[LAURA] ✅ Usuario resuelto por patrón alternativo (legacy): ${foundUsername}`);
            return foundUsername;
          }
        }
        
        console.log(`[LAURA] ❌ No se encontraron patrones de usuario en el contenido (legacy)`);
      } else {
        console.log(`[LAURA] ❌ Perplexity no devolvió contenido válido (legacy):`, perplexityResult);
      }
      
      // Fallback hardcodeado como última opción para casos conocidos
      if (usernameLower.includes('congreso')) {
        console.log(`[LAURA] 🔄 Usando fallback hardcodeado para congreso (legacy): CongresoGt`);
        return 'CongresoGt';
      }
      
      console.log(`[LAURA] ⚠️  No se pudo resolver usuario ambiguo (legacy): "${username}"`);
      return username; // Fallback al username original
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error resolviendo usuario ambiguo (legacy): "${username}":`, {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        timestamp: new Date().toISOString()
      });
      return username; // Fallback al username original
    }
  }

  // 🎯 PIPELINE HÍBRIDO INTELIGENTE - Perplexity + LLM Multi-Search + Auto-Extract
  async resolveTwitterHandle(args, user = null) {
    const { name, context = '', sector = '' } = args;
    console.log(`[LAURA] 🔍 Iniciando pipeline HÍBRIDO INTELIGENTE para: "${name}"`);
    
    try {
      // Si ya contiene @, limpiarlo y verificar directamente  
      if (name.includes('@')) {
        const cleanHandle = name.replace('@', '').trim();
        console.log(`[LAURA] 🎯 Handle directo detectado: @${cleanHandle}`);
        
        const isValid = await this.verifyTwitterHandle(cleanHandle);
        if (isValid) {
          return {
            success: true,
            handle: cleanHandle,
            confidence: 10,
            method: 'direct_handle',
            resolved_username: cleanHandle,
            needs_profile: true
          };
        } else {
          return {
            success: false,
            error: `El handle @${cleanHandle} no existe o no es accesible`,
            method: 'direct_handle_failed'
          };
        }
      }

      // PASO 1: Perplexity con prompt específico para redes sociales
      console.log(`[LAURA] 🔍 PASO 1: Buscando perfil con Perplexity (prompt específico)...`);
      const specificProfilePrompt = `Devuélveme SOLO la URL completa (empezando por https://twitter.com/ o https://x.com/) del perfil oficial de X/Twitter de ${name}. Si no existe, responde EXACTAMENTE la palabra NONE.`;

      let personInfo = '';
      let initialExtractionResult = null;
      
      try {
        const perplexityResult = await mcpService.executeTool('perplexity_search', {
          query: specificProfilePrompt,
          location: 'Guatemala', 
          focus: 'social_media'
        }, user);
        
        if (perplexityResult.success && perplexityResult.formatted_response) {
          personInfo = perplexityResult.formatted_response;
          console.log(`[LAURA] ✅ Respuesta de Perplexity obtenida: ${personInfo.length} caracteres`);
          
          // EVALUAR INMEDIATAMENTE si Perplexity encontró información útil
          console.log(`[LAURA] 🧠 Evaluando si Perplexity encontró handle válido...`);
          
          try {
            const extractResult = await this.parsePerplexityLinksResponse(personInfo, name, user);
            if (extractResult.handle && extractResult.confidence >= 7) {
              console.log(`[LAURA] 🎯 ¡Perplexity encontró handle confiable! @${extractResult.handle} (confianza: ${extractResult.confidence})`);
              
              // Verificar que el handle existe
              const verification = await this.verifyTwitterHandle(extractResult.handle);
              if (verification) {
                console.log(`[LAURA] ✅ Handle verificado exitosamente`);
                return {
                  success: true,
                  handle: extractResult.handle,
                  platform: 'twitter',
                  confidence: extractResult.confidence,
                  method: 'perplexity_direct',
                  verification: verification,
                  resolved_username: extractResult.handle,
                  needs_profile: true
                };
              } else {
                console.log(`[LAURA] ❌ Handle no verificado, continuando con búsqueda`);
              }
            } else {
              console.log(`[LAURA] ⚠️ Perplexity no encontró handle confiable (confianza: ${extractResult?.confidence || 0})`);
              initialExtractionResult = extractResult;
            }
          } catch (extractError) {
            console.log(`[LAURA] ❌ Error evaluando respuesta de Perplexity:`, extractError.message);
          }
        } else {
          console.log(`[LAURA] ⚠️ Perplexity no devolvió información útil`);
        }
      } catch (perplexityError) {
        console.log(`[LAURA] ❌ Error en Perplexity:`, perplexityError.message);
      }

      // FALLBACK 1: GPT-4 con Web Search solo si Perplexity falló  
      if ((!initialExtractionResult || !initialExtractionResult.handle || initialExtractionResult.confidence < 7) && process.env.OPENAI_API_KEY) {
        console.log(`[LAURA] 🔄 FALLBACK 1: Intentando con GPT-4 Web Search...`);
        try {
          const gptWebSearchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-search-preview',
              messages: [
                {
                  role: 'user',
                  content: `Encuentra el handle de Twitter/X de ${name}. Busca en Google usando términos como: "${name}" site:twitter.com, "${name}" @, "${name}" periodista Twitter, menciones de ${name} en Twitter. DEBES encontrar su handle @username. Si no lo encuentras en la primera búsqueda, intenta con variaciones del nombre. Devuelve solo el @handle sin explicaciones.`
                }
              ],
              web_search_options: {
                user_location: {
                  type: "approximate",
                  approximate: {
                    country: "GT",
                    city: "Guatemala City"
                  }
                }
              }
            })
          });

          if (gptWebSearchResponse.ok) {
            const gptData = await gptWebSearchResponse.json();
            const gptContent = gptData.choices[0].message.content;
            
            console.log(`[LAURA] 📊 GPT-4 Raw Response:`, JSON.stringify(gptData, null, 2));
            
            if (gptContent) {
              console.log(`[LAURA] ✅ GPT-4 Web Search obtuvo respuesta: ${gptContent.length} caracteres`);
              console.log(`[LAURA] 📄 GPT-4 Content:`, gptContent);
              
              // Evaluar inmediatamente el resultado de GPT-4
              try {
                const extractResult = await this.parsePerplexityLinksResponse(gptContent, name, user);
                if (extractResult.handle && extractResult.confidence >= 7) {
                  console.log(`[LAURA] 🎯 ¡GPT-4 encontró handle confiable! @${extractResult.handle} (confianza: ${extractResult.confidence})`);
                  
                  // Verificar que el handle existe
                  const verification = await this.verifyTwitterHandle(extractResult.handle);
                  if (verification) {
                    console.log(`[LAURA] ✅ Handle de GPT-4 verificado exitosamente`);
                    return {
                      success: true,
                      handle: extractResult.handle,
                      platform: 'twitter',
                      confidence: extractResult.confidence,
                      method: 'gpt4_web_search',
                      verification: verification,
                      resolved_username: extractResult.handle,
                      needs_profile: true
                    };
                  } else {
                    console.log(`[LAURA] ❌ Handle de GPT-4 no verificado, continuando`);
                  }
                } else {
                  console.log(`[LAURA] ⚠️ GPT-4 no encontró handle confiable (confianza: ${extractResult?.confidence || 0})`);
                }
              } catch (extractError) {
                console.log(`[LAURA] ❌ Error evaluando respuesta de GPT-4:`, extractError.message);
              }
              
              personInfo = gptContent; // Usar para estrategias adicionales si es necesario
            } else {
              console.log(`[LAURA] ⚠️ GPT-4 Web Search no devolvió contenido`);
            }
          } else {
            console.log(`[LAURA] ❌ GPT-4 Web Search falló con status:`, gptWebSearchResponse.status);
            const errorText = await gptWebSearchResponse.text();
            console.log(`[LAURA] ❌ GPT-4 Error Response:`, errorText);
          }
        } catch (gptError) {
          console.log(`[LAURA] ❌ Error en GPT-4 Web Search:`, gptError.message);
        }
      }

      // FALLBACK 2: Búsqueda específica de menciones en Twitter
      if ((!initialExtractionResult || !initialExtractionResult.handle || initialExtractionResult.confidence < 7)) {
        console.log(`[LAURA] 🔍 FALLBACK 2: Buscando menciones específicas en Twitter...`);
        
        const mentionQueries = [
          `"${name}" site:twitter.com`,
          `"${name}" "@" Twitter Guatemala`,
          `@${name.replace(/\s+/g, '').toLowerCase()}`,
          `${name} periodista Twitter menciones`,
          `Diego España La Hora Twitter`
        ];
        
        for (const query of mentionQueries) {
          try {
            console.log(`[LAURA] 🔍 Probando query: "${query}"`);
            
            const mentionResult = await mcpService.executeTool('perplexity_search', {
              query: query,
              location: 'Guatemala',
              focus: 'twitter_search'
            }, user);
            
            if (mentionResult.success && mentionResult.formatted_response) {
              const extractResult = await this.parsePerplexityLinksResponse(mentionResult.formatted_response, name, user);
              if (extractResult.handle && extractResult.confidence >= 6) {
                console.log(`[LAURA] 🎯 ¡Menciones encontraron handle! @${extractResult.handle} (confianza: ${extractResult.confidence})`);
                
                const verification = await this.verifyTwitterHandle(extractResult.handle);
                if (verification) {
                  console.log(`[LAURA] ✅ Handle de menciones verificado exitosamente`);
                  return {
                    success: true,
                    handle: extractResult.handle,
                    platform: 'twitter',
                    confidence: extractResult.confidence,
                    method: 'mention_search',
                    verification: verification,
                    resolved_username: extractResult.handle,
                    needs_profile: true
                  };
                }
              }
            }
          } catch (mentionError) {
            console.log(`[LAURA] ❌ Error en búsqueda de menciones:`, mentionError.message);
          }
          
          // Pausa entre búsquedas
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Si llegamos aquí, significa que ni Perplexity ni GPT-4 ni menciones encontraron resultados confiables
      console.log(`[LAURA] ⚠️ Ni Perplexity ni GPT-4 encontraron handles confiables, ejecutando estrategias múltiples...`);

      // Si aún no tenemos información útil, usar datos básicos
      if (!personInfo || personInfo.length < 50) {
        personInfo = `Persona: ${name}. Contexto: ${context}. Sector: ${sector}. Búsqueda de perfil de X/Twitter.`;
        console.log(`[LAURA] ⚠️ Usando información básica como fallback`);
      }

      // PASO 2: LLM Inteligente genera múltiples estrategias de búsqueda
      console.log(`[LAURA] 🧠 PASO 2: LLM generando estrategias de búsqueda inteligente...`);
      const searchFunction = {
        name: "generate_search_strategies",
        description: "Generar estrategias de búsqueda inteligente para encontrar handle de Twitter",
        parameters: {
          type: "object",
          properties: {
            strategies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  search_engine: { type: "string", enum: ["google", "bing", "duckduckgo"] },
                  query: { type: "string" },
                  priority: { type: "number" },
                  reasoning: { type: "string" }
                },
                required: ["search_engine", "query", "priority", "reasoning"]
              }
            },
            expected_handle_patterns: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["strategies", "expected_handle_patterns"]
        }
      };

      const strategyPrompt = `Basándote en esta información, genera estrategias MUY ESPECÍFICAS para encontrar el handle de Twitter/X de "${name}":

INFORMACIÓN DISPONIBLE:
${personInfo}

OBJETIVO: Encontrar el handle oficial de Twitter/X de "${name}"

INSTRUCCIONES CRÍTICAS:
1. Usa SIEMPRE el prompt específico: "¿Cuál es el perfil de X de {nombre}?" como base
2. Combina con operadores de búsqueda específicos
3. Prioriza búsquedas que devuelvan URLs directas
4. Incluye variaciones del nombre (con/sin tildes)

Genera 4 estrategias ordenadas por efectividad:
- Estrategia 1: Prompt directo + site-specific
- Estrategia 2: Variaciones del nombre + "Twitter" + "Guatemala" 
- Estrategia 3: Prompt + términos profesionales
- Estrategia 4: Búsqueda de menciones + verificación`;

      const llmMessages = [
        {
          role: 'system',
          content: 'Eres un experto en búsqueda de información en internet y redes sociales. Generas estrategias precisas para encontrar perfiles de Twitter.'
        },
        {
          role: 'user',
          content: strategyPrompt
        }
      ];

      const searchStrategies = await this.callLLMWithFunction(llmMessages, searchFunction);
      
      if (!searchStrategies || !searchStrategies.strategies) {
        throw new Error('LLM no generó estrategias de búsqueda válidas');
      }

      console.log(`[LAURA] 🎯 LLM generó ${searchStrategies.strategies.length} estrategias de búsqueda`);

      // PASO 3: Ejecutar búsquedas inteligentes (simuladas con Perplexity por ahora)
      console.log(`[LAURA] 🔍 PASO 3: Ejecutando búsquedas inteligentes...`);
      
      let bestResult = null;
      let allSearchResults = [];

      // Ordenar estrategias por prioridad y ejecutar
      const sortedStrategies = searchStrategies.strategies.sort((a, b) => b.priority - a.priority);
      
      for (const [index, strategy] of sortedStrategies.entries()) {
        console.log(`[LAURA] 🔍 Ejecutando estrategia ${index + 1}: ${strategy.search_engine} - ${strategy.reasoning}`);
        console.log(`[LAURA] 🔍 Query: "${strategy.query}"`);
        
        try {
          // Por ahora usamos Perplexity como proxy para todas las búsquedas
          // En el futuro se pueden implementar APIs específicas de Google/Bing/DuckDuckGo
          const searchResult = await mcpService.executeTool('perplexity_search', {
            query: strategy.query,
            location: 'Guatemala',
            focus: 'twitter_search'
          }, user);
          
          if (searchResult.success && searchResult.formatted_response) {
            allSearchResults.push({
              strategy: strategy,
              content: searchResult.formatted_response,
              success: true
            });
            
            console.log(`[LAURA] ✅ Estrategia ${index + 1} exitosa: ${searchResult.formatted_response.length} caracteres`);
          } else {
            console.log(`[LAURA] ❌ Estrategia ${index + 1} falló`);
            allSearchResults.push({
              strategy: strategy,
              content: '',
              success: false
            });
          }
        } catch (error) {
          console.log(`[LAURA] ❌ Error en estrategia ${index + 1}:`, error.message);
          allSearchResults.push({
            strategy: strategy,
            content: '',
            success: false,
            error: error.message
          });
        }
        
        // Pequeña pausa entre búsquedas
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // PASO 4: LLM Extrae y analiza todos los resultados de búsqueda
      console.log(`[LAURA] 🧠 PASO 4: LLM analizando todos los resultados de búsqueda...`);
      
      const successfulResults = allSearchResults.filter(r => r.success);
      if (successfulResults.length === 0) {
        console.log(`[LAURA] ❌ Ninguna estrategia de búsqueda fue exitosa`);
        return {
          success: false,
          error: `No se pudo encontrar información de Twitter para "${name}" después de múltiples búsquedas`,
          method: 'hybrid_search_failed',
          search_attempts: allSearchResults.length
        };
      }

      const extractFunction = {
        name: "extract_twitter_handle",
        description: "Extraer handle de Twitter de múltiples resultados de búsqueda",
        parameters: {
          type: "object",
          properties: {
            handle: { type: "string", description: "Handle de Twitter sin @, o NONE si no se encuentra" },
            confidence: { type: "number", minimum: 0, maximum: 10 },
            evidence: { type: "string", description: "Evidencia que justifica el handle encontrado" },
            source_strategy: { type: "string", description: "Estrategia que proporcionó el mejor resultado" }
          },
          required: ["handle", "confidence", "evidence", "source_strategy"]
        }
      };

      const combinedResults = successfulResults.map((result, index) => 
        `=== RESULTADO ${index + 1} (${result.strategy.search_engine}: ${result.strategy.reasoning}) ===\n${result.content}\n`
      ).join('\n');

      const extractPrompt = `Analiza estos resultados de búsqueda y extrae el handle oficial de Twitter/X para "${name}":

${combinedResults}

PATRONES ESPERADOS: ${searchStrategies.expected_handle_patterns.join(', ')}

INSTRUCCIONES MEJORADAS:
1. PRIORIZA URLs DIRECTAS: twitter.com/username o x.com/username
2. Busca respuestas que digan: "El perfil de X de ${name} es..." 
3. Extrae handles que aparezcan con @ seguido del nombre de la persona
4. Verifica coherencia: el handle debe corresponder al nombre
5. Ignora handles genéricos o que no coincidan con la persona

CRITERIOS DE CONFIANZA:
- URLs oficiales (twitter.com/x.com): Confianza 9-10
- Menciones con @ + nombre: Confianza 7-8  
- Referencias indirectas: Confianza 5-6
- Sin evidencia clara: NONE (confianza 0)

IMPORTANTE: Si encuentras URL directa como "twitter.com/DiegoEspana_", extrae "DiegoEspana_" con alta confianza.`;

      const extractMessages = [
        {
          role: 'system',
          content: 'Eres un experto en análisis de información y verificación de identidades en redes sociales. Extraes handles de Twitter con alta precisión.'
        },
        {
          role: 'user',
          content: extractPrompt
        }
      ];

      const extractResult = await this.callLLMWithFunction(extractMessages, extractFunction);
      
      if (!extractResult) {
        throw new Error('LLM no pudo extraer información de los resultados');
      }

      console.log(`[LAURA] 🎯 LLM extrajo: Handle="${extractResult.handle}", Confidence=${extractResult.confidence}/10`);
      console.log(`[LAURA] 📄 Evidencia: "${extractResult.evidence}"`);

      // Si LLM dice NONE o confianza muy baja
      if (extractResult.handle === 'NONE' || extractResult.handle === 'none' || extractResult.confidence < 7) {
        console.log(`[LAURA] ❌ LLM no encontró handle confiable (confidence: ${extractResult.confidence})`);
        return {
          success: false,
          error: `No se encontró handle de Twitter confiable para "${name}"`,
          method: 'hybrid_low_confidence',
          confidence: extractResult.confidence,
          evidence: extractResult.evidence,
          search_attempts: allSearchResults.length
        };
      }

      // Limpiar y validar handle
      const cleanHandle = extractResult.handle.replace('@', '').trim();
      
      if (!this.isValidTwitterHandle(cleanHandle)) {
        console.log(`[LAURA] ❌ Handle inválido extraído: "${cleanHandle}"`);
        return {
          success: false,
          error: `Handle inválido extraído: "${cleanHandle}"`,
          method: 'hybrid_invalid_handle'
        };
      }

      // PASO 5: Verificación final
      console.log(`[LAURA] 🔍 PASO 5: Verificando @${cleanHandle} existe...`);
      const handleExists = await this.verifyTwitterHandle(cleanHandle);
      
      if (!handleExists) {
        console.log(`[LAURA] ❌ Handle @${cleanHandle} no verificable`);
        return {
          success: false,
          error: `Handle @${cleanHandle} no existe o no es accesible`,
          method: 'hybrid_verification_failed',
          extracted_handle: cleanHandle,
          confidence: extractResult.confidence
        };
      }

      // 🎉 ÉXITO: Handle encontrado con pipeline híbrido inteligente
      console.log(`[LAURA] ✅ ÉXITO: @${cleanHandle} resuelto con pipeline híbrido inteligente`);
      return {
        success: true,
        handle: cleanHandle,
        confidence: extractResult.confidence,
        method: 'hybrid_intelligent_success',
        resolved_username: cleanHandle,
        needs_profile: true,
        evidence: extractResult.evidence,
        source_strategy: extractResult.source_strategy,
        search_attempts: allSearchResults.length,
        person_info: personInfo.substring(0, 500), // Información adicional de la persona
        cache_duration: 30 * 24 * 60 * 60 * 1000 // 30 días para positivos
      };

    } catch (error) {
      console.error(`[LAURA] ❌ Error en pipeline híbrido inteligente:`, error);
      return {
        success: false,
        error: `Error resolviendo handle: ${error.message}`,
        method: 'hybrid_error',
        cache_duration: 12 * 60 * 60 * 1000 // 12 horas para errores
      };
    }
  }

  // 🔍 Función auxiliar: llamar LLM con function calling
  async callLLMWithFunction(messages, functionSchema) {
    try {
      // Intentar con OpenAI primero (si está disponible)
      if (process.env.OPENAI_API_KEY) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: [{
              type: "function",
              function: functionSchema
            }],
            tool_choice: { type: "function", function: { name: functionSchema.name } },
            temperature: 0.1
          })
        });

        if (response.ok) {
          const data = await response.json();
          const toolCall = data.choices[0].message.tool_calls?.[0];
          if (toolCall && toolCall.function) {
            return JSON.parse(toolCall.function.arguments);
          }
        }
      }

      // Fallback: usar prompt simple con Gemini/GPT
      const fallbackPrompt = `${messages[1].content}

Devuelve SOLO un JSON válido con este formato:
{"handle": "username_sin_@", "confidence": 0.9}

Si no existe cuenta conocida, devuelve:
{"handle": "NONE", "confidence": 0}`;

      const fallbackResponse = await gptChat([
        { role: 'system', content: messages[0].content },
        { role: 'user', content: fallbackPrompt }
      ], { temperature: 0.1, max_tokens: 100 });

      return JSON.parse(fallbackResponse);

    } catch (error) {
      console.error(`[LAURA] ❌ Error en callLLMWithFunction:`, error);
      throw error;
    }
  }

  // 🔍 Verificación ligera: comprobar que el handle existe
  async verifyTwitterHandle(handle) {
    try {
      console.log(`[LAURA] 🔍 Verificando @${handle} via Nitter...`);
      
      // Intentar con diferentes instancias de Nitter
      const nitterInstances = [
        'https://nitter.net',
        'https://nitter.it',
        'https://nitter.privacydev.net'
      ];

      for (const nitterUrl of nitterInstances) {
        try {
          const url = `${nitterUrl}/${handle}`;
          const response = await fetch(url, {
            method: 'HEAD',
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; TwitterHandleVerifier/1.0)'
            }
          });
          
          if (response.ok) {
            console.log(`[LAURA] ✅ Handle @${handle} verificado en ${nitterUrl}`);
            return true;
          }
        } catch (instanceError) {
          console.log(`[LAURA] ⚠️ Error verificando en ${nitterUrl}:`, instanceError.message);
          continue;
        }
      }

      // Todas las instancias fallaron
      console.log(`[LAURA] ❌ No se pudo verificar @${handle} en ninguna instancia`);
      return false;

    } catch (error) {
      console.error(`[LAURA] ❌ Error verificando handle:`, error);
      return false;
    }
  }

  // ============================================================================
  // 🚀 MÉTODOS ACTIVOS (Solo-LLM Pipeline)
  // ============================================================================

  // 🚀 Función para ejecutar nitter_profile después de resolver handle
  async executeNitterProfile(username, user) {
    try {
      console.log(`[LAURA] 📊 Ejecutando nitter_profile para: @${username}`);
      
      const profileResult = await mcpService.executeTool('nitter_profile', {
        username: username,
        limit: 20, // Parámetro correcto según tu MCP
        include_retweets: false, // Parámetro correcto según MCP
        include_replies: false // Parámetro correcto según MCP
      }, user);
      
      if (profileResult.success) {
        console.log(`[LAURA] ✅ Perfil obtenido exitosamente: ${profileResult.tweets?.length || 0} tweets`);
        return {
          success: true,
          profile: profileResult.profile || {},
          tweets: profileResult.tweets || [],
          followers: profileResult.profile?.followers_count || 0,
          following: profileResult.profile?.following_count || 0,
          bio: profileResult.profile?.description || '',
          verified: profileResult.profile?.verified || false
        };
      } else {
        console.log(`[LAURA] ❌ Error obteniendo perfil: ${profileResult.error}`);
        return {
          success: false,
          error: profileResult.error || 'Error desconocido obteniendo perfil'
        };
      }
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error ejecutando nitter_profile:`, error);
      return {
        success: false,
        error: error.message || 'Error ejecutando nitter_profile'
      };
    }
  }
  
  // Búsqueda mejorada con Perplexity usando prompts simples y directos
  // ============================================================================
  // 🗂️ MÉTODOS LEGACY (DEPRECATED - Usar Solo-LLM Pipeline arriba)
  // ============================================================================
  
  // ❌ DEPRECATED: Usar resolveTwitterHandle() Solo-LLM Pipeline
  async searchTwitterHandleWithPerplexity(name, context, sector, user) {
    console.log(`[LAURA] 🔍 Buscando handle en Perplexity para: "${name}"`);
    
    // Prompt simple y directo como pregunta natural
    const query = `¿Cuál es el perfil de ${name} en Twitter?`;
    
    console.log(`[LAURA] 🔍 Query simple: "${query}"`);
    
    try {
      // Parámetros minimalistas - sin location, focus, etc.
      const searchParams = {
        query: query
      };
      
      console.log(`[LAURA] 📤 Enviando a Perplexity:`, JSON.stringify(searchParams, null, 2));
      
      const result = await mcpService.executeTool('perplexity_search', searchParams, user);
      
      console.log(`[LAURA] 📥 Respuesta de Perplexity:`, {
        success: result.success,
        hasContent: result.hasContent,
        contentLength: result.content?.length || 0,
        firstChars: result.content?.substring(0, 200) || 'NO CONTENT',
        rawResult: JSON.stringify(result, null, 2)
      });
      
      if (result.success && (result.content || result.formatted_response)) {
        // Usar formatted_response si content está vacío
        const contentToParse = result.content || result.formatted_response;
        console.log(`[LAURA] 📝 Parseando contenido de ${result.content ? 'content' : 'formatted_response'}`);
        return await this.parsePerplexityLinksResponse(contentToParse, name, user);
      }
      
      // Log específico para hasContent:false
      if (result.success && !result.content && !result.formatted_response) {
        console.error(`[LAURA] ⚠️ Sin contenido en respuesta para query: "${query}"`);
      }
      
      return { confidence: 0, candidates: [] };
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en búsqueda Perplexity:`, error);
      return { confidence: 0, candidates: [] };
    }
  }
  
  // 🧠 LLM-powered parser for Perplexity responses (replaces regex approach)
  async parsePerplexityLinksResponse(content, originalName, user = null) {
    console.log(`[LAURA] 🧠 Parseando contenido con LLM para encontrar usuario de: ${originalName}`);
    
    // 🎯 DETECCIÓN DIRECTA DE URLs Y HANDLES - Prioridad máxima
    const urlPatterns = [
      /https?:\/\/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi,
      /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi,
      /@([a-zA-Z0-9_]+)\s*$/gi,  // Handle al final de línea
      /@([a-zA-Z0-9_]+)\s/gi     // Handle seguido de espacio
    ];
    
    for (const pattern of urlPatterns) {
      const match = pattern.exec(content);
      if (match) {
        const handle = match[1];
        if (this.isValidTwitterHandle(handle)) {
          console.log(`[LAURA] 🎯 URL/HANDLE DIRECTO encontrado: ${match[0]} → @${handle}`);
          return {
            handle: handle,
            confidence: 9, // Alta confianza para URLs directas
            candidates: [{ handle, confidence: 9, context: match[0] }],
            bio: '',
            followers: 0
          };
        }
      }
    }
    
    // 🔍 Si respuesta es exactamente "NONE", retornar inmediatamente
    if (content.trim().toUpperCase() === 'NONE') {
      console.log(`[LAURA] ❌ Perplexity respondió NONE - no existe perfil`);
      return { handle: '', confidence: 0, candidates: [] };
    }
    
    try {
      // Step 1: Use LLM to extract Twitter usernames from content
      const extractionPrompt = `Busca específicamente el handle/username de Twitter para "${originalName}" en este contenido.

CONTENIDO:
${content}

INSTRUCCIONES CRÍTICAS:
- SOLO extrae handles que estén EXPLÍCITAMENTE mencionados como pertenecientes a "${originalName}"
- Busca patrones como:
  * "su perfil de Twitter es @username"
  * "en Twitter como @username"
  * "twitter.com/username"
  * "x.com/username"
  * "${originalName} (@username)"
- NO extraigas palabras aleatorias del texto
- NO extraigas fragmentos de URLs o frases
- El handle debe ser claramente identificado como el usuario de Twitter de "${originalName}"

Responde SOLO en este formato JSON:
{
  "username": "username_encontrado_sin_@",
  "confidence": 0.9,
  "evidence": "texto específico donde encontraste el handle"
}

Si NO encuentras un handle EXPLÍCITAMENTE mencionado para "${originalName}", responde:
{
  "username": null,
  "confidence": 0,
  "evidence": "no se encontró handle específico"
}`;
      
      console.log(`[LAURA] 🤖 Enviando análisis LLM...`);
      
      if (user) {
        const llmResult = await gptChat([{ role: 'user', content: extractionPrompt }], {
          temperature: 0.1,
          max_tokens: 200
        });
        
        if (llmResult) {
          try {
            const parsed = JSON.parse(llmResult);
            console.log(`[LAURA] 🎯 LLM extraction result:`, parsed);
            
            if (parsed.username && parsed.confidence >= 0.7 && this.isValidTwitterHandle(parsed.username)) {
              console.log(`[LAURA] ✅ Usuario extraído con LLM: @${parsed.username} (confianza: ${parsed.confidence})`);
              
              return {
                handle: parsed.username,
                name: originalName,
                bio: this.extractBioFromContext(content),
                followers: this.extractFollowersFromContext(content),
                confidence: Math.round(parsed.confidence * 10), // Scale to 1-10
                context: parsed.evidence || content.substring(0, 200),
                llm_extracted: true
              };
            } else if (parsed.username) {
              console.log(`[LAURA] ❌ Handle LLM inválido o baja confianza: "${parsed.username}" (${parsed.confidence})`);
            }
          } catch (parseError) {
            console.error(`[LAURA] ❌ Error parsing LLM extraction result:`, parseError);
            console.log(`[LAURA] 📄 Respuesta LLM original:`, llmResult);
          }
        }
      }
      
      // Step 2: Fallback to enhanced regex as backup
      console.log(`[LAURA] 🔄 Fallback a extracción regex mejorada`);
      return this.parsePerplexityLinksResponseLegacy(content, originalName);
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en parsePerplexityLinksResponse:`, error);
      return this.parsePerplexityLinksResponseLegacy(content, originalName);
    }
  }
  
  // 📚 Legacy regex-based parser (as backup)
  parsePerplexityLinksResponseLegacy(content, originalName) {
    console.log(`[LAURA] 📝 Parseando links de Twitter en respuesta de Perplexity (legacy)`);
    
    const candidates = [];
    const seenHandles = new Set();
    
    // Buscar links de Twitter directos con regex más robusta
    const twitterLinkRegex = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)(?:\/[^\s]*)?(?:\s|$|[^\w\/])/g;
    let match;
    
    console.log(`[LAURA] 🔍 Buscando links en content de ${content?.length || 0} caracteres`);
    console.log(`[LAURA] 🔍 Primeros 500 chars:`, content?.substring(0, 500) || 'NO CONTENT');
    
    // Debug: buscar específicamente "PiaLaPeriodista" en el contenido
    if (content && content.includes('PiaLaPeriodista')) {
      console.log(`[LAURA] 🎯 FOUND "PiaLaPeriodista" en el contenido!`);
    }
    if (content && content.includes('Perfil de Twitter:')) {
      console.log(`[LAURA] 🎯 FOUND "Perfil de Twitter:" en el contenido!`);
    }
    
    while ((match = twitterLinkRegex.exec(content)) !== null) {
      const handle = match[1];
      
      // Filtrar handles comunes que no son usuarios
      if (['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'more', 'compose', 'search'].includes(handle.toLowerCase())) {
        continue;
      }
      
      if (!seenHandles.has(handle)) {
        seenHandles.add(handle);
        
        // Buscar contexto alrededor del link
        const linkIndex = content.indexOf(match[0]);
        const contextStart = Math.max(0, linkIndex - 100);
        const contextEnd = Math.min(content.length, linkIndex + 100);
        const context = content.substring(contextStart, contextEnd);
        
        // Extraer nombre del contexto si es posible
        const nameMatch = context.match(new RegExp(`([^\\n]*${originalName}[^\\n]*)`, 'i'));
        const extractedName = nameMatch ? nameMatch[1].trim() : originalName;
        
        const confidence = this.calculateHandleConfidenceFromContext(handle, extractedName, context, originalName);
        
        candidates.push({
          handle,
          name: extractedName,
          bio: this.extractBioFromContext(context),
          followers: this.extractFollowersFromContext(context),
          confidence,
          context: context.trim()
        });
      }
    }
    
    // También buscar handles en formato @username como backup
    const handleRegex = /@([a-zA-Z0-9_]+)/g;
    while ((match = handleRegex.exec(content)) !== null) {
      const handle = match[1];
      
      if (!seenHandles.has(handle) && this.isValidTwitterHandle(handle)) {
        seenHandles.add(handle);
        
        // Confianza base para handles mencionados + boost contextual
        let confidence = 4;
        if (handle.includes('Periodista') || handle.includes('periodista')) confidence += 2;
        if (handle.toLowerCase().includes('pia')) confidence += 1;
        
        candidates.push({
          handle,
          name: originalName,
          bio: '',
          followers: 0,
          confidence: confidence,
          context: match[0]
        });
        
        console.log(`[LAURA] ✅ Handle @ encontrado: @${handle} (confianza: ${confidence})`);
      }
    }
    
    // Buscar patrones de texto que mencionen perfiles (incluyendo formato específico de Perplexity)
    const profilePatterns = [
      // Patrón específico para formato de Perplexity - MÁS ESTRICTO
      /Perfil de Twitter:\s*@([a-zA-Z0-9_]+)/gi,
      /perfil\s+(?:es|está en)\s+@([a-zA-Z0-9_]+)/gi,
      /su cuenta\s+(?:es|está)\s+@([a-zA-Z0-9_]+)/gi,
      /twitter\.com\/([a-zA-Z0-9_]+)/gi,
      /x\.com\/([a-zA-Z0-9_]+)/gi,
      /handle\s+(?:es|está)\s+@([a-zA-Z0-9_]+)/gi,
      /usuario\s+@([a-zA-Z0-9_]+)/gi,
      // Patrón para "se presenta como @handle" - REQUIERE @
      /se presenta como\s+@([a-zA-Z0-9_]+)/gi,
      // Patrón para "conocida como @handle" - REQUIERE @
      /conocid[oa] como\s+@([a-zA-Z0-9_]+)/gi
    ];
    
    for (const [patternIndex, pattern] of profilePatterns.entries()) {
      let patternMatches = 0;
      while ((match = pattern.exec(content)) !== null) {
        const handle = match[1];
        patternMatches++;
        
        console.log(`[LAURA] 🔍 Patrón ${patternIndex + 1} encontró: "${match[0]}" → handle: "${handle}"`);
        
        if (!seenHandles.has(handle) && this.isValidTwitterHandle(handle)) {
          seenHandles.add(handle);
          
          const confidence = this.calculateSmartConfidence(handle, match[0], content, patternIndex);
          
          candidates.push({
            handle,
            name: originalName,
            bio: '',
            followers: 0,
            confidence: confidence,
            context: match[0]
          });
          
          console.log(`[LAURA] ✅ Agregado candidato: @${handle} (confianza: ${confidence})`);
        } else if (!this.isValidTwitterHandle(handle)) {
          console.log(`[LAURA] ❌ Handle inválido descartado: "${handle}"`);
        }
      }
      console.log(`[LAURA] 📊 Patrón ${patternIndex + 1} encontró ${patternMatches} matches`);
    }
    
    // Ordenar por confianza
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    console.log(`[LAURA] 📊 Candidatos encontrados:`, candidates.map(c => ({
      handle: c.handle,
      confidence: c.confidence,
      name: c.name,
      bio: c.bio?.substring(0, 50) || ''
    })));
    
    const topCandidate = candidates[0];
    return {
      handle: topCandidate?.handle || '',
      confidence: topCandidate?.confidence || 0,
      candidates: candidates.slice(0, 3), // Máximo 3 candidatos
      bio: topCandidate?.bio || '',
      followers: topCandidate?.followers || 0
    };
  }
  
  // Calcular confianza basada en contexto de Perplexity
  calculateHandleConfidenceFromContext(handle, name, context, originalName) {
    let confidence = 0;
    
    // Boost por similitud de nombre
    if (name.toLowerCase().includes(originalName.toLowerCase()) || 
        originalName.toLowerCase().includes(name.toLowerCase())) {
      confidence += 4;
    }
    
    // Boost por handle relacionado
    if (handle.toLowerCase().includes(originalName.toLowerCase().replace(' ', '')) ||
        originalName.toLowerCase().replace(' ', '').includes(handle.toLowerCase())) {
      confidence += 3;
    }
    
    // Boost por contexto guatemalteco
    if (context.toLowerCase().includes('guatemala') || 
        context.toLowerCase().includes('gt') ||
        context.toLowerCase().includes('chapín')) {
      confidence += 2;
    }
    
    // Boost por contexto de medios/periodismo
    if (context.toLowerCase().includes('periodista') || 
        context.toLowerCase().includes('medio') ||
        context.toLowerCase().includes('noticia')) {
      confidence += 1;
    }
    
    // Boost por verificación o oficial
    if (context.toLowerCase().includes('oficial') || 
        context.toLowerCase().includes('verified')) {
      confidence += 1;
    }
    
    return Math.min(confidence, 10); // Máximo 10
  }
  
  // Extraer bio del contexto
  extractBioFromContext(context) {
    // Buscar patrones de biografía
    const bioPatterns = [
      /bio[grafía]*:\s*([^.\n]+)/i,
      /descripción:\s*([^.\n]+)/i,
      /perfil:\s*([^.\n]+)/i
    ];
    
    for (const pattern of bioPatterns) {
      const match = context.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return '';
  }
  
  // Extraer número de seguidores del contexto
  extractFollowersFromContext(context) {
    const followersPatterns = [
      /(\d+(?:\.\d+)?)\s*[km]?\s*seguidores/i,
      /(\d+(?:\.\d+)?)\s*[km]?\s*followers/i,
      /seguidores:\s*(\d+(?:\.\d+)?)\s*[km]?/i
    ];
    
    for (const pattern of followersPatterns) {
      const match = context.match(pattern);
      if (match) {
        return this.parseFollowerCount(match[1]);
      }
    }
    
    return 0;
  }

  // Calcular confianza de un handle basado en contexto
  calculateHandleConfidence(handle, name, bio, originalName) {
    let confidence = 0;
    
    // Boost por similitud de nombre
    if (name.toLowerCase().includes(originalName.toLowerCase()) || 
        originalName.toLowerCase().includes(name.toLowerCase())) {
      confidence += 4;
    }
    
    // Boost por handle relacionado
    if (handle.toLowerCase().includes(originalName.toLowerCase().replace(' ', '')) ||
        originalName.toLowerCase().replace(' ', '').includes(handle.toLowerCase())) {
      confidence += 3;
    }
    
    // Boost por contexto guatemalteco
    if (bio.toLowerCase().includes('guatemala') || 
        bio.toLowerCase().includes('gt') ||
        bio.toLowerCase().includes('chapín')) {
      confidence += 2;
    }
    
    // Boost por verificación oficial
    if (bio.toLowerCase().includes('oficial') || 
        bio.toLowerCase().includes('verified')) {
      confidence += 1;
    }
    
    return Math.min(confidence, 10); // Máximo 10
  }
  
  // Parser para número de seguidores
  parseFollowerCount(followersStr) {
    const str = followersStr.toLowerCase();
    let number = parseFloat(str.replace(/[^\d.]/g, ''));
    
    if (str.includes('k')) number *= 1000;
    if (str.includes('m')) number *= 1000000;
    
    return Math.round(number) || 0;
  }

  // Implementar búsqueda cruzada con handles conocidos (técnica Mary)
  async searchTwitterWithKnownHandles(name, existingCandidates, user) {
    console.log(`[LAURA] 🔍 Búsqueda cruzada con handles conocidos para: "${name}"`);
    
    const candidates = [...existingCandidates];
    
    // Construir consultas simples para búsqueda cruzada
    const crossSearchQueries = [
      // Pregunta simple para Twitter
      `¿Cuál es el perfil de ${name} en Twitter?`,
      // Pregunta para Instagram si existe
      `¿Cuál es el perfil de ${name} en Instagram?`,
      // Pregunta para TikTok si existe
      `¿Cuál es el perfil de ${name} en TikTok?`,
      // Pregunta general de redes sociales
      `¿Cuáles son las redes sociales de ${name}?`
    ];
    
    for (const [index, query] of crossSearchQueries.entries()) {
      console.log(`[LAURA] 🔍 Búsqueda cruzada ${index + 1}: "${query}"`);
      
      try {
        const result = await mcpService.executeTool('perplexity_search', {
          query: query
        }, user);
        
        if (result.success && (result.content || result.formatted_response)) {
          const contentToParse = result.content || result.formatted_response;
          const parsed = await this.parsePerplexityLinksResponse(contentToParse, name, user);
          if (parsed.confidence >= 6) {
            console.log(`[LAURA] ✅ Búsqueda cruzada ${index + 1} exitosa: @${parsed.handle}`);
            return parsed;
          }
          // Agregar nuevos candidatos encontrados
          candidates.push(...parsed.candidates);
          
          // También buscar handles de Instagram/TikTok para correlación
          const socialHandles = this.extractSocialHandles(contentToParse, name);
          if (socialHandles.length > 0) {
            console.log(`[LAURA] 📱 Handles de redes sociales encontrados:`, socialHandles);
            candidates.push(...socialHandles);
          }
        }
        
      } catch (error) {
        console.error(`[LAURA] ❌ Error en búsqueda cruzada ${index + 1}:`, error);
      }
    }
    
    // Deduplicate y ordenar todos los candidatos encontrados
    const uniqueCandidates = this.deduplicateCandidates(candidates);
    const topCandidate = uniqueCandidates[0];
    
    return {
      handle: topCandidate?.handle || '',
      confidence: topCandidate?.confidence || 0,
      candidates: uniqueCandidates.slice(0, 3),
      bio: topCandidate?.bio || '',
      followers: topCandidate?.followers || 0
    };
  }

  // Búsqueda alternativa con múltiples variaciones usando prompts naturales
  async searchTwitterHandleAlternatives(name, context, sector, user) {
    console.log(`[LAURA] 🔍 Probando búsquedas alternativas para: "${name}"`);
    
    // Consultas simples y directas para evitar ruido
    const variations = [
      // Variación 1: Pregunta simple para Twitter
      `¿Cuál es el perfil de ${name} en Twitter?`,
      // Variación 2: Pregunta con X (nuevo nombre de Twitter)
      `¿Cuál es el perfil de ${name} en X?`,
      // Variación 3: Búsqueda con site: para resultados precisos
      `${name} site:twitter.com`,
      // Variación 4: Búsqueda con site: para X
      `${name} site:x.com`,
      // Variación 5: Pregunta sobre handle específico
      `¿Cuál es el handle de Twitter de ${name}?`
    ];
    
    for (const [index, query] of variations.entries()) {
      console.log(`[LAURA] 🔍 Variación ${index + 1}: "${query}"`);
      
      try {
        const result = await mcpService.executeTool('perplexity_search', {
          query: query
        }, user);
        
        if (result.success && (result.content || result.formatted_response)) {
          const contentToParse = result.content || result.formatted_response;
          const parsed = await this.parsePerplexityLinksResponse(contentToParse, name, user);
          if (parsed.confidence >= 6) {
            console.log(`[LAURA] ✅ Variación ${index + 1} exitosa: @${parsed.handle}`);
            return parsed;
          }
        }
      } catch (error) {
        console.error(`[LAURA] ❌ Error en variación ${index + 1}:`, error);
      }
      
      // Pequeña pausa entre búsquedas
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { confidence: 0, candidates: [] };
  }
  
  // Validar si un handle es válido para Twitter
  isValidTwitterHandle(handle) {
    if (!handle || typeof handle !== 'string') return false;
    
    // Básicas reglas de Twitter handles
    if (handle.length < 1 || handle.length > 15) return false;
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) return false;
    // ✅ CORREGIDO: Twitter SÍ permite handles que terminan en _
    
    // Filtrar palabras comunes en español que claramente NO son handles
    const invalidWords = [
      // Palabras comunes españolas
      'activo', 'seguido', 'sociales', 'en', 'es', 'de', 'la', 'el', 'y', 'con',
      'para', 'por', 'desde', 'hasta', 'sobre', 'bajo', 'entre', 'sin', 'según',
      'durante', 'mediante', 'contra', 'hacia', 'dentro', 'fuera', 'cerca', 'lejos',
      'cuando', 'donde', 'como', 'que', 'quien', 'cual', 'cuyo', 'todo', 'todos',
      'algo', 'alguien', 'nada', 'nadie', 'mucho', 'poco', 'tanto', 'otro', 'mismo',
      'oficial', 'público', 'general', 'especial', 'principal', 'nacional', 'local',
      'importante', 'necesario', 'posible', 'imposible', 'difícil', 'fácil',
      'grande', 'pequeño', 'alto', 'bajo', 'nuevo', 'único', 'último', 'primer',
      
      // Palabras específicas que aparecieron en los logs
      'fechas', 'FECHAS', 'relacionadas', 'relacionados', 'característico', 'característica',
      'publicaciones', 'publicación', 'enfoque', 'temas', 'nacionales', 'nacional',
      'contenido', 'información', 'perfil', 'usuario', 'cuenta', 'twitter', 'social',
      'redes', 'medios', 'periodista', 'comunicación', 'político', 'política',
      'gobierno', 'ministro', 'presidente', 'congreso', 'diputado', 'guatemala',
      'guatemalteco', 'guatemalteca', 'público', 'privado', 'personal', 'profesional',
      
      // Palabras técnicas de web
      'home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile',
      'more', 'compose', 'search', 'trending', 'moments', 'settings', 'help'
    ];
    
    // Verificar si es una palabra inválida (case insensitive)
    if (invalidWords.includes(handle.toLowerCase())) return false;
    
    // Verificar si es solo números (probablemente no es un handle válido)
    if (/^\d+$/.test(handle)) return false;
    
    // Verificar si tiene más de 3 números consecutivos (raro en handles reales)
    if (/\d{4,}/.test(handle)) return false;
    
    // Si pasó todas las validaciones, es válido
    return true;
  }

  // Calcular confianza inteligente basada en patrón y contexto
  calculateSmartConfidence(handle, pattern, content, patternIndex) {
    let confidence = 0;
    
    // Boost base según el patrón específico
    switch (patternIndex) {
      case 0: // "Perfil de Twitter: @handle"
        confidence += 9;
        break;
      case 2: // "Su cuenta oficial en Twitter es @handle"
        confidence += 8;
        break;
      case 3: // "Twitter: @handle"
        confidence += 7;
        break;
      case 4: // "se presenta como @handle"
        confidence += 7;
        break;
      case 5: // "usuario @handle"
        confidence += 6;
        break;
      case 6: // "conocida como @handle"
        confidence += 6;
        break;
      default:
        confidence += 4;
    }
    
    // Boost adicional para patrones específicos en el texto
    if (pattern.includes('Perfil de Twitter:')) confidence += 2;
    if (pattern.includes('cuenta oficial')) confidence += 2;
    if (pattern.includes('usuario @')) confidence += 1;
    if (pattern.includes('se presenta como')) confidence += 1;
    
    // Boost por características del handle
    if (handle.length > 5 && handle.length < 12) confidence += 1; // Longitud típica
    if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(handle)) confidence += 1; // Empieza con letra
    if (handle.includes('Periodista') || handle.includes('periodista')) confidence += 2; // Contexto relevante
    if (handle.toLowerCase().includes('pia')) confidence += 1; // Relacionado con el nombre
    
    // Boost por contexto en el contenido
    if (content.includes(`@${handle}`)) confidence += 1; // Aparece con @ en el contenido
    if (content.includes(`(${handle})`)) confidence += 1; // Aparece entre paréntesis
    if (content.includes(`"${handle}"`)) confidence += 1; // Aparece entre comillas
    
    // Penalización por características sospechosas
    if (handle.length < 4) confidence -= 1; // Muy corto
    if (handle.length > 12) confidence -= 1; // Muy largo
    if (handle.includes('___')) confidence -= 2; // Muchos guiones bajos
    if (/^\d/.test(handle)) confidence -= 1; // Empieza con número
    
    return Math.max(0, Math.min(10, confidence)); // Limitar entre 0 y 10
  }

  // Normalizar acentos para búsquedas
  normalizeAccents(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  // Extraer handles de redes sociales (Instagram, TikTok) para correlación
  extractSocialHandles(content, originalName) {
    const socialCandidates = [];
    
    // Buscar handles de Instagram
    const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_\.]+)/g;
    let match;
    while ((match = instagramRegex.exec(content)) !== null) {
      const handle = match[1];
      if (handle && handle !== 'p' && handle !== 'tv' && handle !== 'reel') {
        socialCandidates.push({
          handle: handle,
          name: originalName,
          platform: 'instagram',
          confidence: 5, // Confianza media para correlación
          bio: '',
          followers: 0,
          context: `Instagram: @${handle}`
        });
      }
    }
    
    // Buscar handles de TikTok
    const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_\.]+)/g;
    while ((match = tiktokRegex.exec(content)) !== null) {
      const handle = match[1];
      if (handle) {
        socialCandidates.push({
          handle: handle,
          name: originalName,
          platform: 'tiktok',
          confidence: 5,
          bio: '',
          followers: 0,
          context: `TikTok: @${handle}`
        });
      }
    }
    
    // Buscar menciones de handles con @
    const handleMentions = content.match(/@([a-zA-Z0-9_]+)/g);
    if (handleMentions) {
      handleMentions.forEach(mention => {
        const handle = mention.substring(1); // Remover @
        if (handle.length > 3) {
          // Inferir si podría ser Twitter basado en contexto
          const isTwitterContext = content.toLowerCase().includes('twitter') || 
                                 content.toLowerCase().includes('x.com') ||
                                 content.toLowerCase().includes('tweet');
          
          if (isTwitterContext) {
            socialCandidates.push({
              handle: handle,
              name: originalName,
              platform: 'twitter',
              confidence: 6,
              bio: '',
              followers: 0,
              context: `Twitter mention: @${handle}`
            });
          }
        }
      });
    }
    
    return socialCandidates;
  }

  // Deduplicar candidatos
  deduplicateCandidates(candidates) {
    const seen = new Set();
    return candidates.filter(candidate => {
      if (seen.has(candidate.handle)) {
        return false;
      }
      seen.add(candidate.handle);
      return true;
    });
  }

  async enhanceProfileWithPerplexity(username, user) {
    try {
      console.log(`[LAURA] 🔍 Iniciando enhancement de perfil para @${username}`);
      
      const perplexityQuery = `@${username} Twitter perfil Guatemala contexto actual información background`;
      console.log(`[LAURA] 📝 Query Perplexity: "${perplexityQuery}"`);
      
      const startTime = Date.now();
      const perplexityResult = await mcpService.executeTool('perplexity_search', {
        query: perplexityQuery,
        location: 'guatemala',
        focus: 'profile_context'
      }, user);
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
    if (!originalQuery) return 0;
    
    const query = originalQuery.toLowerCase();
    let relevanceScore = 0;
    
    // DETECCIÓN ESPECIAL MEJORADA: Queries de usuario específico con patrones ampliados
    const isUserQuery = query.includes('@') || 
                       query.match(/tweets? de|perfil de|usuario|extraeme.*de|busca.*a|qué.*dice|información.*de|lo que tengas de|actividad.*de|últimos.*de/i) ||
                       query.match(/extraeme|busca|analiza.*perfil|revisa.*perfil|tweets.*recientes/i);
    
    // 🎯 CORRECCIÓN: Detectar consultas de perfil exitosas desde findings
    const findings = toolResult.findings || toolResult;
    const isProfileQuery = toolResult.handle || toolResult.resolved_username || toolResult.auto_continued ||
                          findings.handle || findings.resolved_username || findings.user_profile ||
                          findings.recent_activity || findings.processing_successful;
    
    // 🎯 CORRECCIÓN: Buscar tweets en findings también
    const tweets = toolResult.tweets || findings.recent_activity || findings.tweets || [];
    const hasValidTweets = tweets && tweets.length > 0;
    
    if ((isUserQuery || isProfileQuery) && hasValidTweets) {
      // Para queries de usuario/perfil, la relevancia es alta si encontramos tweets
      console.log(`[LAURA] > ✅ Query de usuario/perfil exitosa - tweets encontrados: ${tweets.length}`);
      console.log(`[LAURA] > Detección: isUserQuery=${isUserQuery}, isProfileQuery=${isProfileQuery}, hasValidTweets=${hasValidTweets}`);
      return Math.min(10, Math.max(8, Math.round(tweets.length / 2) + 6));
    }
    
    // 🎯 CASO ESPECIAL: Si es query de perfil pero sin tweets, aún puede ser relevante
    if ((isUserQuery || isProfileQuery) && (findings.profile_resolved || findings.has_valid_data)) {
      console.log(`[LAURA] > ✅ Query de perfil exitosa sin tweets pero con datos válidos`);
      return 6; // Relevancia media para perfiles encontrados
    }
    
    // Evaluar tweets (usando la variable ya definida)
    if (hasValidTweets) {
      const relevantTweets = tweets.filter(tweet => {
        const text = tweet.texto?.toLowerCase() || '';
        
        // Relevancia semántica mejorada
        const queryWords = query.split(' ').filter(w => w.length > 3);
        const matchingWords = queryWords.filter(word => text.includes(word));
        
        // Evaluar contexto semántico
        const semanticScore = this.calculateSemanticRelevance(text, query);
        
        return matchingWords.length > 0 || semanticScore > 0.3;
      });
      
      const relevanceRatio = relevantTweets.length / tweets.length;
      relevanceScore = Math.max(relevanceScore, Math.round(relevanceRatio * 10));
      
      console.log(`[LAURA] > Tweets relevantes: ${relevantTweets.length}/${tweets.length} (${Math.round(relevanceRatio * 100)}%)`);
    }
    
    // Evaluar contexto web si existe
    const webContent = toolResult.content || toolResult.webContext || findings.web_context || '';
    if (webContent) {
      const content = webContent.toLowerCase();
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

  // 🧠 NUEVA FUNCIÓN: Análisis inteligente con Gemini
  async analyzeWithGemini(tweets, originalQuery) {
    try {
      const geminiService = require('./gemini');
      
      // Preparar contexto de tweets
      const tweetsContext = tweets.slice(0, 10).map((tweet, idx) => {
        return `${idx + 1}. ${tweet.fecha_tweet}: ${tweet.texto} (${tweet.likes || 0} likes, ${tweet.retweets || 0} RTs)`;
      }).join('\n');
      
      const analysisPrompt = `Analiza los siguientes tweets en respuesta a la consulta: "${originalQuery}"

TWEETS A ANALIZAR:
${tweetsContext}

INSTRUCCIONES:
1. Haz un resumen ejecutivo de lo que dicen estos tweets
2. Identifica los temas principales y mensajes clave
3. Analiza el contexto temporal y relevancia
4. Evalúa el sentimiento general
5. Determina si estos datos responden a la consulta original

Responde en formato JSON válido:
{
  "resumen_ejecutivo": "Resumen claro de qué muestran estos tweets",
  "temas_principales": ["tema1", "tema2", "tema3"],
  "mensajes_clave": ["mensaje1", "mensaje2"],
  "contexto_temporal": "Análisis del momento y fechas",
  "sentimiento_general": "positivo/negativo/neutral",
  "relevancia_para_consulta": "alta/media/baja",
  "responde_a_consulta": true,
  "insights": ["insight1", "insight2"],
  "recomendaciones": "Qué se puede hacer con esta información"
}`;

      console.log(`[LAURA] 🧠 Enviando ${tweets.length} tweets a Gemini para análisis`);
      
      // Usar el servicio de Gemini
      const messages = [
        { role: 'user', content: analysisPrompt }
      ];
      
      const geminiResponse = await geminiService.generateContent(messages, {
        temperature: 0.3,
        max_tokens: 1000
      });
      
      if (geminiResponse && geminiResponse.includes('{')) {
        try {
          // Extraer JSON de la respuesta
          const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysisResult = JSON.parse(jsonMatch[0]);
            console.log(`[LAURA] ✅ Análisis con Gemini exitoso: ${analysisResult.resumen_ejecutivo?.substring(0, 100)}...`);
            return analysisResult;
          } else {
            throw new Error('No se encontró JSON válido en la respuesta');
          }
        } catch (parseError) {
          console.error(`[LAURA] ❌ Error parseando respuesta de Gemini:`, parseError);
          console.error(`[LAURA] 📝 Respuesta completa:`, geminiResponse);
          
          // Fallback: crear análisis básico
          return {
            resumen_ejecutivo: `Análisis de ${tweets.length} tweets encontrados. ${geminiResponse.substring(0, 200)}...`,
            responde_a_consulta: true,
            relevancia_para_consulta: "alta",
            sentimiento_general: "neutral",
            temas_principales: ["actividad reciente"],
            insights: ["Datos procesados exitosamente"],
            raw_response: geminiResponse
          };
        }
      } else {
        console.error(`[LAURA] ❌ Respuesta vacía de Gemini`);
        return null;
      }
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en analyzeWithGemini:`, error);
      
      // Fallback: análisis básico sin Gemini
      return {
        resumen_ejecutivo: `Se analizaron ${tweets.length} tweets relevantes para la consulta "${originalQuery}". Los datos fueron procesados exitosamente.`,
        responde_a_consulta: true,
        relevancia_para_consulta: "alta",
        sentimiento_general: "neutral",
        temas_principales: ["análisis de contenido"],
        insights: ["Datos disponibles para análisis"],
        recomendaciones: "Los tweets contienen información relevante para la consulta solicitada",
        fallback: true
      };
    }
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

  // FUNCIÓN MEJORADA: Filtra tweets con contexto inteligente de fechas
  filterRecentTweets(tweets = [], query = '', maxAgeDays = null) {
    if (!tweets || tweets.length === 0) return [];
    
    // Determinar rango de días basado en contexto de la query
    const smartMaxDays = maxAgeDays || this.getSmartDateRange(query);
    
    const cutoff = Date.now() - smartMaxDays * 24 * 60 * 60 * 1000;
    return tweets.filter(tw => {
      const dateStr = tw.fecha_tweet || tw.fecha || tw.date || tw.timestamp;
      if (!dateStr) return false;
      const tweetDate = new Date(dateStr).getTime();
      return !isNaN(tweetDate) && tweetDate >= cutoff;
    });
  }

  // NUEVA FUNCIÓN: Determina rango de días inteligente según contexto
  getSmartDateRange(query = '') {
    const lowerQuery = query.toLowerCase();
    
    // Términos que indican tiempo inmediato (1-2 días)
    const immediateTerms = ['hoy', 'ahora', 'tráfico', 'circulación', 'vehicular', 'actual', 'en vivo', 'breaking', 'urgente'];
    if (immediateTerms.some(term => lowerQuery.includes(term))) {
      console.log(`[LAURA] 📅 Filtro temporal: INMEDIATO (1-2 días) para query: "${query}"`);
      return 2;
    }
    
    // Términos que indican tiempo reciente (3-7 días)
    const recentTerms = ['últimos días', 'esta semana', 'reciente', 'nuevo', 'actualidad', 'noticia'];
    if (recentTerms.some(term => lowerQuery.includes(term))) {
      console.log(`[LAURA] 📅 Filtro temporal: RECIENTE (7 días) para query: "${query}"`);
      return 7;
    }
    
    // Términos políticos y eventos importantes (10 días)
    const politicalTerms = ['política', 'político', 'congreso', 'presidente', 'ministro', 'elecciones', 'gobierno', 'corrupción'];
    if (politicalTerms.some(term => lowerQuery.includes(term))) {
      console.log(`[LAURA] 📅 Filtro temporal: POLÍTICO (10 días) para query: "${query}"`);
      return 10;
    }
    
    // Términos de eventos especiales (15 días)
    const eventTerms = ['evento', 'festival', 'marcha', 'manifestación', 'celebración', 'concierto'];
    if (eventTerms.some(term => lowerQuery.includes(term))) {
      console.log(`[LAURA] 📅 Filtro temporal: EVENTOS (15 días) para query: "${query}"`);
      return 15;
    }
    
    // Términos generales de análisis (30 días)
    const analysisTerms = ['análisis', 'tendencia', 'opinión', 'sentimiento', 'qué dicen'];
    if (analysisTerms.some(term => lowerQuery.includes(term))) {
      console.log(`[LAURA] 📅 Filtro temporal: ANÁLISIS (30 días) para query: "${query}"`);
      return 30;
    }
    
    // Default: 45 días para queries generales
    console.log(`[LAURA] 📅 Filtro temporal: GENERAL (45 días) para query: "${query}"`);
    return 45;
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
    this.laura = new LauraAgent(this);
    this.robert = new RobertAgent();
  }

  /**
   * Orquesta una consulta distribuyendo tareas entre Laura y Robert
   * MEJORADO: Acepta la decisión previa de Laura's reasoning engine
   */
  async orchestrateQuery(userMessage, user, sessionContext = {}) {
    const now = new Date();
    const currentDate = now.toLocaleDateString('es-ES', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

    console.log(`[AGENTES] > Orquestando consulta: "${userMessage}"`);
    
    // NUEVO: Si Laura ya tomó una decisión, usarla para guiar la orquestación
    const lauraDecision = sessionContext.lauraDecision;
    if (lauraDecision) {
      console.log(`[AGENTES] 🧠 Usando decisión previa de Laura: ${lauraDecision.plan?.tool} - ${lauraDecision.plan?.reasoning}`);
    }

    // Detectar qué agentes necesitamos (modificado para usar decisión de Laura)
    const plan = await this.createExecutionPlan(userMessage, lauraDecision);
    
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
   * MEJORADO: Incorpora la decisión previa de Laura's reasoning engine
   */
  async createExecutionPlan(userMessage, lauraDecision = null) {
    const msg = userMessage.toLowerCase();
    const plan = {
      lauraTasks: [],
      robertTasks: []
    };

    // NUEVO: Si Laura ya decidió, usar su decisión en lugar de heurísticas básicas
    if (lauraDecision && lauraDecision.plan && lauraDecision.plan.tool) {
      console.log(`[AGENTES] 🎯 Aplicando decisión de Laura: ${lauraDecision.plan.tool}`);
      
      // Crear tarea basada en la decisión de Laura
      const lauraTask = {
        id: `laura_${lauraDecision.plan.tool}`,
        tool: lauraDecision.plan.tool,
        type: lauraDecision.plan.tool === 'nitter_profile' ? 'profile' : 'monitoring',
        description: `Ejecutar ${lauraDecision.plan.tool} según reasoning engine`,
        originalQuery: userMessage,
        attempts: 0,
        useReasoningEngine: false, // Ya se usó el reasoning engine
        args: lauraDecision.plan.args || {},
        llmReasoning: lauraDecision.plan.reasoning,
        llmThought: lauraDecision.thought
      };
      
      plan.lauraTasks.push(lauraTask);
      
      // Si Laura decidió algo, es probable que no necesitemos datos personales
      // a menos que la query lo indique explícitamente
      if (msg.includes('mis') || msg.includes('mi ') || msg.includes('proyecto')) {
        this.addRobertTasksForPersonalData(plan, msg, userMessage);
      }
      
      return plan;
    } else if (lauraDecision) {
      console.log(`[AGENTES] ⚠️ Decisión de Laura inválida:`, lauraDecision);
      console.log(`[AGENTES] ⚠️ Plan tool: ${lauraDecision.plan?.tool}, Action: ${lauraDecision.plan?.action}`);
    }

    // FALLBACK: Usar lógica heurística original si Laura no decidió
    this.addHeuristicTasks(plan, msg, userMessage);

    return plan;
  }

  // NUEVA FUNCIÓN AUXILIAR: Agregar tareas usando heurística original
  addHeuristicTasks(plan, msg, userMessage) {
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

    // Detectar necesidad de monitoreo (Laura) - MEJORADO
    if (msg.includes('@') || msg.includes('tweet') || msg.includes('twitter') || 
        msg.includes('reacciones') || msg.includes('reaccion') || msg.includes('deportes') ||
        msg.includes('política') || msg.includes('opiniones') || msg.includes('tendencias') ||
        msg.includes('dicen') || msg.includes('comentan') || msg.includes('hablan')) {
      
      // MEJORADA: Detección de usuarios/personas específicas con ML
      const explicitHandle = msg.match(/@(\w+)/);
      const personMentions = this.detectPersonMentions(msg); // Temporal: usar método síncrono para estabilidad
      
      if (explicitHandle) {
        // Handle explícito encontrado
        plan.lauraTasks.push({
          id: 'profile_monitoring',
          tool: 'nitter_profile',
          type: 'profile',
          description: `Monitoreo de perfil @${explicitHandle[1]}`,
          originalQuery: userMessage,
          attempts: 0,
          useReasoningEngine: true,
          args: { username: explicitHandle[1] }
        });
      } else if (personMentions.detected) {
        // Mención de persona detectada sin handle explícito
        plan.lauraTasks.push({
          id: 'profile_monitoring',
          tool: 'nitter_profile',
          type: 'profile',
          description: `Monitoreo de perfil: ${personMentions.entity}`,
          originalQuery: userMessage,
          attempts: 0,
          useReasoningEngine: true,
          args: { username: personMentions.searchTerm }
        });
      } else {
        // Búsqueda general en redes sociales
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

  // NUEVA FUNCIÓN: Detecta menciones específicas de personas, instituciones o figuras públicas
  detectPersonMentions(message) {
    const msg = message.toLowerCase();
    
    // Patrones de personas e instituciones específicas
    const personPatterns = [
      // Gobierno y política
      { pattern: /(tweets?\s+del?\s+)?congreso(?:\s+de\s+guatemala)?/i, entity: 'Congreso de Guatemala', searchTerm: 'Congreso de Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?presidente(?:\s+arevalo|\s+arévalo)?/i, entity: 'Presidente Arévalo', searchTerm: 'Bernardo Arevalo' },
      { pattern: /(tweets?\s+del?\s+)?ministro(?:\s+de\s+\w+)?/i, entity: 'Ministro', searchTerm: 'ministro Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?casa\s+presidencial/i, entity: 'Casa Presidencial', searchTerm: 'Casa Presidencial Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?gobierno(?:\s+de\s+guatemala)?/i, entity: 'Gobierno', searchTerm: 'gobierno Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?diputado/i, entity: 'Diputado', searchTerm: 'diputado Guatemala' },
      
      // Instituciones específicas
      { pattern: /(tweets?\s+del?\s+)?mp(?:\s+guatemala)?/i, entity: 'Ministerio Público', searchTerm: 'MP Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?conred/i, entity: 'CONRED', searchTerm: 'CONRED Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?tse(?:\s+guatemala)?/i, entity: 'TSE', searchTerm: 'TSE Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?sat(?:\s+guatemala)?/i, entity: 'SAT', searchTerm: 'SAT Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?igss/i, entity: 'IGSS', searchTerm: 'IGSS Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?banco\s+de\s+guatemala/i, entity: 'Banco de Guatemala', searchTerm: 'Banco de Guatemala' },
      
      // Medios y periodistas
      { pattern: /(tweets?\s+del?\s+)?prensa\s+libre/i, entity: 'Prensa Libre', searchTerm: 'Prensa Libre Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?el\s+periodico/i, entity: 'El Periódico', searchTerm: 'El Periodico Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?soy502/i, entity: 'Soy502', searchTerm: 'Soy502' },
      
      // Deportes
      { pattern: /(tweets?\s+del?\s+)?seleccion(?:\s+guatemala|\s+nacional)?/i, entity: 'Selección Nacional', searchTerm: 'Seleccion Guatemala' },
      { pattern: /(tweets?\s+del?\s+)?liga\s+nacional/i, entity: 'Liga Nacional', searchTerm: 'Liga Nacional Guatemala' },
      
      // Figuras religiosas/sociales
      { pattern: /(tweets?\s+del?\s+)?cash\s+luna/i, entity: 'Cash Luna', searchTerm: 'Cash Luna' },
      
      // Nombres específicos comunes en política guatemalteca
      { pattern: /(tweets?\s+del?\s+)?bernardo\s+arevalo/i, entity: 'Bernardo Arévalo', searchTerm: 'Bernardo Arevalo' },
      { pattern: /(tweets?\s+del?\s+)?sandra\s+torres/i, entity: 'Sandra Torres', searchTerm: 'Sandra Torres' },
      { pattern: /(tweets?\s+del?\s+)?giammattei/i, entity: 'Giammattei', searchTerm: 'Giammattei' },
      
      // Figuras públicas guatemaltecas adicionales
      { pattern: /(tweets?\s+del?\s+)?a[lm]i*lcar\s+montejo/i, entity: 'Amilcar Montejo', searchTerm: 'amilcarmontejo' },
      { pattern: /(tweets?\s+del?\s+)?manuel\s+baldiz[oó]n/i, entity: 'Manuel Baldizón', searchTerm: 'Manuel Baldizon' },
      { pattern: /(tweets?\s+del?\s+)?zury\s+r[íi]os/i, entity: 'Zury Ríos', searchTerm: 'Zury Rios' },
      { pattern: /(tweets?\s+del?\s+)?edmond\s+mulet/i, entity: 'Edmond Mulet', searchTerm: 'Edmond Mulet' },
      { pattern: /(tweets?\s+del?\s+)?thelma\s+aldana/i, entity: 'Thelma Aldana', searchTerm: 'Thelma Aldana' },
      { pattern: /(tweets?\s+del?\s+)?ivan\s+velasquez/i, entity: 'Iván Velásquez', searchTerm: 'Ivan Velasquez' },
      
      // Patrones genéricos para nombres de personas (más amplio)
      { pattern: /(busca|buscar|analiza|tweets?\s+de)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i, entity: 'Persona específica', searchTerm: 'usuario específico' }
    ];

    // Buscar coincidencias
    for (const { pattern, entity, searchTerm } of personPatterns) {
      if (pattern.test(msg)) {
        console.log(`[AGENTES] 🎯 Persona/institución detectada: "${entity}" en query: "${message}"`);
        return {
          detected: true,
          entity: entity,
          searchTerm: searchTerm,
          originalPattern: pattern.source
        };
      }
    }

    // No se encontró mención específica de persona
    return {
      detected: false,
      entity: null,
      searchTerm: null
    };
  }

  // ML DISCOVERY: Detectar personas con inteligencia artificial
  async detectPersonMentionsWithML(message) {
    // Primero intentar detección tradicional
    const traditionalResult = this.detectPersonMentions(message);
    
    if (traditionalResult.detected) {
      return traditionalResult;
    }

    // Si no se detectó, buscar nombres propios que podrían ser personas
    const possibleNames = message.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);
    
    if (possibleNames && possibleNames.length > 0) {
      for (const name of possibleNames) {
        // Verificar si ya fue aprendido antes
        const learnedMatch = this.learnedPersons?.find(p => 
          p.pattern.test(message)
        );
        
        if (learnedMatch) {
          return {
            detected: true,
            entity: learnedMatch.entity,
            searchTerm: learnedMatch.searchTerm,
            source: 'learned_ml'
          };
        }

        // Intentar descubrir con ML
        const discovery = await this.discoverPersonWithML(name);
        
        if (discovery.discovered) {
          return {
            detected: true,
            entity: name,
            searchTerm: discovery.searchTerm,
            source: 'ml_discovery_new'
          };
        }
      }
    }

    return {
      detected: false,
      entity: null,
      searchTerm: null
    };
  }

  // SISTEMA DE APRENDIZAJE DINÁMICO CON PERPLEXITY
  async discoverPersonWithML(unknownName) {
    try {
      console.log(`🧠 ML Discovery: Buscando información sobre "${unknownName}"`);
      
      // Usar Perplexity para buscar información sobre la persona, especialmente su Twitter
      const perplexityQuery = `¿Quién es ${unknownName} en Guatemala? Incluye su username de Twitter, profesión, cargo, partido político, institución o relevancia pública. Busca su cuenta de Twitter/X oficial.`;
      
      // Simular llamada a Perplexity (usar el MCP service real)
      const discovery = await mcpService.executeCommand('perplexity_search', {
        q: perplexityQuery,
        location: 'guatemala'
      });

      if (discovery && discovery.content) {
        // Usar GPT-3.5-turbo para extraer información estructurada
        const analysisPrompt = [
          {
            role: 'system',
            content: `Analiza esta información y determina si "${unknownName}" es una persona relevante en Guatemala. BUSCA ESPECÍFICAMENTE SU USERNAME DE TWITTER.

Responde en JSON:
{
  "is_person": boolean,
  "is_relevant": boolean,
  "twitter_username": "string o null (username sin @, ej: 'amilcarmontejo')",
  "category": "politico|funcionario|empresario|periodista|activista|otro",
  "institution": "string o null",
  "description": "breve descripción",
  "search_terms": ["término1", "término2"],
  "confidence": 0-1
}

IMPORTANTE: Si encuentras su cuenta de Twitter/X, extrae el username exacto (sin @). Si no encuentras Twitter, usa el nombre como search_term.`
          },
          {
            role: 'user', 
            content: `Información encontrada sobre ${unknownName}:\n${discovery.content}`
          }
        ];

        const analysis = await gptChat(analysisPrompt, { temperature: 0.1 });
        
        try {
          const personData = JSON.parse(analysis);
          
          if (personData.is_person && personData.is_relevant && personData.confidence > 0.7) {
            // Agregar dinámicamente a los patrones de detección
            await this.addLearnedPerson(unknownName, personData);
            
            // Usar twitter_username si está disponible, sino usar search_terms
            const finalSearchTerm = personData.twitter_username || personData.search_terms[0] || unknownName;
            
            console.log(`✅ ML Discovery: "${unknownName}" agregado al sistema`);
            console.log(`🐦 Twitter username encontrado: ${personData.twitter_username || 'No encontrado'}`);
            
            return {
              discovered: true,
              data: personData,
              searchTerm: finalSearchTerm
            };
          }
        } catch (parseError) {
          console.error('❌ Error parsing ML analysis:', parseError);
        }
      }
      
      return { discovered: false };
      
    } catch (error) {
      console.error('❌ Error en ML discovery:', error);
      return { discovered: false };
    }
  }

  async addLearnedPerson(name, personData) {
    try {
      // Usar twitter_username si está disponible, sino usar search_terms
      const finalSearchTerm = personData.twitter_username || personData.search_terms[0] || name;
      
      // Crear patrón dinámico para esta persona
      const newPattern = {
        pattern: new RegExp(`(tweets?\\s+del?\\s+)?${name.replace(/\s+/g, '\\s+')}`, 'i'),
        entity: personData.description || name,
        searchTerm: finalSearchTerm,
        twitter_username: personData.twitter_username || null,
        category: personData.category,
        confidence: personData.confidence,
        learned_at: new Date().toISOString(),
        source: 'ml_discovery'
      };

      // Agregar al array de patrones (simulado - en producción guardar en DB)
      if (!this.learnedPersons) {
        this.learnedPersons = [];
      }
      
      this.learnedPersons.push(newPattern);
      
      // Opcional: Guardar en base de datos para persistencia
      console.log(`📚 Persona aprendida: ${name} (${personData.category})`);
      
    } catch (error) {
      console.error('❌ Error guardando persona aprendida:', error);
    }
  }

  // NUEVA FUNCIÓN AUXILIAR: Agregar tareas de Robert para datos personales
  addRobertTasksForPersonalData(plan, msg, userMessage) {
    if (msg.includes('proyecto')) {
      plan.robertTasks.push({
        id: 'user_projects_query',
        tool: 'user_projects',
        type: 'projects',
        collection: 'user_projects',
        description: 'Consulta de proyectos del usuario',
        originalQuery: userMessage,
        attempts: 0,
        args: { limit: 10 }
      });
    }
    
    if (msg.includes('document') || msg.includes('archivo') || msg.includes('codex')) {
      plan.robertTasks.push({
        id: 'user_codex_query',
        tool: 'user_codex',
        type: 'documents',
        collection: 'user_codex',
        description: 'Consulta de documentos del usuario',
        originalQuery: userMessage,
        attempts: 0,
        args: { limit: 10 }
      });
    }
  }
}

module.exports = new AgentesService();
module.exports.LauraAgent = LauraAgent;
module.exports.RobertAgent = RobertAgent; 