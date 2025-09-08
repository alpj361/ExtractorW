const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { logUsage, logError } = require('../services/logs');
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
 * POST /api/codex/save-link
 * Save a link/item to the Codex
 * This endpoint handles saving individual items to the codex_items table
 */
router.post('/save-link', verifyUserAccess, async (req, res) => {
  const { user_id, link_data } = req.body || {};

  // Validate required fields
  if (!user_id || !link_data) {
    return res.status(400).json({
      error: 'Parámetros faltantes',
      message: 'Se requieren user_id y link_data'
    });
  }

  if (!link_data.url) {
    return res.status(400).json({
      error: 'Datos de enlace incompletos',
      message: 'Se requiere url en link_data'
    });
  }

  try {
    const userId = req.user.id;
    
    // Verify that the user_id matches the authenticated user
    if (userId !== user_id) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes permisos para guardar items para este usuario'
      });
    }

    console.log(`💾 Guardando enlace en Codex para usuario ${userId}:`, link_data.url);

    // Prepare the codex item data
    const codexItemData = {
      user_id: userId,
      tipo: link_data.type || 'enlace',
      titulo: link_data.title || 'Enlace sin título',
      descripcion: link_data.description || '',
      etiquetas: link_data.tags || [],
      proyecto: link_data.project || 'Sin proyecto',
      project_id: link_data.project_id || null,
      storage_path: null,
      url: link_data.url,
      nombre_archivo: null,
      tamano: link_data.content_length || 0,
      fecha: link_data.timestamp ? new Date(link_data.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      // Additional fields from link_data
      platform: link_data.platform || null,
      image: link_data.image || null,
      author: link_data.author || null,
      domain: link_data.domain || null,
      content: link_data.content || null,
      analyzed: false,
      original_type: link_data.type || 'enlace'
    };

    // Insert the item into codex_items
    const { data: insertedItem, error: insertError } = await supabase
      .from('codex_items')
      .insert([codexItemData])
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error insertando item en Codex:', insertError);
      return res.status(500).json({
        error: 'Error guardando en Codex',
        message: insertError.message
      });
    }

    console.log(`✅ Enlace guardado exitosamente en Codex: ${insertedItem.id}`);

    // Log usage
    await logUsage('/api/codex/save-link', userId, {
      item_id: insertedItem.id,
      url: link_data.url,
      type: link_data.type || 'enlace'
    });

    return res.json({
      success: true,
      id: insertedItem.id,
      item: insertedItem,
      message: 'Enlace guardado exitosamente en Codex'
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/save-link:', error);
    await logError('/api/codex/save-link', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error procesando guardado en Codex'
    });
  }
});

/**
 * POST /api/codex/save-link-pulse
 * Save a link/item to the Codex using Pulse user authentication
 * This is an alternative endpoint that doesn't require Supabase session
 */
router.post('/save-link-pulse', async (req, res) => {
  const { user_id, link_data, pulse_user_email } = req.body || {};

  // Validate required fields
  if (!user_id || !link_data || !pulse_user_email) {
    return res.status(400).json({
      error: 'Parámetros faltantes',
      message: 'Se requieren user_id, link_data y pulse_user_email'
    });
  }

  if (!link_data.url) {
    return res.status(400).json({
      error: 'Datos de enlace incompletos',
      message: 'Se requiere url en link_data'
    });
  }

  try {
    console.log(`💾 Guardando enlace en Codex para usuario Pulse ${user_id}:`, link_data.url);

    // Verify that the Pulse user exists in the database
    const { data: pulseUser, error: userError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', user_id)
      .eq('email', pulse_user_email)
      .single();

    if (userError || !pulseUser) {
      console.error('❌ Pulse user verification failed:', userError);
      return res.status(403).json({
        error: 'Usuario no válido',
        message: 'No se pudo verificar el usuario de Pulse Journal'
      });
    }

    // Prepare the codex item data
    const codexItemData = {
      user_id: user_id,
      tipo: link_data.type || 'enlace',
      titulo: link_data.title || 'Enlace sin título',
      descripcion: link_data.description || '',
      etiquetas: link_data.tags || [],
      proyecto: link_data.project || 'Sin proyecto',
      project_id: link_data.project_id || null,
      storage_path: null,
      url: link_data.url,
      nombre_archivo: null,
      tamano: link_data.content_length || 0,
      fecha: link_data.timestamp ? new Date(link_data.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      // Additional fields from link_data
      platform: link_data.platform || null,
      image: link_data.image || null,
      author: link_data.author || null,
      domain: link_data.domain || null,
      content: link_data.content || null,
      analyzed: false,
      original_type: link_data.type || 'enlace'
    };

    // Insert the item into codex_items
    const { data: insertedItem, error: insertError } = await supabase
      .from('codex_items')
      .insert([codexItemData])
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error insertando item en Codex:', insertError);
      return res.status(500).json({
        error: 'Error guardando en Codex',
        message: insertError.message
      });
    }

    console.log(`✅ Enlace guardado exitosamente en Codex: ${insertedItem.id}`);

    // Log usage
    await logUsage('/api/codex/save-link-pulse', user_id, {
      item_id: insertedItem.id,
      url: link_data.url,
      type: link_data.type || 'enlace'
    });

    return res.json({
      success: true,
      id: insertedItem.id,
      item: insertedItem,
      message: 'Enlace guardado exitosamente en Codex'
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/save-link-pulse:', error);
    await logError('/api/codex/save-link-pulse', error, { id: user_id }, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error procesando guardado en Codex'
    });
  }
});

/**
 * GET /api/codex/items
 * Get user's codex items with optional filtering
 */
router.get('/items', verifyUserAccess, async (req, res) => {
  const { tipo, proyecto, limit = 50, offset = 0 } = req.query;

  try {
    const userId = req.user.id;

    console.log(`📋 Obteniendo items de Codex para usuario ${userId}`);

    let query = supabase
      .from('codex_items')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    if (proyecto) {
      query = query.eq('proyecto', proyecto);
    }

    const { data: items, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      items: items || [],
      count: items?.length || 0,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/items:', error);
    await logError('/api/codex/items', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error obteniendo items de Codex'
    });
  }
});

/**
 * GET /api/codex/items/:id
 * Get a specific codex item by ID
 */
router.get('/items/:id', verifyUserAccess, async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;

    console.log(`📄 Obteniendo item de Codex ${id} para usuario ${userId}`);

    const { data: item, error } = await supabase
      .from('codex_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Item no encontrado',
          message: 'El item especificado no existe o no tienes permisos para accederlo'
        });
      }
      throw error;
    }

    return res.json({
      success: true,
      item: item
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/items/:id:', error);
    await logError('/api/codex/items/:id', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error obteniendo item de Codex'
    });
  }
});

/**
 * DELETE /api/codex/items/:id
 * Delete a specific codex item by ID
 */
router.delete('/items/:id', verifyUserAccess, async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;

    console.log(`🗑️ Eliminando item de Codex ${id} para usuario ${userId}`);

    const { data: deletedItem, error } = await supabase
      .from('codex_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Item no encontrado',
          message: 'El item especificado no existe o no tienes permisos para eliminarlo'
        });
      }
      throw error;
    }

    console.log(`✅ Item eliminado exitosamente: ${id}`);

    return res.json({
      success: true,
      message: 'Item eliminado exitosamente',
      deleted_item: deletedItem
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/items/:id DELETE:', error);
    await logError('/api/codex/items/:id DELETE', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error eliminando item de Codex'
    });
  }
});

function setupCodexRoutes(app) {
  app.use('/api/codex', router);
}

module.exports = setupCodexRoutes;
