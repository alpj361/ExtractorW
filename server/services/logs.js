let supabase = require('../utils/supabase');

// Si existe una clave de servicio, usarla para operaciones de logging (omite RLS)
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  const SUPABASE_URL = process.env.SUPABASE_URL;
  supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });
}

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
    console.log('📊 LOGGING: Registrando uso detallado de la operación:', {
      operation,
      user_email: user.email,
      credits,
      path: req?.path,
      method: req?.method
    });
    
    // Verificar si ya se ha registrado un log para esta solicitud
    if (req && req.usage_logged) {
      console.log(`ℹ️ No se registra uso duplicado para ${operation}, ya existe un log`);
      return;
    }

    // Extraer información relevante de la solicitud
    const requestParams = {
      path: req?.path || '/unknown',
      method: req?.method || 'UNKNOWN',
      body: req?.body ? JSON.stringify(req.body).substring(0, 1000) : null,
      timestamp: new Date().toISOString(),
      success: true,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown'
    };

    // Enhanced logging for sondeos with detailed processing information
    let processingDetails = {};
    
    if (operation === '/api/sondeo' && req?.body) {
      const body = req.body;
      processingDetails = {
        pregunta: body.pregunta || '',
        pregunta_length: (body.pregunta || '').length,
        contextos_seleccionados: body.selectedContexts || body.contextos || [],
        configuracion: {
          detalle_nivel: body.configuracion?.detalle_nivel || 'no especificado',
          incluir_recomendaciones: body.configuracion?.incluir_recomendaciones || false,
          incluir_visualizaciones: body.configuracion?.incluir_visualizaciones || false,
          tipo_analisis: body.configuracion?.tipo_analisis || 'no especificado'
        },
        contexto_original_disponible: !!body.configuracion?.contexto_original,
        tiene_monitoreos_seleccionados: !!(body.selectedMonitoreoIds && body.selectedMonitoreoIds.length > 0)
      };
      
      console.log('📊 LOGGING: Detalles del sondeo para logs:', processingDetails);
    }

    // Crear registro de uso completo
    const logEntry = {
      user_id: user.id,
      user_email: user.email,
      operation: operation,
      credits_consumed: credits,
      current_credits: user.profile.credits || 0,
      timestamp: new Date().toISOString(),
      request_params: requestParams,
      processing_details: Object.keys(processingDetails).length > 0 ? processingDetails : null
    };

    // Agregar métricas de tokens y costo si existen en la request
    if (req.tokens_consumed !== undefined) {
      logEntry.tokens_consumed = req.tokens_consumed;
    }
    if (req.dollars_consumed !== undefined) {
      logEntry.dollars_consumed = req.dollars_consumed;
    }
    
    // Add detailed response metrics if available
    if (req.response_metrics) {
      logEntry.response_metrics = req.response_metrics;
      console.log('📊 LOGGING: Métricas de respuesta incluidas:', req.response_metrics);
    }

    const { error } = await supabase
      .from('usage_logs')
      .insert([logEntry]);

    if (error) {
      console.error('💥 Error de usuario guardado en usage_logs:', operation);
      console.error(error);
      // Si falla por la columna current_credits, intentar sin ella
      if (error.message && error.message.includes('current_credits')) {
        console.log('🔄 Reintentando sin current_credits...');
        const logEntryWithoutCredits = { ...logEntry };
        delete logEntryWithoutCredits.current_credits;
        
        const { error: retryError } = await supabase
          .from('usage_logs')
          .insert([logEntryWithoutCredits]);
          
        if (retryError) {
          console.error('💥 Error en segundo intento:', retryError);
        } else {
          console.log(`✅ Uso registrado (sin current_credits): ${user.email} - ${operation} - ${credits} créditos`);
        }
      }
    } else {
      console.log(`✅ Uso registrado: ${user.email} - ${operation} - ${credits} créditos`);
      console.log('📊 LOGGING: Log entry guardado exitosamente con detalles completos');
      
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

    // Crear registro de error completo
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
      logEntry.current_credits = user.profile?.credits || 0; // Agregar current_credits
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
      // Si falla por la columna current_credits, intentar sin ella
      if (error.message && error.message.includes('current_credits')) {
        console.log('🔄 Reintentando error log sin current_credits...');
        const logEntryWithoutCredits = { ...logEntry };
        delete logEntryWithoutCredits.current_credits;
        
        const { error: retryError } = await supabase
          .from('usage_logs')
          .insert([logEntryWithoutCredits]);
          
        if (retryError) {
          console.error('💥 Error en segundo intento de error log:', retryError);
        } else {
          console.log(`❌ Error registrado (sin current_credits): ${operation}`);
        }
      }
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