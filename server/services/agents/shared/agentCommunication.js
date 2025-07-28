/**
 * Sistema de Comunicación Inter-Agente
 * Maneja coordinación, handoffs y sincronización de contexto
 */

const EventEmitter = require('events');
const { INTER_AGENT_COMMUNICATION } = require('../config/agentCapabilities');

class AgentCommunicationBus extends EventEmitter {
  constructor() {
    super();
    this.activeConversations = new Map();
    this.messageHistory = new Map();
    this.agentStates = new Map();
    
    // Configurar listeners para comunicación
    this.setupCommunicationListeners();
  }

  /**
   * Inicializar nueva conversación
   */
  initializeConversation(sessionId, initialContext = {}) {
    console.log(`[COMM_BUS] 🆕 Inicializando conversación: ${sessionId}`);
    
    const conversation = {
      sessionId,
      startTime: Date.now(),
      context: { ...initialContext },
      participants: new Set(),
      messageQueue: [],
      sharedState: {},
      status: 'active'
    };
    
    this.activeConversations.set(sessionId, conversation);
    this.messageHistory.set(sessionId, []);
    
    this.emit('conversation:initialized', { sessionId, conversation });
    return conversation;
  }

  /**
   * Registrar agente en conversación
   */
  registerAgent(sessionId, agentName) {
    const conversation = this.activeConversations.get(sessionId);
    if (!conversation) {
      throw new Error(`Conversación ${sessionId} no encontrada`);
    }
    
    conversation.participants.add(agentName);
    this.agentStates.set(`${sessionId}:${agentName}`, {
      status: 'active',
      lastActivity: Date.now(),
      currentTask: null
    });
    
    console.log(`[COMM_BUS] 👥 Agente ${agentName} registrado en ${sessionId}`);
    this.emit('agent:registered', { sessionId, agentName });
  }

  /**
   * Enviar mensaje entre agentes
   */
  sendMessage(sessionId, fromAgent, toAgent, messageType, payload) {
    const conversation = this.activeConversations.get(sessionId);
    if (!conversation) {
      throw new Error(`Conversación ${sessionId} no encontrada`);
    }
    
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      timestamp: Date.now(),
      from: fromAgent,
      to: toAgent,
      type: messageType,
      payload: this.filterPayload(payload),
      status: 'sent'
    };
    
    // Agregar a historial
    const history = this.messageHistory.get(sessionId) || [];
    history.push(message);
    this.messageHistory.set(sessionId, history);
    
    // Agregar a cola de mensajes de la conversación
    conversation.messageQueue.push(message);
    
    console.log(`[COMM_BUS] 📤 ${fromAgent} → ${toAgent}: ${messageType}`);
    
    // Emitir evento para el agente destinatario
    this.emit(`message:${toAgent}`, message);
    this.emit('message:sent', message);
    
    return message;
  }

  /**
   * Actualizar contexto compartido
   */
  updateSharedContext(sessionId, agentName, contextUpdate) {
    const conversation = this.activeConversations.get(sessionId);
    if (!conversation) {
      throw new Error(`Conversación ${sessionId} no encontrada`);
    }
    
    // Merge context updates
    conversation.context = {
      ...conversation.context,
      [`${agentName}_context`]: contextUpdate,
      lastUpdate: Date.now(),
      lastUpdatedBy: agentName
    };
    
    console.log(`[COMM_BUS] 🔄 Contexto actualizado por ${agentName} en ${sessionId}`);
    
    // Notificar a otros agentes
    conversation.participants.forEach(participant => {
      if (participant !== agentName) {
        this.emit(`context:updated:${participant}`, {
          sessionId,
          updatedBy: agentName,
          context: conversation.context
        });
      }
    });
    
    return conversation.context;
  }

  /**
   * Coordinar handoff entre agentes
   */
  async coordinateHandoff(sessionId, fromAgent, toAgent, handoffData) {
    console.log(`[COMM_BUS] 🔄 Coordinando handoff: ${fromAgent} → ${toAgent}`);
    
    const handoffMessage = {
      type: 'handoff',
      context: handoffData.context,
      taskState: handoffData.taskState,
      userQuery: handoffData.userQuery,
      findings: handoffData.findings,
      instructions: handoffData.instructions
    };
    
    // Enviar mensaje de handoff
    const message = this.sendMessage(sessionId, fromAgent, toAgent, 'handoff', handoffMessage);
    
    // Actualizar estados de agentes
    this.updateAgentState(sessionId, fromAgent, { status: 'handoff_completed' });
    this.updateAgentState(sessionId, toAgent, { status: 'handoff_received', currentTask: handoffData.instructions });
    
    // Emitir evento de coordinación
    this.emit('handoff:coordinated', {
      sessionId,
      fromAgent,
      toAgent,
      messageId: message.id,
      handoffData
    });
    
    return message;
  }

  /**
   * Agregar resultados de agente a contexto compartido
   */
  addAgentResults(sessionId, agentName, results) {
    const conversation = this.activeConversations.get(sessionId);
    if (!conversation) {
      throw new Error(`Conversación ${sessionId} no encontrada`);
    }
    
    // Agregar resultados al estado compartido
    if (!conversation.sharedState.agentResults) {
      conversation.sharedState.agentResults = {};
    }
    
    conversation.sharedState.agentResults[agentName] = {
      ...results,
      timestamp: Date.now(),
      sessionId
    };
    
    console.log(`[COMM_BUS] 📊 Resultados de ${agentName} agregados a ${sessionId}`);
    
    // Notificar disponibilidad de nuevos resultados
    this.emit('results:available', {
      sessionId,
      agentName,
      results: conversation.sharedState.agentResults
    });
    
    return conversation.sharedState;
  }

  /**
   * Obtener contexto completo de conversación
   */
  getConversationContext(sessionId) {
    const conversation = this.activeConversations.get(sessionId);
    const messages = this.messageHistory.get(sessionId) || [];
    
    return {
      conversation: conversation || null,
      messageHistory: messages,
      participantStates: this.getParticipantStates(sessionId)
    };
  }

  /**
   * Obtener estados de participantes
   */
  getParticipantStates(sessionId) {
    const states = {};
    const conversation = this.activeConversations.get(sessionId);
    
    if (conversation) {
      conversation.participants.forEach(agent => {
        const stateKey = `${sessionId}:${agent}`;
        states[agent] = this.agentStates.get(stateKey) || { status: 'unknown' };
      });
    }
    
    return states;
  }

  /**
   * Actualizar estado de agente
   */
  updateAgentState(sessionId, agentName, stateUpdate) {
    const stateKey = `${sessionId}:${agentName}`;
    const currentState = this.agentStates.get(stateKey) || {};
    
    const newState = {
      ...currentState,
      ...stateUpdate,
      lastActivity: Date.now()
    };
    
    this.agentStates.set(stateKey, newState);
    
    this.emit('agent:state_updated', {
      sessionId,
      agentName,
      oldState: currentState,
      newState
    });
    
    return newState;
  }

  /**
   * Limpiar conversación completada
   */
  cleanupConversation(sessionId, reason = 'completed') {
    console.log(`[COMM_BUS] 🧹 Limpiando conversación ${sessionId} (${reason})`);
    
    const conversation = this.activeConversations.get(sessionId);
    if (conversation) {
      // Notificar a participantes
      conversation.participants.forEach(agent => {
        this.emit(`conversation:cleanup:${agent}`, { sessionId, reason });
      });
      
      // Marcar como completada
      conversation.status = reason;
      conversation.endTime = Date.now();
    }
    
    // Limpiar estados de agentes
    if (conversation) {
      conversation.participants.forEach(agent => {
        this.agentStates.delete(`${sessionId}:${agent}`);
      });
    }
    
    // Remover de conversaciones activas
    this.activeConversations.delete(sessionId);
    
    this.emit('conversation:cleanup', { sessionId, reason });
  }

  /**
   * Filtrar payload según configuración de privacidad
   */
  filterPayload(payload) {
    const filtered = { ...payload };
    
    // Remover campos privados según configuración
    INTER_AGENT_COMMUNICATION.contextSharing.privateFields.forEach(field => {
      delete filtered[field];
    });
    
    return filtered;
  }

  /**
   * Configurar listeners de comunicación
   */
  setupCommunicationListeners() {
    // Listener para timeout de mensajes
    this.on('message:sent', (message) => {
      setTimeout(() => {
        if (message.status === 'sent') {
          this.emit('message:timeout', message);
        }
      }, 30000); // 30 segundos timeout
    });
    
    // Listener para limpieza automática
    setInterval(() => {
      this.cleanupInactiveConversations();
    }, 300000); // 5 minutos
  }

  /**
   * Limpiar conversaciones inactivas
   */
  cleanupInactiveConversations() {
    const now = Date.now();
    const maxInactivityTime = 3600000; // 1 hora
    
    this.activeConversations.forEach((conversation, sessionId) => {
      if (now - conversation.startTime > maxInactivityTime) {
        this.cleanupConversation(sessionId, 'timeout');
      }
    });
  }

  /**
   * Obtener estadísticas del bus de comunicación
   */
  getStats() {
    return {
      activeConversations: this.activeConversations.size,
      totalAgentStates: this.agentStates.size,
      averageConversationDuration: this.getAverageConversationDuration(),
      messagesThroughput: this.getMessagesThroughput()
    };
  }

  getAverageConversationDuration() {
    let totalDuration = 0;
    let completedConversations = 0;
    
    this.activeConversations.forEach(conversation => {
      if (conversation.endTime) {
        totalDuration += conversation.endTime - conversation.startTime;
        completedConversations++;
      }
    });
    
    return completedConversations > 0 ? totalDuration / completedConversations : 0;
  }

  getMessagesThroughput() {
    const last10Minutes = Date.now() - 600000;
    let messageCount = 0;
    
    this.messageHistory.forEach(messages => {
      messageCount += messages.filter(msg => msg.timestamp > last10Minutes).length;
    });
    
    return messageCount;
  }
}

// Instancia singleton del bus de comunicación
const communicationBus = new AgentCommunicationBus();

module.exports = {
  AgentCommunicationBus,
  communicationBus
}; 