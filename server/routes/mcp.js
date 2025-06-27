const express = require('express');
const router = express.Router();
const mcpService = require('../services/mcp');
const { requireAuth } = require('../middlewares/auth');

// ===================================================================
// MCP SERVER ROUTES - Micro Command Processor
// Orquestador de herramientas para agentes IA
// ===================================================================

/**
 * GET /api/mcp/tools
 * Lista todas las herramientas disponibles en el MCP Server
 */
router.get('/tools', requireAuth, async (req, res) => {
  try {
    const tools = await mcpService.listAvailableTools();
    
    res.json({
      success: true,
      message: 'Herramientas MCP disponibles',
      tools: tools,
      total_tools: tools.length
    });
  } catch (error) {
    console.error('Error listando herramientas MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/mcp/tools/:tool_name
 * Obtiene información detallada de una herramienta específica
 */
router.get('/tools/:tool_name', requireAuth, async (req, res) => {
  try {
    const { tool_name } = req.params;
    const toolInfo = await mcpService.getToolInfo(tool_name);
    
    if (!toolInfo) {
      return res.status(404).json({
        success: false,
        message: `Herramienta '${tool_name}' no encontrada`
      });
    }
    
    res.json({
      success: true,
      message: `Información de herramienta '${tool_name}'`,
      tool: toolInfo
    });
  } catch (error) {
    console.error('Error obteniendo info de herramienta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/mcp/execute
 * Ejecutor universal de herramientas MCP
 */
router.post('/execute', requireAuth, async (req, res) => {
  try {
    const { tool_name, parameters = {} } = req.body;
    
    if (!tool_name) {
      return res.status(400).json({
        success: false,
        message: 'El campo tool_name es requerido'
      });
    }
    
    const result = await mcpService.executeTool(tool_name, parameters, req.user);
    
    res.json({
      success: true,
      message: `Herramienta '${tool_name}' ejecutada exitosamente`,
      tool_name: tool_name,
      parameters: parameters,
      result: result,
      execution_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error ejecutando herramienta MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando herramienta',
      error: error.message
    });
  }
});

/**
 * POST /api/mcp/nitter_context
 * Endpoint directo para herramienta nitter_context
 */
router.post('/nitter_context', requireAuth, async (req, res) => {
  try {
    const { q, location = 'guatemala', limit = 10 } = req.body;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro q (término de búsqueda) es requerido'
      });
    }
    
    const result = await mcpService.executeTool('nitter_context', { q, location, limit }, req.user);
    
    res.json({
      success: true,
      message: 'Contexto de nitter obtenido exitosamente',
      query: q,
      location: location,
      limit: limit,
      result: result,
      execution_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error ejecutando nitter_context:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo contexto de nitter',
      error: error.message
    });
  }
});

/**
 * GET /api/mcp/status
 * Estado del MCP Server
 */
router.get('/status', async (req, res) => {
  try {
    const status = await mcpService.getServerStatus();
    
    res.json({
      success: true,
      message: 'MCP Server operativo',
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error obteniendo estado MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/mcp/stream
 * Endpoint SSE (Server-Sent Events) para N8N SSE Trigger
 * Proporciona streaming en tiempo real de eventos del MCP Server
 * NOTA: Sin autenticación para pruebas
 */
router.get('/stream', async (req, res) => {
  try {
    // Configurar headers para SSE según estándar
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    // Función para enviar eventos SSE
    const sendSSEEvent = (eventType, data, id = null) => {
      if (id) {
        res.write(`id: ${id}\n`);
      }
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Evento inicial de conexión
    sendSSEEvent('connected', {
      message: 'Conectado al MCP Server SSE Stream',
      server: 'MCP Server',
      timestamp: new Date().toISOString(),
      user_id: 'test-user',
      auth_mode: 'disabled'
    }, Date.now());

    // Heartbeat cada 30 segundos para mantener conexión
    const heartbeatInterval = setInterval(() => {
      sendSSEEvent('heartbeat', {
        message: 'MCP Server activo',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }, Date.now());
    }, 30000);

    // Estado del servidor cada 60 segundos
    const statusInterval = setInterval(async () => {
      try {
        const status = await mcpService.getServerStatus();
        sendSSEEvent('status', {
          message: 'Estado del MCP Server',
          status: status,
          timestamp: new Date().toISOString()
        }, Date.now());
      } catch (error) {
        sendSSEEvent('error', {
          message: 'Error obteniendo estado del servidor',
          error: error.message,
          timestamp: new Date().toISOString()
        }, Date.now());
      }
    }, 60000);

    // Simular eventos de herramientas ejecutándose (para demo)
    const toolEventInterval = setInterval(() => {
      const tools = ['nitter_context'];
      const randomTool = tools[Math.floor(Math.random() * tools.length)];
      
      sendSSEEvent('tool_available', {
        message: `Herramienta ${randomTool} disponible`,
        tool_name: randomTool,
        timestamp: new Date().toISOString(),
        category: 'social_media'
      }, Date.now());
    }, 45000);

    // Limpiar intervalos cuando cliente se desconecta
    req.on('close', () => {
      console.log('Cliente SSE desconectado');
      clearInterval(heartbeatInterval);
      clearInterval(statusInterval);
      clearInterval(toolEventInterval);
    });

    req.on('end', () => {
      console.log('Stream SSE terminado');
      clearInterval(heartbeatInterval);
      clearInterval(statusInterval);
      clearInterval(toolEventInterval);
    });

  } catch (error) {
    console.error('Error en SSE endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error iniciando SSE stream',
      error: error.message
    });
  }
});

/**
 * GET /api/mcp/test-stream
 * Endpoint SSE de prueba sin autenticación para N8N
 * Versión simplificada para testing
 */
router.get('/test-stream', async (req, res) => {
  try {
    console.log('🧪 Nueva conexión SSE de prueba iniciada');
    
    // Configurar headers para SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Función para enviar eventos SSE
    const sendEvent = (type, data) => {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Evento inicial
    sendEvent('connected', {
      message: 'MCP Test Stream conectado',
      mode: 'testing',
      timestamp: new Date().toISOString(),
      tools_available: ['nitter_context']
    });

    // Heartbeat cada 15 segundos (más frecuente para pruebas)
    const heartbeat = setInterval(() => {
      sendEvent('heartbeat', {
        message: 'Test stream activo',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
      });
    }, 15000);

    // Evento de herramienta cada 20 segundos
    const toolEvent = setInterval(() => {
      sendEvent('tool_ready', {
        tool: 'nitter_context',
        status: 'ready',
        description: 'Herramienta de contexto social disponible',
        timestamp: new Date().toISOString()
      });
    }, 20000);

    // Limpiar al desconectar
    req.on('close', () => {
      console.log('🔌 Test stream desconectado');
      clearInterval(heartbeat);
      clearInterval(toolEvent);
    });

    req.on('error', (error) => {
      console.error('❌ Error en test stream:', error);
      clearInterval(heartbeat);
      clearInterval(toolEvent);
    });

  } catch (error) {
    console.error('Error en test-stream endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error iniciando test stream',
      error: error.message
    });
  }
});

module.exports = router; 