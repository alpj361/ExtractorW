const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { verifyUserAccess } = require('../middlewares/auth');

// Initialize Gemini
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

  // Stage 2: Use GPT-5 via OpenRouter for detailed code generation
  const codeResult = await generateCodeWithGPT5(analysisResult, instructions, siteMap);

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
      codeGenModel: 'gpt-5',
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
 * Stage 2: Code generation with GPT-5
 */
async function generateCodeWithGPT5(analysis, instructions, siteMap) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!openRouterKey) {
    throw new Error('OpenRouter API key no configurada para GPT-5');
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

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5',
      messages,
      temperature: 0.1,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No se recibió respuesta de GPT-5');
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
      openrouter: !!process.env.OPENROUTER_API_KEY
    };

    return res.json({
      success: true,
      message: 'Servicio de generación de agentes configurado',
      services,
      endpoints: [
        'POST /api/agents/generate-agent-code - Generar código de extracción con IA',
        'POST /api/agents/analyze-site-structure - Análisis mejorado de estructura del sitio'
      ],
      aiModels: {
        analysis: 'gemini-2.5-flash',
        codeGeneration: 'gpt-5'
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

module.exports = router;