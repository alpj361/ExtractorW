const supabase = require('../utils/supabase');
const { createClient } = require('@supabase/supabase-js');

/**
 * Middleware para verificar el acceso del usuario
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const verifyUserAccess = async (req, res, next) => {
  try {
    console.log(`🔐 Verificando acceso para ruta: ${req.path}`);
    
    // 1. Verificar si hay token de autenticación
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ No se proporcionó header de autorización');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No se proporcionó token de acceso'
      });
    }
    
    console.log(`📝 Auth header recibido: ${authHeader.substring(0, 15)}...`);
    
    // 2. Extraer el token y validar formato
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Formato de token inválido - debe comenzar con "Bearer "');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Formato de token inválido'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log('❌ Token de acceso mal formado o vacío');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token de acceso mal formado o vacío'
      });
    }
    
    // 3. Verificar el token con Supabase
    if (!supabase) {
      console.log('❌ Cliente Supabase no inicializado');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Servicio de autenticación no disponible'
      });
    }

    // 4. Obtener información del usuario usando el token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.log('❌ Error validando token:', userError?.message || 'Usuario no encontrado');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token inválido o expirado',
        details: userError?.message
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
    
    // 5. Obtener el perfil del usuario
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
        message: 'Error al obtener perfil de usuario',
        details: profileError.message
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
    
    // 6. Adjuntar información a la request
    req.user = {
      id: user.id,
      email: user.email,
      profile: profile
    };
    
    // 7. Permitir acceso
    console.log(`✅ Acceso concedido para ${req.path}`);
    next();
    
  } catch (error) {
    console.error('❌ Error en verificación de acceso:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error interno del servidor al validar acceso',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Modo desarrollo/pruebas
const bypassAuthForTesting = async (req, res, next) => {
  if (process.env.NODE_ENV === 'development' || process.env.ALLOW_BYPASS_AUTH === 'true') {
    console.log('⚠️ MODO DESARROLLO: Permitiendo acceso con usuario por defecto');
    
    try {
      // Intentar obtener un usuario admin existente
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .limit(1);
      
      if (adminUsers && adminUsers.length > 0) {
        const adminProfile = adminUsers[0];
        req.user = {
          id: adminProfile.id,
          email: adminProfile.email,
          profile: adminProfile
        };
        console.log(`✅ Acceso de desarrollo concedido como: ${adminProfile.email}`);
        return next();
      }
      
      // Si no hay admin, usar perfil ficticio
      req.user = {
        id: 'test-user-id',
        email: 'test@example.com',
        profile: {
          id: 'test-user-id',
          role: 'admin',
          credits: 999,
          created_at: new Date().toISOString()
        }
      };
      
      console.log('✅ Acceso de desarrollo concedido con usuario ficticio');
      return next();
    } catch (error) {
      console.error('❌ Error en bypass de autenticación:', error);
    }
  }
  
  // Si no estamos en desarrollo o falló el bypass, continuar con la autenticación normal
  return verifyUserAccess(req, res, next);
};

module.exports = {
  verifyUserAccess: process.env.NODE_ENV === 'development' ? bypassAuthForTesting : verifyUserAccess
}; 