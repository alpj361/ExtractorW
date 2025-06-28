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
const path = require('path');
const capturadosRoutes = require('./capturados');
const coveragesRoutes = require('./coverages');

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
  app.use('/', sondeosRoutes);
  
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
  
  // Configurar rutas del MCP Server
  app.use('/api/mcp', mcpRoutes);
  
  // Configurar rutas de Vizta Chat
  app.use('/api/vizta-chat', viztaChatRoutes);
  
  // Configurar rutas de Nitter Context (herramienta de análisis de tweets)
  app.use('/api', nitterContextRoutes);
}

module.exports = {
  setupRoutes
}; 