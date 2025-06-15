const trendsRoutes = require('./trends');
const adminRoutes = require('./admin');
const sondeosRoutes = require('./sondeos');

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
  
  // Configurar rutas de tendencias
  trendsRoutes(app);
  
  // Configurar rutas de administración
  adminRoutes(app);
  
  // Configurar rutas de sondeos
  app.use('/', sondeosRoutes);
}

module.exports = {
  setupRoutes
}; 