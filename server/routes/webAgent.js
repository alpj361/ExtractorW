const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini for AI-enhanced exploration
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * WebAgent Proxy Service
 * Permite al frontend acceder al WebAgent a través de ExtractorW
 */

// Configuración inteligente para desarrollo vs producción
const WEBAGENT_URL = process.env.WEBAGENT_URL || 
  (process.env.DOCKER_ENV === 'true' ? 'http://webagent:8787' : 'http://127.0.0.1:8787');

/**
 * Endpoint de prueba simple
 * GET /api/webagent/test
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'WebAgent test endpoint working',
    timestamp: new Date().toISOString()
  });
});

/**
 * Proxy para extracción heurística usando mapa del sitio
 * POST /api/webagent/extract
 */
router.post('/extract', async (req, res) => {
  console.log('🔍 WebAgent Extract solicitado:', {
    url: req.body?.url,
    extraction_target: req.body?.extraction_target,
    has_site_structure: !!req.body?.site_structure,
    maxSteps: req.body?.maxSteps
  });
  
  try {
    const { url, extraction_target, site_structure, maxSteps = 8 } = req.body || {};

    // Validaciones mínimas
    if (!url || !extraction_target) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "url" y "extraction_target"'
      });
    }

    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'invalid_url',
        message: 'La URL proporcionada no es válida'
      });
    }

    // Construir payload compatible con WebAgent
    const payload = {
      url,
      goal: extraction_target, // WebAgent usa "goal" como campo principal
      maxSteps: Math.min(Math.max(maxSteps, 1), 10), // WebAgent limita a 10 pasos máximo
      screenshot: true, // Incluir screenshots para debug
      // Campos adicionales para contexto heurístico
      site_structure: site_structure || null,
      strategy: 'heuristic'
    };

    // Intentar endpoints disponibles del WebAgent (en orden de preferencia)
    const executorCandidates = [
      `${WEBAGENT_URL}/scrape/agent`,    // Scraping completo con agente
      `${WEBAGENT_URL}/scrape/execute`,  // Ejecución de plan específico
      `${WEBAGENT_URL}/explore/summarize` // Exploración con resumen
    ];

    let lastError = null;
    for (const endpoint of executorCandidates) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          lastError = { status: response.status, statusText: response.statusText, error: errorData };
          continue; // probar siguiente candidato
        }

        const result = await response.json();
        return res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        lastError = { message: err?.message || String(err) };
        // intentar siguiente endpoint
      }
    }

    // Si todos fallaron
    return res.status(502).json({
      error: 'executor_unavailable',
      message: 'No fue posible contactar al ejecutor heurístico del WebAgent',
      details: lastError
    });
  } catch (error) {
    console.error('❌ Error en WebAgent Extract:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * AI-Enhanced exploration with intelligent site analysis
 * POST /api/webagent/explore-ai
 */
router.post('/explore-ai', async (req, res) => {
  try {
    console.log('🤖 AI-Enhanced WebAgent Explorer solicitado:', {
      url: req.body.url,
      goal: req.body.goal,
      maxSteps: req.body.maxSteps
    });

    const { url, goal, maxSteps = 3, screenshot = false } = req.body;

    if (!url || !goal) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "url" y "goal"'
      });
    }

    // Validar URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'invalid_url',
        message: 'La URL proporcionada no es válida'
      });
    }

    // Step 1: Regular WebAgent exploration
    const explorationResult = await performBasicExploration(url, goal, maxSteps, screenshot);

    // Step 2: AI-powered analysis of the exploration results
    let aiAnalysis = null;
    if (explorationResult.success && process.env.GEMINI_API_KEY) {
      try {
        aiAnalysis = await analyzeExplorationWithAI(url, goal, explorationResult.data);
      } catch (aiError) {
        console.warn('⚠️ AI analysis failed, proceeding with basic exploration:', aiError.message);
      }
    }

    // Step 3: Combine results
    const enhancedResult = {
      ...explorationResult,
      aiAnalysis: aiAnalysis || null,
      enhanced: !!aiAnalysis,
      timestamp: new Date().toISOString()
    };

    if (aiAnalysis) {
      console.log('✅ AI-Enhanced WebAgent Explorer completado exitosamente');
    } else {
      console.log('✅ WebAgent Explorer completado (sin análisis IA)');
    }

    res.json(enhancedResult);

  } catch (error) {
    console.error('❌ Error en AI-Enhanced WebAgent:', error);

    res.status(500).json({
      error: 'enhanced_exploration_failed',
      message: 'Error en exploración mejorada con IA',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Proxy para el endpoint /explore/summarize del WebAgent
 * POST /api/webagent/explore
 */
router.post('/explore', async (req, res) => {
  try {
    console.log('🔍 WebAgent Explorer solicitado:', {
      url: req.body.url,
      goal: req.body.goal,
      maxSteps: req.body.maxSteps
    });

    // Validar entrada
    const { url, goal, maxSteps = 3, screenshot = false } = req.body;
    
    if (!url || !goal) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Se requieren "url" y "goal"'
      });
    }

    // Validar URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'invalid_url',
        message: 'La URL proporcionada no es válida'
      });
    }

    // Llamar al WebAgent
    const response = await fetch(`${WEBAGENT_URL}/explore/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        goal,
        maxSteps: Math.min(Math.max(maxSteps, 1), 10), // Entre 1 y 10
        screenshot
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error del WebAgent:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return res.status(response.status).json({
        error: 'webagent_error',
        message: errorData.message || 'Error al comunicarse con WebAgent',
        details: errorData
      });
    }

    const result = await response.json();
    
    console.log('✅ WebAgent Explorer completado exitosamente');
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en WebAgent Proxy:', error);
    
    // Determinar tipo de error
    let errorMessage = 'Error interno del servidor';
    let errorType = 'internal_error';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'WebAgent no está disponible. Verifique que el servicio esté ejecutándose.';
      errorType = 'service_unavailable';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Error de red al conectar con WebAgent';
      errorType = 'network_error';
    }

    res.status(500).json({
      error: errorType,
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});



/**
 * Proxy para verificar salud del WebAgent
 * GET /api/webagent/health
 */
router.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${WEBAGENT_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(503).json({
        error: 'webagent_unhealthy',
        message: 'WebAgent no responde correctamente',
        status: response.status
      });
    }

    const result = await response.json();
    
    res.json({
      success: true,
      webagent_status: result,
      proxy_status: 'healthy',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error al verificar salud de WebAgent:', error);
    
    res.status(503).json({
      error: 'webagent_unavailable',
      message: 'No se puede conectar con WebAgent',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Obtener información sobre el WebAgent
 * GET /api/webagent/info
 */
router.get('/info', (req, res) => {
  res.json({
    service: 'WebAgent Proxy',
    description: 'Proxy para acceder al WebAgent Explorer desde ExtractorW',
    webagent_url: WEBAGENT_URL,
    endpoints: {
      'POST /api/webagent/explore': 'Explora una URL con objetivos específicos',
      'POST /api/webagent/extract': 'Ejecuta extracción heurística usando mapa del sitio',
      'GET /api/webagent/health': 'Verifica la salud del WebAgent',
      'GET /api/webagent/info': 'Información sobre este servicio'
    },
    example_usage: {
      url: 'https://example.com',
      goal: 'Necesito buscar "iniciativas"',
      maxSteps: 3,
      screenshot: false
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Helper function: Perform basic WebAgent exploration
 */
async function performBasicExploration(url, goal, maxSteps, screenshot) {
  const response = await fetch(`${WEBAGENT_URL}/explore/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      goal,
      maxSteps: Math.min(Math.max(maxSteps, 1), 10),
      screenshot
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`WebAgent error: ${response.status} - ${errorData.message || 'Unknown error'}`);
  }

  const result = await response.json();

  return {
    success: true,
    data: result
  };
}

/**
 * Helper function: AI-powered analysis of exploration results
 */
async function analyzeExplorationWithAI(url, goal, explorationData) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analiza los resultados de esta exploración web y genera insights inteligentes para la creación de agentes de extracción.

URL EXPLORADA: ${url}
OBJETIVO ORIGINAL: ${goal}

DATOS DE EXPLORACIÓN:
${JSON.stringify(explorationData, null, 2)}

ANÁLISIS REQUERIDO:
1. Identifica el tipo de sitio web y su estructura general
2. Detecta elementos extraíbles y patrones de datos
3. Evalúa la complejidad de navegación requerida
4. Sugiere selectores CSS probables para elementos importantes
5. Identifica oportunidades de extracción de datos
6. Recomienda estrategias de scraping específicas

FORMATO DE RESPUESTA (JSON válido):
{
  "siteAnalysis": {
    "type": "tipo de sitio (ej: e-commerce, noticias, blog)",
    "structure": "descripción de la estructura",
    "complexity": "low|medium|high",
    "navigationRequired": true/false
  },
  "extractableElements": [
    {
      "name": "nombre del elemento",
      "description": "descripción",
      "suggestedSelectors": ["selector1", "selector2"],
      "dataType": "text|image|link|number",
      "importance": "high|medium|low"
    }
  ],
  "scrapingStrategies": [
    {
      "strategy": "nombre de la estrategia",
      "description": "descripción detallada",
      "steps": ["paso1", "paso2", "paso3"],
      "difficulty": "low|medium|high"
    }
  ],
  "recommendations": [
    "recomendación 1",
    "recomendación 2"
  ],
  "confidence": 0.9,
  "insights": "insights adicionales y observaciones"
}

Responde solo con el JSON válido, sin texto adicional.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  try {
    // Clean response if it has markdown code blocks
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error('Error parsing AI analysis response:', parseError);
    console.log('Raw AI response:', responseText);

    // Fallback response
    return {
      siteAnalysis: {
        type: "sitio web general",
        structure: "estructura no identificada",
        complexity: "medium",
        navigationRequired: false
      },
      extractableElements: [
        {
          name: "contenido general",
          description: "elementos de contenido del sitio",
          suggestedSelectors: [".content", "main", "article"],
          dataType: "text",
          importance: "medium"
        }
      ],
      scrapingStrategies: [
        {
          strategy: "extracción básica",
          description: "extracción general de contenido",
          steps: ["cargar página", "extraer elementos", "procesar datos"],
          difficulty: "medium"
        }
      ],
      recommendations: [
        "verificar estructura específica del sitio",
        "ajustar selectores según contenido real"
      ],
      confidence: 0.5,
      insights: "Análisis de fallback debido a error en parsing de respuesta de IA"
    };
  }
}

module.exports = router;
