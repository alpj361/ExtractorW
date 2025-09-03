const trendsRoutes = require('./trends');
const adminRoutes = require('./admin');
const sondeosRoutes = require('./sondeos');
const projectSuggestionsRoutes = require('./project-suggestions');
const transcriptionRoutes = require('./transcription');
const documentAnalysisRoutes = require('./documentAnalysis');
const mcpRoutes = require('./mcp');
const viztaChatRoutes = require('./viztaChat');
const hybridCoveragesRoutes = require('./hybridCoverages');
const nitterContextRoutes = require('./nitterContext');
const nitterProfileRoutes = require('./nitterProfile');
const pendingAnalysisRoutes = require('./pendingAnalysis');
const nitterCommentProxyRoutes = require('./nitterComment');
const tweetCommentsRoutes = require('./tweetComments');
const aiRoutes = require('./ai');
const mapsRoutes = require('./maps');
const webAgentRoutes = require('./webAgent');
const agentsRoutes = require('./agents');
const authBridgeRoutes = require('./auth');
const path = require('path');
const capturadosRoutes = require('./capturados');
const coveragesRoutes = require('./coverages');
const express = require('express');
const { verifyUserAccess } = require('../middlewares/auth');

/**
 * Configura todas las rutas de la aplicación
 * @param {Express} app - La aplicación Express
 */
function setupRoutes(app) {
  // Ruta de verificación básica
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString()
    });
  });
  
  // Ruta para el panel de administración
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../../admin.html'));
  });
  
  // Ruta de redirección desde /admin/ a /admin
  app.get('/admin/', (req, res) => {
    res.redirect('/admin');
  });
  
  // Configurar rutas de tendencias
  trendsRoutes(app);
  
  // Configurar rutas de administración
  adminRoutes(app);
  
  // Configurar rutas de sondeos
  app.use('/api', sondeosRoutes);
  
  // Configurar rutas de sugerencias de proyectos
  app.use('/api/project-suggestions', projectSuggestionsRoutes);
  
  // Configurar rutas de transcripción
  app.use('/api/transcription', transcriptionRoutes);
  
  // Configurar rutas de análisis de documentos
  app.use('/api/document-analysis', documentAnalysisRoutes);
  
  // Configurar rutas de capturados (hallazgos extraídos)
  app.use('/api/capturados', capturadosRoutes);
  
  // Configurar rutas de coberturas geográficas (sistema tradicional)
  app.use('/api/coverages', coveragesRoutes);
  
  // Configurar rutas híbridas de coberturas geográficas con IA
  app.use('/api/hybrid-coverages', hybridCoveragesRoutes);
  
  // Configurar rutas del agente Maps (experto en geografía guatemalteca)
  app.use('/api/maps', mapsRoutes);
  
  // Configurar rutas del MCP Server
  app.use('/api/mcp', mcpRoutes);
  
  // Configurar rutas de Vizta Chat
  app.use('/api/vizta-chat', viztaChatRoutes);
  
  // Configurar rutas de Nitter Context (herramienta de análisis de tweets)
  app.use('/api', nitterContextRoutes);
  
  // Configurar rutas de Nitter Profile (herramienta de análisis de perfiles de usuarios)
  app.use('/api', nitterProfileRoutes);
  
  // Configurar rutas de Nitter Comment (proxy hacia ExtractorT)
  app.use('/api', nitterCommentProxyRoutes);

  // Rutas de gestión de comentarios (obtener/eliminar)
  app.use('/api/tweet-comments', tweetCommentsRoutes);

  // Configurar rutas de Knowledge (PublicKnowledge)
  app.use('/api/knowledge', require('./knowledge'));

  // Configurar rutas de análisis de enlaces pendientes
  app.use('/api/pending-analysis', pendingAnalysisRoutes);
  
  // Configurar rutas de IA (Gemini)
  app.use('/api/ai', aiRoutes);

  // Configurar rutas de WebAgent Proxy
  app.use('/api/webagent', webAgentRoutes);

  // Configurar rutas de agentes inteligentes
  app.use('/api/agents', agentsRoutes);

  // OAuth bridge routes (outside /api for clean redirect path)
  app.use('/', authBridgeRoutes);

  // Nueva ruta para agrupación de Codex
  require('./codexGroups')(app);

  // Healthcheck route
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ExtractorW Backend'
    });
  });

  // Default fallback
  app.get('/api', (req, res) => {
    res.json({
      message: 'ExtractorW API v2.0',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/health',
        '/api/vizta-chat',
        '/api/admin',
        '/api/transcription',
        '/api/document-analysis',
        '/api/nitter-context',
        '/api/nitter-profile',
        '/api/trends',
        '/api/coverages',
        '/api/hybrid-coverages',
        '/api/ai',
        '/api/mcp',
        '/api/pending-analysis',
        '/api/capturados',
        '/api/sondeos',
        '/api/project-suggestions',
        '/api/codex-groups',
        '/api/webagent',
        '/api/agents/generate-agent-code'
      ]
    });
  });
}

module.exports = {
  setupRoutes
}; 