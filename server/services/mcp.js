const axios = require('axios');
const { processNitterContext } = require('./nitterContext');
const { processNitterProfile } = require('./nitterProfile'); // ✅ AGREGADO: Importar función completa con sentimiento
const { 
  getUserProjects, 
  getUserCodex, 
  getProjectDecisions,
  searchUserCodex, 
  getUserStats,
  saveNitterProfileTweets 
} = require('./supabaseData');

// Importar fetch para Node.js
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  // Fallback para Node.js 18+ que tiene fetch nativo
  fetch = global.fetch;
}

// ===================================================================
// MCP SERVICE - Micro Command Processor
// Orquestador central de herramientas para agentes IA
// ===================================================================

// Configuración de servicios externos
function getExtractorTUrl() {
  // Verificar variables de entorno específicas primero
  if (process.env.EXTRACTOR_T_URL) {
    return process.env.EXTRACTOR_T_URL;
  }
  
  // Detectar entorno automáticamente
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // PRODUCCIÓN: Usar URL externa
    return process.env.EXTRACTORT_URL || 'https://api.standatpd.com';
  } else {
    // DESARROLLO: Usar contenedor local con IP del host
    return process.env.EXTRACTORT_LOCAL_URL || 'http://127.0.0.1:8000';
  }
}

const EXTRACTOR_T_URL = getExtractorTUrl();

// Log de configuración
console.log(`🔗 ExtractorT URL configurada (MCP): ${EXTRACTOR_T_URL}`);

/**
 * Mejora la expansión de términos usando Perplexity para contexto adicional
 * @param {string} originalQuery - Query original del usuario
 * @param {boolean} usePerplexity - Si usar Perplexity para mejorar la expansión
 * @returns {Promise<string>} - Query expandido con contexto de Perplexity
 */
async function enhanceSearchTermsWithPerplexity(originalQuery, usePerplexity = false) {
  try {
    if (!usePerplexity) {
      return expandSearchTerms(originalQuery);
    }

    console.log(`🔍 Mejorando expansión de términos con Perplexity: "${originalQuery}"`);
    
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      console.log('⚠️ PERPLEXITY_API_KEY no disponible, usando expansión básica');
      return expandSearchTerms(originalQuery);
    }

    // Obtener fecha actual
    const now = new Date();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

         const enhancementPrompt = `Analiza la consulta "${originalQuery}" y sugiere términos de búsqueda optimizados para Twitter/X en Guatemala.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}, Guatemala**
**OBJETIVO: Optimizar búsqueda para obtener tweets RECIENTES y relevantes**

⚠️ FILTRO TEMPORAL CRÍTICO:
- SOLO incluye hashtags y términos que estén siendo usados en ${currentMonth} ${currentYear}
- Agrega modificadores temporales como "2025", "${currentMonth}", "actual", "ahora"
- Incluye hashtags que probablemente estén trending HOY

INSTRUCCIONES:
1. Si es sobre una persona, incluye variaciones de su nombre, apodos, cargos Y su estado ACTUAL en ${currentYear}
2. Si es sobre eventos, incluye hashtags probables CON fechas de ${currentMonth} ${currentYear}
3. Si es sobre temas políticos, incluye instituciones y términos oficiales CON contexto de ${currentYear}
4. Si es sobre deportes, incluye equipos, competencias y hashtags deportivos de la temporada ${currentYear}
5. Incluye términos en español que usan los guatemaltecos ACTUALMENTE
6. Considera abreviaciones comunes (GT, Guate, Chapin) con contexto temporal
7. Incluye hashtags que probablemente estén trending en ${currentMonth} ${currentYear}
8. AGREGA SIEMPRE modificadores temporales: "2025", "${currentMonth}", "actual", "reciente"

EJEMPLOS ACTUALIZADOS:
- "marcha del orgullo" → "Orgullo2025 OR MarchadelOrgullo OR Pride OR LGBTI OR diversidad OR #OrguIIoGt OR Orgullo${currentMonth} OR Pride2025 OR OrgulloActual"
- "presidente guatemala" → "BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR PresidenciaGt OR Arevalo2025 OR GobiernoActual OR Presidente${currentMonth}"

Responde SOLO con los términos de búsqueda optimizados separados por "OR", sin explicaciones.`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `Eres un experto en optimización de búsquedas en redes sociales para Guatemala. 

Tu trabajo es convertir consultas generales en términos de búsqueda específicos que capturen las conversaciones reales de los guatemaltecos en Twitter/X.

Características:
- Conoces los apodos y nombres comunes usados en Guatemala
- Identificas hashtags que probablemente estén trending
- Incluyes variaciones de nombres oficiales vs populares
- Consideras el contexto temporal actual
- Usas operadores OR para máxima cobertura

FECHA ACTUAL: ${currentMonth} ${currentYear}
CONTEXTO: Guatemala`
        },
        {
          role: 'user',
          content: enhancementPrompt
        }
      ],
      temperature: 0.2,
      max_tokens: 200
    };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const enhancedTerms = data.choices[0].message.content.trim();
        console.log(`🚀 Términos mejorados con Perplexity: "${enhancedTerms}"`);
        return enhancedTerms;
      }
    }

    console.log('⚠️ Error con Perplexity, usando expansión básica');
    return expandSearchTerms(originalQuery);

  } catch (error) {
    console.error('❌ Error mejorando términos con Perplexity:', error);
    return expandSearchTerms(originalQuery);
  }
}

/**
 * Expansión inteligente de términos de búsqueda para Twitter
 * Convierte consultas generales en búsquedas estratégicas específicas
 */
function expandSearchTerms(originalQuery) {
  const query = originalQuery.toLowerCase().trim();
  
  // Diccionario de TÉRMINOS REALES que la gente usa en redes sociales guatemaltecas
  const expansions = {
    // Eventos y marchas - TÉRMINOS REALES
    'marcha del orgullo': 'orgullo OR "marcha del orgullo" OR pride OR lgbt OR diversidad OR #orgullogt OR marcha',
    'orgullo': 'orgullo OR "marcha del orgullo" OR pride OR lgbt OR diversidad OR #orgullogt',
    'pride': 'pride OR orgullo OR lgbt OR "marcha del orgullo" OR diversidad',
    
    // Política - TÉRMINOS REALES
    'elecciones': 'elecciones OR tse OR voto OR candidatos OR electoral OR votacion',
    'presidente': 'presidente OR "bernardo arevalo" OR gobierno OR presidencia',
    'gobierno': 'gobierno OR presidente OR "bernardo arevalo" OR presidencia OR ejecutivo',
    'congreso': 'congreso OR diputados OR legislativo OR plenaria OR bancada',
    
    // Economía - TÉRMINOS REALES
    'economia': 'economia OR inflacion OR empleo OR precios OR quetzal OR guatemala',
    'inflacion': 'inflacion OR precios OR carestia OR caro OR economia',
    'empleo': 'empleo OR trabajo OR desempleo OR oportunidades',
    
    // Deportes - TÉRMINOS REALES
    'futbol': 'futbol OR seleccion OR guatemala OR liga OR deporte',
    'seleccion': 'seleccion OR futbol OR guatemala OR bicolor OR deportes',
    
    // Seguridad - TÉRMINOS REALES
    'seguridad': 'seguridad OR violencia OR delincuencia OR pnc OR crimenes',
    'violencia': 'violencia OR delincuencia OR inseguridad OR crimenes OR seguridad',
    
    // Educación - TÉRMINOS REALES
    'educacion': 'educacion OR estudiantes OR maestros OR escuelas OR universidad',
    'universidad': 'universidad OR usac OR estudiantes OR educacion',
    
    // Salud - TÉRMINOS REALES
    'salud': 'salud OR hospitales OR medicos OR medicina OR enfermedad',
    'covid': 'covid OR coronavirus OR pandemia OR vacuna OR salud',
    
    // Cultura - TÉRMINOS REALES
    'cultura': 'cultura OR tradiciones OR guatemala OR arte OR festival',
    'musica': 'musica OR artista OR concierto OR cantante OR guatemala',
    
    // Minería - TÉRMINOS REALES
    'mineria': 'mineria OR mina OR minera OR extraccion OR "san rafael" OR resistencia',
    'mina': 'mina OR mineria OR minera OR extraccion OR resistencia',
    
    // Protestas - TÉRMINOS REALES  
    'protesta': 'protesta OR manifestacion OR marcha OR resistencia OR derecho',
    'manifestacion': 'manifestacion OR protesta OR marcha OR derecho OR resistencia',
    
    // Lugares específicos - TÉRMINOS REALES
    'izabal': 'izabal OR "puerto barrios" OR caribe OR guatemala',
    'antigua': 'antigua OR guatemala OR turismo OR colonial',
    'xela': 'xela OR quetzaltenango OR guatemala OR altiplano'
  };

  // Buscar coincidencias exactas primero
  for (const [key, expansion] of Object.entries(expansions)) {
    if (query.includes(key)) {
      console.log(`🎯 Expansión REAL encontrada: "${key}" → "${expansion}"`);
      return expansion;
    }
  }

  // Búsquedas por palabras clave con TÉRMINOS REALES
  const keywords = [
    // Política REAL
    { keys: ['bernardo', 'arevalo'], expansion: '"bernardo arevalo" OR presidente OR gobierno OR arevalo' },
    { keys: ['giammattei'], expansion: 'giammattei OR "alejandro giammattei" OR expresidente' },
    { keys: ['tse'], expansion: 'tse OR tribunal OR electoral OR elecciones OR voto' },
    { keys: ['mp', 'ministerio publico'], expansion: 'mp OR "ministerio publico" OR fiscalia OR justicia' },
    
    // Eventos REALES
    { keys: ['cervantino'], expansion: 'cervantino OR festival OR cultura OR antigua' },
    { keys: ['independencia'], expansion: 'independencia OR guatemala OR septiembre OR patria' },
    { keys: ['navidad'], expansion: 'navidad OR posadas OR diciembre OR fiestas' },
    
    // Ubicaciones REALES
    { keys: ['zona viva'], expansion: '"zona viva" OR zona10 OR guatemala OR restaurantes' },
    { keys: ['lago atitlan'], expansion: 'atitlan OR lago OR solola OR turismo' },
    
    // País
    { keys: ['guatemala'], expansion: 'guatemala OR guate OR chapin OR gt' },
    { keys: ['chapin'], expansion: 'chapin OR guatemala OR guate OR guatemalteco' },
  ];

  // Buscar palabras clave
  for (const keywordObj of keywords) {
    if (keywordObj.keys.some(keyword => query.includes(keyword))) {
      console.log(`🔍 Palabra clave REAL encontrada: ${keywordObj.keys.join('/')} → "${keywordObj.expansion}"`);
      return keywordObj.expansion;
    }
  }

  // FALLBACK INTELIGENTE: Solo agregar términos que realmente se usan
  // Si la query original ya tiene OR, no modificar
  if (originalQuery.includes(' OR ')) {
    console.log(`✅ Query ya optimizada con OR: "${originalQuery}"`);
    return originalQuery;
  }

  // Limpiar términos problemáticos antes de expandir
  let cleanedQuery = originalQuery;
  const problematicTerms = ['GT', 'game', 'gaming', 'gamer'];
  
  problematicTerms.forEach(term => {
    if (cleanedQuery.includes(term) && !cleanedQuery.toLowerCase().includes('guatemala')) {
      cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
      console.log(`🧹 Removido término problemático: "${term}" → "${cleanedQuery}"`);
    }
  });
  
  // Para queries simples, agregar solo variaciones lógicas
  const words = cleanedQuery.split(' ').filter(word => word.length > 2);
  if (words.length === 1) {
    const word = words[0].toLowerCase();
    // Solo agregar "guatemala" si no es obvio que ya es guatemalteco
    const needsContext = !['guatemala', 'guate', 'chapin', 'gt'].some(geoTerm => 
      cleanedQuery.toLowerCase().includes(geoTerm)
    );
    
    if (needsContext) {
      const contextualQuery = `${cleanedQuery} OR ${cleanedQuery} guatemala`;
      console.log(`📍 Agregando contexto guatemalteco: "${cleanedQuery}" → "${contextualQuery}"`);
      return contextualQuery;
    }
  }

  // Si no necesita expansión, usar query limpia
  console.log(`✅ Query final: "${cleanedQuery}"`);
  // NUEVO: Para consultas con múltiples términos (>1 palabra) sin operadores OR,
  // convertir la búsqueda a un formato "palabra OR palabra" para imitar el
  // comportamiento palabra-por-palabra usado en la rutina de trending. Esto
  // incrementa la cobertura cuando el usuario envía frases largas.

  const tokens = cleanedQuery.split(/\s+/).filter(w => w.length > 2 && !w.startsWith('#'));

  if (tokens.length > 1 && !cleanedQuery.includes(' OR ')) {
    const orQuery = tokens.join(' OR ');
    const finalOrQuery = `${orQuery} Guatemala`;
    console.log(`🔀 Query convertida a formato OR palabra-por-palabra: "${finalOrQuery}"`);
    return finalOrQuery.trim();
  }

  return cleanedQuery.trim() || originalQuery;
}

/**
 * Optimiza límites de tweets basado en el tipo de consulta
 */
function optimizeTweetLimit(query, requestedLimit = 10) {
  const query_lower = query.toLowerCase();
  
  // Para análisis de sentimiento o temas controversiales, usar más tweets
  const needMoreTweets = [
    'sentimiento', 'opinion', 'que dicen', 'que piensan', 'reaccion',
    'politica', 'elecciones', 'gobierno', 'presidente', 'congreso',
    'protestas', 'marchas', 'manifestacion', 'crisis'
  ];
  
  if (needMoreTweets.some(term => query_lower.includes(term))) {
    return Math.max(requestedLimit, 20); // Mínimo 20 tweets para análisis completo
  }
  
  // Para consultas específicas, 15 tweets es suficiente
  return Math.max(requestedLimit, 15);
}

// Registro de herramientas disponibles
const AVAILABLE_TOOLS = {
  nitter_context: {
    name: 'nitter_context',
    description: 'Obtiene tweets usando Nitter, los analiza con Gemini AI (sentimiento, intención, entidades) y los guarda en la base de datos',
    parameters: {
      q: {
        type: 'string',
        required: true,
        description: 'Término de búsqueda para obtener tweets contextuales'
      },
      location: {
        type: 'string',
        required: false,
        default: 'guatemala',
        description: 'Ubicación para filtrar resultados (guatemala, mexico, us, etc.)'
      },
      limit: {
        type: 'integer',
        required: false,
        default: 10,
        min: 5,
        max: 50,
        description: 'Número máximo de tweets a obtener'
      },
      session_id: {
        type: 'string',
        required: false,
        description: 'ID de sesión del chat (se genera automáticamente si no se proporciona)'
      }
    },
    service_endpoint: '/api/nitter_context',
    service_url: 'internal',
    category: 'social_media_analysis',
    usage_credits: 5,
    features: [
      'Extracción de tweets con Nitter',
      'Análisis de sentimiento con Gemini AI',
      'Detección de intención comunicativa',
      'Extracción de entidades mencionadas',
      'Guardado individual en base de datos',
      'Categorización automática'
    ]
  },
  
  perplexity_search: {
    name: 'perplexity_search',
    description: 'Realiza búsquedas web inteligentes usando Perplexity AI para obtener información actualizada y contextualizada sobre cualquier tema',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Consulta de búsqueda web para investigar'
      },
      location: {
        type: 'string',
        required: false,
        default: 'Guatemala',
        description: 'Contexto geográfico para la búsqueda (Guatemala, Mexico, etc.)'
      },
      focus: {
        type: 'string',
        required: false,
        default: 'general',
        description: 'Enfoque específico: general, noticias, eventos, deportes, politica, economia, cultura'
      },
      improve_nitter_search: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Si true, además de la búsqueda web, optimiza términos para mejorar búsquedas en Nitter'
      }
    },
    service_endpoint: '/api/perplexity_search', 
    service_url: 'internal',
    category: 'web_research',
    usage_credits: 3,
    features: [
      'Búsqueda web en tiempo real',
      'Información contextualizada por ubicación',
      'Análisis de eventos actuales',
      'Optimización de términos para redes sociales',
      'Detección de hashtags relevantes',
      'Contexto guatemalteco especializado'
    ]
  },
  
  user_projects: {
    name: 'user_projects',
    description: 'Obtiene los proyectos del usuario autenticado con estadísticas y metadatos completos',
    parameters: {
      limit: {
        type: 'integer',
        required: false,
        default: 20,
        min: 1,
        max: 100,
        description: 'Número máximo de proyectos a obtener'
      },
      status: {
        type: 'string',
        required: false,
        description: 'Filtrar por estado específico: active, completed, paused, planning'
      },
      priority: {
        type: 'string',
        required: false,
        description: 'Filtrar por prioridad: high, medium, low'
      }
    },
    service_endpoint: '/api/user_projects',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Lista proyectos del usuario autenticado',
      'Incluye estadísticas (decisiones, assets)',
      'Metadatos completos (fechas, prioridad, tags)',
      'Filtros por estado y prioridad',
      'Información de progreso y sugerencias'
    ]
  },
  
  user_codex: {
    name: 'user_codex',
    description: 'Accede al Codex personal del usuario: documentos, transcripciones, análisis y assets de proyectos',
    parameters: {
      project_id: {
        type: 'string',
        required: false,
        description: 'ID del proyecto específico para filtrar items'
      },
      query: {
        type: 'string',
        required: false,
        description: 'Búsqueda en título, contenido o transcripciones'
      },
      limit: {
        type: 'integer',
        required: false,
        default: 20,
        min: 1,
        max: 50,
        description: 'Número máximo de items a obtener'
      },
      type: {
        type: 'string',
        required: false,
        description: 'Filtrar por tipo: document, audio, video, image, note'
      },
      tags: {
        type: 'array',
        required: false,
        description: 'Filtrar por tags específicos (array de strings)',
        items: {
          type: 'string'
        }
      }
    },
    service_endpoint: '/api/user_codex',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Acceso completo al Codex personal',
      'Búsqueda inteligente en contenido y transcripciones',
      'Filtros por proyecto, tipo y tags',
      'Incluye análisis de documentos y transcripciones de audio',
      'Metadatos de archivos y relaciones con proyectos'
    ]
  },
  
  nitter_profile: {
    name: 'nitter_profile',
    description: 'Obtiene tweets recientes de un usuario específico usando Nitter, ideal para analizar la actividad de cuentas institucionales, políticos, influencers y personas públicas de Guatemala',
    parameters: {
      username: {
        type: 'string',
        description: 'Nombre de usuario de Twitter sin el @, por ejemplo: "GuatemalaGob", "elonmusk", "CashLuna"',
        required: true
      },
      limit: {
        type: 'number',
        description: 'Número máximo de tweets a obtener del usuario',
        min: 5,
        max: 20,
        default: 10
      },
      include_retweets: {
        type: 'boolean',
        description: 'Incluir retweets del usuario en los resultados',
        default: false
      },
      include_replies: {
        type: 'boolean',
        description: 'Incluir replies del usuario en los resultados',
        default: false
      }
    },
    category: 'social_media',
    examples: [
      'Busca los últimos tweets de @GuatemalaGob',
      'Que dice @CashLuna en sus tweets recientes',
      'Analiza la actividad de @MPguatemala'
    ]
  },
  
  project_decisions: {
    name: 'project_decisions',
    description: 'Obtiene todas las decisiones de un proyecto específico con detalles completos de cada capa (enfoque, alcance, configuración)',
    parameters: {
      project_id: {
        type: 'string',
        required: true,
        description: 'ID del proyecto para obtener sus decisiones'
      }
    },
    service_endpoint: '/api/project_decisions',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Acceso completo a decisiones por capas',
      'Detalles de enfoque, alcance y configuración',
      'Información de objetivos y próximos pasos',
      'Fechas límite y metodologías',
      'Referencias y fuentes de datos',
      'Histórico ordenado por fecha de creación'
    ]
  },
  
  resolve_twitter_handle: {
    name: 'resolve_twitter_handle',
    description: 'Resuelve nombres de personas a sus handles de Twitter/X usando búsqueda dinámica con GPT-4o y guardado automático en PulsePolitics',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'Nombre de la persona a buscar (ej: "Bernardo Arévalo", "Sandra Torres")'
      },
      context: {
        type: 'string',
        required: false,
        description: 'Contexto adicional sobre la persona (cargo, institución, etc.)'
      },
      sector: {
        type: 'string',
        required: false,
        description: 'Sector específico: gobierno, politica, medios, deportes, etc.'
      }
    },
    service_endpoint: '/api/resolve_twitter_handle',
    service_url: 'internal',
    category: 'social_media',
    usage_credits: 2,
    features: [
      'Búsqueda 100% dinámica - sin usuarios hardcodeados',
      'Resolución inteligente usando GPT-4o con conocimiento actualizado y mayor precisión',
      'Guardado automático de handles resueltos en PulsePolitics',
      'Contexto guatemalteco especializado con casos específicos',
      'Aprendizaje continuo mediante almacenamiento de descubrimientos',
      'Base de conocimiento que crece automáticamente'
    ]
  }
};

/**
 * Lista todas las herramientas disponibles en el MCP Server
 * @returns {Array} Array de herramientas con su información
 */
async function listAvailableTools() {
  try {
    const tools = Object.values(AVAILABLE_TOOLS).map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      usage_credits: tool.usage_credits
    }));

    console.log(`📋 Listando ${tools.length} herramientas MCP disponibles`);
    return tools;
  } catch (error) {
    console.error('❌ Error listando herramientas MCP:', error);
    throw error;
  }
}

/**
 * Obtiene información detallada de una herramienta específica
 * @param {string} toolName - Nombre de la herramienta
 * @returns {Object|null} Información de la herramienta o null si no existe
 */
async function getToolInfo(toolName) {
  try {
    const tool = AVAILABLE_TOOLS[toolName];
    
    if (!tool) {
      console.log(`⚠️ Herramienta '${toolName}' no encontrada`);
      return null;
    }

    console.log(`📖 Obteniendo información de herramienta: ${toolName}`);
    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      usage_credits: tool.usage_credits,
      service_info: {
        endpoint: tool.service_endpoint,
        url: tool.service_url
      }
    };
  } catch (error) {
    console.error(`❌ Error obteniendo info de herramienta ${toolName}:`, error);
    throw error;
  }
}

/**
 * Ejecuta una herramienta específica del MCP Server
 * @param {string} toolName - Nombre de la herramienta
 * @param {Object} parameters - Parámetros para la herramienta
 * @param {Object} user - Información del usuario autenticado
 * @returns {Object} Resultado de la ejecución
 */
async function executeTool(toolName, parameters = {}, user = null) {
  try {
    console.log(`🔧 Ejecutando herramienta MCP: ${toolName}`);
    
    // Validar que la herramienta existe
    if (!AVAILABLE_TOOLS[toolName]) {
      throw new Error(`Herramienta '${toolName}' no encontrada. Herramientas disponibles: ${Object.keys(AVAILABLE_TOOLS).join(', ')}`);
    }
    
    // Ejecutar herramienta específica
    switch (toolName) {
      case 'nitter_context':
        return await executeNitterContext(
          parameters.q, 
          parameters.location || 'guatemala', 
          parameters.limit || 10,
          parameters.session_id,
          user
        );
      case 'perplexity_search':
        return await executePerplexitySearch(
          parameters.query,
          parameters.location || 'Guatemala',
          parameters.focus || 'general',
          parameters.improve_nitter_search || false,
          user
        );
      case 'user_projects':
        return await executeUserProjects(
          parameters.limit || 20,
          parameters.status,
          parameters.priority,
          user
        );
      case 'user_codex':
        return await executeUserCodex(
          parameters.project_id,
          parameters.query,
          parameters.limit || 20,
          parameters.type,
          parameters.tags,
          user
        );
      case 'nitter_profile':
        const { username, limit, include_retweets, include_replies } = parameters;
        
        if (!username || typeof username !== 'string') {
          throw new Error('El parámetro username es requerido y debe ser un string');
        }
        
        return await executeNitterProfile(
          username.trim(),
          limit || 10,
          include_retweets || false,
          include_replies || false,
          user
        );
      case 'project_decisions':
        return await executeProjectDecisions(
          parameters.project_id,
          user
        );
      case 'resolve_twitter_handle':
        return await executeResolveTwitterHandle(
          parameters.name,
          parameters.context || '',
          parameters.sector || '',
          user
        );
      default:
        throw new Error(`Ejecutor no implementado para herramienta: ${toolName}`);
    }
  } catch (error) {
    console.error(`❌ Error ejecutando herramienta ${toolName}:`, error);
    throw error;
  }
}

/**
 * Función para optimizar términos de búsqueda con DeepSeek ANTES de buscar
 * @param {string} originalQuery - Consulta original del usuario
 * @param {string} location - Ubicación geográfica
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Términos optimizados por DeepSeek
 */
async function optimizeSearchWithDeepSeek(originalQuery, location, user) {
  try {
    console.log('🧠 Optimizando búsqueda con DeepSeek antes de ejecutar...');
    
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    
    if (!DEEPSEEK_API_KEY) {
      console.log('⚠️ DEEPSEEK_API_KEY no configurada, usando términos estándar');
      return {
        optimized: false,
        final_query: originalQuery,
        strategy: 'standard_expansion'
      };
    }

    const now = new Date();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

    const deepSeekPrompt = `Optimiza esta consulta para encontrar tweets REALES en redes sociales guatemaltecas.

CONSULTA: "${originalQuery}"
UBICACIÓN: ${location}
FECHA: ${currentMonth} ${currentYear}

INSTRUCCIONES:
1. Analiza qué busca el usuario
2. Genera términos que la gente REALMENTE usa en Twitter
3. Incluye hashtags y variaciones populares
4. Considera el contexto guatemalteco actual

EJEMPLOS DE OPTIMIZACIÓN CORRECTA:
- "disturbios Izabal minería" → "izabal OR minería OR protestas OR manifestaciones OR mina OR resistencia"
- "elecciones guatemala" → "elecciones OR electoral OR voto OR tse OR bernardo OR arevalo"
- "orgullo guatemala" → "orgullo OR pride OR lgbt OR diversidad OR marcha OR #orgullogt"

RESPONDE SOLO EN JSON:
{
  "razonamiento": "análisis breve de por qué optimizar",
  "consulta_optimizada": "términos OR reales OR que OR usan",
  "hashtags_incluidos": ["#hashtag1"],
  "estrategia_aplicada": "estrategia usada",
  "probabilidad_exito": "alta|media|baja",
  "terminos_clave_agregados": ["término1"],
  "justificacion": "por qué estos términos funcionan mejor"
}

Usa SOLO términos que realmente se usan en redes sociales guatemaltecas.`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: 'Eres DeepSeek, un modelo de razonamiento avanzado especializado en optimización de búsquedas para redes sociales. Tu fortaleza es analizar consultas y generar términos de búsqueda que maximicen las posibilidades de encontrar contenido relevante.'
          },
          {
            role: 'user',
            content: deepSeekPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      console.log(`⚠️ Error llamando a DeepSeek: ${response.status}`);
      return {
        optimized: false,
        final_query: originalQuery,
        strategy: 'standard_expansion',
        error: `DeepSeek API error: ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.log('⚠️ Respuesta de DeepSeek incompleta, usando expansión estándar');
      return {
        optimized: false,
        final_query: originalQuery,
        strategy: 'standard_expansion',
        error: 'DeepSeek response incomplete'
      };
    }

    const rawContent = data.choices[0].message.content.trim();
    
    let optimization;
    try {
      optimization = JSON.parse(rawContent);
    } catch (parseError) {
      // Intentar extraer JSON si está envuelto en otros caracteres
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          optimization = JSON.parse(jsonMatch[0]);
          console.log('✅ DeepSeek JSON extraído exitosamente');
        } catch (secondError) {
          console.log('⚠️ DeepSeek falló, usando expansión estándar');
          return {
            optimized: false,
            final_query: originalQuery,
            strategy: 'standard_expansion',
            error: `JSON parse error: ${parseError.message}`
          };
        }
      } else {
        console.log('⚠️ DeepSeek no devolvió JSON válido, usando expansión estándar');
        return {
          optimized: false,
          final_query: originalQuery,
          strategy: 'standard_expansion',
          error: `No JSON found in response`
        };
      }
    }
    
    console.log(`✅ DeepSeek optimizó: "${originalQuery}" → "${optimization.consulta_optimizada}"`);
    console.log(`🎯 Estrategia: ${optimization.estrategia_aplicada}`);
    console.log(`📊 Probabilidad de éxito: ${optimization.probabilidad_exito}`);
    
    return {
      optimized: true,
      original_query: originalQuery,
      final_query: optimization.consulta_optimizada,
      strategy: optimization.estrategia_aplicada,
      hashtags_included: optimization.hashtags_incluidos,
      key_terms_added: optimization.terminos_clave_agregados,
      success_probability: optimization.probabilidad_exito,
      reasoning: optimization.razonamiento,
      justification: optimization.justificacion
    };

  } catch (error) {
    console.error('❌ Error en optimización DeepSeek:', error);
    return {
      optimized: false,
      final_query: originalQuery,
      strategy: 'standard_expansion',
      error: error.message
    };
  }
}

/**
 * Ejecuta específicamente la herramienta nitter_context para obtener tweets contextuales
 * @param {string} query - Consulta de búsqueda
 * @param {string} location - Ubicación geográfica
 * @param {number} limit - Límite de tweets
 * @param {string} sessionId - ID de sesión
 * @param {Object} user - Información del usuario
 * @returns {Object} Resultado de la búsqueda de tweets contextuales
 */
async function executeNitterContext(query, location = 'guatemala', limit = 10, sessionId = null, user = null) {
  try {
    console.log(`🐦 Ejecutando nitter_context MCP: query="${query}", location="${location}", limit=${limit}`);
    
    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar nitter_context');
    }
    
    // DETECCIÓN DE QUERY OPTIMIZADA POR LLM (Laura)
    // Si la query contiene hashtags, emojis o jerga específica, es de Laura y NO debe modificarse
    const isLLMOptimized = query.includes('#') || 
                          /\sOR\s/i.test(query) ||
                          query.includes('⚽') || 
                          query.includes('chapin') || 
                          query.includes('guate') ||
                          query.includes('crema') ||
                          query.includes('rojo') ||
                          /[🎯🏆⚽🏀🎾🥅]/g.test(query);
    
    let finalQuery;
    const optimizedLimit = optimizeTweetLimit(query, limit);
    
    if (isLLMOptimized) {
      // La query viene con hashtags/jerga (optimizada por LLM), pero si contiene
      // varias palabras separadas por espacios **y** no contiene operadores
      // OR, la convertimos a formato "palabra OR palabra" para imitar la
      // búsqueda palabra-por-palabra que usa el proceso de trending.

      const containsOR = /\sOR\s/i.test(query);
      const rawTokens = query.split(/\s+/).filter(t => t.length > 1);
      const meaningfulTokens = rawTokens.filter(t => !t.startsWith('#'));

      if (!containsOR && meaningfulTokens.length > 1) {
        const orQuery = meaningfulTokens.join(' OR ');
        // Mantener hashtags al final para no perder contexto viral
        const hashtags = rawTokens.filter(t => t.startsWith('#')).join(' ');
        finalQuery = `${orQuery} Guatemala ${hashtags}`.trim();
        console.log(`🔀 Query LLM optimizada convertida a OR palabra-por-palabra: "${finalQuery}"`);
      } else {
        // Sin modificación si ya contiene OR o es término único
        finalQuery = query;
        console.log(`🧠 Query optimizada por LLM preservada: "${finalQuery}"`);
      }
    } else {
      // SOLO PARA QUERIES SIMPLES: aplicar expansión estándar
      console.log(`🔧 Query simple detectada - aplicando expansión estándar`);
      
      // Desactivar completamente la optimización con DeepSeek para queries simples también
      const deepSeekOptimization = {
        optimized: false,
        final_query: query,
        strategy: 'disabled',
        reasoning: null,
        success_probability: null
      };
      
      // PASO 2: EXPANSIÓN ESTÁNDAR como backup
      const standardExpansion = expandSearchTerms(query);
      
      // Decidir qué query usar: DeepSeek si está optimizada, sino expansión estándar
      finalQuery = deepSeekOptimization.optimized ? 
        deepSeekOptimization.final_query : 
        standardExpansion;
      
      console.log(`🎯 Query original: "${query}"`);
      if (deepSeekOptimization.optimized) {
        console.log(`🧠 Query optimizada por DeepSeek: "${finalQuery}"`);
        console.log(`📋 Estrategia aplicada: ${deepSeekOptimization.strategy}`);
        console.log(`🎲 Probabilidad de éxito: ${deepSeekOptimization.success_probability}`);
      } else {
        console.log(`🚀 Query expandida estándar: "${finalQuery}"`);
      }
    }
    
    console.log(`📊 Límite optimizado: ${optimizedLimit} tweets`);
    
    // Generar session_id si no se proporciona
    const finalSessionId = sessionId || `mcp_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // PASO 3: EJECUTAR BÚSQUEDA CON TÉRMINOS OPTIMIZADOS
    const result = await processNitterContext(
      finalQuery, // Usar la query optimizada por DeepSeek
      user.id,
      finalSessionId,
      location,
      optimizedLimit
    );

    if (result.success) {
      console.log(`✅ Nitter context procesado exitosamente: ${result.data.tweets_found} tweets analizados`);
      
      // Formatear respuesta para el agente AI con información adicional sobre la optimización
      const formattedTweets = result.data.tweets.map(tweet => 
        `@${tweet.usuario} (${tweet.fecha_tweet}): ${tweet.texto}\n` +
        `   📊 Sentimiento: ${tweet.sentimiento} (${tweet.score_sentimiento}) | ` +
        `Intención: ${tweet.intencion_comunicativa}\n` +
        `   💬 Engagement: ❤️${tweet.likes} 🔄${tweet.retweets} 💬${tweet.replies} | ` +
        `Entidades: ${tweet.entidades_mencionadas.length}\n`
      ).join('\n');
      
      return {
        success: true,
        tweets: result.data.tweets,
        tweets_found: result.data.tweets_found,
        query_original: query,
        query_final: finalQuery,
        optimization_applied: !isLLMOptimized,
        llm_optimized: isLLMOptimized,
        deepseek_strategy: isLLMOptimized ? 'llm_preserved' : 'standard_expansion',
        deepseek_reasoning: isLLMOptimized ? 'Query optimizada por LLM preservada sin modificaciones' : 'Query expandida con método estándar',
        success_probability: isLLMOptimized ? 'alta' : 'media',
        limit_requested: limit,
        limit_used: optimizedLimit,
        session_id: finalSessionId,
        formatted_context: `BÚSQUEDA INTELIGENTE CON PRESERVACIÓN LLM:
Query original del usuario: "${query}"
${isLLMOptimized ? 
  `🧠 Query optimizada por LLM PRESERVADA: "${finalQuery}"
📋 Estrategia aplicada: preservación_inteligente
🎯 Razonamiento: Laura detectó y optimizó la query con jerga, hashtags y contexto específico
📊 Probabilidad de éxito estimada: alta (query pre-optimizada por IA)
🏷️ Elementos detectados: ${query.includes('#') ? 'hashtags' : ''}${query.includes('chapin') || query.includes('guate') ? ', jerga guatemalteca' : ''}${/[🎯🏆⚽🏀🎾🥅]/g.test(query) ? ', emojis contextuales' : ''}` :
  `🚀 Query expandida estándar: "${finalQuery}" (sin optimización LLM previa)`}
Tweets analizados: ${result.data.tweets_found}/${optimizedLimit}
Ubicación: ${location}

TWEETS ENCONTRADOS Y ANALIZADOS:
${formattedTweets}

ANÁLISIS CONTEXTUAL:
${isLLMOptimized ? 
  `- Laura (LLM) pre-optimizó la query con jerga y hashtags guatemaltecos
- Se preservó la optimización inteligente sin modificaciones adicionales
- Query contiene elementos específicos de redes sociales guatemaltecas` :
  `- Se expandió automáticamente la consulta con métodos estándar`}
- Se optimizó el límite basado en el tipo de análisis requerido
- Todos los tweets incluyen análisis de sentimiento e intención comunicativa
- Las entidades mencionadas han sido extraídas automáticamente`,
        analysis_metadata: {
          deepseek_optimization: false,
          llm_optimization: isLLMOptimized,
          optimization_strategy: isLLMOptimized ? 'llm_preserved' : 'standard_expansion',
          original_vs_optimized: isLLMOptimized,
          limit_optimization_applied: optimizedLimit !== limit,
          tweets_analyzed: result.data.tweets_found,
          sentiment_distribution: result.data.tweets.reduce((acc, tweet) => {
            acc[tweet.sentimiento] = (acc[tweet.sentimiento] || 0) + 1;
            return acc;
          }, {}),
          average_engagement: result.data.tweets.reduce((sum, tweet) => 
            sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0
          ) / result.data.tweets.length || 0
        }
      };
    } else {
      throw new Error(result.error || 'Error procesando nitter_context');
    }

  } catch (error) {
    console.error(`❌ Error ejecutando nitter_context MCP:`, error);
    throw error;
  }
}

/**
 * Ejecuta específicamente la herramienta perplexity_search para búsquedas web inteligentes
 * @param {string} query - Consulta de búsqueda web
 * @param {string} location - Contexto geográfico
 * @param {string} focus - Enfoque específico de la búsqueda
 * @param {boolean} improveNitterSearch - Si también generar términos optimizados para Nitter
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultado de la búsqueda web con Perplexity
 */
async function executePerplexitySearch(query, location = 'Guatemala', focus = 'general', improveNitterSearch = false, user = null) {
  try {
    console.log(`🔍 Ejecutando perplexity_search MCP: query="${query}", location="${location}", focus="${focus}", improveNitter=${improveNitterSearch}`);
    
    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar perplexity_search');
    }

    // Importar el servicio de Perplexity 
    const perplexityService = require('./perplexity');
    
    // Obtener fecha actual para contexto temporal
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    
         // Construir consulta optimizada basada en el enfoque - SIEMPRE CON FILTRO TEMPORAL
     let optimizedQuery = query;
     let searchContext = '';
     
     // FILTRO TEMPORAL OBLIGATORIO: Agregar contexto temporal actual SIEMPRE
     const temporalContext = `${currentMonth} ${currentYear} actual reciente`;
     
     switch (focus) {
       case 'noticias':
         optimizedQuery = `${query} noticias ${location} ${temporalContext} últimas`;
         searchContext = `noticias actuales y eventos recientes de ${currentMonth} ${currentYear}`;
         break;
       case 'eventos':
         optimizedQuery = `${query} eventos ${location} ${temporalContext} próximos`;
         searchContext = `eventos y actividades actuales de ${currentMonth} ${currentYear}`;
         break;
       case 'deportes':
         optimizedQuery = `${query} deportes ${location} ${temporalContext} temporada`;
         searchContext = `deportes y competencias actuales de ${currentMonth} ${currentYear}`;
         break;
       case 'politica':
         optimizedQuery = `${query} política ${location} ${temporalContext} gobierno`;
         searchContext = `política y gobierno actual de ${currentMonth} ${currentYear}`;
         break;
       case 'economia':
         optimizedQuery = `${query} economía ${location} ${temporalContext} últimas cifras`;
         searchContext = `economía y finanzas actuales de ${currentMonth} ${currentYear}`;
         break;
       case 'cultura':
         optimizedQuery = `${query} cultura ${location} ${temporalContext} entretenimiento`;
         searchContext = `cultura y entretenimiento actual de ${currentMonth} ${currentYear}`;
         break;
       default:
         optimizedQuery = `${query} ${location} ${temporalContext} información`;
         searchContext = `información general actualizada de ${currentMonth} ${currentYear}`;
     }

    console.log(`🎯 Consulta optimizada: "${optimizedQuery}"`);
    
         // Preparar prompt especializado para búsquedas web generales - CON ENFOQUE TEMPORAL
     const webSearchPrompt = `Analiza la consulta "${query}" y proporciona información completa y ACTUALIZADA.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}**
**CONTEXTO GEOGRÁFICO: ${location}**
**ENFOQUE: ${searchContext}**

⚠️ CRÍTICO - FILTRO TEMPORAL:
- SOLO busca información de ${currentMonth} ${currentYear} o MUY RECIENTE
- NO incluyas información histórica o de años anteriores
- Prioriza eventos, noticias y desarrollos ACTUALES
- Si no hay información reciente, especifica claramente que no hay datos actuales

INSTRUCCIONES ESPECÍFICAS:
1. Busca información ACTUALIZADA sobre "${query}" en el contexto de ${location} para ${currentMonth} ${currentYear}
2. Enfócate específicamente en ${searchContext}
3. Proporciona datos concretos de ${currentMonth} ${currentYear}, fechas específicas recientes
4. Si es sobre personas, incluye información biográfica Y SU ESTADO ACTUAL en ${currentYear}
5. Si es sobre eventos, incluye SOLO eventos de ${currentMonth} ${currentYear} o próximos
6. Si es sobre temas actuales, incluye desarrollos de ${currentMonth} ${currentYear}
7. Contextualiza la información para el público de ${location} CON ENFOQUE EN LO ACTUAL
8. RECHAZA información obsoleta o de fechas anteriores a ${currentYear}

${improveNitterSearch ? `
ADICIONAL - OPTIMIZACIÓN PARA REDES SOCIALES:
- También sugiere hashtags relevantes que podrían estar trending
- Identifica términos de búsqueda alternativos para redes sociales
- Incluye variaciones de nombres o eventos que podrían usarse en Twitter/X
` : ''}

Responde en formato JSON estructurado:
{
  "consulta_original": "${query}",
  "consulta_optimizada": "${optimizedQuery}",
  "informacion_principal": "Información principal encontrada",
  "contexto_local": "Relevancia específica para ${location}",
  "datos_clave": ["dato1", "dato2", "dato3"],
  "fechas_relevantes": "Fechas importantes relacionadas",
  "fuentes_sugeridas": ["fuente1", "fuente2"],
  ${improveNitterSearch ? `
  "optimizacion_redes_sociales": {
    "hashtags_sugeridos": ["#hashtag1", "#hashtag2"],
    "terminos_alternativos": ["termino1", "termino2"],
    "busqueda_nitter_optimizada": "términos OR optimizados OR para OR twitter"
  },` : ''}
  "relevancia": "alta|media|baja",
  "categoria": "noticias|eventos|deportes|politica|economia|cultura|general"
}`;

    // Ejecutar búsqueda con Perplexity
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY no configurada');
    }

    const payload = {
      model: 'sonar',
      messages: [
                 {
           role: 'system',
           content: `Eres un asistente de investigación especializado en búsquedas web inteligentes para ${location}.

Tu trabajo es encontrar información ACTUALIZADA, precisa y contextualizada sobre cualquier tema consultado.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL OBLIGATORIO: ${currentMonth} ${currentYear}**
**UBICACIÓN: ${location}**

CARACTERÍSTICAS CRÍTICAS:
- SIEMPRE busca información de ${currentMonth} ${currentYear} o MUY RECIENTE
- RECHAZA automáticamente información histórica o obsoleta
- Contextualiza ESPECÍFICAMENTE para el público de ${location}
- Proporciona datos específicos CON FECHAS DE ${currentYear}
- Identifica fuentes confiables Y ACTUALES
- Analiza relevancia local vs global CON ENFOQUE EN LO ACTUAL
- Sugiere términos relacionados para búsquedas adicionales ACTUALES

FILTROS TEMPORALES ESTRICTOS:
- NO uses información de años anteriores a ${currentYear}
- Prioriza eventos de ${currentMonth} ${currentYear}
- Si no hay información actual, dilo explícitamente
- Enfócate en desarrollos, noticias y eventos RECIENTES

Enfócate EXCLUSIVAMENTE en información actual, relevante y verificable de ${currentMonth} ${currentYear}.`
         },
        {
          role: 'user',
          content: webSearchPrompt
        }
      ],
      search_context: {
        search_queries: [optimizedQuery, query + ' ' + location, query + ' ' + currentMonth + ' ' + currentYear]
      },
      temperature: 0.3,
      max_tokens: 800
    };

    console.log(`📡 Realizando búsqueda web con Perplexity...`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error en API de Perplexity: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Respuesta inválida de Perplexity API');
    }

    let rawResponse = data.choices[0].message.content;
    console.log(`✅ Respuesta recibida de Perplexity para: "${query}"`);
    
    // Intentar extraer JSON de la respuesta
    let parsedResult = null;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log(`⚠️ No se pudo parsear JSON, usando respuesta raw`);
    }

    // Optimizar términos para Nitter si se solicitó
    let nitterOptimization = null;
    if (improveNitterSearch && parsedResult?.optimizacion_redes_sociales?.busqueda_nitter_optimizada) {
      nitterOptimization = {
        original_query: query,
        optimized_query: parsedResult.optimizacion_redes_sociales.busqueda_nitter_optimizada,
        suggested_hashtags: parsedResult.optimizacion_redes_sociales.hashtags_sugeridos || [],
        alternative_terms: parsedResult.optimizacion_redes_sociales.terminos_alternativos || []
      };
    }

    // Formatear respuesta para el agente AI
    const formattedResponse = parsedResult ? 
      `BÚSQUEDA WEB COMPLETADA PARA: "${query}"

INFORMACIÓN PRINCIPAL:
${parsedResult.informacion_principal}

CONTEXTO LOCAL (${location}):
${parsedResult.contexto_local}

DATOS CLAVE:
${parsedResult.datos_clave ? parsedResult.datos_clave.map(dato => `• ${dato}`).join('\n') : 'No disponible'}

FECHAS RELEVANTES:
${parsedResult.fechas_relevantes || 'No especificadas'}

FUENTES SUGERIDAS:
${parsedResult.fuentes_sugeridas ? parsedResult.fuentes_sugeridas.map(fuente => `• ${fuente}`).join('\n') : 'No disponible'}

${nitterOptimization ? `
OPTIMIZACIÓN PARA REDES SOCIALES:
• Búsqueda optimizada para Twitter/X: "${nitterOptimization.optimized_query}"
• Hashtags sugeridos: ${nitterOptimization.suggested_hashtags.join(', ')}
• Términos alternativos: ${nitterOptimization.alternative_terms.join(', ')}
` : ''}

RELEVANCIA: ${parsedResult.relevancia || 'No determinada'}
CATEGORÍA: ${parsedResult.categoria || 'general'}` 
    : 
      `BÚSQUEDA WEB COMPLETADA PARA: "${query}"

${rawResponse}

Consulta optimizada: "${optimizedQuery}"
Enfoque: ${searchContext}
Contexto: ${location}`;

    return {
      success: true,
      query_original: query,
      query_optimized: optimizedQuery,
      location: location,
      focus: focus,
      web_search_result: parsedResult || { raw_response: rawResponse },
      nitter_optimization: nitterOptimization,
      formatted_response: formattedResponse,
      metadata: {
        search_performed: true,
        perplexity_model: 'sonar',
        response_length: rawResponse.length,
        json_parsed: parsedResult !== null,
        nitter_optimization_included: nitterOptimization !== null,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando perplexity_search MCP:`, error);
    throw error;
  }
}

/**
 * Ejecuta la herramienta user_projects: obtiene proyectos del usuario
 * @param {number} limit - Límite de proyectos a obtener
 * @param {string} status - Filtro por estado (opcional)
 * @param {string} priority - Filtro por prioridad (opcional)
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultados de proyectos del usuario
 */
async function executeUserProjects(limit = 20, status = null, priority = null, user = null) {
  try {
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado. Se requiere autenticación para acceder a proyectos personales.');
    }

    console.log(`📊 Ejecutando user_projects para usuario: ${user.email} (${user.id})`);
    
    const options = { limit };
    if (status) options.status = status;
    if (priority) options.priority = priority;

    const projects = await getUserProjects(user.id, options);
    
    // Obtener estadísticas generales
    const userStats = await getUserStats(user.id);

    // Formatear respuesta para el agente AI
    const formattedResponse = `PROYECTOS DEL USUARIO: ${user.email}

ESTADÍSTICAS GENERALES:
• Total de proyectos: ${userStats.totalProjects}
• Total de items en Codex: ${userStats.totalCodexItems}
• Total de decisiones: ${userStats.totalDecisions}

DISTRIBUCIÓN POR ESTADO:
${Object.entries(userStats.projectsByStatus).map(([key, value]) => `• ${key}: ${value} proyectos`).join('\n')}

PROYECTOS (${projects.length} mostrados):
${projects.map(project => `
📁 ${project.title} (ID: ${project.id})
   Estado: ${project.status} | Prioridad: ${project.priority}
   Categoría: ${project.category || 'Sin categoría'}
   Decisiones: ${project.stats.decisionsCount} | Assets: ${project.stats.assetsCount}
   ${project.description ? `Descripción: ${project.description.substring(0, 100)}...` : ''}
   Creado: ${new Date(project.created_at).toLocaleDateString('es-ES')}
   ${project.tags && project.tags.length > 0 ? `Tags: ${project.tags.join(', ')}` : ''}
`).join('\n')}

Los proyectos están ordenados por fecha de actualización más reciente.`;

    return {
      success: true,
      user_id: user.id,
      user_email: user.email,
      filters_applied: { limit, status, priority },
      total_projects: projects.length,
      user_stats: userStats,
      projects: projects,
      formatted_response: formattedResponse,
      metadata: {
        service: 'user_projects',
        execution_time: new Date().toISOString(),
        data_source: 'supabase'
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando user_projects MCP:`, error);
    throw error;
  }
}

/**
 * Ejecuta la herramienta user_codex: accede al Codex personal del usuario
 * @param {string} projectId - ID del proyecto (opcional)
 * @param {string} searchQuery - Búsqueda en contenido (opcional)
 * @param {number} limit - Límite de items a obtener
 * @param {string} type - Filtro por tipo (opcional)
 * @param {Array} tags - Filtro por tags (opcional)
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultados del Codex personal
 */
async function executeUserCodex(projectId = null, searchQuery = null, limit = 20, type = null, tags = null, user = null) {
  try {
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado. Se requiere autenticación para acceder al Codex personal.');
    }

    console.log(`📚 Ejecutando user_codex para usuario: ${user.email} (${user.id})`);
    console.log(`Filtros - Proyecto: ${projectId}, Búsqueda: "${searchQuery}", Tipo: ${type}`);
    
    const options = { limit };
    if (projectId) options.projectId = projectId;
    if (searchQuery) options.query = searchQuery;
    if (type) options.type = type;
    if (tags) options.tags = tags;

    const codexItems = await getUserCodex(user.id, options);
    
    // Si hay búsqueda específica, usar también la función de búsqueda
    let searchResults = null;
    if (searchQuery) {
      searchResults = await searchUserCodex(searchQuery, user.id, { limit: 10 });
    }

    // Formatear respuesta para el agente AI
    const filtersText = [
      projectId ? `Proyecto: ${projectId}` : null,
      searchQuery ? `Búsqueda: "${searchQuery}"` : null,
      type ? `Tipo: ${type}` : null,
      tags ? `Tags: ${tags.join(', ')}` : null
    ].filter(Boolean).join(' | ');

    const formattedResponse = `CODEX PERSONAL: ${user.email}

${filtersText ? `FILTROS APLICADOS: ${filtersText}` : 'MOSTRANDO TODOS LOS ITEMS'}

RESULTADOS DEL CODEX (${codexItems.length} items):
${codexItems.map(item => `
📄 ${item.title} (ID: ${item.id})
   Proyecto: ${item.projectTitle} (${item.projectStatus})
   Tipo: ${item.type}
   ${item.file_name ? `Archivo: ${item.file_name}` : ''}
   ${item.hasTranscription ? '🎵 Tiene transcripción de audio' : ''}
   ${item.hasAnalysis ? '📊 Tiene análisis de documento' : ''}
   ${item.tags && item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : ''}
   ${item.contentPreview ? `Contenido: ${item.contentPreview}` : ''}
   ${item.transcriptionPreview ? `Transcripción: ${item.transcriptionPreview}` : ''}
   Creado: ${new Date(item.created_at).toLocaleDateString('es-ES')}
`).join('\n')}

${searchResults && searchResults.length > 0 ? `
BÚSQUEDA ESPECÍFICA "${searchQuery}" (${searchResults.length} resultados más relevantes):
${searchResults.slice(0, 5).map(result => `
🔍 ${result.title} (Relevancia: ${result.relevanceScore})
   Proyecto: ${result.projectTitle}
   ${result.contentPreview}
`).join('\n')}` : ''}

Total de items disponibles en tu Codex personal.`;

    return {
      success: true,
      user_id: user.id,
      user_email: user.email,
      filters_applied: { projectId, searchQuery, limit, type, tags },
      total_items: codexItems.length,
      codex_items: codexItems,
      search_results: searchResults,
      formatted_response: formattedResponse,
      metadata: {
        service: 'user_codex',
        execution_time: new Date().toISOString(),
        data_source: 'supabase',
        search_performed: !!searchQuery
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando user_codex MCP:`, error);
    throw error;
  }
}

/**
 * Ejecuta la herramienta project_decisions: obtiene decisiones de un proyecto específico
 * @param {string} projectId - ID del proyecto
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultados de las decisiones del proyecto
 */
async function executeProjectDecisions(projectId, user = null) {
  try {
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado. Se requiere autenticación para acceder a decisiones de proyectos.');
    }

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Se requiere un project_id válido para obtener las decisiones.');
    }

    console.log(`🎯 Ejecutando project_decisions para proyecto: ${projectId}, usuario: ${user.email}`);
    
    const result = await getProjectDecisions(projectId, user.id);
    
    if (!result || !result.project) {
      throw new Error('Proyecto no encontrado o sin permisos para acceder.');
    }

    const { project, decisions } = result;

    // Formatear respuesta para el agente AI
    const formattedResponse = `DECISIONES DEL PROYECTO: ${project.title} (ID: ${projectId})

RESUMEN:
• Total de decisiones: ${decisions.length}
• Proyecto: ${project.title}
• Usuario: ${user.email}

DECISIONES POR CAPAS:
${decisions.map((decision, index) => `
🔹 DECISIÓN ${index + 1}: ${decision.title} [${decision.decision_type.toUpperCase()}]
   Tipo: ${decision.decision_type} | Creada: ${new Date(decision.created_at).toLocaleDateString('es-ES')}
   ${decision.description ? `Descripción: ${decision.description}` : ''}
   ${decision.change_description ? `Cambio: ${decision.change_description}` : ''}
   ${decision.objective ? `Objetivo: ${decision.objective}` : ''}
   ${decision.next_steps ? `Próximos pasos: ${decision.next_steps}` : ''}
   ${decision.deadline ? `Fecha límite: ${new Date(decision.deadline).toLocaleDateString('es-ES')}` : ''}
   
   ${decision.decision_type === 'enfoque' ? `
   📍 DETALLES DE ENFOQUE:
   ${decision.focus_area ? `• Área de enfoque: ${decision.focus_area}` : ''}
   ${decision.focus_context ? `• Contexto: ${decision.focus_context}` : ''}` : ''}
   
   ${decision.decision_type === 'alcance' ? `
   🌐 DETALLES DE ALCANCE:
   ${decision.geographic_scope ? `• Alcance geográfico: ${decision.geographic_scope}` : ''}
   ${decision.monetary_scope ? `• Alcance monetario: ${decision.monetary_scope}` : ''}
   ${decision.time_period_start ? `• Período: ${decision.time_period_start} - ${decision.time_period_end || 'Abierto'}` : ''}
   ${decision.target_entities ? `• Entidades objetivo: ${decision.target_entities}` : ''}
   ${decision.scope_limitations ? `• Limitaciones: ${decision.scope_limitations}` : ''}` : ''}
   
   ${decision.decision_type === 'configuracion' ? `
   ⚙️ DETALLES DE CONFIGURACIÓN:
   ${decision.output_format && decision.output_format.length > 0 ? `• Formatos de salida: ${decision.output_format.join(', ')}` : ''}
   ${decision.methodology ? `• Metodología: ${decision.methodology}` : ''}
   ${decision.data_sources ? `• Fuentes de datos: ${decision.data_sources}` : ''}
   ${decision.search_locations ? `• Ubicaciones de búsqueda: ${decision.search_locations}` : ''}
   ${decision.tools_required ? `• Herramientas requeridas: ${decision.tools_required}` : ''}
   ${decision.references && decision.references.length > 0 ? `• Referencias: ${decision.references.join(', ')}` : ''}` : ''}
`).join('\n')}

Las decisiones están ordenadas de más reciente a más antigua.`;

    return {
      success: true,
      user_id: user.id,
      user_email: user.email,
      project_id: projectId,
      project_title: project.title,
      total_decisions: decisions.length,
      decisions: decisions,
      formatted_response: formattedResponse,
      metadata: {
        service: 'project_decisions',
        execution_time: new Date().toISOString(),
        data_source: 'supabase'
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando project_decisions MCP:`, error);
    throw error;
  }
}

/**
 * Valida los parámetros de una herramienta
 * @param {Object} tool - Configuración de la herramienta
 * @param {Object} parameters - Parámetros a validar
 * @returns {Object} Resultado de validación
 */
function validateToolParameters(tool, parameters) {
  const errors = [];
  
  for (const [paramName, paramConfig] of Object.entries(tool.parameters)) {
    const value = parameters[paramName];
    
    // Verificar parámetros requeridos
    if (paramConfig.required && (value === undefined || value === null || value === '')) {
      errors.push(`Parámetro requerido faltante: ${paramName}`);
      continue;
    }
    
    // Si el parámetro no es requerido y no está presente, continuar
    if (!paramConfig.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Validar tipo
    if (paramConfig.type === 'string' && typeof value !== 'string') {
      errors.push(`${paramName} debe ser una cadena de texto`);
    }
    
    if (paramConfig.type === 'integer' && (!Number.isInteger(value) || value < 0)) {
      errors.push(`${paramName} debe ser un número entero positivo`);
    }
    
    // Validar rangos para enteros
    if (paramConfig.type === 'integer' && typeof value === 'number') {
      if (paramConfig.min !== undefined && value < paramConfig.min) {
        errors.push(`${paramName} debe ser mayor o igual a ${paramConfig.min}`);
      }
      if (paramConfig.max !== undefined && value > paramConfig.max) {
        errors.push(`${paramName} debe ser menor o igual a ${paramConfig.max}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Obtiene el estado general del MCP Server
 * @returns {Object} Estado del servidor
 */
async function getServerStatus() {
  try {
    const status = {
      server_name: 'ExtractorW MCP Server',
      version: '1.0.0',
      status: 'running',
      available_tools: Object.keys(AVAILABLE_TOOLS).length,
      tools_list: Object.keys(AVAILABLE_TOOLS),
      external_services: {}
    };

    // Verificar conectividad con ExtractorT
    try {
      const extractorTResponse = await axios.get(`${EXTRACTOR_T_URL}/status`, { timeout: 5000 });
      status.external_services.extractor_t = {
        url: EXTRACTOR_T_URL,
        status: 'connected',
        response_time: extractorTResponse.headers['x-process-time'] || 'unknown'
      };
    } catch (error) {
      status.external_services.extractor_t = {
        url: EXTRACTOR_T_URL,
        status: 'disconnected',
        error: error.message
      };
    }

    console.log('📊 Estado del MCP Server obtenido');
    return status;
  } catch (error) {
    console.error('❌ Error obteniendo estado MCP:', error);
    throw error;
  }
}

/**
 * Ejecuta la herramienta resolve_twitter_handle: resuelve nombres a handles de Twitter
 * @param {string} name - Nombre de la persona a buscar
 * @param {string} context - Contexto adicional
 * @param {string} sector - Sector específico
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultado de la resolución del handle
 */
async function executeResolveTwitterHandle(name, context = '', sector = '', user = null) {
  try {
    console.log(`🔍 Ejecutando resolve_twitter_handle MCP: "${name}" (contexto: "${context}", sector: "${sector}")`);
    
    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar resolve_twitter_handle');
    }
    
    // PASO 1: Intentar primero con Perplexity (más actualizado)
    console.log(`🔍 Paso 1: Buscando handle con Perplexity: "${name}"`);
    
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (PERPLEXITY_API_KEY) {
      try {
        const perplexityResult = await searchHandleWithPerplexity(name, context, sector);
        if (perplexityResult.success) {
          console.log(`✅ Handle encontrado con Perplexity: "${name}" → @${perplexityResult.handle}`);
          
          // Guardar en PulsePolitics
          await saveHandleToPulsePolitics(name, perplexityResult.handle, context, sector, 'perplexity_search');
          
          return {
            success: true,
            resolved_username: perplexityResult.handle,
            confidence: 0.9,
            method: 'perplexity_search',
            original_name: name,
            context_provided: context,
            sector_provided: sector,
            raw_response: perplexityResult.raw_response,
            saved_to_pulsepolitics: true
          };
        }
      } catch (error) {
        console.log(`⚠️ Perplexity falló, intentando con GPT-4o: ${error.message}`);
      }
    }
    
    // PASO 2: Usar web search para verificar información real
    console.log(`🔍 Paso 2: Buscando handle con web search verificado: "${name}"`);
    
    try {
      const webSearchResult = await searchHandleWithWebSearch(name, context, sector);
      if (webSearchResult.success) {
        console.log(`✅ Handle encontrado con web search: "${name}" → @${webSearchResult.handle}`);
        
        // Guardar en PulsePolitics
        await saveHandleToPulsePolitics(name, webSearchResult.handle, context, sector, 'web_search');
        
        return {
          success: true,
          resolved_username: webSearchResult.handle,
          confidence: 0.85,
          method: 'web_search',
          original_name: name,
          context_provided: context,
          sector_provided: sector,
          raw_response: webSearchResult.raw_response,
          saved_to_pulsepolitics: true
        };
      }
    } catch (error) {
      console.log(`⚠️ Web search falló, usando GPT-4o como último recurso: ${error.message}`);
    }
    
    // PASO 3: Fallback a GPT-4o SOLO como último recurso (con advertencia)
    console.log(`🔍 Paso 3: ÚLTIMO RECURSO - GPT-4o (puede no ser preciso): "${name}"`);
    
    const searchQuery = `ADVERTENCIA: Este es un último recurso. Busca información sobre "${name}"${context ? ` (${context})` : ''}${sector ? ` del sector ${sector}` : ''} en Guatemala y su posible handle de Twitter/X. Responde SOLO el @handle si tienes certeza, o NONE si no estás seguro.`;
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no configurada para resolución de handles');
    }

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres un investigador especializado en encontrar handles oficiales de Twitter/X de personas públicas, especialmente de Guatemala.

CASOS ESPECÍFICOS IMPORTANTES:
- Bernardo Arévalo de León (Presidente de Guatemala 2024-2028): Su handle oficial es @BArevalodeLeon
- Es importante ser preciso con los handles oficiales de políticos guatemaltecos

INSTRUCCIONES PARA BÚSQUEDA DINÁMICA:
1. Usa tu conocimiento actualizado para buscar el handle oficial de la persona
2. Para políticos guatemaltecos, verifica cargos actuales (2024-2025)
3. Prioriza cuentas verificadas y oficiales
4. Considera variaciones del nombre (nombres completos, apodos, títulos)
5. Si encuentras el handle oficial, responde EXACTAMENTE: @handle
6. Si NO existe cuenta o no puedes encontrarla, responde EXACTAMENTE: NONE
7. NO agregues explicaciones, solo el handle o NONE

CONTEXTO GEOGRÁFICO: Guatemala, Centroamérica
ENFOQUE: Personas públicas, políticos, funcionarios, figuras relevantes
FORMATO RESPUESTA: @handle o NONE (exactamente así, sin texto adicional)`
        },
        {
          role: 'user',
          content: searchQuery
        }
      ],
      temperature: 0.1,
      max_tokens: 20
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error en API de OpenAI: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Respuesta inválida de OpenAI API');
    }

    let rawResponse = data.choices[0].message.content?.trim() || '';
    console.log(`📝 Respuesta de GPT-4o: "${rawResponse}"`);
    
    // Extraer handle de la respuesta
    let resolvedHandle = null;
    let confidence = 0.5;
    
    if (rawResponse.toUpperCase() === 'NONE' || rawResponse.includes('NONE')) {
      console.log(`❌ No se encontró handle de Twitter para "${name}"`);
      return {
        success: false,
        error: `No se encontró cuenta de Twitter para "${name}"`,
        resolved_username: null,
        confidence: 0,
        method: 'gpt4o_search'
      };
    }
    
    // Extraer handle usando regex mejorado
    const handlePattern = /@([a-zA-Z0-9_]+)/;
    const urlPattern = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i;
    
    let handleMatch = rawResponse.match(handlePattern);
    if (!handleMatch) {
      handleMatch = rawResponse.match(urlPattern);
    }
    
    if (handleMatch) {
      resolvedHandle = handleMatch[1];
      confidence = 0.95; // Mayor confianza con GPT-4o 
      console.log(`✅ Handle resuelto con GPT-4o: "${name}" → @${resolvedHandle}`);
      
      // GUARDAR AUTOMÁTICAMENTE EN PULSEPOLITICS
      await saveHandleToPulsePolitics(name, resolvedHandle, context, sector, 'gpt4o_search');
      
    } else {
      console.log(`⚠️ No se pudo extraer handle de: "${rawResponse}"`);
      return {
        success: false,
        error: `No se pudo extraer handle válido de la respuesta`,
        resolved_username: null,
        confidence: 0,
        method: 'gpt4o_search',
        raw_response: rawResponse
      };
    }
    
    return {
      success: true,
      resolved_username: resolvedHandle,
      confidence: confidence,
      method: 'gpt4o_search',
      original_name: name,
      context_provided: context,
      sector_provided: sector,
      raw_response: rawResponse,
      saved_to_pulsepolitics: true
    };

  } catch (error) {
    console.error(`❌ Error ejecutando resolve_twitter_handle MCP:`, error);
    return {
      success: false,
      error: error.message,
      resolved_username: null,
      confidence: 0,
      method: 'error'
    };
  }
}

/**
 * Obtiene tweets recientes de un usuario específico usando Nitter CON ANÁLISIS DE SENTIMIENTO
 * @param {string} username - Nombre de usuario sin @
 * @param {number} limit - Número máximo de tweets
 * @param {boolean} include_retweets - Incluir retweets
 * @param {boolean} include_replies - Incluir replies
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Respuesta con tweets del usuario y análisis completo
 */
async function executeNitterProfile(username, limit = 10, include_retweets = false, include_replies = false, user) {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Procesando nitter_profile: "@${username}" (límite: ${limit})`);
    
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado - se requiere autenticación para nitter_profile');
    }
    
    // ✅ USAR FUNCIÓN COMPLETA CON ANÁLISIS DE SENTIMIENTO
    const sessionId = `nitter_profile_mcp_${Date.now()}`;
    const result = await processNitterProfile(
      username.replace('@', ''), // Remover @ si existe
      user.id,
      sessionId,
      limit,
      include_retweets,
      include_replies
    );
    
    if (result.success) {
      console.log(`✅ Procesamiento completo de @${username}: ${result.data.tweets_found} tweets con análisis de sentimiento`);
      
      // Formatear respuesta para compatibilidad MCP/Vizta
      const formattedTweets = result.data.tweets?.map(tweet => ({
        id: tweet.tweet_id || tweet.id,
        text: tweet.texto,
        author: tweet.usuario,
        date: tweet.fecha,
        metrics: {
          likes: tweet.likes || 0,
          retweets: tweet.retweets || 0,
          replies: tweet.replies || 0
        },
        url: tweet.enlace,
        is_retweet: false,
        is_reply: false,
        // 🧠 CAMPOS DE ANÁLISIS DE IA (¡Ahora disponibles!)
        sentimiento: tweet.sentimiento,
        score_sentimiento: tweet.score_sentimiento,
        intencion_comunicativa: tweet.intencion_comunicativa,
        entidades_mencionadas: tweet.entidades_mencionadas,
        engagement: tweet.engagement,
        categoria: tweet.categoria
      })) || [];
      
      return {
        success: true,
        username: username,
        profile_info: result.data.profile_info || {},
        tweets: formattedTweets,
        tweets_count: result.data.tweets_found,
        execution_time: Date.now() - startTime,
        source: 'nitter_profile_with_sentiment',
        
        // Información de guardado en Supabase (ya incluida en processNitterProfile)
        supabase_saved: true,
        supabase_saved_count: result.data.tweets_saved,
        profile_link: `https://twitter.com/${username.replace('@', '')}`,
        
        // Métricas de análisis de IA
        analytics: {
          categoria: result.data.categoria,
          detected_group: result.data.detected_group,
          total_engagement: result.data.total_engagement,
          avg_engagement: result.data.avg_engagement,
          sentiment_analysis: true,
          ai_processing: true
        },
        
        metadata: {
          include_retweets: include_retweets,
          include_replies: include_replies,
          requested_limit: limit,
          actual_results: result.data.tweets_found,
          sentiment_analysis_included: true,
          processing_method: 'complete_nitter_profile_service'
        }
      };
    } else {
      throw new Error(result.error || 'Error procesando perfil con análisis de sentimiento');
    }
    
  } catch (error) {
    console.error(`❌ Error procesando perfil @${username}:`, error.message);
    
    return {
      success: false,
      username: username,
      error: error.message,
      tweets: [],
      tweets_count: 0,
      execution_time: Date.now() - startTime,
      source: 'nitter_profile_with_sentiment',
      metadata: {
        error_type: 'processing_error',
        processing_method: 'complete_nitter_profile_service'
      }
    };
  }
}

/**
 * Buscar handle usando Perplexity con capacidades web
 */
async function searchHandleWithPerplexity(name, context = '', sector = '') {
  try {
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    const searchQuery = `Busca el handle oficial de Twitter/X de "${name}"${context ? ` (${context})` : ''}${sector ? ` del sector ${sector}` : ''} en Guatemala. Verifica en fuentes oficiales, sitios web gubernamentales, medios de comunicación y perfiles verificados de Twitter/X. Es CRÍTICO que sea el handle REAL y ACTUAL.`;
    
    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `Eres un investigador especializado en encontrar handles REALES y ACTUALES de Twitter/X de figuras públicas guatemaltecas.

INSTRUCCIONES CRÍTICAS:
1. Busca ÚNICAMENTE en fuentes oficiales: sitios web gubernamentales, medios verificados, perfiles oficiales de Twitter/X
2. Verifica que la cuenta esté ACTIVA y sea OFICIAL (verificada si es posible)
3. Para políticos: busca en sitios oficiales del gobierno, comunicados de prensa oficiales
4. Para el Presidente de Guatemala: busca en el sitio presidencial oficial (presidencia.gob.gt)
5. Verifica que el handle coincida con el nombre real de la persona
6. Si encuentras el handle OFICIAL y VERIFICADO, responde EXACTAMENTE: @handle
7. Si NO encuentras una cuenta oficial verificable, responde EXACTAMENTE: NONE
8. NO inventes handles, NO uses aproximaciones

FORMATO: @handle o NONE (sin explicaciones)`
        },
        {
          role: 'user',
          content: searchQuery
        }
      ],
      temperature: 0.0,
      max_tokens: 30
    };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content?.trim() || '';
    
    if (rawResponse.toUpperCase() === 'NONE' || rawResponse.includes('NONE')) {
      return { success: false, raw_response: rawResponse };
    }
    
    const handlePattern = /@([a-zA-Z0-9_]+)/;
    const handleMatch = rawResponse.match(handlePattern);
    
    if (handleMatch) {
      return {
        success: true,
        handle: handleMatch[1],
        raw_response: rawResponse
      };
    }
    
    return { success: false, raw_response: rawResponse };
    
  } catch (error) {
    console.error(`❌ Error en búsqueda Perplexity:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar handle usando múltiples estrategias de búsqueda web
 */
async function searchHandleWithWebSearch(name, context = '', sector = '') {
  try {
    console.log(`🔍 Iniciando búsqueda web avanzada para: "${name}"`);
    
    // ESTRATEGIA 1: Búsqueda con múltiples términos específicos
    const searchQueries = [
      `"${name}" Twitter Guatemala @`,
      `"${name}" X.com Guatemala perfil`,
      `${name} Guatemala twitter handle @`,
      `"${name}" cuenta oficial Twitter Guatemala`,
      `${name} Guatemala redes sociales @`
    ];
    
    for (const query of searchQueries) {
      console.log(`🔍 Probando query: ${query}`);
      
      const result = await performPerplexityWebSearch(query, name);
      if (result.success) {
        console.log(`✅ Handle encontrado con query "${query}": @${result.handle}`);
        return result;
      }
      
      // Esperar 500ms entre queries para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // ESTRATEGIA 2: Búsqueda por contexto profesional si está disponible
    if (context || sector) {
      const contextQuery = `"${name}"${context ? ` ${context}` : ''}${sector ? ` ${sector}` : ''} Guatemala Twitter @`;
      console.log(`🔍 Probando query contextual: ${contextQuery}`);
      
      const contextResult = await performPerplexityWebSearch(contextQuery, name);
      if (contextResult.success) {
        console.log(`✅ Handle encontrado con contexto: @${contextResult.handle}`);
        return contextResult;
      }
    }
    
    return { success: false, error: 'No se encontró handle válido después de múltiples intentos' };
    
  } catch (error) {
    console.error(`❌ Error en web search:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Realizar búsqueda con Perplexity optimizada para web search
 */
async function performPerplexityWebSearch(query, originalName) {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY no disponible');
  }
  
  const payload = {
    model: 'sonar',
    messages: [
      {
        role: 'system',
        content: `Eres un investigador especializado en encontrar información verificable de Twitter/X.

TAREA: Buscar el handle oficial de Twitter/X de la persona mencionada.

PROCESO:
1. Busca en fuentes web actuales (noticias, perfiles oficiales, sitios web)
2. Verifica que sea la persona correcta comparando información
3. Extrae ÚNICAMENTE el @handle si lo encuentras en fuentes confiables
4. Si no encuentras información verificable, responde NONE

REGLAS CRÍTICAS:
- Solo responde si encuentras el handle en fuentes web reales
- NO inventes ni adivines handles
- NO uses información que no puedas verificar
- Formato: @handle o NONE (sin explicaciones)`
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.0,
    max_tokens: 20
  };

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const rawResponse = data.choices[0].message.content?.trim() || '';
  
  console.log(`📝 Perplexity response: "${rawResponse}"`);
  
  // Procesar respuesta
  if (rawResponse.toUpperCase() === 'NONE' || rawResponse.includes('NONE') || !rawResponse.includes('@')) {
    return { success: false, error: 'No se encontró handle válido' };
  }
  
  // Extraer handle
  const handlePattern = /@([a-zA-Z0-9_]+)/;
  const handleMatch = rawResponse.match(handlePattern);
  
  if (handleMatch) {
    const foundHandle = handleMatch[1];
    
    // Verificación básica: el handle debe tener sentido para el nombre
    const nameParts = originalName.toLowerCase().split(' ');
    const handleLower = foundHandle.toLowerCase();
    
    // Al menos una parte del nombre debe estar relacionada con el handle
    const isReasonable = nameParts.some(part => 
      handleLower.includes(part) || 
      part.includes(handleLower.substring(0, 4)) ||
      // Para nombres compuestos como "Karin Herrera" → "KarinHerreraGT"
      handleLower.includes(part.substring(0, 4))
    );
    
    if (isReasonable) {
      return {
        success: true,
        handle: foundHandle,
        raw_response: rawResponse,
        query_used: query
      };
    } else {
      console.log(`⚠️ Handle "${foundHandle}" no parece relacionado con "${originalName}"`);
      return { success: false, error: 'Handle encontrado no relacionado con el nombre' };
    }
  }
  
  return { success: false, error: 'No se pudo extraer handle de la respuesta' };
}

/**
 * Guardar handle en PulsePolitics
 */
async function saveHandleToPulsePolitics(name, handle, context = '', sector = '', method = 'unknown') {
  try {
    console.log(`💾 Guardando handle resuelto en PulsePolitics: "${name}" → @${handle}`);
    
    const lauraMemoryClient = require('./lauraMemoryClient');
    
    if (lauraMemoryClient) {
      const saveResult = await lauraMemoryClient.saveUserDiscovery(
        name,
        handle,
        `${context ? context + ' - ' : ''}${sector ? sector + ' - ' : ''}Resuelto con ${method}`,
        sector || 'general'
      );
      
      if (saveResult) {
        console.log(`✅ Handle guardado exitosamente en PulsePolitics: "${name}" → @${handle}`);
      } else {
        console.log(`⚠️ No se pudo guardar en PulsePolitics (servicio no disponible)`);
      }
    }
  } catch (saveError) {
    console.warn(`⚠️ Error guardando en PulsePolitics:`, saveError.message);
  }
}

module.exports = {
  listAvailableTools,
  getToolInfo,
  executeTool,
  executeNitterContext,
  executePerplexitySearch,
  executeUserProjects,
  executeUserCodex,
  executeProjectDecisions,
  executeResolveTwitterHandle,
  executeNitterProfile,
  getServerStatus,
  expandSearchTerms,
  enhanceSearchTermsWithPerplexity,
  AVAILABLE_TOOLS
}; 