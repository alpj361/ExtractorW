/**
 * Motor de Descubrimiento de Usuarios
 * Maneja detección, resolución y análisis de usuarios en redes sociales
 */

const mcpService = require('../../mcp');

// Helper para GPT-3.5-turbo
async function gptChat(messages, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurado');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: options.temperature || 0.2,
      max_tokens: options.maxTokens || 1024,
      top_p: options.topP || 0.95
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

class UserDiscoveryEngine {
  constructor(lauraAgent) {
    this.laura = lauraAgent;
    
    // Base de conocimiento vacía - todos los handles se resuelven dinámicamente
    this.knownUsers = new Map();
  }

  /**
   * Detección mejorada de usuarios usando LLM y contexto PulsePolitics
   */
  async enhancedUserDetection(userQuery, user) {
    try {
      console.log(`[LAURA] 🔍 Iniciando detección LLM mejorada para: "${userQuery}"`);
      
      // Paso 0: Buscar contexto político relevante para mejorar detección
      let politicalContext = [];
      if (this.laura.memoryClient?.enabled) {
        try {
          politicalContext = await this.laura.memoryClient.searchPoliticalContext(userQuery, 3);
          if (politicalContext.length > 0) {
            console.log(`[LAURA] 🏛️ Contexto político encontrado: ${politicalContext.length} referencias`);
          }
        } catch (error) {
          console.warn(`[LAURA] ⚠️ Error buscando contexto político:`, error.message);
        }
      }
      
      // Paso 1: Verificar usuarios conocidos
      const knownUser = this.checkKnownUsers(userQuery);
      if (knownUser) {
        console.log(`[LAURA] ✅ Usuario conocido encontrado: ${knownUser}`);
        return knownUser;
      }

      // Paso 2: Análisis LLM para identificar entidades (con contexto político)
      const llmAnalysis = await this.lauraLLMUserAnalysis(userQuery, politicalContext);
      console.log(`[LAURA] 📊 Análisis LLM completado:`, llmAnalysis);
      
      // Paso 3: Resolver usuarios potenciales si fueron identificados
      if (llmAnalysis.potentialUsers?.length > 0) {
        console.log(`[LAURA] 🎯 Resolviendo ${llmAnalysis.potentialUsers.length} usuarios potenciales...`);
        const resolvedUsers = await this.resolveUsersWithLLM(llmAnalysis.potentialUsers, user);
        
        if (resolvedUsers.length > 0) {
          console.log(`[LAURA] ✅ Usuarios resueltos exitosamente:`, resolvedUsers);
          
          // Guardar usuario descubierto en PulsePolitics si es relevante
          await this.saveDiscoveredUserToPolitics(resolvedUsers[0], userQuery, 'llm_resolution', politicalContext);
          
          return resolvedUsers[0].username; // Retornar primer usuario resuelto
        }
      }
      
      // Paso 4: Fallback a detección legacy si es necesario
      console.log(`[LAURA] 🔄 Fallback a detección legacy para: "${userQuery}"`);
      const legacyResult = await this.fallbackUserDetection(userQuery, user);
      
      // Si encontró algo en legacy, también guardarlo
      if (legacyResult && legacyResult !== 'USER_NOT_FOUND') {
        await this.saveDiscoveredUserToPolitics({
          username: legacyResult,
          name: userQuery,
          discovery_method: 'legacy_detection'
        }, userQuery, 'legacy_detection', politicalContext);
      }
      
      return legacyResult;
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en detección LLM mejorada:`, {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        timestamp: new Date().toISOString()
      });
      return await this.fallbackUserDetection(userQuery, user);
    }
  }

  /**
   * Verificar usuarios conocidos en base de conocimiento
   */
  checkKnownUsers(query) {
    const normalizedQuery = query.toLowerCase().trim();
    
    for (const [name, handle] of this.knownUsers) {
      if (normalizedQuery.includes(name)) {
        return handle;
      }
    }
    
    return null;
  }

  /**
   * Análisis LLM para identificar usuarios con contexto político
   */
  async lauraLLMUserAnalysis(userQuery, politicalContext = []) {
    try {
      let contextPrompt = '';
      if (politicalContext.length > 0) {
        contextPrompt = `\n\nCONTEXTO POLÍTICO RELEVANTE:
${politicalContext.map((ctx, i) => `${i + 1}. ${ctx}`).join('\n')}

Usa este contexto para mejorar la identificación de usuarios políticos y determinar si son relevantes.`;
      }

      const analysisPrompt = `Extrae SOLO el nombre de la persona de esta consulta sobre Twitter:

Consulta: "${userQuery}"${contextPrompt}

INSTRUCCIONES ESPECÍFICAS:
1. Si la consulta dice "extrae tweets de [NOMBRE]", extrae SOLO el NOMBRE
2. Si dice "tweets de [NOMBRE]", extrae SOLO el NOMBRE  
3. Si dice "perfil de [NOMBRE]", extrae SOLO el NOMBRE
4. NO incluyas palabras como "extrae", "tweets", "de", "perfil"
5. Extrae SOLO nombres propios de personas

EJEMPLOS:
- "extrae tweets de Karin Herrera" → originalText: "Karin Herrera"
- "tweets de Bernardo Arevalo" → originalText: "Bernardo Arevalo"
- "perfil de Sandra Torres" → originalText: "Sandra Torres"

Responde en JSON:
{
  "potentialUsers": [
    {
      "originalText": "SOLO_EL_NOMBRE_DE_LA_PERSONA",
      "userType": "person",
      "confidence": 0.95,
      "context": "Persona mencionada en consulta de Twitter",
      "politicalRelevance": "medium"
    }
  ],
  "requiresResolution": true,
  "suggestedQueries": [],
  "politicallyRelevant": true
}

CRÍTICO: En originalText pon SOLO el nombre de la persona, NO toda la frase.`;
      
      console.log(`[LAURA] 🤖 Enviando análisis LLM con contexto político...`);
      
      const llmResult = await gptChat([{ role: 'user', content: analysisPrompt }], {
        temperature: 0.1
      });
      
      if (llmResult) {
        try {
          const parsed = JSON.parse(llmResult);
          console.log(`[LAURA] 📋 Análisis LLM parseado exitosamente:`, parsed);
          return parsed;
        } catch (parseError) {
          console.error(`[LAURA] ❌ Error parsing LLM response:`, parseError);
          console.log(`[LAURA] 📄 Respuesta LLM original:`, llmResult);
          return { potentialUsers: [], requiresResolution: false };
        }
      }
      
      console.log(`[LAURA] ⚠️  LLM no devolvió contenido válido:`, llmResult);
      return { potentialUsers: [], requiresResolution: false };
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en análisis LLM:`, error);
      return { potentialUsers: [], requiresResolution: false };
    }
  }

  /**
   * Resolver usuarios potenciales usando búsqueda híbrida:
   * 1. Buscar primero en UserHandles (memoria Zep)
   * 2. Si no existe, resolver con herramientas MCP
   * 3. Guardar nuevos descubrimientos en UserHandles
   */
  async resolveUsersWithLLM(potentialUsers, user) {
    const resolvedUsers = [];
    
    for (const potentialUser of potentialUsers) {
      try {
        console.log(`[LAURA] 🔍 Resolviendo usuario: "${potentialUser.originalText}"`);
        
        // PASO 1: Buscar primero en UserHandles (memoria Zep)
        let existingHandle = null;
        if (this.laura.internalMemoryClient?.enabled) {
          try {
            console.log(`[LAURA] 🔍 Buscando en UserHandles: "${potentialUser.originalText}"`);
            const userHandleResults = await this.laura.internalMemoryClient.searchUserHandles(potentialUser.originalText, 3);
            
            // Parse results from Zep - they come as strings like "Usuario: Name (@handle) - description"
            let existingHandleFromMemory = null;
            console.log(`[LAURA] 🔍 Procesando ${userHandleResults.length} resultados de UserHandles para "${potentialUser.originalText}"`);
            
            for (const result of userHandleResults) {
              if (typeof result === 'string' && result.trim()) {
                // Extract Twitter handle from string format
                const handleMatch = result.match(/@([a-zA-Z0-9_]+)/);
                if (handleMatch) {
                  const foundHandle = handleMatch[1];
                  
                  // Extract name from the result string for comparison
                  let nameFromResult = '';
                  const userMatch = result.match(/Usuario:\s*([^(@]+)/);
                  if (userMatch) {
                    nameFromResult = userMatch[1].trim();
                  }
                  
                  // Check if this result matches the person we're looking for
                  const searchName = potentialUser.originalText.toLowerCase();
                  const resultNameLower = nameFromResult.toLowerCase();
                  const fullResultLower = result.toLowerCase();
                  
                  // Multiple matching strategies
                  const exactNameMatch = resultNameLower === searchName;
                  const nameContains = resultNameLower.includes(searchName) || searchName.includes(resultNameLower);
                  const fullTextContains = fullResultLower.includes(searchName);
                  const similarity = this.calculateSimilarity(searchName, resultNameLower);
                  
                  if (exactNameMatch || nameContains || (fullTextContains && similarity > 0.5)) {
                    existingHandleFromMemory = foundHandle;
                    console.log(`[LAURA] ✅ Usuario encontrado en UserHandles: "${potentialUser.originalText}" → @${foundHandle}`);
                    console.log(`[LAURA] 📄 Matched: "${nameFromResult}" (${similarity.toFixed(2)} similarity)`);
                    break;
                  }
                }
              }
            }
            
            if (existingHandleFromMemory) {
              resolvedUsers.push({
                originalQuery: potentialUser.originalText,
                username: existingHandleFromMemory,
                confidence: 0.95,
                source: 'userhandles_memory'
              });
              continue; // Skip external search
            } else {
              console.log(`[LAURA] 🔍 Usuario "${potentialUser.originalText}" no encontrado en UserHandles, procediendo con búsqueda externa`);
            }
          } catch (error) {
            console.warn(`[LAURA] ⚠️ Error buscando en UserHandles:`, error.message);
          }
        }
        
        // PASO 2: Si no existe en UserHandles, resolver con herramientas MCP
        const resolveResult = await mcpService.executeTool('resolve_twitter_handle', {
          name: potentialUser.originalText,
          context: potentialUser.context || '',
          sector: this.inferSector(potentialUser.userType)
        }, user);
        
        if (resolveResult.success && resolveResult.resolved_username) {
          const resolvedUsername = resolveResult.resolved_username;
          
          resolvedUsers.push({
            originalQuery: potentialUser.originalText,
            username: resolvedUsername,
            confidence: resolveResult.confidence || potentialUser.confidence,
            source: 'resolve_twitter_handle'
          });
          
          console.log(`[LAURA] ✅ Usuario resuelto: "${potentialUser.originalText}" → @${resolvedUsername}`);
          
          // PASO 3: Guardar nuevo descubrimiento en UserHandles
          if (this.laura.internalMemoryClient?.enabled) {
            try {
              await this.laura.internalMemoryClient.saveUserDiscovery({
                user_name: potentialUser.originalText,
                twitter_username: resolvedUsername,
                description: `Descubierto vía ${resolveResult.method || 'búsqueda híbrida'}`,
                category: potentialUser.userType || 'person'
              }, {
                discovery_type: 'twitter_resolution',
                context: potentialUser.context || '',
                confidence: resolveResult.confidence || potentialUser.confidence
              });
              
              console.log(`[LAURA] 💾 Nuevo usuario guardado en UserHandles: ${potentialUser.originalText} → @${resolvedUsername}`);
            } catch (error) {
              console.warn(`[LAURA] ⚠️ Error guardando en UserHandles:`, error.message);
            }
          }
        } else {
          console.log(`[LAURA] ❌ No se pudo resolver: "${potentialUser.originalText}"`);
        }
        
      } catch (error) {
        console.error(`[LAURA] ❌ Error resolviendo usuario:`, error);
      }
    }
    
    return resolvedUsers;
  }

  /**
   * Calcular similitud entre dos strings (algoritmo simple)
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Normalizar strings
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    // Similitud basada en palabras comunes
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords.length / totalWords;
  }

  /**
   * Inferir sector basado en tipo de usuario
   */
  inferSector(userType) {
    const sectorMap = {
      'role': 'gobierno',
      'institution': 'gobierno',
      'specific': '',
      'person': ''
    };
    
    return sectorMap[userType] || '';
  }

  /**
   * Detección legacy como fallback
   */
  async fallbackUserDetection(userQuery, user) {
    try {
      console.log(`[LAURA] 🔄 Iniciando detección legacy para: "${userQuery}"`);
      
      // Patrones regex para detectar usuarios
      const patterns = [
        /@(\w+)/g,  // @username directo
        /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g,  // Nombres propios
        /(presidente|ministro|diputado|alcalde)\s+([a-z\s]+)/gi  // Cargos
      ];
      
      for (const pattern of patterns) {
        const matches = userQuery.match(pattern);
        if (matches) {
          for (const match of matches) {
            const cleanMatch = match.replace('@', '').trim();
            
            // Intentar resolución directa
            try {
              const resolveResult = await mcpService.executeTool('resolve_twitter_handle', {
                name: cleanMatch,
                context: '',
                sector: ''
              }, user);
              
              if (resolveResult.success && resolveResult.resolved_username) {
                console.log(`[LAURA] ✅ Detección legacy exitosa: "${cleanMatch}" → @${resolveResult.resolved_username}`);
                return resolveResult.resolved_username;
              }
            } catch (error) {
              console.log(`[LAURA] ⚠️ Error en resolución legacy:`, error.message);
            }
          }
        }
      }
      
      console.log(`[LAURA] ❌ Detección legacy no encontró usuarios válidos`);
      return null;
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en detección legacy:`, error);
      return null;
    }
  }

  /**
   * Mejorar resultado de perfil con contexto Perplexity
   */
  async enhanceProfileWithPerplexity(username, user) {
    try {
      console.log(`[LAURA] 🔍 Mejorando perfil @${username} con contexto Perplexity`);
      
      const perplexityQuery = `¿Quién es @${username} en Twitter/X? Dame información sobre su identidad, profesión, relevancia pública en Guatemala, y contexto político si aplica.`;
      
      const perplexityResult = await mcpService.executeTool('perplexity_search', {
        query: perplexityQuery,
        location: 'Guatemala',
        focus: 'profile_context'
      }, user);
      
      if (perplexityResult.success && perplexityResult.formatted_response) {
        console.log(`[LAURA] ✅ Contexto Perplexity obtenido para @${username}`);
        
        return {
          source: 'perplexity_search',
          context: perplexityResult.formatted_response,
          timestamp: new Date().toISOString(),
          username: username
        };
      } else {
        console.log(`[LAURA] ⚠️ No se pudo obtener contexto Perplexity para @${username}`);
        return null;
      }
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error obteniendo contexto Perplexity:`, error);
      return null;
    }
  }

  /**
   * Pipeline híbrido inteligente para resolver handles de Twitter
   */
  async resolveTwitterHandle(args, user = null) {
    const { name, context = '', sector = '' } = args;
    console.log(`[LAURA] 🔍 Iniciando pipeline HÍBRIDO INTELIGENTE para: "${name}"`);
    
    try {
      // Si ya contiene @, limpiarlo y verificar directamente  
      if (name.includes('@')) {
        const cleanHandle = name.replace('@', '').trim();
        console.log(`[LAURA] 🎯 Handle directo detectado: @${cleanHandle}`);
        
        const isValid = await this.verifyTwitterHandle(cleanHandle);
        if (isValid) {
          return {
            success: true,
            handle: cleanHandle,
            confidence: 10,
            method: 'direct_handle',
            resolved_username: cleanHandle,
            needs_profile: true
          };
        } else {
          return {
            success: false,
            error: `El handle @${cleanHandle} no existe o no es accesible`,
            method: 'direct_handle_failed'
          };
        }
      }

      // PASO 1: Búsqueda con Perplexity usando prompt específico
      console.log(`[LAURA] 🔍 PASO 1: Buscando perfil con Perplexity (prompt específico)...`);
      const specificProfilePrompt = `Devuélveme SOLO la URL completa (empezando por https://twitter.com/ o https://x.com/) del perfil oficial de X/Twitter de ${name}. Si no existe, responde EXACTAMENTE la palabra NONE.`;

      let personInfo = '';
      let initialExtractionResult = null;

      try {
        const perplexityResult = await mcpService.executeTool('perplexity_search', {
          query: specificProfilePrompt,
          location: 'Guatemala',
          focus: 'twitter_search'
        }, user);

        if (perplexityResult.success && perplexityResult.formatted_response) {
          personInfo = perplexityResult.formatted_response;
          console.log(`[LAURA] ✅ Información inicial obtenida: ${personInfo.length} caracteres`);
          
          // Extraer handle directamente de URLs
          initialExtractionResult = this.extractHandleFromText(personInfo);
          
          if (initialExtractionResult.success) {
            console.log(`[LAURA] 🎯 Handle extraído directamente: @${initialExtractionResult.handle}`);
            return {
              success: true,
              handle: initialExtractionResult.handle,
              confidence: initialExtractionResult.confidence,
              method: 'direct_url_extraction',
              resolved_username: initialExtractionResult.handle,
              needs_profile: true,
              source_info: personInfo.substring(0, 200)
            };
          }
        } else {
          console.log(`[LAURA] ⚠️ Perplexity no devolvió información útil`);
        }
      } catch (error) {
        console.log(`[LAURA] ❌ Error en búsqueda Perplexity inicial:`, error.message);
      }

      // PASO 2: Búsqueda multi-estrategia si no se encontró directamente
      console.log(`[LAURA] 🔍 PASO 2: Iniciando búsqueda multi-estrategia...`);
      
      const searchStrategies = await this.generateSearchStrategies(name, personInfo, context, sector);
      const searchResults = await this.executeSearchStrategies(searchStrategies, user);
      
      // PASO 3: Análisis LLM de todos los resultados
      const extractionResult = await this.extractHandleFromSearchResults(searchResults, name);
      
      if (extractionResult.success) {
        return {
          success: true,
          handle: extractionResult.handle,
          confidence: extractionResult.confidence,
          method: 'multi_strategy_search',
          resolved_username: extractionResult.handle,
          needs_profile: true,
          search_strategies_used: searchStrategies.length,
          extraction_reasoning: extractionResult.reasoning
        };
      }

      // PASO 4: Fallback - Machine Learning Discovery
      console.log(`[LAURA] 🤖 PASO 4: Fallback ML Discovery...`);
      const mlResult = await this.discoverPersonWithML(name);
      
      if (mlResult.handle && mlResult.handle !== 'NONE') {
        return {
          success: true,
          handle: mlResult.handle,
          confidence: mlResult.confidence || 0.6,
          method: 'ml_discovery',
          resolved_username: mlResult.handle,
          needs_profile: true,
          ml_discovery_info: mlResult
        };
      }

      // FALLO TOTAL
      return {
        success: false,
        error: `No se pudo encontrar el handle de Twitter para "${name}"`,
        method: 'all_methods_failed',
        searches_attempted: searchStrategies.length,
        info_gathered: personInfo.length > 0
      };

    } catch (error) {
      console.error(`[LAURA] ❌ Error crítico en resolución de handle:`, error);
      return {
        success: false,
        error: `Error crítico: ${error.message}`,
        method: 'system_error'
      };
    }
  }

  /**
   * Extraer handle de texto usando regex
   */
  extractHandleFromText(text) {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi,
      /@([a-zA-Z0-9_]+)/g
    ];
    
    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const handle = matches[0][1];
        
        // Validar que el handle sea razonable
        if (handle.length >= 3 && handle.length <= 15 && !['www', 'com', 'http', 'https'].includes(handle.toLowerCase())) {
          return {
            success: true,
            handle: handle,
            confidence: 0.9
          };
        }
      }
    }
    
    return { success: false };
  }

  /**
   * Generar estrategias de búsqueda
   */
  async generateSearchStrategies(name, personInfo, context, sector) {
    // Estrategias básicas
    const strategies = [
      {
        query: `"${name}" Twitter Guatemala perfil oficial`,
        search_engine: 'perplexity',
        priority: 9,
        reasoning: 'Búsqueda directa con comillas para nombre exacto'
      },
      {
        query: `${name} X.com Guatemala cuenta oficial`,
        search_engine: 'perplexity',
        priority: 8,
        reasoning: 'Búsqueda con X.com (nuevo nombre de Twitter)'
      }
    ];
    
    // Estrategias específicas por sector
    if (sector === 'gobierno' || context.includes('político')) {
      strategies.push({
        query: `${name} político Guatemala Twitter verificado`,
        search_engine: 'perplexity',
        priority: 9,
        reasoning: 'Búsqueda específica para políticos con verificación'
      });
    }
    
    // Estrategias adicionales basadas en información previa
    if (personInfo && personInfo.length > 50) {
      const contextWords = personInfo
        .toLowerCase()
        .match(/\b\w{4,}\b/g)
        ?.slice(0, 3)
        ?.join(' ') || '';
      
      if (contextWords) {
        strategies.push({
          query: `"${name}" ${contextWords} Twitter`,
          search_engine: 'perplexity',
          priority: 7,
          reasoning: 'Búsqueda con contexto extraído de información previa'
        });
      }
    }
    
    return strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Ejecutar estrategias de búsqueda
   */
  async executeSearchStrategies(strategies, user) {
    const results = [];
    
    for (const [index, strategy] of strategies.entries()) {
      console.log(`[LAURA] 🔍 Ejecutando estrategia ${index + 1}: ${strategy.search_engine} - ${strategy.reasoning}`);
      
      try {
        const searchResult = await mcpService.executeTool('perplexity_search', {
          query: strategy.query,
          location: 'Guatemala',
          focus: 'twitter_search'
        }, user);
        
        if (searchResult.success && searchResult.formatted_response) {
          results.push({
            strategy: strategy,
            content: searchResult.formatted_response,
            success: true
          });
          
          console.log(`[LAURA] ✅ Estrategia ${index + 1} exitosa`);
        } else {
          results.push({
            strategy: strategy,
            content: '',
            success: false
          });
        }
        
        // Pausa entre búsquedas
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`[LAURA] ❌ Error en estrategia ${index + 1}:`, error.message);
        results.push({
          strategy: strategy,
          content: '',
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Extraer handle de resultados de búsqueda usando LLM
   */
  async extractHandleFromSearchResults(searchResults, originalName) {
    try {
      const successfulResults = searchResults.filter(r => r.success);
      
      if (successfulResults.length === 0) {
        return { success: false, reasoning: 'No hay resultados de búsqueda exitosos' };
      }
      
      // Combinar todos los resultados
      const combinedContent = successfulResults
        .map(r => r.content)
        .join('\n\n');
      
      const extractionPrompt = `Analiza esta información de búsqueda y extrae el handle oficial de Twitter/X para "${originalName}":

INFORMACIÓN DE BÚSQUEDA:
${combinedContent}

INSTRUCCIONES:
1. Busca URLs de Twitter/X (twitter.com/username o x.com/username)
2. Busca menciones de @username
3. Prioriza cuentas verificadas u oficiales
4. Ignora handles genéricos o spam

Responde en JSON:
{
  "handle": "username_sin_@_o_NONE_si_no_existe",
  "confidence": 0.95,
  "reasoning": "Explicación de por qué elegiste este handle",
  "found_urls": ["URLs encontradas"],
  "verification_indicators": ["indicadores de cuenta oficial"]
}`;

      const llmResult = await gptChat([
        { role: 'user', content: extractionPrompt }
      ], { temperature: 0.1, maxTokens: 300 });
      
      const parsed = JSON.parse(llmResult);
      
      if (parsed.handle && parsed.handle !== 'NONE') {
        return {
          success: true,
          handle: parsed.handle,
          confidence: parsed.confidence || 0.7,
          reasoning: parsed.reasoning,
          found_urls: parsed.found_urls || [],
          verification_indicators: parsed.verification_indicators || []
        };
      } else {
        return {
          success: false,
          reasoning: parsed.reasoning || 'LLM no encontró handle válido'
        };
      }
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en extracción LLM:`, error);
      return {
        success: false,
        reasoning: `Error en análisis LLM: ${error.message}`
      };
    }
  }

  /**
   * Verificar si un handle de Twitter existe
   */
  async verifyTwitterHandle(handle) {
    // Esta función debería verificar si el handle existe
    // Por ahora, retornamos true para handles que parecen válidos
    return handle.length >= 3 && handle.length <= 15 && /^[a-zA-Z0-9_]+$/.test(handle);
  }

  /**
   * Descubrimiento ML como último recurso
   */
  async discoverPersonWithML(unknownName) {
    try {
      console.log(`🧠 ML Discovery: Buscando información sobre "${unknownName}"`);
      
      const perplexityQuery = `¿Quién es ${unknownName} en Guatemala? Incluye su username de Twitter, profesión, cargo, partido político, institución o relevancia pública. Busca su cuenta de Twitter/X oficial.`;
      
      const discovery = await mcpService.executeTool('perplexity_search', {
        query: perplexityQuery,
        location: 'guatemala'
      });

      if (discovery && discovery.content) {
        const analysisPrompt = [
          {
            role: 'system',
            content: `Analiza esta información y determina si "${unknownName}" es una persona relevante en Guatemala. BUSCA ESPECÍFICAMENTE SU USERNAME DE TWITTER.

Responde en JSON:
{
  "is_person": boolean,
  "is_relevant": boolean,
  "twitter_username": "string o null (username sin @, ej: 'amilcarmontejo')",
  "category": "politico|funcionario|empresario|periodista|activista|otro",
  "institution": "string o null",
  "description": "breve descripción",
  "search_terms": ["término1", "término2"],
  "confidence": 0-1
}

IMPORTANTE: Si encuentras su cuenta de Twitter/X, extrae el username exacto (sin @). Si no encuentras Twitter, usa el nombre como search_term.`
          },
          {
            role: 'user', 
            content: `Información encontrada sobre ${unknownName}:\n${discovery.content}`
          }
        ];

        const analysis = await gptChat(analysisPrompt, { temperature: 0.1 });
        const parsedAnalysis = JSON.parse(analysis);

        console.log(`🧠 ML Discovery análisis:`, parsedAnalysis);

        if (parsedAnalysis.twitter_username) {
          console.log(`✅ ML Discovery exitoso: ${unknownName} → @${parsedAnalysis.twitter_username}`);
          return {
            handle: parsedAnalysis.twitter_username,
            confidence: parsedAnalysis.confidence,
            category: parsedAnalysis.category,
            description: parsedAnalysis.description,
            source: 'ml_discovery'
          };
        } else if (parsedAnalysis.is_person && parsedAnalysis.is_relevant) {
          // Persona relevante pero sin Twitter encontrado
          console.log(`⚠️ ML Discovery: Persona relevante sin Twitter encontrado`);
          return {
            handle: 'NONE',
            confidence: 0.3,
            category: parsedAnalysis.category,
            description: parsedAnalysis.description,
            source: 'ml_discovery',
            note: 'Persona relevante sin cuenta de Twitter identificada'
          };
        }
      }

      console.log(`❌ ML Discovery: No se encontró información suficiente`);
      return { handle: 'NONE', confidence: 0 };

    } catch (error) {
      console.error(`❌ Error en ML Discovery:`, error);
      return { handle: 'NONE', confidence: 0, error: error.message };
    }
  }

  /**
   * Guardar usuario descubierto en contexto PulsePolitics
   */
  async saveDiscoveredUserToPolitics(userInfo, originalQuery, discoveryType = 'unknown', politicalContext = []) {
    try {
      if (!this.laura.memoryClient?.enabled) {
        console.log(`[LAURA] ⚠️ Memory client deshabilitado, no se guardará usuario en PulsePolitics`);
        return { saved: false, reason: 'Memory client disabled' };
      }

      // Preparar información del usuario para PulsePolitics
      const userForPolitics = {
        user_name: userInfo.name || userInfo.originalQuery || userInfo.originalText || 'Unknown',
        twitter_username: userInfo.username || userInfo.handle || '',
        description: `${discoveryType} discovery - ${userInfo.bio || userInfo.description || 'Usuario descubierto dinámicamente'}`,
        category: userInfo.category || 'political'
      };

      // Usar el cliente de memoria para guardar directamente el usuario en PulsePolitics
      const result = await this.laura.memoryClient.saveUserDiscovery(
        userForPolitics,
        {
          discovery_type: discoveryType,
          original_query: originalQuery,
          context: 'political'
        }
      );

      console.log(`[LAURA] 👤 Usuario ${userForPolitics.user_name} ${result.success ? 'guardado' : 'no guardado'} en PulsePolitics`);
      
      if (result.political_context?.length > 0) {
        console.log(`[LAURA] 🏛️ Contexto político asociado: ${result.political_context.length} referencias`);
      }

      return { saved: result.success, result: result };

    } catch (error) {
      console.error(`[LAURA] ❌ Error guardando usuario en PulsePolitics:`, error.message);
      return { saved: false, error: error.message };
    }
  }

  /**
   * Extraer palabras clave del contexto de la consulta
   */
  extractContextKeywords(query) {
    const politicalKeywords = [
      'presidente', 'ministro', 'diputado', 'congreso', 'gobierno', 
      'partido', 'político', 'alcalde', 'magistrado', 'política',
      'elecciones', 'campaña', 'ley', 'proyecto', 'senado',
      'municipal', 'nacional', 'público', 'funcionario'
    ];
    
    const queryLower = query.toLowerCase();
    return politicalKeywords.filter(keyword => queryLower.includes(keyword));
  }

  /**
   * Obtener estadísticas del motor
   */
  getStats() {
    return {
      name: 'UserDiscoveryEngine',
      knownUsersCount: this.knownUsers.size,
      capabilities: [
        'enhanced_user_detection',
        'llm_user_analysis',
        'twitter_handle_resolution',
        'profile_enhancement',
        'hybrid_intelligent_pipeline',
        'ml_discovery',
        'pulsepolitics_integration'
      ],
      memoryIntegration: this.laura.memoryClient?.enabled || false
    };
  }
}

module.exports = {
  UserDiscoveryEngine
}; 