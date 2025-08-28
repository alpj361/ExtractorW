const express = require('express');
const router = express.Router();

/**
 * WebAgent Proxy Service
 * Permite al frontend acceder al WebAgent a través de ExtractorW
 */

// Configuración inteligente para desarrollo vs producción
const WEBAGENT_URL = process.env.WEBAGENT_URL || 
  (process.env.DOCKER_ENV === 'true' ? 'http://webagent:8787' : 'http://127.0.0.1:8787');

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

module.exports = router;
