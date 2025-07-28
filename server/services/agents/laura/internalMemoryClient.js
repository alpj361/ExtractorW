/**
 * Internal Memory Client para Laura Agent
 * Interfaz directa con el módulo Python laura_memory sin HTTP
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class InternalMemoryClient {
  constructor(options = {}) {
    this.enabled = options.enabled !== undefined ? options.enabled : 
                  (process.env.LAURA_MEMORY_ENABLED || 'true').toLowerCase() === 'true';
    
    // URL del Laura Memory Service
    this.baseUrl = options.baseUrl || process.env.LAURA_MEMORY_URL || 'http://host.docker.internal:5001';
    
    // Ruta al módulo Python (para funciones legacy que aún lo usen)
    this.pythonPath = path.join(__dirname, '../../laura_memory');
    
    console.log(`[LAURA_MEMORY_INTERNAL] 🧠 Cliente interno inicializado - Enabled: ${this.enabled}, URL: ${this.baseUrl}`);
  }

  /**
   * Ejecutar comando Python directamente
   */
  async executePythonCommand(functionName, args = {}) {
    if (!this.enabled) {
      return { success: false, reason: 'Servicio deshabilitado' };
    }

    return new Promise((resolve, reject) => {
      const pythonScript = path.join(this.pythonPath, 'internal_interface.py');
      const argsJson = JSON.stringify({ function: functionName, args });
      
      // Usar el entorno virtual donde están instaladas las dependencias
      const venvPath = path.join(this.pythonPath, 'venv', 'bin', 'python');
      const pythonCommand = fs.existsSync(venvPath) ? venvPath : 'python3';
      
      const pythonProcess = spawn(pythonCommand, [pythonScript], {
        cwd: this.pythonPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: this.pythonPath
        }
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (parseError) {
            console.error(`[LAURA_MEMORY_INTERNAL] ❌ Error parsing output: ${parseError}`);
            resolve({ success: false, error: 'Parse error', output });
          }
        } else {
          console.error(`[LAURA_MEMORY_INTERNAL] ❌ Python error (${code}): ${errorOutput}`);
          reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error(`[LAURA_MEMORY_INTERNAL] ❌ Process error: ${error}`);
        reject(error);
      });

      // Enviar argumentos al proceso Python
      pythonProcess.stdin.write(argsJson);
      pythonProcess.stdin.end();
    });
  }

  /**
   * Guardar usuario descubierto en UserHandles usando HTTP endpoint
   */
  async saveUserDiscovery(userInfo, discoveryContext = {}) {
    if (!this.enabled) {
      return { success: false, reason: 'Servicio deshabilitado' };
    }

    try {
      const axios = require('axios');
      const userData = {
        user_name: userInfo.user_name || userInfo.name || userInfo.originalText || 'Unknown',
        twitter_username: userInfo.twitter_username || userInfo.handle || userInfo.username || '',
        description: userInfo.description || userInfo.bio || `${discoveryContext.discovery_type || 'dynamic'} discovery`,
        category: userInfo.category || discoveryContext.context || 'general'
      };

      const response = await axios.post(
        `${this.baseUrl}/api/laura-memory/save-userhandle`,
        userData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (response.data.success) {
        console.log(`[LAURA_MEMORY_INTERNAL] 👤 Usuario guardado en UserHandles: ${userData.user_name} → @${userData.twitter_username}`);
        return { success: true };
      } else {
        console.error(`[LAURA_MEMORY_INTERNAL] ❌ Error del servidor:`, response.data.error);
        return { success: false, error: response.data.error };
      }
      
    } catch (error) {
      console.error(`[LAURA_MEMORY_INTERNAL] ❌ Error guardando usuario:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Buscar usuarios en UserHandles usando HTTP endpoint
   */
  async searchUserHandles(query, limit = 5) {
    if (!this.enabled) {
      return [];
    }

    try {
      const axios = require('axios');
      
      const response = await axios.post(
        `${this.baseUrl}/api/laura-memory/search-userhandles`,
        { query, limit },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      const results = response.data.results || [];
      console.log(`[LAURA_MEMORY_INTERNAL] 🔍 UserHandles búsqueda '${query}': ${results.length} resultados`);
      return results;
      
    } catch (error) {
      console.error(`[LAURA_MEMORY_INTERNAL] ❌ Error buscando usuarios:`, error.message);
      return [];
    }
  }

  /**
   * Guardar información en PulsePolitics
   */
  async saveToPolitics(content, metadata = {}) {
    if (!this.enabled) {
      return { success: false, reason: 'Servicio deshabilitado' };
    }

    try {
      const result = await this.executePythonCommand('add_to_pulsepolitics', {
        content,
        metadata
      });

      if (result.success) {
        console.log(`[LAURA_MEMORY_INTERNAL] 🏛️ Información guardada en PulsePolitics`);
      }
      
      return result;
    } catch (error) {
      console.error(`[LAURA_MEMORY_INTERNAL] ❌ Error guardando en PulsePolitics:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Buscar en PulsePolitics
   */
  async searchPoliticalContext(query, limit = 5) {
    if (!this.enabled) {
      return [];
    }

    try {
      const result = await this.executePythonCommand('search_pulsepolitics', {
        query,
        limit
      });

      return result.results || [];
    } catch (error) {
      console.error(`[LAURA_MEMORY_INTERNAL] ❌ Error buscando contexto político:`, error.message);
      return [];
    }
  }

  /**
   * Health check del módulo Python
   */
  async isHealthy() {
    try {
      const result = await this.executePythonCommand('health_check', {});
      return result.success === true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = { InternalMemoryClient }; 