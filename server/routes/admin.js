const { verifyUserAccess } = require('../middlewares');
const supabase = require('../utils/supabase');

/**
 * Configura las rutas relacionadas con administración
 * @param {Express} app - La aplicación Express
 */
function setupAdminRoutes(app) {
  
  // Endpoint para diagnóstico de logs
  app.get('/api/admin/logs/diagnose', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }
      
      if (!supabase) {
        return res.status(503).json({
          error: 'Servicio no disponible',
          message: 'Supabase no está configurado'
        });
      }
      
      // Estructura para almacenar resultados de diagnóstico
      const diagnosticResults = {
        tables: {
          usage_logs: {
            exists: false,
            row_count: 0,
            error: null
          },
          system_execution_logs: {
            exists: false,
            row_count: 0,
            error: null
          }
        },
        queries: {
          simple: {
            success: false,
            rows: 0,
            error: null,
            result: null
          },
          filtered: {
            success: false,
            rows: 0,
            error: null,
            result: null
          }
        },
        troubleshooting: {
          user_role: user.profile.role,
          rls_policies: null,
          rls_error: null
        }
      };
      
      // 1. Verificar existencia de tabla usage_logs
      try {
        const { count, error } = await supabase
          .from('usage_logs')
          .select('*', { count: 'exact', head: true });
        
        diagnosticResults.tables.usage_logs.exists = !error;
        diagnosticResults.tables.usage_logs.row_count = count || 0;
        
        if (error) {
          diagnosticResults.tables.usage_logs.error = error.message;
        }
      } catch (error) {
        diagnosticResults.tables.usage_logs.error = error.message;
      }
      
      // 2. Verificar existencia de tabla system_execution_logs
      try {
        const { count, error } = await supabase
          .from('system_execution_logs')
          .select('*', { count: 'exact', head: true });
        
        diagnosticResults.tables.system_execution_logs.exists = !error;
        diagnosticResults.tables.system_execution_logs.row_count = count || 0;
        
        if (error) {
          diagnosticResults.tables.system_execution_logs.error = error.message;
        }
      } catch (error) {
        diagnosticResults.tables.system_execution_logs.error = error.message;
      }
      
      // 3. Probar consulta simple
      try {
        const { data, error } = await supabase
          .from('usage_logs')
          .select('*')
          .limit(5);
        
        diagnosticResults.queries.simple.success = !error;
        diagnosticResults.queries.simple.rows = data?.length || 0;
        diagnosticResults.queries.simple.result = data;
        
        if (error) {
          diagnosticResults.queries.simple.error = error.message;
        }
      } catch (error) {
        diagnosticResults.queries.simple.error = error.message;
      }
      
      // 4. Probar consulta filtrada
      try {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - 7);
        
        const { data, error } = await supabase
          .from('usage_logs')
          .select('*')
          .gte('timestamp', daysAgo.toISOString())
          .limit(5);
        
        diagnosticResults.queries.filtered.success = !error;
        diagnosticResults.queries.filtered.rows = data?.length || 0;
        diagnosticResults.queries.filtered.result = data;
        
        if (error) {
          diagnosticResults.queries.filtered.error = error.message;
        }
      } catch (error) {
        diagnosticResults.queries.filtered.error = error.message;
      }
      
      // 5. Verificar RLS
      try {
        const { data: policies, error: policiesError } = await supabase
          .from('information_schema.policies')
          .select('*')
          .eq('tablename', 'usage_logs');
        
        if (!policiesError && policies) {
          diagnosticResults.troubleshooting.rls_policies = policies;
        }
      } catch (error) {
        diagnosticResults.troubleshooting.rls_error = error.message;
      }
      
      res.json({
        success: true,
        diagnostic: diagnosticResults,
        recommendations: [
          diagnosticResults.tables.usage_logs.row_count === 0 ? 
            "No hay registros en la tabla usage_logs. Revisa si se están guardando correctamente los logs." : 
            "La tabla usage_logs tiene registros, pero puede que las políticas RLS estén impidiendo verlos.",
          "Verifica las políticas RLS para la tabla usage_logs.",
          "Asegúrate de que el usuario tiene rol 'admin' en la tabla profiles."
        ]
      });
      
    } catch (error) {
      console.error('❌ Error en diagnóstico de logs:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });
  
  // Endpoint para listar logs
  app.get('/api/admin/logs', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }
      
      console.log(`👑 Admin ${user.profile.email} consultando logs con filtros`);
      
      // Procesar parámetros de consulta
      const { 
        user_email,
        operation,
        log_type = 'user', // Default a 'user'
        success,
        days = 7,
        limit = 50,
        offset = 0
      } = req.query;
      
      console.log({
        log_type,
        success,
        user_email,
        operation,
        days
      });
      
      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }
      
      // Determinar tipo de log a consultar
      console.log(`🔒 Filtro específico: SOLO logs de usuario (usage_logs)`);
      
      // Ejecutar query de prueba antes para diagnosticar problemas
      console.log('🧪 Ejecutando query de prueba...');
      const { data: testData, count: testCount, error: testError } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact' })
        .limit(1);
      
      if (testError) {
        console.error('❌ Error en query de prueba:', testError);
        return res.status(500).json({
          error: 'Error consultando logs',
          message: testError.message,
          details: testError
        });
      }
      
      console.log(`✅ Query de prueba exitosa. Total registros: ${testCount || 0}`);
      
      // Calcular fecha de hace N días
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      
      // Array para guardar todos los logs
      let allLogs = [];
      
      // Consultar logs de usuario si se requiere
      if (log_type === 'user' || log_type === 'all') {
        console.log('📊 Consultando usage_logs...');
        console.log('🔑 Usuario:', user.profile.email);
        console.log('🎭 Rol:', user.profile.role);
        
        let userQuery = supabase
          .from('usage_logs')
          .select('*')
          .order('timestamp', { ascending: false });
        
        // Solo agregar filtros si es necesario
        if (days && days !== '0') {
          userQuery = userQuery.gte('timestamp', daysAgo.toISOString());
          console.log('📅 Filtro de fecha:', daysAgo.toISOString());
        }
        
        if (user_email && user_email !== 'all') {
          userQuery = userQuery.ilike('user_email', `%${user_email}%`);
          console.log('👤 Filtro de email:', user_email);
        }
        
        if (operation && operation !== 'all') {
          userQuery = userQuery.eq('operation', operation);
          console.log('🔧 Filtro de operación:', operation);
        }
        
        console.log('🔍 Query final:', userQuery);
        
        const { data: userLogs, error: userError } = await userQuery;
        
        if (userError) {
          console.error('❌ Error obteniendo logs de usuario:', userError);
          console.error('Detalles del error:', JSON.stringify(userError, null, 2));
          return res.status(500).json({
            error: 'Error obteniendo logs',
            message: userError.message,
            details: userError
          });
        }
        
        if (userLogs && userLogs.length > 0) {
          console.log(`✅ Logs encontrados: ${userLogs.length}`);
          allLogs = userLogs.map(log => {
            // Parsear request_params si es string
            let requestParams = {};
            let isSuccess = true;
            
            try {
              if (typeof log.request_params === 'string') {
                requestParams = JSON.parse(log.request_params);
              } else if (typeof log.request_params === 'object') {
                requestParams = log.request_params;
              }
              
              // Determinar si es éxito o error basado en request_params.success
              if (requestParams && requestParams.success === false) {
                isSuccess = false;
              }
            } catch (e) {
              console.warn('⚠️ Error parseando request_params:', e);
            }
            
            return {
              ...log,
              log_type: 'user',
              source_table: 'usage_logs',
              is_success: isSuccess,
              formatted_time: new Date(log.timestamp || log.created_at).toLocaleString('es-ES', {
                timeZone: 'America/Guatemala'
              })
            };
          });
        } else {
          console.log('⚠️ No se encontraron logs');
          console.log('Query params:', {
            days,
            user_email,
            operation,
            limit
          });
        }
      }
      
      // Devolver resultados con la estructura esperada por el frontend
      res.json({
        logs: allLogs,
        total: allLogs.length,
        timestamp: new Date().toISOString(),
        sources: {
          usage_logs: allLogs.length,
          system_execution_logs: 0
        },
        filters_applied: {
          user_email: user_email || 'all',
          operation: operation || 'all',
          log_type: log_type || 'all',
          days: days
        },
        statistics: {
          total_operations: allLogs.length,
          unique_users: allLogs.length > 0 ? [...new Set(allLogs.map(log => log.user_email))].length : 0,
          operation_types: allLogs.length > 0 ? [...new Set(allLogs.map(log => log.operation))].length : 0
        }
      });
      
    } catch (error) {
      console.error('❌ Error generando estadísticas de logs:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });
}

module.exports = setupAdminRoutes; 