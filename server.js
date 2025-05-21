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
          console.log(`Información obtenida para ${trend.keyword}: ${trend.about ? trend.about.substring(0, 50) + '...' : 'No se pudo obtener información'}`);
        }
        
        // Para el resto usamos información genérica
        for (let i = 5; i < topKeywords.length; i++) {
          topKeywords[i].about = `Información sobre ${topKeywords[i].keyword}`;
        }
      } catch (error) {
        console.error('Error al enriquecer tendencias:', error);
        // Agregar información genérica en caso de error
        topKeywords.forEach(trend => {
          if (!trend.about) {
            trend.about = `Tendencia relacionada con ${trend.keyword}`;
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
    console.log(JSON.stringify(rawData, null, 2).substring(0, 500) + '...'); // Mostrar los primeros 500 caracteres
    
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
    
    // 2. Procesar datos (sin IA)
    console.time('procesamiento-datos');
    console.log('Iniciando procesamiento de datos sin IA');
    
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
    
    // Convertir a formato uniforme
    const uniformTrends = trends.map(trend => {
      // Instrucciones de depuración
      console.log('Estructura del trend:', JSON.stringify(trend, null, 2));
      
      // Objeto base para almacenar todas las propiedades procesadas
      let uniformTrend = {
        name: 'Sin nombre',
        volume: 1,
        category: 'General'
      };
      
      // Extraer nombre del trend (ampliando las posibilidades)
      if (typeof trend === 'string') {
        uniformTrend.name = trend;
      } else if (typeof trend === 'object') {
        // Comprobar todas las claves posibles para extraer un nombre
        const possibleNameKeys = ['name', 'keyword', 'text', 'title', 'word', 'term'];
        for (const key of possibleNameKeys) {
          if (trend[key] && typeof trend[key] === 'string' && trend[key].trim()) {
            uniformTrend.name = trend[key].trim();
            break;
          }
        }
        
        // Si todavía no tenemos un nombre y hay un atributo que es string, usarlo como nombre
        if (uniformTrend.name === 'Sin nombre') {
          for (const [key, value] of Object.entries(trend)) {
            if (typeof value === 'string' && value.trim() && 
                key !== 'category' && key !== 'color' && key !== 'about') {
              uniformTrend.name = value.trim();
              break;
            }
          }
        }
        
        // NUEVO: Si aún no hay nombre pero hay una categoría, usar la categoría como nombre
        if (uniformTrend.name === 'Sin nombre' && trend.category && typeof trend.category === 'string') {
          uniformTrend.name = `${trend.category}`;
        }
        
        // Extraer valor/conteo/volumen con más opciones
        const possibleVolumeKeys = ['volume', 'count', 'value', 'weight', 'size', 'frequency'];
        for (const key of possibleVolumeKeys) {
          if (trend[key] && !isNaN(Number(trend[key]))) {
            uniformTrend.volume = Number(trend[key]);
            break;
          }
        }
        
        // Extraer categoría
        if (trend.category && typeof trend.category === 'string') {
          uniformTrend.category = trend.category;
        }
        
        // Preservar campo about si existe
        if (trend.about && typeof trend.about === 'string') {
          uniformTrend.about = trend.about;
          console.log(`Preservando campo about: "${uniformTrend.about ? uniformTrend.about.substring(0, 50) + '...' : 'No hay información'}"`);
        }
      }
      
      // Log del resultado final para depuración
      console.log(`Procesado: name=${uniformTrend.name}, volume=${uniformTrend.volume}, category=${uniformTrend.category}`);
      
      return uniformTrend;
    });
    
    // Ordenar por volumen descendente
    uniformTrends.sort((a, b) => b.volume - a.volume);
    
    // Tomar las 10 principales tendencias
    const top10 = uniformTrends.slice(0, 10);
    
    // Si hay menos de 10, repetir para completar
    while (top10.length < 10) {
      top10.push({...top10[top10.length % Math.max(1, top10.length)]});
    }
    
    // 3. Crear estructuras de datos requeridas
    
    // A. TopKeywords - Preparación de nombres y conteos
    // Creamos una función auxiliar para mejorar la consistencia con wordCloudData
    const getKeywordName = (trend, index) => {
      if (trend.name !== 'Sin nombre') {
        return trend.name;
      }
      
      // Ya que los nombres serán usados en topKeywords y wordCloudData,
      // guardamos el nombre recuperado en el trend original para consistencia
      
      // Intentar buscar en el trend original
      if (Array.isArray(trends) && trends[index]) {
        const originalTrend = trends[index];
        // Buscar cualquier campo string que pueda contener el nombre
        if (typeof originalTrend === 'object') {
          for (const [key, value] of Object.entries(originalTrend)) {
            if (typeof value === 'string' && value.trim() && 
                key !== 'category' && key !== 'color' &&
                !['id', 'count', 'volume', 'frequency'].includes(key.toLowerCase())) {
              console.log(`Recuperado nombre "${value.trim()}" desde trends[${index}].${key}`);
              return value.trim();
            }
          }
        } else if (typeof originalTrend === 'string') {
          return originalTrend.trim();
        }
      }
      
      // Si no se encontró en trends, buscar en rawData
      if (rawData && typeof rawData === 'object') {
        const originalArray = Array.isArray(rawData) ? rawData : 
                            (rawData.trends && Array.isArray(rawData.trends)) ? rawData.trends : 
                            (rawData.twitter_trends && Array.isArray(rawData.twitter_trends)) ? rawData.twitter_trends : 
                            null;
        
        if (originalArray && originalArray[index]) {
          const rawTrend = originalArray[index];
          
          if (typeof rawTrend === 'string') {
            return rawTrend.trim();
          } else if (typeof rawTrend === 'object') {
            // Buscar campos que puedan contener el nombre
            for (const [key, value] of Object.entries(rawTrend)) {
              if (typeof value === 'string' && value.trim() && 
                  key !== 'category' && key !== 'color' &&
                  !['id', 'count', 'volume', 'frequency'].includes(key.toLowerCase())) {
                console.log(`Recuperado nombre "${value.trim()}" desde rawData[${index}].${key}`);
                return value.trim();
              }
            }
          }
        }
      }
      
      // Si todo falla, usar nombre genérico
      return `Tendencia ${index + 1}`;
    };
    
    // Aplicamos la función a cada trend para extraer nombres consistentes
    const topKeywords = top10.map((trend, index) => {
      const keywordName = getKeywordName(trend, index);
      // Actualizar el nombre en el trend original para wordCloudData
      trend.name = keywordName; 
      
      // Crear objeto base para cada keyword
      let keywordObj = {
        keyword: keywordName,
        count: trend.volume
      };
      
      // Preservar el campo 'about' si existe en el trend original
      if (trend.about) {
        keywordObj.about = trend.about;
      }
      
      // También revisar si el trend original tiene el campo about en otra estructura
      if (Array.isArray(trends) && trends[index] && trends[index].about) {
        keywordObj.about = trends[index].about;
      }
      
      return keywordObj;
    });
    
    // Enriquecer con información sobre cada tendencia si USE_WEB_SEARCH está habilitado
    if (USE_WEB_SEARCH) {
      console.time('enriquecimiento-tendencias');
      console.log('Obteniendo información adicional sobre tendencias...');
      
      try {
        // Procesamos las 5 tendencias principales para no retrasar demasiado la respuesta
        for (let i = 0; i < Math.min(5, topKeywords.length); i++) {
          const trend = topKeywords[i];
          
          // Solo buscar información si no se proporcionó en los datos originales
          if (!trend.about) {
            trend.about = await searchTrendInfo(trend.keyword);
            console.log(`Información obtenida para ${trend.keyword}: ${trend.about ? trend.about.substring(0, 50) + '...' : 'No se pudo obtener información'}`);
          } else {
            console.log(`Usando información existente para ${trend.keyword}: ${trend.about ? trend.about.substring(0, 50) + '...' : 'No hay información'}`);
          }
        }
        
        // Para el resto de tendencias, lo haremos de forma asíncrona después
        // y lo actualizaremos en Supabase, pero no retrasamos la respuesta inicial
        if (topKeywords.length > 5) {
          (async () => {
            for (let i = 5; i < topKeywords.length; i++) {
              const trend = topKeywords[i];
              
              // Solo buscar información si no se proporcionó en los datos originales
              if (!trend.about) {
                trend.about = await searchTrendInfo(trend.keyword);
                console.log(`Información posterior obtenida para ${trend.keyword}`);
                
                // Actualizar en Supabase si está configurado
                if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase) {
                  try {
                    await supabase
                      .from('trend_details')
                      .upsert({
                        keyword: trend.keyword,
                        about: trend.about,
                        count: trend.count,
                        updated_at: new Date().toISOString()
                      });
                  } catch (err) {
                    console.error(`Error al actualizar información en Supabase: ${err.message}`);
                  }
                }
              }
            }
          })();
        }
      } catch (error) {
        console.error('Error al enriquecer tendencias:', error);
      }
      
      console.timeEnd('enriquecimiento-tendencias');
    }
    
    // B. WordCloudData - Para la nube de palabras
    // Calcular valores min-max para escalar adecuadamente
    const volumes = top10.map(t => t.volume);
    const minVol = Math.min(...volumes);
    const maxVol = Math.max(...volumes);
    
    console.log(`Rango de volúmenes: min=${minVol}, max=${maxVol}`);
    
    // Crear una función para asegurar que los nombres de tendencias sean consistentes
    // entre wordCloudData y topKeywords
    const getConsistentName = (trend, index) => {
      // Si ya se asignó un keyword en topKeywords, usar ese mismo valor para consistencia
      if (topKeywords[index] && topKeywords[index].keyword) {
        return topKeywords[index].keyword;
      }
      return trend.name;
    };
    
    // Ahora wordCloudData puede usar directamente los nombres ya recuperados y normalizados
    const wordCloudData = top10.map((trend, index) => {
      // Calcular un valor escalado entre 20 y 100 para el tamaño
      let scaledValue = 60; // Valor predeterminado
      
      if (minVol !== maxVol) {
        scaledValue = Math.round(20 + ((trend.volume - minVol) / (maxVol - minVol)) * 80);
      }
      
      // Asegurar que el texto sea siempre consistente con los keywords
      const trendText = getConsistentName(trend, index);
      
      // Asegurarnos de tener valores válidos para la visualización
      const visualValue = isNaN(scaledValue) ? 60 : Math.max(20, Math.min(100, scaledValue));
      
      return {
        text: trendText,
        value: visualValue,
        color: COLORS[index % COLORS.length]
      };
    });
    
    // C. CategoryData - Agrupar por categorías
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
    
    console.timeEnd('procesamiento-datos');
    
    // 4. Crear objeto de respuesta
    const processedData = {
      topKeywords,
      wordCloudData,
      categoryData,
      timestamp: new Date().toISOString()
    };
    
        // 5. Guardar en Supabase
    console.time('guardado-supabase');
    if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase) {
      try {
        console.log('Guardando datos en Supabase...');
        
        // Guardar la tendencia principal en la tabla 'trends'
        const { error } = await supabase
          .from('trends')
          .insert([{
            timestamp: processedData.timestamp,
            word_cloud_data: processedData.wordCloudData,
            top_keywords: processedData.topKeywords,
            category_data: processedData.categoryData,
            raw_data: rawData
          }]);
        
        if (error) {
          console.error('Error al guardar en Supabase (tabla trends):', error);
        } else {
          console.log('Datos guardados exitosamente en tabla trends');
          
          // También guardar cada keyword individual en la tabla 'trend_details'
          // para facilitar consultas específicas
          console.log('Guardando detalles de cada tendencia en tabla trend_details...');
          
          // Procesamos secuencialmente para evitar errores de concurrencia
          for (const trend of processedData.topKeywords) {
            try {
              const { error: detailError } = await supabase
                .from('trend_details')
                .upsert({
                  keyword: trend.keyword,
                  about: trend.about || null,  // Aseguramos que about se guarde en su propia columna
                  count: trend.count,
                  updated_at: new Date().toISOString()
                });
                
              if (detailError) {
                console.error(`Error al guardar detalles para ${trend.keyword}:`, detailError);
              }
            } catch (detailErr) {
              console.error(`Error en proceso de upsert para ${trend.keyword}:`, detailErr);
            }
          }
          
          console.log('Proceso de guardado completo');
        }
      } catch (err) {
        console.error('Error al intentar guardar en Supabase:', err);
      }
    } else {
      console.log('Credenciales de Supabase no configuradas o cliente no inicializado, omitiendo guardado');
    }
    console.timeEnd('guardado-supabase');
    
    // 6. Responder al cliente
    console.log('Enviando respuesta al cliente');
    
    // Información de diagnóstico completa
    console.log('DIAGNÓSTICO: wordCloudData ----------');
    processedData.wordCloudData.forEach((item, index) => {
      console.log(`[${index}] text: "${item.text}", value: ${item.value}, color: ${item.color}`);
    });
    
    console.log('\nDIAGNÓSTICO: topKeywords ----------');
    processedData.topKeywords.forEach((item, index) => {
      const aboutPreview = item.about 
        ? `about: "${item.about.substring(0, 30)}..."` 
        : "about: no definido";
      console.log(`[${index}] keyword: "${item.keyword}", count: ${item.count}, ${aboutPreview}`);
    });
    
    console.log('\nDIAGNÓSTICO: categoryData ----------');
    processedData.categoryData.forEach((item, index) => {
      console.log(`[${index}] category: "${item.category}", count: ${item.count}`);
    });
    
    // Validación final para verificar consistencia entre wordCloudData y topKeywords
    console.log('\nVALIDACIÓN DE CONSISTENCIA:');
    processedData.wordCloudData.forEach((item, index) => {
      if (index < processedData.topKeywords.length) {
        const keyword = processedData.topKeywords[index].keyword;
        const text = item.text;
        const isConsistent = keyword === text;
        console.log(`[${index}] wordCloud.text: "${text}" ${isConsistent ? '=' : '!='} topKeywords.keyword: "${keyword}"`);
        
        if (!isConsistent) {
          console.warn(`⚠️ Inconsistencia detectada en índice ${index}`);
        }
      }
    });
    
    console.timeEnd('procesamiento-total');
    res.json(processedData);
    
  } catch (error) {
    console.error('Error en /api/processTrends:', error);
    res.status(500).json({ 
      error: 'Error processing trends', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoints adicionales para diagnóstico

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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

// Función para buscar información sobre una tendencia
async function searchTrendInfo(trend) {
  try {
    console.log(`Buscando información sobre: ${trend}`);
    
    // Usar Perplexity API si está disponible (requiere API key)
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (PERPLEXITY_API_KEY) {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-instruct',
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente que proporciona información concisa sobre temas tendencia. Responde en 2-3 oraciones máximo.'
            },
            {
              role: 'user',
              content: `¿De qué trata el tema o tendencia "${trend}"? Responde de forma breve y concisa.`
            }
          ]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          return data.choices[0].message.content;
        }
      }
    }
    
    // Alternativa: Usar OpenRouter API como fallback
    if (OPENROUTER_API_KEY) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://pulse.domain.com'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente que proporciona información concisa sobre temas tendencia.'
            },
            {
              role: 'user',
              content: `Explica brevemente en 1-2 oraciones de qué trata la tendencia o tema "${trend}".`
            }
          ]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          return data.choices[0].message.content;
        }
      }
    }
    
    // Si todo falla, proporcionar un mensaje genérico
    return `Tendencia relacionada con ${trend}`;
  } catch (error) {
    console.error(`Error al buscar información sobre ${trend}:`, error);
    return `Tendencia popular: ${trend}`;
  }
} 