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
 * Función para convertir fecha de Nitter a formato ISO
 * Copiada de nitterProfile.js para compatibilidad
 */
const parseNitterDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // 1) Fechas relativas "3m", "2h", etc.
    const relMatch = /(?:hace\s+)?(\d+)\s*(min|m|h|d|w|y)/i.exec(dateString);
    if (relMatch) {
      const now = new Date();
      const value = parseInt(relMatch[1], 10);
      const unitRaw = relMatch[2].toLowerCase();
      const unit = unitRaw === 'min' ? 'm' : unitRaw;
      
      switch (unit) {
        case 'm':
          now.setMinutes(now.getMinutes() - value);
          break;
        case 'h':
          now.setHours(now.getHours() - value);
          break;
        case 'd':
          now.setDate(now.getDate() - value);
          break;
        case 'w':
          now.setDate(now.getDate() - value * 7);
          break;
        case 'y':
          now.setFullYear(now.getFullYear() - value);
          break;
        case 's':
          now.setSeconds(now.getSeconds() - value);
          break;
        default:
          break;
      }
      
      return now.toISOString();
    }
    
    // 2) Fechas absolutas con o sin año.
    //   Ejemplos: "May 30, 2025 · 11:10 PM UTC"  |  "May 30 · 11:10 PM UTC"
    const currentYear = new Date().getFullYear();
    let cleanDate = dateString.replace(' · ', ' ').replace(' UTC', '');
    
    // Agregar año actual si falta.
    if (!/\d{4}/.test(cleanDate)) {
      cleanDate = `${cleanDate} ${currentYear}`;
    }
    
    const date = new Date(`${cleanDate} UTC`);
    
    // Si el parse falla, devolver now.
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    
    // Si año poco probable (<2006) asumir año actual
    if (date.getFullYear() < 2006) {
      date.setFullYear(currentYear);
    }
    
    return date.toISOString();
  } catch (error) {
    console.error(`Error parseando fecha "${dateString}":`, error.message);
    return new Date().toISOString();
  }
};

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
      limit = 20, 
      project_id = null, 
      query = null,
      type = null,
      tags = null 
    } = options;

    let queryBuilder = supabase
      .from('codex_items')
      .select(`
        id,
        titulo,
        descripcion,
        tipo,
        etiquetas,
        proyecto,
        project_id,
        storage_path,
        url,
        nombre_archivo,
        tamano,
        fecha,
        created_at,
        is_drive,
        drive_file_id,
        audio_transcription,
        document_analysis,
        recent_scrape_id,
        recent_scrapes:recent_scrape_id (
          id,
          query_original,
          query_clean,
          herramienta,
          categoria,
          tweet_id,
          usuario,
          fecha_tweet,
          texto,
          enlace,
          likes,
          retweets,
          replies,
          verified,
          sentimiento,
          location,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (project_id) {
      queryBuilder = queryBuilder.eq('project_id', project_id);
    }
    
    if (type) {
      queryBuilder = queryBuilder.eq('tipo', type);
    }
    
    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.overlaps('etiquetas', tags);
    }
    
    if (query) {
      queryBuilder = queryBuilder.or(`titulo.ilike.%${query}%,descripcion.ilike.%${query}%`);
    }
    
    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching user codex:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Mapear los datos para incluir recent_scrape en el nivel superior
    const mappedData = (data || []).map(item => ({
      ...item,
      recent_scrape: item.recent_scrapes || null
    }));

    return {
      success: true,
      data: mappedData,
      count: mappedData.length
    };

  } catch (error) {
    console.error('Error in getUserCodex:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
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
    const { limit = 10, project_id = null } = options;

    let queryBuilder = supabase
      .from('codex_items')
      .select(`
        id,
        titulo,
        descripcion,
        tipo,
        etiquetas,
        proyecto,
        project_id,
        storage_path,
        url,
        nombre_archivo,
        tamano,
        fecha,
        created_at,
        audio_transcription,
        document_analysis
      `)
      .eq('user_id', userId);

    // Apply project filter if specified
    if (project_id) {
      queryBuilder = queryBuilder.eq('project_id', project_id);
    }

    // Search in multiple fields
    queryBuilder = queryBuilder.or(
      `titulo.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%,audio_transcription.ilike.%${searchQuery}%,document_analysis.ilike.%${searchQuery}%`
    );

    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error searching user codex:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Calculate relevance scores (simple implementation)
    const results = (data || []).map(item => {
      let relevanceScore = 0;
      const lowerQuery = searchQuery.toLowerCase();
      
      if (item.titulo && item.titulo.toLowerCase().includes(lowerQuery)) {
        relevanceScore += 3;
      }
      if (item.descripcion && item.descripcion.toLowerCase().includes(lowerQuery)) {
        relevanceScore += 2;
      }
      if (item.audio_transcription && item.audio_transcription.toLowerCase().includes(lowerQuery)) {
        relevanceScore += 1;
      }
      if (item.document_analysis && item.document_analysis.toLowerCase().includes(lowerQuery)) {
        relevanceScore += 1;
      }
      
      return {
        ...item,
        relevance_score: relevanceScore
      };
    });

    // Sort by relevance score
    results.sort((a, b) => b.relevance_score - a.relevance_score);

    return {
      success: true,
      data: results,
      count: results.length,
      query: searchQuery
    };

  } catch (error) {
    console.error('Error in searchUserCodex:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Obtiene estadísticas generales del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Estadísticas del usuario
 */
async function getUserStats(userId) {
  try {
    console.log(`📈 Calculando estadísticas globales del usuario: ${userId}`);

    // Contar proyectos
    const { count: projectsCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Contar decisiones
    const { count: decisionsCount } = await supabase
      .from('project_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Contar items de codex
    const { count: codexCount } = await supabase
      .from('codex_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return {
      success: true,
      stats: {
        projects: projectsCount || 0,
        decisions: decisionsCount || 0,
        codex_items: codexCount || 0
      }
    };
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene hallazgos (capturado_cards) de un proyecto
 */
async function getProjectFindings(projectId, options = {}) {
  const { limit = 50 } = options;
  const { data, error } = await supabase
    .from('capturado_cards')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Error obteniendo hallazgos: ${error.message}`);
  return data || [];
}

/**
 * Obtiene coberturas de un proyecto
 */
async function getProjectCoverages(projectId, filters = {}) {
  let query = supabase
    .from('project_coverages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (filters.type) query = query.eq('coverage_type', filters.type);
  if (filters.status) query = query.eq('coverage_status', filters.status);
  if (filters.source) query = query.eq('detection_source', filters.source);
  const { data, error } = await query;
  if (error) throw new Error(`Error obteniendo coberturas: ${error.message}`);
  return data || [];
}

/**
 * Obtiene estadísticas de coberturas por proyecto
 */
async function getProjectCoveragesStats(projectId) {
  const { data, error } = await supabase
    .from('project_coverages')
    .select('coverage_type, detection_source, coverage_status, relevance')
    .eq('project_id', projectId);
  if (error) throw new Error(`Error obteniendo estadísticas de coberturas: ${error.message}`);
  const stats = { total: data.length, by_type: {}, by_source: {}, by_status: {}, by_relevance: {} };
  data.forEach(c => {
    stats.by_type[c.coverage_type] = (stats.by_type[c.coverage_type] || 0) + 1;
    stats.by_source[c.detection_source] = (stats.by_source[c.detection_source] || 0) + 1;
    stats.by_status[c.coverage_status] = (stats.by_status[c.coverage_status] || 0) + 1;
    stats.by_relevance[c.relevance] = (stats.by_relevance[c.relevance] || 0) + 1;
  });
  return stats;
}

/**
 * Obtiene el último snapshot de tendencias (incluye about y statistics)
 */
async function getLatestTrends() {
  const { data, error } = await supabase
    .from('trends')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Error obteniendo últimas tendencias: ${error.message}`);
  return (data && data[0]) ? data[0] : null;
}

// -------------------------------------------------------------
// Exportar funciones públicas del servicio
// -------------------------------------------------------------

module.exports = {
  parseNitterDate,
  getUserProjects,
  getUserCodex,
  getProjectDecisions,
  searchUserCodex,
  getUserStats,
  getProjectFindings,
  getProjectCoverages,
  getProjectCoveragesStats,
  getLatestTrends
};