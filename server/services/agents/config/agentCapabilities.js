/**
 * Configuración de Capacidades de Agentes
 * Define herramientas, personalidades y capacidades de cada agente
 */

const AGENT_CAPABILITIES = {
  laura: {
    name: 'Laura',
    role: 'Analista de Monitoreo',
    personality: 'Curiosa, meticulosa, analítica. Se emociona con patrones de datos.',
    
    // Herramientas disponibles
    tools: [
      'nitter_context',
      'nitter_profile', 
      'perplexity_search',
      'resolve_twitter_handle'
    ],
    
    // Capacidades especializadas
    capabilities: [
      'social_media_analysis',
      'trend_detection',
      'sentiment_analysis',
      'user_discovery',
      'viral_prediction',
      'entity_recognition',
      'political_context_analysis'
    ],
    
    // Formato de respuesta preferido
    responseFormat: 'json',
    
    // Integración con memoria
    memoryIntegration: {
      enabled: true,
      autoSave: true,
      pulsePoliticsGroup: true,
      contextEnhancement: true
    },
    
    // Configuración de LLM reasoning
    reasoningEngine: {
      enabled: true,
      models: ['gemini-2.5-flash', 'gpt-3.5-turbo'],
      temperature: 0.1,
      maxTokens: 2048
    }
  },

  robert: {
    name: 'Robert',
    role: 'Orquestador Interno',
    personality: 'Metódico, ordenado, estilo bibliotecario. Prioriza precisión y trazabilidad.',
    
    // Herramientas disponibles
    tools: [
      'user_projects',
      'user_codex',
      'project_decisions'
    ],
    
    // Capacidades especializadas
    capabilities: [
      'document_management',
      'knowledge_organization',
      'project_tracking',
      'decision_documentation',
      'metadata_extraction',
      'relationship_mapping'
    ],
    
    // Formato de respuesta preferido
    responseFormat: 'yaml',
    
    // Configuración de organización
    organizationStrategy: {
      categorization: 'hierarchical',
      metadataRich: true,
      relationshipTracking: true,
      versionControl: true
    }
  },

  vizta: {
    name: 'Vizta',
    role: 'Orquestador Principal',
    personality: 'Coordinador inteligente, empático, eficiente. Prioriza experiencia unificada del usuario.',
    
    // Capacidades de orquestación
    capabilities: [
      'conversation_management',
      'context_synchronization',
      'response_orchestration',
      'intelligent_routing',
      'multi_agent_coordination',
      'unified_response_formatting',
      'session_management',
      'fallback_handling'
    ],
    
    // Configuración de routing
    routingRules: {
      socialQueries: 'laura',
      personalData: 'robert',
      mixedQueries: ['laura', 'robert'],
      unknownQueries: 'laura' // fallback
    },
    
    // Gestión de conversación
    conversationManagement: {
      contextWindow: 10, // últimos 10 mensajes
      sessionPersistence: true,
      crossAgentContext: true,
      unifiedFormatting: true
    },
    
    // Criterios de coordinación
    coordinationCriteria: {
      parallelExecution: true,
      sequentialFallback: true,
      timeoutHandling: true,
      errorRecovery: true
    }
  }
};

// Mapeo de herramientas a agentes
const TOOL_TO_AGENT_MAPPING = {
  'nitter_context': 'laura',
  'nitter_profile': 'laura',
  'perplexity_search': 'laura',
  'resolve_twitter_handle': 'laura',
  'user_projects': 'robert',
  'user_codex': 'robert',
  'project_decisions': 'robert'
};

// Patrones de routing inteligente
const ROUTING_PATTERNS = {
  // Saludos y conversación casual
  greeting: {
    keywords: ['hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos'],
    agent: 'vizta',
    confidence: 0.95,
    directResponse: true
  },
  
  casual: {
    keywords: ['cómo estás', 'qué tal', 'como estas', 'que tal', 'gracias', 'thank you'],
    agent: 'vizta', 
    confidence: 0.9,
    directResponse: true
  },
  
  help: {
    keywords: ['ayuda', 'help', 'qué puedes hacer', 'que puedes hacer', 'comandos'],
    agent: 'vizta',
    confidence: 0.95,
    directResponse: true
  },

  social: {
    keywords: ['tweets', 'twitter', 'tendencia', 'viral', 'redes sociales', '@', 'hashtag'],
    agent: 'laura',
    confidence: 0.9
  },
  
  personal: {
    keywords: ['mis', 'mi ', 'proyecto', 'documento', 'archivo', 'codex'],
    agent: 'robert',
    confidence: 0.8
  },
  
  political: {
    keywords: ['congreso', 'politica', 'gobierno', 'diputado', 'ministro', 'presidente'],
    agent: 'laura',
    confidence: 0.85,
    enhanceWithMemory: true
  },
  
  mixed: {
    keywords: ['analisis', 'reporte', 'investigacion', 'contexto'],
    agents: ['laura', 'robert'],
    confidence: 0.7
  }
};

// Configuración de comunicación inter-agente
const INTER_AGENT_COMMUNICATION = {
  protocols: {
    handoff: 'context_preservation',
    coordination: 'parallel_execution',
    fallback: 'sequential_retry'
  },
  
  contextSharing: {
    enabled: true,
    sharedFields: ['userQuery', 'timestamp', 'sessionId', 'findings'],
    privateFields: ['internalNotes', 'debugInfo']
  },
  
  responseAggregation: {
    strategy: 'intelligent_merge',
    priorityOrder: ['laura', 'robert'],
    conflictResolution: 'vizta_decision'
  }
};

module.exports = {
  AGENT_CAPABILITIES,
  TOOL_TO_AGENT_MAPPING,
  ROUTING_PATTERNS,
  INTER_AGENT_COMMUNICATION
}; 