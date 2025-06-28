const express = require('express');
const router = express.Router();
const mcpService = require('../services/mcp');
const { verifyUserAccess } = require('../middlewares/auth');

// ===================================================================
// MCP SERVER ROUTES - Micro Command Processor
// Orquestador de herramientas para agentes IA
// ===================================================================

/**
 * GET /api/mcp/tools
 * Lista todas las herramientas disponibles en el MCP Server
 */
router.get('/tools', async (req, res) => {
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
router.get('/tools/:tool_name', async (req, res) => {
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
router.post('/execute', async (req, res) => {
  try {
    const { tool_name, parameters = {} } = req.body;
    
    if (!tool_name) {
      return res.status(400).json({
        success: false,
        message: 'El campo tool_name es requerido'
      });
    }
    
    const result = await mcpService.executeTool(tool_name, parameters, null);
    
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
router.post('/nitter_context', async (req, res) => {
  try {
    const { q, location = 'guatemala', limit = 10 } = req.body;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro q (término de búsqueda) es requerido'
      });
    }
    
    const result = await mcpService.executeTool('nitter_context', { q, location, limit }, null);
    
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
 * GET /api/mcp/capabilities
 * Endpoint para que N8N descubra las capacidades del MCP Server
 * Formato compatible con N8N MCP Client
 */
router.get('/capabilities', async (req, res) => {
  try {
    console.log('🔍 N8N solicitando capacidades del MCP Server');
    
    const capabilities = {
      "protocolVersion": "2024-11-05",
      "capabilities": {
        "tools": {},
        "logging": {},
        "prompts": {}
      },
      "serverInfo": {
        "name": "ExtractorW MCP Server",
        "version": "1.0.0"
      },
      "tools": [
        {
          "name": "nitter_context",
          "description": "Obtiene contexto social de Twitter/X usando Nitter para un término específico",
          "inputSchema": {
            "type": "object",
            "properties": {
              "q": {
                "type": "string",
                "description": "Término de búsqueda para obtener tweets contextuales"
              },
              "location": {
                "type": "string", 
                "description": "Ubicación para filtrar resultados (guatemala, mexico, us, etc.)",
                "default": "guatemala"
              },
              "limit": {
                "type": "number",
                "description": "Número máximo de tweets a obtener",
                "minimum": 5,
                "maximum": 50,
                "default": 10
              }
            },
            "required": ["q"]
          }
        }
      ]
    };
    
    res.json(capabilities);
  } catch (error) {
    console.error('❌ Error obteniendo capacidades MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo capacidades del servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/mcp/call
 * Endpoint para ejecutar herramientas desde N8N MCP Client
 * Formato compatible con protocolo MCP
 */
router.post('/call', async (req, res) => {
  try {
    const { method, params } = req.body;
    
    console.log(`🔧 N8N llamando método MCP: ${method} con parámetros:`, params);
    
    if (method === 'tools/list') {
      // Listar herramientas disponibles
      const tools = await mcpService.listAvailableTools();
      res.json({
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: "object",
            properties: {
              q: { type: "string", description: "Término de búsqueda" },
              location: { type: "string", description: "Ubicación", default: "guatemala" },
              limit: { type: "number", description: "Límite de tweets", default: 10 }
            },
            required: ["q"]
          }
        }))
      });
    } else if (method === 'tools/call') {
      // Ejecutar herramienta específica
      const { name, arguments: toolArgs } = params;
      
      if (name === 'nitter_context') {
        const result = await mcpService.executeTool('nitter_context', toolArgs, null);
        res.json({
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
      } else {
        res.status(404).json({
          error: `Herramienta '${name}' no encontrada`
        });
      }
    } else {
      res.status(400).json({
        error: `Método '${method}' no soportado`
      });
    }
  } catch (error) {
    console.error('❌ Error en llamada MCP:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/mcp/test-stream
 * Endpoint SSE robusto para N8N MCP Client
 * Manejo mejorado de errores y reconexiones
 */
router.get('/test-stream', (req, res) => {
  const connectionId = Math.random().toString(36).substr(2, 9);
  console.log(`🧪 Nueva conexión SSE N8N iniciada [${connectionId}]`);
  
  // Headers SSE optimizados para N8N y proxies
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('X-Accel-Buffering', 'no'); // Para nginx
  res.setHeader('Transfer-Encoding', 'chunked');
  
  // Variable para controlar si la conexión está activa
  let isConnected = true;
  
  // Función robusta para enviar eventos SSE
  const sendSSEEvent = (eventType, data, id = null) => {
    if (!isConnected || res.destroyed || res.writableEnded) {
      return false;
    }
    
    try {
      let message = '';
      if (id) {
        message += `id: ${id}\n`;
      }
      message += `event: ${eventType}\n`;
      message += `data: ${JSON.stringify(data)}\n\n`;
      
      res.write(message);
      return true;
    } catch (error) {
      console.error(`❌ Error enviando evento SSE [${connectionId}]:`, error.message);
      isConnected = false;
      return false;
    }
  };

  // Evento inicial inmediato
  const initialSuccess = sendSSEEvent('connected', {
    message: 'MCP Server N8N Stream Conectado',
    connectionId: connectionId,
    timestamp: new Date().toISOString(),
    server: {
      name: 'ExtractorW MCP Server',
      version: '1.0.0',
      status: 'ready'
    }
  }, 'connect-1');

  if (!initialSuccess) {
    console.log(`❌ Conexión inicial fallida [${connectionId}]`);
    return;
  }

  // Enviar herramientas disponibles inmediatamente
  setTimeout(() => {
    sendSSEEvent('tools_available', {
      tools: [
        {
          name: 'nitter_context',
          description: 'Obtiene contexto social de Twitter/X usando Nitter para análisis de sentimiento',
          inputSchema: {
            type: 'object',
            properties: {
              q: { 
                type: 'string', 
                description: 'Término de búsqueda para obtener tweets contextuales'
              },
              location: { 
                type: 'string', 
                description: 'Ubicación para filtrar resultados',
                default: 'guatemala'
              },
              limit: { 
                type: 'number', 
                description: 'Número máximo de tweets a obtener',
                minimum: 5,
                maximum: 50,
                default: 10
              }
            },
            required: ['q']
          }
        }
      ],
      count: 1,
      connectionId: connectionId,
      timestamp: new Date().toISOString()
    }, 'tools-1');
  }, 500);

  // Evento de herramienta lista
  setTimeout(() => {
    sendSSEEvent('tool_ready', {
      tool: 'nitter_context',
      status: 'ready',
      endpoint: '/api/mcp/call',
      method: 'tools/call',
      connectionId: connectionId,
      timestamp: new Date().toISOString()
    }, 'tool-ready-1');
  }, 1000);

  // Heartbeat cada 15 segundos (más espaciado para evitar sobrecarga)
  const heartbeatInterval = setInterval(() => {
    if (!isConnected) {
      clearInterval(heartbeatInterval);
      return;
    }
    
    const success = sendSSEEvent('heartbeat', {
      message: 'Server alive',
      connectionId: connectionId,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    }, `heartbeat-${Date.now()}`);
    
    if (!success) {
      clearInterval(heartbeatInterval);
    }
  }, 15000);

  // Evento de estado cada 45 segundos
  const statusInterval = setInterval(() => {
    if (!isConnected) {
      clearInterval(statusInterval);
      return;
    }
    
    const success = sendSSEEvent('server_status', {
      status: 'operational',
      tools_ready: ['nitter_context'],
      external_services: {
        extractor_t: 'connected'
      },
      connectionId: connectionId,
      timestamp: new Date().toISOString()
    }, `status-${Date.now()}`);
    
    if (!success) {
      clearInterval(statusInterval);
    }
  }, 45000);

  // Manejo robusto de desconexión
  const cleanup = (reason = 'unknown') => {
    if (!isConnected) return;
    
    isConnected = false;
    console.log(`🔌 SSE N8N desconectado [${connectionId}] - Razón: ${reason}`);
    
    clearInterval(heartbeatInterval);
    clearInterval(statusInterval);
    
    try {
      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    } catch (error) {
      // Ignorar errores al cerrar
    }
  };

  // Event listeners con manejo de errores mejorado
  req.on('close', () => cleanup('client_close'));
  req.on('error', (error) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      cleanup('connection_reset');
    } else {
      console.error(`❌ Error en SSE N8N [${connectionId}]:`, error.message);
      cleanup('error');
    }
  });

  res.on('error', (error) => {
    console.error(`❌ Error en response SSE [${connectionId}]:`, error.message);
    cleanup('response_error');
  });

  res.on('close', () => cleanup('response_close'));

  // Configuración de socket robusta
  if (req.socket) {
    req.socket.setKeepAlive(true, 30000); // 30 segundos
    req.socket.setTimeout(120000); // 2 minutos timeout
    
    req.socket.on('timeout', () => {
      console.log(`⏰ Timeout en socket SSE [${connectionId}]`);
      cleanup('socket_timeout');
    });
  }
});

module.exports = router; 