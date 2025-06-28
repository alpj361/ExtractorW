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
 * GET /api/mcp/tools
 * Endpoint HTTP para discovery de herramientas (alternativa a SSE)
 * Compatible con N8N cuando SSE falla
 */
router.get('/tools', async (req, res) => {
  try {
    console.log('🔧 N8N solicitando herramientas via HTTP');
    
    const tools = await mcpService.listAvailableTools();
    
    res.json({
      success: true,
      message: 'Herramientas MCP disponibles',
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: "object",
          properties: {
            q: { 
              type: "string", 
              description: "Término de búsqueda para obtener tweets contextuales",
              required: true
            },
            location: { 
              type: "string", 
              description: "Ubicación para filtrar resultados",
              default: "guatemala"
            },
            limit: { 
              type: "number", 
              description: "Número máximo de tweets a obtener",
              minimum: 5,
              maximum: 50,
              default: 10
            }
          },
          required: ["q"]
        }
      })),
      server: {
        name: 'ExtractorW MCP Server',
        version: '1.0.0',
        status: 'ready'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error listando herramientas HTTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo herramientas',
      error: error.message
    });
  }
});

/**
 * POST /api/mcp/execute
 * Endpoint HTTP directo para ejecutar herramientas (alternativa a SSE)
 * Compatible con N8N cuando SSE falla
 */
router.post('/execute', async (req, res) => {
  try {
    const { tool, arguments: toolArgs } = req.body;
    
    console.log(`🔧 N8N ejecutando herramienta via HTTP: ${tool}`);
    
    if (!tool) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro "tool" requerido'
      });
    }
    
    if (tool === 'nitter_context') {
      const result = await mcpService.executeTool('nitter_context', toolArgs, null);
      
      res.json({
        success: true,
        message: 'Herramienta ejecutada exitosamente',
        tool: tool,
        result: result,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Herramienta '${tool}' no encontrada`
      });
    }
  } catch (error) {
    console.error('❌ Error ejecutando herramienta HTTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando herramienta',
      error: error.message
    });
  }
});

/**
 * GET /api/mcp/stream
 * Endpoint SSE compatible con N8N MCP Server Trigger
 * Protocolo MCP estándar para N8N
 */
router.get('/stream', (req, res) => {
  console.log('🔗 Nueva conexión MCP N8N iniciada');
  
  // Headers SSE estándar para MCP
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });
  
  let isConnected = true;
  
  // Función para enviar mensajes MCP
  const sendMCPMessage = (message) => {
    if (!isConnected || res.destroyed) return false;
    
    try {
      // Formato MCP estándar para N8N
      const mcpMessage = {
        jsonrpc: '2.0',
        method: message.method,
        params: message.params || {},
        id: message.id || Date.now()
      };
      
      res.write(`data: ${JSON.stringify(mcpMessage)}\n\n`);
      return true;
    } catch (error) {
      console.error('❌ Error enviando mensaje MCP:', error.message);
      isConnected = false;
      return false;
    }
  };
  
  // 1. Enviar inicialización MCP
  setTimeout(() => {
    sendMCPMessage({
      method: 'initialized',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'ExtractorW MCP Server',
          version: '1.0.0'
        }
      },
      id: 1
    });
  }, 100);
  
  // 2. Enviar lista de herramientas disponibles
  setTimeout(() => {
    sendMCPMessage({
      method: 'tools/list',
      params: {
        tools: [
          {
            name: 'nitter_context',
            description: 'Obtiene contexto social de Twitter/X usando Nitter para análisis de sentimiento y tendencias',
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
        ]
      },
      id: 2
    });
  }, 500);
  
  // 3. Heartbeat MCP cada 30 segundos
  const heartbeatInterval = setInterval(() => {
    if (!isConnected) {
      clearInterval(heartbeatInterval);
      return;
    }
    
    const success = sendMCPMessage({
      method: 'ping',
      params: {
        timestamp: new Date().toISOString()
      },
      id: Date.now()
    });
    
    if (!success) {
      clearInterval(heartbeatInterval);
    }
  }, 30000);
  
  // Cleanup de conexión
  const cleanup = () => {
    if (!isConnected) return;
    isConnected = false;
    console.log('🔌 MCP N8N desconectado');
    clearInterval(heartbeatInterval);
    
    try {
      if (!res.destroyed) {
        res.end();
      }
    } catch (error) {
      // Ignorar errores al cerrar
    }
  };
  
  // Event listeners
  req.on('close', cleanup);
  req.on('error', (error) => {
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
      console.error('❌ Error en MCP SSE:', error.message);
    }
    cleanup();
  });
  
  res.on('error', cleanup);
});

/**
 * GET /api/mcp/test-stream
 * Endpoint SSE simplificado para testing
 */
router.get('/test-stream', (req, res) => {
  console.log('🧪 Nueva conexión SSE test iniciada');
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Test simple
  res.write(`data: ${JSON.stringify({
    message: 'MCP Test Stream conectado',
    timestamp: new Date().toISOString()
  })}\n\n`);
  
  const cleanup = () => {
    console.log('🔌 SSE test desconectado');
  };
  
  req.on('close', cleanup);
  req.on('error', cleanup);
});

module.exports = router; 