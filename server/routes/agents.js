const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { verifyUserAccess } = require('../middlewares/auth');
const { AgentExecutor } = require('../services/agentExecutor');

// Initialize Gemini and AgentExecutor
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const agentExecutor = new AgentExecutor();

/**
 * AI-Powered Agent Code Generation Service
 * Creates intelligent extraction agents using Gemini and GPT-5
 */

/**
 * POST /api/agents/generate-agent-code
 * Generate extraction code using AI based on natural language instructions
 */
router.post('/generate-agent-code', verifyUserAccess, async (req, res) => {
  try {
    const { instructions, siteMap, existingAgent, explorerInsights, selectedElement } = req.body;
    const user = req.user;

    if (!instructions || !siteMap) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "instructions" y "siteMap"'
      });
    }

    console.log(`🤖 Usuario ${user.profile.email} solicitando generación de código de agente`);
    console.log(`🎯 Sitio: ${siteMap.site_name} (${siteMap.base_url})`);
    console.log(`📝 Instrucciones: ${instructions.substring(0, 100)}...`);

    // Generate extraction code using AI with Explorer insights
    const codeGeneration = await generateExtractionCode(instructions, siteMap, existingAgent, explorerInsights, selectedElement);

    // Log successful generation
    console.log(`✅ Código generado exitosamente para ${siteMap.site_name}`);
    console.log(`🎯 Confianza: ${(codeGeneration.confidence * 100).toFixed(0)}%`);

    return res.json({
      success: true,
      data: codeGeneration,
      timestamp: new Date().toISOString(),
      metadata: {
        user_id: user.id,
        site_name: siteMap.site_name,
        instructions_length: instructions.length
      }
    });

  } catch (error) {
    console.error('❌ Error generando código de agente:', error);

    return res.status(500).json({
      error: 'generation_failed',
      message: 'Error al generar código de extracción',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/execute
 * Execute an agent with AI-generated selectors and workflow
 */
router.post('/execute', verifyUserAccess, async (req, res) => {
  try {
    const { url, config, site_structure, maxItems = 30, database_config } = req.body;
    const user = req.user;

    if (!url || !config) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "url" y "config"'
      });
    }

    console.log(`🤖 Usuario ${user.profile.email} ejecutando agente en: ${url}`);
    console.log(`🔧 Configuración generada: ${!!config.generated}`);
    console.log(`🗃️ Base de datos: ${database_config?.enabled ? 'Habilitada' : 'Deshabilitada'}`);

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'invalid_url',
        message: 'La URL proporcionada no es válida'
      });
    }

    // Execute agent based on configuration type
    let extractionResult;

    if (config.generated && config.selectors && Array.isArray(config.selectors)) {
      // Execute AI-generated agent with specific selectors
      extractionResult = await executeAIGeneratedAgent({
        url,
        config,
        site_structure,
        maxItems,
        user,
        databaseConfig: database_config
      });
    } else {
      // Fallback to basic extraction
      extractionResult = await executeBasicAgent({
        url,
        config,
        site_structure,
        maxItems,
        user,
        databaseConfig: database_config
      });
    }

    // ✅ Determinar success basado en items extraídos
    const itemsExtracted = extractionResult?.items_extracted || extractionResult?.data?.items?.length || 0;
    const actualSuccess = itemsExtracted > 0;
    
    if (actualSuccess) {
      console.log(`✅ Extracción completada exitosamente: ${itemsExtracted} items`);
    } else {
      console.log(`⚠️ Extracción completada sin items extraídos`);
    }

    return res.json({
      success: actualSuccess,  // ✅ Basado en items reales
      items_extracted: itemsExtracted,
      data: extractionResult,
      timestamp: new Date().toISOString(),
      execution_type: config.generated ? 'ai_generated' : 'basic',
      // ✅ Propagar información de diagnóstico si está disponible
      page_info: extractionResult?.page_info || null,
      diagnostic: extractionResult?.diagnostic || null
    });

  } catch (error) {
    console.error('❌ Error ejecutando agente:', error);

    return res.status(500).json({
      error: 'execution_failed',
      message: 'Error al ejecutar el agente',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/analyze-site-structure
 * Enhanced site analysis using AI for better extraction planning
 */
router.post('/analyze-site-structure', verifyUserAccess, async (req, res) => {
  try {
    const { url, goal, siteStructure } = req.body;
    const user = req.user;

    if (!url || !goal) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "url" y "goal"'
      });
    }

    console.log(`🔍 Usuario ${user.profile.email} solicitando análisis de estructura para: ${url}`);

    // Analyze site structure with AI
    const analysis = await analyzeSiteStructureWithAI(url, goal, siteStructure);

    console.log(`✅ Análisis completado para ${url}`);

    return res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error analizando estructura del sitio:', error);

    return res.status(500).json({
      error: 'analysis_failed',
      message: 'Error al analizar estructura del sitio',
      details: error.message
    });
  }
});

/**
 * Generate extraction code using AI (Gemini + GPT-5) with Explorer insights
 */
async function generateExtractionCode(instructions, siteMap, existingAgent = null, explorerInsights = null, selectedElement = null) {
  // ✅ Stage 0: Diagnose page first to determine execution mode
  console.log('🔍 Diagnosticando página antes de generar código...');
  const diagnostic = await diagnosePage(siteMap.base_url);
  
  console.log(`📊 Diagnostic results:`, {
    has_antibot: diagnostic.has_antibot,
    has_spa: diagnostic.has_spa,
    execution_mode_recommended: diagnostic.execution_mode_recommended
  });
  
  // ✅ Si requiere WebAgent, no generar código JS
  if (diagnostic.execution_mode_recommended === 'webagent') {
    console.log('🌐 Sitio requiere WebAgent - no se generará código JS');
    return {
      extractionLogic: null, // No generar JS
      selectors: null,
      workflow: null,
      confidence: 0.9,
      reasoning: `Este sitio requiere WebAgent debido a: ${diagnostic.reason}. El agente usará navegador real con Playwright.`,
      suggestedName: `${siteMap.site_name} (WebAgent)`,
      suggestedTarget: instructions,
      suggestedDescription: `Extracción usando navegador real debido a ${diagnostic.reason}`,
      execution_mode: 'webagent', // ✅ Indicar modo de ejecución
      requires_browser: true,
      diagnostic: diagnostic.diagnostic, // Información completa del diagnóstico
      metadata: {
        analysisModel: 'diagnostic_engine',
        codeGenModel: 'webagent',
        timestamp: new Date().toISOString(),
        reason: diagnostic.reason
      }
    };
  }
  
  // Stage 1: Use Gemini for initial analysis and planning with Explorer insights
  const analysisResult = await analyzeWithGemini(instructions, siteMap, existingAgent, explorerInsights, selectedElement);

  // Stage 2: Use GPT-4 via OpenAI for detailed code generation with Explorer insights
  const codeResult = await generateCodeWithGPT4(analysisResult, instructions, siteMap, explorerInsights, selectedElement);

  // Combine results
  return {
    extractionLogic: codeResult.extractionLogic,
    selectors: codeResult.selectors,
    workflow: codeResult.workflow,
    confidence: Math.min(analysisResult.confidence, codeResult.confidence),
    reasoning: `${analysisResult.reasoning}\n\n${codeResult.reasoning}`,
    suggestedName: analysisResult.suggestedName,
    suggestedTarget: analysisResult.suggestedTarget,
    suggestedDescription: analysisResult.suggestedDescription,
    execution_mode: 'sandbox', // ✅ Sandbox para sitios normales
    requires_browser: false,
    diagnostic: diagnostic.diagnostic,
    metadata: {
      analysisModel: 'gemini-2.5-flash',
      codeGenModel: 'gpt-4o',
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Diagnose page to determine execution mode
 */
async function diagnosePage(url) {
  try {
    // Hacer un fetch simple y analizar
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    const html = await response.text();
    
    // Usar el diagnostic engine del AgentExecutor
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    const pageAnalysis = agentExecutor.analyzePage(html, $, url);
    const issues = agentExecutor.detectIssues(html, pageAnalysis, []);
    
    const hasAntibot = issues.some(i => i.type === 'antibot');
    const hasSPA = issues.some(i => i.type === 'spa_dynamic_content');
    const hasEmptyPage = issues.some(i => i.type === 'empty_page');
    
    // Decidir modo de ejecución
    if (hasAntibot || hasSPA || hasEmptyPage) {
      const reason = hasAntibot 
        ? `Anti-bot Protection (${pageAnalysis.antibot_detected})`
        : hasSPA 
          ? 'SPA con contenido dinámico'
          : 'Página vacía o bloqueada';
      
      return {
        execution_mode_recommended: 'webagent',
        has_antibot: hasAntibot,
        has_spa: hasSPA,
        has_empty_page: hasEmptyPage,
        reason: reason,
        diagnostic: { issues, page_analysis: pageAnalysis }
      };
    }
    
    return {
      execution_mode_recommended: 'sandbox',
      has_antibot: false,
      has_spa: false,
      has_empty_page: false,
      reason: 'Sitio scrapeable con fetch + cheerio',
      diagnostic: { issues: [], page_analysis: pageAnalysis }
    };
    
  } catch (error) {
    console.error('Error diagnosticando página:', error.message);
    // En caso de error, asumir que requiere WebAgent
    return {
      execution_mode_recommended: 'webagent',
      has_antibot: true,
      reason: `Error al acceder: ${error.message}`,
      diagnostic: { issues: [{ type: 'fetch_error', title: error.message }] }
    };
  }
}

/**
 * Stage 1: Analysis with Gemini enhanced with Explorer insights
 */
async function analyzeWithGemini(instructions, siteMap, existingAgent, explorerInsights, selectedElement) {
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  let prompt = `Analiza estas instrucciones para crear un agente de extracción inteligente.

INFORMACIÓN DEL SITIO:
- Nombre: ${siteMap.site_name}
- URL Base: ${siteMap.base_url}
- Estructura conocida: ${JSON.stringify(siteMap.site_structure, null, 2)}
- Resumen de navegación: ${siteMap.navigation_summary || 'No disponible'}`;

  // Add Explorer insights if available
  if (explorerInsights) {
    prompt += `

🤖 ANÁLISIS AUTOMÁTICO DEL EXPLORER (IA):
- Tipo de sitio: ${explorerInsights.siteAnalysis?.type || 'No detectado'}
- Complejidad: ${explorerInsights.siteAnalysis?.complexity || 'No detectado'}
- Estructura: ${explorerInsights.siteAnalysis?.structure || 'No detectado'}
- Confianza del análisis: ${explorerInsights.confidence ? (explorerInsights.confidence * 100).toFixed(0) + '%' : 'No disponible'}`;

    if (explorerInsights.extractableElements && explorerInsights.extractableElements.length > 0) {
      prompt += `

ELEMENTOS EXTRAÍBLES DETECTADOS POR IA:`;
      explorerInsights.extractableElements.forEach((element, index) => {
        prompt += `
${index + 1}. ${element.name} (${element.dataType})
   - Descripción: ${element.description}
   - Selectores sugeridos: ${element.suggestedSelectors ? element.suggestedSelectors.join(', ') : 'No disponibles'}`;
      });
    }

    if (explorerInsights.scrapingStrategies && explorerInsights.scrapingStrategies.length > 0) {
      prompt += `

ESTRATEGIAS DE EXTRACCIÓN RECOMENDADAS:`;
      explorerInsights.scrapingStrategies.forEach((strategy, index) => {
        prompt += `
${index + 1}. ${strategy.strategy} (${strategy.difficulty})
   - ${strategy.description}
   - Pasos: ${strategy.steps ? strategy.steps.join(' → ') : 'No especificados'}`;
      });
    }

    if (explorerInsights.recommendations && explorerInsights.recommendations.length > 0) {
      prompt += `

RECOMENDACIONES DEL EXPLORER:`;
      explorerInsights.recommendations.forEach((rec, index) => {
        prompt += `
${index + 1}. ${rec}`;
      });
    }
  }

  // Add selected element specific information
  if (selectedElement) {
    prompt += `

🎯 ELEMENTO ESPECÍFICO SELECCIONADO:
- Nombre: ${selectedElement.name}
- Tipo de dato: ${selectedElement.dataType}
- Descripción: ${selectedElement.description}
- Selectores específicos: ${selectedElement.suggestedSelectors ? selectedElement.suggestedSelectors.join(', ') : 'No disponibles'}

PRIORIZA ESTE ELEMENTO EN EL ANÁLISIS.`;
  }

  prompt += `

INSTRUCCIONES DEL USUARIO:
"""
${instructions}
"""

${existingAgent ? `AGENTE EXISTENTE (para edición):
- Nombre: ${existingAgent.name}
- Objetivo actual: ${existingAgent.target}
- Configuración: ${JSON.stringify(existingAgent.config, null, 2)}
` : ''}

ANÁLISIS REQUERIDO:
1. Identifica QUÉ datos específicos necesita extraer el usuario
2. Analiza la estructura del sitio para determinar DÓNDE están esos datos
3. Evalúa la complejidad de la extracción (navegación, formularios, AJAX, etc.)
4. Sugiere nombres y descripciones para el agente
5. Identifica posibles desafíos y estrategias

FORMATO DE RESPUESTA (JSON válido):
{
  "targetElements": ["elemento1", "elemento2"],
  "extractionStrategy": "descripción de la estrategia",
  "complexity": "low|medium|high",
  "challenges": ["desafío1", "desafío2"],
  "suggestedName": "Nombre sugerido para el agente",
  "suggestedTarget": "Descripción del objetivo de extracción",
  "suggestedDescription": "Descripción de los datos que extrae",
  "confidence": 0.95,
  "reasoning": "Explicación del análisis y decisiones tomadas"
}

Responde solo con el JSON, sin texto adicional.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  try {
    // Clean response if it has markdown code blocks
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error('Error parsing Gemini response:', parseError);
    console.log('Raw response:', responseText);

    // Fallback response
    return {
      targetElements: ["datos no identificados"],
      extractionStrategy: "extracción general",
      complexity: "medium",
      challenges: ["parsing de respuesta de IA"],
      suggestedName: `Extractor ${siteMap.site_name}`,
      suggestedTarget: instructions.substring(0, 100) + "...",
      suggestedDescription: "Datos extraídos del sitio web",
      confidence: 0.5,
      reasoning: `Análisis basado en instrucciones: ${instructions}`
    };
  }
}

/**
 * Stage 2: Code generation with OpenAI GPT-4
 */
async function generateCodeWithGPT4(analysis, instructions, siteMap, explorerInsights, selectedElement) {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error('OpenAI API key no configurada para GPT-4');
  }

  const messages = [
    {
      role: "system",
      content: `Eres un experto en web scraping y automatización. Generas código de extracción preciso y robusto para agentes de scraping.

Tu trabajo es crear lógica de extracción específica basada en el análisis del sitio web y las instrucciones del usuario.

PRINCIPIOS:
- Genera selectores CSS específicos y alternativos
- Incluye manejo de errores y elementos dinámicos
- Considera la paginación y navegación necesaria
- Proporciona flujos de trabajo paso a paso
- Mantén la robustez ante cambios del sitio`
    },
    {
      role: "user",
      content: `Genera código de extracción para este escenario:

ANÁLISIS PREVIO:
${JSON.stringify(analysis, null, 2)}

SITIO WEB:
- Nombre: ${siteMap.site_name}
- URL: ${siteMap.base_url}
- Estructura: ${JSON.stringify(siteMap.site_structure, null, 2)}

${explorerInsights ? `
🤖 DATOS DEL EXPLORER IA (PRIORIZAR):
${selectedElement ? `
🎯 ELEMENTO ESPECÍFICO SELECCIONADO:
- Nombre: ${selectedElement.name}
- Tipo: ${selectedElement.dataType}
- Descripción: ${selectedElement.description}
- Selectores IA: ${selectedElement.suggestedSelectors ? selectedElement.suggestedSelectors.join(', ') : 'No disponibles'}

` : ''}
${explorerInsights.extractableElements ? `
ELEMENTOS DETECTADOS POR IA:
${explorerInsights.extractableElements.map((el, i) => `${i+1}. ${el.name} (${el.dataType}): ${el.suggestedSelectors ? el.suggestedSelectors.join(', ') : 'sin selectores'}`).join('\n')}

` : ''}
${explorerInsights.scrapingStrategies ? `
ESTRATEGIAS RECOMENDADAS:
${explorerInsights.scrapingStrategies.map((s, i) => `${i+1}. ${s.strategy} (${s.difficulty}): ${s.description}`).join('\n')}

` : ''}
${explorerInsights.recommendations ? `
RECOMENDACIONES:
${explorerInsights.recommendations.map((r, i) => `${i+1}. ${r}`).join('\n')}

` : ''}
Confianza del análisis Explorer: ${explorerInsights.confidence ? (explorerInsights.confidence * 100).toFixed(0) + '%' : 'No disponible'}
` : ''}

INSTRUCCIONES ORIGINALES:
"""
${instructions}
"""

GENERA:
1. Lógica de extracción detallada (algoritmo paso a paso)
2. Selectores CSS específicos para cada elemento
3. Flujo de trabajo completo (navegación + extracción)
4. Manejo de errores y casos edge

REGLAS CRÍTICAS PARA SELECTORES CSS:
- NUNCA uses 'span[href]' (spans no tienen href, solo <a> tags)
- Para enlaces: usa 'a[href]', 'a.clase', o 'a[href*="texto"]'
- Para texto: usa 'span', 'p', 'div', 'h1-h6' pero SIN atributos de enlace
- Para listas: usa 'ul li', 'ol li', '.lista-clase li'
- Siempre incluye selectores de respaldo más genéricos
- Valida que cada selector sea sintácticamente correcto

FORMATO DE RESPUESTA (JSON válido):
{
  "extractionLogic": "Descripción detallada del proceso de extracción paso a paso",
  "selectors": [
    "selector1: #main .product-title",
    "selector2: .price-container .current-price",
    "selector3_fallback: [data-testid='product-price']"
  ],
  "workflow": [
    "1. Navegar a la página principal",
    "2. Buscar elementos de producto",
    "3. Extraer información de cada producto",
    "4. Manejar paginación si existe"
  ],
  "errorHandling": ["verificar existencia de elementos", "timeout handling", "retry logic"],
  "confidence": 0.9,
  "reasoning": "Explicación de las decisiones técnicas tomadas"
}

Responde solo con el JSON válido.`
    }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.1,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No se recibió respuesta de GPT-4');
  }

  try {
    // Clean response if it has markdown code blocks
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(cleanedContent);
  } catch (parseError) {
    console.error('Error parsing GPT-5 response:', parseError);
    console.log('Raw response:', content);

    // Fallback response
    return {
      extractionLogic: `Extracción basada en: ${instructions}`,
      selectors: [`#main`, `.content`, `[data-content]`],
      workflow: [
        "1. Cargar página objetivo",
        "2. Esperar carga completa",
        "3. Extraer elementos según selectores",
        "4. Procesar y estructurar datos"
      ],
      errorHandling: ["verificación de elementos", "manejo de timeouts"],
      confidence: 0.6,
      reasoning: "Generación de fallback debido a error en parsing de respuesta"
    };
  }
}

/**
 * Enhanced site structure analysis with AI
 */
async function analyzeSiteStructureWithAI(url, goal, existingStructure = null) {
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analiza esta URL y objetivo para mejorar la comprensión de la estructura del sitio web.

URL: ${url}
OBJETIVO: ${goal}
ESTRUCTURA EXISTENTE: ${existingStructure ? JSON.stringify(existingStructure, null, 2) : 'No disponible'}

ANÁLISIS REQUERIDO:
1. Identifica el tipo de sitio web (e-commerce, noticias, blog, institucional, etc.)
2. Predice la estructura probable de navegación
3. Identifica elementos comunes que se pueden extraer
4. Sugiere selectores CSS probables para el objetivo
5. Evalúa la complejidad de navegación requerida

FORMATO DE RESPUESTA (JSON válido):
{
  "siteType": "tipo de sitio",
  "navigationStructure": {
    "mainSections": ["sección1", "sección2"],
    "commonElements": ["header", "footer", "sidebar"],
    "dataContainers": ["#main", ".content", ".products"]
  },
  "extractableElements": [
    {
      "element": "títulos",
      "selectors": ["h1", "h2.title", ".post-title"]
    },
    {
      "element": "contenido",
      "selectors": [".content", ".post-body", "article"]
    }
  ],
  "recommendedStrategy": "descripción de estrategia de extracción",
  "complexity": "low|medium|high",
  "confidence": 0.8,
  "suggestions": ["sugerencia1", "sugerencia2"]
}

Responde solo con el JSON válido.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  try {
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error('Error parsing site structure analysis:', parseError);

    // Fallback response
    return {
      siteType: "sitio web general",
      navigationStructure: {
        mainSections: ["contenido principal"],
        commonElements: ["header", "main", "footer"],
        dataContainers: ["#main", ".content"]
      },
      extractableElements: [
        {
          element: "contenido general",
          selectors: [".content", "main", "article"]
        }
      ],
      recommendedStrategy: "extracción general de contenido",
      complexity: "medium",
      confidence: 0.5,
      suggestions: ["verificar estructura real del sitio", "ajustar selectores según contenido específico"]
    };
  }
}

/**
 * GET /api/agents/test
 * Test endpoint for agent generation service
 */
router.get('/test', verifyUserAccess, async (req, res) => {
  try {
    const services = {
      gemini: !!process.env.GEMINI_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };

    // Get AgentExecutor health
    const agentExecutorHealth = agentExecutor.getHealth();

    return res.json({
      success: true,
      message: 'Servicio de generación y ejecución de agentes configurado',
      services,
      agentExecutor: agentExecutorHealth,
      endpoints: [
        'POST /api/agents/generate-agent-code - Generar código de extracción con IA',
        'POST /api/agents/execute - Ejecutar agente con JavaScript personalizado',
        'POST /api/agents/analyze-site-structure - Análisis mejorado de estructura del sitio'
      ],
      aiModels: {
        analysis: 'gemini-2.5-flash',
        codeGeneration: 'gpt-4o'
      },
      executionEngine: {
        type: 'custom_javascript',
        sandboxed: true,
        newscron_pattern: true,
        systemlogger_integration: true
      }
    });

  } catch (error) {
    console.error('❌ Error en test de agentes:', error);
    return res.status(500).json({
      error: 'Error en servicio de agentes',
      message: error.message
    });
  }
});

/**
 * Execute AI-generated agent with specific selectors and workflow
 */
async function executeAIGeneratedAgent({ url, config, site_structure, maxItems, user, databaseConfig }) {
  console.log('🎯 Executing AI-generated agent with selectors:', config.selectors?.slice(0, 3));

  try {
    console.log('🤖 Using custom JavaScript AgentExecutor');

    // Execute using unified execution engine
    const result = await agentExecutor.executeUnified({
      url,
      config,
      site_structure,
      maxItems: maxItems || 30,
      user,
      executionType: 'agent',
      agentName: config.suggestedName || 'AI_Generated_Agent'
    });

    console.log(`✅ Custom agent execution completed: ${result.items_extracted} items extracted`);

    return {
      url,
      extraction_type: 'ai_generated_javascript',
      selectors_used: config.selectors?.length || 0,
      items_extracted: result.items_extracted,
      confidence: result.confidence,
      data: result.data,
      metadata: {
        ai_generated: true,
        instructions: config.instructions,
        generation_date: config.generatedAt,
        execution_date: new Date().toISOString(),
        custom_javascript_used: true,
        execution_id: result.executionId,
        execution_time_ms: result.metadata?.execution_time_ms
      }
    };

  } catch (error) {
    console.warn('⚠️ Custom JavaScript agent execution failed:', error.message);
    console.log('🔄 Falling back to basic extraction...');

    // Fallback to basic extraction if custom execution fails
    return await executeBasicAgentFallback({ url, config, site_structure, maxItems, user, databaseConfig });
  }
}

/**
 * Execute basic agent with fallback extraction
 */
async function executeBasicAgent({ url, config, site_structure, maxItems, user, databaseConfig }) {
  console.log('📝 Executing basic agent with custom JavaScript');

  try {
    // Use unified execution engine for basic agents too
    const result = await agentExecutor.executeUnified({
      url,
      config: { ...config, generated: false }, // Mark as non-AI generated
      site_structure,
      maxItems: maxItems || 30,
      user,
      executionType: 'agent',
      agentName: config.name || 'Basic_Agent'
    });

    console.log(`✅ Basic agent execution completed: ${result.items_extracted} items extracted`);

    return {
      url,
      extraction_type: 'basic_javascript',
      items_extracted: result.items_extracted,
      confidence: result.confidence,
      data: result.data,
      metadata: {
        ai_generated: false,
        execution_date: new Date().toISOString(),
        custom_javascript_used: true,
        execution_id: result.executionId,
        execution_time_ms: result.metadata?.execution_time_ms
      }
    };

  } catch (error) {
    console.warn('⚠️ Basic JavaScript agent execution failed:', error.message);
    console.log('🔄 Falling back to WebAgent...');

    // Final fallback to WebAgent
    return await executeBasicAgentFallback({ url, config, site_structure, maxItems, user, databaseConfig });
  }
}

/**
 * Fallback extraction using WebAgent
 */
async function executeBasicAgentFallback({ url, config, site_structure, maxItems, user, databaseConfig }) {
  console.log('🔄 Using WebAgent fallback extraction');

  // For basic agents, we can delegate to WebAgent
  const WEBAGENT_URL = process.env.WEBAGENT_URL ||
    (process.env.DOCKER_ENV === 'true' ? 'http://webagent:8787' : 'http://127.0.0.1:8787');

  try {
    // Try WebAgent first
    const response = await fetch(`${WEBAGENT_URL}/explore/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        goal: config.extraction_target || config.instructions || 'Extracción general de contenido',
        maxSteps: 5,
        screenshot: false
      })
    });

    if (response.ok) {
      const webAgentResult = await response.json();

      return {
        url,
        extraction_type: 'basic_webagent',
        items_extracted: 1,
        confidence: 0.6,
        data: [{
          text: webAgentResult.summary || 'Contenido extraído',
          source: 'webagent',
          timestamp: new Date().toISOString()
        }],
        metadata: {
          ai_generated: false,
          webagent_used: true,
          execution_date: new Date().toISOString()
        }
      };
    } else {
      console.warn(`⚠️ WebAgent responded with ${response.status}`);
    }
  } catch (webAgentError) {
    console.warn('⚠️ WebAgent fallback failed:', webAgentError.message);
  }

  // Final fallback: return basic structure with error info
  return {
    url,
    extraction_type: 'basic_error_fallback',
    items_extracted: 0,
    confidence: 0.1,
    data: [{
      text: `No se pudo extraer contenido de ${url}`,
      type: 'error',
      timestamp: new Date().toISOString(),
      error: 'Todos los métodos de extracción fallaron'
    }],
    metadata: {
      ai_generated: false,
      fallback_used: true,
      all_methods_failed: true,
      execution_date: new Date().toISOString()
    }
  };
}

/**
 * POST /api/agents/test-existing
 * Test an existing agent directly without code modification
 */
router.post('/test-existing', verifyUserAccess, async (req, res) => {
  try {
    const { agent_id, url, config = {} } = req.body;
    const user = req.user;

    if (!agent_id) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requiere "agent_id"'
      });
    }

    console.log(`🚀 Usuario ${user.profile.email} probando agente existente`);
    console.log(`🎯 Agent ID: ${agent_id}`);
    console.log(`🔗 URL: ${url || 'URL por defecto del agente'}`);

    // Fetch agent from database
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: agent, error: fetchError } = await supabase
      .from('site_agents')
      .select(`
        *,
        site_maps (*)
      `)
      .eq('id', agent_id)
      .single();

    if (fetchError || !agent) {
      return res.status(404).json({
        error: 'agent_not_found',
        message: 'Agente no encontrado'
      });
    }

    // Verify user owns this agent or has access
    if (agent.user_id !== user.id) {
      return res.status(403).json({
        error: 'access_denied',
        message: 'No tienes acceso a este agente'
      });
    }

    // Extract the agent's code
    let agentScript = '';
    if (agent.extraction_config?.extractionLogic && agent.extraction_config?.generated) {
      agentScript = agent.extraction_config.extractionLogic;
    } else if (agent.extraction_target) {
      // Check if extraction_target contains JavaScript code
      if (agent.extraction_target.includes('document.querySelector') ||
          agent.extraction_target.includes('querySelectorAll') ||
          agent.extraction_target.includes('return ')) {
        agentScript = agent.extraction_target;
      } else {
        return res.status(400).json({
          error: 'no_executable_code',
          message: 'Este agente no tiene código JavaScript ejecutable. Genera código primero en la pestaña IA Generativa.'
        });
      }
    } else {
      return res.status(400).json({
        error: 'no_code_available',
        message: 'Este agente no tiene código de extracción disponible'
      });
    }

    // Use the agent's site URL if no URL provided
    const testUrl = url || agent.site_maps?.base_url;
    if (!testUrl) {
      return res.status(400).json({
        error: 'no_url_available',
        message: 'No hay URL disponible para probar. Proporciona una URL.'
      });
    }

    // Create execution context for agent test
    const testConfig = {
      url: testUrl,
      script: agentScript,
      maxItems: config.maxItems || 50,
      timeout: config.timeout || 45000,
      debug: true,
      agent_id: agent_id,
      agent_name: agent.agent_name
    };

    console.log(`📝 Script length: ${agentScript.length} chars`);
    console.log(`🎯 Testing URL: ${testUrl}`);

    // Execute the agent script using unified execution engine
    const result = await agentExecutor.executeUnified({
      url: testUrl,
      script: agentScript,
      maxItems: testConfig.maxItems,
      timeout: testConfig.timeout,
      user,
      executionType: 'test',
      agentName: agent.agent_name
    });

    // Add agent metadata to result
    result.agent_metadata = {
      agent_id: agent.id,
      agent_name: agent.agent_name,
      site_name: agent.site_maps?.site_name,
      extraction_target: agent.extraction_target,
      code_source: agent.extraction_config?.generated ? 'generated' : 'manual'
    };

    console.log(`✅ Agent test executed. Success: ${result.success}`);
    if (result.success && result.data?.items) {
      console.log(`📊 Items extracted: ${result.data.items.length}`);
    }

    return res.json({
      success: result.success,
      items_extracted: result.items_extracted || (result.data?.items?.length || 0),
      data: result.data || null,
      error: result.error || null,
      details: result.details || null,
      logs: result.logs || [],
      metrics: result.metrics || {},
      status: result.status || 'completed',
      // ✅ Propagar diagnóstico y página
      page_info: result.page_info || null,
      diagnostic: result.diagnostic || null,
      agent_metadata: result.agent_metadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error testing existing agent:', error);
    return res.status(500).json({
      success: false,
      error: 'agent_test_failed',
      message: 'Error probando agente existente',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/debug-script
 * Execute a debug script directly in a sandboxed environment for testing
 */
router.post('/debug-script', verifyUserAccess, async (req, res) => {
  try {
    const { script, url, config = {} } = req.body;
    const user = req.user;

    if (!script || !url) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "script" y "url"'
      });
    }

    console.log(`🐛 Usuario ${user.profile.email} ejecutando script de debug`);
    console.log(`🎯 URL: ${url}`);
    console.log(`📝 Script length: ${script.length} chars`);

    // Create execution context for debug
    const debugConfig = {
      url,
      script,
      maxItems: config.maxItems || 10,
      timeout: config.timeout || 30000,
      debug: true
    };

    // Execute the debug script using unified execution engine
    const result = await agentExecutor.executeUnified({
      url,
      script,
      maxItems: debugConfig.maxItems,
      timeout: debugConfig.timeout,
      user,
      executionType: 'debug',
      agentName: 'Debug Script'
    });

    console.log(`✅ Debug script executed. Success: ${result.success}`);
    if (result.success && result.data?.items) {
      console.log(`📊 Items extracted: ${result.data.items.length}`);
    }

    return res.json({
      success: result.success,
      items_extracted: result.items_extracted || (result.data?.items?.length || 0),
      data: result.data || null,
      error: result.error || null,
      details: result.details || null,
      logs: result.logs || [],
      metrics: result.metrics || {},
      status: result.status || 'completed',
      // ✅ Propagar diagnóstico y página
      page_info: result.page_info || null,
      diagnostic: result.diagnostic || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error executing debug script:', error);
    return res.status(500).json({
      success: false,
      error: 'debug_execution_failed',
      message: 'Error ejecutando script de debug',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/generate-debug-script
 * Generate a debug script based on natural language instructions
 */
router.post('/generate-debug-script', verifyUserAccess, async (req, res) => {
  try {
    const { instructions, url, siteMap } = req.body;
    const user = req.user;

    if (!instructions) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "instructions"'
      });
    }

    console.log(`🤖 Usuario ${user.profile.email} generando script de debug`);
    console.log(`📝 Instrucciones: ${instructions.substring(0, 100)}...`);

    // Generate debug script using AI
    const debugScript = await generateDebugScript(instructions, url, siteMap);

    console.log(`✅ Debug script generado exitosamente`);

    return res.json({
      success: true,
      data: {
        script: debugScript.script,
        explanation: debugScript.explanation,
        confidence: debugScript.confidence
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating debug script:', error);
    return res.status(500).json({
      success: false,
      error: 'debug_generation_failed',
      message: 'Error generando script de debug',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/improve-code
 * Use AI to improve existing JavaScript code based on execution results
 */
router.post('/improve-code', verifyUserAccess, async (req, res) => {
  try {
    const { code, results, url, error_message, improvement_type = 'general', diagnostic } = req.body;
    const user = req.user;

    if (!code) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requiere "code"'
      });
    }

    console.log(`🤖 Usuario ${user.profile.email} solicitando mejora de código`);
    console.log(`🔧 Tipo de mejora: ${improvement_type}`);
    
    // ✅ Log diagnostic context if available
    if (diagnostic) {
      console.log(`📊 Diagnóstico disponible:`, {
        has_antibot: diagnostic.has_antibot,
        has_spa: diagnostic.has_spa,
        has_empty_page: diagnostic.has_empty_page,
        issues_count: diagnostic.issues?.length || 0
      });
    }

    // ✅ Generar código directamente según diagnóstico (sin IA por ahora)
    let improvement;
    
    if (diagnostic?.has_antibot) {
      // Anti-bot detectado: sugerir usar WebAgent
      console.log(`🔒 Anti-bot detectado - recomendando WebAgent`);
      
      improvement = {
        improved_code: `// ⚠️ SITIO CON PROTECCIÓN ANTI-BOT DETECTADA
// Este sitio requiere un navegador real (WebAgent/Puppeteer)
// 
// SOLUCIÓN: Configura este agente para usar WebAgent:
// 1. En la configuración del agente, cambia el modo a "browser" o "webagent"
// 2. O usa el endpoint /api/webagent/extract directamente
//
// Código de respaldo (probablemente retornará vacío):

const items = [];

try {
  // Selectores genéricos
  const elementos = document.querySelectorAll('table tbody tr, .item, article, .card, [class*="list"]');
  
  console.log('⚠️ Anti-bot detectado - HTML puede estar vacío');
  console.log('Elementos encontrados:', elementos.length);
  
  elementos.forEach((el, index) => {
    const titulo = el.querySelector('h1, h2, h3, .title, .titulo, [class*="title"]')?.textContent?.trim();
    const enlace = el.querySelector('a')?.href || el.closest('a')?.href;
    
    if (titulo || enlace) {
      items.push({
        index: index + 1,
        titulo: titulo || 'Sin título',
        enlace: enlace
      });
    }
  });
  
  if (items.length === 0) {
    console.log('❌ Sin contenido extraído');
    console.log('💡 SOLUCIÓN: Configurar agente con modo "browser"');
    console.log('📖 Ver: WEBAGENT_DEPLOYMENT_GUIDE.md');
  }
  
} catch (error) {
  console.error('Error:', error.message);
}

return items;`,
        explanation: `⚠️ ANTI-BOT DETECTADO (${diagnostic.page_info?.size_bytes} bytes de HTML vacío). Este agente necesita WebAgent con navegador real. El código actual NO funcionará. ACCIÓN REQUERIDA: Configura el agente para usar modo "browser" o llama a /api/webagent/extract.`,
        changes: [
          '❌ Anti-bot detectado - scraping directo imposible',
          '📝 Agregado código de respaldo con selectores genéricos',
          '💡 Incluidas instrucciones para configurar WebAgent',
          '🔧 Recomendación: usar modo "browser" en el agente'
        ],
        confidence: 0.3,
        suggestions: [
          '🚨 CRÍTICO: Configurar agente con modo "browser"',
          '🌐 Usar endpoint /api/webagent/extract para este sitio',
          '📖 Consultar WEBAGENT_DEPLOYMENT_GUIDE.md',
          '⚠️ El código actual retornará 0 items',
          '✅ WebAgent bypaseará la protección anti-bot'
        ]
      };
    } else {
      // Sitio normal o con errores: usar IA
      console.log(`🤖 Llamando a IA para optimizar código...`);
      improvement = await improveCodeWithAI(code, results, url, error_message, improvement_type, diagnostic);
    }

    console.log(`✅ Código mejorado generado exitosamente`);
    console.log(`📝 Explicación: ${improvement.explanation}`);
    console.log(`🔧 Cambios: ${improvement.changes?.join(', ')}`);
    console.log(`💬 Sugerencias: ${improvement.suggestions?.join(', ')}`);
    console.log(`📄 Código (preview): ${improvement.improved_code?.substring(0, 150)}...`);

    return res.json({
      success: true,
      data: {
        improved_code: improvement.improved_code,
        explanation: improvement.explanation,
        changes: improvement.changes,
        confidence: improvement.confidence,
        suggestions: improvement.suggestions || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error improving code:', error);
    return res.status(500).json({
      success: false,
      error: 'code_improvement_failed',
      message: 'Error mejorando código',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/explain-error
 * Use AI to explain JavaScript execution errors and suggest fixes
 */
router.post('/explain-error', verifyUserAccess, async (req, res) => {
  try {
    const { code, error_message, url, logs = [] } = req.body;
    const user = req.user;

    if (!code || !error_message) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "code" y "error_message"'
      });
    }

    console.log(`🤖 Usuario ${user.profile.email} solicitando explicación de error`);
    console.log(`❌ Error: ${error_message.substring(0, 100)}`);

    // Explain error using AI
    const explanation = await explainErrorWithAI(code, error_message, url, logs);

    console.log(`✅ Explicación de error generada exitosamente`);

    return res.json({
      success: true,
      data: {
        explanation: explanation.explanation,
        probable_cause: explanation.probable_cause,
        suggested_fix: explanation.suggested_fix,
        fixed_code: explanation.fixed_code,
        confidence: explanation.confidence
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error explaining error:', error);
    return res.status(500).json({
      success: false,
      error: 'error_explanation_failed',
      message: 'Error explicando error',
      details: error.message
    });
  }
});

/**
 * Improve JavaScript code using AI based on results and context
 */
async function improveCodeWithAI(code, results, url, errorMessage, improvementType, diagnostic = null) {
  // ✅ Construir contexto del diagnóstico
  let diagnosticSection = '';
  if (diagnostic && diagnostic.issues && diagnostic.issues.length > 0) {
    diagnosticSection = `
📊 DIAGNÓSTICO DEL PROBLEMA:
${diagnostic.issues.map((issue, idx) => `
${idx + 1}. ${issue.title} [${issue.severity}]
   - ${issue.description}
   ${issue.suggestions ? `
   Sugerencias específicas:
   ${issue.suggestions.map((s, i) => `   ${i + 1}. ${s}`).join('\n')}
   ` : ''}
`).join('\n')}

⚠️ PROBLEMAS DETECTADOS:
${diagnostic.has_antibot ? '🔒 Anti-bot Protection detectado - El scraping simple NO funcionará' : ''}
${diagnostic.has_spa ? '⚡ SPA/Contenido dinámico - Requiere ejecución de JavaScript' : ''}
${diagnostic.has_empty_page ? '📄 Página vacía o bloqueada - Verificar acceso' : ''}

Información de la página:
- Tamaño HTML: ${diagnostic.page_info?.size_bytes || 'N/A'} bytes
- Contenido texto: ${diagnostic.page_info?.size_text || 'N/A'} bytes
- Tiene contenido: ${diagnostic.page_info?.has_content ? 'Sí' : 'No'}
`;
  }

  const prompt = `Mejora este código JavaScript para web scraping basándote en los resultados de ejecución y el diagnóstico:

CÓDIGO ACTUAL:
\`\`\`javascript
${code}
\`\`\`

URL OBJETIVO: ${url || 'No especificada'}
TIPO DE MEJORA: ${improvementType}

${results ? `
RESULTADOS DE EJECUCIÓN:
- Éxito: ${results.success}
- Items extraídos: ${results.data?.items?.length || 0}
- Tiempo de ejecución: ${results.metrics?.execution_time_ms || 'N/A'}ms
` : ''}

${errorMessage ? `
ERROR ENCONTRADO:
${errorMessage}
` : ''}

${diagnosticSection}

CONTEXTO TÉCNICO:
- El código se ejecuta en un SANDBOX con cheerio/jsdom
- Tienes acceso a: document, querySelector, querySelectorAll, console, $
- NO tienes acceso a: require, puppeteer, fetch, window (limitado)
- El HTML ya fue descargado con fetch() por el sistema

INSTRUCCIONES - SIEMPRE GENERA CÓDIGO EJECUTABLE:

${diagnostic?.has_antibot ? `
🔒 ANTI-BOT DETECTADO - GENERA EL MEJOR CÓDIGO POSIBLE:

El sitio tiene protección anti-bot (${diagnostic.page_info?.size_bytes} bytes de HTML vacío).
El scraping directo NO funcionará PERO:

1. GENERA código válido para el sandbox que intente extraer lo que pueda
2. INCLUYE en los comentarios que el sitio requiere WebAgent/Browser mode
3. USA selectores genéricos que podrían funcionar si el HTML tuviera contenido

EJEMPLO:

\`\`\`javascript
// ⚠️ NOTA: Este sitio tiene protección anti-bot (${diagnostic.page_info?.size_bytes} bytes).
// Para scraping real, configura WebAgent o modo Browser en el agente.
// Este código intentará extraer lo que encuentre:

const items = [];

try {
  // Selectores genéricos que buscan contenido común
  const elementos = document.querySelectorAll('table tbody tr, .item, article, [class*="card"]');
  
  console.log(\`Encontrados \${elementos.length} elementos\`);
  
  elementos.forEach((el, index) => {
    const titulo = el.querySelector('h1, h2, h3, .title, [class*="titulo"]')?.textContent?.trim();
    const enlace = el.querySelector('a')?.href;
    const fecha = el.querySelector('[class*="fecha"], [class*="date"], time')?.textContent?.trim();
    
    if (titulo || enlace) {
      items.push({
        index: index + 1,
        titulo: titulo || 'Sin título',
        enlace: enlace,
        fecha: fecha,
        _nota: 'Extraído con anti-bot presente - puede estar vacío'
      });
    }
  });
  
  if (items.length === 0) {
    console.log('⚠️ Página bloqueada por anti-bot. Configure WebAgent para scraping real.');
  }
  
} catch (error) {
  console.error('Error:', error.message);
}

return items;
\`\`\`

REGLAS:
- USA solo document.querySelector(), NO puppeteer
- NO uses require() o import
- Genera selectores CSS robustos y genéricos
- Incluye logging para debugging
- Menciona en comentarios que necesita WebAgent
` : ''}

${diagnostic?.has_spa ? `
⚡ SPA/CONTENIDO DINÁMICO - GENERA CÓDIGO CON ESPERAS:

El sitio carga contenido con JavaScript. El código debe:
1. Esperar a que los elementos aparezcan
2. Usar selectores correctos
3. Manejar contenido que carga dinámicamente

Incluye await page.waitForSelector() y timeouts apropiados.
` : ''}

${!diagnostic?.has_antibot && !diagnostic?.has_spa ? `
✅ SITIO SCRAPEBLE - OPTIMIZA SELECTORES:
1. Mejorar selectores CSS para mayor precisión
2. Añadir fallbacks y validaciones
3. Mejorar manejo de errores
4. Añadir más campos si es necesario
` : ''}

REGLAS CRÍTICAS:
- SIEMPRE genera código JavaScript válido para el SANDBOX
- USA solo: document, querySelector, querySelectorAll, console, $
- NO uses: require, import, puppeteer, fetch, async/await, window.fetch
- NO generes código Node.js standalone
- Incluye try/catch y logging con console.log()
- Retorna array de items al final con: return items;
- Si hay errores de sintaxis, CORRÍGELOS

Responde SOLO con JSON válido (sin formato markdown):
{
  "improved_code": "código JavaScript para sandbox (sin require/import)",
  "explanation": "explicación clara de las mejoras",
  "changes": ["cambio 1", "cambio 2"],
  "confidence": 0.9,
  "suggestions": ["sugerencia 1", "sugerencia 2"]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();

    // Try to parse JSON response
    try {
      return JSON.parse(aiResponse);
    } catch {
      // If JSON parsing fails, create a structured response
      return {
        improved_code: extractCodeFromResponse(aiResponse),
        explanation: 'Código mejorado por IA',
        changes: ['Optimización general del código'],
        confidence: 0.7,
        suggestions: ['Revisar y probar el código mejorado']
      };
    }

  } catch (error) {
    console.error('Error improving code with AI:', error);
    throw new Error(`Error mejorando código: ${error.message}`);
  }
}

/**
 * Explain JavaScript execution errors using AI
 */
async function explainErrorWithAI(code, errorMessage, url, logs) {
  const prompt = `Analiza este error de JavaScript y proporciona una explicación clara y una solución:

CÓDIGO:
\`\`\`javascript
${code}
\`\`\`

ERROR:
${errorMessage}

URL: ${url || 'No especificada'}

${logs.length > 0 ? `
LOGS:
${logs.join('\n')}
` : ''}

Analiza el error y responde en formato JSON:
{
  "explanation": "explicación clara del error en español",
  "probable_cause": "causa más probable del error",
  "suggested_fix": "sugerencia específica para arreglar el error",
  "fixed_code": "código corregido si es posible",
  "confidence": 0.9
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();

    // Try to parse JSON response
    try {
      return JSON.parse(aiResponse);
    } catch {
      return {
        explanation: aiResponse,
        probable_cause: 'Error en el código JavaScript',
        suggested_fix: 'Revisar los selectores CSS y la lógica del código',
        fixed_code: null,
        confidence: 0.5
      };
    }

  } catch (error) {
    console.error('Error explaining error with AI:', error);
    throw new Error(`Error explicando error: ${error.message}`);
  }
}

/**
 * Extract JavaScript code from AI response
 */
function extractCodeFromResponse(response) {
  // Look for JavaScript code blocks
  const codeMatch = response.match(/```(?:javascript)?\n?([\s\S]*?)```/);
  if (codeMatch) {
    return codeMatch[1].trim();
  }

  // If no code blocks found, return the response as-is
  return response;
}

/**
 * Generate a debug script using AI based on instructions
 */
async function generateDebugScript(instructions, url, siteMap) {
  const prompt = `Genera un script JavaScript para extraer datos de una página web basado en estas instrucciones:

INSTRUCCIONES:
${instructions}

URL OBJETIVO: ${url || 'No especificada'}
SITIO: ${siteMap?.site_name || 'No especificado'} (${siteMap?.base_url || 'No especificado'})

GENERA un script JavaScript que:
1. Encuentre elementos en la página usando selectores CSS
2. Extraiga la información solicitada
3. Retorne un array de objetos con los datos
4. Incluya manejo de errores básico
5. Use selectores CSS válidos (NO spans con href)

REGLAS PARA EL SCRIPT:
- Usa document.querySelectorAll() para encontrar elementos
- Valida que los elementos existen antes de extraer datos
- Usa ?.textContent?.trim() para texto seguro
- Incluye al menos 2-3 selectores de respaldo
- Retorna un array de objetos con la estructura esperada
- Incluye console.log() para debug

EJEMPLO DE ESTRUCTURA:
const items = [];
const elements = document.querySelectorAll('SELECTOR_PRINCIPAL');

elements.forEach(element => {
  const data = {
    // Campos extraídos aquí
  };

  if (data.CAMPO_PRINCIPAL) {
    items.push(data);
  }
});

return items;

Responde solo con el código JavaScript, sin explicaciones adicionales.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const script = data.choices[0].message.content.trim();

    // Clean the script (remove markdown code blocks if present)
    const cleanScript = script
      .replace(/```javascript\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return {
      script: cleanScript,
      explanation: 'Script generado automáticamente basado en las instrucciones proporcionadas',
      confidence: 0.8
    };

  } catch (error) {
    console.error('Error generating debug script:', error);
    throw new Error(`Error generando script: ${error.message}`);
  }
}

module.exports = router;