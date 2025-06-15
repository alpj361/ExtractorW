const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { checkCredits, debitCredits } = require('../middlewares/credits');
const { 
  construirContextoCompleto,
  obtenerContextoAdicionalPerplexity,
  procesarSondeoConChatGPT
} = require('../services/sondeos');

/**
 * Rutas de Sondeos - Implementación modular
 * Basado en la funcionalidad original de migration.js
 */

/**
 * POST /api/sondeo - Endpoint principal para procesar sondeos
 * Requiere autenticación y verificación de créditos
 */
router.post('/sondeo', verifyUserAccess, checkCredits, debitCredits, async (req, res) => {
  try {
    console.log('🎯 Iniciando procesamiento de sondeo');
    console.log('Usuario:', req.user.profile.email);
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));

    // Validar datos de entrada
    const { pregunta, selectedContexts, configuracion = {} } = req.body;

    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length === 0) {
      return res.status(400).json({
        error: 'Pregunta requerida',
        message: 'Debes proporcionar una pregunta válida para el sondeo'
      });
    }

    if (!selectedContexts || !Array.isArray(selectedContexts) || selectedContexts.length === 0) {
      return res.status(400).json({
        error: 'Contextos requeridos',
        message: 'Debes seleccionar al menos un contexto (tendencias, tweets, noticias, codex)'
      });
    }

    // Validar contextos permitidos
    const contextosPermitidos = ['tendencias', 'tweets', 'noticias', 'codex'];
    const contextosInvalidos = selectedContexts.filter(ctx => !contextosPermitidos.includes(ctx));
    
    if (contextosInvalidos.length > 0) {
      return res.status(400).json({
        error: 'Contextos inválidos',
        message: `Contextos no válidos: ${contextosInvalidos.join(', ')}. Permitidos: ${contextosPermitidos.join(', ')}`
      });
    }

    console.log(`📝 Pregunta: "${pregunta}"`);
    console.log(`📊 Contextos seleccionados: ${selectedContexts.join(', ')}`);

    // FASE 1: Construir contexto completo
    console.log('🔨 Fase 1: Construyendo contexto completo...');
    const contextoCompleto = await construirContextoCompleto(selectedContexts);

    if (contextoCompleto.estadisticas.fuentes_con_datos === 0) {
      return res.status(404).json({
        error: 'Sin datos disponibles',
        message: 'No se encontraron datos en las fuentes seleccionadas',
        contextos_consultados: selectedContexts,
        estadisticas: contextoCompleto.estadisticas
      });
    }

    // FASE 2: Obtener contexto adicional con Perplexity
    console.log('🔍 Fase 2: Obteniendo contexto adicional con Perplexity...');
    const contextoAdicional = await obtenerContextoAdicionalPerplexity(pregunta, contextoCompleto);

    // FASE 3: Procesar con ChatGPT 4o
    console.log('🤖 Fase 3: Procesando con ChatGPT 4o...');
    
    // Calcular costo basado en el contexto
    const { calculateSondeoCost } = require('../middlewares/credits');
    const costoCalculado = calculateSondeoCost(contextoCompleto);
    
    const configuracionCompleta = {
      ...configuracion,
      costo_calculado: costoCalculado,
      usuario: req.user.profile.email,
      timestamp: new Date().toISOString()
    };

    const resultadoFinal = await procesarSondeoConChatGPT(
      pregunta, 
      contextoCompleto, 
      configuracionCompleta
    );

    // FASE 4: Preparar respuesta final
    const respuestaCompleta = {
      success: true,
      sondeo: {
        pregunta,
        contextos_utilizados: selectedContexts,
        timestamp: new Date().toISOString(),
        usuario: req.user.profile.email
      },
      contexto: {
        estadisticas: contextoCompleto.estadisticas,
        fuentes_utilizadas: contextoCompleto.fuentes_utilizadas,
        contexto_adicional: contextoAdicional
      },
      resultado: resultadoFinal,
      creditos: {
        costo_total: costoCalculado,
        creditos_restantes: req.user.profile.credits - costoCalculado
      },
      metadata: {
        procesado_en: new Date().toISOString(),
        version: '2.0',
        modelo_ia: 'ChatGPT-4o + Perplexity'
      }
    };

    console.log('✅ Sondeo procesado exitosamente');
    console.log(`💳 Costo total: ${costoCalculado} créditos`);

    res.json(respuestaCompleta);

  } catch (error) {
    console.error('❌ Error procesando sondeo:', error);
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error procesando el sondeo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sondeo/contextos - Lista los contextos disponibles
 */
router.get('/sondeo/contextos', verifyUserAccess, async (req, res) => {
  try {
    const contextosDisponibles = [
      {
        id: 'tendencias',
        nombre: 'Tendencias de Twitter',
        descripcion: 'Tendencias actuales de Twitter para Guatemala',
        fuente: 'tabla trends',
        activo: true
      },
      {
        id: 'tweets',
        nombre: 'Tweets Trending',
        descripcion: 'Tweets populares y con alto engagement',
        fuente: 'tabla trending_tweets',
        activo: true
      },
      {
        id: 'noticias',
        nombre: 'Noticias',
        descripcion: 'Noticias recientes de medios guatemaltecos',
        fuente: 'tabla news',
        activo: true
      },
      {
        id: 'codex',
        nombre: 'Documentos Codex',
        descripcion: 'Base de conocimiento y documentos almacenados',
        fuente: 'tabla codex',
        activo: true
      }
    ];

    res.json({
      success: true,
      contextos: contextosDisponibles,
      total: contextosDisponibles.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo contextos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo contextos disponibles'
    });
  }
});

/**
 * GET /api/sondeo/costo - Calcula el costo estimado de un sondeo
 */
router.post('/sondeo/costo', verifyUserAccess, async (req, res) => {
  try {
    const { selectedContexts } = req.body;

    if (!selectedContexts || !Array.isArray(selectedContexts)) {
      return res.status(400).json({
        error: 'Contextos requeridos',
        message: 'Debes proporcionar los contextos para calcular el costo'
      });
    }

    // Construir contexto simulado para calcular costo
    const contextoSimulado = await construirContextoCompleto(selectedContexts);
    
    const { calculateSondeoCost } = require('../middlewares/credits');
    const costoEstimado = calculateSondeoCost(contextoSimulado);

    res.json({
      success: true,
      costo_estimado: costoEstimado,
      contextos_seleccionados: selectedContexts,
      estadisticas_contexto: contextoSimulado.estadisticas,
      creditos_disponibles: req.user.profile.credits,
      puede_procesar: req.user.profile.credits >= costoEstimado,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error calculando costo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error calculando costo del sondeo'
    });
  }
});

/**
 * GET /api/sondeo/estadisticas - Estadísticas de uso de sondeos
 */
router.get('/sondeo/estadisticas', verifyUserAccess, async (req, res) => {
  try {
    const supabase = require('../utils/supabase');
    
    // Obtener estadísticas de uso del usuario
    const { data: usageLogs, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('endpoint', '/api/sondeo')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error obteniendo estadísticas:', error);
      return res.status(500).json({
        error: 'Error obteniendo estadísticas',
        message: error.message
      });
    }

    const estadisticas = {
      usuario: req.user.profile.email,
      total_sondeos: usageLogs?.length || 0,
      creditos_gastados: usageLogs?.reduce((acc, log) => acc + (log.credits_used || 0), 0) || 0,
      ultimo_sondeo: usageLogs?.[0]?.created_at || null,
      creditos_disponibles: req.user.profile.credits,
      historial_reciente: usageLogs?.slice(0, 5).map(log => ({
        fecha: log.created_at,
        creditos_usados: log.credits_used,
        detalles: log.request_details
      })) || []
    };

    res.json({
      success: true,
      estadisticas,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo estadísticas de sondeos'
    });
  }
});

module.exports = router; 