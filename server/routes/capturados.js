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