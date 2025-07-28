/**
 * Robert - Agente de Gestión de Documentos y Proyectos del Usuario
 * Maneja acceso a proyectos personales, codex y documentos del usuario
 */

const { AGENT_CAPABILITIES } = require('../config/agentCapabilities');
const { communicationBus } = require('../shared/agentCommunication');
const { ProjectsEngine } = require('./projectsEngine');
const { CodexEngine } = require('./codexEngine');
const { UserDataEngine } = require('./userDataEngine');

class RobertAgent {
  constructor(viztaOrchestrator = null) {
    this.name = 'Robert';
    this.config = AGENT_CAPABILITIES.robert;
    this.vizta = viztaOrchestrator;
    
    // Inicializar módulos especializados
    this.projectsEngine = new ProjectsEngine(this);
    this.codexEngine = new CodexEngine(this);
    this.userDataEngine = new UserDataEngine(this);
    
    // Estado interno
    this.currentTasks = new Map();
    this.cache = new Map();
    
    console.log(`[ROBERT] 📁 Robert Agent inicializado - Gestión de documentos y proyectos`);
  }

  /**
   * Ejecutar tarea específica de Robert
   */
  async executeTask(task, user, additionalContext = {}) {
    const taskId = task.id || `robert_${Date.now()}`;
    console.log(`[ROBERT] 🔧 Ejecutando tarea: ${task.type || task.tool} para usuario ${user.id}`);
    
    try {
      this.currentTasks.set(taskId, {
        ...task,
        status: 'executing',
        startTime: Date.now(),
        user: user
      });
      
      let result;
      
      switch (task.type || task.tool) {
        case 'user_projects':
        case 'projects':
          result = await this.projectsEngine.getUserProjects(user, task.args || {});
          break;
          
        case 'codex_items':
        case 'codex':
          result = await this.codexEngine.getUserCodex(user, task.args || {});
          break;
          
        case 'project_details':
          result = await this.projectsEngine.getProjectDetails(user, task.args.projectId);
          break;
          
        case 'codex_search':
          result = await this.codexEngine.searchCodex(user, task.args.query, task.args);
          break;
          
        case 'user_data':
          result = await this.userDataEngine.getUserData(user, task.args || {});
          break;
          
        case 'handoff':
          result = await this.handleHandoff(task, user);
          break;
          
        default:
          throw new Error(`Tipo de tarea no soportado: ${task.type || task.tool}`);
      }
      
      // Actualizar tarea completada
      this.currentTasks.set(taskId, {
        ...this.currentTasks.get(taskId),
        status: 'completed',
        result: result,
        endTime: Date.now()
      });
      
      console.log(`[ROBERT] ✅ Tarea completada: ${task.type || task.tool}`);
      
      return {
        agent: 'Robert',
        success: true,
        taskId: taskId,
        type: task.type || task.tool,
        data: result,
        metadata: {
          executionTime: Date.now() - this.currentTasks.get(taskId).startTime,
          timestamp: new Date().toISOString(),
          userId: user.id
        }
      };
      
    } catch (error) {
      console.error(`[ROBERT] ❌ Error ejecutando tarea ${task.type || task.tool}:`, error);
      
      // Actualizar tarea con error
      this.currentTasks.set(taskId, {
        ...this.currentTasks.get(taskId),
        status: 'error',
        error: error.message,
        endTime: Date.now()
      });
      
      return {
        agent: 'Robert',
        success: false,
        taskId: taskId,
        type: task.type || task.tool,
        error: error.message,
        message: 'Error accediendo a datos del usuario',
        metadata: {
          executionTime: Date.now() - (this.currentTasks.get(taskId)?.startTime || Date.now()),
          timestamp: new Date().toISOString(),
          userId: user.id
        }
      };
    }
  }

  /**
   * Manejar handoff desde otro agente
   */
  async handleHandoff(task, user) {
    console.log(`[ROBERT] 🔄 Manejando handoff de ${task.handoffContext?.fromAgent || 'unknown'}`);
    
    const handoffData = task.handoffContext || {};
    const originalQuery = task.originalQuery || handoffData.userQuery;
    
    // Analizar qué tipo de datos del usuario se necesitan
    const dataNeeds = this.analyzeUserDataNeeds(originalQuery, handoffData);
    
    const results = {};
    
    // Obtener proyectos si es necesario
    if (dataNeeds.needsProjects) {
      try {
        results.projects = await this.projectsEngine.getRelevantProjects(user, originalQuery);
      } catch (error) {
        console.warn(`[ROBERT] ⚠️ Error obteniendo proyectos:`, error.message);
        results.projects = { error: error.message };
      }
    }
    
    // Obtener codex si es necesario
    if (dataNeeds.needsCodex) {
      try {
        results.codex = await this.codexEngine.searchRelevantCodex(user, originalQuery);
      } catch (error) {
        console.warn(`[ROBERT] ⚠️ Error obteniendo codex:`, error.message);
        results.codex = { error: error.message };
      }
    }
    
    // Obtener datos adicionales si es necesario
    if (dataNeeds.needsUserData) {
      try {
        results.userData = await this.userDataEngine.getRelevantData(user, originalQuery);
      } catch (error) {
        console.warn(`[ROBERT] ⚠️ Error obteniendo datos del usuario:`, error.message);
        results.userData = { error: error.message };
      }
    }
    
    return {
      handoffResponse: true,
      originalQuery: originalQuery,
      userDataResults: results,
      dataTypes: Object.keys(results),
      fromAgent: handoffData.fromAgent,
      reasoning: `Proporcioné datos del usuario relacionados con: ${Object.keys(results).join(', ')}`
    };
  }

  /**
   * Analizar qué datos del usuario se necesitan basado en la consulta
   */
  analyzeUserDataNeeds(query, context = {}) {
    const queryLower = query.toLowerCase();
    
    const needs = {
      needsProjects: false,
      needsCodex: false,
      needsUserData: false
    };
    
    // Detectar necesidad de proyectos
    const projectKeywords = ['mi proyecto', 'mis proyectos', 'proyecto actual', 'trabajando en', 'desarrollo'];
    needs.needsProjects = projectKeywords.some(keyword => queryLower.includes(keyword));
    
    // Detectar necesidad de codex
    const codexKeywords = ['documento', 'archivo', 'codex', 'guardado', 'notas', 'referencias'];
    needs.needsCodex = codexKeywords.some(keyword => queryLower.includes(keyword));
    
    // Detectar necesidad de datos generales
    const userDataKeywords = ['mi información', 'mis datos', 'configuración', 'perfil'];
    needs.needsUserData = userDataKeywords.some(keyword => queryLower.includes(keyword));
    
    // Si Laura está pidiendo contexto del usuario, probablemente necesite proyectos
    if (context.fromAgent === 'laura' && queryLower.includes('context')) {
      needs.needsProjects = true;
    }
    
    return needs;
  }

  /**
   * Obtener resumen de actividad del usuario
   */
  async getUserActivitySummary(user) {
    try {
      const [projects, recentCodex, userData] = await Promise.all([
        this.projectsEngine.getActiveProjects(user),
        this.codexEngine.getRecentCodex(user, { limit: 5 }),
        this.userDataEngine.getBasicUserData(user)
      ]);
      
      return {
        user: {
          id: user.id,
          name: userData.name || 'Usuario',
          activeProjects: projects.length,
          recentDocuments: recentCodex.length
        },
        activity: {
          projects: projects.slice(0, 3), // Top 3 proyectos
          recentCodex: recentCodex,
          lastActivity: Math.max(
            ...projects.map(p => new Date(p.updated_at).getTime()),
            ...recentCodex.map(c => new Date(c.created_at).getTime())
          )
        }
      };
      
    } catch (error) {
      console.error(`[ROBERT] ❌ Error obteniendo resumen de actividad:`, error);
      return {
        user: { id: user.id, name: 'Usuario' },
        activity: { error: error.message }
      };
    }
  }

  /**
   * Proporcionar contexto del usuario para otros agentes
   */
  async provideUserContext(user, contextType = 'basic') {
    const cache_key = `user_context_${user.id}_${contextType}`;
    
    // Verificar cache
    if (this.cache.has(cache_key)) {
      const cached = this.cache.get(cache_key);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutos cache
        return cached.data;
      }
    }
    
    try {
      let context = {};
      
      switch (contextType) {
        case 'basic':
          context = await this.getUserActivitySummary(user);
          break;
          
        case 'projects':
          context = await this.projectsEngine.getAllProjectsContext(user);
          break;
          
        case 'codex':
          context = await this.codexEngine.getAllCodexContext(user);
          break;
          
        case 'full':
          const [basic, projects, codex] = await Promise.all([
            this.getUserActivitySummary(user),
            this.projectsEngine.getAllProjectsContext(user),
            this.codexEngine.getAllCodexContext(user)
          ]);
          
          context = { basic, projects, codex };
          break;
          
        default:
          context = await this.getUserActivitySummary(user);
      }
      
      // Guardar en cache
      this.cache.set(cache_key, {
        data: context,
        timestamp: Date.now()
      });
      
      return context;
      
    } catch (error) {
      console.error(`[ROBERT] ❌ Error proporcionando contexto del usuario:`, error);
      return { error: error.message };
    }
  }

  /**
   * Limpiar cache de usuario
   */
  clearUserCache(userId) {
    const keysToDelete = [];
    
    this.cache.forEach((value, key) => {
      if (key.includes(`user_context_${userId}`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[ROBERT] 🧹 Cache limpiado para usuario ${userId}: ${keysToDelete.length} entradas`);
  }

  /**
   * Obtener estadísticas del agente
   */
  getStats() {
    const activeTasks = Array.from(this.currentTasks.values()).filter(t => t.status === 'executing');
    const completedTasks = Array.from(this.currentTasks.values()).filter(t => t.status === 'completed');
    
    return {
      name: 'Robert',
      role: 'Gestión de Documentos y Proyectos',
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      cacheSize: this.cache.size,
      capabilities: this.config.capabilities,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Limpiar recursos
   */
  cleanup() {
    this.currentTasks.clear();
    this.cache.clear();
    
    console.log(`[ROBERT] 🧹 Cleanup completado`);
  }
}

module.exports = {
  RobertAgent
}; 