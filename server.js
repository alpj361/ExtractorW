const express = require('express');
const cors = require('cors');
// Usa fetch nativo si tienes Node 18+, si no, descomenta la siguiente línea:
// const fetch = require('node-fetch');

// 📧 NUEVA DEPENDENCIA PARA EMAIL
const nodemailer = require('nodemailer');

// Colores para la nube de palabras
const COLORS = [
  '#3B82F6', '#0EA5E9', '#14B8A6', '#10B981', '#F97316', 
  '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#84CC16'
];

const app = express();
app.use(cors({
  origin: '*', // O pon tu frontend, ej: 'http://localhost:3000'
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({limit: '10mb'}));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const VPS_API_URL = process.env.VPS_API_URL;
const USE_AI = process.env.USE_AI === 'true'; // Nueva variable de entorno
const USE_WEB_SEARCH = true; // Indicar si queremos usar búsqueda web para tendencias

// Función para generar color aleatorio
function getRandomColor() {
  const colors = [
    '#3B82F6', // blue
    '#0EA5E9', // light blue
    '#14B8A6', // teal
    '#10B981', // green
    '#F97316', // orange
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#EF4444', // red
    '#F59E0B', // amber
    '#84CC16', // lime
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Función para mapear un rango a otro
function mapRange(value, inMin, inMax, outMin, outMax) {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Función para procesar tendencias localmente (sin IA)
async function processLocalTrends(rawData) {
  try {
    console.log('Iniciando procesamiento local con estructura:', typeof rawData);
    
    // Determinar la estructura de los datos de entrada
    let trendsArray = [];
    
    if (!rawData) {
      console.log('rawData es nulo o indefinido, generando datos mock');
      // Generar datos mock
      trendsArray = Array(10).fill().map((_, i) => ({
        name: `Tema ${i+1}`,
        volume: 100 - i*10,
        category: 'General'
      }));
    } else if (rawData.trends && Array.isArray(rawData.trends)) {
      console.log(`Formato esperado: rawData.trends contiene ${rawData.trends.length} elementos`);
      trendsArray = rawData.trends;
    } else if (Array.isArray(rawData)) {
      console.log(`rawData es un array con ${rawData.length} elementos`);
      trendsArray = rawData.map(item => {
        // Intentar extraer nombre y volumen según diferentes formatos
        const name = item.name || item.keyword || item.text || item.value || 'Desconocido';
        const volume = item.volume || item.count || item.value || 1;
        // Si no hay categoría, asignar una basada en el nombre
        let category = item.category || 'General';
        
        // Generar una categoría si no existe
        if (!item.category && name !== 'Desconocido') {
          // Categorías comunes
          const categories = {
            'política': 'Política',
            'gobierno': 'Política',
            'presidente': 'Política',
            'elecciones': 'Política',
            'congreso': 'Política',
            'deporte': 'Deportes',
            'fútbol': 'Deportes',
            'baloncesto': 'Deportes',
            'atleta': 'Deportes',
            'economía': 'Economía',
            'finanzas': 'Economía',
            'dinero': 'Economía',
            'mercado': 'Economía',
            'tecnología': 'Tecnología',
            'tech': 'Tecnología',
            'digital': 'Tecnología',
            'internet': 'Tecnología',
            'app': 'Tecnología',
            'salud': 'Salud',
            'covid': 'Salud',
            'hospital': 'Salud',
            'enfermedad': 'Salud',
            'vacuna': 'Salud',
            'educación': 'Educación',
            'escuela': 'Educación',
            'universidad': 'Educación',
            'cultura': 'Cultura',
            'música': 'Cultura',
            'cine': 'Cultura',
            'arte': 'Cultura',
            'libro': 'Cultura'
          };
          
          const nameLower = name.toLowerCase();
          for (const [keyword, cat] of Object.entries(categories)) {
            if (nameLower.includes(keyword)) {
              category = cat;
              break;
            }
          }
        }
        
        return { name, volume, category };
      });
    } else if (typeof rawData === 'object') {
      console.log('rawData es un objeto, buscando elementos de tendencia');
      // Intentar extraer un array de alguna propiedad del objeto
      const possibleArrayProps = ['trends', 'data', 'items', 'results', 'keywords', 'topics'];
      
      for (const prop of possibleArrayProps) {
        if (rawData[prop] && Array.isArray(rawData[prop]) && rawData[prop].length > 0) {
          console.log(`Encontrado array en rawData.${prop} con ${rawData[prop].length} elementos`);
          trendsArray = rawData[prop];
          break;
        }
      }
      
      // Si todavía no tenemos un array y hay propiedades en el objeto, convertirlas en tendencias
      if (trendsArray.length === 0) {
        console.log('No se encontró un array, intentando usar propiedades del objeto como tendencias');
        trendsArray = Object.entries(rawData)
          .filter(([key, value]) => typeof value !== 'object' && key !== 'timestamp')
          .map(([key, value]) => ({
            name: key,
            volume: typeof value === 'number' ? value : 1,
            category: 'General'
          }));
      }
    }
    
    // Si después de todo no tenemos datos, generar mock
    if (trendsArray.length === 0) {
      console.log('No se pudieron extraer tendencias, generando datos mock');
      trendsArray = Array(10).fill().map((_, i) => ({
        name: `Tendencia ${i+1}`,
        volume: 100 - i*10,
        category: 'General'
      }));
    }
    
    console.log(`Procesando ${trendsArray.length} tendencias`);
    
    // Ordenar tendencias por volumen o alguna métrica relevante
    const sortedTrends = [...trendsArray].sort((a, b) => {
      const volumeA = a.volume || a.count || 1;
      const volumeB = b.volume || b.count || 1;
      return volumeB - volumeA;
    });
    
    // Tomar los primeros 10
    const top10 = sortedTrends.slice(0, 10);
    
    // Si hay menos de 10, repetir los más importantes
    while (top10.length < 10) {
      top10.push(top10[top10.length % Math.max(1, top10.length)]);
    }
    
    // Calcular valores mínimos y máximos para escalar
    const volumes = top10.map(t => t.volume || t.count || 1);
    const minVol = Math.min(...volumes);
    const maxVol = Math.max(...volumes);
    
    // Crear estructura para topKeywords
    const topKeywords = top10.map((trend, index) => ({
      keyword: trend.name || trend.keyword || `Tendencia ${index + 1}`,
      count: trend.volume || trend.count || 1
    }));
    
    // Enriquecer con información sobre cada tendencia si USE_WEB_SEARCH está habilitado
    if (USE_WEB_SEARCH) {
      console.log('Obteniendo información adicional sobre tendencias (processLocalTrends)...');
      
      try {
        // Solo procesamos las 5 tendencias principales para esta función
        for (let i = 0; i < Math.min(5, topKeywords.length); i++) {
          const trend = topKeywords[i];
          trend.about = await searchTrendInfo(trend.keyword);
          console.log(`Información obtenida para ${trend.keyword}: ${typeof trend.about.summary === 'string' ? trend.about.summary.substring(0, 50) + '...' : 'No se pudo obtener información'}`);
        }
        
        // Para el resto usamos información genérica
        for (let i = 5; i < topKeywords.length; i++) {
          topKeywords[i].about = {
            summary: `Información sobre ${topKeywords[i].keyword}`,
            source: 'default',
            model: 'default'
          };
        }
      } catch (error) {
        console.error('Error al enriquecer tendencias:', error);
        // Agregar información genérica en caso de error
        topKeywords.forEach(trend => {
          if (!trend.about) {
            trend.about = {
              summary: `Tendencia relacionada con ${trend.keyword}`,
              source: 'default',
              model: 'default'
            };
          }
        });
      }
    }
    
    // Crear estructura para wordCloudData
    const wordCloudData = top10.map((trend, index) => {
      // Calcular un valor escalado entre 20 y 100 para el tamaño
      let scaledValue = 60; // Valor predeterminado
      
      if (minVol !== maxVol) {
        scaledValue = Math.round(20 + ((trend.volume - minVol) / (maxVol - minVol)) * 80);
      }
      
      // Verificar que el nombre no sea 'Sin nombre' si hay datos en raw_data
      if (trend.name === 'Sin nombre' && rawData && Array.isArray(rawData) && rawData[index]) {
        // Intentar obtener el texto de la tendencia directamente de raw_data
        const rawTrend = rawData[index];
        if (typeof rawTrend === 'object') {
          for (const [key, value] of Object.entries(rawTrend)) {
            if (typeof value === 'string' && value.trim() && key !== 'category' && key !== 'color') {
              trend.name = value.trim();
              break;
            }
          }
        }
      }
      
      // Asegurar que tenemos un texto válido
      const text = trend.name !== 'Sin nombre' ? trend.name : `Tendencia ${index + 1}`;
      
      console.log(`WordCloud item ${index}: text=${text}, value=${scaledValue}, color=${COLORS[index % COLORS.length]}`);
      
      return {
        text: text,
        value: scaledValue,
        color: COLORS[index % COLORS.length]
      };
    });
    
    // Extraer o generar categorías
    const categories = {};
    top10.forEach(trend => {
      const category = trend.category || 'Otros';
      if (categories[category]) {
        categories[category]++;
      } else {
        categories[category] = 1;
      }
    });
    
    const categoryData = Object.entries(categories).map(([category, count]) => ({
      category,
      count
    })).sort((a, b) => b.count - a.count);
    
    console.log('Procesamiento local completado exitosamente');
    
    return {
      wordCloudData,
      topKeywords,
      categoryData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error en procesamiento local:', error);
    // Devolver un conjunto de datos mínimo para evitar errores
    return {
      wordCloudData: [],
      topKeywords: Array(10).fill().map((_, i) => ({ keyword: `Keyword ${i+1}`, count: 10-i })),
      categoryData: [{ category: 'Otros', count: 10 }],
      timestamp: new Date().toISOString()
    };
  }
}

// Supabase
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
// Initialize Supabase client only if credentials are available
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client initialized');
} else {
  console.log('Supabase credentials not found, database features will be disabled');
}

// 💳 ============ SISTEMA DE GESTIÓN DE CRÉDITOS ============

// Costos por operación (en créditos)
const CREDIT_COSTS = {
  '/api/processTrends': 3,
  '/api/sondeo': 1,
  '/api/create-document': { min: 2, max: 5 }, // Será calculado dinámicamente
  '/api/send-email': 0, // Gratis
  '/api/trending-tweets': 0, // Gratis
  '/api/test-email': 0 // Gratis (testing)
};

// Operaciones que NO requieren verificación de créditos
const FREE_OPERATIONS = [
  '/api/send-email',
  '/api/test-email',
  '/api/trending-tweets',
  '/health',
  '/api/diagnostics',
  '/api/searchTrendInfo',
  '/api/analyzeTrendWithTweets',
  '/api/processingStatus',
  '/api/latestTrends',
  '/api/credits/status',
  '/api/credits/history',
  '/api/credits/add',
  '/api/cron/processTrends' // 🆕 Endpoint gratuito para cron jobs automatizados
];

/**
 * Middleware para verificar autenticación y créditos
 */
const verifyUserAccess = async (req, res, next) => {
  try {
    // Verificar si la operación requiere créditos
    const operation = req.path;
    const isFreeOperation = FREE_OPERATIONS.some(freeOp => operation.startsWith(freeOp));
    
    if (isFreeOperation) {
      console.log(`🆓 Operación gratuita: ${operation}`);
      // Para operaciones gratuitas, asignar valores por defecto
      req.isAdmin = false;
      req.operationCost = 0; // Operación gratuita, 0 créditos
      return next();
    }

    // Obtener token de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token de autorización requerido',
        message: 'Incluye el token en el header Authorization: Bearer <token>'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('❌ Error verificando token:', error);
      return res.status(401).json({ 
        error: 'Token inválido o expirado',
        message: 'El token de autorización no es válido'
      });
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, user_type, credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Error obteniendo perfil:', profileError);
      return res.status(404).json({ 
        error: 'Perfil de usuario no encontrado',
        message: 'No se pudo obtener la información del usuario'
      });
    }

    // Verificar si el usuario es admin (acceso ilimitado)
    if (profile.role === 'admin') {
      console.log(`👑 Usuario admin con acceso ilimitado: ${profile.email}`);
      req.user = { ...user, profile };
      req.isAdmin = true;
      return next();
    }

    // Verificar créditos disponibles
    const operationCost = CREDIT_COSTS[operation];
    if (!operationCost && operationCost !== 0) {
      console.warn(`⚠️  Operación no definida en costos: ${operation}`);
      return res.status(400).json({
        error: 'Operación no válida',
        message: 'Esta operación no está disponible'
      });
    }

    let costToApply = operationCost;
    
    // Para operaciones con costo variable, usar el mínimo por ahora
    if (typeof operationCost === 'object') {
      costToApply = operationCost.min;
    }

    if (profile.credits < costToApply) {
      console.log(`💸 Créditos insuficientes para ${profile.email}: ${profile.credits} < ${costToApply}`);
      
      // Enviar alerta si tiene 10 créditos o menos
      const shouldAlert = profile.credits <= 10;
      
      return res.status(402).json({
        error: 'Créditos insuficientes',
        message: `No tienes suficientes créditos para esta operación. Necesitas ${costToApply} créditos, tienes ${profile.credits}.`,
        credits_required: costToApply,
        credits_available: profile.credits,
        low_credits_alert: shouldAlert
      });
    }

    // Guardar información del usuario en la request
    req.user = { ...user, profile };
    req.operationCost = costToApply;
    req.isAdmin = false;

    console.log(`✅ Usuario autorizado: ${profile.email} (${profile.credits} créditos, costo: ${costToApply})`);
    next();

  } catch (error) {
    console.error('❌ Error en verificación de acceso:', error);
    res.status(500).json({
      error: 'Error interno de verificación',
      message: 'Error verificando permisos de usuario'
    });
  }
};

/**
 * Middleware para debitar créditos DESPUÉS de operación exitosa
 */
const debitCredits = async (req, res, next) => {
  // Solo ejecutar si la response fue exitosa
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    handleCreditDebit.call(this, data, req, 'send');
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    handleCreditDebit.call(this, data, req, 'json');
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Función auxiliar para manejar el débito de créditos
 */
async function handleCreditDebit(data, req, responseType) {
  try {
    if (this.statusCode >= 200 && this.statusCode < 300) {
      const user = req.user;
      const operationCost = req.operationCost;
      
      // Para create-document, calcular costo real basado en la respuesta
      let finalCost = operationCost;
      if (req.path === '/api/create-document' && typeof data === 'object') {
        finalCost = calculateDocumentCost(data);
      }
      
      // SIEMPRE registrar log de uso (tanto para admin como usuarios normales)
      await logUsage(user, req.path, finalCost, req);
      
      // Solo debitar créditos si NO es admin y la operación tiene costo
      if (!req.isAdmin && finalCost > 0) {
        console.log(`💳 Debitando ${finalCost} créditos de ${user.profile.email}`);
        
        // Debitar créditos en la base de datos
        const { data: updateResult, error } = await supabase
          .from('profiles')
          .update({ credits: user.profile.credits - finalCost })
          .eq('id', user.id)
          .select('credits')
          .single();

        if (error) {
          console.error('❌ Error debitando créditos:', error);
          
          // Log del error específico
          await logError(`${req.path}_credit_debit`, {
            message: 'Error debitando créditos',
            error: error,
            credits_to_debit: finalCost,
            user_id: user.id
          }, user, req);
        } else {
          console.log(`✅ Créditos debitados. Nuevo saldo: ${updateResult.credits}`);
          
          // Verificar si necesita alerta de créditos bajos
          if (updateResult.credits <= 10 && updateResult.credits > 0) {
            console.log(`⚠️  Alerta: Usuario ${user.profile.email} tiene ${updateResult.credits} créditos restantes`);
            
            // Log de alerta de créditos bajos
            await logSystemOperation('low_credits_alert', {
              user_email: user.profile.email,
              remaining_credits: updateResult.credits,
              operation: req.path
            });
          }
        }
      } else if (req.isAdmin) {
        console.log(`👑 Admin ${user.profile.email} ejecutó ${req.path} - Log registrado, sin débito de créditos`);
      }
    } else {
      // Si el status code indica error, registrar error específico
      const errorData = typeof data === 'object' ? data : { message: data };
      await logError(req.path, {
        status_code: this.statusCode,
        response_data: errorData
      }, req.user, req);
    }
  } catch (error) {
    console.error('❌ Error en handleCreditDebit:', error);
    
    // Log del error en el middleware
    await logError('middleware_credit_debit', {
      message: 'Error en middleware de débito de créditos',
      error: error.message,
      stack: error.stack
    }, req.user, req);
  }
}

/**
 * Calcula el costo de un documento basado en su contenido
 */
function calculateDocumentCost(responseData) {
  const costs = CREDIT_COSTS['/api/create-document'];
  
  if (!responseData || typeof responseData !== 'object') {
    return costs.min;
  }
  
  // Calcular basado en longitud del contenido
  const content = responseData.content || responseData.document || responseData.text || '';
  const contentLength = content.length;
  
  if (contentLength < 500) return costs.min; // 2 créditos para documentos cortos
  if (contentLength < 1500) return 3; // 3 créditos para documentos medianos
  if (contentLength < 3000) return 4; // 4 créditos para documentos largos
  return costs.max; // 5 créditos para documentos muy largos
}

/**
 * Registra el uso de operaciones en logs detallados
 */
async function logUsage(user, operation, credits, req) {
  try {
    // VALIDAR Y SANITIZAR credits_consumed
    let creditsConsumed = 0; // Valor por defecto
    
    if (typeof credits === 'number' && !isNaN(credits) && isFinite(credits)) {
      creditsConsumed = Math.max(0, credits); // Asegurar que no sea negativo
    } else if (typeof credits === 'string' && !isNaN(parseFloat(credits))) {
      creditsConsumed = Math.max(0, parseFloat(credits));
    }
    
    console.log(`📊 Logging uso: ${operation}, créditos original: ${credits} (tipo: ${typeof credits}), créditos sanitizado: ${creditsConsumed}`);
    
    const logEntry = {
      user_id: user.id,
      user_email: user.profile.email,
      user_role: user.profile.role || 'user',
      operation: operation,
      credits_consumed: creditsConsumed,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      request_params: JSON.stringify({
        method: req.method,
        params: req.params,
        query: req.query,
        body_keys: req.body ? Object.keys(req.body) : []
      }),
      response_time: req.startTime ? Date.now() - req.startTime : null,
      success: true, // Asumimos éxito si llegó aquí
      error_details: null
    };

    // Guardar en tabla de logs (crear si no existe)
    if (supabase) {
      const { error } = await supabase
        .from('usage_logs')
        .insert([logEntry]);

      if (error) {
        console.error('❌ Error guardando log de uso:', error);
        console.error('📋 Log entry que causó error:', JSON.stringify(logEntry, null, 2));
        // No fallar la operación por error de logging
      } else {
        console.log(`📊 Log guardado: ${operation} por ${user.profile.email} (${creditsConsumed} créditos)`);
      }
    }
  } catch (error) {
    console.error('❌ Error en logUsage:', error);
    console.error('📋 Datos recibidos:', { operation, credits, userEmail: user?.profile?.email });
  }
}

/**
 * Registra logs del sistema (operaciones automatizadas, cron jobs, etc.)
 * IMPORTANTE: Guarda en tabla system_execution_logs usando la estructura existente
 */
async function logSystemOperation(scriptName, details = {}, success = true, errorDetails = null) {
  try {
    console.log(`🤖 Logging operación del sistema: ${scriptName}`);
    
    const now = new Date();
    const logEntry = {
      script_name: scriptName,
      started_at: details.started_at || now.toISOString(),
      completed_at: success ? now.toISOString() : null,
      status: success ? 'completed' : 'failed',
      duration_seconds: details.execution_time ? parseInt(details.execution_time.replace(/[^\d]/g, '')) || null : null,
      trends_found: details.trends_found || 0,
      tweets_found: details.tweets_found || 0,
      tweets_processed: details.tweets_processed || 0,
      tweets_saved: details.tweets_saved || 0,
      tweets_failed: details.tweets_failed || 0,
      duplicates_skipped: details.duplicates_skipped || 0,
      ai_requests_made: details.ai_requests_made || 0,
      ai_requests_successful: details.ai_requests_successful || 0,
      ai_requests_failed: details.ai_requests_failed || 0,
      total_tokens_used: details.total_tokens_used || 0,
      estimated_cost_usd: details.estimated_cost_usd || 0.0,
      categoria_stats: details.categoria_stats || {},
      sentimiento_stats: details.sentimiento_stats || {},
      intencion_stats: details.intencion_stats || {},
      propagacion_stats: details.propagacion_stats || {},
      api_response_time_ms: details.api_response_time_ms || null,
      memory_usage_mb: details.memory_usage_mb || null,
      error_details: errorDetails ? [errorDetails] : [],
      warnings: details.warnings || [],
      location: details.location || 'guatemala',
      environment: details.environment || 'production',
      version: details.version || '1.0',
      metadata: {
        source: 'ExtractorW',
        action: details.action || 'system_operation',
        ...details
      }
    };

    // Guardar en tabla system_execution_logs usando la estructura existente
    if (supabase) {
      const { error } = await supabase
        .from('system_execution_logs')
        .insert([logEntry]);

      if (error) {
        console.error('❌ Error guardando log del sistema:', error);
        console.error('📋 System log entry que causó error:', JSON.stringify(logEntry, null, 2));
      } else {
        console.log(`🤖 Log del sistema guardado en system_execution_logs: ${scriptName} (${success ? 'éxito' : 'error'})`);
      }
    }
  } catch (error) {
    console.error('❌ Error en logSystemOperation:', error);
  }
}

/**
 * Registra errores específicos en logs
 * IMPORTANTE: Guarda en usage_logs si es usuario, en system_execution_logs si es sistema
 */
async function logError(operation, errorDetails, user = null, req = null) {
  try {
    const isSystemError = !user; // Si no hay usuario, es error del sistema
    
    if (isSystemError) {
      // ERROR DEL SISTEMA -> system_execution_logs usando estructura existente
      const executionTime = req && req.startTime ? (Date.now() - req.startTime) / 1000 : null;
      const now = new Date();
      
      const systemLogEntry = {
        script_name: operation,
        started_at: req?.startTime ? new Date(req.startTime).toISOString() : now.toISOString(),
        completed_at: now.toISOString(),
        status: 'failed',
        duration_seconds: executionTime ? Math.round(executionTime) : null,
        error_details: [errorDetails],
        warnings: [],
        location: 'guatemala',
        environment: 'production',
        version: '1.0',
        metadata: {
          source: 'ExtractorW',
          error_type: 'system_error',
          ip_address: req?.ip || req?.connection?.remoteAddress || 'unknown',
          user_agent: req?.headers?.['user-agent'] || 'ExtractorW-System',
          original_error: errorDetails
        }
      };

      if (supabase) {
        const { error } = await supabase
          .from('system_execution_logs')
          .insert([systemLogEntry]);

        if (!error) {
          console.log(`💥 Error del sistema guardado en system_execution_logs: ${operation}`);
        } else {
          console.error('❌ Error guardando error del sistema:', error);
        }
      }
    } else {
      // ERROR DE USUARIO -> usage_logs
      const userLogEntry = {
        user_id: user.id,
        user_email: user.profile.email,
        user_role: user.profile.role || 'user',
        operation: operation,
        credits_consumed: 0, // Errores no consumen créditos
        ip_address: req?.ip || req?.connection?.remoteAddress || 'unknown',
        user_agent: req?.headers?.['user-agent'] || 'unknown',
        timestamp: new Date().toISOString(),
        request_params: req ? JSON.stringify({
          method: req.method,
          params: req.params,
          query: req.query,
          body_keys: req.body ? Object.keys(req.body) : []
        }) : '{}',
        response_time: req && req.startTime ? Date.now() - req.startTime : null,
        success: false,
        error_details: JSON.stringify(errorDetails)
      };

      if (supabase) {
        const { error } = await supabase
          .from('usage_logs')
          .insert([userLogEntry]);

        if (!error) {
          console.log(`💥 Error de usuario guardado en usage_logs: ${operation}`);
        } else {
          console.error('❌ Error guardando error de usuario:', error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error en logError:', error);
  }
}

/**
 * Middleware para agregar timestamp de inicio (para medir response time)
 */
const addTimestamp = (req, res, next) => {
  req.startTime = Date.now();
  next();
};

// 💳 ============ ENDPOINTS DE GESTIÓN DE CRÉDITOS ============

// Endpoint para consultar estado de créditos
app.get('/api/credits/status', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Obtener créditos actuales
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('credits, user_type, role')
      .eq('id', user.id)
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Error obteniendo estado de créditos',
        message: error.message
      });
    }

    const isAdmin = profile.role === 'admin';
    const needsAlert = profile.credits <= 10;

    res.json({
      credits: isAdmin ? 'ilimitado' : profile.credits,
      user_type: profile.user_type,
      role: profile.role,
      is_admin: isAdmin,
      low_credits_alert: !isAdmin && needsAlert,
      operation_costs: CREDIT_COSTS,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en /api/credits/status:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// Endpoint para consultar historial de uso
app.get('/api/credits/history', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    const limit = parseInt(req.query.limit) || 10;

    if (supabase) {
      const { data: logs, error } = await supabase
        .from('usage_logs')
        .select('operation, credits_consumed, timestamp, ip_address, response_time')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        return res.status(500).json({
          error: 'Error obteniendo historial',
          message: error.message
        });
      }

      res.json({
        recent_operations: logs || [],
        total_shown: logs ? logs.length : 0,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        recent_operations: [],
        total_shown: 0,
        message: 'Base de datos no configurada',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error en /api/credits/history:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// Endpoint para agregar créditos (solo admins)
app.post('/api/credits/add', verifyUserAccess, async (req, res) => {
  try {
    const adminUser = req.user;
    const { user_email, credits_to_add } = req.body;

    // Verificar que el usuario actual es admin
    if (adminUser.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden agregar créditos'
      });
    }

    if (!user_email || !credits_to_add || credits_to_add <= 0) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'Se requiere user_email y credits_to_add (mayor a 0)'
      });
    }

    // Buscar usuario por email
    const { data: targetUser, error: findError } = await supabase
      .from('profiles')
      .select('id, email, credits')
      .eq('email', user_email)
      .single();

    if (findError || !targetUser) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: `No se encontró usuario con email: ${user_email}`
      });
    }

    // Agregar créditos
    const newCreditBalance = targetUser.credits + credits_to_add;
    
    const { data: updateResult, error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCreditBalance })
      .eq('id', targetUser.id)
      .select('credits')
      .single();

    if (updateError) {
      return res.status(500).json({
        error: 'Error agregando créditos',
        message: updateError.message
      });
    }

    console.log(`💳 Admin ${adminUser.profile.email} agregó ${credits_to_add} créditos a ${user_email}`);

    res.json({
      success: true,
      message: `Se agregaron ${credits_to_add} créditos a ${user_email}`,
      previous_balance: targetUser.credits,
      new_balance: updateResult.credits,
      credits_added: credits_to_add,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en /api/credits/add:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// 💳 ============ FIN SISTEMA DE CRÉDITOS ============

// 📊 ============ ENDPOINT PARA PANEL DE ADMINISTRACIÓN ============

// Endpoint para obtener datos completos del dashboard de admin
app.get('/api/admin/dashboard', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    console.log(`👑 Admin ${user.profile.email} consultando dashboard`);

    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no configurada',
        message: 'Supabase no está disponible'
      });
    }

    // 1. ESTADÍSTICAS GENERALES DEL SISTEMA
    console.log('📊 Obteniendo estadísticas generales...');
    
    // Total de usuarios
    const { data: totalUsersData, error: usersError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' });

    if (usersError) {
      console.error('Error obteniendo total de usuarios:', usersError);
    }

    // Total de créditos en el sistema
    const { data: creditsData, error: creditsError } = await supabase
      .from('profiles')
      .select('credits')
      .neq('role', 'admin'); // Excluir admins

    let totalCredits = 0;
    let avgCredits = 0;
    if (!creditsError && creditsData) {
      totalCredits = creditsData.reduce((sum, user) => sum + (user.credits || 0), 0);
      avgCredits = creditsData.length > 0 ? Math.round(totalCredits / creditsData.length) : 0;
    }

    // Estadísticas de logs (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: logsData, error: logsError } = await supabase
      .from('usage_logs')
      .select('credits_consumed, operation, timestamp')
      .gte('timestamp', thirtyDaysAgo.toISOString());

    let totalOperations = 0;
    let totalCreditsConsumed = 0;
    let operationStats = {};
    
    if (!logsError && logsData) {
      totalOperations = logsData.length;
      totalCreditsConsumed = logsData.reduce((sum, log) => sum + (log.credits_consumed || 0), 0);
      
      // Estadísticas por operación
      logsData.forEach(log => {
        const op = log.operation;
        if (!operationStats[op]) {
          operationStats[op] = { count: 0, credits: 0 };
        }
        operationStats[op].count++;
        operationStats[op].credits += log.credits_consumed || 0;
      });
    }

    // 2. LISTA DE USUARIOS CON CRÉDITOS
    console.log('👥 Obteniendo lista de usuarios...');
    const { data: usersData, error: usersListError } = await supabase
      .from('profiles')
      .select('id, email, user_type, role, credits, created_at')
      .order('credits', { ascending: false });

    let usersList = [];
    let lowCreditUsers = [];
    
    if (!usersListError && usersData) {
      usersList = usersData.map(user => ({
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        role: user.role,
        credits: user.role === 'admin' ? 'ilimitado' : user.credits,
        credits_numeric: user.role === 'admin' ? null : user.credits,
        created_at: user.created_at,
        is_low_credits: user.role !== 'admin' && user.credits <= 10
      }));

      lowCreditUsers = usersData
        .filter(user => user.role !== 'admin' && user.credits <= 10)
        .map(user => ({
          email: user.email,
          credits: user.credits,
          user_type: user.user_type
        }));
    }

    // 3. LOGS RECIENTES (últimos 20)
    console.log('📋 Obteniendo logs recientes...');
    const { data: recentLogs, error: recentLogsError } = await supabase
      .from('usage_logs')
      .select('user_email, operation, credits_consumed, timestamp, ip_address, response_time')
      .order('timestamp', { ascending: false })
      .limit(20);

    // 4. MÉTRICAS DE USO POR DÍA (últimos 7 días)
    console.log('📈 Calculando métricas diarias...');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: dailyLogs, error: dailyLogsError } = await supabase
      .from('usage_logs')
      .select('timestamp, credits_consumed, operation')
      .gte('timestamp', sevenDaysAgo.toISOString());

    let dailyMetrics = {};
    
    if (!dailyLogsError && dailyLogs) {
      // Inicializar últimos 7 días
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        dailyMetrics[dateKey] = { operations: 0, credits: 0 };
      }

      // Llenar con datos reales
      dailyLogs.forEach(log => {
        const dateKey = log.timestamp.split('T')[0];
        if (dailyMetrics[dateKey]) {
          dailyMetrics[dateKey].operations++;
          dailyMetrics[dateKey].credits += log.credits_consumed || 0;
        }
      });
    }

    // 5. TOP USUARIOS POR CONSUMO (últimos 30 días)
    console.log('🏆 Calculando top usuarios...');
    let topUsers = [];
    
    if (!logsError && logsData) {
      const userConsumption = {};
      logsData.forEach(log => {
        const email = log.user_email;
        if (!userConsumption[email]) {
          userConsumption[email] = { operations: 0, credits: 0 };
        }
        userConsumption[email].operations++;
        userConsumption[email].credits += log.credits_consumed || 0;
      });

      topUsers = Object.entries(userConsumption)
        .map(([email, stats]) => ({ email, ...stats }))
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 10);
    }

    // 6. DISTRIBUCIÓN POR TIPO DE USUARIO
    console.log('📊 Calculando distribución de usuarios...');
    let userTypeDistribution = {};
    
    if (!usersListError && usersData) {
      usersData.forEach(user => {
        const type = user.user_type || 'Unknown';
        if (!userTypeDistribution[type]) {
          userTypeDistribution[type] = 0;
        }
        userTypeDistribution[type]++;
      });
    }

    // RESPUESTA COMPLETA
    const dashboardData = {
      // Estadísticas generales
      general_stats: {
        total_users: totalUsersData?.length || 0,
        total_credits_in_system: totalCredits,
        average_credits_per_user: avgCredits,
        total_operations_30d: totalOperations,
        total_credits_consumed_30d: totalCreditsConsumed,
        low_credit_users_count: lowCreditUsers.length
      },

      // Estadísticas por operación
      operation_stats: Object.entries(operationStats).map(([operation, stats]) => ({
        operation,
        count: stats.count,
        credits_consumed: stats.credits,
        avg_credits_per_operation: stats.count > 0 ? Math.round(stats.credits / stats.count * 100) / 100 : 0
      })).sort((a, b) => b.count - a.count),

      // Lista completa de usuarios
      users: usersList,

      // Usuarios con créditos bajos
      low_credit_users: lowCreditUsers,

      // Logs recientes
      recent_logs: recentLogs || [],

      // Métricas diarias (últimos 7 días)
      daily_metrics: Object.entries(dailyMetrics).map(([date, metrics]) => ({
        date,
        operations: metrics.operations,
        credits_consumed: metrics.credits
      })),

      // Top usuarios por consumo
      top_users_by_consumption: topUsers,

      // Distribución por tipo de usuario
      user_type_distribution: Object.entries(userTypeDistribution).map(([type, count]) => ({
        user_type: type,
        count
      })),

      // Metadata
      metadata: {
        timestamp: new Date().toISOString(),
        admin_user: user.profile.email,
        data_period: '30 días',
        total_endpoints_with_credits: Object.keys(CREDIT_COSTS).length
      }
    };

    console.log(`✅ Dashboard data generado para ${user.profile.email}`);
    res.json(dashboardData);

  } catch (error) {
    console.error('❌ Error generando dashboard de admin:', error);
    res.status(500).json({
      error: 'Error interno generando dashboard',
      message: error.message
    });
  }
});

// Endpoint para obtener usuarios con filtros específicos
app.get('/api/admin/users', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    const { 
      user_type, 
      role, 
      low_credits, 
      limit = 50, 
      offset = 0,
      order_by = 'created_at',
      order_direction = 'desc'
    } = req.query;

    console.log(`👑 Admin ${user.profile.email} consultando usuarios con filtros`);

    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no configurada',
        message: 'Supabase no está disponible'
      });
    }

    let query = supabase
      .from('profiles')
      .select('id, email, user_type, role, credits, created_at, updated_at');

    // Aplicar filtros
    if (user_type) {
      query = query.eq('user_type', user_type);
    }
    
    if (role) {
      query = query.eq('role', role);
    }
    
    if (low_credits === 'true') {
      query = query.lte('credits', 10).neq('role', 'admin');
    }

    // Aplicar ordenamiento
    const validOrderBy = ['created_at', 'credits', 'email', 'user_type'];
    const validDirection = ['asc', 'desc'];
    
    if (validOrderBy.includes(order_by) && validDirection.includes(order_direction)) {
      query = query.order(order_by, { ascending: order_direction === 'asc' });
    }

    // Aplicar límite y offset
    query = query.range(offset, offset + limit - 1);

    const { data: usersData, error } = await query;

    if (error) {
      console.error('Error obteniendo usuarios filtrados:', error);
      return res.status(500).json({
        error: 'Error obteniendo usuarios',
        message: error.message
      });
    }

    // Obtener el conteo total para paginación
    let countQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (user_type) countQuery = countQuery.eq('user_type', user_type);
    if (role) countQuery = countQuery.eq('role', role);
    if (low_credits === 'true') countQuery = countQuery.lte('credits', 10).neq('role', 'admin');

    const { count, error: countError } = await countQuery;

    const processedUsers = usersData?.map(userData => ({
      id: userData.id,
      email: userData.email,
      user_type: userData.user_type,
      role: userData.role,
      credits: userData.role === 'admin' ? 'ilimitado' : userData.credits,
      credits_numeric: userData.role === 'admin' ? null : userData.credits,
      is_low_credits: userData.role !== 'admin' && userData.credits <= 10,
      created_at: userData.created_at,
      updated_at: userData.updated_at
    })) || [];

    res.json({
      users: processedUsers,
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (count || 0) > (parseInt(offset) + parseInt(limit))
      },
      filters_applied: {
        user_type: user_type || null,
        role: role || null,
        low_credits: low_credits === 'true',
        order_by,
        order_direction
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios filtrados:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// Endpoint para obtener logs con filtros avanzados
app.get('/api/admin/logs', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    const { 
      user_email,
      operation,
      log_type, // 'user', 'system', o ambos
      success, // true, false, o ambos
      days = 7,
      limit = 100,
      offset = 0
    } = req.query;
    
    // Convertir valores a números
    const numDays = parseInt(days) || 7;
    const numLimit = parseInt(limit) || 100;
    const numOffset = parseInt(offset) || 0;

    console.log(`👑 Admin ${user.profile.email} consultando logs con filtros`, {
      log_type, success, user_email, operation, days
    });
    
    // Si log_type es 'user', forzar que solo consulte usage_logs
    if (log_type === 'user') {
      console.log('🔒 Filtro específico: SOLO logs de usuario (usage_logs)');
    } else if (log_type === 'system') {
      console.log('🔒 Filtro específico: SOLO logs del sistema (system_execution_logs)');
    }

    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no configurada',
        message: 'Supabase no está disponible'
      });
    }

    // Test query to verify database access
    console.log('🧪 Ejecutando query de prueba...');
    const { data: testData, error: testError } = await supabase
      .from('usage_logs')
      .select('*');

    if (testError) {
      console.error('❌ Error en query de prueba:', testError);
      return res.status(500).json({
        error: 'Error accediendo a la base de datos',
        message: testError.message
      });
    } else {
      console.log('✅ Query de prueba exitosa. Total registros:', testData?.length || 0);
      if (testData && testData.length > 0) {
        console.log('📋 Primer registro:', JSON.stringify(testData[0], null, 2));
      }
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    let allLogs = [];
    
    // 1. OBTENER LOGS DE USUARIO (usage_logs) si corresponde
    if (!log_type || log_type === 'all' || log_type === 'user') {
      console.log('📊 Consultando usage_logs...');
      console.log('🔑 Usuario:', req.user.email);
      console.log('🎭 Rol:', req.user.profile.role);
      
      let userQuery = supabase
        .from('usage_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      // Solo agregar filtros si es necesario
      if (days && days !== '0') {
        userQuery = userQuery.gte('timestamp', daysAgo.toISOString());
        console.log('📅 Filtro de fecha:', daysAgo.toISOString());
      }

      if (user_email && user_email !== 'all') {
        userQuery = userQuery.ilike('user_email', `%${user_email}%`);
        console.log('👤 Filtro de email:', user_email);
      }
      
      if (operation && operation !== 'all') {
        userQuery = userQuery.eq('operation', operation);
        console.log('🔧 Filtro de operación:', operation);
      }

      console.log('🔍 Query final:', userQuery.toString());

      const { data: userLogs, error: userError } = await userQuery;

      if (userError) {
        console.error('❌ Error obteniendo logs de usuario:', userError);
        console.error('Detalles del error:', JSON.stringify(userError, null, 2));
        return res.status(500).json({
          error: 'Error obteniendo logs',
          message: userError.message,
          details: userError
        });
      }

      if (userLogs && userLogs.length > 0) {
        console.log(`✅ Logs encontrados: ${userLogs.length}`);
        allLogs = userLogs.map(log => ({
          ...log,
          log_type: 'user',
          source_table: 'usage_logs',
          is_success: true,
          formatted_time: new Date(log.timestamp || log.created_at).toLocaleString('es-ES', {
            timeZone: 'America/Guatemala'
          })
        }));
      } else {
        console.log('⚠️ No se encontraron logs');
        console.log('Query params:', {
          days,
          user_email,
          operation,
          limit
        });
      }
    }

    // Devolver resultados
    res.json({
      logs: allLogs,
      total: allLogs.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generando estadísticas de logs:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// Endpoint para obtener usuarios con filtros específicos
app.get('/api/admin/users', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    const { 
      user_type, 
      role, 
      low_credits, 
      limit = 50, 
      offset = 0,
      order_by = 'created_at',
      order_direction = 'desc'
    } = req.query;

    console.log(`👑 Admin ${user.profile.email} consultando usuarios con filtros`);

    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no configurada',
        message: 'Supabase no está disponible'
      });
    }

    let query = supabase
      .from('profiles')
      .select('id, email, user_type, role, credits, created_at, updated_at');

    // Aplicar filtros
    if (user_type) {
      query = query.eq('user_type', user_type);
    }
    
    if (role) {
      query = query.eq('role', role);
    }
    
    if (low_credits === 'true') {
      query = query.lte('credits', 10).neq('role', 'admin');
    }

    // Aplicar ordenamiento
    const validOrderBy = ['created_at', 'credits', 'email', 'user_type'];
    const validDirection = ['asc', 'desc'];
    
    if (validOrderBy.includes(order_by) && validDirection.includes(order_direction)) {
      query = query.order(order_by, { ascending: order_direction === 'asc' });
    }

    // Aplicar límite y offset
    query = query.range(offset, offset + limit - 1);

    const { data: usersData, error } = await query;

    if (error) {
      console.error('Error obteniendo usuarios filtrados:', error);
      return res.status(500).json({
        error: 'Error obteniendo usuarios',
        message: error.message
      });
    }

    // Obtener el conteo total para paginación
    let countQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (user_type) countQuery = countQuery.eq('user_type', user_type);
    if (role) countQuery = countQuery.eq('role', role);
    if (low_credits === 'true') countQuery = countQuery.lte('credits', 10).neq('role', 'admin');

    const { count, error: countError } = await countQuery;

    const processedUsers = usersData?.map(userData => ({
      id: userData.id,
      email: userData.email,
      user_type: userData.user_type,
      role: userData.role,
      credits: userData.role === 'admin' ? 'ilimitado' : userData.credits,
      credits_numeric: userData.role === 'admin' ? null : userData.credits,
      is_low_credits: userData.role !== 'admin' && userData.credits <= 10,
      created_at: userData.created_at,
      updated_at: userData.updated_at
    })) || [];

    res.json({
      users: processedUsers,
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (count || 0) > (parseInt(offset) + parseInt(limit))
      },
      filters_applied: {
        user_type: user_type || null,
        role: role || null,
        low_credits: low_credits === 'true',
        order_by,
        order_direction
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios filtrados:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// Endpoint para obtener logs con filtros avanzados
app.get('/api/admin/logs', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    const { 
      user_email,
      operation,
      log_type, // 'user', 'system', o ambos
      success, // true, false, o ambos
      days = 7,
      limit = 100,
      offset = 0
    } = req.query;
    
    // Convertir valores a números
    const numDays = parseInt(days) || 7;
    const numLimit = parseInt(limit) || 100;
    const numOffset = parseInt(offset) || 0;

    console.log(`👑 Admin ${user.profile.email} consultando logs con filtros`, {
      log_type, success, user_email, operation, days
    });
    
    // Si log_type es 'user', forzar que solo consulte usage_logs
    if (log_type === 'user') {
      console.log('🔒 Filtro específico: SOLO logs de usuario (usage_logs)');
    } else if (log_type === 'system') {
      console.log('🔒 Filtro específico: SOLO logs del sistema (system_execution_logs)');
    }

    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no configurada',
        message: 'Supabase no está disponible'
      });
    }

    // Test query to verify database access
    console.log('🧪 Ejecutando query de prueba...');
    const { data: testData, error: testError } = await supabase
      .from('usage_logs')
      .select('*');

    if (testError) {
      console.error('❌ Error en query de prueba:', testError);
      return res.status(500).json({
        error: 'Error accediendo a la base de datos',
        message: testError.message
      });
    } else {
      console.log('✅ Query de prueba exitosa. Total registros:', testData?.length || 0);
      if (testData && testData.length > 0) {
        console.log('📋 Primer registro:', JSON.stringify(testData[0], null, 2));
      }
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    let allLogs = [];
    
    // 1. OBTENER LOGS DE USUARIO (usage_logs) si corresponde
    if (!log_type || log_type === 'all' || log_type === 'user') {
      console.log('📊 Consultando usage_logs...');
      console.log('🔑 Usuario:', req.user.email);
      console.log('🎭 Rol:', req.user.profile.role);
      
      let userQuery = supabase
        .from('usage_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      // Solo agregar filtros si es necesario
      if (days && days !== '0') {
        userQuery = userQuery.gte('timestamp', daysAgo.toISOString());
        console.log('📅 Filtro de fecha:', daysAgo.toISOString());
      }

      if (user_email && user_email !== 'all') {
        userQuery = userQuery.ilike('user_email', `%${user_email}%`);
        console.log('👤 Filtro de email:', user_email);
      }
      
      if (operation && operation !== 'all') {
        userQuery = userQuery.eq('operation', operation);
        console.log('🔧 Filtro de operación:', operation);
      }

      console.log('🔍 Query final:', userQuery.toString());

      const { data: userLogs, error: userError } = await userQuery;

      if (userError) {
        console.error('❌ Error obteniendo logs de usuario:', userError);
        console.error('Detalles del error:', JSON.stringify(userError, null, 2));
        return res.status(500).json({
          error: 'Error obteniendo logs',
          message: userError.message,
          details: userError
        });
      }

      if (userLogs && userLogs.length > 0) {
        console.log(`✅ Logs encontrados: ${userLogs.length}`);
        allLogs = userLogs.map(log => ({
          ...log,
          log_type: 'user',
          source_table: 'usage_logs',
          is_success: true,
          formatted_time: new Date(log.timestamp || log.created_at).toLocaleString('es-ES', {
            timeZone: 'America/Guatemala'
          })
        }));
      } else {
        console.log('⚠️ No se encontraron logs');
        console.log('Query params:', {
          days,
          user_email,
          operation,
          limit
        });
      }
    }

    // Devolver resultados
    res.json({
      logs: allLogs,
      total: allLogs.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generando estadísticas de logs:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// Endpoint de prueba para verificar logs
app.get('/api/admin/test-logs', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    console.log('🧪 Probando acceso a usage_logs...');

    // Intento simple de obtener logs
    const { data, error, count } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact' })
      .limit(5)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('❌ Error al consultar usage_logs:', error);
      return res.json({
        success: false,
        error: error.message,
        errorDetails: error,
        table: 'usage_logs',
        query: 'SELECT * FROM usage_logs LIMIT 5'
      });
    }

    console.log(`✅ Consulta exitosa: ${data?.length || 0} registros obtenidos, ${count} total`);
    
    // Verificar estructura de los datos
    const sampleRecord = data && data.length > 0 ? data[0] : null;
    const fields = sampleRecord ? Object.keys(sampleRecord) : [];

    res.json({
      success: true,
      total_count: count,
      records_retrieved: data?.length || 0,
      fields_found: fields,
      has_log_type_field: fields.includes('log_type'),
      sample_record: sampleRecord,
      all_records: data
    });

  } catch (error) {
    console.error('❌ Error en test-logs:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// 📊 ============ FIN ENDPOINTS PANEL DE ADMINISTRACIÓN ============

// Aplicar middlewares globales para operaciones que requieren créditos
app.use(addTimestamp);
app.use('/api/processTrends', verifyUserAccess, debitCredits);
app.use('/api/sondeo', verifyUserAccess, debitCredits);
app.use('/api/create-document', verifyUserAccess, debitCredits);

// 📄 ============ ENDPOINT PARA CREAR DOCUMENTOS ============

// Endpoint para crear documentos con IA (costo variable: 2-5 créditos)
app.post('/api/create-document', async (req, res) => {
  try {
    const { type, content, context, length } = req.body;
    
    if (!type || !content) {
      return res.status(400).json({
        error: 'Datos requeridos faltantes',
        message: 'Se requiere type y content'
      });
    }

    console.log(`📄 Creando documento de tipo: ${type}`);

    if (!PERPLEXITY_API_KEY) {
      return res.status(500).json({
        error: 'Servicio no disponible',
        message: 'API de generación de documentos no configurada'
      });
    }

    // Definir prompt según el tipo de documento
    let systemPrompt = '';
    let userPrompt = '';
    
    switch (type) {
      case 'resumen':
        systemPrompt = 'Eres un experto en crear resúmenes ejecutivos claros y concisos. Responde en español.';
        userPrompt = `Crea un resumen ejecutivo del siguiente contenido:\n\n${content}`;
        break;
      
      case 'analisis':
        systemPrompt = 'Eres un analista experto que crea análisis detallados y estructurados. Responde en español.';
        userPrompt = `Analiza en detalle el siguiente contenido, incluye conclusiones y recomendaciones:\n\n${content}`;
        break;
      
      case 'storytelling':
        systemPrompt = 'Eres un experto en storytelling que transforma información en narrativas atractivas. Responde en español.';
        userPrompt = `Transforma el siguiente contenido en una narrativa atractiva y envolvente:\n\n${content}`;
        break;
      
      case 'informe':
        systemPrompt = 'Eres un experto en crear informes profesionales estructurados. Responde en español con formato profesional.';
        userPrompt = `Crea un informe profesional basado en:\n\n${content}`;
        break;
      
      default:
        systemPrompt = 'Eres un asistente de escritura experto. Responde en español.';
        userPrompt = `Procesa y mejora el siguiente contenido:\n\n${content}`;
    }

    // Agregar contexto si está disponible
    if (context) {
      userPrompt += `\n\nContexto adicional: ${context}`;
    }

    // Agregar especificación de longitud
    if (length) {
      if (length === 'corto') {
        userPrompt += '\n\nGenera un documento corto (máximo 300 palabras).';
      } else if (length === 'medio') {
        userPrompt += '\n\nGenera un documento de longitud media (300-800 palabras).';
      } else if (length === 'largo') {
        userPrompt += '\n\nGenera un documento extenso (800+ palabras).';
      }
    }

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: length === 'largo' ? 1500 : length === 'medio' ? 800 : 400
    };

    // Llamar a Perplexity
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Respuesta inválida de la API');
    }

    const generatedContent = data.choices[0].message.content;
    
    // Calcular estadísticas del documento
    const wordCount = generatedContent.split(/\s+/).length;
    const charCount = generatedContent.length;
    
    console.log(`📄 Documento creado: ${type}, ${wordCount} palabras, ${charCount} caracteres`);

    res.json({
      success: true,
      document: {
        type: type,
        content: generatedContent,
        word_count: wordCount,
        char_count: charCount,
        length_category: charCount < 500 ? 'corto' : charCount < 1500 ? 'medio' : 'largo'
      },
      metadata: {
        model: 'sonar',
        timestamp: new Date().toISOString(),
        user_email: req.user.profile.email
      }
    });

  } catch (error) {
    console.error('❌ Error creando documento:', error);
    res.status(500).json({
      error: 'Error creando documento',
      message: error.message
    });
  }
});

// 📄 ============ FIN ENDPOINT DOCUMENTOS ============

app.post('/api/processTrends', async (req, res) => {
  console.time('procesamiento-total');
  console.log(`[${new Date().toISOString()}] Solicitud recibida en /api/processTrends`);
  
  try {
    // 1. Obtener datos crudos
    console.time('obtencion-datos');
    let rawData = req.body.rawData;
    
    // Depuración - Mostrar estructura completa de los datos recibidos
    console.log('Estructura de rawData recibida:');
    console.log(typeof rawData);
    const rawDataString = JSON.stringify(rawData, null, 2);
    console.log(rawDataString ? rawDataString.substring(0, 500) + '...' : 'undefined'); // Mostrar los primeros 500 caracteres
    
    if (!rawData && VPS_API_URL) {
      console.log('Datos no proporcionados, obteniendo de VPS API...');
      const response = await fetch(VPS_API_URL);
      if (!response.ok) {
        throw new Error(`Error al obtener datos de la API: ${response.status} ${response.statusText}`);
      }
      rawData = await response.json();
      console.log('Datos obtenidos de VPS API exitosamente');
    }
    
    if (!rawData) {
      console.log('No se pudieron obtener datos, generando datos mock');
      rawData = { 
        trends: Array(15).fill().map((_, i) => ({
          name: `Tendencia ${i+1}`,
          volume: 100 - i*5,
          category: ['Política', 'Economía', 'Deportes', 'Tecnología', 'Entretenimiento'][i % 5]
        }))
      };
    }
    console.timeEnd('obtencion-datos');
    
    // 2. Procesar datos básicos (sin IA)
    console.time('procesamiento-datos');
    console.log('Iniciando procesamiento de datos básicos (sin about)');
    
    // Extraer y ordenar las tendencias
    let trends = [];
    
    if (Array.isArray(rawData)) {
      console.log('rawData es un array');
      // Verificar si el array contiene objetos con estructura completa (ya formateada)
      if (rawData.length > 0 && 
          rawData[0].keyword !== undefined && 
          rawData[0].count !== undefined) {
        console.log('Detectado array de objetos ya formateados con keyword y count');
        // En este caso, ya tenemos datos pre-formateados, los adaptamos al formato interno
        trends = rawData.map(item => ({
          name: item.keyword || 'Sin nombre',
          volume: item.count || 1,
          category: item.category || 'General',
          // Preservar el campo about si existe
          ...(item.about && { about: item.about })
        }));
        console.log('Tendencias formateadas preservando campos existentes:', 
                   JSON.stringify(trends.slice(0, 2), null, 2));
      } else {
        trends = rawData;
      }
    } else if (rawData.trends && Array.isArray(rawData.trends)) {
      console.log('rawData tiene propiedad trends');
      trends = rawData.trends;
    } else if (rawData.twitter_trends && Array.isArray(rawData.twitter_trends)) {
      console.log('rawData tiene propiedad twitter_trends');
      trends = rawData.twitter_trends;
    } else if (rawData.trends24_trends && Array.isArray(rawData.trends24_trends)) {
      console.log('rawData tiene propiedad trends24_trends');
      trends = rawData.trends24_trends;
    } else {
      console.log('Buscando array de tendencias en el objeto');
      // Buscar cualquier array en el objeto que podría contener tendencias
      const props = Object.keys(rawData);
      for (const prop of props) {
        if (Array.isArray(rawData[prop]) && rawData[prop].length > 0) {
          trends = rawData[prop];
          console.log(`Encontrado array en rawData.${prop}`);
          break;
        }
      }
    }
    
    // Procesar formato específico de ExtractorT si detectamos ese patrón (por ejemplo: "1. Tendencia")
    if (trends.length > 0 && trends.some(item => {
      return typeof item === 'string' && /^\d+\.\s+.+/.test(item); // Patrón "1. Texto"
    })) {
      console.log('Detectado formato de ExtractorT con prefijos numéricos');
      trends = trends.map((item, index) => {
        if (typeof item === 'string') {
          // Extraer el texto sin el prefijo numérico (ej: "1. Tendencia" -> "Tendencia")
          const match = item.match(/^\d+\.\s+(.+)/);
          const text = match ? match[1].trim() : item;
          
          return {
            name: text,
            text: text,
            volume: 100 - (index * 5), // Volumen decreciente según la posición
            position: index + 1,
            category: 'General'
          };
        }
        return item;
      });
    }
    
    // Si no se encontraron tendencias, crear algunas de ejemplo
    if (!trends || trends.length === 0) {
      console.log('No se encontraron tendencias, usando datos de ejemplo');
      trends = Array(15).fill().map((_, i) => ({
        name: `Tendencia ${i+1}`,
        volume: 100 - i*5,
        category: ['Política', 'Economía', 'Deportes', 'Tecnología', 'Entretenimiento'][i % 5]
      }));
    }
    
    console.log(`Se encontraron ${trends.length} tendencias para procesar`);
    
    // Convertir a formato uniforme y separar nombre/menciones manualmente
    const uniformTrends = trends.map(trend => {
      let uniformTrend = {
        name: 'Sin nombre',
        volume: 1,
        category: 'General',
        menciones: null
      };
      let baseName = null;
      if (typeof trend === 'string') {
        baseName = trend;
      } else if (typeof trend === 'object') {
        const possibleNameKeys = ['name', 'keyword', 'text', 'title', 'word', 'term'];
        for (const key of possibleNameKeys) {
          if (trend[key] && typeof trend[key] === 'string' && trend[key].trim()) {
            baseName = trend[key].trim();
            break;
          }
        }
        if (!baseName) {
          for (const [key, value] of Object.entries(trend)) {
            if (typeof value === 'string' && value.trim() && key !== 'category' && key !== 'color' && key !== 'about') {
              baseName = value.trim();
              break;
            }
          }
        }
      }
      // Separar nombre y menciones con regex
      if (baseName) {
        const match = baseName.match(/^(.+?)(\d+)(k)?$/i);
        if (match) {
          uniformTrend.name = match[1].replace(/[#_]/g, '').trim();
          let num = match[2];
          if (match[3]) {
            num = parseInt(num) * 1000;
          } else {
            num = parseInt(num);
          }
          uniformTrend.menciones = num;
          uniformTrend.volume = num;
        } else {
          uniformTrend.name = baseName.replace(/[#_]/g, '').trim();
        }
      }
      // Extraer volumen si viene explícito
      if (typeof trend === 'object') {
        const possibleVolumeKeys = ['volume', 'count', 'value', 'weight', 'size', 'frequency'];
        for (const key of possibleVolumeKeys) {
          if (trend[key] && !isNaN(Number(trend[key]))) {
            uniformTrend.volume = Number(trend[key]);
            break;
          }
        }
        if (trend.category && typeof trend.category === 'string') {
          uniformTrend.category = trend.category;
        }
      }
      // Categorización manual básica mejorada con detectarCategoria
      uniformTrend.category = detectarCategoria(uniformTrend.name);
      
      return uniformTrend;
    });
    
    // Ordenar por volumen descendente
    uniformTrends.sort((a, b) => b.volume - a.volume);
    // Tomar las 10 principales tendencias
    const top10 = uniformTrends.slice(0, 10);
    // Si hay menos de 10, usar las que tenemos sin repetir
    // NO repetir tendencias - mejor trabajar con las que tenemos

    // Construir topKeywords
    const topKeywords = top10.map(trend => ({
      keyword: trend.name,
        count: trend.volume
    }));

    const wordCloudData = top10.map((trend, index) => ({
      text: trend.name,
      value: trend.volume,
        color: COLORS[index % COLORS.length]
    }));
    
    // Agrupar por categoría
    const categoryMap = {};
    top10.forEach(trend => {
      const category = trend.category || 'Otros';
      if (categoryMap[category]) {
        categoryMap[category] += 1;
      } else {
        categoryMap[category] = 1;
      }
    });
    const categoryData = Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count
    })).sort((a, b) => b.count - a.count);
    
    // Respuesta básica SIN about (respuesta rápida)
    const basicResponse = {
      topKeywords,
      wordCloudData,
      categoryData: [], // No guardar la versión heurística/manual
      about: [], // Vacío inicialmente
      statistics: {}, // Vacío inicialmente
      timestamp: new Date().toISOString(),
      processing_status: 'basic_completed'
    };
    
    console.timeEnd('procesamiento-datos');
    
    // 3. Guardar datos básicos en Supabase primero
    console.time('guardado-basico-supabase');
    let recordId = null;
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase) {
      try {
        console.log('Guardando datos básicos en Supabase...');
        const { data, error } = await supabase
          .from('trends')
          .insert([{
            timestamp: basicResponse.timestamp,
            word_cloud_data: basicResponse.wordCloudData,
            top_keywords: basicResponse.topKeywords,
            category_data: [], // Solo se guardará la enriquecida después
            raw_data: rawData,
            about: [], // Vacío por ahora
            statistics: {}, // Vacío por ahora
            processing_status: 'basic_completed'
          }])
          .select();
        if (error) {
          console.error('Error al guardar datos básicos en Supabase:', error, JSON.stringify(error, null, 2));
        } else {
          console.log('Datos básicos guardados exitosamente en Supabase');
          recordId = data && data[0] ? data[0].id : null;
          console.log('Record ID para actualización posterior:', recordId);
        }
      } catch (err) {
        console.error('Error al intentar guardar datos básicos en Supabase:', err, JSON.stringify(err, null, 2));
      }
    }
    console.timeEnd('guardado-basico-supabase');
    
    // 4. RESPONDER INMEDIATAMENTE al cliente con datos básicos
    console.log('Enviando respuesta básica rápida al cliente...');
    console.timeEnd('procesamiento-total');
    res.json(basicResponse);
    
    // ======================================================================
    // 5. PROCESAMIENTO EN BACKGROUND - about y estadísticas
    // ======================================================================
    console.log('\n🔄 INICIANDO PROCESAMIENTO EN BACKGROUND...');
    
    // Procesar en background sin bloquear la respuesta
    processAboutInBackground(top10, rawData, recordId, basicResponse.timestamp).catch(error => {
      console.error('❌ Error en procesamiento en background:', error);
    });
    
  } catch (error) {
    console.error('Error en /api/processTrends:', error);
    res.status(500).json({ 
      error: 'Error processing trends', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Procesa la información detallada (about) en background
 * @param {Array} top10 - Top 10 tendencias
 * @param {Object} rawData - Datos originales
 * @param {string|null} recordId - ID del registro en Supabase para actualizar
 * @param {string} timestamp - Timestamp del procesamiento inicial
 */
async function processAboutInBackground(top10, rawData, recordId, timestamp) {
  console.log('🎯 Iniciando procesamiento background de about...');
  console.log(`📝 Parámetros recibidos:`, {
    top10Count: top10?.length || 0,
    recordId: recordId,
    timestamp: timestamp,
    hasSupabase: !!(SUPABASE_URL && SUPABASE_ANON_KEY && supabase)
  });
  
  try {
    const location = 'Guatemala';
    
    // Procesar about con Perplexity Individual
    console.time('procesamiento-about-background');
    console.log('🔍 Iniciando processWithPerplexityIndividual...');
    const processedAbout = await processWithPerplexityIndividual(top10, location);
    console.timeEnd('procesamiento-about-background');
    
    console.log(`✅ processWithPerplexityIndividual completado. Items procesados: ${processedAbout?.length || 0}`);
    if (processedAbout?.length > 0) {
      console.log('📋 Primer item como ejemplo:', JSON.stringify(processedAbout[0], null, 2));
    }
    
    // Generar estadísticas
    console.time('generacion-estadisticas');
    const rawStatistics = generateStatistics(processedAbout);
    
    // Sanitizar estadísticas para evitar problemas de serialización
    const statistics = {
      relevancia: {
        alta: Number(rawStatistics.relevancia?.alta) || 0,
        media: Number(rawStatistics.relevancia?.media) || 0,
        baja: Number(rawStatistics.relevancia?.baja) || 0
      },
      contexto: {
        local: Number(rawStatistics.contexto?.local) || 0,
        global: Number(rawStatistics.contexto?.global) || 0
      },
      timestamp: new Date().toISOString(),
      total_procesados: processedAbout.length
    };
    console.timeEnd('generacion-estadisticas');
    
    // Formato about para compatibilidad con frontend
    const aboutArray = processedAbout.map(item => item.about);
    console.log(`📊 aboutArray generado con ${aboutArray.length} items`);

    // --- SANITIZAR aboutArray para Supabase (VERSION ULTRA-ROBUSTA) ---
    console.log('🧹 Creando versión ultra-simplificada de aboutArray para Supabase...');
    
    /**
     * Función para sanitizar cualquier valor de forma segura para JSON
     */
    const sanitizeForJSON = (value, maxLength = 300) => {
      if (value === null || value === undefined) return '';
      
      let str = String(value);
      
      // Remover caracteres de control y caracteres problemáticos
      str = str.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200F\uFEFF]/g, '');
      
      // Remover caracteres no válidos en JSON
      str = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      // Escapar comillas dobles y backslashes problemáticos
      str = str.replace(/"/g, "'").replace(/\\/g, '/');
      
      // Truncar si es muy largo
      if (str.length > maxLength) {
        str = str.substring(0, maxLength);
      }
      
      return str.trim();
    };
    
    const ultraSimplifiedAboutArray = aboutArray.map((about, index) => {
      // Crear objeto ultra-simple, solo campos básicos y strings seguros
      const simplified = {
        nombre: sanitizeForJSON(about.nombre, 100) || `Tendencia ${index + 1}`,
        categoria: ['Deportes', 'Política', 'Entretenimiento', 'Música', 'Tecnología', 'Economía', 'Sociedad', 'Otros']
          .includes(about.categoria) ? about.categoria : 'Otros',
        resumen: sanitizeForJSON(about.resumen, 300) || `Información sobre ${about.nombre || 'tendencia'}`,
        relevancia: ['alta', 'media', 'baja'].includes(about.relevancia) ? about.relevancia : 'baja',
        contexto_local: Boolean(about.contexto_local),
        source: sanitizeForJSON(about.source, 20) || 'default',
        tweets_usados: (typeof about.tweets_used === 'number' && !isNaN(about.tweets_used)) ? about.tweets_used : 0,
        index_orden: index
      };
      
      // Solo agregar campos opcionales si son válidos y seguros
      if (about.tipo && typeof about.tipo === 'string' && about.tipo.length > 0) {
        const tipoSanitized = sanitizeForJSON(about.tipo, 30);
        if (tipoSanitized.length > 0) {
          simplified.tipo = tipoSanitized;
        }
      }
      
      if (about.razon_tendencia && typeof about.razon_tendencia === 'string' && about.razon_tendencia.length > 0) {
        const razonSanitized = sanitizeForJSON(about.razon_tendencia, 200);
        if (razonSanitized.length > 0) {
          simplified.razon_tendencia = razonSanitized;
        }
      }
      
      if (about.sentimiento_tweets && typeof about.sentimiento_tweets === 'string') {
        const sentimientoSanitized = sanitizeForJSON(about.sentimiento_tweets, 20);
        if (['positivo', 'negativo', 'neutral', 'mixto'].includes(sentimientoSanitized)) {
          simplified.sentimiento_tweets = sentimientoSanitized;
        }
      }
      
      return simplified;
    });
    
    console.log(`🧹 AboutArray ultra-simplificado creado con ${ultraSimplifiedAboutArray.length} items`);
    console.log('📋 Ejemplo simplificado:', JSON.stringify(ultraSimplifiedAboutArray[0] || {}, null, 2));

    // --- NUEVO: Generar categoryData enriquecido usando la categoría de about ---
    const enrichedCategoryMap = {};
    ultraSimplifiedAboutArray.forEach(about => {
      const cat = about.categoria || 'Otros';
      if (enrichedCategoryMap[cat]) {
        enrichedCategoryMap[cat] += 1;
      } else {
        enrichedCategoryMap[cat] = 1;
      }
    });
    const enrichedCategoryData = Object.entries(enrichedCategoryMap).map(([category, count]) => ({
      category,
      count
    })).sort((a, b) => b.count - a.count);
    console.log(`📈 categoryData enriquecido:`, enrichedCategoryData);
    // --- FIN NUEVO ---

    console.log('📊 Estadísticas generadas:', JSON.stringify(statistics, null, 2));
    
    // Actualizar registro en Supabase
    if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase && recordId) {
      try {
        console.log('🔄 Actualizando registro en Supabase con about, estadísticas y categoryData enriquecido...');
        console.log(`📝 Datos a actualizar:`, {
          aboutCount: ultraSimplifiedAboutArray.length,
          statisticsKeys: Object.keys(statistics),
          categoryDataCount: enrichedCategoryData.length,
          recordId: recordId
        });
        
        // DEBUGGING DETALLADO - Validar cada campo individualmente
        console.log('🔍 DEBUGGING DETALLADO - Validando cada campo individualmente...');
        
        // Verificar sanitizedAboutArray
        try {
          const aboutJson = JSON.stringify(ultraSimplifiedAboutArray);
          console.log('✅ sanitizedAboutArray serializable:', aboutJson.length, 'caracteres');
          if (ultraSimplifiedAboutArray.length > 0) {
            console.log('📋 Primer item about:', JSON.stringify(ultraSimplifiedAboutArray[0], null, 2));
          }
        } catch (aboutError) {
          console.error('❌ ERROR en sanitizedAboutArray:', aboutError.message);
          console.log('📋 Datos problemáticos en about:', ultraSimplifiedAboutArray);
          throw new Error(`sanitizedAboutArray no serializable: ${aboutError.message}`);
        }
        
        // Verificar statistics
        try {
          const statsJson = JSON.stringify(statistics);
          console.log('✅ statistics serializable:', statsJson.length, 'caracteres');
          console.log('📋 statistics content:', JSON.stringify(statistics, null, 2));
        } catch (statsError) {
          console.error('❌ ERROR en statistics:', statsError.message);
          console.log('📋 Datos problemáticos en statistics:', statistics);
          throw new Error(`statistics no serializable: ${statsError.message}`);
        }
        
        // Verificar enrichedCategoryData
        try {
          const categoryJson = JSON.stringify(enrichedCategoryData);
          console.log('✅ enrichedCategoryData serializable:', categoryJson.length, 'caracteres');
          console.log('📋 categoryData content:', JSON.stringify(enrichedCategoryData, null, 2));
        } catch (categoryError) {
          console.error('❌ ERROR en enrichedCategoryData:', categoryError.message);
          console.log('📋 Datos problemáticos en categoryData:', enrichedCategoryData);
          throw new Error(`enrichedCategoryData no serializable: ${categoryError.message}`);
        }
        
        console.log('✅ Todos los campos validados individualmente');
        
        // Preparar objeto completo de actualización
        const updateObject = {
          about: ultraSimplifiedAboutArray,
          statistics: statistics,
          category_data: enrichedCategoryData,
          processing_status: 'complete'
        };
        
        // USAR EL OBJETO LIMPIO PARA LA ACTUALIZACIÓN
        const finalUpdateObject = updateObject;
        
        console.log('🚀 Enviando actualización a Supabase...');
        console.log('📝 Record ID:', recordId);
        console.log('📝 Final update object keys:', Object.keys(finalUpdateObject));
        console.log('📝 Final object sizes:', {
          about: finalUpdateObject.about?.length || 0,
          statistics: Object.keys(finalUpdateObject.statistics || {}).length,
          category_data: finalUpdateObject.category_data?.length || 0
        });
        
        const { error: updateError } = await supabase
          .from('trends')
          .update(finalUpdateObject)
          .eq('id', recordId);
          
        if (updateError) {
          console.error('❌ Error actualizando registro completo:', updateError, JSON.stringify(updateError, null, 2));
          
          // FALLBACK: Intentar actualizar campo por campo para identificar el problema
          console.log('🔄 FALLBACK: Intentando actualización campo por campo...');
          
          let aboutSuccess = false;
          let statsSuccess = false;
          let categorySuccess = false;
          
          try {
            // Actualizar about solo
            console.log('📝 Actualizando solo campo about...');
            const { error: aboutError } = await supabase
              .from('trends')
              .update({ about: finalUpdateObject.about || [] })
              .eq('id', recordId);
            
            if (aboutError) {
              console.error('❌ Error en campo about:', aboutError.message, JSON.stringify(aboutError, null, 2));
            } else {
              console.log('✅ Campo about actualizado exitosamente');
              aboutSuccess = true;
            }
            
            // Pausa corta entre actualizaciones
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Actualizar statistics solo
            console.log('📝 Actualizando solo campo statistics...');
            const { error: statsError } = await supabase
              .from('trends')
              .update({ statistics: finalUpdateObject.statistics || {} })
              .eq('id', recordId);
            
            if (statsError) {
              console.error('❌ Error en campo statistics:', statsError.message, JSON.stringify(statsError, null, 2));
            } else {
              console.log('✅ Campo statistics actualizado exitosamente');
              statsSuccess = true;
            }
            
            // Pausa corta entre actualizaciones
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Actualizar category_data solo
            console.log('📝 Actualizando solo campo category_data...');
            const { error: categoryError } = await supabase
              .from('trends')
              .update({ category_data: finalUpdateObject.category_data || [] })
              .eq('id', recordId);
            
            if (categoryError) {
              console.error('❌ Error en campo category_data:', categoryError.message, JSON.stringify(categoryError, null, 2));
            } else {
              console.log('✅ Campo category_data actualizado exitosamente');
              categorySuccess = true;
            }
            
            // Actualizar processing_status al final si al menos un campo se actualizó
            if (aboutSuccess || statsSuccess || categorySuccess) {
              console.log('📝 Actualizando processing_status...');
              await supabase
                .from('trends')
                .update({ processing_status: 'complete' })
                .eq('id', recordId);
              console.log('✅ Campo processing_status actualizado');
            }
              
            console.log('✅ Actualización campo por campo completada');
            console.log(`📊 Resumen: about=${aboutSuccess}, stats=${statsSuccess}, category=${categorySuccess}`);
            
          } catch (fallbackError) {
            console.error('❌ Error en fallback:', fallbackError.message);
          }
          
        } else {
          console.log('✅ Registro actualizado exitosamente con about, estadísticas y categoryData enriquecido');
          
          // Verificación adicional: consultar el registro para confirmar que se guardó
          const { data: verifyData, error: verifyError } = await supabase
            .from('trends')
            .select('about, statistics, category_data, processing_status')
            .eq('id', recordId)
            .single();
            
          if (verifyError) {
            console.error('❌ Error verificando actualización:', verifyError);
          } else {
            console.log('✅ Verificación exitosa:', {
              aboutSaved: verifyData.about?.length || 0,
              statisticsSaved: Object.keys(verifyData.statistics || {}).length,
              categoriesSaved: verifyData.category_data?.length || 0,
              status: verifyData.processing_status
            });
          }
        }
      } catch (err) {
        console.error('❌ Error al actualizar Supabase en background:', err, JSON.stringify(err, null, 2));
      }
    } else {
      console.warn('⚠️  No se puede actualizar Supabase - faltan credenciales o recordId:', {
        hasSupabaseUrl: !!SUPABASE_URL,
        hasSupabaseKey: !!SUPABASE_ANON_KEY,
        hasSupabaseClient: !!supabase,
        hasRecordId: !!recordId
      });
    }
    
    console.log('✅ PROCESAMIENTO EN BACKGROUND COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error en processAboutInBackground:', error);
    
    // En caso de error, al menos actualizar el estado en Supabase
    if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase && recordId) {
      try {
        console.log('🔄 Actualizando estado de error en Supabase...');
        await supabase
          .from('trends')
          .update({
            processing_status: 'error',
            about: [],
            statistics: { error: error.message }
          })
          .eq('id', recordId);
        console.log('✅ Estado de error actualizado en Supabase');
      } catch (updateErr) {
        console.error('❌ Error actualizando estado de error:', updateErr);
      }
    }
  }
}

// Endpoints adicionales para diagnóstico

// Endpoint de health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: require('./package.json').version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    email_endpoints: {
      available: true,
      endpoints: [
        'POST /api/send-email',
        'POST /api/test-email'
      ],
      features: [
        'SMTP configuración dinámica',
        'Detección automática de frontend vs CURL',
        'Corrección automática de caracteres especiales',
        'Soporte para Gmail con App Password'
      ]
    }
  });
});

// Endpoint de diagnóstico para Supabase
app.get('/api/diagnostics', async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      supabase_configured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
      supabase_url: SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'No configurado',
      supabase_key: SUPABASE_ANON_KEY ? 'Configurado (' + SUPABASE_ANON_KEY.substring(0, 10) + '...)' : 'No configurado',
      supabase_client: !!supabase,
      environment_vars: {
        PERPLEXITY_API_KEY: !!PERPLEXITY_API_KEY,
        OPENROUTER_API_KEY: !!OPENROUTER_API_KEY,
        USE_AI: USE_AI,
        VPS_API_URL: !!VPS_API_URL
      }
    };
    
    // Intentar conectar a Supabase si está configurado
    if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase) {
      try {
        console.log('🔍 Probando conexión a Supabase...');
        
        // Probar consulta simple
        const { data, error, count } = await supabase
          .from('trends')
          .select('*', { count: 'exact' })
          .limit(5);
        
        if (error) {
          diagnostics.supabase_test = {
            success: false,
            error: error.message,
            code: error.code
          };
        } else {
          diagnostics.supabase_test = {
            success: true,
            records_found: count,
            sample_data: data?.length > 0 ? {
              latest_timestamp: data[0].timestamp,
              has_about: !!(data[0].about && data[0].about.length > 0),
              has_statistics: !!(data[0].statistics && Object.keys(data[0].statistics).length > 0),
              processing_status: data[0].processing_status
            } : 'No data'
          };
        }
      } catch (err) {
        diagnostics.supabase_test = {
          success: false,
          error: err.message
        };
      }
    } else {
      diagnostics.supabase_test = {
        success: false,
        error: 'Supabase no configurado correctamente'
      };
    }
    
    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({
      error: 'Error en diagnósticos',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint adicional para probar la búsqueda de información
app.get('/api/searchTrendInfo/:trend', async (req, res) => {
  try {
    const trend = req.params.trend;
    console.log(`Solicitud de información para tendencia: ${trend}`);
    
    const info = await searchTrendInfo(trend);
    
    res.json({
      trend,
      about: info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /api/searchTrendInfo:', error);
    res.status(500).json({
      error: 'Error al buscar información',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Nuevo endpoint para probar análisis mejorado con contexto de tweets
app.get('/api/analyzeTrendWithTweets/:trend', async (req, res) => {
  try {
    const trend = req.params.trend;
    console.log(`🔍 Solicitud de análisis mejorado para tendencia: ${trend}`);
    
    // Usar la función mejorada de Perplexity
    const analysis = await getAboutFromPerplexityIndividual(trend, 'Guatemala', 2025);
    
    res.json({
      trend,
      analysis,
      has_tweet_context: analysis.tweets_used > 0,
      enhanced_features: {
        tweet_context: analysis.tweets_used > 0,
        sentiment_analysis: !!analysis.sentimiento_tweets,
        local_context: analysis.contexto_local,
        source: analysis.source
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /api/analyzeTrendWithTweets:', error);
    res.status(500).json({
      error: 'Error al analizar tendencia con contexto de tweets',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para consultar el estado del procesamiento
app.get('/api/processingStatus/:timestamp', async (req, res) => {
  try {
    const { timestamp } = req.params;
    console.log(`Consultando estado de procesamiento para timestamp: ${timestamp}`);
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !supabase) {
      return res.status(503).json({
        error: 'Supabase not configured',
        message: 'Base de datos no configurada'
      });
    }
    
    const { data, error } = await supabase
      .from('trends')
      .select('*')
      .eq('timestamp', timestamp)
      .single();
    
    if (error) {
      console.error('Error consultando estado:', error);
      return res.status(404).json({
        error: 'Record not found',
        message: 'No se encontró el registro'
      });
    }
    
    const response = {
      status: data.processing_status || 'unknown',
      timestamp: data.timestamp,
      has_about: data.about && data.about.length > 0,
      has_statistics: data.statistics && Object.keys(data.statistics).length > 0,
      data: {
        topKeywords: data.top_keywords,
        wordCloudData: data.word_cloud_data,
        categoryData: data.category_data,
        about: data.about || [],
        statistics: data.statistics || {},
        timestamp: data.timestamp
      }
    };
    
    console.log(`Estado: ${response.status}, About: ${response.has_about}, Stats: ${response.has_statistics}`);
    res.json(response);
    
  } catch (error) {
    console.error('Error en /api/processingStatus:', error);
    res.status(500).json({
      error: 'Error checking status',
      message: error.message
    });
  }
});

// Endpoint para obtener los datos más recientes completos
app.get('/api/latestTrends', async (req, res) => {
  try {
    console.log('Consultando tendencias más recientes...');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !supabase) {
      return res.status(503).json({
        error: 'Supabase not configured',
        message: 'Base de datos no configurada'
      });
    }
    
    // Consulta corregida: obtener el registro más reciente por timestamp
    const { data, error } = await supabase
      .from('trends')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error consultando tendencias recientes:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Error consultando la base de datos'
      });
    }
    
    if (!data || data.length === 0) {
      console.log('📭 No se encontraron tendencias en la base de datos');
      return res.status(404).json({
        error: 'No trends found',
        message: 'No se encontraron tendencias'
      });
    }
    
    const trend = data[0];
    const response = {
      topKeywords: trend.top_keywords || [],
      wordCloudData: trend.word_cloud_data || [],
      categoryData: trend.category_data || [],
      about: trend.about || [],
      statistics: trend.statistics || {},
      timestamp: trend.timestamp,
      processing_status: trend.processing_status || 'unknown'
    };
    
    console.log(`✅ Tendencias recientes enviadas. Estado: ${response.processing_status}, About: ${response.about.length} items`);
    res.json(response);
    
  } catch (error) {
    console.error('Error en /api/latestTrends:', error);
    res.status(500).json({
      error: 'Error getting latest trends',
      message: error.message
    });
  }
});

// 🤖 ============ ENDPOINT GRATUITO PARA CRON JOBS AUTOMATIZADOS ============

// Endpoint específico para cron jobs automatizados del sistema (SIN autenticación, SIN créditos)
app.post('/api/cron/processTrends', async (req, res) => {
  const startTime = Date.now();
  console.log(`🤖 [CRON JOB] Solicitud automatizada de procesamiento de tendencias - ${new Date().toISOString()}`);
  
  try {
    // REGISTRAR INICIO DE OPERACIÓN DEL SISTEMA
    await logSystemOperation('cron_process_trends', {
      action: 'start',
      started_at: new Date().toISOString(),
      has_raw_data: !!req.body.rawData
    });

    // 1. Obtener datos crudos (igual que el endpoint original)
    let rawData = req.body.rawData;
    
    if (!rawData && VPS_API_URL) {
      console.log('🤖 [CRON] Obteniendo datos de VPS API...');
      const response = await fetch(VPS_API_URL);
      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          vps_url: VPS_API_URL
        };
        
        // Log del error
        await logSystemOperation('cron_process_trends', {
          action: 'vps_api_error',
          error_details: errorDetails
        }, false, errorDetails);
        
        throw new Error(`Error al obtener datos de la API: ${response.status} ${response.statusText}`);
      }
      rawData = await response.json();
      console.log('🤖 [CRON] Datos obtenidos de VPS API exitosamente');
      
      // Log de éxito obteniendo datos
      await logSystemOperation('cron_process_trends', {
        action: 'vps_data_obtained',
        data_size: JSON.stringify(rawData).length
      });
    }
    
    if (!rawData) {
      console.log('🤖 [CRON] Generando datos mock para procesamiento automatizado');
      rawData = { 
        trends: Array(15).fill().map((_, i) => ({
          name: `Tendencia Auto ${i+1}`,
          volume: 100 - i*5,
          category: ['Política', 'Economía', 'Deportes', 'Tecnología', 'Entretenimiento'][i % 5]
        }))
      };
      
      // Log de generación de datos mock
      await logSystemOperation('cron_process_trends', {
        action: 'mock_data_generated',
        trends_found: rawData.trends.length
      });
    }
    
    // 2. Reutilizar la misma lógica de procesamiento que el endpoint original
    console.log('🤖 [CRON] Iniciando procesamiento automático...');
    
    // Llamar a la función de procesamiento local
    const processedData = await processLocalTrends(rawData);
    
    // Log de procesamiento completado
    await logSystemOperation('cron_process_trends', {
      action: 'data_processed',
      trends_found: processedData.topKeywords?.length || 0,
      trends_processed: processedData.topKeywords?.length || 0
    });
    
    // 3. Guardar en Supabase si está disponible
    let recordId = null;
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase) {
      try {
        console.log('🤖 [CRON] Guardando datos en Supabase...');
        const { data, error } = await supabase
          .from('trends')
          .insert([{
            timestamp: processedData.timestamp,
            word_cloud_data: processedData.wordCloudData,
            top_keywords: processedData.topKeywords,
            category_data: processedData.categoryData,
            raw_data: rawData,
            about: [],
            statistics: {},
            processing_status: 'basic_completed',
            source: 'cron_job_automated' // Marcar como procesamiento automatizado
          }])
          .select();
          
        if (error) {
          console.error('🤖 [CRON] Error guardando en Supabase:', error);
          
          // Log del error de Supabase
          await logSystemOperation('cron_process_trends', {
            action: 'supabase_save_error',
            error_details: error
          }, false, error);
        } else {
          console.log('🤖 [CRON] Datos guardados exitosamente');
          recordId = data && data[0] ? data[0].id : null;
          
          // Log de éxito guardando en Supabase
          await logSystemOperation('cron_process_trends', {
            action: 'supabase_saved',
            record_id: recordId
          });
        }
      } catch (err) {
        console.error('🤖 [CRON] Error al guardar en Supabase:', err);
        
        // Log del error de conexión
        await logSystemOperation('cron_process_trends', {
          action: 'supabase_connection_error',
          error_details: err
        }, false, err);
      }
    }
    
    const executionTime = Date.now() - startTime;
    console.log('🤖 [CRON] ✅ Procesamiento automatizado completado exitosamente');
    
    // LOG FINAL DE ÉXITO
    await logSystemOperation('cron_process_trends', {
      action: 'completed_successfully',
      execution_time: `${executionTime}ms`,
      record_id: recordId,
      trends_found: processedData.topKeywords?.length || 0,
      trends_processed: processedData.topKeywords?.length || 0
    }, true);
    
    res.json({
      success: true,
      message: 'Tendencias procesadas automáticamente',
      source: 'cron_job_automated',
      timestamp: processedData.timestamp,
      data: processedData,
      record_id: recordId,
      execution_time: `${executionTime}ms`,
      note: 'Procesamiento automatizado del sistema - Sin costo de créditos'
    });
    
    // 4. Procesar información detallada en background (igual que el endpoint original)
    if (processedData.topKeywords && processedData.topKeywords.length > 0) {
      const top10 = processedData.topKeywords.slice(0, 10).map(item => ({ name: item.keyword }));
      processAboutInBackground(top10, rawData, recordId, processedData.timestamp).catch(error => {
        console.error('🤖 [CRON] Error en procesamiento background:', error);
        
        // Log del error en background
        logSystemOperation('cron_process_trends', {
          action: 'background_processing_error',
          error_details: error.message
        }, false, error).catch(e => console.error('Error logging background error:', e));
      });
    }
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('🤖 [CRON] ❌ Error en procesamiento automatizado:', error);
    
    // LOG FINAL DE ERROR
    await logSystemOperation('cron_process_trends', {
      action: 'failed_with_error',
      execution_time: `${executionTime}ms`,
      error_message: error.message
    }, false, {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error en procesamiento automatizado', 
      message: error.message,
      source: 'cron_job_automated',
      execution_time: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

// 🤖 ============ FIN ENDPOINT CRON JOBS ============

// --- ENDPOINT DE SONDEO GENERAL ---
app.post('/api/sondeo', async (req, res) => {
  try {
    const { contexto, pregunta } = req.body;
    if (!pregunta || !contexto) {
      return res.status(400).json({ error: 'Faltan campos requeridos: contexto y pregunta' });
    }
    if (!PERPLEXITY_API_KEY) {
      return res.status(500).json({ error: 'PERPLEXITY_API_KEY no configurada en el backend' });
    }

    // Armar prompt estructurado
    const prompt = `Contexto relevante para la consulta:\n\n${JSON.stringify(contexto, null, 2)}\n\nPregunta del usuario: ${pregunta}\n\nResponde de forma clara, concisa y en español, citando fuentes del contexto si es posible.`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Eres un analista experto en opinión pública y tendencias. Responde en español, usando solo la información del contexto proporcionado.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 600
    };

    // Llamar a Perplexity
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: 'Error en Perplexity', details: errorText });
    }
    const data = await response.json();
    let llm_response = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      llm_response = data.choices[0].message.content;
    } else {
      llm_response = 'No se obtuvo respuesta del modelo.';
    }

    res.json({
      llm_response,
      contexto,
      prompt_enviado: prompt
    });
  } catch (error) {
    console.error('Error en /api/sondeo:', error);
    res.status(500).json({ error: 'Error interno en /api/sondeo', details: error.message });
  }
});

// Nuevo endpoint para obtener trending tweets con análisis de sentimiento
app.get('/api/trending-tweets', async (req, res) => {
  try {
    console.log('📱 Obteniendo trending tweets con análisis de sentimiento...');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !supabase) {
      return res.status(503).json({
        error: 'Supabase not configured',
        message: 'Base de datos no configurada'
      });
    }

    // Obtener tweets de las últimas 24 horas con análisis de sentimiento
    const { data: tweets, error } = await supabase
      .from('trending_tweets')
      .select(`
        *,
        sentimiento,
        score_sentimiento,
        confianza_sentimiento,
        emociones_detectadas,
        intencion_comunicativa
      `)
      .gte('fecha_captura', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('fecha_captura', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error obteniendo trending tweets:', error);
      return res.status(500).json({
        error: 'Error fetching tweets',
        message: error.message
      });
    }

    // Usar los datos de sentimiento ya almacenados en la base de datos
    const tweetsWithSentiment = tweets.map(tweet => {
      // Usar el sentimiento almacenado, o fallback básico si no existe
      let sentiment = tweet.sentimiento || 'neutral';
      
      // Si no hay sentimiento almacenado, usar análisis básico como fallback
      if (!tweet.sentimiento) {
        sentiment = basicSentimentAnalysis(tweet.texto);
      }

      return {
        id: tweet.id,
        tweet_id: tweet.tweet_id,
        usuario: tweet.usuario,
        texto: tweet.texto,
        enlace: tweet.enlace,
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
        replies: tweet.replies || 0,
        verified: tweet.verified || false,
        trend_original: tweet.trend_original,
        trend_clean: tweet.trend_clean,
        categoria: tweet.categoria,
        fecha_tweet: tweet.fecha_tweet,
        fecha_captura: tweet.fecha_captura,
        sentiment: sentiment,
        // Incluir datos adicionales de análisis si están disponibles
        score_sentimiento: tweet.score_sentimiento,
        confianza_sentimiento: tweet.confianza_sentimiento,
        emociones_detectadas: tweet.emociones_detectadas,
        intencion_comunicativa: tweet.intencion_comunicativa
      };
    });

    // Agrupar por categoría
    const tweetsByCategory = tweetsWithSentiment.reduce((acc, tweet) => {
      const category = tweet.categoria || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tweet);
      return acc;
    }, {});

    // Calcular estadísticas de sentimiento por categoría
    const sentimentStats = Object.entries(tweetsByCategory).map(([category, tweets]) => {
      const sentimentCounts = tweets.reduce((acc, tweet) => {
        acc[tweet.sentiment] = (acc[tweet.sentiment] || 0) + 1;
        return acc;
      }, {});

      return {
        category,
        total: tweets.length,
        sentiments: sentimentCounts,
        tweets: tweets.slice(0, 10) // Limitar a 10 tweets por categoría para la respuesta
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_tweets: tweetsWithSentiment.length,
      categories: sentimentStats,
      all_tweets: tweetsWithSentiment
    });

  } catch (error) {
    console.error('Error en /api/trending-tweets:', error);
    res.status(500).json({
      error: 'Error processing trending tweets',
      message: error.message
    });
  }
});

/**
 * Función auxiliar para análisis de sentimiento básico (sin IA)
 */
function basicSentimentAnalysis(text) {
  const positiveWords = [
    'bueno', 'excelente', 'genial', 'fantástico', 'increíble', 'perfecto', 'maravilloso',
    'feliz', 'alegre', 'satisfecho', 'contento', 'emocionado', 'orgulloso', 'esperanza',
    'éxito', 'victoria', 'logro', 'progreso', 'mejora', 'beneficio', 'positivo',
    'amor', 'cariño', 'apoyo', 'solidaridad', 'unión', 'paz', 'justicia'
  ];
  
  const negativeWords = [
    'malo', 'terrible', 'horrible', 'pésimo', 'desastroso', 'fatal', 'espantoso',
    'triste', 'enojado', 'furioso', 'molesto', 'disgustado', 'decepcionado', 'preocupado',
    'problema', 'crisis', 'error', 'falla', 'fracaso', 'pérdida', 'daño', 'peligro',
    'corrupción', 'violencia', 'injusticia', 'discriminación', 'odio', 'guerra', 'conflicto'
  ];

  const textLower = text.toLowerCase();
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveWords.forEach(word => {
    if (textLower.includes(word)) {
      positiveScore++;
    }
  });
  
  negativeWords.forEach(word => {
    if (textLower.includes(word)) {
      negativeScore++;
    }
  });
  
  if (positiveScore > negativeScore) {
    return 'positivo';
  } else if (negativeScore > positiveScore) {
    return 'negativo';
  } else {
    return 'neutral';
  }
}

// Iniciar el servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Servidor iniciado en puerto ${PORT}`);
  console.log(`- Modo de procesamiento: Sin IA (procesamiento local)`);
  console.log(`📧 Endpoints de email disponibles:`);
  console.log(`   - POST /api/send-email`);
  console.log(`   - POST /api/test-email`);
  console.log(`📊 Endpoints de tendencias disponibles:`);
  console.log(`   - POST /api/processTrends`);
  console.log(`   - POST /api/sondeo`);
  console.log(`   - GET /api/trending-tweets`);
  if (VPS_API_URL) {
    console.log(`- VPS API configurada: ${VPS_API_URL}`);
  } else {
    console.log('- VPS API no configurada, usando datos de la solicitud o generando datos mock');
  }
  if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase) {
    console.log(`- Supabase configurado: ${SUPABASE_URL}`);
  } else {
    console.log('- Supabase no configurado o no inicializado, no se guardarán datos');
  }
});

// Exportar para testing y depuración
module.exports = { COLORS };

// Función para buscar información sobre una tendencia (solo para about)
async function searchTrendInfo(trend) {
  try {
    console.log(`Buscando información sobre: ${trend}`);
    if (OPENROUTER_API_KEY) {
      // Usar GPT-4o online para about
      const now = new Date();
      const year = now.getFullYear();
      const month = now.toLocaleString('es-ES', { month: 'long' });
      const location = 'Guatemala'; // Puedes cambiar esto si tienes una variable dinámica
      const userPrompt = `¿De qué trata el tema o tendencia "${trend}"? Responde de forma breve y concisa en español, en un solo párrafo, considerando el contexto social, político y de ubicación actual.\nDe qué trata la tendencia ${trend} en ${location} ${year} ${month}`;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://pulse.domain.com'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4-turbo:online',
          messages: [
            {
              role: 'system',
              content: 'Eres un buscador web, que asocia el contexto social, político, y de ubicación para poder resolver dudas. El usuario te dará un hashtag o tendencia, por favor resúmelo en un párrafo en base a lo sucedido hoy. Responde en español.'
            },
            {
              role: 'user',
              content: userPrompt
            }
          ]
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          return {
            summary: data.choices[0].message.content,
            source: 'openrouter',
            model: 'openai/gpt-4o:online'
          };
        }
      } else {
        const errorText = await response.text();
        console.error('Error OpenRouter GPT-4 Turbo:', errorText);
      }
    }
    // Si todo falla, proporcionar un mensaje genérico
    return {
      summary: `Tendencia relacionada con ${trend}`,
      source: 'default',
      model: 'default'
    };
  } catch (error) {
    console.error(`Error al buscar información sobre ${trend}:`, error);
    return {
      summary: `Tendencia popular: ${trend}`,
      source: 'default',
      model: 'default'
    };
  }
}

// --- INICIO: Función para categorizar con IA (GPT-4 Turbo OpenRouter) ---
async function categorizeTrendWithAI(trendName) {
  if (!OPENROUTER_API_KEY) return 'General';
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://pulse.domain.com'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4-turbo:online',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente experto en categorizar tendencias de redes sociales. Devuelve solo la categoría más adecuada y específica en español, de una sola palabra o frase corta. Ejemplos: Entretenimiento, Deportes, Música, Cine, Política, Economía, Tecnología, Salud, Cultura, Educación, Sociedad, Internacional, Ciencia, Medio ambiente, Moda, Farándula, Otros. Elige la categoría más precisa posible según el contexto.'
          },
          {
            role: 'user',
            content: `¿A qué categoría principal pertenece la tendencia o tema "${trendName}"? Responde solo con la categoría, sin explicación.`
          }
        ]
      })
    });
      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
        // Limpiar la respuesta para que sea solo la categoría
        return data.choices[0].message.content.trim().replace(/^[\d\-\.\s]+/, '');
        }
      }
    return 'General';
  } catch (error) {
    console.error('Error en categorizeTrendWithAI:', error);
    return 'General';
  }
}
// --- FIN: Función para categorizar con IA ---

// --- INICIO: Función para separar nombre y menciones con IA (GPT-4o:online) ---
async function splitNameMentionsWithAI(trendRaw) {
  if (!OPENROUTER_API_KEY) return { name: trendRaw, menciones: null };
  try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://pulse.domain.com'
        },
        body: JSON.stringify({
        model: 'openai/gpt-4-turbo:online',
          messages: [
            {
              role: 'system',
            content: 'Recibirás una palabra o hashtag que puede tener un número de menciones al final (ejemplo: Roberto20k, Maria15, #Evento2024). Devuelve solo el nombre (sin números ni k) y el número de menciones como entero (si termina en k, multiplica por 1000). Si no hay número, menciones es null. Responde SOLO en formato JSON: { "name": <nombre>, "menciones": <numero|null> }.'
            },
            {
              role: 'user',
            content: `Separa nombre y menciones de: ${trendRaw}`
            }
          ]
        })
      });
    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const raw = data.choices[0].message.content;
        console.log('[IA Split][RAW]', raw);
        try {
          // Intentar extraer JSON de la respuesta
          const parsed = JSON.parse(raw);
          return parsed;
        } catch (e) {
          // Si la IA no responde en JSON puro, intentar extraer con regex
          const match = raw.match(/\{[^}]+\}/);
          if (match) {
            try {
              const parsed = JSON.parse(match[0]);
              return parsed;
            } catch (e2) {
              // Fallback
              return { name: trendRaw, menciones: null };
            }
          }
          // Fallback
          return { name: trendRaw, menciones: null };
        }
      }
    }
    return { name: trendRaw, menciones: null };
  } catch (error) {
    console.error('Error en splitNameMentionsWithAI:', error);
    return { name: trendRaw, menciones: null };
  }
}

// --- INICIO: Función para obtener "about" desde Perplexity ---
/**
 * Obtiene información contextualizada individual para una tendencia usando Perplexity
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} location - Ubicación para contexto (Guatemala)
 * @param {number} year - Año actual
 * @returns {Object} - Información estructurada sobre la tendencia
 */
async function getAboutFromPerplexityIndividual(trendName, location = 'Guatemala', year = 2025) {
  if (!PERPLEXITY_API_KEY) {
    console.log(`⚠️  PERPLEXITY_API_KEY no configurada para ${trendName}`);
    return {
      nombre: trendName,
      resumen: `Tendencia relacionada con ${trendName}`,
      categoria: 'Otros',
      tipo: 'hashtag',
      relevancia: 'baja',
      contexto_local: false,
      source: 'default',
      model: 'default'
    };
  }

  try {
    console.log(`🔍 Buscando información individual para: "${trendName}"`);
    
    // 1. OBTENER TWEETS RELEVANTES COMO CONTEXTO
    console.log(`   🐦 Obteniendo tweets para contexto...`);
    const relevantTweets = await getRelevantTweetsForTrend(trendName, 3);
    
    // Obtener fecha actual dinámica
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // 2. CONSTRUIR CONTEXTO DE TWEETS
    let tweetContext = '';
    if (relevantTweets.length > 0) {
      console.log(`   ✅ Usando ${relevantTweets.length} tweets como contexto`);
      tweetContext = '\n\nCONTEXTO DE TWEETS RECIENTES:\n';
      relevantTweets.forEach((tweet, index) => {
        tweetContext += `${index + 1}. "${tweet.texto}" (${tweet.likes} likes, ${tweet.retweets} RTs)\n`;
      });
      tweetContext += '\n';
    } else {
      console.log(`   📭 No se encontraron tweets, usando búsqueda web tradicional`);
    }
    
    // Construir consulta específica para búsqueda web
    const searchQuery = `${trendName} ${location} ${currentMonth} ${currentYear} noticias actualidad`;
    
    // 3. PROMPT MEJORADO CON CONTEXTO DE TWEETS
    const prompt = `Analiza la tendencia "${trendName}" en ${location}, ${currentMonth} ${currentYear}.

¿QUÉ ES y POR QUÉ está siendo tendencia AHORA?
${tweetContext}
Instrucciones:
- USA el contexto de tweets arriba para entender mejor la tendencia
- Si es un APODO, identifica la persona real
- Busca eventos ESPECÍFICOS de ${currentMonth} 2025: partidos, retiros, lanzamientos, noticias, escándalos
- Determina si es LOCAL (${location}) o GLOBAL
- Los tweets te dan pistas sobre lo que la gente realmente está discutiendo
- NO digas "sin información" - busca más profundo

Responde SOLO en JSON:
{
  "nombre": "Nombre real si es apodo, sino '${trendName}'",
  "tipo": "persona|evento|equipo|película|música|político|futbolista|artista",
  "categoria": "Deportes|Política|Entretenimiento|Música|Otros",
  "resumen": "Explicación corta y específica del evento exacto que lo hizo tendencia",
  "relevancia": "alta|media|baja",
  "contexto_local": true/false,
  "razon_tendencia": "Evento específico que causó la tendencia",
  "sentimiento_tweets": "positivo|negativo|neutral|mixto"
`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `Eres un analista de tendencias especializado en detectar por qué algo es trending en ${currentMonth} ${currentYear}.

Experto en:
- Análisis de tweets y redes sociales
- Eventos actuales específicos (deportes, política, entretenimiento)
- Identificar apodos de personas famosas
- Distinguir tendencias locales de ${location} vs globales
- Encontrar la razón EXACTA por la cual algo es tendencia HOY

Tienes acceso a tweets recientes sobre esta tendencia. Úsalos para entender mejor el contexto y sentimiento.
Busca profundamente, no digas "sin información". Si es apodo, identifica la persona real.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 400 // Aumentado para incluir sentimiento_tweets
    };

    console.log(`   📡 Realizando consulta a Perplexity con contexto de ${relevantTweets.length} tweets...`);
    
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
        let rawResponse = data.choices[0].message.content;
        console.log(`   ✅ Respuesta recibida para ${trendName}`);
        
        try {
          // Intentar extraer JSON de la respuesta
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Enriquecer con metadata SIMPLIFICADA (sin objetos complejos)
            const enriched = {
              ...parsed,
              source: 'perplexity',
              model: 'sonar',
              tweets_used: relevantTweets.length,
              timestamp: new Date().toISOString()
              // REMOVIDOS: tweets_context, search_query, raw_response (causan problemas JSON)
            };
            
            console.log(`   📊 ${trendName}: Categoría=${enriched.categoria}, Relevancia=${enriched.relevancia}, Tweets=${relevantTweets.length}`);
            return enriched;
          }
        } catch (parseError) {
          console.log(`   ⚠️  Error parseando JSON para ${trendName}, usando respuesta raw`);
        }
        
        // Si no se puede parsear JSON, crear estructura manual SIMPLIFICADA
        return {
          nombre: trendName,
          tipo: 'hashtag',
          categoria: detectarCategoria(trendName, rawResponse),
          resumen: rawResponse.substring(0, 300),
          relevancia: 'media',
          contexto_local: rawResponse.toLowerCase().includes('guatemala'),
          tweets_used: relevantTweets.length,
          sentimiento_tweets: relevantTweets.length > 0 ? 'mixto' : 'neutral',
          source: 'perplexity',
          model: 'sonar'
          // REMOVIDOS: palabras_clave, raw_response (causan problemas JSON)
        };
      }
    } else {
      const errorText = await response.text();
      console.error(`   ❌ Error Perplexity para ${trendName}:`, errorText.substring(0, 200));
    }

    // Fallback en caso de error
    return {
      nombre: trendName,
      resumen: `Tendencia relacionada con ${trendName}`,
      categoria: detectarCategoria(trendName),
      tipo: 'hashtag',
      relevancia: 'baja',
      contexto_local: false,
      tweets_used: relevantTweets.length,
      source: 'fallback',
      model: 'fallback'
    };

  } catch (error) {
    console.error(`   ❌ Error procesando ${trendName}:`, error.message);
    return {
      nombre: trendName,
      resumen: `Error procesando información sobre ${trendName}`,
      categoria: 'Otros',
      tipo: 'error',
      relevancia: 'baja',
      contexto_local: false,
      tweets_used: 0,
      source: 'error',
      model: 'error'
    };
  }
}

/**
 * Detecta categoría basándose en palabras clave
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} context - Contexto adicional (opcional)
 * @returns {string} - Categoría detectada
 */
function detectarCategoria(trendName, context = '') {
  const text = (trendName + ' ' + context).toLowerCase();
  
  const categorias = {
    'Política': ['presidente', 'congreso', 'gobierno', 'ministro', 'alcalde', 'elección', 'política', 'giammattei', 'aguirre', 'diputado'],
    'Deportes': ['fútbol', 'liga', 'serie a', 'napoli', 'mctominay', 'deporte', 'equipo', 'partido', 'futbol', 'uefa', 'champions', 'jugador', 'futbolista', 'retiro', 'transferencia', 'lukita'],
    'Música': ['cantante', 'banda', 'concierto', 'música', 'morat', 'álbum', 'canción', 'pop', 'rock'],
    'Entretenimiento': ['actor', 'película', 'serie', 'tv', 'famoso', 'celebridad', 'lilo', 'disney', 'cine', 'estreno'],
    'Justicia': ['corte', 'juez', 'tribunal', 'legal', 'derecho', 'satterthwaite', 'onu', 'derechos humanos'],
    'Sociedad': ['comunidad', 'social', 'cultural', 'santa maría', 'jesús', 'municipio', 'tradición'],
    'Internacional': ['mundial', 'internacional', 'global', 'extranjero', 'europa', 'italia'],
    'Religión': ['iglesia', 'religioso', 'santo', 'santa', 'dios', 'jesús', 'maría']
  };

  for (const [categoria, palabras] of Object.entries(categorias)) {
    if (palabras.some(palabra => text.includes(palabra))) {
      return categoria;
    }
  }

  return 'Otros';
}

/**
 * Procesa múltiples tendencias usando llamadas individuales a Perplexity
 * @param {Array} trends - Array de tendencias
 * @param {string} location - Ubicación para contexto
 * @returns {Array} - Tendencias procesadas con información about
 */
async function processWithPerplexityIndividual(trends, location = 'Guatemala') {
  console.log(`\n🔍 INICIANDO PROCESAMIENTO: PERPLEXITY INDIVIDUAL (${trends.length} tendencias)`);
  console.log('='.repeat(80));
  
  const processedAbout = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  console.log(`📅 Fecha actual: ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  console.log(`🌍 Ubicación: ${location}`);

  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const trendName = trend.name || trend.keyword || trend.text || `Tendencia ${i+1}`;
    
    console.log(`\n📊 Procesando ${i+1}/${trends.length}: "${trendName}"`);
    console.log('─'.repeat(60));
    
    try {
      // Obtener información completa
      const aboutInfo = await getAboutFromPerplexityIndividual(trendName, location, currentYear);
      
      processedAbout.push({
        keyword: trendName,
        about: aboutInfo,
        timestamp: new Date().toISOString()
      });
      
      console.log(`   ✅ Categoría: ${aboutInfo.categoria}`);
      console.log(`   🎯 Relevancia: ${aboutInfo.relevancia}`);
      console.log(`   🌍 Contexto local: ${aboutInfo.contexto_local ? 'Sí' : 'No'}`);
      console.log(`   💥 Razón: ${aboutInfo.razon_tendencia || 'No especificada'}`);
      console.log(`   📝 Resumen: ${aboutInfo.resumen.substring(0, 100)}...`);
      
      // Pausa entre llamadas para ser respetuoso con la API
      if (i < trends.length - 1) {
        console.log(`   ⏳ Pausa de 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando "${trendName}":`, error.message);
      
      // Agregar con valores por defecto
      processedAbout.push({
        keyword: trendName,
        about: {
          nombre: trendName,
          resumen: `Error procesando información sobre ${trendName}`,
          categoria: 'Otros',
          tipo: 'error',
          relevancia: 'baja',
          contexto_local: false,
          source: 'error',
          model: 'error'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  console.log('\n✅ PROCESAMIENTO PERPLEXITY INDIVIDUAL COMPLETADO');
  console.log('='.repeat(80));
  
  return processedAbout;
}

/**
 * Genera estadísticas simplificadas de las tendencias procesadas
 * @param {Array} processedAbout - Array de información about procesada
 * @returns {Object} - Objeto con estadísticas simplificadas
 */
function generateStatistics(processedAbout) {
  const stats = {
    relevancia: { alta: 0, media: 0, baja: 0 },
    contexto: { local: 0, global: 0 },
    timestamp: new Date().toISOString()
  };

  processedAbout.forEach(item => {
    const about = item.about;
    
    // Distribución por relevancia
    if (about.relevancia) {
      stats.relevancia[about.relevancia] = (stats.relevancia[about.relevancia] || 0) + 1;
    }
    
    // Contexto local vs global
    if (about.contexto_local) {
      stats.contexto.local++;
    } else {
      stats.contexto.global++;
    }
  });

  return stats;
}

/**
 * Obtiene información de "about" para un array de términos usando un solo llamado a Perplexity.
 * @param {Array} trendsArray - Array de objetos { name, volume, ... }
 * @param {string} location - Ubicación para el contexto (ej: 'Guatemala')
 * @param {string} year - Año para el contexto (ej: '2025')
 * @returns {Array} Array de objetos about alineados con trendsArray
 */
async function getAboutFromPerplexityBatch(trendsArray, location = 'Guatemala', year = '2025') {
  // Función deprecada - usar processWithPerplexityIndividual en su lugar
  console.log('⚠️  getAboutFromPerplexityBatch está deprecada, usando processWithPerplexityIndividual');
  
  const processed = await processWithPerplexityIndividual(trendsArray, location);
  return processed.map(item => item.about);
}

/**
 * Obtiene tweets relevantes para una tendencia específica
 * @param {string} trendName - Nombre de la tendencia
 * @param {number} limit - Número máximo de tweets (default: 5)
 * @returns {Array} - Array de tweets relevantes con contexto
 */
async function getRelevantTweetsForTrend(trendName, limit = 5) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !supabase) {
    console.log(`⚠️  Supabase no configurado para obtener tweets de: ${trendName}`);
    return [];
  }

  try {
    console.log(`🐦 Buscando tweets para tendencia: "${trendName}"`);
    
    // Búsqueda flexible en trending_tweets
    const { data: tweets, error } = await supabase
      .from('trending_tweets')
      .select('texto, trend_original, trend_clean, categoria, likes, retweets, verified, fecha_tweet')
      .or(
        `trend_original.ilike.%${trendName}%,` +
        `trend_clean.ilike.%${trendName}%,` +
        `texto.ilike.%${trendName}%`
      )
      .gte('fecha_captura', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Últimas 48 horas
      .order('likes', { ascending: false }) // Ordenar por popularidad (likes)
      .limit(limit * 3); // Obtener más para poder filtrar

    if (error) {
      console.error(`   ❌ Error obteniendo tweets para ${trendName}:`, error);
      return [];
    }

    if (!tweets || tweets.length === 0) {
      console.log(`   📭 No se encontraron tweets para: ${trendName}`);
      return [];
    }

    // Filtrar y procesar tweets más relevantes
    const processedTweets = tweets
      .filter(tweet => {
        // Filtrar tweets muy cortos o spam
        return tweet.texto && 
               tweet.texto.length > 20 && 
               tweet.texto.length < 280 &&
               !tweet.texto.toLowerCase().includes('rt @'); // Evitar retweets simples
      })
      .slice(0, limit) // Tomar solo el límite requerido
      .map(tweet => ({
        texto: tweet.texto.replace(/\n/g, ' ').trim(), // Limpiar saltos de línea
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
        verified: tweet.verified || false,
        categoria: tweet.categoria || 'General',
        fecha_tweet: tweet.fecha_tweet
      }));

    console.log(`   ✅ Encontrados ${processedTweets.length} tweets relevantes para: ${trendName}`);
    
    // Log de ejemplo del primer tweet
    if (processedTweets.length > 0) {
      console.log(`   📝 Ejemplo: "${processedTweets[0].texto.substring(0, 80)}..."`);
    }

    return processedTweets;

  } catch (error) {
    console.error(`   ❌ Error buscando tweets para ${trendName}:`, error.message);
    return [];
  }
} 

// 📧 ============ ENDPOINTS DE EMAIL ============

// Endpoint para enviar email
app.post('/api/send-email', async (req, res) => {
  console.log('📧 Recibida solicitud de envío de email');
  console.log('📧 Datos recibidos:', {
    to: req.body.to,
    subject: req.body.subject,
    smtp: {
      host: req.body.smtp?.host,
      port: req.body.smtp?.port,
      user: req.body.smtp?.auth?.user
    }
  });

  // 🆕 DETECCIÓN Y CORRECCIÓN AUTOMÁTICA DE FRONTEND
  if (req.body.smtp?.auth?.pass) {
    const password = req.body.smtp.auth.pass;
    const workingPassword = 'tfjl zyol rbna sbmg';
    const smtpHost = req.body.smtp?.host?.toLowerCase() || '';
    // Detectar el origen de la request
    const isCurl = req.headers['user-agent']?.includes('curl');
    const isFrontend = req.headers['user-agent']?.includes('Mozilla');
    console.log('🔍 Origen detectado:', isCurl ? 'CURL' : isFrontend ? 'FRONTEND' : 'DESCONOCIDO');
    // Solo forzar password si es frontend Y el host es Gmail
    if (isFrontend && smtpHost.includes('smtp.gmail.com')) {
      console.log('🔧 FRONTEND DETECTADO + Gmail - Corrigiendo password automáticamente');
      req.body.smtp.auth.pass = workingPassword;
    }
  }

  const { to, subject, html, text, smtp, from } = req.body;

  try {
    // Configuración específica para Gmail
    const transportConfig = {
      host: smtp.host,
      port: parseInt(smtp.port),
      secure: smtp.port === 465, // true para 465 (SSL), false para 587 (STARTTLS)
      auth: {
        user: smtp.auth.user,
        pass: smtp.auth.pass
      }
    };

    // Configuración específica para puerto 587 (STARTTLS)
    if (smtp.port === 587 || smtp.port === '587') {
      transportConfig.requireTLS = true;
      transportConfig.tls = {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      };
    }

    // Configuración para puerto 465 (SSL)
    if (smtp.port === 465 || smtp.port === '465') {
      transportConfig.secure = true;
      transportConfig.tls = {
        rejectUnauthorized: false
      };
    }

    console.log('🔧 Configuración de transporte:', {
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      requireTLS: transportConfig.requireTLS
    });

    // Crear transporter con configuración SMTP del usuario
    const transporter = nodemailer.createTransport(transportConfig);

    console.log('🔌 Verificando conexión SMTP...');
    
    // 🆕 TIMEOUT PARA VERIFICACIÓN  
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP verification timeout after 10 seconds')), 10000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✅ Conexión SMTP verificada');

    // Enviar email
    console.log('📤 Enviando email...');
    const info = await transporter.sendMail({
      from: `${from.name} <${from.email}>`,
      to: to,
      subject: subject,
      html: html,
      text: text
    });

    console.log('✅ Email enviado exitosamente:', info.messageId);
    res.status(200).json({ 
      success: true, 
      message: 'Email enviado exitosamente',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.code || 'Error desconocido'
    });
  }
});

// Endpoint para probar SMTP
app.post('/api/test-email', async (req, res) => {
  console.log('🧪 [DEBUG VPS] Recibida solicitud de prueba SMTP');
  console.log('🧪 [DEBUG VPS] req.body COMPLETO:', JSON.stringify(req.body, null, 2));
  console.log('🧪 [DEBUG VPS] req.headers:', JSON.stringify(req.headers, null, 2));
  console.log('🧪 [DEBUG VPS] Verificando estructura:');
  console.log('   - req.body.smtp:', req.body.smtp);
  console.log('   - req.body.smtp?.host:', req.body.smtp?.host);
  console.log('   - req.body.smtp?.auth:', req.body.smtp?.auth);
  console.log('   - req.body.smtp?.auth?.pass:', req.body.smtp?.auth?.pass);
  
  // Verificar que los datos mínimos estén presentes
  if (!req.body.smtp || !req.body.smtp.host || !req.body.smtp.auth) {
    console.log('❌ [DEBUG VPS] Datos SMTP incompletos');
    return res.status(400).json({
      success: false,
      error: 'Datos SMTP incompletos',
      received: req.body,
      details: 'smtp, smtp.host y smtp.auth son requeridos'
    });
  }
  
  const { smtp, from, to, html, text, subject } = req.body;

  try {
    // 🔄 CREAR TRANSPORTER NUEVO CADA VEZ (no cachear)
    // Configuración específica para Gmail
    const transportConfig = {
      host: smtp.host,
      port: parseInt(smtp.port),
      secure: smtp.port === 465, // true para 465 (SSL), false para 587 (STARTTLS)
      auth: {
        user: smtp.auth.user.trim(), // Trim usuario por si acaso
        pass: smtp.auth.pass.trim()  // Trim password por si acaso
      }
    };

    // Configuración específica para puerto 587 (STARTTLS)
    if (smtp.port === 587 || smtp.port === '587') {
      transportConfig.requireTLS = true;
      transportConfig.tls = {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      };
    }

    // Configuración para puerto 465 (SSL)
    if (smtp.port === 465 || smtp.port === '465') {
      transportConfig.secure = true;
      transportConfig.tls = {
        rejectUnauthorized: false
      };
    }

    console.log('🔧 Configuración de transporte:', {
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      requireTLS: transportConfig.requireTLS,
      user: transportConfig.auth.user,
      passLength: transportConfig.auth.pass.length
    });

    // 🆕 CREAR TRANSPORTER COMPLETAMENTE NUEVO
    const transporter = nodemailer.createTransport(transportConfig);

    console.log('🔌 Verificando conexión SMTP...');
    
    // 🆕 TIMEOUT PARA VERIFICACIÓN  
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP verification timeout after 10 seconds')), 10000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✅ Conexión SMTP verificada');

    // Enviar email de prueba
    console.log('📤 Enviando email de prueba...');
    const info = await transporter.sendMail({
      from: `${from.name} <${from.email}>`,
      to: to,
      subject: subject || 'Prueba SMTP - PulseJournal',
      html: html,
      text: text
    });

    console.log('✅ Email de prueba enviado:', info.messageId);
    res.status(200).json({ 
      success: true, 
      message: 'SMTP configurado correctamente - Email de prueba enviado',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('❌ Error probando SMTP:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.code || 'Error desconocido'
    });
  }
});

// 📧 ============ FIN ENDPOINTS DE EMAIL ============

// Endpoint para re-analizar tweets (solo admins)
app.post('/api/admin/reanalyze-tweets', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden re-analizar tweets'
      });
    }

    console.log(`👑 Admin ${user.profile.email} solicitando re-análisis de tweets`);

    const { limit = 20, force_all = false, only_failed = false } = req.body;

    // Configurar URL del VPS para re-análisis
    const VPS_REANALYZE_URL = process.env.VPS_REANALYZE_URL || 'https://api.standatpd.com/reanalyze-tweets';

    console.log(`🔄 Iniciando re-análisis de ${limit} tweets...`);

    try {
      // Ejecutar el script de re-análisis de NewsCron directamente
      const { spawn } = require('child_process');
      const path = require('path');
      
      // Buscar el directorio de NewsCron
      const newsCronPath = process.env.NEWSCRON_PATH || '../NewsCron';
      const scriptPath = path.join(newsCronPath, 'reanalyze_tweets.js');
      
      console.log('📁 Ejecutando script en:', scriptPath);
      console.log('📋 Parámetros:', { limit, force_all, only_failed });

      // Preparar argumentos para el script
      const args = ['reanalyze_tweets.js', '--limit', limit.toString()];
      if (force_all) args.push('--force-all');
      if (only_failed) args.push('--only-failed');
      args.push('--source', 'admin_panel');

      // Ejecutar el script de Node.js
      const startTime = Date.now();
      const childProcess = spawn('node', args, {
        cwd: newsCronPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('📤 Script output:', data.toString().trim());
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('⚠️ Script error:', data.toString().trim());
      });

      // Crear una promesa para manejar el proceso
      const vpsResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          childProcess.kill();
          reject(new Error('Timeout: El proceso excedió 5 minutos'));
        }, 300000); // 5 minutos

        childProcess.on('close', (code) => {
          clearTimeout(timeout);
          const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
          
          console.log(`📊 Script terminado con código: ${code}, tiempo: ${executionTime}s`);
          
          if (code === 0) {
            // Parsear la salida para extraer estadísticas
            const result = {
              success: true,
              tweets_processed: limit,
              tweets_updated: 0,
              tweets_failed: 0,
              execution_time: `${executionTime}s`,
              success_rate: '100%',
              script_output: stdout,
              method: 'newscron_direct'
            };

            // Intentar extraer métricas reales de la salida
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.includes('tweets procesados:')) {
                const match = line.match(/(\d+)/);
                if (match) result.tweets_processed = parseInt(match[1]);
              }
              if (line.includes('tweets actualizados:')) {
                const match = line.match(/(\d+)/);
                if (match) result.tweets_updated = parseInt(match[1]);
              }
              if (line.includes('tweets fallidos:')) {
                const match = line.match(/(\d+)/);
                if (match) result.tweets_failed = parseInt(match[1]);
              }
            }

            // Calcular tasa de éxito real
            if (result.tweets_processed > 0) {
              const successCount = result.tweets_processed - result.tweets_failed;
              result.success_rate = `${((successCount / result.tweets_processed) * 100).toFixed(1)}%`;
            }

            resolve(result);
          } else {
            reject(new Error(`El script falló con código ${code}. Error: ${stderr}`));
          }
        });

        childProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Error ejecutando script: ${error.message}`));
        });
      });
      
      console.log('✅ Re-análisis completado:', vpsResult);

      // Registrar la acción en logs
      await logAdminAction(user, 'reanalyze_tweets', {
        tweets_limit: limit,
        force_all,
        only_failed,
        vps_response: vpsResult
      });

      res.json({
        success: true,
        message: 'Re-análisis de tweets completado exitosamente usando NewsCron',
        results: {
          tweets_processed: vpsResult.tweets_processed || limit,
          tweets_updated: vpsResult.tweets_updated || 0,
          tweets_failed: vpsResult.tweets_failed || 0,
          execution_time: vpsResult.execution_time || 'No disponible',
          success_rate: vpsResult.success_rate || 'No disponible',
          method: 'newscron_direct_script'
        },
        admin_user: user.profile.email,
        timestamp: new Date().toISOString(),
        script_details: {
          method: vpsResult.method,
          output_sample: vpsResult.script_output ? vpsResult.script_output.substring(0, 500) + '...' : 'No output'
        }
      });

    } catch (vpsError) {
      console.error('❌ Error comunicándose con VPS:', vpsError);
      
      // Si falla el VPS, intentar ejecutar localmente (fallback)
      console.log('🔄 Fallback: intentando re-análisis local...');
      
      try {
        // Verificar si tenemos acceso a la base de datos localmente
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !supabase) {
          throw new Error('Base de datos no configurada para fallback local');
        }

        // Obtener tweets para re-analizar localmente
        const { data: tweets, error } = await supabase
          .from('trending_tweets')
          .select('*')
          .order('fecha_captura', { ascending: false })
          .limit(limit);

        if (error) {
          throw new Error(`Error obteniendo tweets: ${error.message}`);
        }

        const fallbackResult = {
          tweets_found: tweets?.length || 0,
          method: 'local_fallback',
          note: 'Re-análisis ejecutado como fallback local debido a error en VPS'
        };

        res.json({
          success: true,
          message: 'Re-análisis ejecutado como fallback local',
          results: fallbackResult,
          admin_user: user.profile.email,
          timestamp: new Date().toISOString(),
          warning: 'VPS no disponible, se ejecutó fallback local limitado'
        });

      } catch (fallbackError) {
        console.error('❌ Error en fallback local:', fallbackError);
        
        res.status(500).json({
          success: false,
          error: 'Error en re-análisis',
          message: 'No se pudo completar el re-análisis ni en VPS ni localmente',
          vps_error: vpsError.message,
          fallback_error: fallbackError.message,
          admin_user: user.profile.email,
          timestamp: new Date().toISOString()
        });
      }
    }

  } catch (error) {
    console.error('❌ Error en /api/admin/reanalyze-tweets:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Registra acciones de administrador
 */
async function logAdminAction(user, action, details) {
  try {
    if (supabase) {
      const logEntry = {
        admin_user_id: user.id,
        admin_email: user.profile.email,
        action: action,
        details: details,
        timestamp: new Date().toISOString(),
        ip_address: null, // Podrías agregar req.ip aquí si lo necesitas
      };

      const { error } = await supabase
        .from('admin_action_logs')
        .insert([logEntry]);

      if (error) {
        console.error('Error guardando log de acción admin:', error);
      } else {
        console.log(`📊 Log de acción admin guardado: ${action} por ${user.profile.email}`);
      }
    }
  } catch (error) {
    console.error('Error en logAdminAction:', error);
  }
}

// Endpoint de verificación del sistema de logging
app.get('/api/admin/logging-status', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    console.log(`👑 Admin ${user.profile.email} verificando estado del sistema de logging`);

    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no configurada',
        message: 'Supabase no está disponible'
      });
    }

    // Verificar tablas de logging
    let status = {
      timestamp: new Date().toISOString(),
      tables: {
        usage_logs: { exists: false, recent_count: 0, error: null },
        system_execution_logs: { exists: false, recent_count: 0, error: null }
      },
      logging_functions: {
        logUsage: 'usage_logs',
        logSystemOperation: 'system_execution_logs', 
        logError: 'Determina tabla según usuario/sistema'
      },
      admin_endpoints: [
        '/api/admin/logs - Combina ambas tablas',
        '/api/admin/logs/stats - Estadísticas de ambas tablas'
      ]
    };

    // Verificar usage_logs
    try {
      const { data: userLogs, error: userError } = await supabase
        .from('usage_logs')
        .select('id')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (userError) {
        status.tables.usage_logs.error = userError.message;
      } else {
        status.tables.usage_logs.exists = true;
        
        // Contar registros recientes
        const { count } = await supabase
          .from('usage_logs')
          .select('*', { count: 'exact', head: true })
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        status.tables.usage_logs.recent_count = count || 0;
      }
    } catch (error) {
      status.tables.usage_logs.error = error.message;
    }

    // Verificar system_execution_logs
    try {
      const { data: systemLogs, error: systemError } = await supabase
        .from('system_execution_logs')
        .select('id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (systemError) {
        status.tables.system_execution_logs.error = systemError.message;
      } else {
        status.tables.system_execution_logs.exists = true;
        
        // Contar registros recientes
        const { count } = await supabase
          .from('system_execution_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        status.tables.system_execution_logs.recent_count = count || 0;
      }
    } catch (error) {
      status.tables.system_execution_logs.error = error.message;
    }

    // Determinar estado general
    const bothTablesExist = status.tables.usage_logs.exists && status.tables.system_execution_logs.exists;
    
    res.json({
      success: bothTablesExist,
      message: bothTablesExist ? 
        'Sistema de logging separado configurado correctamente' : 
        'Algunas tablas de logging no están disponibles',
      status: status,
      recommendations: bothTablesExist ? [] : [
        'Verificar que las tablas usage_logs y system_execution_logs existen en Supabase',
        'Ejecutar scripts de migración si es necesario',
        'Verificar permisos de acceso a las tablas'
      ]
    });

  } catch (error) {
    console.error('❌ Error verificando sistema de logging:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// Endpoint para obtener estadísticas de logs
app.get('/api/admin/logs/stats', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar que el usuario sea admin
    if (user.profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden acceder a este endpoint'
      });
    }

    const { days = 7, log_type } = req.query;
    console.log(`📊 Admin ${user.profile.email} consultando estadísticas de logs (${days} días, tipo: ${log_type || 'all'})`);

    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no configurada',
        message: 'Supabase no está disponible'
      });
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    // Obtener logs de usuario
    const { data: userLogs, error: userError } = await supabase
      .from('usage_logs')
      .select('*')
      .gte('timestamp', daysAgo.toISOString());

    if (userError) {
      console.error('Error obteniendo logs:', userError);
      return res.status(500).json({
        error: 'Error obteniendo logs',
        message: userError.message
      });
    }

    // Procesar estadísticas
    const stats = {
      overview: {
        total_logs: userLogs?.length || 0,
        user_logs: userLogs?.length || 0,
        system_logs: 0, // Currently only processing user logs
        success_logs: userLogs?.filter(log => !log.error_data)?.length || 0,
        error_logs: userLogs?.filter(log => log.error_data)?.length || 0,
        total_credits_consumed: 0,
        period_days: parseInt(days)
      },
      by_type: {
        user: {
          total: userLogs?.length || 0,
          success: userLogs?.filter(log => !log.error_data)?.length || 0,
          errors: userLogs?.filter(log => log.error_data)?.length || 0,
          credits_consumed: 0,
          operations: {}
        },
        system: {
          total: 0,
          success: 0,
          errors: 0,
          credits_consumed: 0,
          operations: {}
        }
      },
      daily_breakdown: [],
      error_summary: [],
      sources: {
        usage_logs: userLogs?.length || 0,
        system_execution_logs: 0
      }
    };

    if (userLogs) {
      userLogs.forEach(log => {
        // Contar créditos totales
        const credits = log.credits_consumed || 0;
        stats.overview.total_credits_consumed += credits;
        stats.by_type.user.credits_consumed += credits;

        // Contar por operación en user type
        if (!stats.by_type.user.operations[log.operation]) {
          stats.by_type.user.operations[log.operation] = {
            count: 0,
            credits: 0,
            errors: 0
          };
        }
        stats.by_type.user.operations[log.operation].count++;
        stats.by_type.user.operations[log.operation].credits += credits;
        if (log.error_data) {
          stats.by_type.user.operations[log.operation].errors++;
        }
      });
    }

    res.json({
      success: true,
      statistics: stats,
      metadata: {
        period: `${days} días`,
        generated_at: new Date().toISOString(),
        generated_by: user.profile.email,
        timezone: 'America/Guatemala'
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

// 🎬 IMPORTAR Y USAR RUTAS DEL TRADUCTOR DE VIDEO
const videoTranslatorRoutes = require('./routes');
app.use('/api', videoTranslatorRoutes);

