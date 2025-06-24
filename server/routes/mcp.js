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
    console.error('❌ Error al listar herramientas MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/mcp/execute
 * Ejecuta una herramienta específica del MCP Server
 */
router.post('/execute', requireAuth, async (req, res) => {
  try {
    const { tool_name, parameters } = req.body;
    
    if (!tool_name) {
      return res.status(400).json({
        success: false,
        message: 'tool_name es requerido'
      });
    }

    const result = await mcpService.executeTool(tool_name, parameters, req.user);
    
    res.json({
      success: true,
      message: `Herramienta ${tool_name} ejecutada exitosamente`,
      tool_name: tool_name,
      result: result
    });
  } catch (error) {
    console.error(`❌ Error ejecutando herramienta ${req.body.tool_name}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando herramienta',
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
      message: `Información de herramienta ${tool_name}`,
      tool: toolInfo
    });
  } catch (error) {
    console.error(`❌ Error obteniendo info de herramienta ${req.params.tool_name}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información de herramienta',
      error: error.message
    });
  }
});

/**
 * POST /api/mcp/tools/nitter_context
 * Endpoint específico para la herramienta nitter_context (acceso directo)
 */
router.post('/tools/nitter_context', requireAuth, async (req, res) => {
  try {
    const { q, location = "guatemala", limit = 10 } = req.body;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro "q" (query) es requerido'
      });
    }

    const result = await mcpService.executeNitterContext(q, location, limit, req.user);
    
    res.json({
      success: true,
      message: 'Contexto de Nitter obtenido exitosamente',
      tool_name: 'nitter_context',
      result: result
    });
  } catch (error) {
    console.error('❌ Error ejecutando nitter_context:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo contexto de Nitter',
      error: error.message
    });
  }
});

/**
 * GET /api/mcp/status
 * Estado general del MCP Server
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const status = await mcpService.getServerStatus();
    
    res.json({
      success: true,
      message: 'Estado del MCP Server',
      server_status: status
    });
  } catch (error) {
    console.error('❌ Error obteniendo estado MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado del servidor',
      error: error.message
    });
  }
});

module.exports = router; 