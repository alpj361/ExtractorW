const fetch = require('node-fetch'); // Para requests HTTP
const cheerio = require('cheerio'); // Para parsing HTML - instalar: npm install cheerio
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// --- FUNCIONES DE WEB SCRAPING ---

/**
 * Busca información sobre una tendencia en Google News
 * @param {string} query - Término de búsqueda
 * @param {string} location - Ubicación para búsqueda localizada
 * @returns {Array} - Array de artículos encontrados
 */
async function scrapeGoogleNews(query, location = 'Guatemala') {
  try {
    console.log(`🔍 Scrapeando Google News para: "${query}"`);
    
    // Construir URL de búsqueda de Google News
    const searchQuery = encodeURIComponent(`${query} ${location}`);
    const url = `https://news.google.com/rss/search?q=${searchQuery}&hl=es&gl=GT&ceid=GT:es-419`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️  Error en Google News: ${response.status}`);
      return [];
    }
    
    const xmlText = await response.text();
    const $ = cheerio.load(xmlText, { xmlMode: true });
    
    const articles = [];
    $('item').each((i, element) => {
      if (i < 5) { // Limitar a 5 artículos
        const title = $(element).find('title').text();
        const description = $(element).find('description').text();
        const pubDate = $(element).find('pubDate').text();
        const link = $(element).find('link').text();
        
        articles.push({
          title: title.trim(),
          description: description.trim(),
          date: pubDate,
          source: 'Google News',
          url: link
        });
      }
    });
    
    console.log(`✅ Encontrados ${articles.length} artículos en Google News`);
    return articles;
    
  } catch (error) {
    console.error(`❌ Error scrapeando Google News para "${query}":`, error.message);
    return [];
  }
}

/**
 * Busca información en sitios web específicos de Guatemala
 * @param {string} query - Término de búsqueda
 * @returns {Array} - Array de información encontrada
 */
async function scrapeGuatemalaNews(query) {
  try {
    console.log(`🏛️  Scrapeando fuentes guatemaltecas para: "${query}"`);
    
    const sources = [
      'https://www.prensalibre.com',
      'https://www.soy502.com',
      'https://www.republica.gt'
    ];
    
    const results = [];
    
    // Buscar en cada fuente (simulado por simplicidad)
    for (const source of sources) {
      try {
        // En un caso real, harías scraping específico de cada sitio
        // Por ahora, simularemos la búsqueda
        console.log(`  📰 Buscando en ${new URL(source).hostname}...`);
        
        // Simulación de búsqueda - en implementación real usarías el motor de búsqueda del sitio
        const searchUrl = `${source}/search?q=${encodeURIComponent(query)}`;
        
        // Para evitar hacer requests reales en este ejemplo, simularemos datos
        results.push({
          title: `Información sobre ${query} desde ${new URL(source).hostname}`,
          content: `Contenido relacionado con ${query} encontrado en fuentes guatemaltecas`,
          source: new URL(source).hostname,
          url: searchUrl
        });
        
      } catch (sourceError) {
        console.log(`  ⚠️  No se pudo acceder a ${source}`);
      }
    }
    
    console.log(`✅ Scraping de fuentes guatemaltecas completado: ${results.length} resultados`);
    return results;
    
  } catch (error) {
    console.error(`❌ Error en scraping de Guatemala para "${query}":`, error.message);
    return [];
  }
}

/**
 * Busca información en Wikipedia
 * @param {string} query - Término de búsqueda
 * @returns {Object} - Información de Wikipedia
 */
async function scrapeWikipedia(query) {
  try {
    console.log(`📚 Buscando en Wikipedia: "${query}"`);
    
    // API de Wikipedia en español
    const searchUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'ExtractorW/1.0 (https://yoursite.com/contact)'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Información encontrada en Wikipedia`);
      
      return {
        title: data.title,
        summary: data.extract,
        url: data.content_urls?.desktop?.page,
        source: 'Wikipedia'
      };
    } else {
      console.log(`⚠️  No se encontró información en Wikipedia`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error buscando en Wikipedia para "${query}":`, error.message);
    return null;
  }
}

/**
 * Recopila información completa sobre una tendencia usando multiple scraping
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} location - Ubicación para contexto
 * @returns {Object} - Información recopilada de múltiples fuentes
 */
async function scrapeComprehensiveInfo(trendName, location = 'Guatemala') {
  console.log(`🕷️  Iniciando scraping completo para: "${trendName}"`);
  
  const scrapedData = {
    trend: trendName,
    location: location,
    timestamp: new Date().toISOString(),
    sources: {
      googleNews: [],
      guatemalaNews: [],
      wikipedia: null
    },
    summary: {
      totalArticles: 0,
      sourcesUsed: []
    }
  };
  
  try {
    // 1. Scraping de Google News
    const googleNews = await scrapeGoogleNews(trendName, location);
    scrapedData.sources.googleNews = googleNews;
    scrapedData.summary.totalArticles += googleNews.length;
    if (googleNews.length > 0) scrapedData.summary.sourcesUsed.push('Google News');
    
    // 2. Scraping de fuentes guatemaltecas
    const guatemalaNews = await scrapeGuatemalaNews(trendName);
    scrapedData.sources.guatemalaNews = guatemalaNews;
    scrapedData.summary.totalArticles += guatemalaNews.length;
    if (guatemalaNews.length > 0) scrapedData.summary.sourcesUsed.push('Fuentes GT');
    
    // 3. Scraping de Wikipedia
    const wikipedia = await scrapeWikipedia(trendName);
    scrapedData.sources.wikipedia = wikipedia;
    if (wikipedia) scrapedData.summary.sourcesUsed.push('Wikipedia');
    
    console.log(`✅ Scraping completado: ${scrapedData.summary.totalArticles} artículos de ${scrapedData.summary.sourcesUsed.length} fuentes`);
    
    return scrapedData;
    
  } catch (error) {
    console.error(`❌ Error en scraping completo para "${trendName}":`, error.message);
    return scrapedData;
  }
}

// --- FUNCIONES DE IA (GPT-4 TURBO) ---

/**
 * Categoriza una tendencia usando GPT-4 Turbo basándose en información scrapeada
 * @param {string} trendName - Nombre de la tendencia
 * @param {Object} scrapedData - Datos recopilados por scraping
 * @returns {string} - Categoría en español
 */
async function categorizeTrendWithScrapedData(trendName, scrapedData) {
  if (!OPENROUTER_API_KEY) {
    console.log('⚠️  OPENROUTER_API_KEY no configurada, usando categorización manual');
    return categorizeTrendManual(trendName);
  }
  
  try {
    console.log(`🤖 Categorizando con GPT-4 Turbo usando datos scrapeados: "${trendName}"`);
    
    // Construir contexto a partir de los datos scrapeados
    let context = `Información recopilada sobre "${trendName}":\n\n`;
    
    // Agregar artículos de Google News
    if (scrapedData.sources.googleNews.length > 0) {
      context += "NOTICIAS RECIENTES:\n";
      scrapedData.sources.googleNews.forEach(article => {
        context += `- ${article.title}: ${article.description}\n`;
      });
      context += "\n";
    }
    
    // Agregar información de Wikipedia
    if (scrapedData.sources.wikipedia) {
      context += "INFORMACIÓN GENERAL:\n";
      context += `${scrapedData.sources.wikipedia.summary}\n\n`;
    }
    
    // Agregar fuentes guatemaltecas
    if (scrapedData.sources.guatemalaNews.length > 0) {
      context += "FUENTES LOCALES:\n";
      scrapedData.sources.guatemalaNews.forEach(item => {
        context += `- ${item.title}: ${item.content}\n`;
      });
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://pulse.domain.com'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto analista de tendencias en redes sociales especializado en el contexto guatemalteco y latinoamericano. Analiza la información proporcionada y categoriza la tendencia de manera precisa. Responde SOLO con la categoría más adecuada en español. Categorías disponibles: Política, Deportes, Música, Entretenimiento, Economía, Tecnología, Salud, Educación, Cultura, Sociedad, Internacional, Ciencia, Medio ambiente, Moda, Farándula, Justicia, Seguridad, Religión, Otros.'
          },
          {
            role: 'user',
            content: `Basándote en la siguiente información recopilada, categoriza la tendencia "${trendName}":\n\n${context}\n\nResponde solo con el nombre de la categoría, sin explicación adicional.`
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
      console.error('❌ Error OpenRouter GPT-4 Turbo:', errorText);
    }
    
    return categorizeTrendManual(trendName);
  } catch (error) {
    console.error('❌ Error en categorizeTrendWithScrapedData:', error.message);
    return categorizeTrendManual(trendName);
  }
}

/**
 * Genera un resumen completo usando GPT-4 Turbo basándose en información scrapeada
 * @param {string} trendName - Nombre de la tendencia
 * @param {Object} scrapedData - Datos recopilados por scraping
 * @param {string} location - Ubicación para contexto
 * @returns {Object} - Resumen estructurado
 */
async function summarizeWithGPT4Turbo(trendName, scrapedData, location = 'Guatemala') {
  if (!OPENROUTER_API_KEY) {
    return {
      summary: `Tendencia relacionada con ${trendName}`,
      source: 'scraping + fallback',
      model: 'manual',
      sourcesUsed: scrapedData.summary.sourcesUsed.join(', ') || 'ninguna'
    };
  }
  
  try {
    console.log(`📝 Generando resumen con GPT-4 Turbo para: "${trendName}"`);
    
    // Construir contexto detallado
    let context = `ANÁLISIS DE TENDENCIA: "${trendName}" en ${location}\n\n`;
    context += `Fuentes consultadas: ${scrapedData.summary.sourcesUsed.join(', ')}\n`;
    context += `Total de artículos: ${scrapedData.summary.totalArticles}\n\n`;
    
    // Información de noticias
    if (scrapedData.sources.googleNews.length > 0) {
      context += "=== NOTICIAS RECIENTES ===\n";
      scrapedData.sources.googleNews.forEach((article, i) => {
        context += `${i+1}. Título: ${article.title}\n`;
        context += `   Descripción: ${article.description}\n`;
        context += `   Fecha: ${article.date}\n\n`;
      });
    }
    
    // Información general
    if (scrapedData.sources.wikipedia) {
      context += "=== INFORMACIÓN GENERAL ===\n";
      context += `${scrapedData.sources.wikipedia.summary}\n\n`;
    }
    
    // Fuentes locales
    if (scrapedData.sources.guatemalaNews.length > 0) {
      context += "=== CONTEXTO LOCAL ===\n";
      scrapedData.sources.guatemalaNews.forEach((item, i) => {
        context += `${i+1}. ${item.title}\n`;
        context += `   ${item.content}\n\n`;
      });
    }
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('es-ES', { month: 'long' });
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://pulse.domain.com'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `Eres un analista experto en tendencias de redes sociales en ${location}. Tu tarea es analizar información recopilada de múltiples fuentes web y crear un resumen contextual, informativo y actualizado. Responde en español con un párrafo coherente que explique qué está sucediendo con esta tendencia y por qué es relevante en el contexto actual.`
          },
          {
            role: 'user',
            content: `Analiza la siguiente información recopilada sobre "${trendName}" y crea un resumen contextual de máximo 200 palabras que explique:\n1. Qué es esta tendencia\n2. Por qué está siendo relevante en ${month} ${year}\n3. Su impacto o importancia en ${location}\n\nINFORMACIÓN RECOPILADA:\n${context}\n\nResponde con un párrafo cohesivo en español:`
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
        console.log(`✅ Resumen generado (${summary.length} caracteres)`);
        
        return {
          summary: summary,
          source: 'scraping + gpt-4-turbo',
          model: 'gpt-4-turbo',
          sourcesUsed: scrapedData.summary.sourcesUsed.join(', ') || 'ninguna',
          articlesAnalyzed: scrapedData.summary.totalArticles
        };
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Error OpenRouter GPT-4 Turbo:', errorText);
    }
    
    return {
      summary: `Basándose en ${scrapedData.summary.totalArticles} fuentes, ${trendName} es una tendencia relevante en ${location} durante ${month} ${year}.`,
      source: 'scraping + fallback',
      model: 'fallback',
      sourcesUsed: scrapedData.summary.sourcesUsed.join(', ') || 'ninguna'
    };
    
  } catch (error) {
    console.error('❌ Error en summarizeWithGPT4Turbo:', error.message);
    return {
      summary: `Tendencia popular: ${trendName}`,
      source: 'error',
      model: 'error',
      sourcesUsed: 'error'
    };
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
 * Procesa un array de tendencias usando Web Scraping + GPT-4 Turbo
 * @param {Array} trends - Array de tendencias
 * @param {string} location - Ubicación para contexto
 * @returns {Array} - Tendencias procesadas con información scrapeada y resumida
 */
async function processWithScrapingPlusGPT4(trends, location = 'Guatemala') {
  console.log(`\n🚀 INICIANDO PROCESAMIENTO: WEB SCRAPING + GPT-4 TURBO (${trends.length} tendencias)`);
  console.log('='.repeat(80));
  
  const processedTrends = [];
  
  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const trendName = trend.name || trend.keyword || trend.text || `Tendencia ${i+1}`;
    
    console.log(`\n📊 Procesando ${i+1}/${trends.length}: "${trendName}"`);
    console.log('─'.repeat(60));
    
    try {
      // 1. Scraping completo de información
      const scrapedData = await scrapeComprehensiveInfo(trendName, location);
      
      // 2. Categorizar usando datos scrapeados + GPT-4 Turbo
      const category = await categorizeTrendWithScrapedData(trendName, scrapedData);
      
      // 3. Generar resumen usando datos scrapeados + GPT-4 Turbo
      const aboutInfo = await summarizeWithGPT4Turbo(trendName, scrapedData, location);
      
      const processedTrend = {
        name: trendName,
        volume: trend.volume || trend.count || 1,
        category: category,
        about: aboutInfo,
        scrapingData: {
          totalSources: scrapedData.summary.sourcesUsed.length,
          sourcesUsed: scrapedData.summary.sourcesUsed,
          totalArticles: scrapedData.summary.totalArticles,
          timestamp: scrapedData.timestamp
        },
        original: trend
      };
      
      processedTrends.push(processedTrend);
      
      console.log(`   ✅ Categoría: ${category}`);
      console.log(`   🔍 Fuentes: ${scrapedData.summary.sourcesUsed.join(', ') || 'ninguna'}`);
      console.log(`   📰 Artículos: ${scrapedData.summary.totalArticles}`);
      console.log(`   📝 Resumen: ${aboutInfo.summary.substring(0, 100)}...`);
      
      // Pausa para ser respetuoso con los servidores
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
          model: 'error',
          sourcesUsed: 'error'
        },
        scrapingData: {
          totalSources: 0,
          sourcesUsed: [],
          totalArticles: 0,
          timestamp: new Date().toISOString()
        },
        original: trend
      });
    }
  }
  
  console.log('\n✅ PROCESAMIENTO WEB SCRAPING + GPT-4 TURBO COMPLETADO');
  console.log('='.repeat(80));
  
  return processedTrends;
}

// --- FUNCIÓN PRINCIPAL DE PRUEBA ---
async function testScrapingPlusGPT4() {
  console.log('🧪 INICIANDO PRUEBA: WEB SCRAPING + GPT-4 TURBO');
  console.log('='.repeat(60));
  
  // Verificar configuración
  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY no está configurada en .env');
    console.log('💡 Configura tu API key en el archivo .env');
    return;
  }
  
  console.log('✅ API Key configurada');
  
  // Tendencias reales proporcionadas por el usuario
  const testTrends = [
    { name: 'Napoli', volume: 1000 },
    { name: 'Lilo', volume: 900 },
    { name: 'Alejandro Giammattei', volume: 800 },
    { name: 'Lukita', volume: 700 },
    { name: 'santa maría de jesús', volume: 600 },
    { name: 'Aguirre', volume: 500 },
    { name: 'SerieA', volume: 400 },
    { name: 'Morat', volume: 300 },
    { name: 'McTominay', volume: 200 },
    { name: 'Margaret Satterthwaite', volume: 100 }
  ];
  
  console.log('\n📊 Tendencias reales de hoy:');
  testTrends.forEach((trend, i) => {
    console.log(`  ${i+1}. ${trend.name} (${trend.volume} menciones)`);
  });
  
  try {
    // Procesar con Web Scraping + GPT-4 Turbo
    const processed = await processWithScrapingPlusGPT4(testTrends, 'Guatemala');
    
    // Mostrar resultados
    console.log('\n📋 RESULTADOS:');
    console.log('='.repeat(60));
    
    processed.forEach((trend, i) => {
      console.log(`\n${i+1}. ${trend.name}`);
      console.log(`   📊 Volumen: ${trend.volume}`);
      console.log(`   🏷️  Categoría: ${trend.category}`);
      console.log(`   🔍 Fuentes: ${trend.scrapingData.sourcesUsed.join(', ') || 'ninguna'}`);
      console.log(`   📰 Artículos analizados: ${trend.scrapingData.totalArticles}`);
      console.log(`   📖 Método: ${trend.about.source} (${trend.about.model})`);
      console.log(`   💬 Resumen: ${trend.about.summary}`);
    });
    
    // Generar estadísticas
    const categories = {};
    const totalArticles = processed.reduce((sum, trend) => sum + trend.scrapingData.totalArticles, 0);
    const uniqueSources = new Set();
    
    processed.forEach(trend => {
      categories[trend.category] = (categories[trend.category] || 0) + 1;
      trend.scrapingData.sourcesUsed.forEach(source => uniqueSources.add(source));
    });
    
    console.log('\n📈 ESTADÍSTICAS:');
    console.log('='.repeat(40));
    console.log(`   📰 Total de artículos analizados: ${totalArticles}`);
    console.log(`   🔍 Fuentes únicas consultadas: ${Array.from(uniqueSources).join(', ')}`);
    
    console.log('\n🏷️  CATEGORÍAS:');
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
  testScrapingPlusGPT4().catch(console.error);
}

module.exports = {
  scrapeComprehensiveInfo,
  categorizeTrendWithScrapedData,
  summarizeWithGPT4Turbo,
  processWithScrapingPlusGPT4,
  testScrapingPlusGPT4
}; 