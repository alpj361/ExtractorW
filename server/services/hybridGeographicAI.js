// ===================================================================
// SERVICIO HÍBRIDO DE DETECCIÓN GEOGRÁFICA SIMPLIFICADO
// Usa documento de referencia + guatemala-geography.js + detección por patrones
// ===================================================================

const fs = require('fs');
const path = require('path');
const { 
    GUATEMALA_GEOGRAPHY, 
    getDepartmentForCity, 
    normalizeGeographicInfo 
} = require('../utils/guatemala-geography');

// ===================================================================
// 1. CONFIGURACIÓN Y UTILIDADES
// ===================================================================

/**
 * Patrones comunes de ubicaciones guatemaltecas
 */
const GUATEMALA_PATTERNS = {
    departmentPatterns: [
        /departamento\s+de\s+([a-záéíóúüñ\s]+)/gi,
        /depto\.?\s+([a-záéíóúüñ\s]+)/gi,
        /(quetzaltenango|guatemala|petén|sacatepéquez|izabal|alta\s+verapaz|huehuetenango|san\s+marcos)/gi
    ],
    cityPatterns: [
        /ciudad\s+de\s+([a-záéíóúüñ\s]+)/gi,
        /municipio\s+de\s+([a-záéíóúüñ\s]+)/gi,
        /(guatemala|xela|antigua|cobán|flores|puerto\s+barrios)/gi
    ],
    zonePatterns: [
        /zona\s+(\d+)/gi,
        /z(\d+)/gi,
        /(centro\s+histórico|zona\s+viva)/gi
    ],
    aliasPatterns: {
        'ciudad': ['guatemala', 'ciudad de guatemala', 'la ciudad', 'capital'],
        'xela': ['quetzaltenango', 'la ciudad de los altos'],
        'antigua': ['antigua guatemala', 'la colonial'],
        'el puerto': ['puerto barrios', 'barrios'],
        'la imperial': ['cobán', 'cobán imperial'],
        'zona viva': ['zona 10', 'z10'],
        'centro': ['zona 1', 'centro histórico', 'el centro'],
        'las verapaces': ['alta verapaz', 'baja verapaz'],
        'el norte': ['petén'],
        'la costa': ['escuintla', 'izabal']
    }
};

/**
 * Aliases culturales extendidos
 */
const CULTURAL_ALIASES = {
    'xela': { name: 'Quetzaltenango', type: 'city', department: 'Quetzaltenango' },
    'la ciudad': { name: 'Guatemala', type: 'city', department: 'Guatemala' },
    'la capital': { name: 'Guatemala', type: 'city', department: 'Guatemala' },
    'guate': { name: 'Guatemala', type: 'city', department: 'Guatemala' },
    'zona viva': { name: 'Zona 10', type: 'zone', city: 'Guatemala', department: 'Guatemala' },
    'el centro': { name: 'Zona 1', type: 'zone', city: 'Guatemala', department: 'Guatemala' },
    'centro histórico': { name: 'Zona 1', type: 'zone', city: 'Guatemala', department: 'Guatemala' },
    'antigua': { name: 'Antigua Guatemala', type: 'city', department: 'Sacatepéquez' },
    'el puerto': { name: 'Puerto Barrios', type: 'city', department: 'Izabal' },
    'la imperial': { name: 'Cobán', type: 'city', department: 'Alta Verapaz' },
    'las verapaces': { name: 'Alta Verapaz', type: 'department' },
    'el norte': { name: 'Petén', type: 'department' },
    'huehue': { name: 'Huehuetenango', type: 'city', department: 'Huehuetenango' }
};

/**
 * Normaliza texto para búsqueda
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^\w\s]/g, ' ') // Remover puntuación
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim();
}

/**
 * Calcula similitud entre dos strings usando Levenshtein
 */
function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const maxLen = Math.max(len1, len2);
    const distance = matrix[len1][len2];
    return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
}

// ===================================================================
// 2. DETECCIÓN DE UBICACIONES (GUATEMALA)
// ===================================================================

/**
 * Busca ubicaciones usando la geografia local y aliases
 */
function searchLocalLocations(query, options = {}) {
    const { limit = 20, countryCode = 'GTM' } = options;
    const results = [];
    
    console.log(`🔍 Búsqueda local: "${query}" (País: ${countryCode})`);
    
    const normalizedQuery = normalizeText(query);
    
    // 1. Buscar en aliases culturales exactos
    if (CULTURAL_ALIASES[normalizedQuery]) {
        const alias = CULTURAL_ALIASES[normalizedQuery];
        const locationResult = {
            name: alias.name,
            type: alias.type,
            department: alias.department,
            city: alias.city,
            confidence_score: 0.95,
            detection_method: 'cultural_alias',
            matched_alias: query,
            country_code: countryCode
        };
        
        // Agregar nombre_local basado en tipo y país
        locationResult.nombre_local = getNombreLocalByTypeAndCountry(alias.type, countryCode);
        
        results.push(locationResult);
    }
    
    // 2. Buscar en departamentos
    for (const [department, cities] of Object.entries(GUATEMALA_GEOGRAPHY)) {
        const deptSimilarity = calculateSimilarity(normalizedQuery, normalizeText(department));
        
        if (deptSimilarity > 0.7) {
            results.push({
                name: department,
                type: 'department',
                confidence_score: deptSimilarity,
                detection_method: 'department_match',
                matched_alias: department,
                country_code: countryCode,
                nombre_local: getNombreLocalByTypeAndCountry('department', countryCode)
            });
        }
        
        // 3. Buscar en ciudades del departamento
        for (const city of cities) {
            const citySimilarity = calculateSimilarity(normalizedQuery, normalizeText(city));
            
            if (citySimilarity > 0.7) {
                results.push({
                    name: city,
                    type: 'city',
                    department: department,
                    confidence_score: citySimilarity,
                    detection_method: 'city_match',
                    matched_alias: city,
                    country_code: countryCode,
                    nombre_local: getNombreLocalByTypeAndCountry('city', countryCode)
                });
            }
        }
    }
    
    // 4. Ordenar por confianza y limitar resultados
    return results
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, limit);
}

/**
 * Obtiene el nombre local según el tipo de ubicación y país
 */
function getNombreLocalByTypeAndCountry(type, countryCode = 'GTM') {
    const mappings = {
        'GTM': {
            'country': 'País',
            'department': 'Departamento',
            'city': 'Municipio',
            'zone': 'Zona'
        },
        'MEX': {
            'country': 'País',
            'department': 'Estado',
            'city': 'Municipio',
            'zone': 'Localidad'
        },
        'USA': {
            'country': 'Country',
            'department': 'State',
            'city': 'City',
            'zone': 'District'
        },
        'COL': {
            'country': 'País',
            'department': 'Departamento',
            'city': 'Municipio',
            'zone': 'Corregimiento'
        },
        'ARG': {
            'country': 'País',
            'department': 'Provincia',
            'city': 'Partido',
            'zone': 'Localidad'
        },
        'ESP': {
            'country': 'País',
            'department': 'Comunidad Autónoma',
            'city': 'Provincia',
            'zone': 'Municipio'
        }
    };
    
    const countryMapping = mappings[countryCode] || mappings['GTM'];
    return countryMapping[type] || 'Ubicación';
}

/**
 * Detecta ubicaciones usando patrones de texto
 */
function detectGuatemalaPatterns(text) {
    const results = [];
    const processedMatches = new Set();

    console.log('🔍 Detectando patrones guatemaltecos...');

    // Detectar departamentos con patrones
    GUATEMALA_PATTERNS.departmentPatterns.forEach(pattern => {
        let match;
        pattern.lastIndex = 0; // Reset regex
        
        while ((match = pattern.exec(text)) !== null) {
            const location = match[1] || match[0];
            const normalizedLocation = normalizeText(location);
            
            if (!processedMatches.has(normalizedLocation)) {
                processedMatches.add(normalizedLocation);
                
                // Buscar coincidencias en nuestra geografía
                const localMatches = searchLocalLocations(location, { limit: 3 });
                
                localMatches.forEach(localMatch => {
                    results.push({
                        ...localMatch,
                        detection_method: 'pattern_department',
                        original_text: match[0],
                        confidence_score: Math.min(localMatch.confidence_score + 0.1, 1.0)
                    });
                });
            }
        }
    });

    // Detectar ciudades con patrones
    GUATEMALA_PATTERNS.cityPatterns.forEach(pattern => {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(text)) !== null) {
            const location = match[1] || match[0];
            const normalizedLocation = normalizeText(location);
            
            if (!processedMatches.has(normalizedLocation)) {
                processedMatches.add(normalizedLocation);
                
                const localMatches = searchLocalLocations(location, { limit: 3 });
                
                localMatches.forEach(localMatch => {
                    results.push({
                        ...localMatch,
                        detection_method: 'pattern_city',
                        original_text: match[0],
                        confidence_score: Math.min(localMatch.confidence_score + 0.1, 1.0)
                    });
                });
            }
        }
    });

    // Detectar zonas
    GUATEMALA_PATTERNS.zonePatterns.forEach(pattern => {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(text)) !== null) {
            const location = match[0];
            const zoneNumber = match[1];
            
            if (zoneNumber) {
                results.push({
                    name: `Zona ${zoneNumber}`,
                    type: 'zone',
                    city: 'Guatemala',
                    department: 'Guatemala',
                    detection_method: 'pattern_zone',
                    original_text: match[0],
                    confidence_score: 0.9
                });
            } else {
                // Alias de zona (centro histórico, zona viva)
                const localMatches = searchLocalLocations(location, { limit: 1 });
                
                localMatches.forEach(localMatch => {
                    results.push({
                        ...localMatch,
                        detection_method: 'pattern_zone_alias',
                        original_text: match[0],
                        confidence_score: Math.min(localMatch.confidence_score + 0.1, 1.0)
                    });
                });
            }
        }
    });

    console.log(`✅ Patrones: ${results.length} ubicaciones detectadas`);
    return results;
}

// ===================================================================
// 3. FUNCIÓN PRINCIPAL DE DETECCIÓN HÍBRIDA
// ===================================================================

/**
 * Detecta ubicaciones geográficas usando método híbrido simplificado
 */
async function detectGeographicLocationsHybrid(text, options = {}) {
    const {
        country_code = 'GTM',
        confidence_threshold = 0.6,
        max_results = 20,
        language = 'es'
    } = options;

    const startTime = Date.now();
    const results = {
        locations: [],
        metadata: {
            total_found: 0,
            methods_used: [],
            country_focus: country_code,
            processing_time_ms: 0
        },
        performance: {
            pattern_detection: { time_ms: 0, found: 0 },
            local_search: { time_ms: 0, found: 0 },
            total_time_ms: 0
        }
    };

    try {
        console.log('🧭 Iniciando detección geográfica híbrida simplificada...');
        
        // ===================================================================
        // PASO 1: DETECCIÓN POR PATRONES
        // ===================================================================
        const patternStart = Date.now();
        const patternResults = detectGuatemalaPatterns(text);
        results.performance.pattern_detection.time_ms = Date.now() - patternStart;
        results.performance.pattern_detection.found = patternResults.length;
        
        if (patternResults.length > 0) {
            results.metadata.methods_used.push('pattern_detection');
        }

        // ===================================================================
        // PASO 2: BÚSQUEDA LOCAL ADICIONAL
        // ===================================================================
        const localStart = Date.now();
        const words = text.toLowerCase().split(/\s+/);
        const localResults = [];
        
        // Buscar palabras individuales que puedan ser ubicaciones
        for (const word of words) {
            if (word.length >= 3) { // Solo palabras de 3+ caracteres
                const wordMatches = searchLocalLocations(word, { limit: 2 });
                
                wordMatches.forEach(match => {
                    if (match.confidence_score >= confidence_threshold) {
                        localResults.push({
                            ...match,
                            detection_method: 'word_search',
                            original_text: word
                        });
                    }
                });
            }
        }
        
        results.performance.local_search.time_ms = Date.now() - localStart;
        results.performance.local_search.found = localResults.length;
        
        if (localResults.length > 0) {
            results.metadata.methods_used.push('local_search');
        }

        // ===================================================================
        // PASO 3: CONSOLIDACIÓN Y DEDUPLICACIÓN
        // ===================================================================
        const allResults = [...patternResults, ...localResults];
        
        // Deduplicar por nombre y tipo
        const uniqueResults = allResults.reduce((acc, current) => {
            const key = `${current.name}_${current.type}`;
            const existing = acc.find(item => `${item.name}_${item.type}` === key);
            
            if (!existing) {
                acc.push(current);
            } else {
                // Mantener el de mayor confianza
                if (current.confidence_score > existing.confidence_score) {
                    const index = acc.indexOf(existing);
                    acc[index] = {
                        ...current,
                        detection_method: `${existing.detection_method}+${current.detection_method}`
                    };
                }
            }
            return acc;
        }, []);

        // Filtrar por umbral de confianza y ordenar
        const filteredResults = uniqueResults
            .filter(result => result.confidence_score >= confidence_threshold)
            .sort((a, b) => {
                // Priorizar por tipo (zona > ciudad > departamento) y luego por confianza
                const typeOrder = { zone: 3, city: 2, department: 1 };
                const aOrder = typeOrder[a.type] || 0;
                const bOrder = typeOrder[b.type] || 0;
                
                if (aOrder !== bOrder) {
                    return bOrder - aOrder;
                }
                
                return b.confidence_score - a.confidence_score;
            })
            .slice(0, max_results);

        // ===================================================================
        // PASO 4: ENRIQUECIMIENTO FINAL
        // ===================================================================
        const enrichedResults = filteredResults.map(result => {
            // Generar location_id
            let location_id = '';
            if (result.type === 'department') {
                location_id = `GTM-DEPT-${normalizeText(result.name).replace(/\s+/g, '').substring(0, 10).toUpperCase()}`;
            } else if (result.type === 'city') {
                location_id = `GTM-CITY-${normalizeText(result.name).replace(/\s+/g, '').substring(0, 10).toUpperCase()}`;
            } else if (result.type === 'zone') {
                location_id = `GTM-ZONE-${normalizeText(result.name).replace(/\s+/g, '').substring(0, 10).toUpperCase()}`;
            }

            // Generar full_path
            let full_path = 'Guatemala';
            if (result.department && result.department !== result.name) {
                full_path += ` > ${result.department}`;
            }
            if (result.city && result.city !== result.name && result.type !== 'city') {
                full_path += ` > ${result.city}`;
            }
            if (result.name) {
                full_path += ` > ${result.name}`;
            }

            // Determinar hierarchy_level
            let hierarchy_level = 1; // país
            if (result.type === 'department') hierarchy_level = 2;
            else if (result.type === 'city') hierarchy_level = 3;
            else if (result.type === 'zone') hierarchy_level = 4;

            // Obtener nombre_local basado en tipo y país
            const country_code = result.country_code || 'GTM';
            const nombre_local = result.nombre_local || getNombreLocalByTypeAndCountry(result.type, country_code);

            return {
                location_id,
                name: result.name,
                full_path,
                combined_confidence: result.confidence_score,
                detection_method: result.detection_method,
                original_text: result.original_text,
                parent_name: result.department !== result.name ? result.department : null,
                nombre_local, // Agregar nomenclatura local
                details: {
                    hierarchy_level,
                    level_code: result.type.toUpperCase(),
                    country_code,
                    type: result.type,
                    department: result.department,
                    city: result.city,
                    nombre_local // También en detalles para compatibilidad
                }
            };
        });

        results.locations = enrichedResults;
        results.metadata.total_found = enrichedResults.length;
        results.metadata.processing_time_ms = Date.now() - startTime;
        results.performance.total_time_ms = Date.now() - startTime;

        console.log(`🎯 Detección híbrida completada en ${results.metadata.processing_time_ms}ms`);
        console.log(`   📍 ${results.metadata.total_found} ubicaciones finales detectadas`);
        console.log(`   🔧 Métodos: ${results.metadata.methods_used.join(', ')}`);

        return results;

    } catch (error) {
        console.error('Error en detección geográfica híbrida:', error);
        results.metadata.processing_time_ms = Date.now() - startTime;
        results.error = error.message;
        return results;
    }
}

// ===================================================================
// 4. FUNCIONES DE UTILIDAD
// ===================================================================

/**
 * Obtiene estadísticas del sistema geográfico simplificado
 */
function getGeographicSystemStats() {
    try {
        const totalDepartments = Object.keys(GUATEMALA_GEOGRAPHY).length;
        const totalCities = Object.values(GUATEMALA_GEOGRAPHY).reduce((sum, cities) => sum + cities.length, 0);
        const totalAliases = Object.keys(CULTURAL_ALIASES).length;

        return {
            total_departments: totalDepartments,
            total_cities: totalCities,
            total_cultural_aliases: totalAliases,
            supported_patterns: Object.keys(GUATEMALA_PATTERNS).length,
            system_type: 'simplified_local_reference'
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas del sistema geográfico:', error);
        return null;
    }
}

// ===================================================================
// 5. EXPORTS
// ===================================================================

module.exports = {
    // Funciones principales
    detectGeographicLocationsHybrid,
    
    // Funciones auxiliares
    searchLocalLocations,
    detectGuatemalaPatterns,
    getGeographicSystemStats,
    
    // Utilidades
    normalizeText,
    calculateSimilarity,
    
    // Configuración
    GUATEMALA_PATTERNS,
    CULTURAL_ALIASES
}; 