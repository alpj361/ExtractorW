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
router.post('/execute', verifyUserAccess, async (req, res) => {
  try {
    const { tool_name, parameters = {} } = req.body;
    const user = req.user;
    
    if (!tool_name) {
      return res.status(400).json({
        success: false,
        message: 'El campo tool_name es requerido'
      });
    }
    
    console.log(`🔧 MCP execute solicitado por usuario ${user.email}: herramienta "${tool_name}"`);
    
    const result = await mcpService.executeTool(tool_name, parameters, user);
    
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
 * Endpoint directo para herramienta nitter_context con análisis completo
 */
router.post('/nitter_context', verifyUserAccess, async (req, res) => {
  try {
    const { q, location = 'guatemala', limit = 10, session_id } = req.body;
    const user = req.user;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro q (término de búsqueda) es requerido'
      });
    }
    
    if (limit && (typeof limit !== 'number' || limit < 5 || limit > 50)) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro limit debe ser un número entre 5 y 50'
      });
    }
    
    console.log(`🔧 MCP nitter_context solicitado por usuario ${user.email}: "${q}"`);
    
    const result = await mcpService.executeTool('nitter_context', { 
      q, 
      location, 
      limit: parseInt(limit),
      session_id 
    }, user);
    
    res.json({
      success: true,
      message: 'Análisis de tweets completado exitosamente',
      query: q,
      location: location,
      limit: parseInt(limit),
      session_id: result.session_id,
      result: result,
      execution_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error ejecutando nitter_context MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando tweets con análisis de IA',
      error: error.message
    });
  }
});

/**
 * POST /api/mcp/nitter_profile
 * Endpoint directo para herramienta nitter_profile para tweets de usuario específico
 */
router.post('/nitter_profile', verifyUserAccess, async (req, res) => {
  try {
    const { username, limit = 10, include_retweets = false, include_replies = false } = req.body;
    const user = req.user;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro username es requerido'
      });
    }
    
    if (limit && (typeof limit !== 'number' || limit < 5 || limit > 20)) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro limit debe ser un número entre 5 y 20'
      });
    }
    
    console.log(`🔧 MCP nitter_profile solicitado por usuario ${user.email}: @${username}`);
    
    const result = await mcpService.executeTool('nitter_profile', { 
      username: username.replace('@', ''), 
      limit: parseInt(limit),
      include_retweets: include_retweets,
      include_replies: include_replies
    }, user);
    
    res.json({
      success: true,
      message: `Tweets de usuario @${username} obtenidos exitosamente`,
      username: username,
      limit: parseInt(limit),
      include_retweets: include_retweets,
      include_replies: include_replies,
      result: result,
      execution_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error ejecutando nitter_profile MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tweets del usuario',
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

// ENDPOINT /stream ELIMINADO - Solo usar el endpoint MCP estándar más abajo

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
          "description": "Obtiene tweets usando Nitter, los analiza con Gemini AI (sentimiento, intención, entidades) y los guarda en la base de datos",
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
              },
              "session_id": {
                "type": "string",
                "description": "ID de sesión del chat (se genera automáticamente si no se proporciona)"
              }
            },
            "required": ["q"]
          },
          "features": [
            "Extracción de tweets con Nitter",
            "Análisis de sentimiento con Gemini AI",
            "Detección de intención comunicativa",
            "Extracción de entidades mencionadas",
            "Guardado individual en base de datos",
            "Categorización automática"
          ]
        },
        {
          "name": "nitter_profile",
          "description": "Obtiene tweets recientes de un usuario específico usando Nitter, ideal para analizar actividad de cuentas institucionales, políticos e influencers",
          "inputSchema": {
            "type": "object",
            "properties": {
              "username": {
                "type": "string",
                "description": "Nombre de usuario de Twitter sin el @, ejemplo: GuatemalaGob, elonmusk, CashLuna"
              },
              "limit": {
                "type": "number",
                "description": "Número máximo de tweets a obtener del usuario",
                "minimum": 5,
                "maximum": 20,
                "default": 10
              },
              "include_retweets": {
                "type": "boolean",
                "description": "Incluir retweets del usuario en los resultados",
                "default": false
              },
              "include_replies": {
                "type": "boolean",
                "description": "Incluir replies del usuario en los resultados",
                "default": false
              }
            },
            "required": ["username"]
          },
          "features": [
            "Extracción de tweets de usuario específico",
            "Información completa del perfil",
            "Ordenamiento cronológico (más reciente primero)",
            "Filtrado inteligente de contenido",
            "Métricas de engagement por tweet",
            "Múltiples instancias Nitter como fallback"
          ]
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
        tools: tools.map(tool => {
          if (tool.name === 'nitter_profile') {
            return {
              name: tool.name,
              description: tool.description,
              inputSchema: {
                type: "object",
                properties: {
                  username: { type: "string", description: "Nombre de usuario sin @" },
                  limit: { type: "number", description: "Límite de tweets", default: 10 },
                  include_retweets: { type: "boolean", description: "Incluir retweets", default: false },
                  include_replies: { type: "boolean", description: "Incluir replies", default: false }
                },
                required: ["username"]
              }
            };
          } else if (tool.name === 'nitter_context') {
            return {
              name: tool.name,
              description: tool.description,
              inputSchema: {
                type: "object",
                properties: {
                  q: { type: "string", description: "Término de búsqueda" },
                  location: { type: "string", description: "Ubicación", default: "guatemala" },
                  limit: { type: "number", description: "Límite de tweets", default: 10 },
                  session_id: { type: "string", description: "ID de sesión del chat" }
                },
                required: ["q"]
              }
            };
          } else {
            return {
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema || {}
            };
          }
        })
      });
    } else if (method === 'tools/call') {
      // Ejecutar herramienta específica
      const { name, arguments: toolArgs } = params;
      
      if (name === 'nitter_context') {
        // Para N8N, necesitamos crear un usuario dummy o requerir autenticación
        // Por ahora, retornamos error pidiendo usar endpoint autenticado
        res.status(401).json({
          error: 'nitter_context requiere autenticación. Use /api/mcp/nitter_context con token JWT'
        });
      } else if (name === 'nitter_profile') {
        // Para N8N, necesitamos crear un usuario dummy o requerir autenticación
        // Por ahora, retornamos error pidiendo usar endpoint autenticado
        res.status(401).json({
          error: 'nitter_profile requiere autenticación. Use /api/mcp/nitter_profile con token JWT'
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