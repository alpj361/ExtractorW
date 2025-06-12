const supabase = require('../utils/supabase');

/**
 * Middleware para verificar el acceso del usuario
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const verifyUserAccess = async (req, res, next) => {
  try {
    console.log(`🔐 Verificando acceso para ruta: ${req.path}`);
    
    // Verificar si hay token de autenticación
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ No se proporcionó header de autorización');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No se proporcionó token de acceso'
      });
    }
    
    console.log(`📝 Auth header recibido: ${authHeader.substring(0, 15)}...`);
    
    // Extraer el token de Bearer
    const parts = authHeader.split(' ');
    
    // Manejar tanto "Bearer TOKEN" como simplemente "TOKEN"
    const token = parts.length > 1 ? parts[1] : parts[0];
    
    if (!token) {
      console.log('❌ Token de acceso mal formado o vacío');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token de acceso mal formado o vacío'
      });
    }
    
    console.log(`🔑 Token extraído: ${token.substring(0, 15)}...`);
    
    // Verificar el token con Supabase
    if (!supabase) {
      console.log('❌ Cliente Supabase no inicializado');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Servicio de autenticación no disponible'
      });
    }

    // Obtener el usuario a partir del token
    console.log('🔍 Verificando token con Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log(`❌ Error validando token: ${error.message}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message
      });
    }
    
    if (!user) {
      console.log('❌ No se encontró usuario para el token proporcionado');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no encontrado'
      });
    }
    
    console.log(`✅ Token válido para usuario: ${user.email}`);
    
    // Obtener información del perfil del usuario
    console.log(`🔍 Buscando perfil para usuario ID: ${user.id}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.log(`❌ Error obteniendo perfil: ${profileError.message}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: profileError.message
      });
    }
    
    if (!profile) {
      console.log(`❌ No se encontró perfil para usuario ID: ${user.id}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Perfil de usuario no encontrado'
      });
    }
    
    console.log(`✅ Perfil encontrado para ${user.email} con rol: ${profile.role}`);
    
    // Adjuntar usuario y perfil a la solicitud
    req.user = {
      id: user.id,
      email: user.email,
      profile: profile
    };
    
    // Permitir acceso incluso sin tokens para ciertos endpoints
    console.log(`✅ Acceso concedido para ${req.path}`);
    next();
  } catch (error) {
    console.error('❌ Error en verificación de acceso:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  verifyUserAccess
}; 