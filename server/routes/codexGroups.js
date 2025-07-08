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
 * POST /api/codex-groups/create
 * Crear un nuevo grupo de items del Codex
 */
router.post('/create', verifyUserAccess, async (req, res) => {
  const { group_name, group_description, parent_item_id } = req.body || {};

  if (!parent_item_id || !group_name) {
    return res.status(400).json({
      error: 'Parámetros faltantes',
      message: 'Se requieren parent_item_id y group_name'
    });
  }

  try {
    const userId = req.user.id;
    const groupId = require('crypto').randomUUID();

    console.log(`📁 Creando grupo "${group_name}" para usuario ${userId}`);

    // Verificar que el item existe y pertenece al usuario
    const { data: existingItem, error: checkError } = await supabase
      .from('codex_items')
      .select('id, titulo, tipo')
      .eq('id', parent_item_id)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingItem) {
      return res.status(404).json({
        error: 'Item no encontrado',
        message: 'El item especificado no existe o no tienes permisos para modificarlo'
      });
    }

    // Actualizar el item como parent del grupo
    const { data: updatedItem, error: updateError } = await supabase
      .from('codex_items')
      .update({
        group_id: groupId,
        is_group_parent: true,
        group_name: group_name.trim(),
        group_description: group_description?.trim() || '',
        part_number: null,
        total_parts: 1
      })
      .eq('id', parent_item_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error actualizando item como parent:', updateError);
      return res.status(500).json({
        error: 'Error creando grupo',
        message: updateError.message
      });
    }

    console.log(`✅ Grupo creado exitosamente: ${groupId}`);

    return res.json({
      success: true,
      group: updatedItem,
      group_id: groupId,
      message: `Grupo "${group_name}" creado exitosamente`
    });

  } catch (error) {
    console.error('❌ Error en /codex-groups/create:', error);
    await logError('/api/codex-groups/create', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error procesando creación de grupo'
    });
  }
});

/**
 * POST /api/codex-groups/add-item
 * Agregar un item a un grupo existente
 */
router.post('/add-item', verifyUserAccess, async (req, res) => {
  const { item_id, group_id, part_number } = req.body || {};

  if (!item_id || !group_id) {
    return res.status(400).json({
      error: 'Parámetros faltantes',
      message: 'Se requieren item_id y group_id'
    });
  }

  try {
    const userId = req.user.id;

    console.log(`📂 Agregando item ${item_id} al grupo ${group_id}`);

    // Verificar que el item existe y pertenece al usuario
    const { data: existingItem, error: checkError } = await supabase
      .from('codex_items')
      .select('id, titulo, tipo, group_id')
      .eq('id', item_id)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingItem) {
      return res.status(404).json({
        error: 'Item no encontrado',
        message: 'El item especificado no existe o no tienes permisos para modificarlo'
      });
    }

    // Verificar que el grupo existe y pertenece al usuario
    const { data: groupParent, error: groupError } = await supabase
      .from('codex_items')
      .select('id, group_name, total_parts')
      .eq('group_id', group_id)
      .eq('is_group_parent', true)
      .eq('user_id', userId)
      .single();

    if (groupError || !groupParent) {
      return res.status(404).json({
        error: 'Grupo no encontrado',
        message: 'El grupo especificado no existe o no tienes permisos para modificarlo'
      });
    }

    // Determinar el número de parte
    const finalPartNumber = part_number || (groupParent.total_parts + 1);

    // Actualizar el item para agregarlo al grupo
    const { data: updatedItem, error: updateError } = await supabase
      .from('codex_items')
      .update({
        group_id: group_id,
        is_group_parent: false,
        part_number: finalPartNumber
      })
      .eq('id', item_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error agregando item al grupo:', updateError);
      return res.status(500).json({
        error: 'Error agregando al grupo',
        message: updateError.message
      });
    }

    // Actualizar el total_parts del grupo
    await updateGroupTotalParts(group_id);

    console.log(`✅ Item agregado al grupo exitosamente`);

    return res.json({
      success: true,
      item: updatedItem,
      message: `Item agregado al grupo exitosamente`
    });

  } catch (error) {
    console.error('❌ Error en /codex-groups/add-item:', error);
    await logError('/api/codex-groups/add-item', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error procesando agregación al grupo'
    });
  }
});

/**
 * GET /api/codex-groups/:groupId/items
 * Obtener todos los items de un grupo
 */
router.get('/:groupId/items', verifyUserAccess, async (req, res) => {
  const { groupId } = req.params;

  try {
    const userId = req.user.id;

    const { data: groupItems, error } = await supabase
      .from('codex_items')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .order('is_group_parent', { ascending: false })
      .order('part_number', { ascending: true });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      items: groupItems || [],
      count: groupItems?.length || 0
    });

  } catch (error) {
    console.error('❌ Error en /codex-groups/:groupId/items:', error);
    await logError('/api/codex-groups/:groupId/items', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error obteniendo items del grupo'
    });
  }
});

/**
 * GET /api/codex-groups/:groupId/stats
 * Obtener estadísticas de un grupo
 */
router.get('/:groupId/stats', verifyUserAccess, async (req, res) => {
  const { groupId } = req.params;

  try {
    const userId = req.user.id;

    // Obtener items del grupo para calcular estadísticas
    const { data: groupItems, error } = await supabase
      .from('codex_items')
      .select('tamano, tipo')
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    if (!groupItems || groupItems.length === 0) {
      return res.status(404).json({
        error: 'Grupo no encontrado',
        message: 'El grupo especificado no existe o no tienes permisos para accederlo'
      });
    }

    // Calcular estadísticas
    const totalSize = groupItems.reduce((acc, item) => acc + (item.tamano || 0), 0);
    const itemCount = groupItems.length;
    const typeStats = groupItems.reduce((acc, item) => {
      acc[item.tipo] = (acc[item.tipo] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      stats: {
        item_count: itemCount,
        total_size: totalSize,
        type_breakdown: typeStats
      }
    });

  } catch (error) {
    console.error('❌ Error en /codex-groups/:groupId/stats:', error);
    await logError('/api/codex-groups/:groupId/stats', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error obteniendo estadísticas del grupo'
    });
  }
});

/**
 * DELETE /api/codex-groups/:groupId
 * Eliminar un grupo completo
 */
router.delete('/:groupId', verifyUserAccess, async (req, res) => {
  const { groupId } = req.params;

  try {
    const userId = req.user.id;

    // Verificar que el grupo existe y pertenece al usuario
    const { data: groupItems, error: checkError } = await supabase
      .from('codex_items')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (checkError) {
      throw checkError;
    }

    if (!groupItems || groupItems.length === 0) {
      return res.status(404).json({
        error: 'Grupo no encontrado',
        message: 'El grupo especificado no existe o no tienes permisos para eliminarlo'
      });
    }

    // Eliminar todos los items del grupo
    const { error: deleteError } = await supabase
      .from('codex_items')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`✅ Grupo ${groupId} eliminado exitosamente`);

    return res.json({
      success: true,
      message: 'Grupo eliminado exitosamente',
      deleted_items: groupItems.length
    });

  } catch (error) {
    console.error('❌ Error en /codex-groups/:groupId DELETE:', error);
    await logError('/api/codex-groups/:groupId DELETE', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error eliminando grupo'
    });
  }
});

/**
 * POST /api/codex-groups/create-bulk
 * Crear un grupo con múltiples items de una vez
 */
router.post('/create-bulk', verifyUserAccess, async (req, res) => {
  const { group_name, group_description, items } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Parámetros faltantes',
      message: 'Se requiere un array de items'
    });
  }

  if (!group_name) {
    return res.status(400).json({
      error: 'Parámetros faltantes', 
      message: 'Se requiere group_name'
    });
  }

  try {
    const userId = req.user.id;
    const groupId = require('crypto').randomUUID();

    console.log(`📁 Creando grupo bulk "${group_name}" con ${items.length} items para usuario ${userId}`);

    // Preparar todos los items para insertar
    const itemsToInsert = items.map((item, index) => ({
      id: require('crypto').randomUUID(),
      user_id: userId,
      tipo: item.tipo || 'enlace',
      titulo: index === 0 ? group_name : `${group_name} - ${item.titulo || 'Item ' + (index + 1)}`,
      descripcion: item.descripcion || '',
      etiquetas: item.etiquetas || [],
      proyecto: item.proyecto || 'Sin proyecto',
      url: item.url,
      fecha: new Date().toISOString(),
      // Configuración de grupo
      group_id: groupId,
      is_group_parent: index === 0, // El primer item es el parent
      group_name: index === 0 ? group_name : null,
      group_description: index === 0 ? (group_description || '') : null,
      part_number: index === 0 ? null : index + 1,
      total_parts: index === 0 ? items.length : null
    }));

    console.log(`📝 Insertando ${itemsToInsert.length} items en grupo...`);

    // Insertar todos los items de una vez
    const { data: insertedItems, error: insertError } = await supabase
      .from('codex_items')
      .insert(itemsToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error insertando items:', insertError);
      return res.status(500).json({
        error: 'Error creando grupo',
        message: insertError.message
      });
    }

    console.log(`✅ Grupo bulk creado exitosamente: ${groupId} con ${insertedItems.length} items`);

    const parentItem = insertedItems.find(item => item.is_group_parent);

    return res.json({
      success: true,
      group: parentItem,
      group_id: groupId,
      items: insertedItems,
      message: `Grupo "${group_name}" creado exitosamente con ${items.length} items`
    });

  } catch (error) {
    console.error('❌ Error en /codex-groups/create-bulk:', error);
    await logError('/api/codex-groups/create-bulk', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message || 'Error procesando creación de grupo bulk'
    });
  }
});

/**
 * Función auxiliar para actualizar el total_parts de un grupo
 */
async function updateGroupTotalParts(groupId) {
  try {
    // Contar todos los items del grupo
    const { count, error: countError } = await supabase
      .from('codex_items')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (countError) {
      console.error('Error contando items del grupo:', countError);
      return;
    }

    // Actualizar el parent con el total actual
    const { error: updateError } = await supabase
      .from('codex_items')
      .update({ total_parts: count })
      .eq('group_id', groupId)
      .eq('is_group_parent', true);

    if (updateError) {
      console.error('Error actualizando total_parts:', updateError);
    }
  } catch (error) {
    console.error('Error en updateGroupTotalParts:', error);
  }
}

function setupCodexGroupsRoutes(app) {
  app.use('/api/codex-groups', router);
}

module.exports = setupCodexGroupsRoutes; 