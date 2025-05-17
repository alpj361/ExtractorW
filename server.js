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
            2. topKeywords: Array of objects with { keyword: string, count: number }
            3. categoryData: Array of objects with { category: string, count: number }
            4. timestamp: Current ISO timestamp
            
            The value for wordCloudData should be scaled appropriately for visualization (typically 20-100).
            Colors should be attractive hexadecimal values.
            Categories should be extracted or inferred from the trends.
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

    let processedData;
    try {
      const aiResponse = await openrouterResponse.json();
      const content = aiResponse.choices[0].message.content;
      processedData = JSON.parse(content);
    } catch (err) {
      return res.status(500).json({ error: 'Error parsing AI response', message: err.message });
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