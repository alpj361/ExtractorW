/**
 * User Data Engine - Manejo de Datos Generales del Usuario
 * Accede y gestiona información de perfil, configuraciones y datos del usuario
 */

const supabaseClient = require('../../../utils/supabase');

class UserDataEngine {
  constructor(robertAgent) {
    this.robert = robertAgent;
    this.supabase = supabaseClient;
  }

  /**
   * Obtener datos básicos del usuario
   */
  async getBasicUserData(user) {
    try {
      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select(`
          id,
          username,
          full_name,
          email,
          avatar_url,
          bio,
          location,
          website,
          created_at,
          updated_at,
          preferences,
          settings
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      console.log(`[ROBERT/USERDATA] 👤 Datos básicos obtenidos para usuario ${user.id}`);

      return {
        profile: profile || {},
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'profiles_table'
        }
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo datos básicos:`, error);
      throw new Error(`Error accediendo a datos del usuario: ${error.message}`);
    }
  }

  /**
   * Obtener datos completos del usuario
   */
  async getUserData(user, options = {}) {
    try {
      const {
        includeProfile = true,
        includePreferences = true,
        includeActivity = false,
        includeStats = false
      } = options;

      const userData = {};

      // Datos básicos del perfil
      if (includeProfile) {
        userData.profile = await this.getBasicUserData(user);
      }

      // Preferencias y configuraciones
      if (includePreferences) {
        userData.preferences = await this.getUserPreferences(user);
      }

      // Actividad reciente
      if (includeActivity) {
        userData.activity = await this.getUserActivity(user);
      }

      // Estadísticas
      if (includeStats) {
        userData.stats = await this.getUserStats(user);
      }

      console.log(`[ROBERT/USERDATA] 📊 Datos completos obtenidos para usuario ${user.id}`);

      return {
        user: userData,
        metadata: {
          includes: { includeProfile, includePreferences, includeActivity, includeStats },
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo datos del usuario:`, error);
      throw new Error(`Error accediendo a datos del usuario: ${error.message}`);
    }
  }

  /**
   * Obtener preferencias del usuario
   */
  async getUserPreferences(user) {
    try {
      const { data: preferences, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Convertir array de preferencias a objeto
      const preferencesObj = {};
      preferences.forEach(pref => {
        preferencesObj[pref.key] = pref.value;
      });

      return {
        preferences: preferencesObj,
        total: preferences.length,
        lastUpdated: preferences.length > 0 ? 
          Math.max(...preferences.map(p => new Date(p.updated_at).getTime())) : null
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo preferencias:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener actividad reciente del usuario
   */
  async getUserActivity(user, options = {}) {
    try {
      const { limit = 10, days = 7 } = options;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: activity, error } = await this.supabase
        .from('user_activity_log')
        .select(`
          id,
          action,
          resource_type,
          resource_id,
          metadata,
          created_at
        `)
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        activity: activity || [],
        period: `${days} días`,
        total: activity.length,
        types: [...new Set(activity.map(a => a.action))]
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo actividad:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener estadísticas del usuario
   */
  async getUserStats(user) {
    try {
      // Ejecutar múltiples consultas en paralelo
      const [projectStats, codexStats, activityStats] = await Promise.all([
        this.getProjectStatsForUser(user),
        this.getCodexStatsForUser(user),
        this.getActivityStatsForUser(user)
      ]);

      return {
        projects: projectStats,
        codex: codexStats,
        activity: activityStats,
        summary: {
          totalProjects: projectStats.total || 0,
          totalCodexEntries: codexStats.total || 0,
          recentActivity: activityStats.recentCount || 0
        }
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo estadísticas:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener estadísticas de proyectos para el usuario
   */
  async getProjectStatsForUser(user) {
    try {
      const { data: projects, error } = await this.supabase
        .from('user_projects')
        .select('status, created_at, completion_percentage')
        .eq('user_id', user.id);

      if (error) throw error;

      const stats = {
        total: projects.length,
        byStatus: {},
        averageCompletion: 0,
        recentProjects: 0
      };

      if (projects.length > 0) {
        // Contar por estado
        projects.forEach(p => {
          stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
        });

        // Promedio de completitud
        stats.averageCompletion = projects.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / projects.length;

        // Proyectos recientes (últimos 30 días)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        stats.recentProjects = projects.filter(p => new Date(p.created_at) > thirtyDaysAgo).length;
      }

      return stats;

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo stats de proyectos:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener estadísticas de codex para el usuario
   */
  async getCodexStatsForUser(user) {
    try {
      const { data: codex, error } = await this.supabase
        .from('codex_items')
        .select('tipo, categoria, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const stats = {
        total: codex.length,
        byType: {},
        byCategory: {},
        recentEntries: 0
      };

      if (codex.length > 0) {
        // Contar por tipo y categoría
        codex.forEach(c => {
                  if (c.tipo) stats.byType[c.tipo] = (stats.byType[c.tipo] || 0) + 1;
        if (c.categoria) stats.byCategory[c.categoria] = (stats.byCategory[c.categoria] || 0) + 1;
        });

        // Entradas recientes (últimos 30 días)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        stats.recentEntries = codex.filter(c => new Date(c.created_at) > thirtyDaysAgo).length;
      }

      return stats;

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo stats de codex:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener estadísticas de actividad para el usuario
   */
  async getActivityStatsForUser(user) {
    try {
      const { data: activity, error } = await this.supabase
        .from('user_activity_log')
        .select('action, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const stats = {
        total: activity.length,
        byAction: {},
        recentCount: 0,
        weeklyActivity: 0
      };

      if (activity.length > 0) {
        // Contar por acción
        activity.forEach(a => {
          stats.byAction[a.action] = (stats.byAction[a.action] || 0) + 1;
        });

        // Actividad reciente (últimos 7 días)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        stats.weeklyActivity = activity.filter(a => new Date(a.created_at) > sevenDaysAgo).length;

        // Actividad muy reciente (últimas 24 horas)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        stats.recentCount = activity.filter(a => new Date(a.created_at) > oneDayAgo).length;
      }

      return stats;

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo stats de actividad:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener datos relevantes del usuario basado en una consulta
   */
  async getRelevantData(user, query) {
    try {
      const queryLower = query.toLowerCase();
      const userData = {};

      // Siempre incluir datos básicos del perfil
      userData.profile = await this.getBasicUserData(user);

      // Determinar qué datos adicionales incluir basado en la consulta
      const needsPreferences = queryLower.includes('configuración') || 
                              queryLower.includes('preferencias') || 
                              queryLower.includes('settings');

      const needsActivity = queryLower.includes('actividad') || 
                           queryLower.includes('recent') || 
                           queryLower.includes('últim');

      const needsStats = queryLower.includes('estadística') || 
                        queryLower.includes('resumen') || 
                        queryLower.includes('stats');

      if (needsPreferences) {
        userData.preferences = await this.getUserPreferences(user);
      }

      if (needsActivity) {
        userData.activity = await this.getUserActivity(user, { limit: 5 });
      }

      if (needsStats) {
        userData.stats = await this.getUserStats(user);
      }

      console.log(`[ROBERT/USERDATA] 🎯 Datos relevantes obtenidos para: "${query}"`);

      return {
        userData: userData,
        query: query,
        relevantSections: Object.keys(userData),
        reasoning: `Proporcioné datos del usuario: ${Object.keys(userData).join(', ')}`
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo datos relevantes:`, error);
      throw new Error(`Error obteniendo datos relevantes: ${error.message}`);
    }
  }

  /**
   * Actualizar preferencia del usuario
   */
  async updateUserPreference(user, key, value) {
    try {
      const { data: preference, error } = await this.supabase
        .from('user_preferences')
        .upsert([
          {
            user_id: user.id,
            key: key,
            value: value,
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      console.log(`[ROBERT/USERDATA] ✅ Preferencia actualizada: ${key} = ${value}`);

      return {
        success: true,
        preference: preference,
        message: `Preferencia "${key}" actualizada`
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error actualizando preferencia:`, error);
      throw new Error(`Error actualizando preferencia: ${error.message}`);
    }
  }

  /**
   * Registrar actividad del usuario
   */
  async logUserActivity(user, action, resourceType = null, resourceId = null, metadata = {}) {
    try {
      const { data: activity, error } = await this.supabase
        .from('user_activity_log')
        .insert([
          {
            user_id: user.id,
            action: action,
            resource_type: resourceType,
            resource_id: resourceId,
            metadata: metadata,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        activity: activity
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error registrando actividad:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener configuraciones del sistema para el usuario
   */
  async getSystemSettings(user) {
    try {
      const { data: settings, error } = await this.supabase
        .from('user_system_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      return {
        settings: settings || {},
        hasCustomSettings: !!settings
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo configuraciones del sistema:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener resumen completo del usuario
   */
  async getUserSummary(user) {
    try {
      const [basicData, preferences, stats] = await Promise.all([
        this.getBasicUserData(user),
        this.getUserPreferences(user),
        this.getUserStats(user)
      ]);

      return {
        summary: {
          profile: basicData.profile,
          preferences: preferences.preferences || {},
          stats: stats
        },
        lastActivity: new Date().toISOString(),
        context: 'user_summary'
      };

    } catch (error) {
      console.error(`[ROBERT/USERDATA] ❌ Error obteniendo resumen del usuario:`, error);
      return { error: error.message };
    }
  }
}

module.exports = {
  UserDataEngine
}; 