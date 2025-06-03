const express = require('express');
const cors = require('cors');
// Usa fetch nativo si tienes Node 18+, si no, descomenta la siguiente línea:
// const fetch = require('node-fetch');

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
      if (categoryMap[trend.category]) {
        categoryMap[trend.category] += 1;
      } else {
        categoryMap[trend.category] = 1;
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
    const statistics = generateStatistics(processedAbout);
    console.timeEnd('generacion-estadisticas');
    
    // Formato about para compatibilidad con frontend
    const aboutArray = processedAbout.map(item => item.about);
    console.log(`📊 aboutArray generado con ${aboutArray.length} items`);

    // --- NUEVO: Generar categoryData enriquecido usando la categoría de about ---
    const enrichedCategoryMap = {};
    aboutArray.forEach(about => {
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
          aboutCount: aboutArray.length,
          statisticsKeys: Object.keys(statistics),
          categoryDataCount: enrichedCategoryData.length,
          recordId: recordId
        });
        
        const { error: updateError } = await supabase
          .from('trends')
          .update({
            about: aboutArray,
            statistics: statistics,
            category_data: enrichedCategoryData,
            processing_status: 'complete'
          })
          .eq('id', recordId);
          
        if (updateError) {
          console.error('❌ Error actualizando registro con about:', updateError, JSON.stringify(updateError, null, 2));
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
    environment: process.env.NODE_ENV || 'development'
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

    // Llamada a Perplexity
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

    // Obtener tweets de las últimas 24 horas, agrupados por categoría
    const { data: tweets, error } = await supabase
      .from('trending_tweets')
      .select('*')
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

    // Generar análisis de sentimiento para cada tweet
    const tweetsWithSentiment = await Promise.all(
      tweets.map(async (tweet) => {
        let sentiment = 'neutral';
        
        // Análisis básico de sentimiento (puedes usar IA aquí si está disponible)
        if (PERPLEXITY_API_KEY && USE_AI) {
          try {
            sentiment = await analyzeTweetSentiment(tweet.texto);
          } catch (error) {
            console.warn(`Error analizando sentimiento para tweet ${tweet.id}:`, error.message);
          }
        } else {
          // Análisis de sentimiento básico sin IA
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
          sentiment: sentiment
        };
      })
    );

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

// Función auxiliar para análisis de sentimiento con IA
async function analyzeTweetSentiment(text) {
  try {
    const prompt = `Analiza el sentimiento del siguiente tweet y responde solo con una palabra: "positivo", "negativo" o "neutral".

Tweet: "${text}"

Respuesta:`;

    const payload = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en análisis de sentimientos. Responde solo con una palabra: positivo, negativo o neutral.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    };

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
      const sentiment = data.choices?.[0]?.message?.content?.trim().toLowerCase();
      
      if (sentiment && ['positivo', 'negativo', 'neutral'].includes(sentiment)) {
        return sentiment;
      }
    }
  } catch (error) {
    console.warn('Error en análisis de sentimiento IA:', error.message);
  }
  
  // Fallback a análisis básico
  return basicSentimentAnalysis(text);
}

// Función auxiliar para análisis de sentimiento básico (sin IA)
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
        model: 'openai/gpt-4o:online',
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
          // Intentar parsear como JSON directo
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
    
    // Obtener fecha actual dinámica
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Construir consulta específica para búsqueda web
    const searchQuery = `${trendName} ${location} ${currentMonth} ${currentYear} noticias actualidad`;
    
    // Consultas adicionales para mejorar la búsqueda
    const alternativeQueries = [
      `${trendName} fútbol ${currentMonth} ${currentYear}`, // Para deportes
      `${trendName} retiro futbol ${currentMonth} ${currentYear}`, // Para retiros
      `${trendName} jugador ${currentMonth} ${currentYear}`, // Para jugadores
      `${trendName} noticia mayo 2025`, // Búsqueda directa por fecha
      `"${trendName}" trending ${currentMonth} 2025` // Búsqueda exacta
    ];
    
    // Prompt optimizado: más corto y directo
    const prompt = `Analiza la tendencia "${trendName}" en ${location}, ${currentMonth} ${currentYear}.

¿QUÉ ES y POR QUÉ está siendo tendencia AHORA?

Instrucciones:
- Si es un APODO, identifica la persona real
- Busca eventos ESPECÍFICOS de ${currentMonth} 2025: partidos, retiros, lanzamientos, noticias, escándalos
- Determina si es LOCAL (${location}) o GLOBAL
- NO digas "sin información" - busca más profundo

Responde SOLO en JSON:
{
  "nombre": "Nombre real si es apodo, sino '${trendName}'",
  "tipo": "persona|evento|equipo|película|música|político|futbolista|artista",
  "categoria": "Deportes|Política|Entretenimiento|Música|Otros",
  "resumen": "Explicación corta y específica del evento exacto que lo hizo tendencia",
  "relevancia": "alta|media|baja",
  "contexto_local": true/false,
  "razon_tendencia": "Evento específico que causó la tendencia"
}`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `Eres un analista de tendencias especializado en detectar por qué algo es trending en ${currentMonth} ${currentYear}.

Experto en:
- Eventos actuales específicos (deportes, política, entretenimiento)
- Identificar apodos de personas famosas
- Distinguir tendencias locales de ${location} vs globales
- Encontrar la razón EXACTA por la cual algo es tendencia HOY

Busca profundamente, no digas "sin información". Si es apodo, identifica la persona real.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 300
    };

    console.log(`   📡 Realizando consulta a Perplexity...`);
    
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
            
            // Enriquecer con metadata
            const enriched = {
              ...parsed,
              source: 'perplexity',
              model: 'sonar',
              search_query: searchQuery,
              timestamp: new Date().toISOString(),
              raw_response: rawResponse
            };
            
            console.log(`   📊 ${trendName}: Categoría=${enriched.categoria}, Relevancia=${enriched.relevancia}`);
            return enriched;
          }
        } catch (parseError) {
          console.log(`   ⚠️  Error parseando JSON para ${trendName}, usando respuesta raw`);
        }
        
        // Si no se puede parsear JSON, crear estructura manual
        return {
          nombre: trendName,
          tipo: 'hashtag',
          categoria: detectarCategoria(trendName, rawResponse),
          resumen: rawResponse.substring(0, 300),
          relevancia: 'media',
          contexto_local: rawResponse.toLowerCase().includes('guatemala'),
          palabras_clave: [trendName],
          source: 'perplexity',
          model: 'sonar',
          raw_response: rawResponse
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