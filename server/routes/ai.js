const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { verifyUserAccess } = require('../middlewares/auth');
const supabase = require('../utils/supabase');

// Inicializar Gemini
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/ai/generate-description
 * Genera descripción de contenido usando Gemini AI
 */
router.post('/generate-description', verifyUserAccess, async (req, res) => {
  try {
    const { url, transcription, type = 'tweet_description' } = req.body;
    const user = req.user;

    if (!url && !transcription) {
      return res.status(400).json({ error: 'URL o transcripción es requerida' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key no configurada' });
    }

    const sourceInfo = transcription ? `transcripción: ${transcription.substring(0, 200)}...` : `URL: ${url}`;
    console.log(`🤖 Usuario ${user.profile.email} solicitando descripción basada en ${transcription ? 'transcripción' : 'URL'}`);

    // Configurar modelo Gemini
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Crear prompt diferente según si tenemos transcripción o solo URL
    let prompt;
    
    if (transcription) {
      // Prompt para generar descripción basada en transcripción
      prompt = `Analiza la siguiente transcripción de un audio/video de X (Twitter) y genera una descripción concisa y útil.

TRANSCRIPCIÓN:
"""
${transcription}
"""

INSTRUCCIONES:
1. Identifica el tema principal y los puntos clave mencionados
2. Describe el tipo de contenido (entrevista, opinión, noticia, explicación, etc.)
3. Menciona si hay datos importantes, nombres relevantes o información específica
4. Mantén un tono profesional y objetivo
5. Máximo 150 caracteres para que sea útil como descripción

FORMATO DE RESPUESTA:
Solo devuelve la descripción en texto plano, sin JSON ni formateo adicional.

Ejemplos de buenas descripciones:
- "Entrevista sobre políticas públicas con datos estadísticos y propuestas específicas"
- "Explicación detallada del proceso electoral guatemalteco con ejemplos prácticos"
- "Análisis político sobre declaraciones presidenciales con contexto histórico"

Genera una descripción similar basada en la transcripción proporcionada.`;
    } else {
      // Prompt original para analizar URL directamente
      prompt = `Analiza el siguiente enlace de X (Twitter) y genera una descripción concisa y útil basada en su contenido.

URL: ${url}

INSTRUCCIONES:
1. Si es un tweet, describe el tema principal, contexto y relevancia
2. Si contiene multimedia (imágenes, videos), menciónalo brevemente
3. Identifica el tipo de contenido (opinión, noticia, información, etc.)
4. Mantén un tono profesional y objetivo
5. Máximo 150 caracteres para que sea útil como descripción

FORMATO DE RESPUESTA:
Solo devuelve la descripción en texto plano, sin JSON ni formateo adicional.

Ejemplos de buenas descripciones:
- "Hilo informativo sobre políticas públicas en Guatemala con datos estadísticos"
- "Video explicativo sobre proceso electoral, incluye infografías"
- "Opinión de analista político sobre recientes declaraciones presidenciales"

Genera una descripción similar para el enlace proporcionado.`;
    }

    console.log('🎯 Enviando solicitud a Gemini...');

    // Llamar a Gemini
    const result = await model.generateContent(prompt);
    const description = result.response.text().trim();

    console.log(`✅ Descripción generada: "${description.substring(0, 50)}..."`);

    return res.json({
      success: true,
      description: description,
      url: url || 'N/A',
      type: type,
      source: transcription ? 'transcription' : 'url',
      metadata: {
        model: 'gemini-2.5-flash',
        timestamp: new Date().toISOString(),
        user_id: user.id,
        character_count: description.length,
        transcription_length: transcription ? transcription.length : 0
      }
    });

  } catch (error) {
    console.error('❌ Error generando descripción:', error);
    
    return res.status(500).json({
      error: 'Error al generar descripción',
      message: error.message,
      url: req.body.url
    });
  }
});

/**
 * GET /api/ai/test
 * Endpoint de prueba para verificar configuración
 */
router.get('/test', verifyUserAccess, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Gemini API key no configurada',
        configured: false
      });
    }

    return res.json({
      success: true,
      message: 'Servicio de IA configurado correctamente',
      configured: true,
      model: 'gemini-2.5-flash',
      endpoints: [
        'POST /api/ai/generate-description - Generar descripción de contenido'
      ]
    });

  } catch (error) {
    console.error('❌ Error en test de IA:', error);
    return res.status(500).json({
      error: 'Error en servicio de IA',
      message: error.message
    });
  }
});

module.exports = router; 