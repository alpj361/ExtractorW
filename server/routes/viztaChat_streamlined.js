const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const memoriesService = require('../services/memories');
const recentScrapesService = require('../services/recentScrapes');

// Import the new streamlined Vizta agent
const { ViztaAgent } = require('../services/agents/vizta');

// Initialize streamlined Vizta agent
const viztaAgent = new ViztaAgent();

// ===================================================================
// STREAMLINED VIZTA CHAT ROUTES
// Simplified endpoints using the new unified Vizta agent
// ===================================================================

/**
 * POST /api/vizta-chat/query
 * Main endpoint for Vizta Chat queries - streamlined version
 */
router.post('/query', verifyUserAccess, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es requerido'
      });
    }

    console.log(`🤖 Nueva consulta Vizta Chat (streamlined) de usuario ${userId}: "${message}"`);

    const startTime = Date.now();
    const chatSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Save user message to memories
    await memoriesService.saveMessage({
      sessionId: chatSessionId,
      userId: userId,
      role: 'user',
      content: message,
      messageType: 'message',
      modelUsed: 'vizta-streamlined',
      metadata: { timestamp: new Date().toISOString() }
    });

    // Process query with streamlined Vizta agent
    console.log('🚀 Processing with streamlined Vizta agent...');
    const result = await viztaAgent.processUserQuery(message, req.user, chatSessionId);

    // Save assistant response to memories
    await memoriesService.saveMessage({
      sessionId: chatSessionId,
      userId: userId,
      role: 'assistant',
      content: result.response.message || 'Response processed',
      messageType: 'response',
      modelUsed: 'vizta-streamlined',
      metadata: {
        agent: result.response.agent,
        type: result.response.type,
        intent: result.metadata?.intent,
        confidence: result.metadata?.confidence,
        processingTime: result.metadata?.processingTime,
        toolsUsed: result.metadata?.toolsUsed,
        version: result.metadata?.version
      }
    });

    // Format response for frontend
    const responseData = {
      success: true,
      response: result.response,
      conversationId: result.conversationId,
      sessionId: result.conversationId,
      requestId: `req_${Date.now()}`,
      metadata: {
        ...result.metadata,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        streamlined: true
      }
    };

    console.log(`✅ Query processed in ${Date.now() - startTime}ms with streamlined agent`);

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error in streamlined Vizta Chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando consulta en Vizta Chat',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
      details: error.message,
      streamlined: true
    });
  }
});

/**
 * GET /api/vizta-chat/health
 * Health check endpoint for the streamlined Vizta service
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      service: 'Vizta Chat Streamlined',
      version: viztaAgent.version,
      timestamp: new Date().toISOString(),
      availableTools: Object.keys(viztaAgent.availableTools).length,
      memoryEnabled: viztaAgent.memoryClient.enabled
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/tools
 * Get available tools information
 */
router.get('/tools', verifyUserAccess, async (req, res) => {
  try {
    const tools = {
      socialMediaTools: [
        'nitter_context', 'nitter_profile', 'perplexity_search',
        'resolve_twitter_handle', 'latest_trends'
      ],
      userDataTools: [
        'user_projects', 'user_codex', 'project_decisions'
      ],
      analysisCapabilities: [
        'sentiment', 'entities', 'political', 'trends', 'relevance'
      ]
    };

    res.json({
      success: true,
      tools,
      totalTools: Object.keys(viztaAgent.availableTools).length,
      version: viztaAgent.version,
      streamlined: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vizta-chat/test
 * Test endpoint for the streamlined implementation
 */
router.post('/test', verifyUserAccess, async (req, res) => {
  try {
    const testMessage = "Hola Vizta, ¿cómo estás?";
    const testResult = await viztaAgent.processUserQuery(testMessage, req.user);

    res.json({
      success: true,
      message: 'Streamlined Vizta agent is working correctly',
      testResult,
      version: viztaAgent.version,
      streamlined: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Streamlined Vizta agent test failed',
      error: error.message
    });
  }
});

module.exports = router;