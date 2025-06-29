// ===================================================================
// SUPABASE DATA SERVICE
// Servicio para obtener datos del usuario desde Supabase
// (proyectos, codex, decisiones, etc.)
// ===================================================================

const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase usando variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos en el archivo .env');
}

// Cliente Supabase con Service Key para acceso completo
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Obtiene proyectos del usuario con metadatos y estadísticas
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de filtrado
 * @returns {Promise<Array>} Lista de proyectos con metadatos
 */
async function getUserProjects(userId, options = {}) {
  try {
    const { limit = 20, status, priority } = options;

    console.log(`📊 Obteniendo proyectos del usuario: ${userId}`);

    let query = supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        category,
        visibility,
        tags,
        created_at,
        updated_at,
        suggestions
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    // Aplicar filtros opcionales
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: projects, error } = await query;

    if (error) {
      throw new Error(`Error obteniendo proyectos: ${error.message}`);
    }

    // Obtener estadísticas para cada proyecto
    const projectsWithStats = await Promise.all(projects.map(async (project) => {
      try {
        // Contar decisiones del proyecto
        const { count: decisionsCount } = await supabase
          .from('project_decisions')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id);

        // Contar assets/codex items del proyecto
        const { count: assetsCount } = await supabase
          .from('codex_items')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id);

        return {
          ...project,
          stats: {
            decisionsCount: decisionsCount || 0,
            assetsCount: assetsCount || 0
          }
        };
      } catch (error) {
        console.error(`Error obteniendo stats para proyecto ${project.id}:`, error);
        return {
          ...project,
          stats: {
            decisionsCount: 0,
            assetsCount: 0
          }
        };
      }
    }));

    console.log(`✅ ${projectsWithStats.length} proyectos obtenidos`);
    return projectsWithStats;

  } catch (error) {
    console.error('Error en getUserProjects:', error);
    throw error;
  }
}

/**
 * Obtiene items del Codex del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de filtrado y búsqueda
 * @returns {Promise<Array>} Lista de items del codex
 */
async function getUserCodex(userId, options = {}) {
  try {
    const { 
      projectId, 
      query: searchQuery,
      limit = 20,
      type,
      tags
    } = options;

    console.log(`📚 Obteniendo codex del usuario: ${userId}`, options);

    let query = supabase
      .from('codex_items')
      .select(`
        id,
        name,
        content,
        type,
        tags,
        project_id,
        file_name,
        file_size,
        mime_type,
        audio_transcription,
        document_analysis,
        created_at,
        updated_at,
        projects!inner(title, status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filtrar por proyecto específico
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    // Filtrar por tipo
    if (type) {
      query = query.eq('type', type);
    }

    // Búsqueda por texto (en título, contenido o transcripción)
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,audio_transcription.ilike.%${searchQuery}%`);
    }

    // Filtrar por tags
    if (tags && Array.isArray(tags)) {
      query = query.overlaps('tags', tags);
    }

    const { data: codexItems, error } = await query;

    if (error) {
      throw new Error(`Error obteniendo codex: ${error.message}`);
    }

    // Procesar y enriquecer datos
    const processedItems = codexItems.map(item => ({
      ...item,
      projectTitle: item.projects?.title || 'Sin proyecto',
      projectStatus: item.projects?.status || 'unknown',
      hasTranscription: !!item.audio_transcription,
      hasAnalysis: !!item.document_analysis,
      contentPreview: item.content ? item.content.substring(0, 200) + '...' : null,
      transcriptionPreview: item.audio_transcription ? item.audio_transcription.substring(0, 200) + '...' : null
    }));

    console.log(`✅ ${processedItems.length} items del codex obtenidos`);
    return processedItems;

  } catch (error) {
    console.error('Error en getUserCodex:', error);
    throw error;
  }
}

/**
 * Obtiene decisiones de un proyecto específico
 * @param {string} projectId - ID del proyecto
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<Array>} Lista de decisiones del proyecto
 */
async function getProjectDecisions(projectId, userId) {
  try {
    console.log(`🎯 Obteniendo decisiones del proyecto: ${projectId}`);

    // Verificar que el usuario sea dueño del proyecto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      throw new Error('Proyecto no encontrado o sin permisos');
    }

    const { data: decisions, error } = await supabase
      .from('project_decisions')
      .select(`
        id,
        title,
        description,
        decision_type,
        change_description,
        objective,
        next_steps,
        deadline,
        focus_area,
        focus_context,
        geographic_scope,
        monetary_scope,
        time_period_start,
        time_period_end,
        target_entities,
        scope_limitations,
        output_format,
        methodology,
        data_sources,
        search_locations,
        tools_required,
        references,
        created_at,
        updated_at
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error obteniendo decisiones: ${error.message}`);
    }

    console.log(`✅ ${decisions.length} decisiones obtenidas`);
    return {
      project,
      decisions
    };

  } catch (error) {
    console.error('Error en getProjectDecisions:', error);
    throw error;
  }
}

/**
 * Búsqueda general en el codex del usuario
 * @param {string} searchQuery - Término de búsqueda
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de búsqueda
 * @returns {Promise<Array>} Resultados de búsqueda
 */
async function searchUserCodex(searchQuery, userId, options = {}) {
  try {
    const { limit = 10 } = options;

    console.log(`🔍 Búsqueda en codex: "${searchQuery}" para usuario: ${userId}`);

    const { data: results, error } = await supabase
      .from('codex_items')
      .select(`
        id,
        title,
        content,
        type,
        tags,
        file_name,
        audio_transcription,
        document_analysis,
        created_at,
        projects!inner(title)
      `)
      .eq('user_id', userId)
      .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,audio_transcription.ilike.%${searchQuery}%,document_analysis.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error en búsqueda: ${error.message}`);
    }

    // Procesar resultados con relevancia
    const processedResults = results.map(item => {
      let relevanceScore = 0;
      const queryLower = searchQuery.toLowerCase();

      // Calcular score de relevancia
      if (item.title && item.title.toLowerCase().includes(queryLower)) relevanceScore += 3;
      if (item.content && item.content.toLowerCase().includes(queryLower)) relevanceScore += 2;
      if (item.audio_transcription && item.audio_transcription.toLowerCase().includes(queryLower)) relevanceScore += 2;
      if (item.document_analysis && item.document_analysis.toLowerCase().includes(queryLower)) relevanceScore += 1;
      if (item.tags && item.tags.some(tag => tag.toLowerCase().includes(queryLower))) relevanceScore += 1;

      return {
        ...item,
        projectTitle: item.projects?.title || 'Sin proyecto',
        relevanceScore,
        contentPreview: item.content ? item.content.substring(0, 150) + '...' : null
      };
    });

    // Ordenar por relevancia
    processedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`✅ ${processedResults.length} resultados encontrados`);
    return processedResults;

  } catch (error) {
    console.error('Error en searchUserCodex:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas generales del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Estadísticas del usuario
 */
async function getUserStats(userId) {
  try {
    console.log(`📈 Obteniendo estadísticas del usuario: ${userId}`);

    const [projectsResult, codexResult, decisionsResult] = await Promise.all([
      supabase.from('projects').select('status', { count: 'exact' }).eq('user_id', userId),
      supabase.from('codex_items').select('type', { count: 'exact' }).eq('user_id', userId),
      supabase.from('project_decisions').select('decision_type').eq('user_id', userId)
    ]);

    // Contar proyectos por status
    const projectsByStatus = {};
    projectsResult.data?.forEach(p => {
      projectsByStatus[p.status] = (projectsByStatus[p.status] || 0) + 1;
    });

    // Contar items del codex por tipo
    const codexByType = {};
    codexResult.data?.forEach(c => {
      codexByType[c.type] = (codexByType[c.type] || 0) + 1;
    });

    // Contar decisiones por tipo
    const decisionsByType = {};
    decisionsResult.data?.forEach(d => {
      decisionsByType[d.decision_type] = (decisionsByType[d.decision_type] || 0) + 1;
    });

    const stats = {
      totalProjects: projectsResult.count || 0,
      totalCodexItems: codexResult.count || 0,
      totalDecisions: decisionsResult.count || 0,
      projectsByStatus,
      codexByType,
      decisionsByType
    };

    console.log('✅ Estadísticas obtenidas:', stats);
    return stats;

  } catch (error) {
    console.error('Error en getUserStats:', error);
    throw error;
  }
}

module.exports = {
  getUserProjects,
  getUserCodex,
  getProjectDecisions,
  searchUserCodex,
  getUserStats
}; 