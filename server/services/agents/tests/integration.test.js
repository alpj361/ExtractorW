/**
 * Tests de Integración del Sistema Modular de Agentes
 * Valida interacciones entre Vizta, Laura, Robert y comunicación
 */

const { ViztaAgent } = require('../vizta');
const { LauraAgent } = require('../laura');
const { RobertAgent } = require('../robert');
const { communicationBus } = require('../shared/agentCommunication');

// Mock de dependencias externas
jest.mock('../../mcp', () => ({
  executeTool: jest.fn()
}));

jest.mock('../laura/memoryClient', () => ({
  LauraMemoryClient: jest.fn().mockImplementation(() => ({
    enabled: true,
    isHealthy: jest.fn().mockResolvedValue(true),
    searchPoliticalContext: jest.fn().mockResolvedValue(['Contexto político mock']),
    processUserDiscoveryWithPoliticalContext: jest.fn().mockResolvedValue({
      processed: true,
      saved: true,
      political_context: ['Contexto político'],
      is_politically_relevant: true
    }),
    processToolResult: jest.fn().mockResolvedValue({ saved: true }),
    enhanceQueryWithMemory: jest.fn().mockResolvedValue({
      enhanced_query: 'Query mejorada',
      memory_context: 'Contexto de memoria',
      memory_results: []
    })
  }))
}));

// Mock de Supabase para Robert
jest.mock('../../config/supabase', () => ({
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'test-user', name: 'Test User' },
          error: null
        }),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: 'project-1', name: 'Test Project' }],
          error: null
        })
      })
    })
  })
}));

// Variables globales para tests
let vizta, laura, robert;
let mockUser = { id: 'test-user-123', name: 'Test User' };

describe('Sistema Modular de Agentes - Integración Completa', () => {
  beforeEach(() => {
    // Limpiar comunicación bus antes de cada test
    communicationBus.activeConversations.clear();
    communicationBus.messageHistory.clear();
    communicationBus.agentStates.clear();
    
    // Inicializar agentes
    robert = new RobertAgent();
    laura = new LauraAgent({ agentesService: {} });
    vizta = new ViztaAgent();
    
    // Mock de console.log para tests más limpios
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Inicialización del Sistema', () => {
    test('Todos los agentes se inicializan correctamente', () => {
      expect(vizta.name).toBe('Vizta');
      expect(laura.name).toBe('Laura');
      expect(robert.name).toBe('Robert');
      
      expect(vizta.responseOrchestrator).toBeDefined();
      expect(vizta.routingEngine).toBeDefined();
      expect(vizta.conversationManager).toBeDefined();
      
      expect(laura.memoryClient).toBeDefined();
      expect(laura.userDiscovery).toBeDefined();
      expect(laura.socialAnalysis).toBeDefined();
      
      expect(robert.projectsEngine).toBeDefined();
      expect(robert.codexEngine).toBeDefined();
      expect(robert.userDataEngine).toBeDefined();
    });

    test('Comunicación bus está disponible', () => {
      expect(communicationBus).toBeDefined();
      expect(typeof communicationBus.sendMessage).toBe('function');
      expect(typeof communicationBus.initializeConversation).toBe('function');
    });
  });

  describe('Flujo de Consulta Completo - Análisis Social', () => {
    test('Consulta social con usuario discovery y memoria', async () => {
      const userQuery = "¿Qué dice el presidente Giammattei sobre la situación económica?";
      
      // Mock de herramientas para Laura
      const mcpService = require('../../mcp');
      mcpService.executeTool.mockResolvedValue({
        tweets: [
          {
            username: 'DrGiammattei',
            content: 'La economía guatemalteca muestra signos de recuperación...',
            date: '2024-01-15'
          }
        ]
      });

      // Ejecutar consulta completa a través de Vizta
      const result = await vizta.processUserQuery(userQuery, mockUser);
      
      // Verificar estructura de respuesta
      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('metadata');
      
      // Verificar metadata
      expect(result.metadata).toHaveProperty('routingDecision');
      expect(result.metadata).toHaveProperty('agentsInvolved');
      expect(result.metadata.agentsInvolved).toContain('laura');
      
      // Verificar que la respuesta incluye análisis
      expect(result.response.success).toBe(true);
    });
  });

  describe('Flujo de Consulta Completo - Datos del Usuario', () => {
    test('Consulta de proyectos del usuario vía Robert', async () => {
      const userQuery = "¿Cuáles son mis proyectos activos?";
      
      // Ejecutar consulta
      const result = await vizta.processUserQuery(userQuery, mockUser);
      
      // Verificar que Robert fue involucrado
      expect(result.metadata.agentsInvolved).toContain('robert');
      
      // Verificar estructura de respuesta
      expect(result.response.success).toBe(true);
    });
  });

  describe('Comunicación Inter-Agente', () => {
    test('Registro y comunicación entre agentes', () => {
      const sessionId = 'test-session-123';
      
      // Inicializar conversación
      const conversation = communicationBus.initializeConversation(sessionId, {
        userQuery: 'Test query'
      });
      
      expect(conversation.sessionId).toBe(sessionId);
      expect(conversation.status).toBe('active');
      
      // Registrar agentes
      communicationBus.registerAgent(sessionId, 'vizta');
      communicationBus.registerAgent(sessionId, 'laura');
      communicationBus.registerAgent(sessionId, 'robert');
      
      // Verificar registro
      const context = communicationBus.getConversationContext(sessionId);
      expect(context.conversation.participants.size).toBe(3);
    });

    test('Handoff entre agentes', async () => {
      const sessionId = 'test-handoff-session';
      const handoffData = {
        userQuery: 'Test handoff',
        context: { analysis: 'preliminary' },
        instructions: 'Complete analysis'
      };
      
      // Inicializar conversación
      communicationBus.initializeConversation(sessionId);
      communicationBus.registerAgent(sessionId, 'laura');
      communicationBus.registerAgent(sessionId, 'robert');
      
      // Ejecutar handoff
      const handoffMessage = await communicationBus.coordinateHandoff(
        sessionId,
        'laura',
        'robert',
        handoffData
      );
      
      expect(handoffMessage.type).toBe('handoff');
      expect(handoffMessage.to).toBe('robert');
      expect(handoffMessage.from).toBe('laura');
    });
  });

  describe('Integración con Laura Memory / PulsePolitics', () => {
    test('Laura guarda usuarios descubiertos en PulsePolitics', async () => {
      const userInfo = {
        name: 'Alejandro Giammattei',
        username: 'DrGiammattei',
        bio: 'Presidente de Guatemala',
        verified: true
      };
      
      const originalQuery = 'tweets del presidente';
      
      // Ejecutar guardado en PulsePolitics
      const result = await laura.userDiscovery.saveDiscoveredUserToPolitics(
        userInfo,
        originalQuery,
        'llm_resolution'
      );
      
      expect(result.processed).toBe(true);
      expect(result.saved).toBe(true);
      expect(result.is_politically_relevant).toBe(true);
    });

    test('Laura mejora consultas con contexto de memoria', async () => {
      const query = 'situación del congreso';
      
      // Mock de memoria client ya configurado
      const enhanced = await laura.memoryClient.enhanceQueryWithMemory(query);
      
      expect(enhanced.enhanced_query).toBeDefined();
      expect(enhanced.memory_context).toBeDefined();
    });
  });

  describe('Routing Engine de Vizta', () => {
    test('Enruta correctamente consultas sociales a Laura', async () => {
      const socialQuery = "analiza los tweets sobre la nueva ley";
      
      const routingDecision = await vizta.routingEngine.analyzeAndRoute(socialQuery, {});
      
      expect(routingDecision.agents).toContain('laura');
      expect(routingDecision.primaryAgent).toBe('laura');
    });

    test('Enruta correctamente consultas de usuario a Robert', async () => {
      const userQuery = "muéstrame mis documentos guardados";
      
      const routingDecision = await vizta.routingEngine.analyzeAndRoute(userQuery, {});
      
      expect(routingDecision.agents).toContain('robert');
    });

    test('Routing híbrido para consultas complejas', async () => {
      const hybridQuery = "busca información sobre el congreso y relacionala con mis proyectos";
      
      const routingDecision = await vizta.routingEngine.analyzeAndRoute(hybridQuery, {});
      
      // Debería involucrar ambos agentes
      expect(routingDecision.agents.length).toBeGreaterThan(1);
      expect(routingDecision.executionMode).toBeDefined();
    });
  });

  describe('Response Orchestrator', () => {
    test('Unifica respuestas de múltiples agentes', async () => {
      const mockResults = [
        {
          agent: 'laura',
          success: true,
          data: { 
            analysis: 'Análisis social completado',
            tweets: ['tweet1', 'tweet2'] 
          }
        },
        {
          agent: 'robert',
          success: true,
          data: { 
            projects: [{ name: 'Proyecto A' }] 
          }
        }
      ];
      
      const unifiedResponse = await vizta.responseOrchestrator.orchestrateResponse(
        mockResults,
        'consulta híbrida',
        { agents: ['laura', 'robert'] },
        {}
      );
      
      expect(unifiedResponse.success).toBe(true);
      expect(unifiedResponse.agent).toBe('Vizta');
      expect(unifiedResponse.analysis).toBeDefined();
    });
  });

  describe('Manejo de Errores', () => {
    test('Maneja errores de agente gracefully', async () => {
      // Mock de error en Laura
      const mcpService = require('../../mcp');
      mcpService.executeTool.mockRejectedValue(new Error('Tool error'));
      
      const result = await vizta.processUserQuery("query con error", mockUser);
      
      // Debería manejar el error sin fallar completamente
      expect(result).toHaveProperty('response');
      expect(result.metadata).toHaveProperty('error');
    });

    test('Fallback cuando memoria no está disponible', async () => {
      // Deshabilitar memoria
      laura.memoryClient.enabled = false;
      
      const task = {
        id: 'test-task',
        tool: 'nitter_context',
        args: { q: 'test query' },
        type: 'monitoring'
      };
      
      const result = await laura.executeTask(task, mockUser, '2024-01-15');
      
      // Debería funcionar sin memoria
      expect(result.agent).toBe('Laura');
    });
  });

  describe('Performance y Estadísticas', () => {
    test('Agentes reportan estadísticas correctas', () => {
      const viztaStats = vizta.getStats();
      const lauraStats = laura.userDiscovery.getStats();
      const robertStats = robert.getStats();
      
      expect(viztaStats.name).toBe('Vizta');
      expect(viztaStats.capabilities).toBeDefined();
      
      expect(lauraStats.name).toBe('UserDiscoveryEngine');
      expect(lauraStats.capabilities).toContain('pulsepolitics_integration');
      
      expect(robertStats.name).toBe('Robert');
      expect(robertStats.capabilities).toBeDefined();
    });

    test('Tiempo de procesamiento dentro de límites', async () => {
      const startTime = Date.now();
      
      const result = await vizta.processUserQuery("consulta rápida", mockUser);
      
      const processingTime = Date.now() - startTime;
      
      // Debería procesar en menos de 5 segundos (mock)
      expect(processingTime).toBeLessThan(5000);
      expect(result.metadata.processingTime).toBeDefined();
    });
  });

  describe('Limpieza y Lifecycle', () => {
    test('Limpieza de conversaciones completadas', () => {
      const sessionId = 'cleanup-test';
      
      // Crear conversación
      communicationBus.initializeConversation(sessionId);
      communicationBus.registerAgent(sessionId, 'vizta');
      
      expect(communicationBus.activeConversations.has(sessionId)).toBe(true);
      
      // Limpiar
      communicationBus.cleanupConversation(sessionId, 'completed');
      
      expect(communicationBus.activeConversations.has(sessionId)).toBe(false);
    });

    test('Limpieza de estados de agentes', () => {
      vizta.cleanup();
      laura.userDiscovery = { getStats: () => ({ name: 'cleaned' }) };
      robert.cleanup();
      
      // Verificar limpieza
      expect(vizta.activeConversations.size).toBe(0);
      expect(robert.currentTasks.size).toBe(0);
    });
  });
});

// Helper para tests de rendimiento
function measurePerformance(fn) {
  return async (...args) => {
    const start = process.hrtime.bigint();
    const result = await fn(...args);
    const end = process.hrtime.bigint();
    
    return {
      result,
      duration: Number(end - start) / 1000000 // Convert to milliseconds
    };
  };
}

module.exports = {
  measurePerformance
}; 