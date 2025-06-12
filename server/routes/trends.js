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
  
  // Endpoint para obtener las últimas tendencias
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
      
      console.log('🔍 Consultando últimas tendencias en base de datos...');
      
      // Obtener las últimas tendencias de la base de datos
      const { data, error } = await supabase
        .from('trending_tweets')
        .select('*')
        .order('created_at', { ascending: false })
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
          trends: [],
          message: 'No hay tendencias disponibles',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ Se encontraron tendencias del ${new Date(data[0].created_at).toLocaleString()}`);
      console.log(`📊 Tendencias encontradas: ${data[0].trends ? data[0].trends.length : 0}`);
      
      // Devolver las tendencias
      res.json({
        trends: data[0].trends || [],
        statistics: data[0].statistics || {},
        metadata: {
          timestamp: data[0].created_at,
          count: data[0].trends ? data[0].trends.length : 0,
          source: 'database'
        }
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
      
      // Si se solicita procesamiento en background
      if (background) {
        console.log('🔄 Iniciando procesamiento en background');
        
        // Enviar respuesta inmediata
        res.json({
          message: 'Procesamiento iniciado en background',
          trends_count: trends.length,
          processing_id: `bg_${Date.now()}`,
          estimated_time: `${Math.ceil(trends.length * 0.5)} segundos`,
          timestamp: new Date().toISOString()
        });
        
        // Continuar procesamiento
        processInBackground();
        return;
      }
      
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
      
      // Iniciar procesamiento detallado con Perplexity
      const processedTrends = await processWithPerplexityIndividual(
        trends.slice(0, Math.min(15, trends.length)), // Limitar a 15 tendencias
        location
      );
      
      // Generar estadísticas
      const statistics = generateStatistics(processedTrends);
      
      // Calcular tiempo total
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`⏱️ Tiempo total de procesamiento: ${totalTime.toFixed(2)}s`);
      
      // Enviar respuesta
      res.json({
        trends: processedTrends,
        statistics: statistics,
        metadata: {
          processing_time_seconds: totalTime,
          timestamp: new Date().toISOString(),
          count: processedTrends.length,
          location: location,
          year: year,
          processing_type: 'perplexity-individual'
        }
      });
      
      console.timeEnd('procesamiento-total');
      
      // Función para procesamiento en background
      async function processInBackground() {
        try {
          // Procesar con Perplexity en background
          const processedTrends = await processWithPerplexityIndividual(
            trends.slice(0, Math.min(20, trends.length)), // Limitar a 20 tendencias en background
            location
          );
          
          // Generar estadísticas
          const statistics = generateStatistics(processedTrends);
          
          // Aquí se podría guardar el resultado en base de datos o enviar por webhook
          console.log('✅ Procesamiento en background completado');
          console.log(`   📊 ${processedTrends.length} tendencias procesadas`);
          
        } catch (error) {
          console.error('❌ Error en procesamiento en background:', error);
          await logError('processTrends_background', error, req.user, req);
        }
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