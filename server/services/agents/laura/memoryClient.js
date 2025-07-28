/**
 * Memory Client para Laura Agent
 * Interfaz con el servicio Laura Memory independiente para gestión de contexto y PulsePolitics
 */

const axios = require('axios');

class LauraMemoryClient {
  constructor(options = {}) {
    // Usar 127.0.0.1 en lugar de localhost para evitar problemas IPv6
    this.baseURL = options.baseURL || process.env.LAURA_MEMORY_URL || 'http://127.0.0.1:5001';
    this.enabled = options.enabled !== undefined ? options.enabled : 
                  (process.env.LAURA_MEMORY_ENABLED || 'true').toLowerCase() === 'true';
    this.timeout = options.timeout || 10000;
    
    // Configurar cliente HTTP
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Laura-Agent/1.0'
      }
    });
    
    console.log(`[LAURA_MEMORY] 🧠 Cliente inicializado - URL: ${this.baseURL}, Enabled: ${this.enabled}`);
  }

  /**
   * Verificar si el servicio está disponible (método de compatibilidad)
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * Verificar si el servicio está disponible
   */
  async isHealthy() {
    if (!this.enabled) return false;
    
    try {
      const response = await this.client.get('/health');
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      console.warn(`[LAURA_MEMORY] ⚠️ Servicio no disponible: ${error.message}`);
      return false;
    }
  }

  /**
   * Procesar resultado de herramienta para almacenamiento inteligente
   */
  async processToolResult(toolName, toolResult, userQuery = '', metadata = {}) {
    if (!this.enabled || !await this.isHealthy()) {
      return { saved: false, reason: 'Servicio no disponible' };
    }

    try {
      const response = await this.client.post('/api/laura-memory/process-tool-result', {
        tool_name: toolName,
        tool_result: toolResult,
        user_query: userQuery,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          agent: 'laura'
        }
      });

      console.log(`[LAURA_MEMORY] 📚 Resultado procesado - ${toolName}: ${response.data.saved ? 'guardado' : 'no guardado'}`);
      return response.data;

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error procesando resultado:`, error.message);
      return { saved: false, error: error.message };
    }
  }

  /**
   * Mejorar query con contexto de memoria
   */
  async enhanceQueryWithMemory(query, limit = 3) {
    if (!this.enabled || !await this.isHealthy()) {
      return {
        enhanced_query: query,
        memory_context: '',
        memory_results: []
      };
    }

    try {
      const response = await this.client.post('/api/laura-memory/enhance-query', {
        query: query,
        limit: limit
      });

      if (response.data.memory_results && response.data.memory_results.length > 0) {
        console.log(`[LAURA_MEMORY] 🔍 Query mejorada con ${response.data.memory_results.length} resultados de memoria`);
      }

      return response.data;

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error mejorando query:`, error.message);
      return {
        enhanced_query: query,
        memory_context: '',
        memory_results: [],
        error: error.message
      };
    }
  }

  /**
   * Buscar en memoria pública
   */
  async searchMemory(query, limit = 5) {
    if (!this.enabled || !await this.isHealthy()) {
      return [];
    }

    try {
      const response = await this.client.post('/api/laura-memory/search', {
        query: query,
        limit: limit
      });

      console.log(`[LAURA_MEMORY] 🔍 Búsqueda "${query}" encontró ${response.data.results?.length || 0} resultados`);
      return response.data.results || [];

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error en búsqueda:`, error.message);
      return [];
    }
  }

  /**
   * Guardar descubrimiento de usuario en contexto PulsePolitics
   */
  async saveUserDiscovery(userInfo, discoveryContext = {}) {
    if (!this.enabled || !await this.isHealthy()) {
      return { saved: false, reason: 'Servicio no disponible' };
    }

    try {
      // Usar la estructura de datos que espera el endpoint básico
      const response = await this.client.post('/api/laura-memory/save-user-discovery', {
        user_name: userInfo.name || userInfo.originalText || 'Unknown',
        twitter_username: userInfo.handle || userInfo.username || '',
        description: userInfo.bio || userInfo.description || `${discoveryContext.discovery_type || 'dynamic'} discovery`,
        category: userInfo.category || discoveryContext.context || 'general'
      });

      console.log(`[LAURA_MEMORY] 👤 Usuario guardado en UserHandles: ${userInfo.user_name || userInfo.name || userInfo.originalText || 'Unknown'}`);
      return response.data;

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error guardando usuario:`, error.message);
      return { saved: false, error: error.message };
    }
  }

  /**
   * Buscar contexto político específico en el grafo compartido de PulsePolitics
   */
  async searchPoliticalContext(query, limit = 5) {
    if (!this.enabled || !await this.isHealthy()) {
      return [];
    }

    try {
      // Primero intentar buscar en PulsePolitics (grafo compartido)
      const response = await this.client.post('/api/laura-memory/search-pulsepolitics', {
        query: `${query} política político gobierno congreso presidente`,
        limit: limit
      });

      console.log(`[LAURA_MEMORY] 🏛️ Búsqueda en PulsePolitics "${query}" encontró ${response.data.results?.length || 0} resultados`);
      return response.data.results || [];

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error en búsqueda PulsePolitics:`, error.message);
      
      // Fallback a búsqueda en memoria personal si PulsePolitics falla
      try {
        const fallbackResponse = await this.client.post('/api/laura-memory/search', {
          query: `${query} política político gobierno congreso presidente`,
          limit: limit
        });
        
        console.log(`[LAURA_MEMORY] 🔄 Fallback a memoria personal para "${query}"`);
        return fallbackResponse.data.results || [];
        
      } catch (fallbackError) {
        console.error(`[LAURA_MEMORY] ❌ Error en fallback:`, fallbackError.message);
        return [];
      }
    }
  }

  /**
   * Obtener estadísticas del servicio de memoria
   */
  async getStats() {
    if (!this.enabled || !await this.isHealthy()) {
      return { error: 'Servicio no disponible' };
    }

    try {
      const response = await this.client.get('/api/laura-memory/stats');
      return response.data;

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error obteniendo estadísticas:`, error.message);
      return { error: error.message };
    }
  }

  /**
   * Guardar información en contexto específico
   */
  async saveToContext(content, context = 'general', metadata = {}) {
    if (!this.enabled || !await this.isHealthy()) {
      return { saved: false, reason: 'Servicio no disponible' };
    }

    try {
      const response = await this.client.post('/api/laura-memory/save-context', {
        content: content,
        context: context,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          source: 'laura-agent'
        }
      });

      console.log(`[LAURA_MEMORY] 💾 Contenido guardado en contexto "${context}"`);
      return response.data;

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error guardando en contexto:`, error.message);
      return { saved: false, error: error.message };
    }
  }

  /**
   * Procesar resultados de usuario discovery con contexto político
   */
  async processUserDiscoveryWithPoliticalContext(userInfo, discoveryType, originalQuery) {
    if (!this.enabled || !await this.isHealthy()) {
      return { processed: false, reason: 'Servicio no disponible' };
    }

    try {
      // Primero buscar contexto político relacionado
      const politicalContext = await this.searchPoliticalContext(originalQuery, 3);
      
      // Guardar usuario con contexto político
      const saveResult = await this.saveUserDiscovery(userInfo, {
        discovery_type: discoveryType,
        original_query: originalQuery,
        political_context: politicalContext,
        context_strength: politicalContext.length > 0 ? 'high' : 'low'
      });

      // El usuario ya se guardó en UserHandles arriba, no necesitamos doble guardado

      return {
        processed: true,
        saved: saveResult.saved,
        political_context: politicalContext,
        is_politically_relevant: this.isPoliticallyRelevant(userInfo, originalQuery)
      };

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error procesando discovery con contexto político:`, error.message);
      return { processed: false, error: error.message };
    }
  }

  /**
   * Determinar si un usuario es políticamente relevante
   */
  isPoliticallyRelevant(userInfo, originalQuery) {
    const politicalKeywords = [
      'presidente', 'ministro', 'diputado', 'congreso', 'gobierno', 
      'partido', 'político', 'alcalde', 'magistrado', 'política',
      'elecciones', 'campaña', 'ley', 'proyecto'
    ];
    
    const queryLower = originalQuery.toLowerCase();
    const userText = [
      userInfo.name || '',
      userInfo.bio || '',
      userInfo.description || '',
      ...(userInfo.context_keywords || [])
    ].join(' ').toLowerCase();
    
    // Verificar si la query o información del usuario contiene palabras políticas
    return politicalKeywords.some(keyword => 
      queryLower.includes(keyword) || userText.includes(keyword)
    );
  }

  /**
   * Agregar usuario al grafo político (usando endpoint básico como fallback)
   */
  async addToPoliticalGraph(userInfo, originalQuery, politicalContext) {
    try {
      // Como el endpoint específico no existe, usamos el guardado básico con contexto político
      console.log(`[LAURA_MEMORY] 🏛️ Agregando al contexto político: ${userInfo.name}`);
      
      const politicalDescription = `Usuario político relacionado con: ${originalQuery}. Contexto: ${politicalContext.join(', ')}`;
      
      return await this.saveUserDiscovery({
        name: userInfo.user_name || userInfo.name || userInfo.originalText,
        handle: userInfo.twitter_username || userInfo.handle || userInfo.username,
        bio: userInfo.bio || userInfo.description || politicalDescription,
        verified: userInfo.verified,
        followers_count: userInfo.followers_count
      }, {
        discovery_type: 'political_graph',
        context: 'political',
        original_query: originalQuery
      });

    } catch (error) {
      console.error(`[LAURA_MEMORY] ❌ Error agregando al grafo político:`, error.message);
      return { error: error.message };
    }
  }

  /**
   * Obtener configuración del cliente
   */
  getConfig() {
    return {
      baseURL: this.baseURL,
      enabled: this.enabled,
      timeout: this.timeout
    };
  }
}

module.exports = {
  LauraMemoryClient
}; 