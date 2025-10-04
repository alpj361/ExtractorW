/**
 * AI-Powered Vizta Chatbot v4.0
 * Full AI reasoning - No regex/heuristics fallbacks
 * Uses ReasoningLayer for deep contextual analysis
 */

const mcpService = require('../../mcp');
const { LauraMemoryClient } = require('../laura/memoryClient');
const { ReasoningLayer } = require('./reasoningLayer');

// Cargar políticas desde Supabase (pk_documents) - solo para contexto conversacional
let loadKnowledgeFns = null;
try {
  loadKnowledgeFns = require('../../supabaseData');
} catch (e) {
  console.warn('[VIZTA] ⚠️ No se pudo cargar supabaseData para knowledge:', e?.message);
}

// OpenAI client for AI operations
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class ViztaAgent {
  constructor() {
    this.name = 'Vizta';
    this.version = '4.0-full-ai-reasoning';

    // Memory integration - DISABLED TEMPORARILY
    // this.memoryClient = new LauraMemoryClient({
    //   baseURL: process.env.LAURA_MEMORY_URL || 'http://localhost:5001',
    //   enabled: (process.env.LAURA_MEMORY_ENABLED || 'true').toLowerCase() === 'true'
    // });

    // Initialize ReasoningLayer for deep contextual analysis - DISABLED TEMPORARILY
    // this.reasoningLayer = new ReasoningLayer(this);
    this.reasoningLayer = null;

    this.openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
    if (!this.openaiConfigured) {
      throw new Error('[VIZTA] ❌ OPENAI_API_KEY is required for v4.0');
    }

    // Available tools
    this.availableTools = [
      'nitter_context',
      'nitter_profile',
      'perplexity_search',
      'resolve_twitter_handle',
      'latest_trends',
      'user_projects',
      'user_codex',
      'project_decisions'
    ];

    console.log(`[VIZTA] 🧠 Full AI Reasoning v${this.version} initialized`);
    console.log(`[VIZTA] 🔧 Available tools: ${this.availableTools.length}`);
    console.log(`[VIZTA] 🎯 ReasoningLayer: DISABLED (temporarily)`);
  }

  /**
   * Main entry point - Smart AI reasoning pipeline with fast-track
   * PRE-STEP: Quick classification for simple interactions
   * STEP 0: ReasoningLayer (only for complex/political queries)
   * STEP 1: AI Intent Classification
   * STEP 2: Execute based on intent
   */
  async processUserQuery(userMessage, user, sessionId = null) {
    const conversationId = sessionId || `chat_${Date.now()}`;
    const startTime = Date.now();

    console.log(`[VIZTA] 🧠 Processing: "${userMessage}"`);

    try {
      // PRE-STEP: Skip ReasoningLayer (temporarily disabled)
      console.log('[VIZTA] ⚡ Fast-track to intent classification (ReasoningLayer disabled)');

      // STEP 1: AI-powered intent classification (no regex fallbacks)
      const intentAnalysis = await this.classifyIntentWithAI(userMessage);
      console.log(`[VIZTA] 🎯 AI detected: ${intentAnalysis.intent} (confidence: ${intentAnalysis.confidence}, method: ${intentAnalysis.method})`);

      // STEP 2: Execute based on AI-determined intent
      let response;

      switch (intentAnalysis.intent) {
        case 'conversation':
          response = await this.generateConversationalResponse(userMessage, intentAnalysis);
          break;

        case 'tool_needed':
          response = await this.executeToolsAndRespond(userMessage, user, intentAnalysis);
          break;

        case 'hybrid':
          response = await this.handleHybridResponse(userMessage, user, intentAnalysis);
          break;

        default:
          // AI will decide what to do - no hardcoded fallback
          response = await this.handleUnknownIntent(userMessage, user, intentAnalysis);
      }

      return this.formatResponse(response, conversationId, startTime, intentAnalysis.intent);

    } catch (error) {
      console.error(`[VIZTA] ❌ Error:`, error);
      return this.formatResponse(
        "Disculpa, tuve un problema procesando tu consulta. ¿Podrías intentar de nuevo?",
        conversationId,
        startTime,
        'error'
      );
    }
  }

  /**
   * Quick triage: Does this query need deep reasoning with political context?
   * Uses fast AI classification to avoid unnecessary ReasoningLayer overhead
   */
  async shouldUseReasoningLayer(userMessage) {
    try {
      // Ultra-fast prompt for quick classification
      const prompt = `Is "${userMessage}" about politics/government/politicians? Answer only: true/false`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 10  // Solo necesita true/false
      });

      const needsReasoning = response.choices[0].message.content.toLowerCase().includes('true');
      console.log(`[VIZTA] 🎯 Triage: ${needsReasoning ? 'COMPLEX (use ReasoningLayer)' : 'SIMPLE (fast-track)'}`);
      
      return needsReasoning;

    } catch (error) {
      console.warn(`[VIZTA] ⚠️ Triage failed, defaulting to fast-track:`, error.message);
      // Default to false - prefer fast responses over heavy reasoning
      return false;
    }
  }

  /**
   * AI-powered intent classification - NO REGEX FALLBACKS
   * Always uses AI to determine intent
   */
  async classifyIntentWithAI(userMessage) {
    if (!this.openaiConfigured) {
      throw new Error('[VIZTA] Cannot classify intent without OpenAI API key');
    }

    try {
      const prompt = `Analyze this user message and classify the intent with high precision:

Message: "${userMessage}"

Classify as one of:
- "conversation": Pure social interaction (greetings, thanks, how are you, casual chat, capability questions)
- "tool_needed": Requires external data/tools (search, analysis, specific information)
- "hybrid": Conversational + needs tools (e.g., "Hi, what's trending in Guatemala?")

Available tools you can suggest:
- nitter_context: Search and analyze Twitter/X posts by topic or hashtag
- nitter_profile: Get specific Twitter/X user profile and recent posts
- perplexity_search: Web search for current events and general information
- resolve_twitter_handle: Find Twitter handle for a person's name
- user_projects: Access user's personal projects
- user_codex: Search user's personal knowledge base and documents
- latest_trends: Get current trending topics
- project_decisions: Access project decision logs

Instructions:
1. Determine if the query needs external data or can be answered conversationally
2. If tools are needed, suggest the most relevant ones (1-3 tools max)
3. Explain your reasoning briefly
4. Be specific about which tools would help

Respond ONLY with valid JSON:
{
  "intent": "conversation|tool_needed|hybrid",
  "confidence": 0.95,
  "reasoning": "Brief explanation why this intent was chosen",
  "suggested_tools": ["tool1", "tool2"],
  "conversational_element": "greeting|thanks|question|help_request"
}`;

      const response = await openai.chat.completions.create({
        model: process.env.VIZTA_INTENT_MODEL || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 250
      });

      const content = response.choices[0].message.content.trim();
      const analysis = JSON.parse(content);

      return {
        intent: analysis.intent,
        confidence: analysis.confidence || 0.85,
        reasoning: analysis.reasoning,
        suggestedTools: analysis.suggested_tools || [],
        conversationalElement: analysis.conversational_element,
        method: 'openai'
      };

    } catch (error) {
      console.error(`[VIZTA] ❌ AI classification failed:`, error);
      throw new Error(`Intent classification failed: ${error.message}`);
    }
  }

  /**
   * Generate conversational response using AI - NO HARDCODED EXAMPLES
   */
  async generateConversationalResponse(userMessage, intentAnalysis) {
    const start = Date.now();

    if (!this.openaiConfigured) {
      throw new Error('[VIZTA] Cannot generate response without OpenAI API key');
    }

    try {
      const conversationType = intentAnalysis?.conversationalElement || 'interacción general';
      
      // Base system prompt
      let baseSystem = `Eres Vizta, un asistente conversacional experto en análisis político y social de Guatemala.

Personalidad:
- Profesional pero cercano y accesible
- Orientado a resultados y acción
- Transparente sobre tus capacidades y limitaciones
- Proactivo en ofrecer ayuda específica

Capacidades principales:
- Análisis de redes sociales (Twitter/X)
- Búsqueda y síntesis de información web
- Acceso a proyectos y documentos del usuario
- Contexto político guatemalteco actualizado

Instrucciones:
1. Responde de forma natural y conversacional
2. Sé conciso pero informativo (máximo 3 oraciones)
3. Si detectas que el usuario necesita herramientas, sugiere acciones específicas
4. Evita respuestas genéricas o repetitivas
5. Adapta tu tono al contexto de la conversación`;

      // Load policies if available for additional context
      if (loadKnowledgeFns && loadKnowledgeFns.getViztaPoliciesMd) {
        try {
          const pol = await loadKnowledgeFns.getViztaPoliciesMd();
          if (pol && typeof pol === 'string' && pol.trim().length > 0) {
            baseSystem += `\n\nContexto de políticas internas:\n${pol.substring(0, 3000)}`;
          }
        } catch {}
      }

      const userPrompt = `Mensaje del usuario: "${userMessage}"

Tipo de interacción detectada: ${conversationType}

Genera una respuesta natural y útil en español.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: baseSystem },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const messageContent = response?.choices?.[0]?.message?.content?.trim();

      if (!messageContent) {
        throw new Error('Empty response from OpenAI');
      }

      console.log(`[VIZTA] 🤖 Conversational response generated in ${Date.now() - start}ms`);
      return messageContent;

    } catch (error) {
      console.error(`[VIZTA] ❌ Conversation generation failed:`, error);
      throw new Error(`Failed to generate conversational response: ${error.message}`);
    }
  }

  /**
   * Execute tools and generate intelligent response - AI determines everything
   */
  async executeToolsAndRespond(userMessage, user, intentAnalysis) {
    const toolResults = [];

    // Execute AI-suggested tools
    if (intentAnalysis.suggestedTools && intentAnalysis.suggestedTools.length > 0) {
      for (const toolName of intentAnalysis.suggestedTools) {
        if (this.availableTools.includes(toolName)) {
          try {
            console.log(`[VIZTA] 🔧 Executing AI-suggested tool: ${toolName}`);
            const result = await this.executeSpecificTool(toolName, userMessage, user);
            if (result && result.success) {
              toolResults.push({ tool: toolName, result });
            }
          } catch (error) {
            console.log(`[VIZTA] ⚠️ Tool ${toolName} failed:`, error.message);
          }
        } else {
          console.warn(`[VIZTA] ⚠️ AI suggested unavailable tool: ${toolName}`);
        }
      }
    }

    // If AI didn't suggest tools or all failed, try fallback tool
    if (toolResults.length === 0) {
      console.log('[VIZTA] 💡 No tools executed successfully, trying fallback...');
      
      // Try latest_trends as fallback for general queries
      if (intentAnalysis.suggestedTools.includes('perplexity_search')) {
        try {
          console.log('[VIZTA] 🔧 Trying latest_trends as fallback...');
          const fallbackResult = await this.executeSpecificTool('latest_trends', userMessage, user);
          if (fallbackResult && fallbackResult.success) {
            toolResults.push({ tool: 'latest_trends', result: fallbackResult });
          }
        } catch (fallbackError) {
          console.log('[VIZTA] ⚠️ Fallback tool also failed:', fallbackError.message);
        }
      }
      
      // If still no results, throw error
      if (toolResults.length === 0) {
        throw new Error('No se pudieron ejecutar las herramientas sugeridas');
      }
    }

    // Generate intelligent response from tool results
    return await this.synthesizeToolResults(userMessage, toolResults);
  }

  /**
   * Handle hybrid requests (conversation + tools)
   */
  async handleHybridResponse(userMessage, user, intentAnalysis) {
    // Generate conversational greeting first
    const conversationalPart = await this.generateConversationalResponse(userMessage, intentAnalysis);

    // Execute tools for the information part
    const toolResponse = await this.executeToolsAndRespond(userMessage, user, intentAnalysis);

    // Combine naturally
    if (toolResponse && !toolResponse.includes("No pude encontrar")) {
      return `${conversationalPart}\n\n${toolResponse}`;
    }

    return conversationalPart;
  }

  /**
   * Handle unknown intent - let AI decide what to do
   */
  async handleUnknownIntent(userMessage, user, intentAnalysis) {
    console.log('[VIZTA] 🤔 Unknown intent - asking AI for guidance...');
    
    try {
      const prompt = `The user sent this message but the intent is unclear: "${userMessage}"

You are Vizta, an AI assistant with these capabilities:
- Twitter/X analysis (nitter_context, nitter_profile)
- Web search (perplexity_search)
- User's personal projects (user_projects)
- User's knowledge base (user_codex)
- Trending topics (latest_trends)

Decide:
1. Should you respond conversationally or use tools?
2. If tools are needed, which ones and why?
3. If conversational, what should you say?

Respond in JSON:
{
  "approach": "conversational|tool_needed",
  "suggested_tools": ["tool1", "tool2"],
  "conversational_response": "Your response if conversational",
  "reasoning": "Brief explanation"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 300
      });

      const decision = JSON.parse(response.choices[0].message.content);

      if (decision.approach === 'conversational') {
        return decision.conversational_response;
      } else {
        // Execute suggested tools
        intentAnalysis.suggestedTools = decision.suggested_tools;
        return await this.executeToolsAndRespond(userMessage, user, intentAnalysis);
      }
    } catch (error) {
      console.error('[VIZTA] ❌ Unknown intent handling failed:', error);
      throw new Error(`Failed to handle unknown intent: ${error.message}`);
    }
  }

  /**
   * Execute specific tool with AI-determined parameters
   */
  async executeSpecificTool(toolName, userMessage, user) {
    const cleanedMessage = typeof userMessage === 'string' ? userMessage.trim() : '';

    if (!cleanedMessage) {
      throw new Error(`Invalid user message for executing ${toolName}`);
    }

    const previewMessage = cleanedMessage.length > 120 ? `${cleanedMessage.slice(0, 117)}...` : cleanedMessage;
    console.log(`[VIZTA] 🔍 Preparing tool '${toolName}' with message="${previewMessage}"`);

    // Extract parameters using AI for context-aware execution
    const params = await this.extractToolParameters(toolName, userMessage);

    const logAndExecute = async (name, finalParams) => {
      const serialized = JSON.stringify(finalParams);
      const preview = serialized.length > 160 ? `${serialized.slice(0, 157)}...` : serialized;
      console.log(`[VIZTA] 🔧 Executing ${name} with AI-determined params: ${preview}`);
      return await mcpService.executeTool(name, finalParams, user);
    };

    switch (toolName) {
      case 'nitter_context':
        return await logAndExecute('nitter_context', {
          q: params.query || cleanedMessage,
          location: params.location || 'guatemala',
          limit: params.limit || 15
        });

      case 'perplexity_search':
        return await logAndExecute('perplexity_search', {
          query: params.query || cleanedMessage,
          location: params.location || 'Guatemala',
          focus: params.focus || 'general'
        });

      case 'latest_trends':
        return await logAndExecute('latest_trends', {
          location: params.location || 'guatemala',
          limit: params.limit || 10
        });

      case 'user_projects':
        return await logAndExecute('user_projects', {});

      case 'user_codex':
        return await logAndExecute('user_codex', {
          query: params.query || cleanedMessage
        });

      case 'nitter_profile':
        return await logAndExecute('nitter_profile', {
          username: params.username || cleanedMessage
        });

      case 'resolve_twitter_handle':
        return await logAndExecute('resolve_twitter_handle', {
          name: params.name || cleanedMessage
        });

      case 'project_decisions':
        return await logAndExecute('project_decisions', {
          project_id: params.project_id
        });

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Extract tool parameters using AI understanding of context
   */
  async extractToolParameters(toolName, userMessage) {
    try {
      const prompt = `Extract parameters for the tool "${toolName}" from this user message: "${userMessage}"

Tool parameter requirements:
- nitter_context: query (topic/hashtag), location (country), limit (number)
- perplexity_search: query, location, focus (politica|economia|noticias|general)
- nitter_profile: username (Twitter handle without @)
- resolve_twitter_handle: name (person's full name)
- user_codex: query (search terms)
- latest_trends: location, limit

Return JSON with relevant parameters only. Use "general" for focus if unclear. Default location is "Guatemala" for Central American context.

Example: {"query": "extracted topic", "focus": "politica", "location": "Guatemala"}`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150
      });

      const params = JSON.parse(response.choices[0].message.content);
      console.log(`[VIZTA] 🎯 AI extracted parameters for ${toolName}:`, params);
      return params;

    } catch (error) {
      console.warn(`[VIZTA] ⚠️ Parameter extraction failed for ${toolName}, using defaults:`, error.message);
      // Return minimal params on failure
      return { query: userMessage, location: 'Guatemala', focus: 'general' };
    }
  }

  /**
   * AI-powered synthesis of tool results
   */
  async synthesizeToolResults(userMessage, toolResults) {
    try {
      const sanitizedResults = toolResults.map(tr => {
        const searchResults = Array.isArray(tr.result?.search_results)
          ? tr.result.search_results.slice(0, 5).map(result => ({
              title: result.title || null,
              url: result.url || null,
              snippet: result.snippet || null,
              date: result.date || null
            }))
          : [];

        return {
          tool: tr.tool,
          summary: tr.result?.analysis_result || tr.result?.formatted_response || tr.result?.formatted_context || tr.result?.message || null,
          search_results: searchResults,
          metadata: tr.result?.metadata || null,
          raw: tr.result?.web_search_result || tr.result?.data || null
        };
      });

      const systemMessage = `Eres Vizta, un analista imparcial que genera respuestas en español basadas en resultados de herramientas. Debes sintetizar la información con rigor, neutralidad y transparencia, citando siempre las fuentes disponibles.`;
      const userPrompt = `El usuario preguntó: "${userMessage}".

Recibiste los siguientes datos en formato JSON:
${JSON.stringify(sanitizedResults, null, 2)}

Instrucciones para la respuesta final:
1. Escribe un resumen inicial (1-2 párrafos) objetivo, sin tomar partido ni añadir opiniones.
2. Incluye una sección **Puntos clave** con viñetas solo si hay datos relevantes.
3. Cierra con una sección **Fuentes** listando cada URL disponible en los datos. Usa el formato "- [Título](URL)"; si falta el título emplea la URL como texto. No inventes fuentes.
4. Si varias herramientas aportan información, integra sus hallazgos en una narrativa coherente.
5. Indica cuando la información es limitada o incierta.
6. Evita repetir texto o usar frases genéricas.

Responde únicamente en Markdown siguiendo la estructura indicada.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 600
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.log(`[VIZTA] ⚠️ AI synthesis failed:`, error.message);

      // Fallback: return the best result directly
      const bestResult = toolResults[0];
      return bestResult.result.analysis_result || bestResult.result.message || "Información procesada correctamente.";
    }
  }

  /**
   * Generate alternative response when tools fail or aren't available
   * Uses AI to provide helpful guidance with fallback strategies
   */
  async generateAlternativeResponse(userMessage, intentAnalysis) {
    console.log('[VIZTA] 🔄 Generating AI alternative response...');
    
    try {
      const prompt = `El usuario preguntó: "${userMessage}"

Las herramientas fallaron o no están disponibles (probablemente API de Perplexity).

Contexto del análisis:
- Intención: ${intentAnalysis.intent}
- Herramientas sugeridas: ${intentAnalysis.suggestedTools?.join(', ') || 'ninguna'}

Como Vizta, proporciona una respuesta útil que:
1. Reconoce lo que el usuario necesita
2. Explica brevemente el problema técnico (sin entrar en detalles)
3. Sugiere alternativas específicas que SÍ puedes hacer:
   - Análisis de Twitter/X (nitter_context, nitter_profile)
   - Consultar proyectos del usuario (user_projects)
   - Buscar en documentos personales (user_codex)
   - Ver tendencias actuales (latest_trends)
4. Ofrece próximos pasos concretos

Responde en español, sé conversacional y proactivo.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('[VIZTA] ❌ Alternative response generation failed:', error);
      return `No pude acceder a la información web en este momento, pero puedo ayudarte con:

🐦 **Análisis de Twitter/X**: Buscar tweets, perfiles, tendencias
📋 **Tus proyectos**: Revisar estado y información
📚 **Tu codex**: Buscar en tus documentos personales
📊 **Tendencias**: Ver temas recientes

¿Qué te gustaría hacer?`;
    }
  }

  /**
   * Format unified response
   */
  formatResponse(message, conversationId, startTime, type) {
    return {
      conversationId,
      response: {
        agent: 'Vizta',
        message: message,
        type: 'chat_response',
        timestamp: new Date().toISOString()
      },
      metadata: {
        processingTime: Date.now() - startTime,
        responseType: type,
        version: this.version
      }
    };
  }
}

module.exports = { ViztaAgent };
