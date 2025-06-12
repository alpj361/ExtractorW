/**
 * Middleware para añadir una marca de tiempo a cada solicitud
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const addTimestamp = (req, res, next) => {
  req.timestamp = new Date().toISOString();
  next();
};

module.exports = {
  addTimestamp
}; 