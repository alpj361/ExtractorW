#!/usr/bin/env node

// Test script para verificar el fix de parsing de menciones
// Simula diferentes formatos de datos que llegan desde ExtractorT

console.log('🧪 TESTING MENCIONES FIX\n');

// Simular las funciones que agregué al archivo trends.js
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

function parseTrendString(trendString) {
  console.log(`🔍 Parsing: "${trendString}"`);
  
  // Regex mejorado para capturar correctamente "1. Quijivix16K"
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
    const volume = 1000 - (position * 10);
    
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

function sanitizeName(rawName = '') {
  return rawName.replace(/(\d+)[kK]$/, '').trim();
}

// CASOS DE PRUEBA
console.log('📊 CASO 1: Formato Twitter API (del JSON real de ExtractorT)');
const twitterApiData = [
  {
    "name": "Trending in Guatemala",
    "tweet_count": null,
    "keywords": ["Pineda", "3,055 posts"]
  },
  {
    "name": "Trending in Guatemala", 
    "tweet_count": null,
    "keywords": ["RM IS COMING", "48.8K posts"]
  },
  {
    "name": "Trending in Guatemala",
    "tweet_count": null,
    "keywords": ["Ministra", "27.1K posts"]
  }
];

console.log('\nResultados:');
twitterApiData.forEach((item, index) => {
  const result = extractMentionsFromTrend(item);
  console.log(`${index + 1}. ${result.name}: ${result.volume} menciones`);
});

console.log('\n📊 CASO 2: Formato Trends24 (strings con formato "1. Tendencia 16K")');
const trends24Data = [
  "1. Quijivix16K",
  "2. Pacífico27K", 
  "3. Guatemala3K"
];

console.log('\nResultados:');
trends24Data.forEach((item, index) => {
  const result = extractMentionsFromTrend(item);
  console.log(`${index + 1}. ${result.name}: ${result.volume} menciones`);
});

console.log('\n📊 CASO 3: Formato mixto');
const mixedData = [
  "1. TendenciaEjemplo",
  {
    "name": "Política Guatemala",
    "keywords": ["12.5K posts", "trending"]
  },
  {
    "name": "Deportes", 
    "volume": 5000
  }
];

console.log('\nResultados:');
mixedData.forEach((item, index) => {
  const result = extractMentionsFromTrend(item);
  console.log(`${index + 1}. ${result.name}: ${result.volume} menciones`);
});

console.log('\n📊 CASO 4: Formato con comas en números');
const commaData = [
  {
    "name": "Evento Importante",
    "keywords": ["1,234 posts", "trending"]
  },
  {
    "name": "Noticia Viral",
    "keywords": ["123,456 posts"]
  }
];

console.log('\nResultados:');
commaData.forEach((item, index) => {
  const result = extractMentionsFromTrend(item);
  console.log(`${index + 1}. ${result.name}: ${result.volume} menciones`);
});

console.log('\n✅ PRUEBAS COMPLETADAS - El fix debería manejar todos estos casos correctamente'); 