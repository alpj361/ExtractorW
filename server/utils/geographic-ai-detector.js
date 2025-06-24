// ===================================================================
// DETECTOR GEOGRÁFICO CON IA
// Usa Gemini AI para detectar departamentos y países automáticamente
// Con fallback al mapeo manual para mayor confiabilidad
// ===================================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { normalizeGeographicInfo: manualNormalize } = require('./guatemala-geography');

// Instanciar Gemini
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cache para evitar consultas repetidas
const geoCache = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Detecta información geográfica usando Gemini AI
 * @param {string} cityName - Nombre de la ciudad
 * @param {string} countryHint - Sugerencia del país (opcional)
 * @returns {Promise<Object>} - {city, department, country, confidence, source}
 */
async function detectGeographyWithAI(cityName, countryHint = 'Guatemala') {
  if (!cityName || !process.env.GEMINI_API_KEY) {
    return null;
  }

  const cacheKey = `${cityName.toLowerCase()}_${countryHint.toLowerCase()}`;
  
  // Verificar cache
  if (geoCache.has(cacheKey)) {
    const cached = geoCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
      console.log(`🔄 Usando caché para ${cityName}`);
      return cached.data;
    }
  }

  try {
    const prompt = `Eres un experto en geografía de Guatemala. Analiza el siguiente nombre de ciudad y proporciona información geográfica precisa.

CIUDAD A ANALIZAR: "${cityName}"
PAÍS SUGERIDO: ${countryHint}

INSTRUCCIONES:
1. Identifica el departamento exacto al que pertenece esta ciudad en Guatemala
2. Si no es una ciudad guatemalteca, indica el país correcto
3. Usa nombres oficiales exactos de departamentos guatemaltecos
4. Si no estás seguro, indica la confianza como "low"

DEPARTAMENTOS VÁLIDOS DE GUATEMALA:
Alta Verapaz, Baja Verapaz, Chimaltenango, Chiquimula, El Progreso, Escuintla, Guatemala, Huehuetenango, Izabal, Jalapa, Jutiapa, Petén, Quetzaltenango, Quiché, Retalhuleu, Sacatepéquez, San Marcos, Santa Rosa, Sololá, Suchitepéquez, Totonicapán, Zacapa

FORMATO DE RESPUESTA (SOLO JSON):
{
  "city": "Nombre normalizado de la ciudad",
  "department": "Departamento exacto o null",
  "country": "País (Guatemala u otro)",
  "confidence": "high|medium|low",
  "reasoning": "Breve explicación de por qué pertenece a ese departamento"
}

Responde ÚNICAMENTE el JSON, sin markdown ni explicaciones adicionales.`;

    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Limpiar respuesta
    responseText = responseText.replace(/```json|```/g, '').trim();

    const aiResult = JSON.parse(responseText);
    
    // Validar respuesta
    if (!aiResult.city && !aiResult.department && !aiResult.country) {
      throw new Error('Respuesta de IA inválida');
    }

    // Normalizar nombres
    const normalizedResult = {
      city: aiResult.city?.trim() || cityName,
      department: aiResult.department?.trim() || null,
      country: aiResult.country?.trim() || null,
      confidence: aiResult.confidence || 'medium',
      reasoning: aiResult.reasoning || 'Detectado por IA',
      source: 'gemini_ai',
      timestamp: Date.now()
    };

    // Guardar en cache
    geoCache.set(cacheKey, {
      data: normalizedResult,
      timestamp: Date.now()
    });

    console.log(`🤖 Gemini detectó: ${cityName} → ${normalizedResult.department || 'No detectado'} (${normalizedResult.confidence})`);
    
    return normalizedResult;

  } catch (error) {
    console.error(`❌ Error en detección con IA para ${cityName}:`, error.message);
    return null;
  }
}

/**
 * Normaliza información geográfica usando IA como fuente principal
 * Con fallback al sistema manual para mayor confiabilidad
 * @param {Object} geoInfo - {city, department, pais}
 * @returns {Promise<Object>} - Información normalizada y enriquecida
 */
async function normalizeGeographicInfoWithAI(geoInfo) {
  let { city, department, pais } = geoInfo;
  let detectionMethod = 'original';
  let confidence = 'high';
  let reasoning = 'Información original proporcionada';

  try {
    // Si tenemos ciudad pero no departamento, intentar detectar con IA
    if (city && !department) {
      console.log(`🔍 Detectando departamento para: ${city}`);
      
      const aiResult = await detectGeographyWithAI(city, pais || 'Guatemala');
      
      if (aiResult && aiResult.department && aiResult.confidence !== 'low') {
        department = aiResult.department;
        pais = aiResult.country || pais;
        detectionMethod = 'gemini_ai';
        confidence = aiResult.confidence;
        reasoning = aiResult.reasoning;
        
        console.log(`✅ IA detectó: ${city} → ${department} (${confidence})`);
      } else {
        // Fallback al sistema manual
        console.log(`🔄 Fallback a detección manual para: ${city}`);
        const manualResult = manualNormalize(geoInfo);
        
        if (manualResult.department && !geoInfo.department) {
          department = manualResult.department;
          pais = manualResult.pais || pais;
          detectionMethod = 'manual_fallback';
          confidence = 'medium';
          reasoning = 'Detectado por mapeo manual como fallback';
          
          console.log(`📋 Manual detectó: ${city} → ${department}`);
        }
      }
    }

    // Si no hay país especificado pero hay departamento guatemalteco, asumir Guatemala
    if (department && !pais) {
      const guatemalanDepartments = [
        'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 
        'Escuintla', 'Guatemala', 'Huehuetenango', 'Izabal', 'Jalapa', 'Jutiapa', 
        'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez', 'San Marcos', 
        'Santa Rosa', 'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa'
      ];
      
      if (guatemalanDepartments.includes(department)) {
        pais = 'Guatemala';
      }
    }

  } catch (error) {
    console.error(`❌ Error en normalización con IA:`, error.message);
    
    // En caso de error, usar sistema manual como respaldo completo
    const manualResult = manualNormalize(geoInfo);
    return {
      ...manualResult,
      detection_method: 'manual_error_fallback',
      confidence: 'medium',
      reasoning: 'Usado sistema manual debido a error en IA'
    };
  }

  return {
    city: city?.trim() || null,
    department: department?.trim() || null,
    pais: pais?.trim() || null,
    detection_method: detectionMethod,
    confidence,
    reasoning
  };
}

/**
 * Detecta información geográfica en lote para múltiples ubicaciones
 * Optimizado para procesar varios elementos de una vez
 * @param {Array} locations - Array de {city, department, pais}
 * @returns {Promise<Array>} - Array de resultados normalizados
 */
async function batchNormalizeGeography(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return [];
  }

  console.log(`🔄 Procesando ${locations.length} ubicaciones en lote...`);
  
  const results = [];
  const BATCH_SIZE = 5; // Procesar de 5 en 5 para no sobrecargar la API
  
  for (let i = 0; i < locations.length; i += BATCH_SIZE) {
    const batch = locations.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (location, index) => {
      try {
        const result = await normalizeGeographicInfoWithAI(location);
        return { ...result, original_index: i + index };
      } catch (error) {
        console.error(`Error procesando ubicación ${i + index}:`, error.message);
        return { 
          ...location, 
          detection_method: 'error',
          confidence: 'low',
          reasoning: 'Error en procesamiento',
          original_index: i + index 
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Pequeña pausa entre lotes para no sobrecargar la API
    if (i + BATCH_SIZE < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ Procesamiento en lote completado: ${results.length} ubicaciones`);
  return results.sort((a, b) => a.original_index - b.original_index);
}

/**
 * Limpia el cache de detecciones geográficas
 */
function clearGeographyCache() {
  geoCache.clear();
  console.log('🧹 Cache de geografía limpiado');
}

/**
 * Obtiene estadísticas del cache
 */
function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  
  for (const [key, entry] of geoCache.entries()) {
    if (now - entry.timestamp < CACHE_EXPIRY) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    total_entries: geoCache.size,
    valid_entries: validEntries,
    expired_entries: expiredEntries,
    cache_expiry_hours: CACHE_EXPIRY / (60 * 60 * 1000)
  };
}

module.exports = {
  detectGeographyWithAI,
  normalizeGeographicInfoWithAI,
  batchNormalizeGeography,
  clearGeographyCache,
  getCacheStats
}; 