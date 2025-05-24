const fetch = require('node-fetch'); // Asegurate de tener node-fetch instalado
require('dotenv').config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // Para categorización

// --- FUNCIONES AUXILIARES ---

/**
 * Categoriza una tendencia usando Perplexity con búsqueda web
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} location - Ubicación para contexto
 * @returns {string} - Categoría en español
 */
async function categorizeTrendWithPerplexity(trendName, location = 'Guatemala') {
  if (!PERPLEXITY_API_KEY) {
    console.log('⚠️  PERPLEXITY_API_KEY no configurada, usando categorización manual');
    return categorizeTrendManual(trendName);
  }
  
  try {
    console.log(`🔍 Categorizando con Perplexity: "${trendName}"`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `Eres un analista experto en tendencias de redes sociales en ${location}. Tu tarea es categorizar tendencias basándote en información web actual y específica. Responde SOLO con la categoría más adecuada en español. Categorías disponibles: Política, Deportes, Música, Entretenimiento, Economía, Tecnología, Salud, Educación, Cultura, Sociedad, Internacional, Ciencia, Medio ambiente, Moda, Farándula, Justicia, Seguridad, Religión, Otros.`
          },
          {
            role: 'user',
            content: `Busca información actual sobre "${trendName}" en el contexto de ${location} y categorízalo según su naturaleza principal. Responde solo con el nombre de la categoría, sin explicación adicional.`
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const category = data.choices[0].message.content.trim().replace(/^[\d\-\.\s]+/, '');
        console.log(`✅ Categoría obtenida: "${category}"`);
        return category;
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Error Perplexity:', errorText);
    }
    
    return categorizeTrendManual(trendName);
  } catch (error) {
    console.error('❌ Error en categorizeTrendWithPerplexity:', error.message);
    return categorizeTrendManual(trendName);
  }
}

/**
 * Categorización manual como fallback
 * @param {string} trendName - Nombre de la tendencia
 * @returns {string} - Categoría
 */
function categorizeTrendManual(trendName) {
  const nameLower = trendName.toLowerCase();
  
  const categoryMap = {
    'Política': ['política', 'gobierno', 'congreso', 'elección', 'presidente', 'alcalde', 'ministro', 'senador', 'diputado', 'partido'],
    'Deportes': ['fútbol', 'deporte', 'liga', 'baloncesto', 'tenis', 'nba', 'mlb', 'gol', 'partido', 'juego', 'copa'],
    'Música': ['música', 'canción', 'banda', 'concierto', 'álbum', 'artista', 'pop', 'rock', 'reggaeton'],
    'Entretenimiento': ['cine', 'película', 'actor', 'actriz', 'oscar', 'premio', 'serie', 'tv', 'netflix'],
    'Economía': ['dinero', 'economía', 'finanza', 'mercado', 'banco', 'dólar', 'peso', 'euro'],
    'Tecnología': ['tecnología', 'tech', 'app', 'software', 'hardware', 'internet', 'red', 'ai', 'ia', 'robot'],
    'Salud': ['salud', 'covid', 'hospital', 'médico', 'enfermedad', 'vacuna'],
    'Educación': ['educación', 'escuela', 'universidad', 'maestro', 'profesor', 'clase'],
    'Cultura': ['cultura', 'arte', 'libro', 'pintura', 'danza', 'teatro'],
    'Justicia': ['justicia', 'corte', 'juez', 'ley', 'tribunal', 'fiscal'],
    'Seguridad': ['seguridad', 'policía', 'crimen', 'violencia', 'pnc']
  };
  
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => nameLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'Otros';
}

/**
 * Obtiene información contextual detallada usando Perplexity con búsqueda web
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} location - Ubicación para contexto
 * @returns {Object} - Información estructurada
 */
async function getAboutFromPerplexity(trendName, location = 'Guatemala') {
  if (!PERPLEXITY_API_KEY) {
    return {
      summary: `Tendencia relacionada con ${trendName}`,
      source: 'default',
      model: 'default'
    };
  }
  
  try {
    console.log(`🌐 Obteniendo información con Perplexity: "${trendName}"`);
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('es-ES', { month: 'long' });
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `Eres un analista experto en tendencias de redes sociales en ${location}. Tu tarea es buscar información actual en la web y proporcionar contexto detallado sobre tendencias. Responde en español con información factual y actualizada.`
          },
          {
            role: 'user',
            content: `Busca información actual sobre "${trendName}" en ${location} durante ${month} ${year}. Proporciona un resumen contextual que explique qué es, por qué está siendo tendencia, y qué está sucediendo actualmente. Responde en un párrafo de máximo 200 palabras en español.`
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const summary = data.choices[0].message.content.trim();
        console.log(`✅ Información obtenida (${summary.length} caracteres)`);
        return {
          summary: summary,
          source: 'perplexity',
          model: 'sonar'
        };
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Error Perplexity:', errorText);
    }
    
    return {
      summary: `Tendencia relacionada con ${trendName} en el contexto de ${location}`,
      source: 'fallback',
      model: 'fallback'
    };
  } catch (error) {
    console.error('❌ Error en getAboutFromPerplexity:', error.message);
    return {
      summary: `Tendencia popular: ${trendName}`,
      source: 'error',
      model: 'error'
    };
  }
}

/**
 * Procesa múltiples tendencias en lote usando Perplexity
 * @param {Array} trends - Array de tendencias
 * @param {string} location - Ubicación para contexto
 * @returns {Array} - Array de información estructurada
 */
async function getAboutFromPerplexityBatch(trends, location = 'Guatemala') {
  if (!PERPLEXITY_API_KEY) {
    return trends.map(trend => ({
      nombre: trend.name || trend.keyword,
      resumen: `Tendencia relacionada con ${trend.name || trend.keyword}`,
      categoria: 'Otros',
      tipo: 'hashtag',
      source: 'default',
      model: 'default'
    }));
  }
  
  try {
    console.log(`🔍 Procesando ${trends.length} tendencias en lote con Perplexity`);
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('es-ES', { month: 'long' });
    
    // Construir queries de búsqueda
    const queries = trends.map(t => `${t.name || t.keyword} ${location} ${year}`);
    
    // Prompt optimizado para el análisis en lote
    const prompt = `Analiza las siguientes tendencias de redes sociales en el contexto de ${location} durante ${month} ${year}:

${trends.map((t, i) => `${i+1}. ${t.name || t.keyword}`).join('\n')}

Para cada tendencia:
1. Separa la palabra clave del número si tiene sufijos como "457K" (ej: "Spurs457K" → "Spurs")
2. Busca información actual y explica brevemente de qué trata en el contexto de ${location}
3. Clasifica en una categoría: Política, Deportes, Música, Entretenimiento, Economía, Tecnología, Salud, Educación, Cultura, Sociedad, Internacional, Justicia, Seguridad, Otros
4. Determina si es un hashtag, persona, evento, etc.

Responde en formato JSON:
[
  {
    "nombre": "Término limpio",
    "tipo": "hashtag/persona/evento",
    "resumen": "Explicación contextual en español...",
    "categoria": "Categoría correspondiente"
  }
]`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `Eres un analista experto en tendencias de redes sociales en ${location}, especializado en política, cultura y deportes durante ${year}.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        let aboutArr = [];
        try {
          const rawContent = data.choices[0].message.content;
          console.log(`📄 Respuesta recibida (${rawContent.length} caracteres)`);
          
          // Buscar el JSON en la respuesta
          const match = rawContent.match(/\[.*\]/s);
          if (match) {
            aboutArr = JSON.parse(match[0]);
            console.log(`✅ Parseado exitoso: ${aboutArr.length} elementos`);
          } else {
            // Intentar parsear directamente
            aboutArr = JSON.parse(rawContent);
          }
        } catch (e) {
          console.log('⚠️  Error parseando JSON, usando fallback');
          aboutArr = trends.map(t => ({
            nombre: t.name || t.keyword,
            resumen: `Tendencia relacionada con ${t.name || t.keyword}`,
            categoria: 'Otros',
            tipo: 'hashtag'
          }));
        }
        
        // Asegurar que tenemos el mismo número de elementos
        while (aboutArr.length < trends.length) {
          const index = aboutArr.length;
          aboutArr.push({
            nombre: trends[index].name || trends[index].keyword,
            resumen: `Tendencia relacionada con ${trends[index].name || trends[index].keyword}`,
            categoria: 'Otros',
            tipo: 'hashtag'
          });
        }
        
        // Enriquecer con metadatos
        aboutArr = aboutArr.map(obj => ({
          ...obj,
          source: 'perplexity',
          model: 'sonar'
        }));
        
        return aboutArr;
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Error Perplexity:', errorText);
    }
    
    // Fallback si falla la API
    return trends.map(trend => ({
      nombre: trend.name || trend.keyword,
      resumen: `Tendencia relacionada con ${trend.name || trend.keyword}`,
      categoria: 'Otros',
      tipo: 'hashtag',
      source: 'fallback',
      model: 'fallback'
    }));
    
  } catch (error) {
    console.error('❌ Error en getAboutFromPerplexityBatch:', error.message);
    return trends.map(trend => ({
      nombre: trend.name || trend.keyword,
      resumen: `Tendencia popular: ${trend.name || trend.keyword}`,
      categoria: 'Otros',
      tipo: 'hashtag',
      source: 'error',
      model: 'error'
    }));
  }
}

/**
 * Procesa un array de tendencias usando Perplexity (individual)
 * @param {Array} trends - Array de tendencias
 * @param {string} location - Ubicación para contexto
 * @returns {Array} - Tendencias procesadas con categorías e información
 */
async function processWithPerplexityIndividual(trends, location = 'Guatemala') {
  console.log(`\n🚀 INICIANDO PROCESAMIENTO INDIVIDUAL CON PERPLEXITY (${trends.length} tendencias)`);
  console.log('='.repeat(60));
  
  const processedTrends = [];
  
  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const trendName = trend.name || trend.keyword || trend.text || `Tendencia ${i+1}`;
    
    console.log(`\n📊 Procesando ${i+1}/${trends.length}: "${trendName}"`);
    
    try {
      // Categorizar con Perplexity
      const category = await categorizeTrendWithPerplexity(trendName, location);
      
      // Obtener información contextual
      const aboutInfo = await getAboutFromPerplexity(trendName, location);
      
      const processedTrend = {
        name: trendName,
        volume: trend.volume || trend.count || 1,
        category: category,
        about: aboutInfo,
        original: trend
      };
      
      processedTrends.push(processedTrend);
      
      console.log(`   ✅ Categoría: ${category}`);
      console.log(`   📝 Info: ${aboutInfo.summary.substring(0, 80)}...`);
      
      // Pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`   ❌ Error procesando "${trendName}":`, error.message);
      
      // Agregar con valores por defecto
      processedTrends.push({
        name: trendName,
        volume: trend.volume || trend.count || 1,
        category: 'Otros',
        about: {
          summary: `Tendencia relacionada con ${trendName}`,
          source: 'error',
          model: 'error'
        },
        original: trend
      });
    }
  }
  
  console.log('\n✅ PROCESAMIENTO INDIVIDUAL PERPLEXITY COMPLETADO');
  console.log('='.repeat(60));
  
  return processedTrends;
}

/**
 * Procesa un array de tendencias usando Perplexity (lote)
 * @param {Array} trends - Array de tendencias
 * @param {string} location - Ubicación para contexto
 * @returns {Array} - Tendencias procesadas con categorías e información
 */
async function processWithPerplexityBatch(trends, location = 'Guatemala') {
  console.log(`\n🚀 INICIANDO PROCESAMIENTO EN LOTE CON PERPLEXITY (${trends.length} tendencias)`);
  console.log('='.repeat(60));
  
  try {
    // Obtener información en lote
    const aboutArray = await getAboutFromPerplexityBatch(trends, location);
    
    // Combinar con datos originales
    const processedTrends = trends.map((trend, index) => {
      const aboutInfo = aboutArray[index] || {
        nombre: trend.name || trend.keyword,
        resumen: 'No disponible',
        categoria: 'Otros',
        tipo: 'hashtag',
        source: 'error',
        model: 'error'
      };
      
      return {
        name: trend.name || trend.keyword || trend.text || `Tendencia ${index+1}`,
        volume: trend.volume || trend.count || 1,
        category: aboutInfo.categoria || 'Otros',
        about: {
          summary: aboutInfo.resumen || 'No disponible',
          source: aboutInfo.source || 'error',
          model: aboutInfo.model || 'error'
        },
        tipo: aboutInfo.tipo || 'hashtag',
        original: trend
      };
    });
    
    console.log('\n✅ PROCESAMIENTO EN LOTE PERPLEXITY COMPLETADO');
    console.log('='.repeat(60));
    
    return processedTrends;
    
  } catch (error) {
    console.error('❌ Error en procesamiento en lote:', error);
    
    // Fallback a procesamiento individual si falla el lote
    console.log('🔄 Intentando procesamiento individual como fallback...');
    return await processWithPerplexityIndividual(trends, location);
  }
}

// --- FUNCIÓN PRINCIPAL DE PRUEBA ---
async function testPerplexity() {
  console.log('🧪 INICIANDO PRUEBA DE PERPLEXITY');
  console.log('='.repeat(50));
  
  // Verificar configuración
  if (!PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY no está configurada en .env');
    console.log('💡 Agrega PERPLEXITY_API_KEY=tu_clave_aqui en el archivo .env');
    return;
  }
  
  console.log('✅ API Key configurada');
  
  // Datos de prueba más específicos para Guatemala
  const testTrends = [
    { name: 'Guatemala', volume: 1000 },
    { name: 'Congreso', volume: 800 },
    { name: 'Futbol', volume: 600 },
    { name: 'Bernardo Arevalo', volume: 500 },
    { name: 'Tecnologia', volume: 400 }
  ];
  
  console.log('\n📊 Tendencias de prueba:');
  testTrends.forEach((trend, i) => {
    console.log(`  ${i+1}. ${trend.name} (${trend.volume} menciones)`);
  });
  
  try {
    console.log('\n🚀 Probando procesamiento EN LOTE...');
    const processedBatch = await processWithPerplexityBatch(testTrends, 'Guatemala');
    
    // Mostrar resultados del lote
    console.log('\n📋 RESULTADOS LOTE:');
    console.log('='.repeat(50));
    
    processedBatch.forEach((trend, i) => {
      console.log(`\n${i+1}. ${trend.name}`);
      console.log(`   📊 Volumen: ${trend.volume}`);
      console.log(`   🏷️  Categoría: ${trend.category}`);
      console.log(`   🔗 Tipo: ${trend.tipo || 'N/A'}`);
      console.log(`   📖 Fuente: ${trend.about.source} (${trend.about.model})`);
      console.log(`   💬 Resumen: ${trend.about.summary}`);
    });
    
    // Generar estadísticas
    const categories = {};
    processedBatch.forEach(trend => {
      categories[trend.category] = (categories[trend.category] || 0) + 1;
    });
    
    console.log('\n📈 ESTADÍSTICAS DE CATEGORÍAS:');
    Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} tendencias`);
      });
    
    console.log('\n✅ PRUEBA COMPLETADA EXITOSAMENTE');
    
  } catch (error) {
    console.error('\n❌ Error en la prueba:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testPerplexity().catch(console.error);
}

module.exports = {
  categorizeTrendWithPerplexity,
  getAboutFromPerplexity,
  getAboutFromPerplexityBatch,
  processWithPerplexityIndividual,
  processWithPerplexityBatch,
  testPerplexity
}; 