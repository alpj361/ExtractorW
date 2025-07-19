const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { checkCredits } = require('../middlewares/credits');
const { 
  construirContextoCompleto,
  obtenerContextoAdicionalPerplexity,
  procesarSondeoConChatGPT,
  construirPromptSondeo
} = require('../services/sondeos');

/**
 * Rutas de Sondeos - Implementación modular
 * Basado en la funcionalidad original de migration.js
 */

/**
 * POST /api/sondeo - Endpoint principal para procesar sondeos
 * Requiere autenticación y verificación de créditos
 */
router.post('/sondeo', verifyUserAccess, checkCredits, async (req, res) => {
  try {
    console.log('🎯 INICIO: Procesando sondeo');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 Usuario:', req.user.profile.email);
    
    const { pregunta, selectedContexts, contextos, configuracion = {}, selectedMonitoreoIds = [] } = req.body;
    
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

    const contextosValidos = ['tendencias', 'tweets', 'noticias', 'codex', 'monitoreos'];
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
    console.log('🔧 Configuración recibida:', configuracion);
    const contextoCompleto = await construirContextoCompleto(contextosFinales, req.user.id, selectedMonitoreoIds, configuracion);
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
    
    // Integrar el contexto adicional en el contexto completo
    const contextoEnriquecido = {
      ...contextoCompleto,
      contexto_adicional: contextoAdicional
    };

    // 🔍 MODO PREVIEW: Permite a usuarios admin revisar el contexto y el prompt antes de enviar a GPT
    const isPreviewRequested = configuracionCompleta?.preview_context === true || configuracionCompleta?.revisar_contexto === true;
    const isAdminUser = req.user?.profile?.role === 'admin' || req.user?.profile?.is_admin;

    console.log('🔍 PREVIEW DEBUG:', {
      isPreviewRequested,
      isAdminUser,
      userRole: req.user?.profile?.role,
      userEmail: req.user?.profile?.email,
      previewContextFlag: configuracionCompleta?.revisar_contexto,
      previewContextValue: configuracionCompleta?.preview_context,
      requestBody: req.body  // Agregar esto para ver el cuerpo completo de la solicitud
    });

    if (isPreviewRequested && isAdminUser) {
      // Construir prompt sin llamar a GPT
      const promptPreview = construirPromptSondeo(pregunta, contextoEnriquecido, configuracionCompleta);
      console.log('🔎 [PREVIEW] Prompt construido (long:', promptPreview.length, 'chars)');

      return res.json({
        success: true,
        preview: true,
        message: 'Vista previa de contexto y prompt — no se llamó a GPT-4o',
        prompt_length: promptPreview.length,
        prompt_preview: promptPreview,
        contexto_stats: {
          fuentes_utilizadas: contextoEnriquecido.fuentes_utilizadas,
          total_items: contextoEnriquecido.estadisticas?.total_items,
          fuentes_con_datos: contextoEnriquecido.estadisticas?.fuentes_con_datos
        },
        contexto_truncado: JSON.stringify(contextoEnriquecido).substring(0, 5000)
      });
    }
    
    const resultadoFinal = await procesarSondeoConChatGPT(
      pregunta, 
      contextoEnriquecido, 
      configuracionCompleta
    );
    console.log('✅ FASE 4 completada. Resultado:', {
      tieneRespuesta: !!resultadoFinal.respuesta,
      tieneMetadata: !!resultadoFinal.metadata,
      tieneDatosVisualizacion: !!resultadoFinal.datos_visualizacion,
      keysResultado: Object.keys(resultadoFinal)
    });

    // 🔍 OPCIÓN: Incluir contexto bruto para depuración
    const incluirContextoRaw = configuracionCompleta?.incluir_contexto_raw === true || process.env.INCLUIR_CONTEXTO_RAW === 'true';
    if (incluirContextoRaw) {
      console.log('📊 LOGGING: Contexto completo que se enviará al modelo:', JSON.stringify(contextoEnriquecido, null, 2).substring(0, 10000));
    }

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
        sources_used: resultadoFinal.metadata?.sources_used || contextoCompleto.fuentes_utilizadas,
        aggregated_stats: contextoCompleto.aggregated_stats || {},
        contexto_adicional: contextoAdicional,
        data_quality: resultadoFinal.metadata?.data_quality || 'unknown',
        has_sufficient_data: resultadoFinal.metadata?.has_sufficient_data !== false
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
        modelo_ia: 'ChatGPT-4o + Perplexity',
        sources_used: resultadoFinal.metadata?.sources_used || contextoCompleto.fuentes_utilizadas,
        data_quality: resultadoFinal.metadata?.data_quality || 'unknown',
        has_warning: !!resultadoFinal.datos_visualizacion?.warning
      }
    };

    // Adjuntar contexto bruto al payload de salida si está habilitado
    if (incluirContextoRaw) {
      respuestaCompleta.contexto.contexto_base = contextoEnriquecido;
    }

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
      
      // Prepare detailed response metrics for logging
      req.response_metrics = {
        tokens_utilizados: resultadoFinal.metadata?.tokens_utilizados || 0,
        tokens_prompt: resultadoFinal.metadata?.tokens_prompt || 0,
        tokens_completion: resultadoFinal.metadata?.tokens_completion || 0,
        fuentes_utilizadas: contextoCompleto.fuentes_utilizadas,
        sources_used: resultadoFinal.metadata?.sources_used || [],
        data_quality: resultadoFinal.metadata?.data_quality || 'unknown',
        has_sufficient_data: resultadoFinal.metadata?.has_sufficient_data !== false,
        contexto_items: contextoCompleto.estadisticas?.total_items || 0,
        fuentes_con_datos: contextoCompleto.estadisticas?.fuentes_con_datos || 0,
        engagement_total: contextoCompleto.estadisticas?.total_engagement || 0,
        tiene_visualizaciones: !!(resultadoFinal.datos_visualizacion && Object.keys(resultadoFinal.datos_visualizacion).length > 0),
        tiene_warning: !!resultadoFinal.datos_visualizacion?.warning,
        modelo_utilizado: resultadoFinal.metadata?.modelo || 'unknown',
        processing_time_ms: Date.now() - new Date(respuestaCompleta.sondeo.timestamp).getTime()
      };
      
      console.log('📊 LOGGING: Métricas de respuesta preparadas para logs:', req.response_metrics);
      
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

    // FASE 7: Guardar sondeo en la base de datos
    console.log('💾 FASE 7: Guardando sondeo en la base de datos...');
    
    try {
      const inicioTiempo = Date.now();
      const supabase = require('../utils/supabase');
      
      // Preparar datos para guardar
      const sondeoData = {
        user_id: req.user.id,
        pregunta,
        email_usuario: req.user.profile.email,
        contextos_utilizados: contextosFinales,
        respuesta_llm: resultadoFinal.respuesta,
        datos_analisis: resultadoFinal.datos_visualizacion || {},
        contexto_adicional: {
          contexto_tweets: contextoAdicional.contexto_tweets || '',
          contexto_web: contextoAdicional.contexto_web || '',
          fuentes_utilizadas: contextoAdicional.fuentes_utilizadas || []
        },
        creditos_utilizados: costoCalculado,
        modelo_ia: 'ChatGPT-4o + Perplexity',
        tokens_utilizados: resultadoFinal.metadata?.tokens_utilizados || 0,
        estado: 'completado',
        metadata: {
          tokens_prompt: resultadoFinal.metadata?.tokens_prompt || 0,
          tokens_completion: resultadoFinal.metadata?.tokens_completion || 0,
          tiempo_procesamiento_segundos: Math.round((Date.now() - inicioTiempo) / 1000),
          version: '2.0',
          fuentes_utilizadas: contextoCompleto.fuentes_utilizadas
        }
      };
      
      // Insertar en la tabla sondeos
      const { data: sondeoGuardado, error: sondeoError } = await supabase
        .from('sondeos')
        .insert(sondeoData)
        .select('id')
        .single();
      
      if (sondeoError) {
        console.error('❌ Error guardando sondeo:', sondeoError);
      } else {
        console.log(`✅ Sondeo guardado con ID: ${sondeoGuardado.id}`);
        // Agregar el ID del sondeo a la respuesta
        respuestaCompleta.sondeo.id = sondeoGuardado.id;
      }
      
      console.log('✅ FASE 7 completada: Sondeo guardado en base de datos');
      
    } catch (saveError) {
      console.error('❌ Error en proceso de guardado:', saveError);
      // No fallar el sondeo por errores de guardado
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
    const contextoSimulado = await construirContextoCompleto(contextosFinales, req.user?.id, selectedMonitoreoIds, req.body.configuracion || {});
    
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
 * GET /api/sondeo/historial - Obtiene el historial de sondeos del usuario
 */
router.get('/api/sondeo/historial', verifyUserAccess, async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const supabase = require('../utils/supabase');
    
    // Obtener sondeos del usuario
    const { data: sondeos, error } = await supabase
      .from('sondeos')
      .select(`
        id,
        pregunta,
        contextos_utilizados,
        respuesta_llm,
        datos_analisis,
        contexto_adicional,
        creditos_utilizados,
        modelo_ia,
        tokens_utilizados,
        estado,
        created_at,
        metadata
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error obteniendo historial:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error obteniendo historial de sondeos'
      });
    }

    // Contar total de sondeos
    const { count, error: countError } = await supabase
      .from('sondeos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (countError) {
      console.error('❌ Error contando sondeos:', countError);
    }

    res.json({
      success: true,
      sondeos: sondeos || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (count || 0) > (parseInt(offset) + parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo historial de sondeos'
    });
  }
});

/**
 * GET /api/sondeo/:id - Obtiene un sondeo específico por ID
 */
router.get('/api/sondeo/:id', verifyUserAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = require('../utils/supabase');
    
    // Obtener sondeo específico
    const { data: sondeo, error } = await supabase
      .from('sondeos')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id) // Solo permitir acceso a sondeos propios
      .single();

    if (error) {
      console.error('❌ Error obteniendo sondeo:', error);
      return res.status(404).json({
        error: 'Sondeo no encontrado',
        message: 'El sondeo solicitado no existe o no tienes acceso a él'
      });
    }

    // Formatear respuesta similar al endpoint principal
    const respuestaFormateada = {
      success: true,
      sondeo: {
        id: sondeo.id,
        pregunta: sondeo.pregunta,
        contextos_utilizados: sondeo.contextos_utilizados,
        timestamp: sondeo.created_at,
        usuario: sondeo.email_usuario
      },
      contexto: {
        contexto_adicional: sondeo.contexto_adicional
      },
      resultado: {
        respuesta: sondeo.respuesta_llm,
        datos_analisis: sondeo.datos_analisis,
        metadata: sondeo.metadata
      },
      creditos: {
        costo_total: sondeo.creditos_utilizados,
        tokens_utilizados: sondeo.tokens_utilizados
      },
      metadata: {
        procesado_en: sondeo.created_at,
        modelo_ia: sondeo.modelo_ia,
        estado: sondeo.estado,
        version: sondeo.metadata?.version || '2.0'
      }
    };

    res.json(respuestaFormateada);

  } catch (error) {
    console.error('❌ Error obteniendo sondeo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo sondeo'
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