/**
 * AI-Powered Vizta Chatbot
 * Uses AI reasoning to intelligently decide when to chat vs when to use tools
 */

const mcpService = require('../../mcp');
const { LauraMemoryClient } = require('../laura/memoryClient');

// Simple OpenAI client for intent classification
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class ViztaAgent {
  constructor() {
    this.name = 'Vizta';
    this.version = '3.0-ai-powered';

    // Memory integration
    this.memoryClient = new LauraMemoryClient({
      baseURL: process.env.LAURA_MEMORY_URL || 'http://localhost:5001',
      enabled: (process.env.LAURA_MEMORY_ENABLED || 'true').toLowerCase() === 'true'
    });

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

    console.log(`[VIZTA] 🧠 AI-Powered Chatbot v${this.version} initialized`);
    console.log(`[VIZTA] 🔧 Available tools: ${this.availableTools.length}`);
  }

  /**
   * Main entry point - AI decides whether to chat or use tools
   */
  async processUserQuery(userMessage, user, sessionId = null) {
    const conversationId = sessionId || `chat_${Date.now()}`;
    const startTime = Date.now();

    console.log(`[VIZTA] 🧠 Processing with AI: "${userMessage}"`);

    try {
      // AI-powered intent classification
      const intentAnalysis = await this.classifyIntentWithAI(userMessage);
      console.log(`[VIZTA] 🎯 AI detected: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);

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
          response = await this.handleFallback(userMessage, user);
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
   * AI-powered intent classification
   */
  async classifyIntentWithAI(userMessage) {
    try {
      const prompt = `Analyze this user message and classify the intent:

Message: "${userMessage}"

Classify as one of:
- "conversation": Pure social interaction (greetings, thanks, how are you, casual chat)
- "tool_needed": Requires external data/tools (search, analysis, specific information)
- "hybrid": Conversational + needs tools (e.g., "Hi, what's trending in Guatemala?")

Consider these available tools:
- nitter_context: Twitter/social media analysis
- perplexity_search: Web search and research
- user_projects: User's personal projects
- user_codex: User's knowledge base
- latest_trends: Current trending topics

Respond in JSON format:
{
  "intent": "conversation|tool_needed|hybrid",
  "confidence": 0.95,
  "reasoning": "Brief explanation why",
  "suggested_tools": ["tool1", "tool2"],
  "conversational_element": "greeting|thanks|question" // if applicable
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      return {
        intent: analysis.intent,
        confidence: analysis.confidence || 0.8,
        reasoning: analysis.reasoning,
        suggestedTools: analysis.suggested_tools || [],
        conversationalElement: analysis.conversational_element,
        method: 'openai'
      };

    } catch (error) {
      console.log(`[VIZTA] ⚠️ AI classification failed:`, error.message);

      // Simple fallback logic
      const lowerMessage = userMessage.toLowerCase();

      if (/^(hola|hi|hello|gracias|thank|cómo estás|como estas)/.test(lowerMessage)) {
        return {
          intent: 'conversation',
          confidence: 0.7,
          reasoning: 'Fallback pattern matching',
          suggestedTools: [],
          method: 'fallback'
        };
      }

      return {
        intent: 'tool_needed',
        confidence: 0.6,
        reasoning: 'Fallback default to tools',
        suggestedTools: ['perplexity_search'],
        method: 'fallback'
      };
    }
  }

  /**
   * Generate conversational response using AI
   */
  async generateConversationalResponse(userMessage, intentAnalysis) {
    try {
      const prompt = `Generate a natural, friendly response to this conversational message:

User: "${userMessage}"

Context: This is ${intentAnalysis.conversationalElement || 'general conversation'}.

Guidelines:
- Be warm and helpful
- Keep it concise (1-2 sentences)
- Mention I'm Vizta, your political and social analysis assistant
- If it's a greeting, offer to help
- If it's thanks, acknowledge and offer continued assistance
- If it's "how are you", be positive and redirect to how I can help

Respond in Spanish naturally:`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 150
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.log(`[VIZTA] ⚠️ AI conversation generation failed:`, error.message);

      // Fallback responses
      const lowerMessage = userMessage.toLowerCase();

      if (/hola|hi|hello/.test(lowerMessage)) {
        return "¡Hola! Soy Vizta, tu asistente de análisis político y social. ¿En qué puedo ayudarte?";
      }

      if (/gracias|thank/.test(lowerMessage)) {
        return "¡De nada! Estoy aquí para ayudarte con lo que necesites.";
      }

      if (/cómo estás|como estas|how are you/.test(lowerMessage)) {
        return "¡Muy bien! ¿En qué puedo ayudarte hoy?";
      }

      return "¡Hola! Soy Vizta, tu asistente. ¿En qué puedo ayudarte?";
    }
  }

  /**
   * Execute tools and generate intelligent response
   */
  async executeToolsAndRespond(userMessage, user, intentAnalysis) {
    const toolResults = [];

    // Execute AI-suggested tools
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
      }
    }

    // If AI didn't suggest specific tools, use smart selection
    if (toolResults.length === 0) {
      const fallbackTool = this.selectFallbackTool(userMessage);
      try {
        console.log(`[VIZTA] 🔧 Using fallback tool: ${fallbackTool}`);
        const result = await this.executeSpecificTool(fallbackTool, userMessage, user);
        if (result && result.success) {
          toolResults.push({ tool: fallbackTool, result });
        }
      } catch (error) {
        console.log(`[VIZTA] ⚠️ Fallback tool failed:`, error.message);
      }
    }

    // Generate intelligent response from tool results
    if (toolResults.length > 0) {
      return await this.synthesizeToolResults(userMessage, toolResults);
    }

    return "No pude encontrar información específica sobre eso. ¿Podrías reformular tu pregunta?";
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
   * Fallback handler
   */
  async handleFallback(userMessage, user) {
    try {
      const result = await mcpService.executeTool('perplexity_search', {
        q: userMessage,
        location: 'Guatemala',
        focus: 'general'
      }, user);

      if (result.success && result.analysis_result) {
        return result.analysis_result;
      }
    } catch (error) {
      console.log(`[VIZTA] ⚠️ Fallback search failed:`, error.message);
    }

    return "No pude procesar tu consulta en este momento. ¿Podrías intentar de nuevo?";
  }

  /**
   * Execute specific tool with smart parameters
   */
  async executeSpecificTool(toolName, userMessage, user) {
    const baseParams = { q: userMessage };

    switch (toolName) {
      case 'nitter_context':
        return await mcpService.executeTool('nitter_context', {
          ...baseParams,
          location: 'guatemala',
          limit: 15
        }, user);

      case 'perplexity_search':
        return await mcpService.executeTool('perplexity_search', {
          ...baseParams,
          location: 'Guatemala',
          focus: this.detectFocus(userMessage)
        }, user);

      case 'latest_trends':
        return await mcpService.executeTool('latest_trends', {
          ...baseParams,
          location: 'guatemala',
          limit: 10
        }, user);

      case 'user_projects':
        return await mcpService.executeTool('user_projects', {}, user);

      case 'user_codex':
        return await mcpService.executeTool('user_codex', {
          searchQuery: userMessage
        }, user);

      case 'nitter_profile':
        return await mcpService.executeTool('nitter_profile', baseParams, user);

      case 'resolve_twitter_handle':
        return await mcpService.executeTool('resolve_twitter_handle', baseParams, user);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Select fallback tool based on message content
   */
  selectFallbackTool(message) {
    const lowerMessage = message.toLowerCase();

    if (/twitter|tweet|social|tendencia|viral|hashtag/.test(lowerMessage)) {
      return 'nitter_context';
    }

    if (/proyecto|mis|codex/.test(lowerMessage)) {
      return 'user_projects';
    }

    return 'perplexity_search'; // Default fallback
  }

  /**
   * AI-powered synthesis of tool results
   */
  async synthesizeToolResults(userMessage, toolResults) {
    try {
      const resultsText = toolResults.map(tr =>
        `Tool: ${tr.tool}\nResult: ${tr.result.analysis_result || tr.result.message || JSON.stringify(tr.result.data)}`
      ).join('\n\n');

      const prompt = `Synthesize these tool results into a natural, helpful response for the user's query: "${userMessage}"

Tool Results:
${resultsText}

Guidelines:
- Create a cohesive, informative response in Spanish
- Focus on the most relevant information
- Be conversational and helpful
- Include specific data points when useful
- Keep it concise but comprehensive

Response:`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.log(`[VIZTA] ⚠️ AI synthesis failed:`, error.message);

      // Fallback: return the best result directly
      const bestResult = toolResults[0];
      return bestResult.result.analysis_result || bestResult.result.message || "Información procesada correctamente.";
    }
  }

  detectFocus(message) {
    const lowerMessage = message.toLowerCase();

    if (/politic|gobierno|congreso|elecciones|diputado/.test(lowerMessage)) {
      return 'politica';
    }
    if (/noticia|actualidad|eventos/.test(lowerMessage)) {
      return 'noticias';
    }
    if (/economia|economico/.test(lowerMessage)) {
      return 'economia';
    }

    return 'general';
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