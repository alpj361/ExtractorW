/**
 * Streamlined Vizta Agent - Unified AI Assistant
 * Integrates all social media analysis, user data management, and AI reasoning capabilities
 * Eliminates separate Laura/Robert agents for faster, more consistent responses
 */

const mcpService = require('../../mcp');
const geminiService = require('../../gemini');
const { LauraMemoryClient } = require('../laura/memoryClient');
const ViztaOpenPipeIntegration = require('./openPipeIntegration');

class StreamlinedViztaAgent {
  constructor() {
    this.name = 'Vizta';
    this.version = '2.0-streamlined';

    // Memory integration (from Laura)
    this.memoryClient = new LauraMemoryClient({
      baseURL: process.env.LAURA_MEMORY_URL || 'http://localhost:5001',
      enabled: (process.env.LAURA_MEMORY_ENABLED || 'true').toLowerCase() === 'true'
    });

    // OpenPipe integration for advanced reasoning
    this.openPipeIntegration = new ViztaOpenPipeIntegration(this);

    // All available tools (integrated from Laura and Robert)
    this.availableTools = {
      // Social Media Analysis Tools (from Laura)
      'nitter_context': this.executeNitterContext.bind(this),
      'nitter_profile': this.executeNitterProfile.bind(this),
      'perplexity_search': this.executePerplexitySearch.bind(this),
      'resolve_twitter_handle': this.executeResolveHandle.bind(this),
      'latest_trends': this.executeLatestTrends.bind(this),

      // User Data Management Tools (from Robert)
      'user_projects': this.executeUserProjects.bind(this),
      'user_codex': this.executeUserCodex.bind(this),
      'project_decisions': this.executeProjectDecisions.bind(this)
    };

    // AI-powered analysis capabilities (replacing heuristics)
    this.analysisCapabilities = {
      sentiment: this.analyzeSentiment.bind(this),
      entities: this.extractEntities.bind(this),
      political: this.analyzePoliticalContext.bind(this),
      trends: this.detectTrends.bind(this),
      relevance: this.assessRelevance.bind(this)
    };

    // State management
    this.activeConversations = new Map();
    this.processingCache = new Map();

    console.log(`[VIZTA] 🚀 Streamlined Vizta Agent v${this.version} initialized`);
    console.log(`[VIZTA] 🧠 Memory enabled: ${this.memoryClient.enabled}`);
    console.log(`[VIZTA] 🔧 Available tools: ${Object.keys(this.availableTools).length}`);
  }

  /**
   * Main entry point for processing user queries
   * Uses AI-based intent classification instead of heuristics
   */
  async processUserQuery(userMessage, user, sessionId = null) {
    const conversationId = sessionId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    console.log(`[VIZTA] 🎯 Processing query: "${userMessage}"`);

    try {
      // AI-based intent classification (no heuristics)
      const intentAnalysis = await this.classifyIntentWithAI(userMessage, user);
      console.log(`[VIZTA] 🧠 AI Intent: ${intentAnalysis.intent} (confidence: ${intentAnalysis.confidence})`);

      let response;

      // Handle conversational queries directly
      if (intentAnalysis.isConversational) {
        response = await this.handleConversationalQuery(userMessage, intentAnalysis);
      } else {
        // Handle task-oriented queries with tools
        response = await this.handleTaskQuery(userMessage, user, intentAnalysis);
      }

      // Format unified response
      const formattedResponse = this.formatUnifiedResponse(response, {
        intent: intentAnalysis.intent,
        processingTime: Date.now() - startTime,
        conversationId
      });

      console.log(`[VIZTA] ✅ Query processed in ${Date.now() - startTime}ms`);

      return {
        conversationId,
        response: formattedResponse,
        metadata: {
          intent: intentAnalysis.intent,
          confidence: intentAnalysis.confidence,
          processingTime: Date.now() - startTime,
          toolsUsed: response.toolsUsed || [],
          version: this.version
        }
      };

    } catch (error) {
      console.error(`[VIZTA] ❌ Error processing query:`, error);
      return this.handleError(error, conversationId);
    }
  }

  /**
   * AI-based intent classification (replacing heuristic routing)
   */
  async classifyIntentWithAI(userMessage, user) {
    try {
      // Use OpenPipe if available for intent classification
      if (this.openPipeIntegration.isAvailable()) {
        const openPipeResult = await this.openPipeIntegration.classifyIntent(userMessage, user);
        if (openPipeResult.success) {
          return openPipeResult;
        }
      }

      // Fallback to Gemini for intent classification
      const prompt = `
        Analyze this user message and classify the intent:
        Message: "${userMessage}"

        Determine:
        1. Intent category (conversational, social_analysis, user_data, mixed, research)
        2. Required tools (from: nitter_context, nitter_profile, perplexity_search, resolve_twitter_handle, user_projects, user_codex, project_decisions)
        3. Is conversational (true/false)
        4. Confidence (0-1)
        5. Analysis focus (political, social, personal, general)

        Respond in JSON format:
        {
          "intent": "category",
          "requiredTools": ["tool1", "tool2"],
          "isConversational": boolean,
          "confidence": number,
          "focus": "area",
          "reasoning": "explanation"
        }
      `;

      const result = await geminiService.generateContent(prompt);
      const analysis = JSON.parse(result);

      return {
        intent: analysis.intent,
        requiredTools: analysis.requiredTools || [],
        isConversational: analysis.isConversational,
        confidence: analysis.confidence,
        focus: analysis.focus,
        reasoning: analysis.reasoning,
        method: 'ai_gemini'
      };

    } catch (error) {
      console.error(`[VIZTA] ⚠️ Intent classification error:`, error);

      // Simple fallback classification
      const isConversational = /^(hola|hi|hello|gracias|thank|ayuda|help)/.test(userMessage.toLowerCase());

      return {
        intent: isConversational ? 'conversational' : 'general_analysis',
        requiredTools: isConversational ? [] : ['perplexity_search'],
        isConversational,
        confidence: 0.7,
        focus: 'general',
        reasoning: 'Fallback classification',
        method: 'fallback'
      };
    }
  }

  /**
   * Handle conversational queries
   */
  async handleConversationalQuery(userMessage, intentAnalysis) {
    const conversationalResponses = {
      greeting: "¡Hola! Soy Vizta, tu asistente de análisis político y social. ¿En qué puedo ayudarte hoy?",
      help: "Puedo ayudarte con:\n• Análisis de redes sociales y tendencias\n• Búsqueda de información política\n• Gestión de tus proyectos y documentos\n• Investigación y contexto político",
      thanks: "¡De nada! Estoy aquí para ayudarte con cualquier análisis que necesites.",
      general: "Entiendo. ¿Podrías ser más específico sobre qué tipo de análisis o información necesitas?"
    };

    const responseType = this.determineConversationalType(userMessage);

    return {
      agent: 'Vizta',
      message: conversationalResponses[responseType] || conversationalResponses.general,
      type: 'conversational',
      intent: intentAnalysis.intent,
      toolsUsed: [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle task-oriented queries using appropriate tools
   */
  async handleTaskQuery(userMessage, user, intentAnalysis) {
    const toolsUsed = [];
    let results = [];

    try {
      // Execute required tools based on AI intent analysis
      for (const toolName of intentAnalysis.requiredTools) {
        if (this.availableTools[toolName]) {
          console.log(`[VIZTA] 🔧 Executing tool: ${toolName}`);

          const toolResult = await this.executeToolWithContext(
            toolName,
            userMessage,
            user,
            intentAnalysis
          );

          results.push(toolResult);
          toolsUsed.push(toolName);
        }
      }

      // If no specific tools were identified, use intelligent routing
      if (results.length === 0) {
        const defaultResult = await this.executeDefaultAnalysis(userMessage, user, intentAnalysis);
        results.push(defaultResult);
        toolsUsed.push('default_analysis');
      }

      // AI-powered synthesis of results
      const synthesizedResponse = await this.synthesizeResults(results, userMessage, intentAnalysis);

      return {
        agent: 'Vizta',
        message: synthesizedResponse,
        type: 'task_response',
        intent: intentAnalysis.intent,
        toolsUsed,
        results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[VIZTA] ❌ Task execution error:`, error);
      throw error;
    }
  }

  /**
   * Execute tool with enhanced context
   */
  async executeToolWithContext(toolName, userMessage, user, intentAnalysis) {
    const enhancedParams = await this.enhanceToolParameters(toolName, userMessage, intentAnalysis);

    switch (toolName) {
      case 'nitter_context':
        return await mcpService.executeTool('nitter_context', enhancedParams, user);

      case 'nitter_profile':
        return await mcpService.executeTool('nitter_profile', enhancedParams, user);

      case 'perplexity_search':
        return await mcpService.executeTool('perplexity_search', enhancedParams, user);

      case 'resolve_twitter_handle':
        return await mcpService.executeTool('resolve_twitter_handle', enhancedParams, user);

      case 'user_projects':
        return await mcpService.executeTool('user_projects', enhancedParams, user);

      case 'user_codex':
        return await mcpService.executeTool('user_codex', enhancedParams, user);

      case 'project_decisions':
        return await mcpService.executeTool('project_decisions', enhancedParams, user);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * AI-powered parameter enhancement for tools
   */
  async enhanceToolParameters(toolName, userMessage, intentAnalysis) {
    const baseParams = { q: userMessage };

    try {
      const enhancementPrompt = `
        Enhance parameters for tool "${toolName}" based on user message: "${userMessage}"
        Intent: ${intentAnalysis.intent}
        Focus: ${intentAnalysis.focus}

        For ${toolName}, determine optimal parameters:
        - Query refinement
        - Location context (default: Guatemala)
        - Filters and limits
        - Time constraints

        Return JSON with enhanced parameters.
      `;

      const enhancement = await geminiService.generateContent(enhancementPrompt);
      const enhancedParams = JSON.parse(enhancement);

      return { ...baseParams, ...enhancedParams };

    } catch (error) {
      console.log(`[VIZTA] ⚠️ Parameter enhancement failed, using base params`);
      return baseParams;
    }
  }

  /**
   * Default analysis when no specific tools are identified
   */
  async executeDefaultAnalysis(userMessage, user, intentAnalysis) {
    console.log(`[VIZTA] 🔄 Executing default analysis`);

    // Use perplexity search as default for general queries
    return await mcpService.executeTool('perplexity_search', {
      q: userMessage,
      location: 'Guatemala',
      focus: intentAnalysis.focus || 'general'
    }, user);
  }

  /**
   * AI-powered synthesis of multiple tool results
   */
  async synthesizeResults(results, userMessage, intentAnalysis) {
    if (results.length === 0) {
      return "No pude encontrar información relevante para tu consulta.";
    }

    if (results.length === 1) {
      return this.formatSingleResult(results[0]);
    }

    try {
      const synthesisPrompt = `
        Synthesize these results into a coherent response for the user query: "${userMessage}"
        Intent: ${intentAnalysis.intent}

        Results:
        ${results.map((r, i) => `${i+1}. ${JSON.stringify(r, null, 2)}`).join('\n\n')}

        Create a unified, informative response that:
        - Addresses the user's specific question
        - Integrates key findings from all sources
        - Uses clear, accessible language
        - Includes relevant data points
        - Maintains context about Guatemala/politics if relevant

        Format as markdown with appropriate sections and emphasis.
      `;

      const synthesizedResponse = await geminiService.generateContent(synthesisPrompt);
      return synthesizedResponse;

    } catch (error) {
      console.error(`[VIZTA] ❌ Synthesis error:`, error);
      return this.formatFallbackResponse(results);
    }
  }

  /**
   * Format single result response
   */
  formatSingleResult(result) {
    if (result.message) {
      return result.message;
    }

    if (result.analysis_result) {
      return result.analysis_result;
    }

    return "Información procesada correctamente.";
  }

  /**
   * Fallback response formatting
   */
  formatFallbackResponse(results) {
    return results.map((result, index) => {
      const title = `## Resultado ${index + 1}`;
      const content = result.message || result.analysis_result || JSON.stringify(result, null, 2);
      return `${title}\n\n${content}`;
    }).join('\n\n---\n\n');
  }

  /**
   * Unified response formatter
   */
  formatUnifiedResponse(response, metadata) {
    const baseResponse = {
      agent: 'Vizta',
      message: response.message || 'Procesamiento completado',
      type: response.type || 'chat_response',
      timestamp: new Date().toISOString()
    };

    // Add metadata if available
    if (metadata) {
      baseResponse.metadata = metadata;
    }

    // Add tool information if available
    if (response.toolsUsed && response.toolsUsed.length > 0) {
      baseResponse.toolsUsed = response.toolsUsed;
    }

    return baseResponse;
  }

  /**
   * Determine conversational response type
   */
  determineConversationalType(message) {
    const lowerMessage = message.toLowerCase();

    if (/^(hola|hi|hello|buenos días|buenas tardes)/.test(lowerMessage)) {
      return 'greeting';
    }

    if (/ayuda|help|qué puedes hacer|que puedes hacer/.test(lowerMessage)) {
      return 'help';
    }

    if (/gracias|thank you|thanks/.test(lowerMessage)) {
      return 'thanks';
    }

    return 'general';
  }

  /**
   * Error handler
   */
  handleError(error, conversationId) {
    return {
      conversationId,
      response: {
        agent: 'Vizta',
        message: 'Ocurrió un error procesando tu consulta. Por favor, intenta de nuevo.',
        type: 'error_response',
        timestamp: new Date().toISOString()
      },
      metadata: {
        error: error.message,
        version: this.version
      }
    };
  }

  // Analysis capabilities (integrated from Laura)
  async analyzeSentiment(text) {
    // AI-powered sentiment analysis
    const prompt = `Analyze sentiment of: "${text}". Return JSON with sentiment (positive/negative/neutral) and score (0-1).`;
    const result = await geminiService.generateContent(prompt);
    return JSON.parse(result);
  }

  async extractEntities(text) {
    // AI-powered entity extraction
    const prompt = `Extract entities (persons, organizations, locations) from: "${text}". Return JSON array.`;
    const result = await geminiService.generateContent(prompt);
    return JSON.parse(result);
  }

  async analyzePoliticalContext(text) {
    // AI-powered political context analysis
    const prompt = `Analyze political context of: "${text}" in Guatemala. Return JSON with context, relevance, and key topics.`;
    const result = await geminiService.generateContent(prompt);
    return JSON.parse(result);
  }

  async detectTrends(data) {
    // AI-powered trend detection
    const prompt = `Detect trends in data: ${JSON.stringify(data)}. Return JSON with trends and significance.`;
    const result = await geminiService.generateContent(prompt);
    return JSON.parse(result);
  }

  async assessRelevance(content, context) {
    // AI-powered relevance assessment
    const prompt = `Assess relevance of "${content}" to context "${context}". Return JSON with score (0-1) and reasoning.`;
    const result = await geminiService.generateContent(prompt);
    return JSON.parse(result);
  }

  // Direct tool execution methods (integrated from Laura and Robert)
  async executeNitterContext(params, user) {
    return await mcpService.executeTool('nitter_context', params, user);
  }

  async executeNitterProfile(params, user) {
    return await mcpService.executeTool('nitter_profile', params, user);
  }

  async executePerplexitySearch(params, user) {
    return await mcpService.executeTool('perplexity_search', params, user);
  }

  async executeResolveHandle(params, user) {
    return await mcpService.executeTool('resolve_twitter_handle', params, user);
  }

  async executeLatestTrends(params, user) {
    return await mcpService.executeTool('latest_trends', params, user);
  }

  async executeUserProjects(params, user) {
    return await mcpService.executeTool('user_projects', params, user);
  }

  async executeUserCodex(params, user) {
    return await mcpService.executeTool('user_codex', params, user);
  }

  async executeProjectDecisions(params, user) {
    return await mcpService.executeTool('project_decisions', params, user);
  }
}

module.exports = { ViztaAgent: StreamlinedViztaAgent };