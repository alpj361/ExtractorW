const express = require('express');
const router = express.Router();

const { verifyUserAccess } = require('../middlewares/auth');
const { logUsage, logError } = require('../services/logs');
const { createCardsFromCodex } = require('../services/capturados');
const supabaseUtil = require('../utils/supabase');
const { createClient } = require('@supabase/supabase-js');

let supabase = supabaseUtil;

// Re-crear cliente con service_role si existe para evitar RLS en lecturas
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });
}

/**
 * POST /api/capturados/from-codex
 * Extrae tarjetas "capturado" desde la transcripción de un codex_item
 * Body params: { codex_item_id: UUID, project_id: UUID }
 */
router.post('/from-codex', verifyUserAccess, async (req, res) => {
  const { codex_item_id, project_id } = req.body || {};

  if (!codex_item_id || !project_id) {
    return res.status(400).json({
      error: 'Parámetros faltantes',
      message: 'Se requieren codex_item_id y project_id'
    });
  }

  try {
    const insertedCards = await createCardsFromCodex({
      codexItemId: codex_item_id,
      projectId: project_id,
      userId: req.user.id
    });

    // Estimar tokens consumidos (aprox 4 chars por token)
    req.tokens_consumed = Math.ceil(JSON.stringify(insertedCards).length / 4);
    req.dollars_consumed = 0; // Ajusta si deseas calcular costo

    await logUsage(req.user, '/api/capturados/from-codex', 0, req); // Gratis por ahora
    req.usage_logged = true;

    return res.json({
      success: true,
      count: insertedCards.length,
      cards: insertedCards
    });
  } catch (error) {
    console.error('❌ Error en /capturados/from-codex:', error);
    await logError('/api/capturados/from-codex', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error procesando capturados'
    });
  }
});

/**
 * GET /api/capturados
 * Obtiene tarjetas capturado por project_id (query param)
 */
router.get('/', verifyUserAccess, async (req, res) => {
  const { project_id } = req.query;

  if (!project_id) {
    return res.status(400).json({
      error: 'Parámetro faltante',
      message: 'Se requiere project_id en query string'
    });
  }

  try {
    const { data, error } = await supabase
      .from('capturado_cards')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({ count: data.length, cards: data });
  } catch (error) {
    console.error('❌ Error en GET /capturados:', error);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error obteniendo capturados'
    });
  }
});

/**
 * POST /api/capturados
 * Crea una tarjeta capturado manualmente
 * Body params: { project_id, entity?, city?, department?, description?, discovery?, amount?, currency?, source?, start_date?, duration_days? }
 */
router.post('/', verifyUserAccess, async (req, res) => {
  const {
    project_id,
    entity,
    city,
    department,
    description,
    discovery,
    amount,
    currency,
    source,
    start_date,
    duration_days,
    counter,
    percentage,
    quantity,
    // Duración avanzada
    duration_text,
    duration_years,
    duration_months,
    duration_hours,
    duration_minutes,
    // Tiempo/periodo avanzado
    time_type, // 'day'|'year_range'|'decade'|'custom'
    time_date, // YYYY-MM-DD for 'day'
    time_start_year,
    time_end_year,
    time_decade_start_year, // ej 1990 -> 1990s
    time_lower_date, // custom lower YYYY-MM-DD
    time_upper_date, // custom upper YYYY-MM-DD
    time_bounds // '[]'|'[)'|'()'|'(]'
  } = req.body || {};

  if (!project_id) {
    return res.status(400).json({ error: 'Parámetro faltante', message: 'project_id requerido' });
  }

  try {
    // Helpers ---------------------------------
    function computeDurationTotalSeconds(components) {
      const days = Number(components.days || 0);
      const hours = Number(components.hours || 0);
      const minutes = Number(components.minutes || 0);
      const seconds = 0;
      return days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }

    function buildDuration() {
      // Prioridad: duration_text directa; si no, construir desde componentes
      const comp = {
        years: Number(duration_years || 0) || 0,
        months: Number(duration_months || 0) || 0,
        days: Number(duration_days || 0) || 0,
        hours: Number(duration_hours || 0) || 0,
        minutes: Number(duration_minutes || 0) || 0,
      };

      // Normaliza texto si no se provee
      const text = (duration_text && typeof duration_text === 'string')
        ? duration_text
        : `${String(comp.years).padStart(2,'0')}:${String(comp.months).padStart(2,'0')}:${String(comp.days).padStart(2,'0')}:${String(comp.hours).padStart(2,'0')}:${String(comp.minutes).padStart(2,'0')}`;

      // Total en segundos: solo días/horas/minutos para exactitud
      const totalSeconds = computeDurationTotalSeconds(comp);
      return { text, totalSeconds, components: comp };
    }

    function toISODate(d) {
      return d && typeof d === 'string' ? d : null;
    }

    function daterangeText(lower, upper, bounds = '[)') {
      return `${bounds[0]}${lower || ''},${upper || ''}${bounds[1]}`;
    }

    function addDays(dateStr, days) {
      const d = new Date(dateStr + 'T00:00:00Z');
      if (isNaN(d.getTime())) return null;
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0,10);
    }

    function buildTimeRange() {
      let range = null, label = null, gran = null;
      const bounds = (typeof time_bounds === 'string' && ['[]','[)','()','(]'].includes(time_bounds)) ? time_bounds : '[)';

      if (time_type === 'day' && time_date) {
        const lower = toISODate(time_date);
        const upper = addDays(lower, 1);
        if (lower && upper) {
          range = daterangeText(lower, upper, bounds);
          label = lower;
          gran = 'day';
        }
      } else if (time_type === 'year_range' && time_start_year && time_end_year) {
        const sy = Number(time_start_year), ey = Number(time_end_year);
        if (!isNaN(sy) && !isNaN(ey) && ey >= sy) {
          const lower = `${sy}-01-01`;
          const upper = `${ey + 1}-01-01`;
          range = daterangeText(lower, upper, bounds);
          label = `${sy}–${ey}`;
          gran = 'year';
        }
      } else if (time_type === 'decade' && time_decade_start_year) {
        const dy = Number(time_decade_start_year);
        if (!isNaN(dy)) {
          const lower = `${dy}-01-01`;
          const upper = `${dy + 10}-01-01`;
          range = daterangeText(lower, upper, bounds);
          label = `${dy}s`;
          gran = 'decade';
        }
      } else if (time_type === 'custom' && time_lower_date && time_upper_date) {
        const lower = toISODate(time_lower_date);
        const upper = toISODate(time_upper_date);
        if (lower && upper) {
          range = daterangeText(lower, upper, bounds);
          label = `${lower} → ${upper}`;
          gran = 'custom';
        }
      }
      return { range, label, granularity: gran };
    }

    const duration = buildDuration();
    const time = buildTimeRange();
    // Verificar permisos del usuario sobre el proyecto
    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, user_id, collaborators')
      .eq('id', project_id)
      .single();

    if (projectErr || !project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const hasAccess = project.user_id === req.user.id ||
      (project.collaborators && project.collaborators.includes(req.user.id));

    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes permisos para crear hallazgos en este proyecto' });
    }

    const insertData = {
      project_id,
      entity: entity?.trim() || null,
      city: city?.trim() || null,
      department: department?.trim() || null,
      description: description?.trim() || null,
      discovery: discovery?.trim() || null,
      amount: amount !== undefined && amount !== null ? Number(amount) : null,
      currency: currency?.trim() || null,
      source: source?.trim() || null,
      start_date: start_date || null,
      duration_days: duration_days !== undefined && duration_days !== null ? Number(duration_days) : null,
      counter: counter !== undefined && counter !== null ? Number(counter) : null,
      percentage: percentage !== undefined && percentage !== null ? Number(percentage) : null,
      quantity: quantity !== undefined && quantity !== null ? Number(quantity) : null,
      // Nuevos campos de duración/tiempo
      duration_text: duration.text || null,
      duration_total_seconds: duration.totalSeconds || null,
      duration_components: duration.components || {},
      time_range: time.range || null,
      time_label: time.label || null,
      time_granularity: time.granularity || null,
    };

    const { data: created, error: insertError } = await supabase
      .from('capturado_cards')
      .insert([insertData])
      .select('*')
      .single();

    if (insertError) throw insertError;

    await logUsage(req.user, '/api/capturados/create', 0, req);

    return res.json({ success: true, card: created });
  } catch (error) {
    console.error('❌ Error en POST /capturados:', error);
    await logError('/api/capturados/create', error, req.user, req);
    return res.status(500).json({ error: 'Error interno', message: error.message });
  }
});

// =============== BULK EXTRACTION ===============
router.post('/bulk', verifyUserAccess, async (req, res) => {
  const { project_id, codex_item_ids } = req.body || {};

  if (!project_id) {
    return res.status(400).json({ error: 'Parámetro faltante', message: 'project_id requerido' });
  }

  try {
    const { bulkCreateCardsForProject } = require('../services/capturados');
    const summary = await bulkCreateCardsForProject(project_id, req.user.id, codex_item_ids);

    await logUsage(req.user, '/api/capturados/bulk', 0, req);
    req.usage_logged = true;

    res.json({ success: true, ...summary });
  } catch (error) {
    console.error('Error bulk capturados:', error);
    await logError('/api/capturados/bulk', error, req.user, req);
    res.status(500).json({ error: 'Error interno', message: error.message });
  }
});

/**
 * DELETE /api/capturados/:id
 * Elimina una tarjeta capturado específica por ID
 */
router.delete('/:id', verifyUserAccess, async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      error: 'Parámetro faltante',
      message: 'Se requiere el ID de la tarjeta capturado'
    });
  }

  try {
    // Verificar que la tarjeta existe y pertenece a un proyecto del usuario
    const { data: card, error: fetchError } = await supabase
      .from('capturado_cards')
      .select('id, project_id')
      .eq('id', id)
      .single();

    if (fetchError || !card) {
      return res.status(404).json({
        error: 'Tarjeta no encontrada',
        message: 'La tarjeta capturado no existe o no tienes acceso a ella'
      });
    }

    // Eliminar la tarjeta
    const { error: deleteError } = await supabase
      .from('capturado_cards')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Log de la operación
    await logUsage(req.user, '/api/capturados/delete', 0, req);
    req.usage_logged = true;

    return res.json({
      success: true,
      message: 'Tarjeta eliminada exitosamente',
      deleted_id: id
    });
  } catch (error) {
    console.error('❌ Error en DELETE /capturados:', error);
    await logError('/api/capturados/delete', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error eliminando tarjeta capturado'
    });
  }
});

/**
 * PUT /api/capturados/:id
 * Actualiza los campos de una tarjeta capturado
 * Body params permitidos: entity, city, department, description, discovery
 */
router.put('/:id', verifyUserAccess, async (req, res) => {
  const { id } = req.params;
  const { entity, city, department, description, discovery } = req.body || {};

  if (!id) {
    return res.status(400).json({
      error: 'Parámetro faltante',
      message: 'Se requiere el ID de la tarjeta capturado'
    });
  }

  const updateData = {};
  if (entity !== undefined) updateData.entity = entity?.trim();
  if (city !== undefined) updateData.city = city?.trim();
  if (department !== undefined) updateData.department = department?.trim();
  if (description !== undefined) updateData.description = description?.trim();
  if (discovery !== undefined) updateData.discovery = discovery?.trim();

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      error: 'Sin cambios',
      message: 'No se proporcionaron campos para actualizar'
    });
  }

  try {
    // Verificar acceso y existencia
    const { data: card, error: fetchError } = await supabase
      .from('capturado_cards')
      .select('id, project_id')
      .eq('id', id)
      .single();

    if (fetchError || !card) {
      return res.status(404).json({
        error: 'Tarjeta no encontrada',
        message: 'La tarjeta capturado no existe o no tienes acceso a ella'
      });
    }

    // Permisos: debe pertenecer a un proyecto del usuario
    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, user_id, collaborators')
      .eq('id', card.project_id)
      .single();

    if (projectErr || !project) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const hasAccess = project.user_id === req.user.id ||
      (project.collaborators && project.collaborators.includes(req.user.id));

    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta tarjeta' });
    }

    // Actualizar
    const { data: updatedCard, error: updateError } = await supabase
      .from('capturado_cards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logUsage(req.user, '/api/capturados/update', 0, req);
    req.usage_logged = true;

    return res.json({ success: true, card: updatedCard });
  } catch (error) {
    console.error('❌ Error en PUT /capturados:', error);
    await logError('/api/capturados/update', error, req.user, req);
    return res.status(500).json({ error: 'Error interno', message: error.message });
  }
});

/**
 * DELETE /api/capturados/project/:project_id
 * Elimina todas las tarjetas capturado asociadas a un proyecto
 */
router.delete('/project/:project_id', verifyUserAccess, async (req, res) => {
  const { project_id } = req.params;

  if (!project_id) {
    return res.status(400).json({ error: 'Parámetro faltante', message: 'project_id requerido' });
  }

  try {
    // Verificar permisos del usuario sobre el proyecto
    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, user_id, collaborators')
      .eq('id', project_id)
      .single();

    if (projectErr || !project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const hasAccess = project.user_id === req.user.id ||
      (project.collaborators && project.collaborators.includes(req.user.id));

    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const { error: delErr } = await supabase
      .from('capturado_cards')
      .delete()
      .eq('project_id', project_id);

    if (delErr) throw delErr;

    await logUsage(req.user, '/api/capturados/project/delete_all', 0, req);

    return res.json({ success: true, message: 'Todos los hallazgos eliminados' });
  } catch (error) {
    console.error('Error bulk delete capturados:', error);
    return res.status(500).json({ error: 'Error interno', message: error.message });
  }
});

module.exports = router; 