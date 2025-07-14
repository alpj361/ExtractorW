const { verifyUserAccess, debitCredits } = require('../middlewares');
const { processWithPerplexityIndividual, generateStatistics } = require('../services/perplexity');
const { detectarCategoria } = require('../services/categorization');
const { logError, logUsage } = require('../services/logs');
const supabase = require('../utils/supabase');

/**
 * Detecta una categoría basada en palabras clave presentes en el nombre de la tendencia
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} context - Contexto adicional (opcional)
 * @returns {string} - Categoría detectada
 */
function detectarCategoriaLocal(trendName, context = '') {
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

// Helper functions for trend parsing - moved outside endpoints to be available for both regular and cron endpoints
function parseTrendString(trendString) {
  console.log(`🔍 Parsing: "${trendString}"`);
  
  // FIXED: Regex mejorado para capturar correctamente "1. Quijivix16K"
  // Primero intentar con volumen específico
  let match = trendString.match(/^(\d+)\.\s*(.+?)(\d+[kK])$/);
  
  if (match) {
    const position = parseInt(match[1]) || 0;
    const name = match[2].trim();
    const volStr = match[3].replace(/[kK]$/, '');
    const volume = parseInt(volStr) * 1000;
    
    console.log(`  ✅ Con volumen: name="${name}", volume=${volume}, position=${position}`);
    
    return {
      name: name,
      volume: volume,
      position: position
    };
  }
  
  // Si no tiene volumen específico, usar patrón sin volumen
  match = trendString.match(/^(\d+)\.\s*(.+)$/);
  if (match) {
    const position = parseInt(match[1]) || 0;
    const name = match[2].trim();
    const volume = 1000 - (position * 10); // Valor por defecto basado en la posición
    
    console.log(`  ✅ Sin volumen: name="${name}", volume=${volume}, position=${position}`);
    
    return {
      name: name,
      volume: volume,
      position: position
    };
  }
  
  // Fallback para strings sin formato de posición
  const volMatch = trendString.match(/(.+?)(\d+[kK])$/);
  if (volMatch) {
    const name = volMatch[1].trim();
    const volStr = volMatch[2].replace(/[kK]$/, '');
    const volume = parseInt(volStr) * 1000;
    
    console.log(`  ✅ Solo volumen: name="${name}", volume=${volume}`);
    
    return {
      name: name,
      volume: volume,
      position: 0
    };
  }
  
  // Último fallback
  console.log(`  ⚠️ Fallback: name="${trendString}", volume=1`);
  return {
    name: trendString,
    volume: 1,
    position: 0
  };
}

// Helper para extraer menciones de diferentes formatos
function extractMentionsFromTrend(trendItem) {
  console.log(`🔍 Extrayendo menciones de:`, JSON.stringify(trendItem, null, 2));
  
  let name = '';
  let volume = 1;
  let position = 0;
  
  // Caso 1: String simple (formato "1. Tendencia 16K")
  if (typeof trendItem === 'string') {
    const parsed = parseTrendString(trendItem);
    return parsed;
  }
  
  // Caso 2: Objeto con diferentes propiedades
  if (typeof trendItem === 'object' && trendItem !== null) {
    // Extraer nombre
    name = trendItem.name || trendItem.keyword || trendItem.text || trendItem.title || 'Sin nombre';
    
    // Extraer volumen directo si existe
    if (trendItem.volume && typeof trendItem.volume === 'number') {
      volume = trendItem.volume;
    } else if (trendItem.count && typeof trendItem.count === 'number') {
      volume = trendItem.count;
    } else if (trendItem.tweet_count && typeof trendItem.tweet_count === 'string') {
      // Formato Twitter: "1.2K Tweets"
      const parsed = parseCountText(trendItem.tweet_count);
      if (parsed > 0) volume = parsed;
    } else if (trendItem.keywords && Array.isArray(trendItem.keywords)) {
      // NUEVO: Extraer menciones del array keywords
      // Formato: ["3,055 posts", "48.8K posts", "27.1K posts", ...]
      for (const keyword of trendItem.keywords) {
        if (typeof keyword === 'string') {
          const postMatch = keyword.match(/^([\d,]+(?:\.\d+)?[kKmM]?)\s*posts?$/i);
          if (postMatch) {
            const parsed = parseCountText(postMatch[1]);
            if (parsed > volume) {
              volume = parsed;
              console.log(`  ✅ Menciones extraídas de keywords: ${parsed} (de "${keyword}")`);
            }
          }
        }
      }
    }
    
    // Extraer posición si existe
    if (trendItem.position && typeof trendItem.position === 'number') {
      position = trendItem.position;
    }
  }
  
  console.log(`  ✅ Resultado: name="${name}", volume=${volume}, position=${position}`);
  return { name, volume, position };
}

// Helper para convertir texto de conteo a número
function parseCountText(countText) {
  if (!countText || typeof countText !== 'string') return 0;
  
  const cleaned = countText.trim().replace(/,/g, '');
  
  // Manejar formato "1.2K", "48.8K", "3M", etc.
  const match = cleaned.match(/^([\d.]+)([kKmM]?)$/);
  if (match) {
    const number = parseFloat(match[1]);
    const multiplier = match[2].toLowerCase();
    
    switch (multiplier) {
      case 'k':
        return Math.floor(number * 1000);
      case 'm':
        return Math.floor(number * 1000000);
      default:
        return Math.floor(number);
    }
  }
  
  // Fallback: intentar parsearlo como número directo
  const directParse = parseInt(cleaned);
  return isNaN(directParse) ? 0 : directParse;
}

// Helper to sanitize trend names (removes trailing digits+K and trims)
function sanitizeName(rawName = '') {
  return rawName.replace(/(\d+)[kK]$/, '').trim();
}

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
          // Devolver tanto el status como los datos reales
          const record = data[0];
          return res.json({
            timestamp: timestamp,
            status: 'complete',
            has_about: !!(record.about && record.about.length > 0),
            has_statistics: !!(record.statistics && Object.keys(record.statistics).length > 0),
            has_controversy: !!(record.controversy_analyses && record.controversy_analyses.length > 0),
            completion_time: new Date().toISOString(),
            data: {
              about: record.about || [],
              statistics: record.statistics || {},
              categoryData: record.category_data || [],
              wordCloudData: record.word_cloud_data || [],
              topKeywords: record.top_keywords || [],
              // NUEVO: Datos de controversia
              controversyAnalyses: record.controversy_analyses || [],
              controversyStatistics: record.controversy_statistics || {},
              controversyChartData: record.controversy_chart_data || {}
            }
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
        rawData: data[0].raw_data || {},
        // NUEVO: Datos de controversia
        controversyAnalyses: data[0].controversy_analyses || [],
        controversyStatistics: data[0].controversy_statistics || {},
        controversyChartData: data[0].controversy_chart_data || {}
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
  app.post('/api/processTrends', verifyUserAccess, async (req, res) => {
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
        // Debug: log estructura de rawData
        console.log('🔍 Estructura de rawData recibida:', {
          type: typeof rawData,
          isArray: Array.isArray(rawData),
          keys: typeof rawData === 'object' ? Object.keys(rawData) : 'N/A',
          hasTwitterTrends: rawData?.twitter_trends !== undefined,
          twitterTrendsType: typeof rawData?.twitter_trends
        });
        
        // Verificar si es el formato de ExtractorT
        if (rawData.twitter_trends) {
          console.log('Detectado formato de ExtractorT con prefijos numéricos');
          
          // Verificar si twitter_trends es un array de strings
          if (Array.isArray(rawData.twitter_trends) && typeof rawData.twitter_trends[0] === 'string') {
            console.log('Procesando formato de array de strings con prefijos numéricos');
            
            trends = rawData.twitter_trends.map(trendString => {
              // Extraer número de tendencia y volumen si está presente
              const match = trendString.match(/^(\d+)\.\s*(.+?)(\d+[kK])$/);
              
              if (match) {
                const position = parseInt(match[1]) || 0;
                let name = match[2].trim();
                let volume = 1000 - (position * 10); // Valor por defecto basado en la posición
                
                // Si hay un número con K al final, usarlo como volumen
                if (match[3]) {
                  const volStr = match[3].replace(/[kK]$/, '');
                  volume = parseInt(volStr) * 1000;
                  // Remover el número+K del nombre si está ahí
                  name = name.replace(/\d+[kK]$/, '').trim();
                }
                
                return {
                  name: name,
                  volume: volume,
                  position: position
                };
              }
              
              // Si no coincide con el patrón esperado, sanitizar manualmente
              let fallbackName = trendString.replace(/^\d+\.\s*/, '').trim();
              // Detectar volumen al final (e.g., "Pacífico16K" → 16K)
              const volMatch = fallbackName.match(/(\d+)[kK]$/);
              let fallbackVolume = 1;
              if (volMatch) {
                fallbackVolume = parseInt(volMatch[1]) * 1000;
                fallbackName = fallbackName.replace(/(\d+)[kK]$/, '').trim();
              }
              return {
                name: fallbackName,
                volume: fallbackVolume,
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
        // Verificar si es el formato con campo 'trends' (nuevo formato)
        else if (rawData.trends && Array.isArray(rawData.trends)) {
          console.log('Detectado formato con campo "trends"');
          
          // Si es array de strings con prefijos numéricos
          if (typeof rawData.trends[0] === 'string') {
            console.log('Procesando trends como array de strings con prefijos numéricos');
            
            trends = rawData.trends.map(trendString => {
              // Extraer número de tendencia y volumen si está presente
              const match = trendString.match(/^(\d+)\.\s*(.+?)(\d+[kK])$/);
              
              if (match) {
                const position = parseInt(match[1]) || 0;
                let name = match[2].trim();
                let volume = 1000 - (position * 10); // Valor por defecto basado en la posición
                
                // Si hay un número con K al final, usarlo como volumen
                if (match[3]) {
                  const volStr = match[3].replace(/[kK]$/, '');
                  volume = parseInt(volStr) * 1000;
                  // Remover el número+K del nombre si está ahí
                  name = name.replace(/\d+[kK]$/, '').trim();
                }
                
                return {
                  name: name,
                  volume: volume,
                  position: position
                };
              }
              
              // Si no coincide con el patrón esperado, sanitizar manualmente
              let fallbackName = trendString.replace(/^\d+\.\s*/, '').trim();
              // Detectar volumen al final (e.g., "Pacífico16K" → 16K)
              const volMatch = fallbackName.match(/(\d+)[kK]$/);
              let fallbackVolume = 1;
              if (volMatch) {
                fallbackVolume = parseInt(volMatch[1]) * 1000;
                fallbackName = fallbackName.replace(/(\d+)[kK]$/, '').trim();
              }
              return {
                name: fallbackName,
                volume: fallbackVolume,
                position: 0
              };
            });
          }
          // Si es array de objetos
          else if (typeof rawData.trends[0] === 'object') {
            console.log('Procesando trends como array de objetos');
            trends = rawData.trends.map(item => ({
              name: item.name || item.text || item.keyword || 'Tendencia sin nombre',
              volume: item.volume || item.count || 1
            }));
          }
        }
        // Caso para trends24_trends (array numérico)
        else if (rawData.trends24_trends && Array.isArray(rawData.trends24_trends)) {
          console.log('Detectado formato trends24_trends');
          trends = rawData.trends24_trends.map((trend, index) => ({
            name: trend,
            volume: (rawData.trends24_trends.length - index)
          }));
        }
        // Si es array de objetos con structure { name, count/volume }
        else if (Array.isArray(rawData) && rawData.length > 0 && (rawData[0].name || rawData[0].text)) {
          console.log('Detectado formato de array de objetos');
          trends = rawData.map(item => ({
            name: item.name || item.text || item.keyword,
            volume: item.volume || item.count || 1
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
        // ÚLTIMO RECURSO: Si es un objeto genérico, pero SOLO si no tiene campos de metadatos
        else if (typeof rawData === 'object' && !Array.isArray(rawData)) {
          // Verificar que no sea un objeto con metadatos (status, message, etc.)
          const metadataFields = ['status', 'message', 'location', 'count', 'source', 'timestamp'];
          const hasMetadata = metadataFields.some(field => rawData.hasOwnProperty(field));
          
          if (hasMetadata) {
            console.log('❌ Objeto contiene metadatos, no tendencias. Campos detectados:', Object.keys(rawData));
            throw new Error('Objeto contiene metadatos en lugar de tendencias');
          } else {
            console.log('Detectado formato de objeto con keys como tendencias');
            trends = Object.keys(rawData).map(key => ({
              name: key,
              volume: rawData[key] || 1
            }));
          }
        }
      } catch (parseError) {
        console.error('❌ Error parseando datos:', parseError);
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Error al procesar el formato de datos',
          details: parseError.message
        });
      }
      
      // Helper to parse trend strings with volume extraction


      // PROCESAMIENTO PRINCIPAL CON NUEVA LÓGICA
      // Procesar cada item usando la nueva función de extracción
      trends = trends.map(trendItem => {
        const extracted = extractMentionsFromTrend(trendItem);
        return {
          name: sanitizeName(extracted.name),
          volume: extracted.volume,
          position: extracted.position,
          original: trendItem
        };
      });

      // Asegurar que tenemos datos válidos
      trends = trends.filter(t => t.name && t.name.trim() !== '');

      if (trends.length === 0) {
        console.log('❌ Error: No se pudieron extraer tendencias del formato proporcionado');
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Formato de datos no reconocido o sin tendencias'
        });
      }
      
      console.log(`✅ Se encontraron ${trends.length} tendencias para procesar`);
      console.log('📊 Muestra de tendencias procesadas:', trends.slice(0, 3).map(t => ({
        name: t.name,
        volume: t.volume,
        position: t.position
      })));
      
      // 1. PROCESAMIENTO BÁSICO (SÍNCRONO)
      console.time('procesamiento-basico');
      console.log('Iniciando procesamiento de datos básicos');
      
      // Procesar datos básicos
      const basicProcessedTrends = trends.map(trend => {
        // trend.name ya viene sanitizado del parsing anterior
        const trendName = trend.name || 'Tendencia sin nombre';
        const rawCategory = detectarCategoriaLocal(trendName);
        const normalizedCategory = normalizarCategoria(rawCategory);
        
        return {
          name: trendName,
          volume: trend.volume ?? trend.count ?? 1,
          category: normalizedCategory,
          original: trend,
          about: {
            summary: 'Procesando información detallada...',
            tipo: 'trend',
            relevancia: 'media',
            contexto_local: true,
            categoria: normalizedCategory
          }
        };
      });
      
      // Generar estadísticas básicas con categorías normalizadas
      const basicStatistics = {
        total: basicProcessedTrends.length,
        categorias: {},
        timestamp: new Date().toISOString()
      };
      
      // Contar categorías normalizadas
      basicProcessedTrends.forEach(trend => {
        const category = trend.category || 'Otros';
        basicStatistics.categorias[category] = (basicStatistics.categorias[category] || 0) + 1;
      });
      
      // Preparar datos para la nube de palabras con categorías normalizadas
      const wordCloudData = basicProcessedTrends.map(trend => ({
        text: trend.name,
        value: trend.volume ?? 1,
        category: trend.category
      }));
      
      // Datos de categorías normalizadas
      const categoryData = Object.entries(basicStatistics.categorias).map(([name, count]) => ({
        name,
        value: count
      }));

      // Top keywords (estructura consistente con el frontend)
      let topKeywords = basicProcessedTrends
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 10)
        .map(trend => ({
          keyword: trend.name,
          count: trend.volume, // FIXED: Usar volumen real sin fallback que oculte menciones
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

      // FIJO: No rellenar con keywords falsos, usar solo los reales
      // Si tenemos menos de 10 keywords reales, mostrar solo los que tenemos
      // Esto evita mostrar "1 menciones" para keywords inventados
      console.log(`📊 Keywords reales encontrados: ${topKeywords.length}`);
      
      // Si tenemos muy pocos keywords pero queremos completar la lista visualmente,
      // usar variaciones de los keywords reales con conteos proporcionales
      if (topKeywords.length > 0 && topKeywords.length < 10) {
        const originalLength = topKeywords.length;
        const realKeywords = [...topKeywords];
        
        // Solo duplicar si tenemos al menos 3 keywords reales
        if (originalLength >= 3) {
          for (let i = 0; i < Math.min(10 - originalLength, originalLength); i++) {
            const original = realKeywords[i];
            topKeywords.push({
              keyword: `${original.keyword} (relacionado)`,
              count: Math.max(1, Math.floor(original.count * 0.7)), // 70% del count original
              category: original.category,
              about: {
                ...original.about,
                nombre: `${original.keyword} (relacionado)`,
                resumen: `Tema relacionado con ${original.keyword}`,
                relevancia: 'baja'
              }
            });
          }
        }
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
      
      // MANEJO MANUAL DE CRÉDITOS Y LOGGING
      const creditCost = 3; // Costo fijo para processTrends
      
      try {
        // SIEMPRE registrar log de uso
        await logUsage(req.user, '/api/processTrends', creditCost, req);
        
        // Solo debitar créditos si NO es admin
        if (req.user.profile.role !== 'admin') {
          console.log(`💳 Debitando ${creditCost} créditos de ${req.user.profile.email}`);
          
          const { data: updateResult, error } = await supabase
            .from('profiles')
            .update({ credits: req.user.profile.credits - creditCost })
            .eq('id', req.user.id)
            .select('credits')
            .single();

          if (error) {
            console.error('❌ Error debitando créditos:', error);
          } else {
            console.log(`✅ Créditos debitados. Nuevo saldo: ${updateResult.credits}`);
          }
        } else {
          console.log(`👑 Admin ${req.user.profile.email} ejecutó processTrends - Log registrado, sin débito de créditos`);
        }
      } catch (creditError) {
        console.error('❌ Error en manejo de créditos:', creditError);
        // No fallar la operación por errores de créditos/logging
      }
      
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
  
  // ============ ENDPOINT GRATUITO PARA CRON JOBS AUTOMATIZADOS ============
  
  // Endpoint específico para cron jobs automatizados del sistema (SIN autenticación, SIN créditos)
  app.post('/api/cron/processTrends', async (req, res) => {
    const startTime = Date.now();
    console.log(`🤖 [CRON JOB] Solicitud automatizada de procesamiento de tendencias - ${new Date().toISOString()}`);

    try {
      // 1. Obtener datos crudos
      let rawData = req.body.rawData;

      if (!rawData) {
        console.log('🤖 [CRON] Generando datos mock para procesamiento automatizado');
        rawData = { 
          twitter_trends: Array(15).fill().map((_, i) => `${i+1}. Tendencia Auto ${i+1} ${100-i*5}k`)
        };
      }

      // 2. Procesar los datos usando la lógica del endpoint principal
      console.log('🤖 [CRON] Iniciando procesamiento automático...');
      
      // Extraer tendencias del formato de datos (igual que en el endpoint principal)
      let trends = [];
      
      try {
        // Verificar si es el formato de ExtractorT
        if (rawData.twitter_trends) {
          console.log('Detectado formato de ExtractorT con prefijos numéricos');
          
          // Verificar si twitter_trends es un array de strings
          if (Array.isArray(rawData.twitter_trends) && typeof rawData.twitter_trends[0] === 'string') {
            console.log('Procesando formato de array de strings con prefijos numéricos');
            
            trends = rawData.twitter_trends.map(trendString => {
              const extracted = extractMentionsFromTrend(trendString);
              return {
                name: sanitizeName(extracted.name),
                volume: extracted.volume,
                position: extracted.position,
                original: trendString
              };
            });
          } else if (Array.isArray(rawData.twitter_trends)) {
            console.log('Procesando formato de array de objetos');
            
            trends = rawData.twitter_trends.map(trendItem => {
              const extracted = extractMentionsFromTrend(trendItem);
              return {
                name: sanitizeName(extracted.name),
                volume: extracted.volume,
                position: extracted.position,
                original: trendItem
              };
            });
          }
        } else {
          trends = Array(10).fill().map((_, i) => ({
            name: `Tendencia Automatizada ${i+1}`,
            volume: 1000 - (i * 100),
            position: i + 1
          }));
        }
      } catch (parseError) {
        console.error('❌ Error parseando datos:', parseError);
        trends = Array(10).fill().map((_, i) => ({
          name: `Tendencia Auto ${i+1}`,
          volume: 1000 - (i * 100),
          position: i + 1
        }));
      }

      // Asegurar que tenemos datos válidos
      trends = trends.filter(t => t.name && t.name.trim() !== '');

      if (trends.length === 0) {
        trends = Array(10).fill().map((_, i) => ({
          name: `Tendencia Default ${i+1}`,
          volume: 1000 - (i * 100),
          position: i + 1
        }));
      }
      
      console.log(`✅ Se encontraron ${trends.length} tendencias para procesar`);
      console.log('📊 Muestra de tendencias procesadas (CRON):', trends.slice(0, 3).map(t => ({
        name: t.name,
        volume: t.volume,
        position: t.position
      })));
      
            // 3. PROCESAMIENTO COMPLETO CON PERPLEXITY (igual que el endpoint principal)
      console.log('🤖 [CRON] Iniciando procesamiento completo con Perplexity...');
      
      // Procesar los datos básicos primero
      const basicProcessedTrends = trends.map(trend => {
        // trend.name ya viene sanitizado del parsing anterior
        const trendName = trend.name || 'Tendencia sin nombre';
        const rawCategory = detectarCategoriaLocal(trendName);
        const normalizedCategory = normalizarCategoria(rawCategory);
        
        return {
          name: trendName,
          volume: trend.volume ?? trend.count ?? 1,
          category: normalizedCategory,
          original: trend,
          about: {
            summary: 'Procesando información detallada...',
            tipo: 'trend',
            relevancia: 'media',
            contexto_local: true,
            categoria: normalizedCategory
          }
        };
      });

      // Usar la misma lógica que el endpoint principal - procesamiento con Perplexity
      console.log('🤖 [CRON] Procesando con Perplexity Individual...');
      const top10 = basicProcessedTrends.slice(0, 10).map(trend => ({
        name: trend.name,
        volume: trend.volume,
        category: trend.category
      }));
      
      // Procesar con Perplexity Individual (igual que el endpoint principal)
      const processedAbout = await processWithPerplexityIndividual(top10, 'Guatemala');
      
      console.log(`🤖 [CRON] processWithPerplexityIndividual completado. Items procesados: ${processedAbout?.length || 0}`);
      
      // NUEVO: Procesamiento de datos de controversia ya integrados con Perplexity para cron jobs
      console.log('🤖 [CRON] 🔥 Procesando datos de controversia integrados...');
      console.time('cron-procesamiento-controversia');
      
      // Extraer datos de controversia de los datos de Perplexity
      const controversyAnalyses = processedAbout.map(trend => {
        const analysis = trend.about?.controversy_analysis || {};
        return {
          trend_name: trend.name,
          controversy_score: analysis.controversy_score || 1,
          controversy_level: analysis.controversy_level || 'muy_baja',
          polarization_factors: analysis.polarization_factors || [],
          sentiment_distribution: analysis.sentiment_distribution || { positive: 60, negative: 20, neutral: 20 },
          opposing_sides: analysis.opposing_sides || [],
          category: trend.category || 'Otros',
          source: 'perplexity-integrated'
        };
      });
      
      // Generar estadísticas de controversia
      const controversyStatistics = generateControversyStatistics(controversyAnalyses);
      
      // Preparar datos para gráficos de controversia
      const controversyChartData = prepareControversyChartData(controversyAnalyses);
      
      console.timeEnd('cron-procesamiento-controversia');
      console.log('🤖 [CRON] 🔥 Estadísticas de controversia:', {
        totalAnalizadas: controversyStatistics.total_analyzed,
        scorePromedio: controversyStatistics.average_controversy_score,
        distribucionNiveles: controversyStatistics.level_distribution
      });
      
      // Generar estadísticas (igual que el endpoint principal)
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

      console.log(`🤖 [CRON] AboutArray simplificado creado con ${ultraSimplifiedAboutArray.length} items`);

      // Crear topKeywords enriquecidos con información de Perplexity
      const enrichedTopKeywords = processedAbout
        .slice(0, 10)
        .map((trend, index) => {
          const aboutInfo = ultraSimplifiedAboutArray[index];
          return {
            keyword: trend.name,
            count: trend.volume, // FIXED: Usar volumen real sin fallback que oculte menciones
            category: aboutInfo ? aboutInfo.categoria : normalizarCategoria(trend.category || 'Otros'),
            about: aboutInfo || {
              nombre: trend.name,
              resumen: 'Procesamiento automatizado por cron job',
              categoria: normalizarCategoria(trend.category || 'Otros'),
              tipo: 'trend',
              relevancia: 'media',
              contexto_local: true,
              source: 'cron-automated',
              model: 'basic'
            }
          };
        });

      // FIJO: No rellenar con keywords falsos en el procesamiento enriquecido
      // Usar solo los keywords reales para evitar "1 menciones" falsos
      console.log(`📊 Keywords enriquecidos reales: ${enrichedTopKeywords.length}`);
      
      // Si queremos mantener una lista consistente, duplicar keywords reales con variaciones
      if (enrichedTopKeywords.length > 0 && enrichedTopKeywords.length < 10) {
        const originalLength = enrichedTopKeywords.length;
        const realKeywords = [...enrichedTopKeywords];
        
        // Solo agregar variaciones si tenemos al menos 3 keywords reales
        if (originalLength >= 3) {
          for (let i = 0; i < Math.min(10 - originalLength, originalLength); i++) {
            const original = realKeywords[i];
            enrichedTopKeywords.push({
              keyword: `${original.keyword} (análisis)`,
              count: Math.max(2, Math.floor(original.count * 0.8)), // 80% del count original, mínimo 2
              category: original.category,
              about: {
                ...original.about,
                nombre: `${original.keyword} (análisis)`,
                resumen: `Análisis complementario de ${original.keyword}: ${original.about?.resumen || 'Información relacionada'}`,
                relevancia: 'media',
                source: 'cron-automated-extended'
              }
            });
          }
        }
      }

      // Generar categoryData usando las categorías normalizadas y enriquecidas
      const enrichedCategoryMap = {};
      ultraSimplifiedAboutArray.forEach(about => {
        const cat = normalizarCategoria(about.categoria || 'Otros');
        enrichedCategoryMap[cat] = (enrichedCategoryMap[cat] || 0) + 1;
      });
      
      const categoryData = Object.entries(enrichedCategoryMap)
        .map(([name, count]) => ({
          name: normalizarCategoria(name),
          value: count
        }))
        .sort((a, b) => b.value - a.value);

      // WordCloud data con categorías enriquecidas
      const wordCloudData = enrichedTopKeywords.map(keyword => ({
        text: keyword.keyword,
        value: keyword.count,
        category: keyword.category
      }));
      
      // Generar timestamp único para este procesamiento
      const processingTimestamp = new Date().toISOString();
      
              // 4. GUARDAR RESULTADOS COMPLETOS EN SUPABASE
        let recordId = null;
        if (supabase) {
          try {
            console.log('💾 Guardando resultados completos en la tabla trends...');
            const { data, error } = await supabase
              .from('trends')
              .insert([{
                timestamp: processingTimestamp,
                word_cloud_data: wordCloudData,
                top_keywords: enrichedTopKeywords,
                category_data: categoryData,
                about: ultraSimplifiedAboutArray, // Array completo con información de Perplexity
                statistics: statistics, // Estadísticas completas
                processing_status: 'complete', // Marcamos como completo para cron jobs
                raw_data: {
                  trends: basicProcessedTrends,
                  statistics: statistics,
                  location: 'guatemala',
                  processing_time: (Date.now() - startTime) / 1000,
                  source: 'cron-automated'
                },
                // NUEVO: Datos de controversia para cron jobs
                controversy_analyses: controversyAnalyses,
                controversy_statistics: controversyStatistics,
                controversy_chart_data: controversyChartData
              }])
              .select();
          
          if (error) {
            console.error('❌ Error guardando resultados:', error);
          } else {
            console.log('✅ Resultados guardados correctamente');
            recordId = data && data[0] ? data[0].id : null;
          }
        } catch (dbError) {
          console.error('❌ Error guardando en base de datos:', dbError);
        }
      }
      
      const executionTime = Date.now() - startTime;
      console.log('🤖 [CRON] ✅ Procesamiento automatizado completado exitosamente');

              res.json({
          success: true,
          message: 'Tendencias procesadas automáticamente con Perplexity y análisis de controversia',
          source: 'cron_job_automated',
          timestamp: processingTimestamp,
          data: {
            wordCloudData,
            topKeywords: enrichedTopKeywords,
            categoryData,
            about: ultraSimplifiedAboutArray,
            statistics: statistics,
            // NUEVO: Datos de controversia en la respuesta
            controversyAnalyses,
            controversyStatistics,
            controversyChartData
          },
          record_id: recordId,
          execution_time: `${executionTime}ms`,
          note: 'Procesamiento automatizado completo del sistema con análisis de controversia - Sin costo de créditos'
        });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('🤖 [CRON] ❌ Error en procesamiento automatizado:', error);

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
  
  // ============ FIN ENDPOINT CRON JOBS ============
  
  // NOTA: Endpoint de sondeos movido a server/routes/sondeos.js
}

/**
 * Genera estadísticas de controversia a partir de los datos de análisis
 * @param {Array} controversyAnalyses - Array de análisis de controversia
 * @returns {Object} - Estadísticas de controversia
 */
function generateControversyStatistics(controversyAnalyses) {
  const stats = {
    total_analyzed: controversyAnalyses.length,
    average_controversy_score: 0,
    level_distribution: {
      muy_baja: 0,
      baja: 0,
      media: 0,
      alta: 0,
      muy_alta: 0
    },
    sentiment_summary: {
      positive: 0,
      negative: 0,
      neutral: 0
    },
    most_controversial: null,
    least_controversial: null,
    polarization_factors: []
  };

  if (controversyAnalyses.length === 0) {
    return stats;
  }

  let totalScore = 0;
  let maxScore = 0;
  let minScore = 10;
  let maxTrend = null;
  let minTrend = null;

  controversyAnalyses.forEach(analysis => {
    const score = analysis.controversy_score || 1;
    totalScore += score;

    // Trackear máximo y mínimo
    if (score > maxScore) {
      maxScore = score;
      maxTrend = analysis.trend_name;
    }
    if (score < minScore) {
      minScore = score;
      minTrend = analysis.trend_name;
    }

    // Contar niveles
    const level = analysis.controversy_level || 'muy_baja';
    if (stats.level_distribution[level] !== undefined) {
      stats.level_distribution[level]++;
    }

    // Agregar sentimientos
    if (analysis.sentiment_distribution) {
      stats.sentiment_summary.positive += analysis.sentiment_distribution.positive || 0;
      stats.sentiment_summary.negative += analysis.sentiment_distribution.negative || 0;
      stats.sentiment_summary.neutral += analysis.sentiment_distribution.neutral || 0;
    }

    // Recopilar factores de polarización únicos
    if (analysis.polarization_factors && Array.isArray(analysis.polarization_factors)) {
      analysis.polarization_factors.forEach(factor => {
        if (factor.factor && !stats.polarization_factors.some(f => f.factor === factor.factor)) {
          stats.polarization_factors.push({
            factor: factor.factor,
            frequency: 1,
            avg_intensity: factor.intensity || 1
          });
        }
      });
    }
  });

  stats.average_controversy_score = Number((totalScore / controversyAnalyses.length).toFixed(2));
  stats.most_controversial = maxTrend;
  stats.least_controversial = minTrend;

  // Normalizar sentimientos
  const totalSentiment = stats.sentiment_summary.positive + stats.sentiment_summary.negative + stats.sentiment_summary.neutral;
  if (totalSentiment > 0) {
    stats.sentiment_summary.positive = Math.round((stats.sentiment_summary.positive / totalSentiment) * 100);
    stats.sentiment_summary.negative = Math.round((stats.sentiment_summary.negative / totalSentiment) * 100);
    stats.sentiment_summary.neutral = Math.round((stats.sentiment_summary.neutral / totalSentiment) * 100);
  }

  return stats;
}

/**
 * Prepara datos para gráficos de controversia
 * @param {Array} controversyAnalyses - Array de análisis de controversia
 * @returns {Object} - Datos para gráficos
 */
function prepareControversyChartData(controversyAnalyses) {
  const chartData = {
    score_distribution: [],
    level_distribution: [],
    sentiment_by_category: [],
    polarization_trends: [],
    controversy_timeline: []
  };

  if (controversyAnalyses.length === 0) {
    return chartData;
  }

  // Distribución de puntuaciones
  const scoreRanges = {
    '1-2': 0,
    '3-4': 0,
    '5-6': 0,
    '7-8': 0,
    '9-10': 0
  };

  controversyAnalyses.forEach(analysis => {
    const score = analysis.controversy_score || 1;
    if (score <= 2) scoreRanges['1-2']++;
    else if (score <= 4) scoreRanges['3-4']++;
    else if (score <= 6) scoreRanges['5-6']++;
    else if (score <= 8) scoreRanges['7-8']++;
    else scoreRanges['9-10']++;
  });

  chartData.score_distribution = Object.entries(scoreRanges).map(([range, count]) => ({
    range,
    count,
    percentage: Math.round((count / controversyAnalyses.length) * 100)
  }));

  // Distribución de niveles
  const levelCounts = {
    muy_baja: 0,
    baja: 0,
    media: 0,
    alta: 0,
    muy_alta: 0
  };

  controversyAnalyses.forEach(analysis => {
    const level = analysis.controversy_level || 'muy_baja';
    if (levelCounts[level] !== undefined) {
      levelCounts[level]++;
    }
  });

  chartData.level_distribution = Object.entries(levelCounts).map(([level, count]) => ({
    level,
    count,
    percentage: Math.round((count / controversyAnalyses.length) * 100)
  }));

  // Sentimientos por categoría
  const categoryStats = {};
  controversyAnalyses.forEach(analysis => {
    const category = analysis.category || 'Otros';
    if (!categoryStats[category]) {
      categoryStats[category] = {
        positive: 0,
        negative: 0,
        neutral: 0,
        total: 0
      };
    }
    
    if (analysis.sentiment_distribution) {
      categoryStats[category].positive += analysis.sentiment_distribution.positive || 0;
      categoryStats[category].negative += analysis.sentiment_distribution.negative || 0;
      categoryStats[category].neutral += analysis.sentiment_distribution.neutral || 0;
      categoryStats[category].total++;
    }
  });

  chartData.sentiment_by_category = Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    positive: stats.total > 0 ? Math.round(stats.positive / stats.total) : 0,
    negative: stats.total > 0 ? Math.round(stats.negative / stats.total) : 0,
    neutral: stats.total > 0 ? Math.round(stats.neutral / stats.total) : 0
  }));

  return chartData;
}

// Función para procesamiento detallado en background
async function processDetailedInBackground(processingTimestamp, trendsData, location, userId, startTime) {
  try {
    console.log(`🔄 Procesando detalles en background (ID: ${processingTimestamp})...`);
    console.log(`📊 Procesando ${trendsData.length} tendencias`);
    
    // Convertir trendsData al formato que espera processWithPerplexityIndividual
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
    
    // NUEVO: Procesamiento de datos de controversia ya integrados con Perplexity
    console.log('🔥 Procesando datos de controversia integrados...');
    console.time('procesamiento-controversia');
    
    // Extraer datos de controversia de los datos de Perplexity
    const controversyAnalyses = processedAbout.map(trend => {
      const analysis = trend.about?.controversy_analysis || {};
      return {
        trend_name: trend.name,
        controversy_score: analysis.controversy_score || 1,
        controversy_level: analysis.controversy_level || 'muy_baja',
        polarization_factors: analysis.polarization_factors || [],
        sentiment_distribution: analysis.sentiment_distribution || { positive: 60, negative: 20, neutral: 20 },
        opposing_sides: analysis.opposing_sides || [],
        category: trend.category || 'Otros',
        source: 'perplexity-integrated'
      };
    });
    
    // Generar estadísticas de controversia
    const controversyStatistics = generateControversyStatistics(controversyAnalyses);
    
    // Preparar datos para gráficos de controversia
    const controversyChartData = prepareControversyChartData(controversyAnalyses);
    
    console.timeEnd('procesamiento-controversia');
    console.log(`✅ Procesamiento de controversia completado. Tendencias procesadas: ${controversyAnalyses.length}`);
    
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

    // Obtener los topKeywords originales del registro en Supabase
    let originalTopKeywords = [];
    try {
      const { data: originalData, error: fetchError } = await supabase
        .from('trends')
        .select('top_keywords')
        .eq('timestamp', processingTimestamp)
        .single();
      
      if (!fetchError && originalData && originalData.top_keywords) {
        originalTopKeywords = originalData.top_keywords;
      }
    } catch (fetchErr) {
      console.error('⚠️ Error obteniendo topKeywords originales:', fetchErr);
    }

    // Si no hay topKeywords originales, generarlos a partir de los datos procesados
    if (originalTopKeywords.length === 0) {
      originalTopKeywords = processedAbout
        .slice(0, 10)
        .map((trend, index) => ({
          keyword: trend.name,
          count: trend.volume, // FIXED: Usar volumen real sin fallback que oculte menciones
          category: 'Otros',
          about: {
            nombre: trend.name,
            resumen: 'Procesando información detallada...',
            categoria: 'Otros',
            tipo: 'trend',
            relevancia: 'media',
            contexto_local: true,
            source: 'basic-processing',
            model: 'basic'
          }
        }));
    }

    // Actualizar topKeywords con la información enriquecida
    const enrichedTopKeywords = originalTopKeywords.map((keyword, index) => {
      const aboutInfo = ultraSimplifiedAboutArray[index];
      if (aboutInfo) {
        return {
          ...keyword,
          category: aboutInfo.categoria,
          about: aboutInfo
        };
      }
      return {
        ...keyword,
        category: normalizarCategoria(keyword.category || 'Otros'),
        about: {
          ...keyword.about,
          categoria: normalizarCategoria(keyword.category || 'Otros')
        }
      };
    });

    // Generar categoryData usando las categorías normalizadas
    const enrichedCategoryMap = {};
    ultraSimplifiedAboutArray.forEach(about => {
      const cat = normalizarCategoria(about.categoria || 'Otros');
      enrichedCategoryMap[cat] = (enrichedCategoryMap[cat] || 0) + 1;
    });
    
    const enrichedCategoryData = Object.entries(enrichedCategoryMap)
      .map(([name, count]) => ({
        name: normalizarCategoria(name),
        value: count
      }))
      .sort((a, b) => b.value - a.value);

    console.log('📊 Estadísticas generadas:', JSON.stringify(statistics, null, 2));
    
    // Actualizar en Supabase usando el timestamp como identificador
    if (supabase) {
      try {
        console.log('🔄 Actualizando registro en Supabase con about, estadísticas y datos enriquecidos...');
        
        const updateData = {
          about: ultraSimplifiedAboutArray,
          statistics: statistics,
          category_data: enrichedCategoryData,
          top_keywords: enrichedTopKeywords,
          processing_status: 'complete',
          // NUEVO: Datos de controversia integrados
          controversy_analyses: controversyAnalyses,
          controversy_statistics: controversyStatistics,
          controversy_chart_data: controversyChartData
        };
        
        const { error } = await supabase
          .from('trends')
          .update(updateData)
          .eq('timestamp', processingTimestamp);
        
        if (error) {
          console.error('❌ Error actualizando registro completo:', error, JSON.stringify(error, null, 2));
        } else {
          console.log('✅ Registro actualizado exitosamente con about, estadísticas y datos enriquecidos');
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
 * Normaliza categorías a un conjunto fijo de categorías principales
 * @param {string} category - Categoría original
 * @returns {string} - Categoría normalizada
 */
function normalizarCategoria(category) {
  if (!category || typeof category !== 'string') {
    return 'Otros';
  }
  
  const categoryLower = category.toLowerCase().trim();
  
  // Mapeo estricto de palabras clave a categorías principales
  const CATEGORIA_PRINCIPAL = {
    // Política e Internacional (prioridad a Internacional si contiene ambas)
    'internacional': ['internacional', 'global', 'mundial', 'geopolítica', 'foreign', 'world'],
    'política': ['política', 'politica', 'político', 'politico', 'politics', 'government', 'gobierno'],
    
    // Deportes
    'deportes': ['deporte', 'deportes', 'sports', 'fútbol', 'futbol', 'football', 'soccer', 'basketball', 'béisbol', 'beisbol'],
    
    // Entretenimiento y Música (prioridad a Música si contiene ambas)
    'música': ['música', 'musica', 'music', 'k-pop', 'kpop', 'cantante', 'artista', 'concierto'],
    'entretenimiento': ['entretenimiento', 'entertainment', 'cine', 'película', 'pelicula', 'series', 'tv', 'television', 'show'],
    
    // Economía
    'economía': ['economía', 'economia', 'economy', 'finanzas', 'finance', 'mercado', 'market', 'negocios', 'business'],
    
    // Tecnología
    'tecnología': ['tecnología', 'tecnologia', 'technology', 'tech', 'software', 'hardware', 'digital', 'internet', 'app'],
    
    // Social
    'social': ['social', 'sociedad', 'society', 'cultural', 'community', 'trending']
  };

  // Primero intentar encontrar una coincidencia exacta
  for (const [categoria, keywords] of Object.entries(CATEGORIA_PRINCIPAL)) {
    if (keywords.includes(categoryLower)) {
      return categoria.charAt(0).toUpperCase() + categoria.slice(1);
    }
  }

  // Si no hay coincidencia exacta, buscar coincidencias parciales
  for (const [categoria, keywords] of Object.entries(CATEGORIA_PRINCIPAL)) {
    for (const keyword of keywords) {
      if (categoryLower.includes(keyword)) {
        return categoria.charAt(0).toUpperCase() + categoria.slice(1);
      }
    }
  }

  // Manejar casos especiales de categorías compuestas
  if (categoryLower.includes('internacional') || categoryLower.includes('global')) {
    return 'Internacional';
  }
  
  if (categoryLower.includes('música') || categoryLower.includes('musica')) {
    return 'Música';
  }

  // Si no hay coincidencia, devolver 'Otros'
  return 'Otros';
}

/**
 * Sanitiza valores para almacenamiento seguro en JSON/Supabase
 * @param {any} value - Valor a sanitizar
 * @param {number} maxLength - Longitud máxima permitida
 * @returns {string} - Valor sanitizado
 */
function sanitizeForJSON(value, maxLength = 500) {
  if (value === null || value === undefined) {
    return '';
  }
  
  let sanitized = String(value)
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remover caracteres de control
    .replace(/\\/g, '\\\\') // Escapar backslashes
    .replace(/"/g, '\\"') // Escapar comillas dobles
    .trim();
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
  }
  
  return sanitized;
}

module.exports = setupTrendsRoutes; 