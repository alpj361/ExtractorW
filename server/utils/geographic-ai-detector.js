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
 * Parsea una string de ubicación que puede venir en diferentes formatos
 * Ejemplo: "Antigua, Sacatepéquez" → {city: "Antigua Guatemala", department: "Sacatepéquez"}
 * Ejemplo: "Zacapa, Quiché, Alta Verapaz" → devuelve múltiples ubicaciones separadas
 * Ejemplo: "El Estor, Livingston, Izabal" → devuelve múltiples municipios del mismo departamento
 * @param {Object} geoInfo - {city, department, pais} información original
 * @returns {Object|Array} - Información parseada. Si detecta múltiples ubicaciones, devuelve array
 */
function parseLocationString(geoInfo) {
  let { city, department, pais } = geoInfo;
  
  const guatemalanDepartments = [
    'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 
    'Escuintla', 'Guatemala', 'Huehuetenango', 'Izabal', 'Jalapa', 'Jutiapa', 
    'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez', 'San Marcos', 
    'Santa Rosa', 'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa'
  ];
  
  // Algunos municipios conocidos de Guatemala para mejor detección
  const knownMunicipalities = [
    'Livingston', 'El Estor', 'Puerto Barrios', 'Morales', 'Los Amates',
    'San Agustín Acasaguastlán', 'San Cristóbal Acasaguastlán', 'El Jícaro', 'Morazán',
    'San Miguel Uspantán', 'Cunén', 'Sacapulas', 'San Andrés Sajcabajá',
    'Cubulco', 'Salamá', 'San Jerónimo', 'Purulhá', 'Santa Cruz El Chol',
    'Santa Anita', 'Antigua Guatemala', 'Ciudad Vieja', 'Jocotenango', 'Pastores',
    'San Antonio Aguas Calientes', 'San Bartolomé Milpas Altas', 'San Lucas Sacatepéquez',
    'San Miguel Dueñas', 'Santa Catarina Barahona', 'Santa Lucía Milpas Altas',
    'Santa María de Jesús', 'Santiago Sacatepéquez', 'Santo Domingo Xenacoj', 'Sumpango'
  ];
  
     // Si la ciudad contiene comas, analizar el contenido
   if (city && city.includes(',')) {
     const parts = city.split(',').map(part => part.trim()).filter(part => part.length > 0);
     
     // Verificar cuántas partes son departamentos guatemaltecos
     const departmentMatches = parts.filter(part => 
       guatemalanDepartments.some(dept => 
         dept.toLowerCase() === part.toLowerCase()
       )
     );
     
     // Verificar cuántas partes son municipios conocidos
     const municipalityMatches = parts.filter(part => 
       knownMunicipalities.some(muni => 
         muni.toLowerCase() === part.toLowerCase() ||
         part.toLowerCase().includes(muni.toLowerCase()) ||
         muni.toLowerCase().includes(part.toLowerCase())
       )
     );
     
     // CASO ESPECIAL: Múltiples departamentos (como "Zacapa, Quiché, Alta Verapaz")
     if (departmentMatches.length > 1) {
       console.log(`🔍 Detectados múltiples departamentos: "${geoInfo.city}" → ${departmentMatches.join(', ')}`);
       
       // Devolver array de ubicaciones separadas, una por cada departamento
       return departmentMatches.map(dept => ({
         city: null,
         department: dept,
         pais: pais || 'Guatemala',
         _isMultiDepartment: true,
         _originalString: geoInfo.city
       }));
     }
     
     // CASO ESPECIAL: Múltiples municipios + departamento (como "El Estor, Livingston, Izabal")
     else if (municipalityMatches.length > 1 && departmentMatches.length === 1) {
       console.log(`🔍 Detectados múltiples municipios: "${geoInfo.city}" → ${municipalityMatches.join(', ')} en ${departmentMatches[0]}`);
       
       // Devolver array de ubicaciones, una por cada municipio
       return municipalityMatches.map(municipality => ({
         city: municipality,
         department: departmentMatches[0],
         pais: pais || 'Guatemala',
         _isMultiMunicipality: true,
         _originalString: geoInfo.city
       }));
     }
     
     // CASO ESPECIAL: Múltiples municipios sin departamento explícito
     else if (municipalityMatches.length > 1 && departmentMatches.length === 0) {
       console.log(`🔍 Detectados múltiples municipios sin departamento: "${geoInfo.city}" → ${municipalityMatches.join(', ')}`);
       
       // Devolver array de ubicaciones, cada municipio se procesará individualmente para detectar departamento
       return municipalityMatches.map(municipality => ({
         city: municipality,
         department: department, // Mantener departamento original si existe
         pais: pais || 'Guatemala',
         _isMultiMunicipality: true,
         _needsDepartmentDetection: true,
         _originalString: geoInfo.city
       }));
     }
    
    // CASO: Exactamente 2 partes - probablemente "ciudad, departamento"
    else if (parts.length === 2 && departmentMatches.length === 1) {
      const [possibleCity, possibleDepartment] = parts;
      const departmentMatch = departmentMatches[0];
      
      // Determinar cuál es ciudad y cuál es departamento
      if (possibleDepartment === departmentMatch) {
        city = possibleCity;
        department = possibleDepartment;
      } else if (possibleCity === departmentMatch) {
        city = possibleDepartment;
        department = possibleCity;
      }
      
      console.log(`🔍 Parseado formato "ciudad, departamento": "${geoInfo.city}" → ciudad: "${city}", departamento: "${department}"`);
    }
    
    // CASO: Múltiples partes con un departamento conocido
    else if (parts.length > 2 && departmentMatches.length === 1) {
      const departmentMatch = departmentMatches[0];
      
      if (!department || department.length < departmentMatch.length) {
        // Tomar todo lo que no es el departamento como ciudad
        const cityParts = parts.filter(part => part !== departmentMatch);
        city = cityParts.join(', ');
        department = departmentMatch;
        
        console.log(`🔍 Parseado formato complejo: "${geoInfo.city}" → ciudad: "${city}", departamento: "${department}"`);
      }
    }
  }
  
  // Si el departamento contiene comas, verificar si son múltiples departamentos
  if (department && department.includes(',')) {
    const deptParts = department.split(',').map(part => part.trim()).filter(part => part.length > 0);
    const deptMatches = deptParts.filter(part => 
      guatemalanDepartments.some(dept => 
        dept.toLowerCase() === part.toLowerCase()
      )
    );
    
    if (deptMatches.length > 1) {
      console.log(`🔍 Detectados múltiples departamentos en campo departamento: "${geoInfo.department}" → ${deptMatches.join(', ')}`);
      
      // Devolver array de ubicaciones separadas
      return deptMatches.map(dept => ({
        city: city,
        department: dept,
        pais: pais || 'Guatemala',
        _isMultiDepartment: true,
        _originalString: geoInfo.department
      }));
    } else {
      // Solo limpiar el primer departamento
      department = deptParts[0];
      console.log(`🔍 Limpiado departamento: "${geoInfo.department}" → "${department}"`);
    }
  }
  
  // Si el país contiene comas, tomar solo la primera parte  
  if (pais && pais.includes(',')) {
    pais = pais.split(',')[0].trim();
    console.log(`🔍 Limpiado país: "${geoInfo.pais}" → "${pais}"`);
  }
  
  return {
    city: city?.trim() || null,
    department: department?.trim() || null,
    pais: pais?.trim() || null
  };
}

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
 * @returns {Promise<Object|Array>} - Información normalizada. Array si había múltiples departamentos
 */
async function normalizeGeographicInfoWithAI(geoInfo) {
  // PASO 1: Parsear ubicación para separar "ciudad, departamento" correctamente
  const parsedLocation = parseLocationString(geoInfo);
  
  // CASO ESPECIAL: Si parseLocationString devolvió múltiples ubicaciones
  if (Array.isArray(parsedLocation)) {
    console.log(`🔄 Procesando múltiples ubicaciones parseadas: ${parsedLocation.length}`);
    
    // Procesar cada ubicación por separado
    const processedLocations = [];
    for (const location of parsedLocation) {
      const processed = await normalizeGeographicInfoWithAI(location);
      processedLocations.push({
        ...processed,
        _isFromMultiParse: true,
        _originalIndex: geoInfo._originalIndex || 0
      });
    }
    return processedLocations;
  }
  
  let { city, department, pais } = parsedLocation;
  
  let detectionMethod = 'original';
  let confidence = 'high';
  let reasoning = 'Información original proporcionada';
  
  // Si hubo cambios en el parseo, marcar como parseado
  if (parsedLocation.city !== geoInfo.city || parsedLocation.department !== geoInfo.department) {
    detectionMethod = 'parsed';
    reasoning = 'Información parseada desde formato compuesto';
  }

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
        const result = await normalizeGeographicInfoWithAI({
          ...location,
          _originalIndex: i + index
        });
        
        // Si es un array (múltiples departamentos), devolver cada uno con su índice
        if (Array.isArray(result)) {
          return result.map((item, subIndex) => ({
            ...item,
            original_index: i + index,
            sub_index: subIndex
          }));
        }
        
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
    
    // Aplanar resultados que pueden contener arrays
    for (const result of batchResults) {
      if (Array.isArray(result)) {
        results.push(...result);
      } else {
        results.push(result);
      }
    }
    
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
  parseLocationString,
  detectGeographyWithAI,
  normalizeGeographicInfoWithAI,
  batchNormalizeGeography,
  clearGeographyCache,
  getCacheStats
}; 