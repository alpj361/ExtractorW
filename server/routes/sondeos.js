const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { checkCredits } = require('../middlewares/credits');
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
router.post('/api/sondeo', verifyUserAccess, checkCredits, async (req, res) => {
  try {
    console.log('🎯 INICIO: Procesando sondeo');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 Usuario:', req.user.profile.email);
    
    const { pregunta, selectedContexts, contextos, configuracion = {} } = req.body;
    
    // Aceptar tanto selectedContexts como contextos para compatibilidad
    const contextosFinales = selectedContexts || contextos;

    // FASE 1: Validación de entrada
    console.log('🎯 FASE 1: Validación de entrada');
    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length < 3) {
      console.log('❌ FASE 1 falló: Pregunta inválida');
      return res.status(400).json({
        error: 'Pregunta requerida',
        message: 'La pregunta debe tener al menos 3 caracteres'
      });
    }

    if (!contextosFinales || !Array.isArray(contextosFinales) || contextosFinales.length === 0) {
      console.log('❌ FASE 1 falló: Contextos inválidos');
      return res.status(400).json({
        error: 'Contextos requeridos',
        message: 'Debes seleccionar al menos un contexto'
      });
    }

    const contextosValidos = ['tendencias', 'tweets', 'noticias', 'codex'];
    const contextosInvalidos = contextosFinales.filter(ctx => !contextosValidos.includes(ctx));
    
    if (contextosInvalidos.length > 0) {
      console.log('❌ FASE 1 falló: Contextos no válidos:', contextosInvalidos);
      return res.status(400).json({
        error: 'Contextos inválidos',
        message: `Contextos no válidos: ${contextosInvalidos.join(', ')}`
      });
    }
    
    console.log('✅ FASE 1 completada: Validación exitosa');
    console.log(`📝 Pregunta: "${pregunta}"`);
    console.log(`📊 Contextos seleccionados: ${contextosFinales.join(', ')}`);

    // FASE 2: Construir contexto completo
    console.log('🔨 FASE 2: Construyendo contexto completo...');
    const contextoCompleto = await construirContextoCompleto(contextosFinales);
    console.log('✅ FASE 2 completada. Estadísticas:', contextoCompleto.estadisticas);

    if (contextoCompleto.estadisticas.fuentes_con_datos === 0) {
      console.log('❌ FASE 2 falló: Sin datos disponibles');
      return res.status(404).json({
        error: 'Sin datos disponibles',
        message: 'No se encontraron datos en las fuentes seleccionadas',
        contextos_consultados: contextosFinales,
        estadisticas: contextoCompleto.estadisticas
      });
    }

    // Calcular costo basado en el contexto
    console.log('💰 Calculando costo del sondeo...');
    const { calculateSondeoCost } = require('../middlewares/credits');
    const costoCalculado = calculateSondeoCost(contextoCompleto);
    console.log('💰 Costo calculado:', costoCalculado, 'créditos');
    
    // Guardar el costo calculado en el request para el middleware
    req.calculatedCost = costoCalculado;
    
    const configuracionCompleta = {
      ...configuracion,
      costo_calculado: costoCalculado,
      usuario: req.user.profile.email,
      timestamp: new Date().toISOString()
    };

    // FASE 3: Obtener contexto adicional con Perplexity
    console.log('🔍 FASE 3: Obteniendo contexto adicional con Perplexity...');
    const contextoAdicional = await obtenerContextoAdicionalPerplexity(pregunta, contextoCompleto);
    console.log('✅ FASE 3 completada. Contexto adicional obtenido');

    // FASE 4: Procesar con ChatGPT 4o
    console.log('🤖 FASE 4: Procesando sondeo con ChatGPT 4o');
    const resultadoFinal = await procesarSondeoConChatGPT(
      pregunta, 
      contextoCompleto, 
      configuracionCompleta
    );
    console.log('✅ FASE 4 completada. Resultado:', {
      tieneRespuesta: !!resultadoFinal.respuesta,
      tieneMetadata: !!resultadoFinal.metadata,
      tieneDatosVisualizacion: !!resultadoFinal.datos_visualizacion,
      keysResultado: Object.keys(resultadoFinal)
    });

    // FASE 5: Preparar respuesta final
    console.log('🎯 FASE 5: Preparando respuesta final');
    const respuestaCompleta = {
      success: true,
      sondeo: {
        pregunta,
        contextos_utilizados: contextosFinales,
        timestamp: new Date().toISOString(),
        usuario: req.user.profile.email
      },
      contexto: {
        estadisticas: contextoCompleto.estadisticas,
        fuentes_utilizadas: contextoCompleto.fuentes_utilizadas,
        contexto_adicional: contextoAdicional
      },
      resultado: {
        respuesta: resultadoFinal.respuesta,
        metadata: resultadoFinal.metadata,
        estadisticas: resultadoFinal.estadisticas,
        // Incluir datos de visualización en el formato que espera el frontend
        datos_analisis: resultadoFinal.datos_visualizacion || {},
        conclusiones: resultadoFinal.datos_visualizacion?.conclusiones || {},
        metodologia: resultadoFinal.datos_visualizacion?.metodologia || {}
      },
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

    console.log('✅ FASE 5 completada. Respuesta preparada:', {
      success: respuestaCompleta.success,
      tieneResultado: !!respuestaCompleta.resultado,
      tieneDatosAnalisis: !!respuestaCompleta.resultado.datos_analisis,
      keysDatosAnalisis: Object.keys(respuestaCompleta.resultado.datos_analisis || {})
    });

    console.log('✅ Sondeo procesado exitosamente');
    console.log(`💳 Costo total: ${costoCalculado} créditos`);

    // FASE 6: Registrar uso y debitar créditos
    console.log('💳 FASE 6: Registrando uso y debitando créditos...');
    try {
      const { logUsage } = require('../services/logs');
      
      // SIEMPRE registrar log de uso (tanto para admin como usuarios normales)
      await logUsage(req.user, req.path, costoCalculado, req);

      // Solo debitar créditos si NO es admin y la operación tiene costo
      if (req.user.profile.role !== 'admin' && costoCalculado > 0) {
        console.log(`💳 Debitando ${costoCalculado} créditos de ${req.user.profile.email}`);

        const supabase = require('../utils/supabase');
        const { data: updateResult, error } = await supabase
          .from('profiles')
          .update({ credits: req.user.profile.credits - costoCalculado })
          .eq('id', req.user.id)
          .select('credits')
          .single();

        if (error) {
          console.error('❌ Error debitando créditos:', error);
        } else {
          console.log(`✅ Créditos debitados. Nuevo saldo: ${updateResult.credits}`);
          
          // Actualizar la respuesta con el saldo real
          respuestaCompleta.creditos.creditos_restantes = updateResult.credits;

          // Verificar si necesita alerta de créditos bajos
          if (updateResult.credits <= 10 && updateResult.credits > 0) {
            console.log(`⚠️  Alerta: Usuario ${req.user.profile.email} tiene ${updateResult.credits} créditos restantes`);
          }
        }
      } else if (req.user.profile.role === 'admin') {
        console.log(`👑 Admin ${req.user.profile.email} ejecutó ${req.path} - Log registrado, sin débito de créditos`);
      }
      
      console.log('✅ FASE 6 completada: Uso registrado y créditos procesados');
    } catch (logError) {
      console.error('❌ Error en logging/débito de créditos:', logError);
      // No fallar el sondeo por errores de logging
    }

    res.json(respuestaCompleta);

  } catch (error) {
    console.error('❌ ERROR CRÍTICO en procesamiento de sondeo:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    
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
router.get('/api/sondeo/contextos', verifyUserAccess, async (req, res) => {
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
 * POST /api/sondeo/costo - Calcula el costo estimado de un sondeo
 */
router.post('/api/sondeo/costo', verifyUserAccess, async (req, res) => {
  try {
    const { selectedContexts, contextos } = req.body;
    const contextosFinales = selectedContexts || contextos;

    if (!contextosFinales || !Array.isArray(contextosFinales)) {
      return res.status(400).json({
        error: 'Contextos requeridos',
        message: 'Debes proporcionar los contextos para calcular el costo'
      });
    }

    // Construir contexto simulado para calcular costo
    const contextoSimulado = await construirContextoCompleto(contextosFinales);
    
    const { calculateSondeoCost } = require('../middlewares/credits');
    const costoEstimado = calculateSondeoCost(contextoSimulado);

    res.json({
      success: true,
      costo_estimado: costoEstimado,
      contextos_seleccionados: contextosFinales,
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
router.get('/api/sondeo/estadisticas', verifyUserAccess, async (req, res) => {
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