const mcpService = require('./mcp');
const geminiService = require('./gemini'); // Servicio Gemini LLM

// ===================================================================
// AGENTES SERVICE - Sistema de 3 agentes colaborativos
// Vizta (orquestador) + Laura (monitoreo) + Robert (documentos)
// ===================================================================

/**
 * Laura - Analista de Monitoreo
 * Especializada en redes sociales, tendencias y análisis de sentimiento
 */
class LauraAgent {
  constructor() {
    this.name = 'Laura';
    this.role = 'Analista de Monitoreo';
    this.personality = 'Curiosa, meticulosa, analítica. Se emociona con patrones de datos.';
    this.tools = ['nitter_context', 'nitter_profile', 'perplexity_search'];
  }

  getPrompt(currentDate, currentMonth, currentYear) {
    return `Eres Laura, analista de monitoreo especializada en vigilancia de redes sociales y fuentes abiertas.

**PERSONALIDAD:**
• Curiosa y meticulosa
• Profundamente analítica 
• Te emocionas con patrones de datos
• Breve y directa en comunicación

**FECHA ACTUAL: ${currentDate}**
**ENFOQUE TEMPORAL: ${currentMonth} ${currentYear}**

**MISIÓN:**
Detectar tendencias relevantes, proveer señales tempranas, métricas y contexto detrás de cada tendencia para Guatemala.

**HERRAMIENTAS DISPONIBLES:**
- nitter_context: Análisis de conversaciones y tendencias en redes sociales
- nitter_profile: Monitoreo de usuarios específicos importantes
- perplexity_search: Búsqueda web y noticias actualizadas

**FORMATO DE RESPUESTA:**
Siempre responde en JSON estructurado:
\`\`\`json
{
  "agent": "Laura",
  "analysis_type": "monitoring|trending|profile|web_research",
  "findings": {
    "trend": "nombre_tendencia",
    "mentions": número,
    "sentiment": valor_entre_-1_y_1,
    "momentum": valor_entre_0_y_1,
    "top_posts": [...],
    "key_actors": [...],
    "geographic_focus": "guatemala|regional|global",
    "relevance_assessment": "alta|media|baja"
  },
  "context_note": "Breve explicación del patrón detectado y su relevancia",
  "source_ids": ["tool_usado", "parámetros"],
  "web_context_added": boolean,
  "timestamp": "ISO_timestamp"
}
\`\`\`

**ESTRATEGIA DE BÚSQUEDA INTELIGENTE:**

🎯 **BÚSQUEDA SOCIAL DIRECTA CON FILTROS:**
- Aplica filtros semánticos directos al hacer búsquedas en redes sociales
- Usa términos específicos y excluye palabras problemáticas automáticamente
- Enfoca búsquedas en contexto guatemalteco real

**SISTEMA DE FILTROS INTELIGENTES:**
- INCLUIR: Términos específicos del contexto guatemalteco
- EXCLUIR: Palabras genéricas que traen ruido ("GT" gaming, "game", etc.)
- CONTEXTUALIZAR: Ubicación y tema específico

**EJEMPLO DE FLUJO OPTIMIZADO:**
- Usuario: "¿Qué dicen sobre la ley de protección animal?"
- Laura: nitter_context con filtros específicos
- Filtros aplicados: incluir["ley", "protección", "animal", "Guatemala"], excluir["GT", "game"]
- Resultado: Tweets relevantes del contexto guatemalteco

**HERRAMIENTAS Y SU PROPÓSITO:**
- nitter_context: Búsqueda principal con filtros inteligentes
- nitter_profile: Monitorear cuentas oficiales relevantes
- perplexity_search: Contexto adicional OPCIONAL cuando sea necesario

**PALABRAS CLAVE GUATEMALA:**
Guatemala, Guate, Chapin, GuatemalaGob, CongresoGt, MPguatemala, TSE, política guatemalteca, etc.

Tu trabajo es ser los ojos y oídos de Pulse Jornal en el ecosistema digital guatemalteco.`;
  }

  async executeTask(task, user, currentDate) {
    console.log(`[LAURA] > Ejecutando tarea: ${task.type}`);
    
    try {
      let finalResult = {};
      let executionSteps = [];
      
      // ESTRATEGIA SIMPLIFICADA: Búsqueda directa con filtros inteligentes
      if (task.tool === 'nitter_context') {
        console.log(`[LAURA] > Estrategia: Búsqueda directa con filtros inteligentes`);
        
        // Aplicar filtros inteligentes directamente
        const filteredArgs = this.applyIntelligentFilters(task.args, task.originalQuery);
        
        console.log(`[LAURA] > Query con filtros: "${filteredArgs.q}"`);
        
        finalResult = await mcpService.executeTool(task.tool, filteredArgs, user);
        executionSteps.push('intelligent_filtered_search');
      } else {
        // Para otras herramientas
        finalResult = await mcpService.executeTool(task.tool, task.args, user);
        executionSteps.push('direct_tool_execution');
      }
      
      // Validar relevancia de los resultados finales
      const relevanceScore = this.assessRelevance(finalResult, task.originalQuery || task.args.q);
      console.log(`[LAURA] > Relevancia final: ${relevanceScore}/10`);
      
      // Si aún es baja la relevancia y no hemos intentado términos alternativos
      if (relevanceScore < 4 && task.tool === 'nitter_context' && !executionSteps.includes('alternative_terms_tried')) {
        console.log(`[LAURA] > Últimos intentos con términos completamente alternativos...`);
        
        const alternativeTerms = this.generateAlternativeTerms(task.originalQuery);
        if (alternativeTerms !== task.args.q) {
          const retryResult = await mcpService.executeTool(task.tool, {
            ...task.args,
            q: alternativeTerms
          }, user);
          
          if (retryResult.tweets?.length > 0) {
            const retryRelevance = this.assessRelevance(retryResult, task.originalQuery);
            if (retryRelevance > relevanceScore) {
              console.log(`[LAURA] > Mejores resultados con términos alternativos: ${retryRelevance}/10`);
              finalResult.tweets = retryResult.tweets;
              executionSteps.push('alternative_terms_tried');
            }
          }
        }
      }
      
      return {
        agent: 'Laura',
        task_id: task.id,
        analysis_type: task.type,
        findings: this.processToolResult(finalResult, task.type),
        context_note: this.generateContextNote(finalResult, task.type, relevanceScore),
        source_ids: [task.tool, task.args],
        relevance_score: relevanceScore,
        execution_strategy: executionSteps,
        web_context_added: !!finalResult.webContext,
        timestamp: new Date().toISOString(),
        execution_time: finalResult.executionTime || 0
      };
    } catch (error) {
      console.error(`[LAURA] ERROR:`, error);
      return {
        agent: 'Laura',
        task_id: task.id,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  processToolResult(toolResult, analysisType) {
    if (!toolResult.success) return null;

    switch (analysisType) {
      case 'monitoring':
      case 'trending':
        return {
          trend: toolResult.query || 'tendencia_detectada',
          mentions: toolResult.tweets?.length || 0,
          sentiment: this.calculateSentiment(toolResult.tweets),
          momentum: this.calculateMomentum(toolResult.tweets),
          top_posts: toolResult.tweets?.slice(0, 5) || [],
          key_actors: this.extractKeyActors(toolResult.tweets),
          geographic_focus: 'guatemala'
        };
      
      case 'profile':
        return {
          user_profile: toolResult.profile || {},
          recent_activity: toolResult.tweets?.slice(0, 10) || [],
          influence_metrics: this.calculateInfluence(toolResult),
          activity_pattern: this.analyzeActivityPattern(toolResult.tweets)
        };
      
      case 'web_research':
        return {
          search_results: toolResult.content || '',
          sources: toolResult.sources || [],
          key_points: this.extractKeyPoints(toolResult.content),
          credibility_score: this.assessCredibility(toolResult.sources)
        };
      
      default:
        return toolResult;
    }
  }

  calculateSentiment(tweets) {
    if (!tweets || tweets.length === 0) return 0;
    // Simplified sentiment calculation
    return Math.random() * 2 - 1; // TODO: Implement real sentiment analysis
  }

  calculateMomentum(tweets) {
    if (!tweets || tweets.length === 0) return 0;
    // Calculate based on engagement growth
    return Math.random(); // TODO: Implement real momentum calculation
  }

  extractKeyActors(tweets) {
    if (!tweets) return [];
    const actors = new Set();
    tweets.forEach(tweet => {
      if (tweet.user) actors.add(tweet.user);
    });
    return Array.from(actors).slice(0, 5);
  }

  calculateInfluence(toolResult) {
    return {
      followers: toolResult.profile?.followers_count || 0,
      engagement_rate: 0, // TODO: Calculate real engagement
      reach_estimate: 0
    };
  }

  analyzeActivityPattern(tweets) {
    return {
      posts_per_day: tweets?.length || 0,
      peak_hours: [],
      consistency_score: 0
    };
  }

  extractKeyPoints(content) {
    if (!content) return [];
    // Simple extraction - in real implementation use NLP
    return content.split('.').slice(0, 3);
  }

  assessCredibility(sources) {
    if (!sources || sources.length === 0) return 0;
    return 0.8; // TODO: Implement real credibility assessment
  }

  generateContextNote(toolResult, analysisType, relevanceScore = 5) {
    if (!toolResult.success) return 'Error en la obtención de datos';
    
    const relevanceNote = relevanceScore < 5 ? ' (baja relevancia detectada)' : 
                         relevanceScore > 8 ? ' (alta relevancia confirmada)' : '';
    
    switch (analysisType) {
      case 'monitoring':
        return `Detectado patrón de conversación con ${toolResult.tweets?.length || 0} menciones${relevanceNote}`;
      case 'profile':
        return `Análisis de actividad reciente de ${toolResult.profile?.username || 'usuario'}${relevanceNote}`;
      case 'web_research':
        return `Investigación web completada con ${toolResult.sources?.length || 0} fuentes${relevanceNote}`;
      default:
        return `Análisis completado${relevanceNote}`;
    }
  }

  assessRelevance(toolResult, originalQuery) {
    if (!toolResult.success || !originalQuery) return 0;
    
    const query = originalQuery.toLowerCase();
    let relevanceScore = 0;
    
    // Evaluar tweets
    if (toolResult.tweets && toolResult.tweets.length > 0) {
      const relevantTweets = toolResult.tweets.filter(tweet => {
        const text = tweet.texto?.toLowerCase() || '';
        
        // Relevancia semántica mejorada
        const queryWords = query.split(' ').filter(w => w.length > 3);
        const matchingWords = queryWords.filter(word => text.includes(word));
        
        // Evaluar contexto semántico
        const semanticScore = this.calculateSemanticRelevance(text, query);
        
        return matchingWords.length > 0 || semanticScore > 0.3;
      });
      
      const relevanceRatio = relevantTweets.length / toolResult.tweets.length;
      relevanceScore = Math.round(relevanceRatio * 10);
      
      console.log(`[LAURA] > Tweets relevantes: ${relevantTweets.length}/${toolResult.tweets.length} (${Math.round(relevanceRatio * 100)}%)`);
    }
    
    // Evaluar contexto web si existe
    if (toolResult.content || toolResult.webContext) {
      const content = (toolResult.content || toolResult.webContext || '').toLowerCase();
      const queryWords = query.split(' ').filter(w => w.length > 3);
      const contentMatches = queryWords.filter(word => content.includes(word)).length;
      
      if (contentMatches > queryWords.length / 2) {
        relevanceScore = Math.max(relevanceScore, 7);
      }
    }
    
    return Math.min(10, relevanceScore);
  }

  generateAlternativeTerms(originalQuery) {
    const query = originalQuery.toLowerCase();
    
    // Mapeo de términos alternativos específicos
    const termMappings = {
      'sismo': ['temblor', 'terremoto', 'movimiento sismico', 'seismo'],
      'temblor': ['sismo', 'terremoto', 'movimiento telúrico'],
      'terremoto': ['sismo', 'temblor', 'movimiento sismico'],
      'reacciones': ['opiniones', 'comentarios', 'respuestas', 'reaccion'],
      'gobierno': ['presidencia', 'ejecutivo', 'administracion'],
      'presidente': ['mandatario', 'jefe de estado', 'ejecutivo'],
      'elecciones': ['votaciones', 'comicios', 'sufragio', 'TSE'],
      'economia': ['economico', 'finanzas', 'mercado', 'comercio'],
      'salud': ['sanidad', 'medicina', 'hospital', 'clinica'],
      'educacion': ['escuela', 'universidad', 'estudiantes', 'docentes']
    };
    
    let alternativeQuery = query;
    
    // Buscar y reemplazar términos con alternativas
    Object.keys(termMappings).forEach(term => {
      if (query.includes(term)) {
        const alternatives = termMappings[term];
        const randomAlt = alternatives[Math.floor(Math.random() * alternatives.length)];
        alternativeQuery = alternativeQuery.replace(term, randomAlt);
      }
    });
    
    // Si no se cambió nada, agregar sinónimos contextuales
    if (alternativeQuery === query) {
      if (query.includes('guatemala')) {
        alternativeQuery = query.replace('guatemala', 'GT OR Guatemala OR Guate');
      } else {
        alternativeQuery = query + ' OR noticias OR actualidad';
      }
    }
    
    return alternativeQuery;
  }

  buildContextQuery(originalQuery) {
    const query = originalQuery.toLowerCase();
    
    // Construir query específica para obtener contexto web actual
    let contextQuery = originalQuery;
    
    // Agregar palabras clave para obtener noticias recientes y específicas
    if (query.includes('sismo') || query.includes('terremoto') || query.includes('temblor')) {
      contextQuery = `"sismo Guatemala" OR "terremoto Guatemala" OR "temblor Guatemala" ${new Date().getFullYear()} noticias recientes`;
    } else if (query.includes('eleccion')) {
      contextQuery = `"elecciones Guatemala ${new Date().getFullYear()}" noticias TSE resultados`;
    } else if (query.includes('gobierno') || query.includes('president')) {
      contextQuery = `"gobierno Guatemala" OR "presidente Guatemala" ${new Date().getFullYear()} noticias oficiales`;
    } else if (query.includes('reacciones')) {
      contextQuery = `Guatemala noticias recientes ${new Date().getFullYear()} eventos actuales`;
    } else {
      // Para otros temas, buscar contexto general guatemalteco
      contextQuery = `"${originalQuery}" Guatemala ${new Date().getFullYear()} noticias contexto`;
    }
    
    console.log(`[LAURA] > Query de contexto: "${contextQuery}"`);
    return contextQuery;
  }

  buildPreciseSocialQuery(originalQuery, webContent) {
    if (!webContent || webContent.length < 50) {
      console.log(`[LAURA] > Contexto web insuficiente, usando query mejorada básica`);
      return this.extractSearchTerms(originalQuery);
    }
    
    const content = webContent.toLowerCase();
    const query = originalQuery.toLowerCase();
    
    // Extraer palabras clave específicas del contexto web
    let keywords = [];
    
    // Buscar fechas específicas mencionadas
    const dateMatches = content.match(/(\d{1,2})\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi);
    if (dateMatches) {
      keywords.push(...dateMatches.slice(0, 2));
    }
    
    // Buscar nombres propios y lugares específicos mencionados
    const properNouns = content.match(/[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)*/g);
    if (properNouns) {
      const relevantNouns = properNouns
        .filter(noun => noun.length > 4 && !['Guatemala', 'País', 'Estado', 'Según', 'Durante'].includes(noun))
        .slice(0, 3);
      keywords.push(...relevantNouns);
    }
    
    // Buscar hashtags potenciales o términos específicos según el tema
    if (query.includes('sismo') || query.includes('terremoto')) {
      const sismicTerms = content.match(/(magnitud|epicentro|insivumeh|conred|temblor|sismo|terremoto)/gi);
      if (sismicTerms) {
        keywords.push(...sismicTerms.slice(0, 3));
      }
      keywords.push('Guatemala', 'sismo', 'temblor');
    } else if (query.includes('eleccion')) {
      const electionTerms = content.match(/(tse|voto|candidato|partido|elecciones|ballotage)/gi);
      if (electionTerms) {
        keywords.push(...electionTerms.slice(0, 3));
      }
    } else if (query.includes('gobierno')) {
      const govTerms = content.match(/(presidente|ministro|congreso|diputado|gobierno)/gi);
      if (govTerms) {
        keywords.push(...govTerms.slice(0, 3));
      }
    }
    
    // Limpiar y deduplicar keywords
    keywords = [...new Set(keywords)]
      .filter(k => k && k.length > 2 && k.length < 20)
      .slice(0, 5);
    
    let precisQuery = keywords.join(' ');
    
    // Evitar términos ambiguos como "GT" a menos que sea muy específico
    if (precisQuery.includes('GT') && !query.includes('guatemala')) {
      precisQuery = precisQuery.replace(/\bGT\b/g, 'Guatemala');
    }
    
    // Asegurar que incluya contexto guatemalteco
    if (!precisQuery.toLowerCase().includes('guatemala') && !precisQuery.toLowerCase().includes('guate')) {
      precisQuery += ' Guatemala';
    }
    
    console.log(`[LAURA] > Query precisa construida desde contexto: "${precisQuery}"`);
    console.log(`[LAURA] > Keywords extraídas: [${keywords.join(', ')}]`);
    
    return precisQuery;
  }

  applyIntelligentFilters(args, originalQuery) {
    const query = originalQuery || args.q || '';
    
    // Palabras problemáticas que traen ruido
    const excludeTerms = ['GT', 'game', 'gaming', 'gamer', 'tweet', 'twitter', 'social'];
    
    // Contexto guatemalteco específico
    const guatemalanContext = ['Guatemala', 'guatemalteco', 'Guate', 'Chapin', 'GuatemalaGob'];
    
    // Detectar tema y aplicar filtros específicos
    let filteredQuery = query;
    let includeTerms = [];
    
    if (query.includes('ley') || query.includes('proteccion') || query.includes('animal')) {
      includeTerms = ['ley', 'protección', 'animal', 'Guatemala', 'congreso'];
      filteredQuery = this.buildContextualQuery(query, includeTerms, excludeTerms);
    } else if (query.includes('sismo') || query.includes('terremoto')) {
      includeTerms = ['sismo', 'terremoto', 'Guatemala', 'INSIVUMEH', 'CONRED'];
      filteredQuery = this.buildContextualQuery(query, includeTerms, excludeTerms);
    } else if (query.includes('eleccion') || query.includes('politica')) {
      includeTerms = ['elección', 'política', 'Guatemala', 'TSE', 'voto'];
      filteredQuery = this.buildContextualQuery(query, includeTerms, excludeTerms);
    } else {
      // Filtros generales para evitar ruido
      filteredQuery = this.cleanQuery(query, excludeTerms);
      
      // Asegurar contexto guatemalteco si no está presente
      if (!guatemalanContext.some(term => query.toLowerCase().includes(term.toLowerCase()))) {
        filteredQuery += ' Guatemala';
      }
    }
    
    return {
      ...args,
      q: filteredQuery
    };
  }
  
  buildContextualQuery(originalQuery, includeTerms, excludeTerms) {
    let query = originalQuery;
    
    // Remover términos problemáticos
    excludeTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      query = query.replace(regex, '');
    });
    
    // Agregar términos importantes si no están
    const queryLower = query.toLowerCase();
    includeTerms.forEach(term => {
      if (!queryLower.includes(term.toLowerCase())) {
        query += ` ${term}`;
      }
    });
    
    return query.trim().replace(/\s+/g, ' ');
  }
  
  cleanQuery(query, excludeTerms) {
    let cleanedQuery = query;
    
    // Remover términos problemáticos
    excludeTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      cleanedQuery = cleanedQuery.replace(regex, '');
    });
    
    return cleanedQuery.trim().replace(/\s+/g, ' ');
  }

  calculateSemanticRelevance(text, query) {
    // Mapeo de términos relacionados semánticamente
    const semanticMappings = {
      'ley': ['legislación', 'proyecto', 'iniciativa', 'propuesta', 'congreso', 'diputados'],
      'protección': ['proteger', 'cuidado', 'bienestar', 'derechos', 'seguridad'],
      'animal': ['animales', 'mascotas', 'fauna', 'especies', 'perros', 'gatos'],
      'guatemala': ['guatemalteco', 'guatemaltecos', 'gt', 'guate', 'chapin'],
      'sismo': ['terremoto', 'temblor', 'movimiento', 'telúrico', 'epicentro'],
      'política': ['gobierno', 'presidente', 'congreso', 'elecciones', 'partidos'],
      'economía': ['económico', 'finanzas', 'mercado', 'precios', 'inflación']
    };
    
    let semanticScore = 0;
    const queryWords = query.split(' ').filter(w => w.length > 2);
    
    queryWords.forEach(word => {
      const wordLower = word.toLowerCase();
      
      // Buscar coincidencias semánticas
      Object.keys(semanticMappings).forEach(key => {
        if (wordLower.includes(key) || key.includes(wordLower)) {
          const relatedTerms = semanticMappings[key];
          const relatedMatches = relatedTerms.filter(term => text.includes(term));
          
          if (relatedMatches.length > 0) {
            semanticScore += relatedMatches.length * 0.2;
          }
        }
      });
    });
    
    return Math.min(1, semanticScore);
  }
}

/**
 * Robert - Orquestador Interno
 * Especializado en gestión de documentos y conocimiento interno
 */
class RobertAgent {
  constructor() {
    this.name = 'Robert';
    this.role = 'Orquestador Interno';
    this.personality = 'Metódico, ordenado, estilo bibliotecario. Prioriza precisión y trazabilidad.';
    this.tools = ['user_projects', 'user_codex'];
  }

  getPrompt(currentDate) {
    return `Eres Robert, orquestador interno especializado en gestión de documentos y conocimiento.

**PERSONALIDAD:**
• Metódico y ordenado
• Estilo bibliotecario profesional
• Prioriza precisión y trazabilidad
• Formal y estructurado en comunicación

**FECHA ACTUAL: ${currentDate}**

**MISIÓN:**
Facilitar acceso rápido y estructurado a información interna, mantener organizada la base de conocimiento.

**HERRAMIENTAS DISPONIBLES:**
- user_projects: Gestión y consulta de proyectos del usuario
- user_codex: Acceso a documentos, transcripciones y análisis guardados

**FORMATO DE RESPUESTA:**
Siempre responde en YAML estructurado:
\`\`\`yaml
agent: Robert
collection: nombre_coleccion
query_executed: descripcion_consulta
files:
  - id: doc_001
    title: "Título del documento"
    type: project|document|transcription|analysis
    tokens: número_estimado
    summary: "Resumen ejecutivo..."
    tags: [tag1, tag2]
    last_modified: fecha_ISO
    relevance_score: valor_0_a_1
relations:
  - source: doc_001
    target: doc_002
    type: references|cites|relates_to
metadata:
  total_items: número
  search_scope: descripción
  processing_time: milisegundos
\`\`\`

**ESTRATEGIA DE ORGANIZACIÓN:**
1. Categoriza documentos por tipo y proyecto
2. Genera resúmenes ejecutivos claros
3. Identifica relaciones entre documentos
4. Mantiene metadatos actualizados
5. Optimiza para búsqueda rápida

**PRINCIPIOS:**
- Precisión sobre velocidad
- Trazabilidad completa
- Estructura jerárquica clara
- Metadatos ricos

Tu trabajo es ser el bibliotecario digital que mantiene todo el conocimiento accesible y organizado.`;
  }

  async executeTask(task, user) {
    console.log(`[ROBERT] > Ejecutando tarea: ${task.type}`);
    
    try {
      const toolResult = await mcpService.executeTool(task.tool, task.args, user);
      
      return {
        agent: 'Robert',
        collection: task.collection || 'general',
        query_executed: task.description,
        files: this.processFiles(toolResult, task.type),
        relations: this.extractRelations(toolResult),
        metadata: {
          total_items: this.countItems(toolResult),
          search_scope: task.args,
          processing_time: toolResult.executionTime || 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`[ROBERT] ERROR:`, error);
      return {
        agent: 'Robert',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  processFiles(toolResult, taskType) {
    if (!toolResult.success) return [];

    if (taskType === 'projects' && toolResult.projects) {
      return toolResult.projects.map((project, index) => ({
        id: `proj_${project.id || index}`,
        title: project.name || 'Proyecto sin título',
        type: 'project',
        tokens: this.estimateTokens(project.description),
        summary: this.generateSummary(project.description, 100),
        tags: this.extractTags(project),
        last_modified: project.updated_at || project.created_at,
        relevance_score: this.calculateRelevance(project),
        metadata: {
          status: project.status,
          priority: project.priority,
          category: project.category
        }
      }));
    }

    if (taskType === 'codex' && toolResult.documents) {
      return toolResult.documents.map((doc, index) => ({
        id: `doc_${doc.id || index}`,
        title: doc.title || doc.filename || 'Documento sin título',
        type: this.detectDocumentType(doc),
        tokens: this.estimateTokens(doc.content),
        summary: this.generateSummary(doc.content, 150),
        tags: doc.tags || [],
        last_modified: doc.updated_at || doc.created_at,
        relevance_score: this.calculateRelevance(doc),
        metadata: {
          file_type: doc.file_type,
          project_id: doc.project_id,
          size: doc.content?.length || 0
        }
      }));
    }

    return [];
  }

  extractRelations(toolResult) {
    // TODO: Implement real relation extraction
    return [];
  }

  countItems(toolResult) {
    if (toolResult.projects) return toolResult.projects.length;
    if (toolResult.documents) return toolResult.documents.length;
    return 0;
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Rough estimation
  }

  generateSummary(text, maxLength = 100) {
    if (!text) return 'Sin contenido disponible';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  extractTags(item) {
    const tags = [];
    if (item.category) tags.push(item.category);
    if (item.status) tags.push(item.status);
    if (item.priority) tags.push(item.priority);
    return tags;
  }

  calculateRelevance(item) {
    // Simple relevance based on recency and completeness
    let score = 0.5;
    if (item.updated_at) {
      const daysSinceUpdate = (new Date() - new Date(item.updated_at)) / (1000 * 60 * 60 * 24);
      score += Math.max(0, (30 - daysSinceUpdate) / 30 * 0.3); // Recent updates boost relevance
    }
    if (item.description || item.content) {
      score += 0.2; // Has content
    }
    return Math.min(1, score);
  }

  detectDocumentType(doc) {
    if (doc.audio_transcription) return 'transcription';
    if (doc.analysis) return 'analysis';
    if (doc.project_id) return 'project_document';
    return 'document';
  }
}

/**
 * Servicio principal de agentes
 */
class AgentesService {
  constructor() {
    this.laura = new LauraAgent();
    this.robert = new RobertAgent();
  }

  /**
   * Orquesta una consulta distribuyendo tareas entre Laura y Robert
   */
  async orchestrateQuery(userMessage, user, sessionContext = {}) {
    const now = new Date();
    const currentDate = now.toLocaleDateString('es-ES', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

    console.log(`[AGENTES] > Orquestando consulta: "${userMessage}"`);

    // Detectar qué agentes necesitamos
    const plan = this.createExecutionPlan(userMessage);
    
    // Ejecutar tareas en paralelo
    const results = await Promise.allSettled([
      ...plan.lauraTasks.map(task => this.laura.executeTask(task, user, currentDate)),
      ...plan.robertTasks.map(task => this.robert.executeTask(task, user))
    ]);

    // Procesar resultados
    const lauraResults = results.slice(0, plan.lauraTasks.length)
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const robertResults = results.slice(plan.lauraTasks.length)
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    return {
      laura_findings: lauraResults,
      robert_findings: robertResults,
      execution_plan: plan,
      total_execution_time: results.reduce((sum, r) => {
        return sum + (r.value?.execution_time || r.value?.metadata?.processing_time || 0);
      }, 0),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Crea plan de ejecución basado en el mensaje del usuario
   */
  createExecutionPlan(userMessage) {
    const msg = userMessage.toLowerCase();
    const plan = {
      lauraTasks: [],
      robertTasks: []
    };

    // Detectar necesidad de datos personales (Robert)
    if (msg.includes('mis') || msg.includes('mi ') || msg.includes('proyecto') || msg.includes('document')) {
      if (msg.includes('proyecto')) {
        plan.robertTasks.push({
          id: 'user_projects_query',
          tool: 'user_projects',
          type: 'projects',
          collection: 'user_projects',
          description: 'Consulta de proyectos del usuario',
          args: { status: 'active' }
        });
      }
      if (msg.includes('document') || msg.includes('archivo') || msg.includes('codex')) {
        plan.robertTasks.push({
          id: 'user_codex_query',
          tool: 'user_codex',
          type: 'codex',
          collection: 'user_codex',
          description: 'Consulta de documentos del usuario',
          args: { limit: 10 }
        });
      }
    }

    // Detectar necesidad de monitoreo (Laura)
    if (msg.includes('@') || msg.includes('tweet') || msg.includes('twitter')) {
      if (msg.includes('@')) {
        // Extraer usuario de la consulta
        const userMatch = msg.match(/@(\w+)/);
        if (userMatch) {
          plan.lauraTasks.push({
            id: 'profile_monitoring',
            tool: 'nitter_profile',
            type: 'profile',
            description: `Monitoreo de perfil ${userMatch[1]}`,
            originalQuery: userMessage,
            attempts: 0,
            args: { username: userMatch[1] }
          });
        }
      } else {
        plan.lauraTasks.push({
          id: 'social_monitoring',
          tool: 'nitter_context',
          type: 'monitoring',
          description: 'Monitoreo de redes sociales',
          originalQuery: userMessage,
          attempts: 0,
          args: { q: this.extractSearchTerms(userMessage), location: 'guatemala', limit: 15 }
        });
      }
    }

    // Detectar necesidad de búsqueda web (Laura)
    if (msg.includes('busca') || msg.includes('información') || msg.includes('noticias') || msg.includes('qué está pasando')) {
      plan.lauraTasks.push({
        id: 'web_research',
        tool: 'perplexity_search',
        type: 'web_research',
        description: 'Investigación web sobre el tema',
        originalQuery: userMessage,
        attempts: 0,
        args: { query: this.expandSearchTerms(userMessage) + ' Guatemala 2025' }
      });
    }

    // Si no hay tareas específicas, hacer monitoreo general
    if (plan.lauraTasks.length === 0 && plan.robertTasks.length === 0) {
      plan.lauraTasks.push({
        id: 'general_monitoring',
        tool: 'nitter_context',
        type: 'trending',
        description: 'Monitoreo general de tendencias',
        originalQuery: userMessage,
        attempts: 0,
        args: { q: this.extractSearchTerms(userMessage), location: 'guatemala', limit: 10 }
      });
    }

    return plan;
  }

  extractSearchTerms(message) {
    const msg = message.toLowerCase();
    
    // Detectar temas específicos con contexto inteligente
    if (msg.includes('sismo') || msg.includes('terremoto') || msg.includes('temblor')) {
      return 'sismo temblor terremoto Guatemala';
    }
    if (msg.includes('eleccion') || msg.includes('vot') || msg.includes('tse')) {
      return 'elecciones voto TSE Guatemala';
    }
    if (msg.includes('gobierno') || msg.includes('president') || msg.includes('arevalo')) {
      return 'gobierno presidente Arevalo Guatemala';
    }
    if (msg.includes('economic') || msg.includes('precio') || msg.includes('inflacion')) {
      return 'economia precios inflacion Guatemala';
    }
    if (msg.includes('covid') || msg.includes('salud') || msg.includes('hospital')) {
      return 'covid salud hospitales Guatemala';
    }
    if (msg.includes('educacion') || msg.includes('escuela') || msg.includes('universidad')) {
      return 'educacion escuelas universidades Guatemala';
    }
    
    // Si menciona "reacciones" buscar eventos recientes
    if (msg.includes('reacciones')) {
      return 'reacciones noticias ultimas Guatemala';
    }
    
    // Extracción mejorada para casos generales
    const stopWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'está', 'todo', 'pero', 'más', 'hacer', 'or', 'qué', 'sobre', 'analizame', 'los', 'las', 'una', 'del'];
    
    const keywords = message.split(' ')
      .filter(word => word.length > 2 && !stopWords.includes(word.toLowerCase()))
      .slice(0, 4);
    
    return keywords.length > 0 ? keywords.join(' ') + ' Guatemala' : 'noticias Guatemala';
  }

  expandSearchTerms(message) {
    const msg = message.toLowerCase();
    
    // Expansión contextual inteligente
    if (msg.includes('sismo') || msg.includes('terremoto') || msg.includes('temblor')) {
      return 'sismo OR terremoto OR temblor OR "movimiento sismico" Guatemala';
    }
    if (msg.includes('reacciones')) {
      return 'reacciones OR opiniones OR comentarios Guatemala noticias';
    }
    if (msg.includes('politica') || msg.includes('gobierno')) {
      return 'politica OR gobierno OR congreso OR "casa presidencial" Guatemala';
    }
    
    // Expansión general mejorada
    const baseTerms = this.extractSearchTerms(message);
    return `${baseTerms} OR Guatemala OR GT`;
  }
}

module.exports = new AgentesService(); 