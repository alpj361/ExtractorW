const supabase = require('../utils/supabase');

/**
 * Middleware para verificar el acceso del usuario
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const verifyUserAccess = async (req, res, next) => {
  try {
    // Verificar si hay token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No se proporcionó token de acceso'
      });
    }
    
    // Extraer el token de Bearer
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token de acceso mal formado'
      });
    }
    
    // Verificar el token con Supabase
    if (!supabase) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Servicio de autenticación no disponible'
      });
    }

    // Obtener el usuario a partir del token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error ? error.message : 'Usuario no encontrado'
      });
    }
    
    // Obtener información del perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: profileError ? profileError.message : 'Perfil de usuario no encontrado'
      });
    }
    
    // Adjuntar usuario y perfil a la solicitud
    req.user = {
      id: user.id,
      email: user.email,
      profile: profile
    };
    
    // Continuar con la solicitud
    next();
  } catch (error) {
    console.error('Error en verificación de acceso:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

module.exports = {
  verifyUserAccess
}; 