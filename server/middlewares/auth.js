const supabase = require('../utils/supabase');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

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

    // Alternativa 1: Decodificar el token JWT directamente
    try {
      console.log('🔍 Decodificando token JWT...');
      
      // Usar una estrategia básica de decodificación para obtener el userId (sub) del token
      // Nota: Esto no verifica la firma del token, solo lo decodifica
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.sub) {
        console.log('❌ Token JWT inválido o sin sub (userId)');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token JWT inválido'
        });
      }
      
      const userId = decoded.sub;
      const userEmail = decoded.email;
      
      console.log(`✅ Token decodificado: Usuario ID=${userId}, Email=${userEmail}`);
      
      // Crear un cliente temporal con el token del usuario
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
      
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Variables de entorno de Supabase no configuradas');
      }
      
      const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      tempClient.auth.setAuth(token);
      
      // Obtener información del perfil del usuario usando el cliente temporal
      console.log(`🔍 Buscando perfil para usuario ID: ${userId}`);
      const { data: profile, error: profileError } = await tempClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.log(`❌ Error obteniendo perfil: ${profileError.message}`);
        
        // Si el error es de proyecto no especificado, intentar con el cliente global
        if (profileError.message.includes('Project not specified')) {
          console.log('🔄 Intentando con cliente global...');
          const { data: globalProfile, error: globalError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
          if (globalError) {
            console.log(`❌ Error con cliente global: ${globalError.message}`);
            return res.status(401).json({
              error: 'Unauthorized',
              message: globalError.message
            });
          }
          
          if (!globalProfile) {
            console.log(`❌ No se encontró perfil para usuario ID: ${userId}`);
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'Perfil de usuario no encontrado'
            });
          }
          
          // Usar el perfil encontrado con el cliente global
          profile = globalProfile;
        } else {
          return res.status(401).json({
            error: 'Unauthorized',
            message: profileError.message
          });
        }
      }
      
      if (!profile) {
        console.log(`❌ No se encontró perfil para usuario ID: ${userId}`);
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Perfil de usuario no encontrado'
        });
      }
      
      console.log(`✅ Perfil encontrado para ${userEmail} con rol: ${profile.role}`);
      
      // Adjuntar usuario y perfil a la solicitud
      req.user = {
        id: userId,
        email: userEmail,
        profile: profile
      };
      
      // Permitir acceso
      console.log(`✅ Acceso concedido para ${req.path}`);
      next();
      
    } catch (jwtError) {
      console.error('❌ Error decodificando JWT:', jwtError);
      
      // Si hay error en la decodificación, intentar con alternativa 2
      console.log('🔄 Intentando método alternativo de validación...');
      
      // Alternativa 2: Crear un cliente anónimo de Supabase y usar setAuth
      try {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
        
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          throw new Error('Variables de entorno de Supabase no configuradas');
        }
        
        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        tempClient.auth.setAuth(token);
        
        const { data: { user }, error } = await tempClient.auth.getUser();
        
        if (error || !user) {
          console.log(`❌ Error validando token: ${error ? error.message : 'Usuario no encontrado'}`);
          return res.status(401).json({
            error: 'Unauthorized',
            message: error ? error.message : 'Usuario no encontrado'
          });
        }
        
        console.log(`✅ Token válido para usuario: ${user.email}`);
        
        // Obtener información del perfil del usuario usando el cliente temporal
        console.log(`🔍 Buscando perfil para usuario ID: ${user.id}`);
        const { data: profile, error: profileError } = await tempClient
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.log(`❌ Error obteniendo perfil: ${profileError.message}`);
          
          // Si el error es de proyecto no especificado, intentar con el cliente global
          if (profileError.message.includes('Project not specified')) {
            console.log('🔄 Intentando con cliente global...');
            const { data: globalProfile, error: globalError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
              
            if (globalError) {
              console.log(`❌ Error con cliente global: ${globalError.message}`);
              return res.status(401).json({
                error: 'Unauthorized',
                message: globalError.message
              });
            }
            
            if (!globalProfile) {
              console.log(`❌ No se encontró perfil para usuario ID: ${user.id}`);
              return res.status(401).json({
                error: 'Unauthorized',
                message: 'Perfil de usuario no encontrado'
              });
            }
            
            // Usar el perfil encontrado con el cliente global
            profile = globalProfile;
          } else {
            return res.status(401).json({
              error: 'Unauthorized',
              message: profileError.message
            });
          }
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
        
        // Permitir acceso
        console.log(`✅ Acceso concedido para ${req.path}`);
        next();
      } catch (alternativeError) {
        console.error('❌ Error en método alternativo:', alternativeError);
        
        // Última alternativa: Para desarrollo, permitir acceso con un usuario de prueba
        if (process.env.NODE_ENV === 'development' || process.env.ALLOW_BYPASS_AUTH === 'true') {
          console.log('⚠️ MODO DESARROLLO: Permitiendo acceso con usuario por defecto');
          
          // Buscar un usuario admin para pruebas
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
            next();
            return;
          }
          
          // Si no hay admin, crear un perfil ficticio
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
          next();
          return;
        }
        
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Autenticación fallida después de intentar múltiples métodos'
        });
      }
    }
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