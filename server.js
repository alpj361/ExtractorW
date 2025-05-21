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
    // Asumimos que rawData tiene una estructura con 'trends'
    if (!rawData || !rawData.trends || !Array.isArray(rawData.trends)) {
      throw new Error('Formato de datos inválido');
    }

    // Ordenar tendencias por volumen o alguna métrica relevante
    const sortedTrends = [...rawData.trends].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    const top10 = sortedTrends.slice(0, 10);
    
    // Si hay menos de 10, repetir los más importantes
    while (top10.length < 10) {
      top10.push(top10[top10.length % top10.length]);
    }
    
    // Calcular valores mínimos y máximos para escalar
    const volumes = top10.map(t => t.volume || 1);
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
      value: mapRange(trend.volume || trend.count || 1, minVol, maxVol, 20, 100),
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