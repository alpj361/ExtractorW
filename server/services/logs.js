const supabase = require('../utils/supabase');

/**
 * Registra el uso de una operación por parte de un usuario
 * @param {Object} user - Información del usuario
 * @param {string} operation - Operación realizada
 * @param {number} credits - Créditos utilizados
 * @param {Object} req - Objeto de solicitud
 * @returns {Promise<void>}
 */
async function logUsage(user, operation, credits, req) {
  if (!supabase) {
    console.warn('⚠️ No se pudo registrar uso: Supabase no está configurado');
    return;
  }

  try {
    // Verificar si ya se ha registrado un log para esta solicitud
    if (req && req.usage_logged) {
      console.log(`ℹ️ No se registra uso duplicado para ${operation}, ya existe un log`);
      return;
    }

    // Extraer información relevante de la solicitud
    const requestParams = {
      path: req.path,
      method: req.method,
      body: req.body ? JSON.stringify(req.body).substring(0, 1000) : null,
      timestamp: new Date().toISOString(),
      success: true,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    };

    // Crear registro de uso
    const logEntry = {
      user_id: user.id,
      user_email: user.email,
      operation: operation,
      credits_consumed: credits,
      timestamp: new Date().toISOString(),
      request_params: requestParams
    };

    // Intentar agregar current_credits si la columna existe
    try {
      logEntry.current_credits = user.profile.credits;
    } catch (error) {
      // Ignorar si no se puede agregar current_credits
      console.log('ℹ️ No se pudo agregar current_credits al log (columna no existe)');
    }

    const { error } = await supabase
      .from('usage_logs')
      .insert([logEntry]);

    if (error) {
      console.error('💥 Error de usuario guardado en usage_logs:', operation);
      console.error(error);
    } else {
      console.log(`✅ Uso registrado: ${user.email} - ${operation} - ${credits} créditos`);
      
      // Marcar que ya se ha registrado un log para esta solicitud
      if (req) {
        req.usage_logged = true;
      }
    }
  } catch (error) {
    console.error('💥 Error de usuario guardado en usage_logs:', operation);
    console.error(error);
  }
}

/**
 * Registra un error en la operación
 * @param {string} operation - Operación donde ocurrió el error
 * @param {Object} errorDetails - Detalles del error
 * @param {Object} user - Información del usuario (opcional)
 * @param {Object} req - Objeto de solicitud (opcional)
 * @returns {Promise<void>}
 */
async function logError(operation, errorDetails, user = null, req = null) {
  if (!supabase) {
    console.warn('⚠️ No se pudo registrar error: Supabase no está configurado');
    return;
  }

  try {
    // Verificar si ya se ha registrado un log para esta solicitud
    if (req && req.usage_logged) {
      console.log(`ℹ️ No se registra error duplicado para ${operation}, ya existe un log de uso`);
      return;
    }

    // Crear registro de error
    const logEntry = {
      operation: operation,
      timestamp: new Date().toISOString(),
      error_message: errorDetails.message || 'Error desconocido',
      error_stack: errorDetails.stack || null,
      success: false
    };

    // Agregar información de usuario si está disponible
    if (user) {
      logEntry.user_id = user.id;
      logEntry.user_email = user.email;
      // Intentar agregar current_credits si la columna existe
      try {
        logEntry.current_credits = user.profile?.credits || 0;
      } catch (error) {
        // Ignorar si no se puede agregar current_credits
        console.log('ℹ️ No se pudo agregar current_credits al log de error (columna no existe)');
      }
    }

    // Agregar información de la solicitud si está disponible
    if (req) {
      logEntry.request_params = {
        path: req.path,
        method: req.method,
        body: req.body ? JSON.stringify(req.body).substring(0, 1000) : null,
        timestamp: new Date().toISOString(),
        success: false,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      };
    }

    // Guardar registro
    const { error } = await supabase
      .from('usage_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Error al registrar error en logs:', error);
    } else {
      console.log(`❌ Error registrado: ${operation}`);
      
      // Marcar que ya se ha registrado un log para esta solicitud
      if (req) {
        req.usage_logged = true;
      }
    }
  } catch (error) {
    console.error('Error al registrar error en logs:', error);
  }
}

/**
 * Registra una acción administrativa
 * @param {Object} user - Información del usuario administrador
 * @param {string} action - Acción realizada
 * @param {Object} details - Detalles de la acción
 * @returns {Promise<void>}
 */
async function logAdminAction(user, action, details) {
  if (!supabase) {
    console.warn('⚠️ No se pudo registrar acción admin: Supabase no está configurado');
    return;
  }

  try {
    // Crear registro de acción administrativa
    const { error } = await supabase
      .from('admin_logs')
      .insert([{
        admin_id: user.id,
        admin_email: user.email,
        action: action,
        details: details,
        timestamp: new Date().toISOString()
      }]);

    if (error) {
      console.error('Error al registrar acción administrativa:', error);
    } else {
      console.log(`👑 Acción admin registrada: ${user.email} - ${action}`);
    }
  } catch (error) {
    console.error('Error al registrar acción administrativa:', error);
  }
}

module.exports = {
  logUsage,
  logError,
  logAdminAction
}; 