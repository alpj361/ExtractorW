/**
 * Projects Engine - Manejo de Proyectos del Usuario
 * Accede y gestiona proyectos personales del usuario
 */

const supabaseClient = require('../../../utils/supabase');

class ProjectsEngine {
  constructor(robertAgent) {
    this.robert = robertAgent;
    this.supabase = supabaseClient;
  }

  /**
   * Obtener proyectos del usuario
   */
  async getUserProjects(user, options = {}) {
    try {
      const { 
        status = null, 
        limit = 10, 
        includeInactive = false,
        sortBy = 'updated_at',
        sortOrder = 'desc'
      } = options;

      let query = this.supabase
        .from('user_projects')
        .select(`
          id,
          name,
          description,
          status,
          technology_stack,
          repository_url,
          deployment_url,
          created_at,
          updated_at,
          completion_percentage,
          priority_level,
          tags,
          metadata
        `)
        .eq('user_id', user.id);

      // Filtrar por estado si se especifica
      if (status) {
        query = query.eq('status', status);
      }

      // Excluir inactivos si no se solicita
      if (!includeInactive) {
        query = query.neq('status', 'archived').neq('status', 'cancelled');
      }

      // Ordenar y limitar
      query = query.order(sortBy, { ascending: sortOrder === 'asc' }).limit(limit);

      const { data: projects, error } = await query;

      if (error) throw error;

      console.log(`[ROBERT/PROJECTS] 📊 Obtenidos ${projects.length} proyectos para usuario ${user.id}`);

      return {
        projects: projects || [],
        total: projects.length,
        hasMore: projects.length === limit,
        metadata: {
          filter: { status, includeInactive },
          sort: { sortBy, sortOrder },
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`[ROBERT/PROJECTS] ❌ Error obteniendo proyectos:`, error);
      throw new Error(`Error accediendo a proyectos: ${error.message}`);
    }
  }

  /**
   * Obtener detalles específicos de un proyecto
   */
  async getProjectDetails(user, projectId) {
    try {
      const { data: project, error } = await this.supabase
        .from('user_projects')
        .select(`
          *,
          project_tasks (
            id,
            title,
            description,
            status,
            priority,
            created_at,
            updated_at
          )
        `)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (!project) throw new Error('Proyecto no encontrado');

      console.log(`[ROBERT/PROJECTS] 🔍 Detalles obtenidos para proyecto: ${project.name}`);

      return {
        project: project,
        tasks: project.project_tasks || [],
        summary: {
          totalTasks: project.project_tasks?.length || 0,
          completedTasks: project.project_tasks?.filter(t => t.status === 'completed').length || 0,
          pendingTasks: project.project_tasks?.filter(t => t.status === 'pending').length || 0
        }
      };

    } catch (error) {
      console.error(`[ROBERT/PROJECTS] ❌ Error obteniendo detalles del proyecto:`, error);
      throw new Error(`Error accediendo a detalles del proyecto: ${error.message}`);
    }
  }

  /**
   * Obtener proyectos activos
   */
  async getActiveProjects(user) {
    return this.getUserProjects(user, { 
      status: 'active', 
      limit: 5,
      sortBy: 'updated_at',
      sortOrder: 'desc'
    });
  }

  /**
   * Obtener proyectos relevantes basado en una consulta
   */
  async getRelevantProjects(user, query) {
    try {
      const queryLower = query.toLowerCase();
      
      // Primero obtener todos los proyectos del usuario
      const allProjects = await this.getUserProjects(user, { limit: 50, includeInactive: true });
      
      // Filtrar proyectos relevantes basado en la consulta
      const relevantProjects = allProjects.projects.filter(project => {
        const searchableText = [
          project.name,
          project.description,
          ...(project.tags || []),
          ...(project.technology_stack || [])
        ].join(' ').toLowerCase();
        
        return this.isRelevantToQuery(searchableText, queryLower);
      });

      console.log(`[ROBERT/PROJECTS] 🎯 ${relevantProjects.length} proyectos relevantes para: "${query}"`);

      return {
        projects: relevantProjects.slice(0, 3), // Top 3 más relevantes
        totalRelevant: relevantProjects.length,
        query: query,
        reasoning: `Encontré proyectos relacionados con: ${this.extractKeywords(queryLower).join(', ')}`
      };

    } catch (error) {
      console.error(`[ROBERT/PROJECTS] ❌ Error obteniendo proyectos relevantes:`, error);
      throw new Error(`Error buscando proyectos relevantes: ${error.message}`);
    }
  }

  /**
   * Obtener contexto completo de proyectos para otros agentes
   */
  async getAllProjectsContext(user) {
    try {
      const [active, recent, completed] = await Promise.all([
        this.getUserProjects(user, { status: 'active', limit: 3 }),
        this.getUserProjects(user, { limit: 5, sortBy: 'updated_at' }),
        this.getUserProjects(user, { status: 'completed', limit: 2 })
      ]);

      return {
        activeProjects: active.projects,
        recentProjects: recent.projects,
        completedProjects: completed.projects,
        summary: {
          totalActive: active.total,
          totalRecent: recent.total,
          totalCompleted: completed.total
        },
        context: 'full_projects_context'
      };

    } catch (error) {
      console.error(`[ROBERT/PROJECTS] ❌ Error obteniendo contexto de proyectos:`, error);
      return { error: error.message };
    }
  }

  /**
   * Crear nuevo proyecto
   */
  async createProject(user, projectData) {
    try {
      const newProject = {
        ...projectData,
        user_id: user.id,
        status: projectData.status || 'planning',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completion_percentage: 0
      };

      const { data: project, error } = await this.supabase
        .from('user_projects')
        .insert([newProject])
        .select()
        .single();

      if (error) throw error;

      console.log(`[ROBERT/PROJECTS] ✅ Proyecto creado: ${project.name}`);

      return {
        success: true,
        project: project,
        message: `Proyecto "${project.name}" creado exitosamente`
      };

    } catch (error) {
      console.error(`[ROBERT/PROJECTS] ❌ Error creando proyecto:`, error);
      throw new Error(`Error creando proyecto: ${error.message}`);
    }
  }

  /**
   * Actualizar proyecto
   */
  async updateProject(user, projectId, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data: project, error } = await this.supabase
        .from('user_projects')
        .update(updateData)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[ROBERT/PROJECTS] 🔄 Proyecto actualizado: ${project.name}`);

      return {
        success: true,
        project: project,
        message: `Proyecto "${project.name}" actualizado exitosamente`
      };

    } catch (error) {
      console.error(`[ROBERT/PROJECTS] ❌ Error actualizando proyecto:`, error);
      throw new Error(`Error actualizando proyecto: ${error.message}`);
    }
  }

  /**
   * Verificar si un proyecto es relevante para una consulta
   */
  isRelevantToQuery(projectText, queryLower) {
    const keywords = this.extractKeywords(queryLower);
    return keywords.some(keyword => projectText.includes(keyword));
  }

  /**
   * Extraer palabras clave de una consulta
   */
  extractKeywords(query) {
    // Palabras comunes a ignorar
    const stopWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'como', 'está', 'tú', 'me', 'él', 'del', 'al'];
    
    return query
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0);
  }

  /**
   * Obtener estadísticas de proyectos
   */
  async getProjectStats(user) {
    try {
      const { data: stats, error } = await this.supabase
        .from('user_projects')
        .select('status, completion_percentage, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const projectStats = {
        total: stats.length,
        byStatus: {},
        averageCompletion: 0,
        recentActivity: 0
      };

      // Contar por estado
      stats.forEach(project => {
        projectStats.byStatus[project.status] = (projectStats.byStatus[project.status] || 0) + 1;
      });

      // Calcular promedio de completitud
      if (stats.length > 0) {
        projectStats.averageCompletion = stats.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / stats.length;
      }

      // Actividad reciente (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      projectStats.recentActivity = stats.filter(p => new Date(p.created_at) > thirtyDaysAgo).length;

      return projectStats;

    } catch (error) {
      console.error(`[ROBERT/PROJECTS] ❌ Error obteniendo estadísticas:`, error);
      return { error: error.message };
    }
  }
}

module.exports = {
  ProjectsEngine
}; 