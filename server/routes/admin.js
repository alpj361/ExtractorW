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
        log_type = 'all', // Default 'all' para incluir todos los tipos de logs
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
      
      // Consultar logs de sistema si se requiere
      if (log_type === 'system' || log_type === 'all') {
        console.log('📊 Consultando system_execution_logs...');
        let sysQuery = supabase
          .from('system_execution_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (days && days !== '0') {
          sysQuery = sysQuery.gte('timestamp', daysAgo.toISOString());
        }
        if (operation && operation !== 'all') {
          sysQuery = sysQuery.eq('operation', operation);
        }

        const { data: sysLogs, error: sysError } = await sysQuery;
        if (sysError) {
          console.error('❌ Error obteniendo logs de sistema:', sysError);
          return res.status(500).json({ error: 'Error obteniendo logs', message: sysError.message });
        }

        if (sysLogs && sysLogs.length > 0) {
          console.log(`✅ Logs de sistema encontrados: ${sysLogs.length}`);
          const mappedSys = sysLogs.map(log => ({
            ...log,
            log_type: 'system',
            source_table: 'system_execution_logs',
            is_system: true,
            is_success: log.is_success !== false,
            formatted_time: new Date(log.timestamp || log.created_at).toLocaleString('es-ES', { timeZone: 'America/Guatemala' })
          }));
          allLogs = allLogs.concat(mappedSys);
        }
      }

      // Eliminar duplicados basados en id + source_table
      const uniqueMap = new Map();
      allLogs.forEach(l => {
        const key = `${l.id || l.execution_id}-${l.source_table}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, l);
      });
      allLogs = Array.from(uniqueMap.values());

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
  
  // Endpoint para estadísticas de logs
  app.get('/api/admin/logs/stats', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }
      
      console.log(`👑 Admin ${user.profile.email} consultando estadísticas de logs`);
      
      // Procesar parámetros
      const { days = 7, log_type = 'all' } = req.query;
      
      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }
      
      // Calcular fecha de hace N días
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      
      // Consultar logs de usuario para estadísticas
      const { data: usageLogs, error: usageError } = await supabase
        .from('usage_logs')
        .select('*')
        .gte('timestamp', daysAgo.toISOString());
      
      if (usageError) {
        console.error('❌ Error obteniendo logs para estadísticas:', usageError);
        return res.status(500).json({
          error: 'Error consultando logs',
          message: usageError.message
        });
      }
      
      // Generar estadísticas
      const uniqueUsers = [...new Set(usageLogs.map(log => log.user_email))];
      const operationCounts = {};
      
      usageLogs.forEach(log => {
        if (log.operation) {
          operationCounts[log.operation] = (operationCounts[log.operation] || 0) + 1;
        }
      });
      
      // Calcular tendencias diarias
      const dailyActivity = {};
      const now = new Date();
      
      // Inicializar los últimos N días
      for (let i = 0; i < parseInt(days); i++) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyActivity[dateStr] = 0;
      }
      
      // Contar actividad por día
      usageLogs.forEach(log => {
        const dateStr = new Date(log.timestamp).toISOString().split('T')[0];
        if (dailyActivity.hasOwnProperty(dateStr)) {
          dailyActivity[dateStr] += 1;
        }
      });
      
      // Preparar respuesta
      res.json({
        total_logs: usageLogs.length,
        unique_users: uniqueUsers.length,
        operations: Object.entries(operationCounts).map(([name, count]) => ({ name, count })),
        daily_activity: Object.entries(dailyActivity)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error generando estadísticas de logs:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });
  
  // Endpoint para listar usuarios
  app.get('/api/admin/users', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }
      
      console.log(`👑 Admin ${user.profile.email} consultando lista de usuarios`);
      
      const { limit = 200 } = req.query;
      
      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }
      
      // Consultar perfiles de usuario
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));
      
      if (profilesError) {
        console.error('❌ Error obteniendo perfiles de usuario:', profilesError);
        return res.status(500).json({
          error: 'Error consultando usuarios',
          message: profilesError.message
        });
      }
      
      res.json({
        users: profiles,
        total: profiles.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // ===================================================================
  // GESTIÓN DE LÍMITES DE CAPAS
  // ===================================================================

  // Endpoint para obtener límites de capas de usuarios
  app.get('/api/admin/users/layers-limits', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }

      console.log(`👑 Admin ${user.profile.email} consultando límites de capas`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      const { limit = 50, search, role } = req.query;

      // Construir query base
      let query = supabase
        .from('profiles')
        .select('id, email, layerslimit, role, created_at')
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (search) {
        query = query.ilike('email', `%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      query = query.limit(parseInt(limit));

      const { data: profiles, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo límites de capas:', error);
        return res.status(500).json({
          error: 'Error consultando límites',
          message: error.message
        });
      }

      // Calcular estadísticas
      const stats = {
        total_users: profiles.length,
        average_limit: profiles.reduce((acc, p) => acc + (p.layerslimit || 3), 0) / profiles.length,
        distribution: {}
      };

      profiles.forEach(profile => {
        const limit = profile.layerslimit || 3;
        stats.distribution[limit] = (stats.distribution[limit] || 0) + 1;
      });

      res.json({
        users: profiles,
        statistics: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error obteniendo límites de capas:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Endpoint para actualizar límite de capas de un usuario
  app.put('/api/admin/users/:userId/layers-limit', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden modificar límites'
        });
      }

      const { userId } = req.params;
      const { layersLimit, reason } = req.body;

      if (!layersLimit || layersLimit < 1 || layersLimit > 20) {
        return res.status(400).json({
          error: 'Límite inválido',
          message: 'El límite debe estar entre 1 y 20 capas'
        });
      }

      console.log(`👑 Admin ${user.profile.email} actualizando límite de usuario ${userId} a ${layersLimit}`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      // Obtener información del usuario antes del cambio
      const { data: beforeProfile, error: beforeError } = await supabase
        .from('profiles')
        .select('email, layerslimit')
        .eq('id', userId)
        .single();

      if (beforeError) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: beforeError.message
        });
      }

      // Actualizar el límite
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ layerslimit: layersLimit })
        .eq('id', userId)
        .select('id, email, layerslimit, role')
        .single();

      if (updateError) {
        console.error('❌ Error actualizando límite:', updateError);
        return res.status(500).json({
          error: 'Error actualizando límite',
          message: updateError.message
        });
      }

      // Registrar la acción en logs
      const logData = {
        user_email: user.profile.email,
        operation: 'update_layers_limit',
        details: {
          target_user: beforeProfile.email,
          old_limit: beforeProfile.layerslimit || 3,
          new_limit: layersLimit,
          reason: reason || 'Sin razón especificada'
        },
        credits_used: 0,
        success: true,
        timestamp: new Date().toISOString()
      };

      await supabase.from('usage_logs').insert([logData]);

      res.json({
        success: true,
        message: 'Límite actualizado correctamente',
        user: updatedProfile,
        change: {
          from: beforeProfile.layerslimit || 3,
          to: layersLimit,
          admin: user.profile.email,
          reason: reason || 'Sin razón especificada'
        }
      });

    } catch (error) {
      console.error('❌ Error actualizando límite de capas:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Endpoint para obtener uso de capas de un usuario específico
  app.get('/api/admin/users/:userId/layers-usage', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }

      const { userId } = req.params;

      console.log(`👑 Admin ${user.profile.email} consultando uso de capas del usuario ${userId}`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      // Obtener información del usuario
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, layerslimit')
        .eq('id', userId)
        .single();

      if (profileError) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: profileError.message
        });
      }

      // Obtener proyectos del usuario
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, created_at')
        .eq('user_id', userId);

      if (projectsError) {
        console.error('❌ Error obteniendo proyectos:', projectsError);
        return res.status(500).json({
          error: 'Error consultando proyectos',
          message: projectsError.message
        });
      }

      // Para cada proyecto, obtener el conteo de capas por tipo
      const projectsWithUsage = await Promise.all(
        projects.map(async (project) => {
          const { data: decisions, error: decisionsError } = await supabase
            .from('project_decisions')
            .select('decision_type, parent_decision_id')
            .eq('project_id', project.id);

          if (decisionsError) {
            console.error(`❌ Error obteniendo decisiones del proyecto ${project.id}:`, decisionsError);
            return {
              ...project,
              layers_usage: { enfoque: 0, alcance: 0, configuracion: 0 },
              error: decisionsError.message
            };
          }

          // Contar solo capas raíz (sin parent_decision_id)
          const rootDecisions = decisions.filter(d => !d.parent_decision_id);
          const usage = {
            enfoque: rootDecisions.filter(d => d.decision_type === 'enfoque').length,
            alcance: rootDecisions.filter(d => d.decision_type === 'alcance').length,
            configuracion: rootDecisions.filter(d => d.decision_type === 'configuracion').length
          };

          return {
            ...project,
            layers_usage: usage,
            total_layers: usage.enfoque + usage.alcance + usage.configuracion
          };
        })
      );

      // Calcular totales
      const totalUsage = projectsWithUsage.reduce(
        (acc, project) => {
          if (project.layers_usage) {
            acc.enfoque += project.layers_usage.enfoque;
            acc.alcance += project.layers_usage.alcance;
            acc.configuracion += project.layers_usage.configuracion;
          }
          return acc;
        },
        { enfoque: 0, alcance: 0, configuracion: 0 }
      );

      res.json({
        user: {
          id: userId,
          email: profile.email,
          layers_limit: profile.layerslimit || 3
        },
        projects: projectsWithUsage,
        total_usage: totalUsage,
        summary: {
          total_projects: projects.length,
          total_layers_used: totalUsage.enfoque + totalUsage.alcance + totalUsage.configuracion,
          usage_percentage: ((totalUsage.enfoque + totalUsage.alcance + totalUsage.configuracion) / ((profile.layerslimit || 3) * 3 * projects.length)) * 100
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error obteniendo uso de capas:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Endpoint para obtener estadísticas generales de uso de capas
  app.get('/api/admin/layers-usage/stats', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }

      console.log(`👑 Admin ${user.profile.email} consultando estadísticas generales de capas`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      // Obtener todos los usuarios y sus límites
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, layerslimit');

      if (profilesError) {
        console.error('❌ Error obteniendo perfiles:', profilesError);
        return res.status(500).json({
          error: 'Error consultando usuarios',
          message: profilesError.message
        });
      }

      // Obtener todas las decisiones raíz por tipo
      const { data: decisions, error: decisionsError } = await supabase
        .from('project_decisions')
        .select('decision_type, project_id, parent_decision_id')
        .is('parent_decision_id', null); // Solo capas raíz

      if (decisionsError) {
        console.error('❌ Error obteniendo decisiones:', decisionsError);
        return res.status(500).json({
          error: 'Error consultando decisiones',
          message: decisionsError.message
        });
      }

      // Obtener información de proyectos para mapear a usuarios
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, user_id');

      if (projectsError) {
        console.error('❌ Error obteniendo proyectos:', projectsError);
        return res.status(500).json({
          error: 'Error consultando proyectos',
          message: projectsError.message
        });
      }

      // Crear mapa de proyecto a usuario
      const projectToUser = {};
      projects.forEach(project => {
        projectToUser[project.id] = project.user_id;
      });

      // Calcular estadísticas por usuario
      const userStats = {};
      profiles.forEach(profile => {
        userStats[profile.id] = {
          email: profile.email,
          limit: profile.layerslimit || 3,
          usage: { enfoque: 0, alcance: 0, configuracion: 0 }
        };
      });

      // Contar uso por usuario
      decisions.forEach(decision => {
        const userId = projectToUser[decision.project_id];
        if (userId && userStats[userId]) {
          userStats[userId].usage[decision.decision_type]++;
        }
      });

      // Calcular estadísticas globales
      const stats = {
        total_users: profiles.length,
        limits_distribution: {},
        usage_by_type: { enfoque: 0, alcance: 0, configuracion: 0 },
        users_at_limit: { enfoque: 0, alcance: 0, configuracion: 0 },
        average_usage_percentage: 0
      };

      let totalUsagePercentage = 0;
      let usersWithProjects = 0;

      Object.values(userStats).forEach(userStat => {
        // Distribución de límites
        const limit = userStat.limit;
        stats.limits_distribution[limit] = (stats.limits_distribution[limit] || 0) + 1;

        // Uso por tipo
        stats.usage_by_type.enfoque += userStat.usage.enfoque;
        stats.usage_by_type.alcance += userStat.usage.alcance;
        stats.usage_by_type.configuracion += userStat.usage.configuracion;

        // Usuarios en el límite
        if (userStat.usage.enfoque >= userStat.limit) stats.users_at_limit.enfoque++;
        if (userStat.usage.alcance >= userStat.limit) stats.users_at_limit.alcance++;
        if (userStat.usage.configuracion >= userStat.limit) stats.users_at_limit.configuracion++;

        // Porcentaje de uso promedio
        const totalUsed = userStat.usage.enfoque + userStat.usage.alcance + userStat.usage.configuracion;
        const maxPossible = userStat.limit * 3; // 3 tipos de decisión
        if (maxPossible > 0) {
          totalUsagePercentage += (totalUsed / maxPossible) * 100;
          usersWithProjects++;
        }
      });

      stats.average_usage_percentage = usersWithProjects > 0 ? totalUsagePercentage / usersWithProjects : 0;

      res.json({
        statistics: stats,
        top_users: Object.entries(userStats)
          .map(([userId, stats]) => ({
            user_id: userId,
            email: stats.email,
            limit: stats.limit,
            usage: stats.usage,
            total_used: stats.usage.enfoque + stats.usage.alcance + stats.usage.configuracion,
            usage_percentage: ((stats.usage.enfoque + stats.usage.alcance + stats.usage.configuracion) / (stats.limit * 3)) * 100
          }))
          .sort((a, b) => b.total_used - a.total_used)
          .slice(0, 10),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de capas:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // ===================================================================
  // GESTIÓN DE CÓDIGOS DE INVITACIÓN CON LÍMITES PERSONALIZADOS
  // ===================================================================

  // Endpoint para obtener códigos de invitación
  app.get('/api/admin/invitation-codes', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a este endpoint'
        });
      }

      console.log(`👑 Admin ${user.profile.email} consultando códigos de invitación`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      const { status, user_type, limit = 50 } = req.query;

      // Construir query base
      let query = supabase
        .from('invitation_codes')
        .select('*')
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (status === 'active') {
        query = query.eq('used', false).gte('expires_at', new Date().toISOString());
      } else if (status === 'used') {
        query = query.eq('used', true);
      } else if (status === 'expired') {
        query = query.lt('expires_at', new Date().toISOString());
      }

      if (user_type) {
        query = query.eq('user_type', user_type);
      }

      query = query.limit(parseInt(limit));

      const { data: codes, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo códigos de invitación:', error);
        return res.status(500).json({
          error: 'Error consultando códigos',
          message: error.message
        });
      }

      // Calcular estadísticas
      const stats = {
        total: codes.length,
        active: codes.filter(c => !c.used && (!c.expires_at || new Date(c.expires_at) > new Date())).length,
        used: codes.filter(c => c.used).length,
        expired: codes.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length,
        by_type: {}
      };

      codes.forEach(code => {
        const type = code.user_type || 'Beta';
        stats.by_type[type] = (stats.by_type[type] || 0) + 1;
      });

      res.json({
        codes,
        statistics: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error obteniendo códigos de invitación:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Endpoint para crear código de invitación con límites personalizados
  app.post('/api/admin/invitation-codes', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden crear códigos'
        });
      }

      const { 
        code, 
        description, 
        user_type = 'Beta', 
        credits = 100, 
        layerslimit = 3,
        max_uses = 1,
        expires_at 
      } = req.body;

      if (!code || !description) {
        return res.status(400).json({
          error: 'Datos incompletos',
          message: 'Código y descripción son requeridos'
        });
      }

      // Validar límites
      if (layerslimit < 1 || layerslimit > 50) {
        return res.status(400).json({
          error: 'Límite inválido',
          message: 'El límite de capas debe estar entre 1 y 50'
        });
      }

      console.log(`👑 Admin ${user.profile.email} creando código de invitación: ${code}`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      // Crear el código
      const { data: newCode, error: createError } = await supabase
        .from('invitation_codes')
        .insert([{
          code: code.toUpperCase(),
          description,
          created_by: user.profile.id,
          user_type,
          credits: parseInt(credits),
          layerslimit: parseInt(layerslimit),
          max_uses: parseInt(max_uses),
          expires_at: expires_at || null
        }])
        .select()
        .single();

      if (createError) {
        if (createError.code === '23505') {
          return res.status(409).json({
            error: 'Código duplicado',
            message: 'Ya existe un código con ese nombre'
          });
        }
        console.error('❌ Error creando código:', createError);
        return res.status(500).json({
          error: 'Error creando código',
          message: createError.message
        });
      }

      // Registrar en logs
      const logData = {
        user_email: user.profile.email,
        operation: 'create_invitation_code',
        details: {
          code: newCode.code,
          user_type,
          credits,
          layerslimit,
          max_uses,
          description
        },
        credits_used: 0,
        success: true,
        timestamp: new Date().toISOString()
      };

      await supabase.from('usage_logs').insert([logData]);

      res.json({
        success: true,
        message: 'Código de invitación creado correctamente',
        code: newCode
      });

    } catch (error) {
      console.error('❌ Error creando código de invitación:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Endpoint para actualizar código de invitación
  app.put('/api/admin/invitation-codes/:codeId', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden modificar códigos'
        });
      }

      const { codeId } = req.params;
      const { 
        description, 
        user_type, 
        credits, 
        layerslimit,
        max_uses,
        expires_at 
      } = req.body;

      // Validar límites si se proporcionan
      if (layerslimit && (layerslimit < 1 || layerslimit > 50)) {
        return res.status(400).json({
          error: 'Límite inválido',
          message: 'El límite de capas debe estar entre 1 y 50'
        });
      }

      console.log(`👑 Admin ${user.profile.email} actualizando código de invitación: ${codeId}`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      // Obtener código antes del cambio
      const { data: beforeCode, error: beforeError } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('id', codeId)
        .single();

      if (beforeError) {
        return res.status(404).json({
          error: 'Código no encontrado',
          message: beforeError.message
        });
      }

      // Preparar datos de actualización
      const updateData = {};
      if (description !== undefined) updateData.description = description;
      if (user_type !== undefined) updateData.user_type = user_type;
      if (credits !== undefined) updateData.credits = parseInt(credits);
      if (layerslimit !== undefined) updateData.layerslimit = parseInt(layerslimit);
      if (max_uses !== undefined) updateData.max_uses = parseInt(max_uses);
      if (expires_at !== undefined) updateData.expires_at = expires_at;

      // Actualizar el código
      const { data: updatedCode, error: updateError } = await supabase
        .from('invitation_codes')
        .update(updateData)
        .eq('id', codeId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error actualizando código:', updateError);
        return res.status(500).json({
          error: 'Error actualizando código',
          message: updateError.message
        });
      }

      // Registrar en logs
      const logData = {
        user_email: user.profile.email,
        operation: 'update_invitation_code',
        details: {
          code_id: codeId,
          code: beforeCode.code,
          changes: updateData,
          before: {
            user_type: beforeCode.user_type,
            credits: beforeCode.credits,
            layerslimit: beforeCode.layerslimit,
            max_uses: beforeCode.max_uses
          }
        },
        credits_used: 0,
        success: true,
        timestamp: new Date().toISOString()
      };

      await supabase.from('usage_logs').insert([logData]);

      res.json({
        success: true,
        message: 'Código actualizado correctamente',
        code: updatedCode,
        changes: updateData
      });

    } catch (error) {
      console.error('❌ Error actualizando código de invitación:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Endpoint para eliminar código de invitación
  app.delete('/api/admin/invitation-codes/:codeId', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden eliminar códigos'
        });
      }

      const { codeId } = req.params;

      console.log(`👑 Admin ${user.profile.email} eliminando código de invitación: ${codeId}`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      // Obtener información del código antes de eliminar
      const { data: codeToDelete, error: getError } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('id', codeId)
        .single();

      if (getError) {
        return res.status(404).json({
          error: 'Código no encontrado',
          message: getError.message
        });
      }

      // Eliminar el código
      const { error: deleteError } = await supabase
        .from('invitation_codes')
        .delete()
        .eq('id', codeId);

      if (deleteError) {
        console.error('❌ Error eliminando código:', deleteError);
        return res.status(500).json({
          error: 'Error eliminando código',
          message: deleteError.message
        });
      }

      // Registrar en logs
      const logData = {
        user_email: user.profile.email,
        operation: 'delete_invitation_code',
        details: {
          deleted_code: codeToDelete.code,
          user_type: codeToDelete.user_type,
          credits: codeToDelete.credits,
          layerslimit: codeToDelete.layerslimit,
          was_used: codeToDelete.used
        },
        credits_used: 0,
        success: true,
        timestamp: new Date().toISOString()
      };

      await supabase.from('usage_logs').insert([logData]);

      res.json({
        success: true,
        message: 'Código eliminado correctamente',
        deleted_code: codeToDelete.code
      });

    } catch (error) {
      console.error('❌ Error eliminando código de invitación:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Endpoint para generar código automáticamente
  app.post('/api/admin/invitation-codes/generate', verifyUserAccess, async (req, res) => {
    try {
      const user = req.user;
      
      // Verificar que el usuario sea admin
      if (user.profile.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden generar códigos'
        });
      }

      const { 
        prefix = 'PRESS',
        description, 
        user_type = 'Beta', 
        credits = 100, 
        layerslimit = 3,
        max_uses = 1,
        expires_at 
      } = req.body;

      if (!description) {
        return res.status(400).json({
          error: 'Descripción requerida',
          message: 'La descripción es requerida para generar un código'
        });
      }

      console.log(`👑 Admin ${user.profile.email} generando código automático con prefijo: ${prefix}`);

      if (!supabase) {
        return res.status(503).json({
          error: 'Base de datos no configurada',
          message: 'Supabase no está disponible'
        });
      }

      // Generar código único
      const { data: generatedCode, error: generateError } = await supabase
        .rpc('generate_invitation_code', { 
          code_prefix: prefix,
          code_length: 8 
        });

      if (generateError) {
        console.error('❌ Error generando código:', generateError);
        return res.status(500).json({
          error: 'Error generando código',
          message: generateError.message
        });
      }

      // Crear el código con el código generado
      const { data: newCode, error: createError } = await supabase
        .from('invitation_codes')
        .insert([{
          code: generatedCode,
          description,
          created_by: user.profile.id,
          user_type,
          credits: parseInt(credits),
          layerslimit: parseInt(layerslimit),
          max_uses: parseInt(max_uses),
          expires_at: expires_at || null
        }])
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creando código generado:', createError);
        return res.status(500).json({
          error: 'Error creando código',
          message: createError.message
        });
      }

      // Registrar en logs
      const logData = {
        user_email: user.profile.email,
        operation: 'generate_invitation_code',
        details: {
          generated_code: newCode.code,
          user_type,
          credits,
          layerslimit,
          max_uses,
          description
        },
        credits_used: 0,
        success: true,
        timestamp: new Date().toISOString()
      };

      await supabase.from('usage_logs').insert([logData]);

      res.json({
        success: true,
        message: 'Código generado exitosamente',
        code: newCode
      });

    } catch (error) {
      console.error('❌ Error generando código de invitación:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });

  // Verificar autenticación de administrador
  app.get('/auth/check', verifyUserAccess, async (req, res) => {
    try {
      const { user } = req;
      
      // Verificar si el usuario es admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error obteniendo perfil:', profileError);
        return res.status(500).json({ 
          success: false, 
          message: 'Error verificando permisos',
          isAdmin: false
        });
      }

      const isAdmin = profileData.role === 'admin';
      
      res.json({
        success: true,
        isAdmin: isAdmin,
        user: {
          id: user.id,
          email: user.email,
          role: profileData.role
        }
      });

    } catch (error) {
      console.error('Error en verificación de admin:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor',
        isAdmin: false
      });
    }
  });

  // Login de administrador (redirigir a Supabase Auth)
  app.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email y contraseña son requeridos'
        });
      }

      // Intentar autenticación con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        console.error('Error en login admin:', error);
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar que el usuario sea admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || profileData.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: se requieren permisos de administrador'
        });
      }

      // Configurar sesión
      req.session.userId = data.user.id;
      req.session.userEmail = data.user.email;
      req.session.userRole = profileData.role;

      res.json({
        success: true,
        message: 'Login exitoso',
        user: {
          id: data.user.id,
          email: data.user.email,
          role: profileData.role
        }
      });

    } catch (error) {
      console.error('Error en login admin:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  });

  // Logout de administrador
  app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error cerrando sesión'
        });
      }
      
      res.clearCookie('connect.sid');
      res.json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    });
  });
}

module.exports = setupAdminRoutes; 