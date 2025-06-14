const { verifyUserAccess, debitCredits } = require('../middlewares');
const { processWithPerplexityIndividual, generateStatistics } = require('../services/perplexity');
const { detectarCategoria } = require('../services/categorization');
const { logError } = require('../services/logs');
const supabase = require('../utils/supabase');

/**
 * Configura las rutas relacionadas con tendencias
 * @param {Express} app - La aplicación Express
 */
function setupTrendsRoutes(app) {
  
  // Registro de procesamiento en curso (guardamos timestamps como claves)
  const backgroundProcessingStatus = {};
  
  // Endpoint para verificar estado de procesamiento
  app.get('/api/processingStatus/:timestamp', async (req, res) => {
    try {
      const { timestamp } = req.params;
      console.log(`🔍 Verificando estado de procesamiento para timestamp: ${timestamp}`);
      
      if (!timestamp) {
        return res.status(400).json({
          error: 'Parámetro incorrecto',
          message: 'Se requiere un timestamp válido'
        });
      }
      
      // Verificar si existe en nuestro registro local
      if (backgroundProcessingStatus[timestamp]) {
        return res.json(backgroundProcessingStatus[timestamp]);
      }
      
      // Si no está en el registro local, verificar en la base de datos
      if (supabase) {
        console.log('🔍 Buscando procesamiento en base de datos...');
        
        const { data, error } = await supabase
          .from('trends')
          .select('*')
          .eq('timestamp', timestamp)
          .limit(1);
        
        if (error) {
          console.error('❌ Error consultando estado de procesamiento:', error);
          return res.status(500).json({
            error: 'Error interno',
            message: 'No se pudo verificar el estado del procesamiento',
            details: error.message
          });
        }
        
        if (data && data.length > 0) {
          console.log('✅ Procesamiento encontrado en base de datos');
          // Si encontramos el registro en la base de datos, el procesamiento está completo
          return res.json({
            timestamp: timestamp,
            status: 'completed',
            has_about: true,
            has_statistics: true,
            completion_time: new Date().toISOString()
          });
        }
      }
      
      // Si no se encontró ni en memoria ni en base de datos
      return res.json({
        timestamp: timestamp,
        status: 'unknown',
        message: 'No se encontró información sobre este procesamiento'
      });
    } catch (error) {
      console.error('❌ Error en /api/processingStatus:', error);
      res.status(500).json({
        error: 'Error interno',
        message: error.message
      });
    }
  });
  
  // Endpoint para obtener las últimas tendencias con información completa (público, sin autenticación)
  app.get('/api/latestTrends', async (req, res) => {
    try {
      console.log('📊 Solicitud de últimas tendencias recibida');
      
      // Verificar conexión a Supabase
      if (!supabase) {
        console.log('❌ Error: Cliente Supabase no disponible');
        return res.status(503).json({
          error: 'Servicio no disponible',
          message: 'Base de datos no configurada'
        });
      }
      
      console.log('🔍 Consultando últimas tendencias en tabla trends...');
      
      // Obtener las últimas tendencias de la tabla trends según su estructura correcta
      const { data, error } = await supabase
        .from('trends')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('❌ Error obteniendo tendencias:', error);
        console.error('Detalles del error:', JSON.stringify(error, null, 2));
        return res.status(500).json({
          error: 'Error interno',
          message: 'No se pudieron obtener las tendencias',
          details: error.message
        });
      }
      
      if (!data || data.length === 0) {
        console.log('⚠️ No se encontraron tendencias');
        return res.json({
          wordCloudData: [],
          topKeywords: [],
          categoryData: [],
          message: 'No hay tendencias disponibles',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ Se encontraron tendencias del ${new Date(data[0].timestamp).toLocaleString()}`);
      console.log(`📊 Keywords encontrados: ${data[0].top_keywords ? data[0].top_keywords.length : 0}`);
      
      // Devolver las tendencias con la estructura esperada por el dashboard (incluir about y statistics)
      res.json({
        wordCloudData: data[0].word_cloud_data || [],
        topKeywords: data[0].top_keywords || [],
        categoryData: data[0].category_data || [],
        about: data[0].about || [], // Incluir about como en migration.js
        statistics: data[0].statistics || {}, // Incluir statistics como en migration.js
        timestamp: data[0].timestamp,
        processing_status: data[0].processing_status || 'unknown',
        rawData: data[0].raw_data || {}
      });
      
    } catch (error) {
      console.error('❌ Error en /api/latestTrends:', error);
      console.error('Stack:', error.stack);
      res.status(500).json({
        error: 'Error interno',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
  
  // Endpoint para procesar tendencias
  app.post('/api/processTrends', verifyUserAccess, debitCredits, async (req, res) => {
    console.time('procesamiento-total');
    try {
      const startTime = Date.now();
      console.log(`\n📊 SOLICITUD DE PROCESAMIENTO: /api/processTrends`);
      console.log(`👤 Usuario: ${req.user ? req.user.email : 'Anónimo'}`);
      
      // Validar datos de entrada
      const { rawData, location = 'Guatemala', year = 2025 } = req.body;
      
      // FORZAR background processing SIEMPRE (como en migration.js)
      const background = true;
      
      if (!rawData) {
        console.log('❌ Error: No se proporcionaron datos');
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se proporcionaron datos para procesar'
        });
      }
      
      console.log(`📌 Ubicación: ${location}`);
      console.log(`📅 Año: ${year}`);
      console.log(`🔄 Procesamiento en background: ${background ? 'Sí' : 'No'} (FORZADO)`);
      
      // Extraer tendencias del formato que envíe el cliente
      let trends = [];
      
      try {
        // Verificar si es el formato de ExtractorT
        if (rawData.twitter_trends) {
          console.log('Detectado formato de ExtractorT con prefijos numéricos');
          
          // Verificar si twitter_trends es un array de strings
          if (Array.isArray(rawData.twitter_trends) && typeof rawData.twitter_trends[0] === 'string') {
            console.log('Procesando formato de array de strings con prefijos numéricos');
            
            trends = rawData.twitter_trends.map(trendString => {
              // Extraer número de tendencia y volumen si está presente
              const match = trendString.match(/^(\d+)\.\s*([^0-9]*)(\d+[kK])?/);
              
              if (match) {
                const position = parseInt(match[1]) || 0;
                const name = match[2].trim();
                let volume = 1000 - (position * 10); // Valor por defecto basado en la posición
                
                // Si hay un número con K al final, usarlo como volumen
                if (match[3]) {
                  const volStr = match[3].replace(/[kK]$/, '');
                  volume = parseInt(volStr) * 1000;
                }
                
                return {
                  name: name,
                  volume: volume,
                  position: position
                };
              }
              
              // Si no coincide con el patrón esperado, devolver con valores predeterminados
              return {
                name: trendString.replace(/^\d+\.\s*/, '').trim(),
                volume: 1,
                position: 0
              };
            });
          } 
          // Si twitter_trends es un objeto con claves numéricas
          else if (typeof rawData.twitter_trends === 'object' && !Array.isArray(rawData.twitter_trends)) {
            console.log('Procesando formato de objeto con claves numéricas');
            
            // Extraer solo la parte numérica y el texto
            trends = Object.keys(rawData.twitter_trends)
              .filter(key => /^\d+_/.test(key))
              .map(key => {
                const trendName = key.split('_').slice(1).join('_');
                return {
                  name: trendName,
                  volume: parseInt(key.split('_')[0]) || 1
                };
              });
          }
        } 
        // Si es array de objetos con structure { name, count/volume }
        else if (Array.isArray(rawData) && rawData.length > 0 && (rawData[0].name || rawData[0].text)) {
          console.log('Detectado formato de array de objetos');
          trends = rawData.map(item => ({
            name: item.name || item.text || item.keyword,
            volume: item.volume || item.count || 1
          }));
        }
        // Si es un objeto con keys siendo las tendencias
        else if (typeof rawData === 'object' && !Array.isArray(rawData)) {
          console.log('Detectado formato de objeto con keys');
          trends = Object.keys(rawData).map(key => ({
            name: key,
            volume: rawData[key] || 1
          }));
        } 
        // Si es solo un array de strings
        else if (Array.isArray(rawData) && typeof rawData[0] === 'string') {
          console.log('Detectado formato de array de strings');
          trends = rawData.map((name, index) => ({
            name,
            volume: (rawData.length - index) // Asignar volumen descendente
          }));
        }
        // Caso para trends24_trends (array numérico)
        else if (rawData.trends24_trends && Array.isArray(rawData.trends24_trends)) {
          console.log('Detectado formato trends24_trends');
          trends = rawData.trends24_trends.map((trend, index) => ({
            name: trend,
            volume: (rawData.trends24_trends.length - index)
          }));
        }
      } catch (parseError) {
        console.error('❌ Error parseando datos:', parseError);
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Error al procesar el formato de datos',
          details: parseError.message
        });
      }
      
      if (trends.length === 0) {
        console.log('❌ Error: No se pudieron extraer tendencias del formato proporcionado');
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Formato de datos no reconocido o sin tendencias'
        });
      }
      
      console.log(`✅ Se encontraron ${trends.length} tendencias para procesar`);
      
      // 1. PROCESAMIENTO BÁSICO (SÍNCRONO)
      console.time('procesamiento-basico');
      console.log('Iniciando procesamiento de datos básicos');
      
      // Procesar datos básicos
      const basicProcessedTrends = trends.map(trend => {
        const trendName = trend.name || trend.keyword || trend.text || 'Tendencia sin nombre';
        const category = detectarCategoria(trendName);
        
        return {
          name: trendName,
          volume: trend.volume || trend.count || 1,
          category: category,
          original: trend,
          about: {
            summary: 'Procesando información detallada...',
            tipo: 'trend',
            relevancia: 'media',
            contexto_local: true
          }
        };
      });
      
      // Generar estadísticas básicas
      const basicStatistics = {
        total: basicProcessedTrends.length,
        categorias: {},
        timestamp: new Date().toISOString()
      };
      
      // Contar categorías
      basicProcessedTrends.forEach(trend => {
        const category = trend.category || 'Otros';
        basicStatistics.categorias[category] = (basicStatistics.categorias[category] || 0) + 1;
      });
      
      // Preparar datos para la nube de palabras
      const wordCloudData = basicProcessedTrends.map(trend => ({
        text: trend.name,
        value: trend.volume || 1,
        category: trend.category
      }));
      
      // Datos de categorías (estructura consistente: { name, value })
      const categoryData = Object.entries(basicStatistics.categorias).map(([name, count]) => ({
        name,
        value: count
      }));

      // Top keywords (estructura consistente con el frontend)
      let topKeywords = basicProcessedTrends
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 10)
        .map(trend => ({
          keyword: trend.name,
          count: trend.volume || 1,
          category: trend.category,
          about: {
            nombre: trend.name,
            resumen: 'Procesando información detallada...',
            categoria: trend.category,
            tipo: 'trend',
            relevancia: 'media',
            contexto_local: true,
            source: 'basic-processing',
            model: 'basic'
          }
        }));

      // Asegurar que siempre haya 10 keywords
      while (topKeywords.length < 10) {
        topKeywords.push({
          keyword: `Keyword ${topKeywords.length + 1}`,
          count: 1,
          category: 'Otros',
          about: {
            nombre: `Keyword ${topKeywords.length + 1}`,
            resumen: 'Sin información adicional',
            categoria: 'Otros',
            tipo: 'trend',
            relevancia: 'baja',
            contexto_local: true,
            source: 'basic-processing',
            model: 'basic'
          }
        });
      }
      
      // Generar timestamp único para este procesamiento
      const processingTimestamp = new Date().toISOString();
      
      // 2. GUARDAR RESULTADOS BÁSICOS EN SUPABASE
      if (supabase) {
        try {
          console.log('💾 Guardando resultados básicos en la tabla trends...');
          const { error } = await supabase
            .from('trends')
            .insert([{
              timestamp: processingTimestamp,
              word_cloud_data: wordCloudData,
              top_keywords: topKeywords,
              category_data: categoryData,
              about: [], // Inicializar vacío, se llenará en background
              statistics: {}, // Inicializar vacío, se llenará en background  
              processing_status: background ? 'basic_completed' : 'complete', // Estado según si se procesa en background
              raw_data: {
                trends: basicProcessedTrends,
                statistics: basicStatistics,
                location: location.toLowerCase(),
                processing_time: (Date.now() - startTime) / 1000,
                source: 'api-basic',
                user_id: req.user ? req.user.id : null
              }
            }]);
          
          if (error) {
            console.error('❌ Error guardando resultados básicos:', error);
          } else {
            console.log('✅ Resultados básicos guardados correctamente');
          }
        } catch (dbError) {
          console.error('❌ Error guardando en base de datos:', dbError);
        }
      }
      
      console.timeEnd('procesamiento-basico');
      
      // 3. ENVIAR RESPUESTA CON DATOS BÁSICOS (compatible con frontend)
      res.json({
        wordCloudData,
        topKeywords,
        categoryData,
        about: [], // Inicialmente vacío, se llenará en background
        statistics: {}, // Inicialmente vacío, se llenará en background
        timestamp: processingTimestamp,
        processing_status: background ? 'basic_completed' : 'complete',
        processing_time_seconds: (Date.now() - startTime) / 1000
      });
      
              // 4. INICIAR PROCESAMIENTO DETALLADO EN BACKGROUND (como migration.js)
        if (background) {
          console.log('🔄 Iniciando procesamiento detallado en background...');
          // No usar await para que sea verdaderamente en background (no bloquear la respuesta)
          processDetailedInBackground(processingTimestamp, basicProcessedTrends, location, req.user ? req.user.id : null, startTime)
            .catch(error => {
              console.error('❌ Error en procesamiento background:', error);
            });
        } else {
          console.log('⚡ Procesamiento inmediato completado (sin background)');
        }
      
      console.timeEnd('procesamiento-total');
      
    } catch (error) {
      console.error('❌ Error en /api/processTrends:', error);
      console.error('Stack:', error.stack);
      await logError('processTrends', error, req.user, req);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
  
  // Endpoint para sondeos
  app.post('/api/sondeo', verifyUserAccess, debitCredits, async (req, res) => {
    // Implementación del endpoint de sondeo
    res.json({
      message: 'Sondeo completado',
      timestamp: new Date().toISOString()
    });
  });
}

// Función para procesamiento detallado en background
async function processDetailedInBackground(processingTimestamp, trendsData, location, userId, startTime) {
  try {
    console.log(`🔄 Procesando detalles en background (ID: ${processingTimestamp})...`);
    console.log(`📊 Procesando ${trendsData.length} tendencias`);
    
    // Convertir trendsData al formato que espera processWithPerplexityIndividual (igual que migration.js)
    const top10 = trendsData.slice(0, 10).map(trend => ({
      name: trend.name || trend.keyword,
      volume: trend.volume || trend.count || 1,
      category: trend.category || 'General'
    }));
    
    console.log('🤖 Iniciando procesamiento con Perplexity Individual...');
    console.log('📋 Top 10 trends para procesar:', JSON.stringify(top10.slice(0, 2), null, 2));
    
    // Usar la misma llamada que migration.js
    const processedAbout = await processWithPerplexityIndividual(top10, location);
    
    console.log(`✅ processWithPerplexityIndividual completado. Items procesados: ${processedAbout?.length || 0}`);
    if (processedAbout?.length > 0) {
      console.log('📋 Primer item como ejemplo:', JSON.stringify(processedAbout[0], null, 2));
    }
    
    // Generar estadísticas (igual que migration.js)
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

    // Mapear correctamente desde processedAbout al formato AboutInfo que espera el frontend
    const ultraSimplifiedAboutArray = processedAbout.map((item, index) => {
      const about = item.about || {};
      const trendName = item.name || `Tendencia ${index + 1}`;
      
      return {
        nombre: sanitizeForJSON(trendName, 100),
        tipo: sanitizeForJSON(about.tipo || 'hashtag', 30),
        relevancia: about.relevancia || 'Media',
        razon_tendencia: sanitizeForJSON(about.razon_tendencia || '', 300),
        fecha_evento: sanitizeForJSON(about.fecha_evento || '', 50),
        palabras_clave: Array.isArray(about.palabras_clave) ? 
          about.palabras_clave.slice(0, 5).map(palabra => sanitizeForJSON(palabra, 30)) : [],
        categoria: normalizarCategoria(item.category || about.categoria || 'Otros'),
        contexto_local: Boolean(about.contexto_local),
        source: sanitizeForJSON(about.source || 'perplexity-individual', 20),
        model: sanitizeForJSON(about.model || 'sonar', 20)
      };
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
    const enrichedCategoryData = Object.entries(enrichedCategoryMap).map(([name, count]) => ({
      name,
      value: count
    })).sort((a, b) => b.value - a.value);

    // Actualizar topKeywords con la información enriquecida
    const enrichedTopKeywords = topKeywords.map((keyword, index) => {
      const aboutInfo = ultraSimplifiedAboutArray[index];
      if (aboutInfo) {
        return {
          ...keyword,
          category: aboutInfo.categoria,
          about: aboutInfo
        };
      }
      return keyword;
    });

    console.log('📊 Estadísticas generadas:', JSON.stringify(statistics, null, 2));
    
    // Los datos ya están procesados y listos para guardar
    
    // Actualizar en Supabase usando el timestamp como identificador
    if (supabase) {
      try {
        console.log('🔄 Actualizando registro en Supabase con about, estadísticas y datos enriquecidos...');
        
        const updateData = {
          about: ultraSimplifiedAboutArray,
          statistics: statistics,
          category_data: enrichedCategoryData,
          top_keywords: enrichedTopKeywords,
          processing_status: 'complete'
        };
        
        const { error } = await supabase
          .from('trends')
          .update(updateData)
          .eq('timestamp', processingTimestamp);
        
        if (error) {
          console.error('❌ Error actualizando registro completo:', error, JSON.stringify(error, null, 2));
        } else {
          console.log('✅ Registro actualizado exitosamente con about, estadísticas y datos enriquecidos');
          
          // Verificación adicional: consultar el registro para confirmar que se guardó
          const { data: verifyData, error: verifyError } = await supabase
            .from('trends')
            .select('about, statistics, category_data, processing_status')
            .eq('timestamp', processingTimestamp)
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
      } catch (dbError) {
        console.error('❌ Error en base de datos:', dbError);
        await logError('processTrends_background_db', dbError, { id: userId });
      }
    }
    
    console.log('✅ PROCESAMIENTO EN BACKGROUND COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error en procesamiento detallado en background:', error);
    await logError('processTrends_background', error, { id: userId });
    
    // En caso de error, al menos actualizar el estado en Supabase
    if (supabase) {
      try {
        await supabase
          .from('trends')
          .update({
            processing_status: 'error',
            error_details: error.message
          })
          .eq('timestamp', processingTimestamp);
      } catch (updateErr) {
        console.error('❌ Error actualizando estado de error:', updateErr);
      }
    }
  }
}

/**
 * Normaliza categorías específicas de Perplexity a categorías estándar
 * @param {string} category - Categoría original de Perplexity
 * @returns {string} - Categoría normalizada
 */
function normalizarCategoria(category) {
  if (!category || typeof category !== 'string') {
    return 'Otros';
  }
  
  const categoryLower = category.toLowerCase();
  
  // Mapeo de categorías específicas a categorías estándar
  const categoryMap = {
    // Música y entretenimiento
    'música': 'Música',
    'music': 'Música',
    'música k-pop': 'Música',
    'k-pop': 'Música',
    'kpop': 'Música',
    'música|entretenimiento': 'Música',
    'entretenimiento': 'Entretenimiento',
    'entertainment': 'Entretenimiento',
    'cultural/social': 'Social',
    'cultural': 'Social',
    'social': 'Social',
    
    // Política y conflictos
    'política': 'Política',
    'politics': 'Política',
    'política/economía': 'Política',
    'política y conflicto': 'Política',
    'político': 'Política',
    'geopolítica': 'Internacional',
    'geopolítica / conflicto internacional': 'Internacional',
    'conflicto internacional': 'Internacional',
    'noticias internacionales': 'Internacional',
    'internacional': 'Internacional',
    'international': 'Internacional',
    
    // Deportes
    'deportes': 'Deportes',
    'sports': 'Deportes',
    'fútbol': 'Deportes',
    'football': 'Deportes',
    'soccer': 'Deportes',
    
    // Economía
    'economía': 'Economía',
    'economy': 'Economía',
    'económico': 'Economía',
    'finanzas': 'Economía',
    
    // Tecnología
    'tecnología': 'Tecnología',
    'technology': 'Tecnología',
    'tech': 'Tecnología',
    
    // Países y lugares (contextualizar)
    'actualidad/país': 'Internacional',
    'país': 'Internacional',
    'country': 'Internacional',
    
    // Otros
    'otros': 'Otros',
    'other': 'Otros',
    'general': 'Otros'
  };
  
  // Buscar coincidencia exacta primero
  if (categoryMap[categoryLower]) {
    return categoryMap[categoryLower];
  }
  
  // Buscar coincidencias parciales
  for (const [key, value] of Object.entries(categoryMap)) {
    if (categoryLower.includes(key) || key.includes(categoryLower)) {
      return value;
    }
  }
  
  // Si contiene palabras clave específicas
  if (categoryLower.includes('música') || categoryLower.includes('music') || categoryLower.includes('kpop') || categoryLower.includes('k-pop')) {
    return 'Música';
  }
  
  if (categoryLower.includes('política') || categoryLower.includes('politic') || categoryLower.includes('gobierno')) {
    return 'Política';
  }
  
  if (categoryLower.includes('deporte') || categoryLower.includes('sport') || categoryLower.includes('fútbol') || categoryLower.includes('football')) {
    return 'Deportes';
  }
  
  if (categoryLower.includes('internacional') || categoryLower.includes('international') || categoryLower.includes('global') || categoryLower.includes('mundial')) {
    return 'Internacional';
  }
  
  if (categoryLower.includes('social') || categoryLower.includes('cultural') || categoryLower.includes('sociedad')) {
    return 'Social';
  }
  
  if (categoryLower.includes('entretenimiento') || categoryLower.includes('entertainment') || categoryLower.includes('cine') || categoryLower.includes('tv')) {
    return 'Entretenimiento';
  }
  
  // Si no encuentra coincidencia, capitalizar la primera letra y devolver
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

module.exports = setupTrendsRoutes; 