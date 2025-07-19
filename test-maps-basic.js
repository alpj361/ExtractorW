// ===================================================================
// PRUEBA BÁSICA DEL AGENTE MAPS
// Verifica que funcione correctamente antes de usar datos reales
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
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

/**
 * Prueba funciones básicas del agente Maps
 */
async function testBasicFunctions() {
  log('🚀 PRUEBAS BÁSICAS DEL AGENTE MAPS', 'magenta');
  log('===================================', 'magenta');
  
  let passed = 0;
  let total = 0;
  
  // 1. Prueba normalización de países
  log('\n1. Probando normalización de países...', 'blue');
  try {
    const result1 = mapsAgent.normalizeCountryName('guatemala');
    const result2 = mapsAgent.normalizeCountryName('méxico');
    
    if (result1 === 'Guatemala' && result2 === 'México') {
      log('   ✅ Normalización de países: EXITOSA', 'green');
      passed++;
    } else {
      log(`   ❌ Normalización de países: FALLIDA (${result1}, ${result2})`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error en normalización de países: ${error.message}`, 'red');
  }
  total++;
  
  // 2. Prueba detección de departamentos
  log('\n2. Probando detección de departamentos...', 'blue');
  try {
    const result1 = mapsAgent.getDepartmentForCity('Cobán');
    const result2 = mapsAgent.getDepartmentForCity('Xela');
    
    if (result1 === 'Alta Verapaz' && result2 === 'Quetzaltenango') {
      log('   ✅ Detección de departamentos: EXITOSA', 'green');
      passed++;
    } else {
      log(`   ❌ Detección de departamentos: FALLIDA (${result1}, ${result2})`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error en detección de departamentos: ${error.message}`, 'red');
  }
  total++;
  
  // 3. Prueba normalización geográfica
  log('\n3. Probando normalización geográfica...', 'blue');
  try {
    const result = mapsAgent.normalizeGeographicInfo({ city: 'Guatemala' });
    
    if (result.city === 'Guatemala' && result.department === 'Guatemala' && result.pais === 'Guatemala') {
      log('   ✅ Normalización geográfica: EXITOSA', 'green');
      passed++;
    } else {
      log(`   ❌ Normalización geográfica: FALLIDA`, 'red');
      log(`      Resultado: ${JSON.stringify(result)}`, 'gray');
    }
  } catch (error) {
    log(`   ❌ Error en normalización geográfica: ${error.message}`, 'red');
  }
  total++;
  
  // 4. Prueba detección de tipos
  log('\n4. Probando detección de tipos...', 'blue');
  try {
    const result1 = mapsAgent.detectLocationType('Guatemala');
    const result2 = mapsAgent.detectLocationType('Zona Viva');
    
    if (result1 === 'city' && result2 === 'zone') {
      log('   ✅ Detección de tipos: EXITOSA', 'green');
      passed++;
    } else {
      log(`   ❌ Detección de tipos: FALLIDA (${result1}, ${result2})`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error en detección de tipos: ${error.message}`, 'red');
  }
  total++;
  
  // 5. Prueba búsqueda de similares
  log('\n5. Probando búsqueda de similares...', 'blue');
  try {
    const result = mapsAgent.findSimilarLocations('Guat', 3);
    
    if (Array.isArray(result) && result.length > 0) {
      log('   ✅ Búsqueda de similares: EXITOSA', 'green');
      log(`      Encontradas: ${result.length} ubicaciones`, 'gray');
      passed++;
    } else {
      log(`   ❌ Búsqueda de similares: FALLIDA`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error en búsqueda de similares: ${error.message}`, 'red');
  }
  total++;
  
  // 6. Prueba validación guatemalteca
  log('\n6. Probando validación guatemalteca...', 'blue');
  try {
    const result1 = mapsAgent.isGuatemalan({ city: 'Guatemala' });
    const result2 = mapsAgent.isGuatemalan({ city: 'New York' });
    
    if (result1 === true && result2 === false) {
      log('   ✅ Validación guatemalteca: EXITOSA', 'green');
      passed++;
    } else {
      log(`   ❌ Validación guatemalteca: FALLIDA (${result1}, ${result2})`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error en validación guatemalteca: ${error.message}`, 'red');
  }
  total++;
  
  // 7. Prueba del mapeo
  log('\n7. Probando información del mapeo...', 'blue');
  try {
    const mapping = mapsAgent.GUATEMALA_MAPPING;
    const deptCount = Object.keys(mapping.departments).length;
    const aliasCount = Object.keys(mapping.cultural_aliases).length;
    
    if (deptCount >= 22 && aliasCount >= 50) {
      log('   ✅ Información del mapeo: EXITOSA', 'green');
      log(`      Departamentos: ${deptCount}, Aliases: ${aliasCount}`, 'gray');
      passed++;
    } else {
      log(`   ❌ Información del mapeo: FALLIDA (Dept: ${deptCount}, Alias: ${aliasCount})`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error en información del mapeo: ${error.message}`, 'red');
  }
  total++;
  
  // 8. Prueba normalización en lote (sin IA)
  log('\n8. Probando normalización en lote...', 'blue');
  try {
    const locations = [
      { city: 'Guatemala' },
      { city: 'Xela' },
      { city: 'Cobán' }
    ];
    
    const result = await mapsAgent.batchNormalizeGeography(locations);
    
    if (Array.isArray(result) && result.length === 3) {
      log('   ✅ Normalización en lote: EXITOSA', 'green');
      log(`      Procesadas: ${result.length} ubicaciones`, 'gray');
      passed++;
    } else {
      log(`   ❌ Normalización en lote: FALLIDA`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error en normalización en lote: ${error.message}`, 'red');
  }
  total++;
  
  // Resumen final
  log('\n===================================', 'magenta');
  log(`📊 RESUMEN: ${passed}/${total} pruebas exitosas`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('🎉 ¡TODAS LAS PRUEBAS BÁSICAS PASARON!', 'green');
    log('✅ El agente Maps está listo para usar con datos reales', 'green');
  } else {
    log('⚠️  Algunas pruebas fallaron. Revisar implementación.', 'yellow');
  }
  
  return passed === total;
}

/**
 * Prueba específica de la función IA (opcional)
 */
async function testAIFunction() {
  log('\n🤖 PRUEBA DE FUNCIÓN IA (OPCIONAL)...', 'blue');
  
  try {
    const result = await mapsAgent.detectGeographyWithAI('El Puerto', 'Costa atlántica');
    
    log('   ✅ Función IA responde correctamente', 'green');
    log(`      Resultado: ${JSON.stringify(result, null, 2)}`, 'gray');
    
    return true;
  } catch (error) {
    log(`   ⚠️  Función IA no disponible: ${error.message}`, 'yellow');
    log('   💡 Esto es normal si no hay API key de Gemini configurada', 'yellow');
    return false;
  }
}

/**
 * Ejecuta todas las pruebas básicas
 */
async function runBasicTests() {
  const basicResult = await testBasicFunctions();
  
  if (basicResult) {
    await testAIFunction();
  }
  
  log('\n🎯 LISTO PARA DATOS REALES', 'magenta');
  log('===================================', 'magenta');
  log('📝 Proporciona los datos de prueba al script test-maps-with-findings.js', 'cyan');
  log('📋 Formato esperado: Array de objetos con { city, department, pais, entity, topic }', 'cyan');
  
  return basicResult;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runBasicTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('🚨 Error ejecutando pruebas:', error);
      process.exit(1);
    });
}

module.exports = { runBasicTests, testBasicFunctions, testAIFunction }; 