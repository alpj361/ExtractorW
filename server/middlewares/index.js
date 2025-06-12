const { verifyUserAccess } = require('./auth');
const { debitCredits } = require('./credits');
const { addTimestamp } = require('./utils');

/**
 * Configura todos los middlewares globales para la aplicación
 * @param {Express} app - La aplicación Express
 */
function setupMiddlewares(app) {
  // Middlewares globales aquí si los hubiera
  app.use(addTimestamp);
  
  // Los demás middlewares se aplican por ruta específica
}

module.exports = {
  setupMiddlewares,
  verifyUserAccess,
  debitCredits,
  addTimestamp
}; 