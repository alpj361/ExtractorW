const supabase = require('../utils/supabase');

// ===================================================================
// SERVICIO DE MEMORIES
// Gestión de memoria de conversaciones para Vizta Chat
// ===================================================================

/**
 * Guarda un mensaje en la tabla memories
 * @param {Object} messageData - Datos del mensaje
 * @param {string} messageData.sessionId - ID de la sesión
 * @param {string} messageData.userId - ID del usuario
 * @param {string} messageData.role - Rol: 'user', 'assistant', 'system'
 * @param {string} messageData.content - Contenido del mensaje
 * @param {string} messageData.messageType - Tipo: 'message', 'function_call', 'function_result', 'system_info'
 * @param {number} messageData.tokensUsed - Tokens consumidos
 * @param {string} messageData.modelUsed - Modelo utilizado
 * @param {Array} messageData.toolsUsed - Herramientas utilizadas
 * @param {Array} messageData.contextSources - Fuentes de contexto
 * @param {Object} messageData.metadata - Metadatos adicionales (se guarda en conversation_metadata)
 */
async function saveMessage(messageData) {
  try {
    const {
      sessionId,
      userId,
      role,
      content,
      messageType = 'message',
      tokensUsed = 0,
      modelUsed = null,
      toolsUsed = [],
      contextSources = [],
      metadata = {}
    } = messageData;

    const { data, error } = await supabase
      .from('memories')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: role,
        content: content,
        message_type: messageType,
        tokens_used: tokensUsed,
        model_used: modelUsed,
        tools_used: toolsUsed,
        context_sources: contextSources,
        conversation_metadata: metadata
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error guardando mensaje en memories:', error);
      throw error;
    }

    console.log(`💾 Mensaje guardado en memories: ${role} - ${content.substring(0, 50)}...`);
    return data;

  } catch (error) {
    console.error('❌ Error en saveMessage:', error);
    throw error;
  }
}

/**
 * Obtiene los últimos N mensajes de una sesión
 * @param {string} sessionId - ID de la sesión
 * @param {number} limit - Número máximo de mensajes (default: 10)
 * @returns {Array} Array de mensajes ordenados cronológicamente
 */
async function getSessionMessages(sessionId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error obteniendo mensajes de sesión:', error);
      throw error;
    }

    // Retornar en orden cronológico (más antiguos primero)
    const messages = data ? data.reverse() : [];
    console.log(`📖 Obtenidos ${messages.length} mensajes de sesión ${sessionId}`);
    
    return messages;

  } catch (error) {
    console.error('❌ Error en getSessionMessages:', error);
    throw error;
  }
}

/**
 * Obtiene todas las sesiones de un usuario
 * @param {string} userId - ID del usuario
 * @param {number} limit - Número máximo de sesiones
 * @returns {Array} Array de sesiones con información resumida
 */
async function getUserSessions(userId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select(`
        session_id,
        created_at,
        updated_at,
        content,
        role
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit * 5); // Obtener más para filtrar sesiones únicas

    if (error) {
      console.error('❌ Error obteniendo sesiones de usuario:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Agrupar por session_id y obtener información resumida
    const sessionsMap = new Map();
    
    data.forEach(message => {
      const sessionId = message.session_id;
      
      if (!sessionsMap.has(sessionId)) {
        sessionsMap.set(sessionId, {
          sessionId: sessionId,
          firstMessage: message.content,
          lastActivity: message.updated_at,
          messageCount: 1,
          hasUserMessage: message.role === 'user'
        });
      } else {
        const session = sessionsMap.get(sessionId);
        session.messageCount++;
        if (message.role === 'user' && !session.hasUserMessage) {
          session.hasUserMessage = true;
          session.firstMessage = message.content;
        }
        // Actualizar última actividad si es más reciente
        if (new Date(message.updated_at) > new Date(session.lastActivity)) {
          session.lastActivity = message.updated_at;
        }
      }
    });

    // Convertir a array y ordenar por última actividad
    const sessions = Array.from(sessionsMap.values())
      .filter(session => session.hasUserMessage) // Solo sesiones con mensajes de usuario
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
      .slice(0, limit);

    console.log(`📋 Obtenidas ${sessions.length} sesiones para usuario ${userId}`);
    return sessions;

  } catch (error) {
    console.error('❌ Error en getUserSessions:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de uso de memories para un usuario
 * @param {string} userId - ID del usuario
 * @returns {Object} Estadísticas de uso
 */
async function getUserMemoryStats(userId) {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select(`
        session_id,
        role,
        tokens_used,
        model_used,
        created_at
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error obteniendo estadísticas de memories:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        totalMessages: 0,
        totalSessions: 0,
        totalTokens: 0,
        userMessages: 0,
        assistantMessages: 0,
        modelsUsed: [],
        firstActivity: null,
        lastActivity: null
      };
    }

    // Calcular estadísticas
    const uniqueSessions = new Set(data.map(m => m.session_id));
    const totalTokens = data.reduce((sum, m) => sum + (m.tokens_used || 0), 0);
    const userMessages = data.filter(m => m.role === 'user').length;
    const assistantMessages = data.filter(m => m.role === 'assistant').length;
    const modelsUsed = [...new Set(data.map(m => m.model_used).filter(Boolean))];
    
    const dates = data.map(m => new Date(m.created_at)).sort();
    const firstActivity = dates[0];
    const lastActivity = dates[dates.length - 1];

    const stats = {
      totalMessages: data.length,
      totalSessions: uniqueSessions.size,
      totalTokens: totalTokens,
      userMessages: userMessages,
      assistantMessages: assistantMessages,
      modelsUsed: modelsUsed,
      firstActivity: firstActivity,
      lastActivity: lastActivity
    };

    console.log(`📊 Estadísticas de memories para usuario ${userId}:`, stats);
    return stats;

  } catch (error) {
    console.error('❌ Error en getUserMemoryStats:', error);
    throw error;
  }
}

/**
 * Limpia mensajes antiguos de una sesión (mantiene solo los últimos N)
 * @param {string} sessionId - ID de la sesión
 * @param {number} keepLast - Número de mensajes a mantener (default: 20)
 */
async function cleanupOldMessages(sessionId, keepLast = 20) {
  try {
    // Obtener IDs de mensajes a eliminar
    const { data: oldMessages, error: selectError } = await supabase
      .from('memories')
      .select('id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range(keepLast, 1000); // Obtener mensajes después de los últimos keepLast

    if (selectError) {
      console.error('❌ Error seleccionando mensajes antiguos:', selectError);
      throw selectError;
    }

    if (!oldMessages || oldMessages.length === 0) {
      console.log(`🧹 No hay mensajes antiguos para limpiar en sesión ${sessionId}`);
      return 0;
    }

    // Eliminar mensajes antiguos
    const idsToDelete = oldMessages.map(m => m.id);
    const { error: deleteError } = await supabase
      .from('memories')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('❌ Error eliminando mensajes antiguos:', deleteError);
      throw deleteError;
    }

    console.log(`🧹 Eliminados ${idsToDelete.length} mensajes antiguos de sesión ${sessionId}`);
    return idsToDelete.length;

  } catch (error) {
    console.error('❌ Error en cleanupOldMessages:', error);
    throw error;
  }
}

/**
 * Convierte mensajes de memories al formato esperado por OpenAI
 * @param {Array} messages - Array de mensajes de la base de datos
 * @returns {Array} Array de mensajes en formato OpenAI
 */
function formatMessagesForOpenAI(messages) {
  return messages
    .filter(msg => ['user', 'assistant', 'system'].includes(msg.role))
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }));
}

module.exports = {
  saveMessage,
  getSessionMessages,
  getUserSessions,
  getUserMemoryStats,
  cleanupOldMessages,
  formatMessagesForOpenAI
}; 