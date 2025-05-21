const express = require('express');
const cors = require('cors');
// Usa fetch nativo si tienes Node 18+, si no, descomenta la siguiente línea:
// const fetch = require('node-fetch');

const app = express();
app.use(cors({
  origin: '*', // O pon tu frontend, ej: 'http://localhost:3000'
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VPS_API_URL = process.env.VPS_API_URL;
const USE_AI = process.env.USE_AI === 'true'; // Nueva variable de entorno

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
function processLocalTrends(rawData) {
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
        return {
          name: item.name || item.keyword || item.text || item.value || 'Desconocido',
          volume: item.volume || item.count || item.value || 1,
          category: item.category || 'General'
        };
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
    const topKeywords = top10.map(trend => ({
      keyword: trend.name || trend.keyword || 'Unknown',
      count: trend.volume || trend.count || 1
    }));
    
    // Crear estructura para wordCloudData
    const wordCloudData = top10.map(trend => ({
      text: trend.name || trend.keyword || 'Unknown',
      value: mapRange(
        trend.volume || trend.count || 1, 
        minVol === maxVol ? 0 : minVol, 
        maxVol, 
        20, 
        100
      ),
      color: getRandomColor()
    }));
    
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
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.post('/api/processTrends', async (req, res) => {
  try {
    let rawTrendsData = req.body.rawData;

    if (!rawTrendsData && VPS_API_URL) {
      const response = await fetch(VPS_API_URL);
      rawTrendsData = await response.json();
    }

    // Asegura que el campo timestamp tenga la fecha actual
    if (rawTrendsData && typeof rawTrendsData === 'object') {
      rawTrendsData.timestamp = new Date().toISOString();
    }

    let processedData;
    
    // Usar procesamiento local o con IA según la configuración
    if (!USE_AI) {
      console.log('Usando procesamiento local (sin IA)');
      processedData = processLocalTrends(rawTrendsData);
    } else {
      console.log('Usando procesamiento con IA (OpenRouter)');
      const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://extractorw.onrender.com/', // Cambia por tu dominio real
          'X-Title': 'PulseJ Dashboard'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: `You are an AI that processes trending data and converts it into structured JSON for a visualization dashboard. 
              You need to return JSON containing:
              1. wordCloudData: Array of objects with { text: string, value: number, color: string }
              2. topKeywords: Array of EXACTLY 10 objects with { keyword: string, count: number }
              3. categoryData: Array of objects with { category: string, count: number }
              4. timestamp: Current ISO timestamp
              
              The value for wordCloudData should be scaled appropriately for visualization (typically 20-100).
              Colors should be attractive hexadecimal values.
              Categories should be extracted or inferred from the trends.
              
              IMPORTANT: You MUST include exactly 10 topKeywords, no more, no less.
              If the input has fewer than 10, repeat the most important ones. 
              If it has more than 10, select the most important 10.
              
              Return ONLY the JSON object, no explanations or other text.`
            },
            {
              role: 'user',
              content: `Process these trending topics into the required JSON format: 
              ${JSON.stringify(rawTrendsData)}`
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      });

      if (!openrouterResponse.ok) {
        const errorText = await openrouterResponse.text();
        return res.status(500).json({ error: 'OpenRouter API error', message: errorText });
      }

      try {
        const aiResponse = await openrouterResponse.json();
        const content = aiResponse.choices[0].message.content;
        processedData = JSON.parse(content);
      } catch (err) {
        // Si hay error con la IA, usar procesamiento local como fallback
        console.error('Error processing AI response, using local processing as fallback:', err.message);
        processedData = processLocalTrends(rawTrendsData);
      }
    }

    // Asegurar que hay timestamp
    if (!processedData.timestamp) {
      processedData.timestamp = new Date().toISOString();
    }
    
    // Si no hay exactamente 10 topKeywords, ajustar con procesamiento local
    if (!processedData.topKeywords || processedData.topKeywords.length !== 10) {
      console.log(`Ajustando topKeywords: recibidos ${processedData.topKeywords?.length || 0}, necesarios 10`);
      const localProcessed = processLocalTrends(rawTrendsData);
      processedData.topKeywords = localProcessed.topKeywords;
    }

    // Guarda en Supabase
    try {
      const { error } = await supabase
        .from('trends')
        .insert([
          {
            timestamp: processedData.timestamp,
            word_cloud_data: processedData.wordCloudData,
            top_keywords: processedData.topKeywords,
            category_data: processedData.categoryData,
            raw_data: rawTrendsData
          }
        ]);
      if (error) {
        console.error('Error al guardar en Supabase:', error);
      }
    } catch (err) {
      console.error('Error inesperado al guardar en Supabase:', err);
    }

    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Error processing trends', message: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Exportamos la función para que pueda ser utilizada por otros scripts
module.exports = { processLocalTrends }; 