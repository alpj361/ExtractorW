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
  
  // Endpoint para obtener las últimas tendencias (público, sin autenticación)
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
      
      // Devolver las tendencias con la estructura esperada por el dashboard
      res.json({
        wordCloudData: data[0].word_cloud_data || [],
        topKeywords: data[0].top_keywords || [],
        categoryData: data[0].category_data || [],
        timestamp: data[0].timestamp,
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
      const { rawData, location = 'Guatemala', year = 2025, background = false } = req.body;
      
      if (!rawData) {
        console.log('❌ Error: No se proporcionaron datos');
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se proporcionaron datos para procesar'
        });
      }
      
      console.log(`📌 Ubicación: ${location}`);
      console.log(`📅 Año: ${year}`);
      console.log(`🔄 Procesamiento en background: ${background ? 'Sí' : 'No'}`);
      console.log(`🔢 Tipo de datos recibidos: ${Array.isArray(rawData) ? 'Array' : typeof rawData}`);
      
      // Añadir un log detallado para ver mejor la estructura
      console.log('📝 Estructura de datos:', JSON.stringify({
        isArray: Array.isArray(rawData),
        hasTwitterTrends: !!rawData.twitter_trends,
        twitterTrendsType: rawData.twitter_trends ? (Array.isArray(rawData.twitter_trends) ? 'array' : typeof rawData.twitter_trends) : 'undefined',
        twitterTrendsLength: rawData.twitter_trends && Array.isArray(rawData.twitter_trends) ? rawData.twitter_trends.length : 'N/A',
        firstItem: rawData.twitter_trends && Array.isArray(rawData.twitter_trends) && rawData.twitter_trends.length > 0 ? 
          rawData.twitter_trends[0] : 'N/A',
        keys: Object.keys(rawData).slice(0, 5)
      }, null, 2));
      
      console.time('obtencion-datos');
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
        console.log('📝 Datos recibidos:', JSON.stringify(rawData).substring(0, 200) + '...');
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Error al procesar el formato de datos',
          details: parseError.message
        });
      }
      
      console.timeEnd('obtencion-datos');
      
      if (trends.length === 0) {
        console.log('❌ Error: No se pudieron extraer tendencias del formato proporcionado');
        console.log('📝 Datos recibidos:', JSON.stringify(rawData).substring(0, 200) + '...');
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Formato de datos no reconocido o sin tendencias'
        });
      }
      
      console.log(`✅ Se encontraron ${trends.length} tendencias para procesar`);
      
      // Procesamiento normal (síncrono)
      console.time('procesamiento-datos');
      console.log('Iniciando procesamiento de datos básicos (sin about)');
      
      // Procesar datos básicos primero
      const basicProcessedTrends = trends.map(trend => {
        // Obtener nombre de la tendencia
        const trendName = trend.name || trend.keyword || trend.text || 'Tendencia sin nombre';
        
        // Categorizar usando el método simple
        const category = detectarCategoria(trendName);
        
        return {
          name: trendName,
          volume: trend.volume || trend.count || 1,
          category: category,
          original: trend
        };
      });
      
      console.timeEnd('procesamiento-datos');
      
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
      
      // Si está en modo background o si se solicita explícitamente solo procesamiento básico
      const shouldProcessInBackground = background || req.query.fastResponse === 'true';
      
      if (shouldProcessInBackground) {
        console.log('🔄 Enviando respuesta rápida y continuando procesamiento en background');
        
        // Preparar datos para la nube de palabras y palabras clave (versión básica)
        const wordCloudData = basicProcessedTrends.map(trend => ({
          text: trend.name,
          value: trend.volume || 1,
          category: trend.category
        }));
        
        // Top keywords (siempre 10) para respuesta rápida
        let topKeywords = basicProcessedTrends
          .sort((a, b) => (b.volume || 0) - (a.volume || 0))
          .slice(0, 10)
          .map(trend => ({
            keyword: trend.name,
            volume: trend.volume || 1,
            category: trend.category,
            mentions: trend.volume || 1, // Añadido para formatMentions
            engagement: trend.volume || 1, // Añadido para formatNumbers
            count: trend.volume || 1, // Añadido para KeywordCount en el frontend
            growth: 0, // Valor por defecto
            sentimentScore: 0, // Valor por defecto
            about: { 
              summary: 'Procesando información detallada...',
              tipo: 'trend',
              relevancia: 'media',
              contexto_local: true
            }
          }));
        
        // Asegurar que siempre haya 10 keywords
        while (topKeywords.length < 10) {
          topKeywords.push({
            keyword: `Keyword ${topKeywords.length + 1}`,
            volume: 1,
            category: 'Otros',
            mentions: 1, // Añadido para formatMentions
            engagement: 1, // Añadido para formatNumbers
            count: 1, // Añadido para KeywordCount en el frontend
            growth: 0, // Valor por defecto
            sentimentScore: 0, // Valor por defecto
            about: { 
              summary: 'Sin información adicional',
              tipo: 'trend',
              relevancia: 'baja',
              contexto_local: true
            }
          });
        }
        
        // Datos de categorías
        const categoryData = Object.entries(basicStatistics.categorias || {}).map(([name, count]) => ({
          name,
          value: count
        }));
        
        // Enviar respuesta inmediata con datos básicos en el formato esperado por el dashboard
        res.json({
          wordCloudData: wordCloudData,
          topKeywords: topKeywords,
          categoryData: categoryData,
          timestamp: new Date().toISOString(),
          processing_time_seconds: (Date.now() - startTime) / 1000,
          background_processing: true,
          note: "Los datos detallados estarán disponibles en el endpoint /api/latestTrends en unos segundos"
        });
        
        // Continuar procesamiento detallado en background
        processDetailedInBackground();
        return;
      }
      
      // Procesamiento detallado síncrono (esperar la respuesta)
      console.log('🔍 Iniciando procesamiento detallado con Perplexity...');
      
      // Iniciar procesamiento detallado con Perplexity
      const processedTrends = await processWithPerplexityIndividual(
        trends.slice(0, Math.min(15, trends.length)), // Limitar a 15 tendencias
        location
      );
      
      // Generar estadísticas
      const statistics = generateStatistics(processedTrends);
      
      // Preparar datos para la nube de palabras y palabras clave
      const wordCloudData = processedTrends.map(trend => ({
        text: trend.name,
        value: trend.volume || 1,
        category: trend.category
      }));
      
      // Top keywords (siempre 10)
      let topKeywords = processedTrends
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 10)
        .map(trend => ({
          keyword: trend.name,
          volume: trend.volume || 1,
          category: trend.category,
          mentions: trend.volume || 1, // Añadido para formatMentions
          engagement: trend.volume || 1, // Añadido para formatNumbers
          count: trend.volume || 1, // Añadido para KeywordCount en el frontend
          growth: 0, // Valor por defecto
          sentimentScore: 0, // Valor por defecto
          about: trend.about || {
            summary: 'Información no disponible',
            tipo: 'trend',
            relevancia: 'media',
            contexto_local: true
          }
        }));
      
      // Asegurar que siempre haya 10 keywords
      while (topKeywords.length < 10) {
        topKeywords.push({
          keyword: `Keyword ${topKeywords.length + 1}`,
          volume: 1,
          category: 'Otros',
          mentions: 1, // Añadido para formatMentions
          engagement: 1, // Añadido para formatNumbers
          count: 1, // Añadido para KeywordCount en el frontend
          growth: 0, // Valor por defecto
          sentimentScore: 0, // Valor por defecto
          about: { 
            summary: 'Sin información adicional',
            tipo: 'trend',
            relevancia: 'baja',
            contexto_local: true
          }
        });
      }
      
      // Datos de categorías
      const categoryData = Object.entries(statistics.categorias || {}).map(([name, count]) => ({
        name,
        value: count
      }));
      
      // Calcular tiempo total
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`⏱️ Tiempo total de procesamiento: ${totalTime.toFixed(2)}s`);
      
      // Guardar en base de datos
      if (supabase) {
        try {
          console.log('💾 Guardando resultados procesados en tabla trends...');
          
          const timestamp = new Date();
          
          // Insertar con la estructura correcta
          const { error } = await supabase
            .from('trends')
            .insert([{
              timestamp: timestamp,
              word_cloud_data: wordCloudData,
              top_keywords: topKeywords,
              category_data: categoryData,
              raw_data: {
                trends: processedTrends,
                statistics: statistics,
                location: location.toLowerCase(),
                processing_time: totalTime,
                source: 'api-sync',
                user_id: req.user ? req.user.id : null
              }
            }]);
            
          if (error) {
            console.error('❌ Error guardando resultados en trends:', error);
          } else {
            console.log('✅ Resultados guardados en trends correctamente');
          }
        } catch (dbError) {
          console.error('❌ Error guardando en base de datos:', dbError);
        }
      }
      
      // Enviar respuesta en el formato esperado por el dashboard
      res.json({
        wordCloudData: wordCloudData,
        topKeywords: topKeywords,
        categoryData: categoryData,
        timestamp: new Date().toISOString(),
        processing_time_seconds: totalTime
      });
      
      console.timeEnd('procesamiento-total');
      
      // Función para procesamiento detallado en background
      async function processDetailedInBackground() {
        try {
          console.log('🔄 Procesando detalles en background...');
          
          // Procesar con Perplexity en background
          const processedTrends = await processWithPerplexityIndividual(
            trends.slice(0, Math.min(20, trends.length)), // Limitar a 20 tendencias en background
            location
          );
          
          // Generar estadísticas
          const statistics = generateStatistics(processedTrends);
          
          // Preparar datos para la nube de palabras y palabras clave
          const wordCloudData = processedTrends.map(trend => ({
            text: trend.name,
            value: trend.volume || 1,
            category: trend.category
          }));
          
          // Top keywords (siempre 10)
          let topKeywords = processedTrends
            .sort((a, b) => (b.volume || 0) - (a.volume || 0))
            .slice(0, 10)
            .map(trend => ({
              keyword: trend.name,
              volume: trend.volume || 1,
              category: trend.category,
              mentions: trend.volume || 1, // Añadido para formatMentions
              engagement: trend.volume || 1, // Añadido para formatNumbers
              count: trend.volume || 1, // Añadido para KeywordCount en el frontend
              growth: 0, // Valor por defecto
              sentimentScore: 0, // Valor por defecto
              about: trend.about || {
                summary: 'Información no disponible',
                tipo: 'trend',
                relevancia: 'media',
                contexto_local: true
              }
            }));
          
          // Asegurar que siempre haya 10 keywords
          while (topKeywords.length < 10) {
            topKeywords.push({
              keyword: `Keyword ${topKeywords.length + 1}`,
              volume: 1,
              category: 'Otros',
              mentions: 1, // Añadido para formatMentions
              engagement: 1, // Añadido para formatNumbers
              count: 1, // Añadido para KeywordCount en el frontend
              growth: 0, // Valor por defecto
              sentimentScore: 0, // Valor por defecto
              about: { 
                summary: 'Sin información adicional',
                tipo: 'trend',
                relevancia: 'baja',
                contexto_local: true
              }
            });
          }
          
          // Datos de categorías
          const categoryData = Object.entries(statistics.categorias || {}).map(([name, count]) => ({
            name,
            value: count
          }));
          
          // Guardar en base de datos si está disponible
          if (supabase) {
            try {
              console.log('💾 Guardando resultados procesados en la tabla trends...');
              
              const timestamp = new Date();
              
              // Usar la estructura correcta para la tabla trends
              const { error } = await supabase
                .from('trends')
                .insert([{
                  timestamp: timestamp,
                  word_cloud_data: wordCloudData,
                  top_keywords: topKeywords,
                  category_data: categoryData,
                  raw_data: {
                    trends: processedTrends,
                    statistics: statistics,
                    location: location.toLowerCase(),
                    processing_time: (Date.now() - startTime) / 1000,
                    source: 'api-background',
                    user_id: req.user ? req.user.id : null
                  }
                }]);
                
              if (error) {
                console.error('❌ Error guardando resultados en trends:', error);
              } else {
                console.log('✅ Resultados guardados en trends correctamente, disponibles en /api/latestTrends');
              }
            } catch (dbError) {
              console.error('❌ Error guardando en base de datos:', dbError);
            }
          }
          
          console.log('✅ Procesamiento en background completado');
          console.log(`   📊 ${processedTrends.length} tendencias procesadas detalladamente`);
          
        } catch (error) {
          console.error('❌ Error en procesamiento detallado en background:', error);
          await logError('processTrends_background', error, req.user, req);
        }
      }
      
      // Función para procesamiento en background (versión legacy)
      async function processInBackground() {
        processDetailedInBackground();
      }
      
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

module.exports = setupTrendsRoutes; 