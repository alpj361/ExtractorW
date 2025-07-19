// ===================================================================
// SCRIPT DE PRUEBA PARA AGENTE MAPS CON HALLAZGOS REALES
// Procesa datos de hallazgos de prueba para validar normalización
// ===================================================================

const mapsAgent = require('./server/services/mapsAgent');

// Colores para logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(` ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSubsection(title) {
  log('\n' + '-'.repeat(40), 'yellow');
  log(` ${title}`, 'yellow');
  log('-'.repeat(40), 'yellow');
}

/**
 * Datos de prueba - serán reemplazados por datos reales
 */
let testFindings = [
  // Ejemplo de estructura esperada
  {
    id: 'test-1',
    entity: 'Ejemplo',
    city: 'guatemala',
    department: null,
    pais: 'guatemala',
    topic: 'Política',
    description: 'Hallazgo de ejemplo',
    discovery: 'Análisis de ejemplo'
  }
];

/**
 * Establece los datos de prueba
 */
function setTestData(findings) {
  testFindings = findings;
  log(`📊 Datos de prueba establecidos: ${findings.length} hallazgos`, 'green');
}

/**
 * Muestra estadísticas de los datos originales
 */
function analyzeOriginalData() {
  logSection('📊 ANÁLISIS DE DATOS ORIGINALES');
  
  const stats = {
    total: testFindings.length,
    withCity: testFindings.filter(f => f.city && f.city.trim()).length,
    withDepartment: testFindings.filter(f => f.department && f.department.trim()).length,
    withCountry: testFindings.filter(f => f.pais && f.pais.trim()).length,
    withoutLocation: testFindings.filter(f => !f.city && !f.department && !f.pais).length
  };
  
  log(`📈 Total de hallazgos: ${stats.total}`, 'white');
  log(`🏙️  Con ciudad: ${stats.withCity} (${(stats.withCity/stats.total*100).toFixed(1)}%)`, 'cyan');
  log(`🏛️  Con departamento: ${stats.withDepartment} (${(stats.withDepartment/stats.total*100).toFixed(1)}%)`, 'cyan');
  log(`🌍 Con país: ${stats.withCountry} (${(stats.withCountry/stats.total*100).toFixed(1)}%)`, 'cyan');
  log(`❌ Sin ubicación: ${stats.withoutLocation} (${(stats.withoutLocation/stats.total*100).toFixed(1)}%)`, 'red');
  
  // Mostrar ejemplos de ubicaciones únicas
  const uniqueCities = [...new Set(testFindings.map(f => f.city).filter(Boolean))];
  const uniqueDepartments = [...new Set(testFindings.map(f => f.department).filter(Boolean))];
  const uniqueCountries = [...new Set(testFindings.map(f => f.pais).filter(Boolean))];
  
  log(`\n📍 Ciudades únicas encontradas (${uniqueCities.length}):`, 'yellow');
  uniqueCities.slice(0, 10).forEach(city => {
    log(`  • ${city}`, 'gray');
  });
  if (uniqueCities.length > 10) {
    log(`  ... y ${uniqueCities.length - 10} más`, 'gray');
  }
  
  log(`\n🏛️  Departamentos únicos encontrados (${uniqueDepartments.length}):`, 'yellow');
  uniqueDepartments.slice(0, 10).forEach(dept => {
    log(`  • ${dept}`, 'gray');
  });
  if (uniqueDepartments.length > 10) {
    log(`  ... y ${uniqueDepartments.length - 10} más`, 'gray');
  }
  
  log(`\n🌍 Países únicos encontrados (${uniqueCountries.length}):`, 'yellow');
  uniqueCountries.forEach(country => {
    log(`  • ${country}`, 'gray');
  });
  
  return stats;
}

/**
 * Normaliza los hallazgos usando el agente Maps
 */
async function normalizeFindings() {
  logSection('🗺️  NORMALIZACIÓN CON AGENTE MAPS');
  
  log('🔄 Procesando hallazgos con agente Maps...', 'blue');
  
  const startTime = Date.now();
  
  try {
    // Preparar datos para normalización en lote
    const locationsToNormalize = testFindings.map(finding => ({
      city: finding.city,
      department: finding.department,
      pais: finding.pais,
      country: finding.pais
    }));
    
    // Procesar en lote
    const normalizedResults = await mapsAgent.batchNormalizeGeography(locationsToNormalize);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    log(`✅ Normalización completada en ${processingTime}ms`, 'green');
    
    // Aplicar resultados normalizados a los hallazgos originales
    const normalizedFindings = testFindings.map((finding, index) => ({
      ...finding,
      original_city: finding.city,
      original_department: finding.department,
      original_pais: finding.pais,
      normalized_city: normalizedResults[index]?.city || finding.city,
      normalized_department: normalizedResults[index]?.department || finding.department,
      normalized_pais: normalizedResults[index]?.pais || finding.pais,
      detection_method: normalizedResults[index]?.detection_method || 'unchanged',
      confidence: normalizedResults[index]?.confidence || 'unknown'
    }));
    
    return {
      normalizedFindings,
      normalizedResults,
      processingTime,
      stats: {
        total: normalizedResults.length,
        manual_detections: normalizedResults.filter(r => r.detection_method === 'manual').length,
        ai_detections: normalizedResults.filter(r => r.detection_method === 'ai').length,
        error_count: normalizedResults.filter(r => r.detection_method === 'error').length
      }
    };
    
  } catch (error) {
    log(`❌ Error en normalización: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Compara resultados antes y después de la normalización
 */
function compareResults(originalStats, normalizedData) {
  logSection('🔍 COMPARACIÓN DE RESULTADOS');
  
  const { normalizedFindings, stats } = normalizedData;
  
  // Estadísticas después de normalización
  const newStats = {
    total: normalizedFindings.length,
    withCity: normalizedFindings.filter(f => f.normalized_city && f.normalized_city.trim()).length,
    withDepartment: normalizedFindings.filter(f => f.normalized_department && f.normalized_department.trim()).length,
    withCountry: normalizedFindings.filter(f => f.normalized_pais && f.normalized_pais.trim()).length,
    withoutLocation: normalizedFindings.filter(f => !f.normalized_city && !f.normalized_department && !f.normalized_pais).length
  };
  
  logSubsection('📊 Estadísticas de Normalización');
  log(`🔄 Detecciones manuales: ${stats.manual_detections}`, 'green');
  log(`🤖 Detecciones con IA: ${stats.ai_detections}`, 'blue');
  log(`❌ Errores: ${stats.error_count}`, 'red');
  
  logSubsection('📈 Mejoras en Completitud');
  log(`🏙️  Ciudades: ${originalStats.withCity} → ${newStats.withCity} (+${newStats.withCity - originalStats.withCity})`, 'cyan');
  log(`🏛️  Departamentos: ${originalStats.withDepartment} → ${newStats.withDepartment} (+${newStats.withDepartment - originalStats.withDepartment})`, 'cyan');
  log(`🌍 Países: ${originalStats.withCountry} → ${newStats.withCountry} (+${newStats.withCountry - originalStats.withCountry})`, 'cyan');
  log(`❌ Sin ubicación: ${originalStats.withoutLocation} → ${newStats.withoutLocation} (${newStats.withoutLocation - originalStats.withoutLocation})`, 'red');
  
  // Mostrar ejemplos de cambios significativos
  logSubsection('🎯 Ejemplos de Normalización');
  
  const changedFindings = normalizedFindings.filter(f => 
    f.original_city !== f.normalized_city || 
    f.original_department !== f.normalized_department || 
    f.original_pais !== f.normalized_pais
  );
  
  log(`📝 Hallazgos modificados: ${changedFindings.length}/${normalizedFindings.length}`, 'yellow');
  
  changedFindings.slice(0, 10).forEach((finding, index) => {
    log(`\n${index + 1}. ${finding.entity}`, 'white');
    
    if (finding.original_city !== finding.normalized_city) {
      log(`   🏙️  Ciudad: "${finding.original_city}" → "${finding.normalized_city}"`, 'cyan');
    }
    
    if (finding.original_department !== finding.normalized_department) {
      log(`   🏛️  Departamento: "${finding.original_department}" → "${finding.normalized_department}"`, 'cyan');
    }
    
    if (finding.original_pais !== finding.normalized_pais) {
      log(`   🌍 País: "${finding.original_pais}" → "${finding.normalized_pais}"`, 'cyan');
    }
    
    log(`   🔍 Método: ${finding.detection_method} (${finding.confidence})`, 'gray');
  });
  
  if (changedFindings.length > 10) {
    log(`\n... y ${changedFindings.length - 10} cambios más`, 'gray');
  }
  
  return newStats;
}

/**
 * Detecta y muestra duplicados potenciales
 */
function detectDuplicates(normalizedFindings) {
  logSection('🔍 DETECCIÓN DE DUPLICADOS');
  
  // Agrupar por ubicación normalizada
  const locationGroups = {};
  
  normalizedFindings.forEach(finding => {
    const locationKey = `${finding.normalized_pais || 'unknown'}|${finding.normalized_department || 'unknown'}|${finding.normalized_city || 'unknown'}`;
    
    if (!locationGroups[locationKey]) {
      locationGroups[locationKey] = [];
    }
    
    locationGroups[locationKey].push(finding);
  });
  
  // Encontrar grupos con múltiples hallazgos
  const duplicateGroups = Object.entries(locationGroups)
    .filter(([key, findings]) => findings.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  log(`📊 Grupos de ubicación únicos: ${Object.keys(locationGroups).length}`, 'cyan');
  log(`🔄 Grupos con múltiples hallazgos: ${duplicateGroups.length}`, 'yellow');
  
  if (duplicateGroups.length > 0) {
    logSubsection('🎯 Top Ubicaciones con Múltiples Hallazgos');
    
    duplicateGroups.slice(0, 10).forEach(([locationKey, findings], index) => {
      const [country, department, city] = locationKey.split('|');
      log(`\n${index + 1}. ${city !== 'unknown' ? city : ''} ${department !== 'unknown' ? ', ' + department : ''} ${country !== 'unknown' ? ', ' + country : ''} (${findings.length} hallazgos)`, 'white');
      
      findings.slice(0, 3).forEach(finding => {
        log(`   • ${finding.entity} - ${finding.topic}`, 'gray');
      });
      
      if (findings.length > 3) {
        log(`   ... y ${findings.length - 3} más`, 'gray');
      }
    });
  }
  
  return duplicateGroups;
}

/**
 * Valida la calidad de la normalización
 */
function validateNormalization(normalizedFindings) {
  logSection('✅ VALIDACIÓN DE CALIDAD');
  
  const validationResults = {
    total: normalizedFindings.length,
    guatemalan_locations: 0,
    foreign_locations: 0,
    unknown_locations: 0,
    complete_locations: 0,
    incomplete_locations: 0,
    high_confidence: 0,
    medium_confidence: 0,
    low_confidence: 0
  };
  
  normalizedFindings.forEach(finding => {
    // Validar si es guatemalteco
    const isGuatemalan = mapsAgent.isGuatemalan({
      city: finding.normalized_city,
      department: finding.normalized_department,
      pais: finding.normalized_pais
    });
    
    if (isGuatemalan) {
      validationResults.guatemalan_locations++;
    } else if (finding.normalized_pais && finding.normalized_pais !== 'Guatemala') {
      validationResults.foreign_locations++;
    } else {
      validationResults.unknown_locations++;
    }
    
    // Validar completitud
    if (finding.normalized_city && finding.normalized_department && finding.normalized_pais) {
      validationResults.complete_locations++;
    } else {
      validationResults.incomplete_locations++;
    }
    
    // Validar confianza
    switch (finding.confidence) {
      case 'high':
        validationResults.high_confidence++;
        break;
      case 'medium':
        validationResults.medium_confidence++;
        break;
      case 'low':
        validationResults.low_confidence++;
        break;
    }
  });
  
  log(`🇬🇹 Ubicaciones guatemaltecas: ${validationResults.guatemalan_locations} (${(validationResults.guatemalan_locations/validationResults.total*100).toFixed(1)}%)`, 'green');
  log(`🌍 Ubicaciones extranjeras: ${validationResults.foreign_locations} (${(validationResults.foreign_locations/validationResults.total*100).toFixed(1)}%)`, 'blue');
  log(`❓ Ubicaciones desconocidas: ${validationResults.unknown_locations} (${(validationResults.unknown_locations/validationResults.total*100).toFixed(1)}%)`, 'yellow');
  
  log(`\n✅ Ubicaciones completas: ${validationResults.complete_locations} (${(validationResults.complete_locations/validationResults.total*100).toFixed(1)}%)`, 'green');
  log(`⚠️  Ubicaciones incompletas: ${validationResults.incomplete_locations} (${(validationResults.incomplete_locations/validationResults.total*100).toFixed(1)}%)`, 'yellow');
  
  log(`\n🎯 Confianza alta: ${validationResults.high_confidence} (${(validationResults.high_confidence/validationResults.total*100).toFixed(1)}%)`, 'green');
  log(`🎯 Confianza media: ${validationResults.medium_confidence} (${(validationResults.medium_confidence/validationResults.total*100).toFixed(1)}%)`, 'yellow');
  log(`🎯 Confianza baja: ${validationResults.low_confidence} (${(validationResults.low_confidence/validationResults.total*100).toFixed(1)}%)`, 'red');
  
  return validationResults;
}

/**
 * Genera reporte final
 */
function generateReport(processingTime, originalStats, newStats, duplicateGroups, validationResults) {
  logSection('📋 REPORTE FINAL');
  
  const improvementRate = newStats.withCity + newStats.withDepartment + newStats.withCountry;
  const originalRate = originalStats.withCity + originalStats.withDepartment + originalStats.withCountry;
  const improvement = improvementRate - originalRate;
  
  log(`⏱️  Tiempo de procesamiento: ${processingTime}ms`, 'cyan');
  log(`📊 Hallazgos procesados: ${originalStats.total}`, 'white');
  log(`🔄 Mejoras totales: +${improvement} campos geográficos`, 'green');
  log(`🎯 Tasa de completitud: ${(newStats.withCity + newStats.withDepartment + newStats.withCountry)/(newStats.total*3)*100}%`, 'cyan');
  log(`🇬🇹 Ubicaciones guatemaltecas: ${validationResults.guatemalan_locations} (${(validationResults.guatemalan_locations/validationResults.total*100).toFixed(1)}%)`, 'green');
  log(`🔍 Grupos con duplicados: ${duplicateGroups.length}`, 'yellow');
  log(`✅ Confianza alta: ${validationResults.high_confidence} (${(validationResults.high_confidence/validationResults.total*100).toFixed(1)}%)`, 'green');
  
  // Evaluación general
  const successRate = (validationResults.high_confidence + validationResults.medium_confidence) / validationResults.total;
  const completenessRate = validationResults.complete_locations / validationResults.total;
  
  log('\n🎯 EVALUACIÓN GENERAL:', 'magenta');
  
  if (successRate > 0.8 && completenessRate > 0.6) {
    log('🎉 ¡EXCELENTE! El agente Maps está funcionando correctamente', 'green');
  } else if (successRate > 0.6 && completenessRate > 0.4) {
    log('✅ BUENO: El agente Maps funciona bien con espacio para mejoras', 'yellow');
  } else {
    log('⚠️  NECESITA MEJORAS: El agente Maps requiere ajustes', 'red');
  }
  
  log(`   - Tasa de éxito: ${(successRate*100).toFixed(1)}%`, 'gray');
  log(`   - Tasa de completitud: ${(completenessRate*100).toFixed(1)}%`, 'gray');
  log(`   - Rendimiento: ${(1000/processingTime*originalStats.total).toFixed(0)} hallazgos/segundo`, 'gray');
}

/**
 * Ejecuta todas las pruebas con los datos proporcionados
 */
async function runTestWithFindings() {
  log('🚀 INICIANDO PRUEBAS DEL AGENTE MAPS CON HALLAZGOS REALES', 'magenta');
  log('================================================================', 'magenta');
  
  if (!testFindings || testFindings.length === 0) {
    log('❌ ERROR: No se han proporcionado datos de prueba', 'red');
    log('📝 Usa setTestData(findings) para establecer los datos de prueba', 'yellow');
    return false;
  }
  
  try {
    // 1. Análisis de datos originales
    const originalStats = analyzeOriginalData();
    
    // 2. Normalización con agente Maps
    const normalizedData = await normalizeFindings();
    
    // 3. Comparación de resultados
    const newStats = compareResults(originalStats, normalizedData);
    
    // 4. Detección de duplicados
    const duplicateGroups = detectDuplicates(normalizedData.normalizedFindings);
    
    // 5. Validación de calidad
    const validationResults = validateNormalization(normalizedData.normalizedFindings);
    
    // 6. Reporte final
    generateReport(normalizedData.processingTime, originalStats, newStats, duplicateGroups, validationResults);
    
    return {
      success: true,
      originalStats,
      newStats,
      duplicateGroups,
      validationResults,
      normalizedFindings: normalizedData.normalizedFindings,
      processingTime: normalizedData.processingTime
    };
    
  } catch (error) {
    log(`\n❌ ERROR GENERAL: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

// Exportar funciones para uso externo
module.exports = {
  setTestData,
  runTestWithFindings,
  analyzeOriginalData,
  normalizeFindings,
  compareResults,
  detectDuplicates,
  validateNormalization,
  generateReport
};

// Mensaje de instrucciones si se ejecuta directamente
if (require.main === module) {
  log('📋 INSTRUCCIONES DE USO:', 'cyan');
  log('1. Importa este módulo: const testScript = require("./test-maps-with-findings");', 'white');
  log('2. Establece datos de prueba: testScript.setTestData(tusDatosDeHallazgos);', 'white');
  log('3. Ejecuta las pruebas: await testScript.runTestWithFindings();', 'white');
  log('\n💡 O proporciona los datos de prueba y se ejecutarán automáticamente', 'yellow');
  log('================================================================', 'magenta');
} 