/**
 * Handlers específicos para interacciones con Laura y Robert
 * Llamados desde Vizta en modo agéntico
 */

/**
 * Handlers para Laura Agent (Análisis Social)
 */
class LauraHandlers {
  constructor(lauraAgent) {
    this.laura = lauraAgent;
  }

  async handleNitterSearch(message, user, conversationId) {
    console.log(`[LAURA_HANDLER] 🐦 Búsqueda en Twitter: "${message}"`);
    
    try {
      // Usar lógica inteligente para determinar herramienta
      const tool = this.determineTwitterTool(message);
      
      const task = {
        id: `nitter_search_${Date.now()}`,
        agent: 'laura',
        tool: tool,
        type: tool === 'nitter_profile' ? 'profile' : 'monitoring',
        originalQuery: message,
        args: this.buildTwitterArgs(message, tool),
        user: user,
        useReasoningEngine: tool === 'nitter_context' // Solo usar reasoning para contexto general
      };

      const result = await this.laura.executeTask(task, user);
      
      // Verificar si encontró información de usuario y guardarlo en userhandles
      if (result && result.success && result.data) {
        await this.saveUserIfFound(result.data, message, user, tool);
      }
      
      return {
        agent: 'Laura',
        data: result,
        type: 'nitter_search_result',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[LAURA_HANDLER] ❌ Error en búsqueda Twitter:`, error);
      return {
        agent: 'Laura',
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async handleTwitterAnalysis(message, user, conversationId) {
    console.log(`[LAURA_HANDLER] 📊 Análisis de Twitter: "${message}"`);
    
    try {
      const task = {
        id: `twitter_analysis_${Date.now()}`,
        agent: 'laura',
        tool: 'nitter_context',
        type: 'analysis',
        originalQuery: message,
        args: {
          q: message,
          location: 'guatemala',
          limit: 25,
          analysis_type: 'sentiment'
        },
        user: user
      };

      const result = await this.laura.executeTask(task, user);
      
      return {
        agent: 'Laura',
        data: result,
        type: 'twitter_analysis_result',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[LAURA_HANDLER] ❌ Error en análisis Twitter:`, error);
      return {
        agent: 'Laura',
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async handleUserDiscovery(message, user, conversationId) {
    console.log(`[LAURA_HANDLER] 🔍 User Discovery: "${message}"`);
    
    try {
      // Usar directamente el UserDiscoveryEngine de Laura
      const userDiscoveryResult = await this.laura.userDiscovery.enhancedUserDetection(message, user);
      
      if (userDiscoveryResult && userDiscoveryResult !== 'USER_NOT_FOUND') {
        // Si encontró el usuario, obtener su perfil
        const task = {
          id: `user_discovery_profile_${Date.now()}`,
          agent: 'laura',
          tool: 'nitter_profile',
          type: 'profile',
          originalQuery: message,
          args: {
            username: userDiscoveryResult
          },
          user: user
        };

        const profileResult = await this.laura.executeTask(task, user);
        
        return {
          agent: 'Laura',
          data: {
            ...profileResult,
            discovered_username: userDiscoveryResult,
            original_query: message,
            discovery_successful: true
          },
          type: 'user_discovery_result',
          timestamp: new Date().toISOString()
        };
      } else {
        // Usuario no encontrado
        return {
          agent: 'Laura',
          data: {
            discovery_successful: false,
            original_query: message,
            message: `No pude encontrar información sobre "${message}" en Twitter. El usuario podría no existir o no tener cuenta pública.`
          },
          type: 'user_discovery_result',
          timestamp: new Date().toISOString()
        };
      }
      
    } catch (error) {
      console.error(`[LAURA_HANDLER] ❌ Error en User Discovery:`, error);
      return {
        agent: 'Laura',
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async handleTwitterProfile(message, user, conversationId) {
    console.log(`[LAURA_HANDLER] 👤 Búsqueda de perfil: "${message}"`);
    
    try {
      // Extraer usuario de la consulta
      const usernameMatch = message.match(/@(\w+)/) || message.match(/perfil de (\w+)/i);
      const username = usernameMatch ? usernameMatch[1] : message;

      const task = {
        id: `twitter_profile_${Date.now()}`,
        agent: 'laura',
        tool: 'nitter_profile',
        type: 'profile',
        originalQuery: message,
        args: {
          username: username,
          limit: 15
        },
        user: user
      };

      const result = await this.laura.executeTask(task, user);
      
      // Verificar si encontró información de usuario y guardarlo en userhandles
      if (result && result.success && result.data) {
        await this.saveUserIfFound(result.data, message, user, 'nitter_profile');
      }
      
      return {
        agent: 'Laura',
        data: result,
        type: 'twitter_profile_result', 
        timestamp: new Date().toISOString(),
        success: true,
        executionTime: Date.now() - Date.now() // Placeholder
      };
      
    } catch (error) {
      console.error(`[LAURA_HANDLER] ❌ Error en búsqueda de perfil:`, error);
      return {
        agent: 'Laura',
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString(),
        success: false,
        executionTime: 0
      };
    }
  }

  async handleWebSearch(message, user, conversationId) {
    console.log(`[LAURA_HANDLER] 🔍 Búsqueda web: "${message}"`);
    
    try {
      const task = {
        id: `web_search_${Date.now()}`,
        agent: 'laura',
        tool: 'perplexity_search',
        type: 'research',
        originalQuery: message,
        args: {
          query: message,
          location: 'Guatemala'
        },
        user: user
      };

      const result = await this.laura.executeTask(task, user);
      
      // Verificar si encontró información de usuario y guardarlo en userhandles
      if (result && result.success && result.data) {
        await this.saveUserIfFound(result.data, message, user, 'perplexity_search');
      }
      
      return {
        agent: 'Laura',
        data: result,
        type: 'web_search_result',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[LAURA_HANDLER] ❌ Error en búsqueda web:`, error);
      return {
        agent: 'Laura',
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Guardar usuario en userhandles si se encontró información relevante
   */
  async saveUserIfFound(resultData, originalQuery, user, discoveryMethod) {
    try {
      if (!this.laura.internalMemoryClient?.enabled) {
        return false;
      }

      // Buscar información de usuario en el resultado
      let userName = null;
      let twitterHandle = null;
      let description = '';

      // Extraer de texto usando patrones comunes
      const content = typeof resultData === 'string' ? resultData : 
                     resultData.formatted_response || resultData.content || JSON.stringify(resultData);

      if (content) {
        // Buscar handles de Twitter (@username)
        const handleMatch = content.match(/@([a-zA-Z0-9_]+)/);
        if (handleMatch) {
          twitterHandle = handleMatch[1];
        }

        // Buscar nombres en el contexto original
        const nameMatch = originalQuery.match(/(?:busca a|encuentra a|tweets de|perfil de|extrae|información sobre|quién es)\s+([^.?!]+)/i);
        if (nameMatch) {
          userName = nameMatch[1].trim();
        }

        // Si tenemos tanto nombre como handle, guardar
        if (userName && twitterHandle && userName.length > 2) {
          console.log(`[LAURA_HANDLER] 💾 Guardando usuario descubierto: ${userName} → @${twitterHandle}`);
          
          const saveResult = await this.laura.internalMemoryClient.saveUserDiscovery({
            user_name: userName,
            twitter_username: twitterHandle,
            description: `Descubierto vía ${discoveryMethod}`,
            category: 'discovered'
          }, {
            discovery_type: discoveryMethod,
            context: originalQuery,
            confidence: 0.8
          });

          if (saveResult.success) {
            console.log(`[LAURA_HANDLER] ✅ Usuario guardado en userhandles: ${userName} → @${twitterHandle}`);
            return true;
          } else {
            console.warn(`[LAURA_HANDLER] ⚠️ Error guardando usuario:`, saveResult.error);
          }
        }
      }

      return false;
    } catch (error) {
      console.error(`[LAURA_HANDLER] ❌ Error en saveUserIfFound:`, error);
      return false;
    }
  }

  /**
   * Determinar qué herramienta de Twitter usar basado en el mensaje
   */
  determineTwitterTool(message) {
    const q = message.toLowerCase();
    
    // Detectar handles explícitos (@username)
    if (q.includes('@')) {
      return 'nitter_profile';
    }
    
    // Detectar nombres conocidos directamente - usar nitter_context con nombre
    if (q.includes('bernardo arevalo') || q.includes('bernardo arévalo')) {
      return 'nitter_context';
    }
    
    // Detectar búsqueda de tweets con nombres - intentar nitter_context primero
    if (q.includes('tweets de') || q.includes('extrame') || q.includes('extrae')) {
      return 'nitter_context';
    }
    
    // Detectar búsqueda de perfiles específicos
    if (q.includes('perfil de')) {
      return 'nitter_context';
    }
    
    // Solo usar perplexity para investigación general o cuando no sepamos el handle
    if (q.includes('investiga') || q.includes('información sobre') || q.includes('quién es')) {
      return 'perplexity_search';
    }
    
    // Default: contexto general de Twitter
    return 'nitter_context';
  }

  /**
   * Construir argumentos para herramientas de Twitter
   */
  buildTwitterArgs(message, tool) {
    switch (tool) {
      case 'nitter_context':
        return {
          q: message,
          location: 'guatemala',
          limit: 20
        };
        
      case 'nitter_profile':
        // Extraer username si está presente
        const usernameMatch = message.match(/@(\w+)/);
        return {
          username: usernameMatch ? usernameMatch[1] : 'unknown',
          limit: 15
        };
        
      case 'resolve_twitter_handle':
      case 'perplexity_search':
        // Extraer nombre para buscar handle
        const nameMatch = message.match(/(?:tweets de|perfil de|extrame|extrae)\s+(.+?)(?:\s|$)/i);
        const name = nameMatch ? nameMatch[1].trim() : message;
        return {
          query: `Twitter handle @username para ${name} Guatemala perfil oficial`,
          location: 'Guatemala',
          focus: 'social_media'
        };
        
      case 'perplexity_search':
        return {
          query: message,
          focus: 'social_media'
        };
        
      default:
        return {
          q: message,
          location: 'guatemala',
          limit: 20
        };
    }
  }
}

/**
 * Handlers para Robert Agent (Datos Personales)
 */
class RobertHandlers {
  constructor(robertAgent) {
    this.robert = robertAgent;
  }

  async handleSearchCodex(message, user, conversationId) {
    console.log(`[ROBERT_HANDLER] 📚 Búsqueda en Codex: "${message}"`);
    
    try {
      const task = {
        id: `codex_search_${Date.now()}`,
        agent: 'robert',
        tool: 'codex_items',
        type: 'codex',
        collection: 'codex_items',
        description: 'Búsqueda en documentos del usuario',
        originalQuery: message,
        args: {
          query: message,
          limit: 10
        },
        user: user
      };

      const result = await this.robert.executeTask(task, user);
      
      return {
        agent: 'Robert',
        
        data: result,
        type: 'codex_search_result',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[ROBERT_HANDLER] ❌ Error en búsqueda Codex:`, error);
      return {
        agent: 'Robert',
        
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async handleSearchProjects(message, user, conversationId) {
    console.log(`[ROBERT_HANDLER] 📋 Búsqueda de proyectos: "${message}"`);
    
    try {
      const task = {
        id: `projects_search_${Date.now()}`,
        agent: 'robert',
        tool: 'user_projects',
        type: 'projects',
        collection: 'user_projects',
        description: 'Consulta de proyectos del usuario',
        originalQuery: message,
        args: {
          status: 'active'
        },
        user: user
      };

      const result = await this.robert.executeTask(task, user);
      
      return {
        agent: 'Robert',
        
        data: result,
        type: 'projects_search_result',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[ROBERT_HANDLER] ❌ Error en búsqueda de proyectos:`, error);
      return {
        agent: 'Robert',
        
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async handleAnalyzeDocument(message, user, conversationId) {
    console.log(`[ROBERT_HANDLER] 📄 Análisis de documento: "${message}"`);
    
    try {
      const task = {
        id: `document_analysis_${Date.now()}`,
        agent: 'robert',
        tool: 'codex_items',
        type: 'analysis',
        collection: 'codex_items',
        description: 'Análisis de documento específico',
        originalQuery: message,
        args: {
          query: message,
          analysis_type: 'summary',
          limit: 5
        },
        user: user
      };

      const result = await this.robert.executeTask(task, user);
      
      return {
        agent: 'Robert',
        
        data: result,
        type: 'document_analysis_result',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[ROBERT_HANDLER] ❌ Error en análisis de documento:`, error);
      return {
        agent: 'Robert',
        
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Handler para análisis mixtos (Laura + Robert)
 */
class MixedHandlers {
  constructor(lauraAgent, robertAgent) {
    this.laura = lauraAgent;
    this.robert = robertAgent;
  }

  async handleMixedAnalysis(message, user, conversationId) {
    console.log(`[MIXED_HANDLER] 🔄 Análisis mixto: "${message}"`);
    
    try {
      // Ejecutar ambos agentes en paralelo
      const [lauraResult, robertResult] = await Promise.allSettled([
        this.laura.executeTask({
          id: `mixed_laura_${Date.now()}`,
          agent: 'laura',
          tool: 'nitter_context',
          type: 'monitoring',
          originalQuery: message,
          args: { q: message, location: 'guatemala', limit: 15 },
          user: user
        }, user),
        this.robert.executeTask({
          id: `mixed_robert_${Date.now()}`,
          agent: 'robert',
          tool: 'user_projects',
          type: 'projects',
          collection: 'user_projects',
          description: 'Búsqueda de contexto en proyectos',
          originalQuery: message,
          args: { status: 'active' },
          user: user
        }, user)
      ]);

      return {
        agent: 'Vizta',
        
        data: {
          laura: lauraResult.status === 'fulfilled' ? lauraResult.value : null,
          robert: robertResult.status === 'fulfilled' ? robertResult.value : null
        },
        type: 'mixed_analysis_result',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[MIXED_HANDLER] ❌ Error en análisis mixto:`, error);
      return {
        agent: 'Vizta',
        
        error: error.message,
        type: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = {
  LauraHandlers,
  RobertHandlers,
  MixedHandlers
}; 