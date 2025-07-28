/**
 * Gestor de Conversaciones para Vizta
 * Mantiene contexto, estado y continuidad entre múltiples intercambios
 */

class ConversationManager {
  constructor(viztaAgent) {
    this.vizta = viztaAgent;
    this.conversations = new Map();
    this.maxConversationAge = 3600000; // 1 hora
    this.maxMessagesPerConversation = 50;
  }

  /**
   * Inicializar nueva conversación o recuperar existente
   */
  async initializeConversation(conversationId, initialContext = {}) {
    console.log(`[CONV_MANAGER] 🆕 Inicializando conversación: ${conversationId}`);
    
    if (this.conversations.has(conversationId)) {
      // Conversación existente
      const conversation = this.conversations.get(conversationId);
      conversation.lastActivity = Date.now();
      
      console.log(`[CONV_MANAGER] 📖 Conversación existente recuperada: ${conversation.messageCount} mensajes`);
      return conversation;
    }
    
    // Nueva conversación
    const conversation = {
      id: conversationId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      messages: [],
      context: { ...initialContext },
      topics: [],
      agentsUsed: new Set(),
      lastAgent: null,
      preferences: {},
      metadata: {
        userProfile: initialContext.user || null,
        sessionType: 'interactive',
        priority: 'normal'
      }
    };
    
    this.conversations.set(conversationId, conversation);
    
    console.log(`[CONV_MANAGER] ✅ Nueva conversación creada: ${conversationId}`);
    return conversation;
  }

  /**
   * Actualizar contexto de conversación después de un intercambio
   */
  async updateConversationContext(conversationId, userMessage, viztaResponse, agentResults) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      console.error(`[CONV_MANAGER] ❌ Conversación no encontrada: ${conversationId}`);
      return;
    }
    
    // Actualizar información básica
    conversation.lastActivity = Date.now();
    conversation.messageCount++;
    
    // Agregar mensaje al historial
    const messageEntry = {
      timestamp: Date.now(),
      userMessage: userMessage,
      viztaResponse: viztaResponse,
      agentResults: agentResults,
      agentsInvolved: agentResults.map(r => r.agent),
      success: viztaResponse.success
    };
    
    conversation.messages.push(messageEntry);
    
    // Mantener límite de mensajes
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(-this.maxMessagesPerConversation);
    }
    
    // Actualizar agentes utilizados
    messageEntry.agentsInvolved.forEach(agent => {
      conversation.agentsUsed.add(agent);
    });
    
    if (messageEntry.agentsInvolved.length > 0) {
      conversation.lastAgent = messageEntry.agentsInvolved[messageEntry.agentsInvolved.length - 1];
    }
    
    // Extraer y actualizar temas
    const extractedTopics = await this.extractTopicsFromMessage(userMessage, viztaResponse);
    this.updateConversationTopics(conversation, extractedTopics);
    
    // Analizar patrones de usuario
    this.analyzeUserPatterns(conversation, userMessage);
    
    console.log(`[CONV_MANAGER] 🔄 Contexto actualizado para ${conversationId}: ${conversation.messageCount} mensajes`);
  }

  /**
   * Extraer temas de un mensaje
   */
  async extractTopicsFromMessage(userMessage, viztaResponse) {
    const topics = [];
    const messageLower = userMessage.toLowerCase();
    
    // Detectar temas políticos
    if (messageLower.includes('congreso') || messageLower.includes('político') || 
        messageLower.includes('gobierno') || messageLower.includes('ministro')) {
      topics.push('politics');
    }
    
    // Detectar temas sociales
    if (messageLower.includes('twitter') || messageLower.includes('redes sociales') ||
        messageLower.includes('@') || messageLower.includes('hashtag')) {
      topics.push('social_media');
    }
    
    // Detectar temas personales
    if (messageLower.includes('mis') || messageLower.includes('mi ') ||
        messageLower.includes('proyecto') || messageLower.includes('documento')) {
      topics.push('personal');
    }
    
    // Detectar temas de análisis
    if (messageLower.includes('análisis') || messageLower.includes('reporte') ||
        messageLower.includes('tendencia') || messageLower.includes('sentimiento')) {
      topics.push('analysis');
    }
    
    // Detectar temas de noticias
    if (messageLower.includes('noticia') || messageLower.includes('evento') ||
        messageLower.includes('actualidad') || messageLower.includes('información')) {
      topics.push('news');
    }
    
    return topics;
  }

  /**
   * Actualizar temas de conversación
   */
  updateConversationTopics(conversation, newTopics) {
    newTopics.forEach(topic => {
      const existingTopic = conversation.topics.find(t => t.name === topic);
      
      if (existingTopic) {
        existingTopic.count++;
        existingTopic.lastMentioned = Date.now();
      } else {
        conversation.topics.push({
          name: topic,
          count: 1,
          firstMentioned: Date.now(),
          lastMentioned: Date.now()
        });
      }
    });
    
    // Ordenar temas por frecuencia
    conversation.topics.sort((a, b) => b.count - a.count);
  }

  /**
   * Analizar patrones del usuario
   */
  analyzeUserPatterns(conversation, userMessage) {
    if (!conversation.preferences.patterns) {
      conversation.preferences.patterns = {
        averageMessageLength: 0,
        preferredAgents: {},
        queryTypes: {},
        timePatterns: {},
        responsePreferences: {}
      };
    }
    
    const patterns = conversation.preferences.patterns;
    
    // Actualizar longitud promedio de mensajes
    const currentAvg = patterns.averageMessageLength;
    const messageCount = conversation.messageCount;
    patterns.averageMessageLength = ((currentAvg * (messageCount - 1)) + userMessage.length) / messageCount;
    
    // Analizar patrones de tiempo
    const hour = new Date().getHours();
    const timeSlot = this.getTimeSlot(hour);
    patterns.timePatterns[timeSlot] = (patterns.timePatterns[timeSlot] || 0) + 1;
    
    // Analizar tipo de query
    const queryType = this.categorizeQuery(userMessage);
    patterns.queryTypes[queryType] = (patterns.queryTypes[queryType] || 0) + 1;
  }

  /**
   * Obtener slot de tiempo
   */
  getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Categorizar tipo de query
   */
  categorizeQuery(userMessage) {
    const msg = userMessage.toLowerCase();
    
    if (msg.includes('?') || msg.includes('qué') || msg.includes('cómo') || msg.includes('cuál')) {
      return 'question';
    }
    if (msg.includes('busca') || msg.includes('encuentra') || msg.includes('analiza')) {
      return 'command';
    }
    if (msg.includes('explica') || msg.includes('información') || msg.includes('detalles')) {
      return 'information_request';
    }
    if (msg.includes('compara') || msg.includes('diferencia') || msg.includes('versus')) {
      return 'comparison';
    }
    
    return 'general';
  }

  /**
   * Obtener contexto relevante para nueva query
   */
  getRelevantContext(conversationId, currentQuery) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;
    
    const context = {
      recentMessages: [],
      dominantTopics: [],
      preferredAgents: [],
      userPatterns: conversation.preferences.patterns || {},
      sessionMetadata: conversation.metadata
    };
    
    // Obtener mensajes recientes (últimos 3)
    context.recentMessages = conversation.messages.slice(-3).map(msg => ({
      userMessage: msg.userMessage,
      agentsInvolved: msg.agentsInvolved,
      success: msg.success,
      timestamp: msg.timestamp
    }));
    
    // Obtener temas dominantes (top 3)
    context.dominantTopics = conversation.topics
      .slice(0, 3)
      .map(topic => ({
        name: topic.name,
        frequency: topic.count,
        relevance: this.calculateTopicRelevance(topic, currentQuery)
      }));
    
    // Determinar agentes preferidos
    const agentUsage = {};
    conversation.messages.forEach(msg => {
      msg.agentsInvolved.forEach(agent => {
        agentUsage[agent] = (agentUsage[agent] || 0) + 1;
      });
    });
    
    context.preferredAgents = Object.entries(agentUsage)
      .sort(([,a], [,b]) => b - a)
      .map(([agent, count]) => ({ agent, usage: count }));
    
    return context;
  }

  /**
   * Calcular relevancia de tema para query actual
   */
  calculateTopicRelevance(topic, currentQuery) {
    const queryLower = currentQuery.toLowerCase();
    
    // Mapeo de temas a keywords
    const topicKeywords = {
      'politics': ['congreso', 'político', 'gobierno', 'ministro', 'presidente'],
      'social_media': ['twitter', 'redes', '@', 'hashtag', 'viral'],
      'personal': ['mis', 'mi ', 'proyecto', 'documento'],
      'analysis': ['análisis', 'reporte', 'tendencia', 'sentimiento'],
      'news': ['noticia', 'evento', 'actualidad', 'información']
    };
    
    const keywords = topicKeywords[topic.name] || [];
    const matches = keywords.filter(keyword => queryLower.includes(keyword)).length;
    
    return matches / keywords.length;
  }

  /**
   * Generar recomendaciones de continuidad
   */
  generateContinuityRecommendations(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];
    
    const recommendations = [];
    
    // Recomendar seguimiento de temas
    if (conversation.topics.length > 0) {
      const topTopic = conversation.topics[0];
      recommendations.push({
        type: 'topic_followup',
        suggestion: `Continuar explorando ${topTopic.name}`,
        relevance: 'high',
        context: `Ha sido mencionado ${topTopic.count} veces`
      });
    }
    
    // Recomendar agente basado en historial
    if (conversation.lastAgent) {
      recommendations.push({
        type: 'agent_preference',
        suggestion: `Consultar nuevamente con ${conversation.lastAgent}`,
        relevance: 'medium',
        context: 'Último agente utilizado exitosamente'
      });
    }
    
    // Recomendar análisis temporal si es relevante
    const now = new Date();
    const timeSinceLastMessage = now.getTime() - conversation.lastActivity;
    if (timeSinceLastMessage > 300000) { // 5 minutos
      recommendations.push({
        type: 'temporal_analysis',
        suggestion: 'Verificar actualizaciones recientes',
        relevance: 'low',
        context: 'Han pasado varios minutos desde la última consulta'
      });
    }
    
    return recommendations;
  }

  /**
   * Obtener estado de conversación
   */
  getConversationState(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;
    
    return {
      id: conversation.id,
      active: true,
      messageCount: conversation.messageCount,
      agentsUsed: Array.from(conversation.agentsUsed),
      topics: conversation.topics,
      lastActivity: conversation.lastActivity,
      sessionDuration: Date.now() - conversation.startTime,
      userPatterns: conversation.preferences.patterns,
      metadata: conversation.metadata
    };
  }

  /**
   * Limpiar conversación
   */
  cleanupConversation(conversationId, reason = 'manual') {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;
    
    console.log(`[CONV_MANAGER] 🧹 Limpiando conversación ${conversationId} (${reason})`);
    
    // Archivar estadísticas si es necesario
    this.archiveConversationStats(conversation, reason);
    
    // Remover de conversaciones activas
    this.conversations.delete(conversationId);
    
    return true;
  }

  /**
   * Archivar estadísticas de conversación
   */
  archiveConversationStats(conversation, reason) {
    const stats = {
      id: conversation.id,
      duration: Date.now() - conversation.startTime,
      messageCount: conversation.messageCount,
      agentsUsed: Array.from(conversation.agentsUsed),
      topTopics: conversation.topics.slice(0, 3),
      endReason: reason,
      timestamp: Date.now()
    };
    
    // Aquí podrías guardar las estadísticas en una base de datos
    console.log(`[CONV_MANAGER] 📊 Estadísticas archivadas:`, stats);
  }

  /**
   * Limpiar conversaciones inactivas
   */
  cleanupInactiveConversations() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [conversationId, conversation] of this.conversations) {
      if (now - conversation.lastActivity > this.maxConversationAge) {
        this.cleanupConversation(conversationId, 'timeout');
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[CONV_MANAGER] 🧹 Limpiadas ${cleanedCount} conversaciones inactivas`);
    }
  }

  /**
   * Limpiar todo
   */
  cleanup() {
    console.log(`[CONV_MANAGER] 🧹 Limpiando ${this.conversations.size} conversaciones activas`);
    
    // Archivar todas las conversaciones activas
    for (const [conversationId, conversation] of this.conversations) {
      this.archiveConversationStats(conversation, 'system_cleanup');
    }
    
    this.conversations.clear();
  }

  /**
   * Obtener estadísticas del gestor
   */
  getStats() {
    const conversations = Array.from(this.conversations.values());
    
    return {
      name: 'ConversationManager',
      activeConversations: this.conversations.size,
      totalMessages: conversations.reduce((sum, conv) => sum + conv.messageCount, 0),
      averageSessionDuration: this.calculateAverageSessionDuration(conversations),
      topTopics: this.getGlobalTopTopics(conversations),
      capabilities: [
        'conversation_initialization',
        'context_management',
        'topic_extraction',
        'user_pattern_analysis',
        'continuity_recommendations',
        'conversation_cleanup'
      ]
    };
  }

  calculateAverageSessionDuration(conversations) {
    if (conversations.length === 0) return 0;
    
    const totalDuration = conversations.reduce((sum, conv) => {
      return sum + (Date.now() - conv.startTime);
    }, 0);
    
    return totalDuration / conversations.length;
  }

  getGlobalTopTopics(conversations) {
    const globalTopics = {};
    
    conversations.forEach(conv => {
      conv.topics.forEach(topic => {
        globalTopics[topic.name] = (globalTopics[topic.name] || 0) + topic.count;
      });
    });
    
    return Object.entries(globalTopics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }
}

module.exports = {
  ConversationManager
}; 