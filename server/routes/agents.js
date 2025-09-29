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
    const { instructions, siteMap, existingAgent } = req.body;
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

    // Generate extraction code using AI
    const codeGeneration = await generateExtractionCode(instructions, siteMap, existingAgent);

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

    console.log(`✅ Extracción completada exitosamente para ${url}`);

    return res.json({
      success: true,
      data: extractionResult,
      timestamp: new Date().toISOString(),
      execution_type: config.generated ? 'ai_generated' : 'basic'
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
 * Generate extraction code using AI (Gemini + GPT-5)
 */
async function generateExtractionCode(instructions, siteMap, existingAgent = null) {
  // Stage 1: Use Gemini for initial analysis and planning
  const analysisResult = await analyzeWithGemini(instructions, siteMap, existingAgent);

  // Stage 2: Use GPT-4 via OpenAI for detailed code generation
  const codeResult = await generateCodeWithGPT4(analysisResult, instructions, siteMap);

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
    metadata: {
      analysisModel: 'gemini-2.5-flash',
      codeGenModel: 'gpt-4o',
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Stage 1: Analysis with Gemini
 */
async function analyzeWithGemini(instructions, siteMap, existingAgent) {
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analiza estas instrucciones para crear un agente de extracción inteligente.

INFORMACIÓN DEL SITIO:
- Nombre: ${siteMap.site_name}
- URL Base: ${siteMap.base_url}
- Estructura conocida: ${JSON.stringify(siteMap.site_structure, null, 2)}
- Resumen de navegación: ${siteMap.navigation_summary || 'No disponible'}

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
async function generateCodeWithGPT4(analysis, instructions, siteMap) {
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

INSTRUCCIONES ORIGINALES:
"""
${instructions}
"""

GENERA:
1. Lógica de extracción detallada (algoritmo paso a paso)
2. Selectores CSS específicos para cada elemento
3. Flujo de trabajo completo (navegación + extracción)
4. Manejo de errores y casos edge

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

    // Execute using our custom JavaScript agent execution engine
    const result = await agentExecutor.executeAgent({
      url,
      config,
      site_structure,
      maxItems: maxItems || 30,
      user,
      agentName: config.suggestedName || 'AI_Generated_Agent',
      databaseConfig
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
    // Use our custom JavaScript engine for basic agents too
    const result = await agentExecutor.executeAgent({
      url,
      config: { ...config, generated: false }, // Mark as non-AI generated
      site_structure,
      maxItems: maxItems || 30,
      user,
      agentName: config.name || 'Basic_Agent',
      databaseConfig
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

module.exports = router;