/**
 * Cliente JavaScript para comunicarse con el servidor de Laura Memory.
 */

const fetch = require('node-fetch');

class LauraMemoryClient {
  constructor() {
    // Support both internal and external Laura Memory service locations
    this.baseUrl = process.env.LAURA_MEMORY_URL || 'http://localhost:5001';
    this.enabled = process.env.LAURA_MEMORY_ENABLED === 'true';
    
    // Log configuration on startup
    console.log(`🔧 [LauraMemory] Cliente configurado - URL: ${this.baseUrl}, Habilitado: ${this.enabled}`);
  }

  /**
   * Verifica si el cliente está habilitado y el servicio está disponible.
   */
  async isAvailable() {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 2000
      });
      return response.ok;
    } catch (error) {
      console.warn('⚠️ [LauraMemory] Servicio no disponible:', error.message);
      return false;
    }
  }

  /**
   * Procesa el resultado de una herramienta y determina si guardarlo en memoria.
   */
  async processToolResult(toolName, toolResult, userQuery = '') {
    if (!await this.isAvailable()) {
      return { saved: false, reason: 'Servicio no disponible' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/laura-memory/process-tool-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool_name: toolName,
          tool_result: toolResult,
          user_query: userQuery
        })
      });

      const result = await response.json();
      
      if (result.saved) {
        console.log('📚 [LauraMemory] Información guardada:', result.content);
      }

      return result;
    } catch (error) {
      console.error('❌ [LauraMemory] Error procesando resultado:', error);
      return { saved: false, error: error.message };
    }
  }

  /**
   * Mejora una query con información de la memoria.
   */
  async enhanceQueryWithMemory(query, limit = 3) {
    if (!await this.isAvailable()) {
      return { enhanced_query: query, memory_context: '', memory_results: [] };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/laura-memory/enhance-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit })
      });

      const result = await response.json();
      
      if (result.memory_results && result.memory_results.length > 0) {
        console.log(`🧠 [LauraMemory] Query mejorada con ${result.memory_results.length} resultados de memoria`);
      }

      return result;
    } catch (error) {
      console.error('❌ [LauraMemory] Error mejorando query:', error);
      return { enhanced_query: query, memory_context: '', memory_results: [], error: error.message };
    }
  }

  /**
   * Guarda información de un usuario descubierto con ML.
   */
  async saveUserDiscovery(userName, twitterUsername, description = '', category = '') {
    if (!await this.isAvailable()) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/laura-memory/save-user-discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_name: userName,
          twitter_username: twitterUsername,
          description,
          category
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ [LauraMemory] Usuario guardado: ${userName} (@${twitterUsername})`);
      }

      return result.success;
    } catch (error) {
      console.error('❌ [LauraMemory] Error guardando usuario:', error);
      return false;
    }
  }

  /**
   * Busca en la memoria pública.
   */
  async searchMemory(query, limit = 5) {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/laura-memory/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit })
      });

      const result = await response.json();
      
      console.log(`🔍 [LauraMemory] Búsqueda '${query}' → ${result.results.length} resultados`);
      
      return result.results || [];
    } catch (error) {
      console.error('❌ [LauraMemory] Error buscando en memoria:', error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas de la memoria.
   */
  async getMemoryStats() {
    if (!await this.isAvailable()) {
      return { error: 'Servicio no disponible' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/laura-memory/stats`);
      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('❌ [LauraMemory] Error obteniendo estadísticas:', error);
      return { error: error.message };
    }
  }
}

// Instancia global
const lauraMemoryClient = new LauraMemoryClient();

module.exports = lauraMemoryClient;