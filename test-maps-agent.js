// ===================================================================
// SCRIPT DE PRUEBA PARA AGENTE MAPS
// Verifica funcionalidad de normalización y detección geográfica
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

// Casos de prueba
const testCases = {
  countries: [
    { input: 'guatemala', expected: 'Guatemala' },
    { input: 'méxico', expected: 'México' },
    { input: 'eeuu', expected: 'Estados Unidos' },
    { input: 'el salvador', expected: 'El Salvador' },
    { input: 'estados unidos', expected: 'Estados Unidos' },
    { input: 'usa', expected: 'Estados Unidos' },
    { input: 'spain', expected: 'España' }
  ],
  cities: [
    { input: 'xela', expected: 'Quetzaltenango', expectedDept: 'Quetzaltenango' },
    { input: 'guate', expected: 'Guatemala', expectedDept: 'Guatemala' },
    { input: 'la capital', expected: 'Guatemala', expectedDept: 'Guatemala' },
    { input: 'antigua', expected: 'Antigua Guatemala', expectedDept: 'Sacatepéquez' },
    { input: 'coban', expected: 'Cobán', expectedDept: 'Alta Verapaz' },
    { input: 'el puerto', expected: 'Puerto Barrios', expectedDept: 'Izabal' },
    { input: 'huehue', expected: 'Huehuetenango', expectedDept: 'Huehuetenango' }
  ],
  zones: [
    { input: 'zona viva', expected: 'Zona 10', expectedCity: 'Guatemala' },
    { input: 'zona rosa', expected: 'Zona 10', expectedCity: 'Guatemala' },
    { input: 'centro histórico', expected: 'Zona 1', expectedCity: 'Guatemala' },
    { input: 'el centro', expected: 'Zona 1', expectedCity: 'Guatemala' }
  ],
  departments: [
    { input: 'las verapaces', expected: 'Alta Verapaz' },
    { input: 'el norte', expected: 'Petén' },
    { input: 'quiche', expected: 'Quiché' },
    { input: 'san marcos', expected: 'San Marcos' }
  ],
  geographic_info: [
    { 
      input: { city: 'Guatemala' }, 
      expected: { city: 'Guatemala', department: 'Guatemala', pais: 'Guatemala' }
    },
    { 
      input: { city: 'Xela' }, 
      expected: { city: 'Quetzaltenango', department: 'Quetzaltenango', pais: 'Guatemala' }
    },
    { 
      input: { city: 'Cobán' }, 
      expected: { city: 'Cobán', department: 'Alta Verapaz', pais: 'Guatemala' }
    },
    { 
      input: { city: 'Puerto Barrios' }, 
      expected: { city: 'Puerto Barrios', department: 'Izabal', pais: 'Guatemala' }
    },
    { 
      input: { city: 'Mixco' }, 
      expected: { city: 'Mixco', department: 'Guatemala', pais: 'Guatemala' }
    }
  ]
};

/**
 * Prueba normalización de países
 */
async function testCountryNormalization() {
  log('\n🌍 Probando normalización de países...', 'blue');
  
  let passed = 0;
  let total = testCases.countries.length;
  
  for (const testCase of testCases.countries) {
    try {
      const result = mapsAgent.normalizeCountryName(testCase.input);
      
      if (result === testCase.expected) {
        log(`  ✅ ${testCase.input} → ${result}`, 'green');
        passed++;
      } else {
        log(`  ❌ ${testCase.input} → Expected: ${testCase.expected}, Got: ${result}`, 'red');
      }
    } catch (error) {
      log(`  🚨 ${testCase.input} → Error: ${error.message}`, 'red');
    }
  }
  
  log(`\n📊 Países: ${passed}/${total} casos exitosos`, passed === total ? 'green' : 'yellow');
  return passed === total;
}

/**
 * Prueba detección de departamentos para ciudades
 */
async function testDepartmentDetection() {
  log('\n🏛️ Probando detección de departamentos...', 'blue');
  
  let passed = 0;
  let total = testCases.cities.length;
  
  for (const testCase of testCases.cities) {
    try {
      const result = mapsAgent.getDepartmentForCity(testCase.input);
      
      if (result === testCase.expectedDept) {
        log(`  ✅ ${testCase.input} → ${result}`, 'green');
        passed++;
      } else {
        log(`  ❌ ${testCase.input} → Expected: ${testCase.expectedDept}, Got: ${result}`, 'red');
      }
    } catch (error) {
      log(`  🚨 ${testCase.input} → Error: ${error.message}`, 'red');
    }
  }
  
  log(`\n📊 Departamentos: ${passed}/${total} casos exitosos`, passed === total ? 'green' : 'yellow');
  return passed === total;
}

/**
 * Prueba detección de tipos de ubicación
 */
async function testLocationTypeDetection() {
  log('\n📍 Probando detección de tipos de ubicación...', 'blue');
  
  const tests = [
    { input: 'Guatemala', expectedType: 'city' },
    { input: 'Zona Viva', expectedType: 'zone' },
    { input: 'Quetzaltenango', expectedType: 'department' },
    { input: 'México', expectedType: 'country' },
    { input: 'Xela', expectedType: 'city' },
    { input: 'Las Verapaces', expectedType: 'department' }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const testCase of tests) {
    try {
      const result = mapsAgent.detectLocationType(testCase.input);
      
      if (result === testCase.expectedType) {
        log(`  ✅ ${testCase.input} → ${result}`, 'green');
        passed++;
      } else {
        log(`  ❌ ${testCase.input} → Expected: ${testCase.expectedType}, Got: ${result}`, 'red');
      }
    } catch (error) {
      log(`  🚨 ${testCase.input} → Error: ${error.message}`, 'red');
    }
  }
  
  log(`\n📊 Tipos de ubicación: ${passed}/${total} casos exitosos`, passed === total ? 'green' : 'yellow');
  return passed === total;
}

/**
 * Prueba normalización de información geográfica completa
 */
async function testGeographicInfoNormalization() {
  log('\n🗺️ Probando normalización de información geográfica...', 'blue');
  
  let passed = 0;
  let total = testCases.geographic_info.length;
  
  for (const testCase of testCases.geographic_info) {
    try {
      const result = mapsAgent.normalizeGeographicInfo(testCase.input);
      
      const cityMatch = result.city === testCase.expected.city;
      const deptMatch = result.department === testCase.expected.department;
      const countryMatch = result.pais === testCase.expected.pais;
      
      if (cityMatch && deptMatch && countryMatch) {
        log(`  ✅ ${JSON.stringify(testCase.input)} → ${JSON.stringify(result)}`, 'green');
        passed++;
      } else {
        log(`  ❌ ${JSON.stringify(testCase.input)} → Expected: ${JSON.stringify(testCase.expected)}, Got: ${JSON.stringify(result)}`, 'red');
      }
    } catch (error) {
      log(`  🚨 ${JSON.stringify(testCase.input)} → Error: ${error.message}`, 'red');
    }
  }
  
  log(`\n📊 Información geográfica: ${passed}/${total} casos exitosos`, passed === total ? 'green' : 'yellow');
  return passed === total;
}

/**
 * Prueba búsqueda de ubicaciones similares
 */
async function testSimilarLocations() {
  log('\n🔍 Probando búsqueda de ubicaciones similares...', 'blue');
  
  const tests = [
    { input: 'Guat', expectedCount: 5 },
    { input: 'Quet', expectedCount: 3 },
    { input: 'San', expectedCount: 5 },
    { input: 'Vera', expectedCount: 2 }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const testCase of tests) {
    try {
      const result = mapsAgent.findSimilarLocations(testCase.input, 5);
      
      if (Array.isArray(result) && result.length > 0) {
        log(`  ✅ ${testCase.input} → ${result.length} resultados encontrados`, 'green');
        result.slice(0, 3).forEach(loc => {
          log(`    - ${loc.name} (${loc.type}) - ${(loc.similarity * 100).toFixed(1)}%`, 'cyan');
        });
        passed++;
      } else {
        log(`  ❌ ${testCase.input} → No se encontraron resultados`, 'red');
      }
    } catch (error) {
      log(`  🚨 ${testCase.input} → Error: ${error.message}`, 'red');
    }
  }
  
  log(`\n📊 Búsquedas similares: ${passed}/${total} casos exitosos`, passed === total ? 'green' : 'yellow');
  return passed === total;
}

/**
 * Prueba normalización en lote
 */
async function testBatchNormalization() {
  log('\n📦 Probando normalización en lote...', 'blue');
  
  const locations = [
    { city: 'Guatemala' },
    { city: 'Xela' },
    { city: 'Cobán' },
    { city: 'Puerto Barrios' },
    { city: 'Mixco' }
  ];
  
  try {
    const results = await mapsAgent.batchNormalizeGeography(locations);
    
    if (Array.isArray(results) && results.length === locations.length) {
      log(`  ✅ Procesadas ${results.length} ubicaciones`, 'green');
      
      results.forEach((result, index) => {
        const input = locations[index];
        log(`    ${input.city} → ${result.city}, ${result.department} (${result.detection_method})`, 'cyan');
      });
      
      log(`\n📊 Lote: ${results.length}/${locations.length} casos procesados`, 'green');
      return true;
    } else {
      log(`  ❌ Error en procesamiento en lote`, 'red');
      return false;
    }
  } catch (error) {
    log(`  🚨 Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Prueba validación de ubicaciones guatemaltecas
 */
async function testGuatemalanValidation() {
  log('\n🇬🇹 Probando validación de ubicaciones guatemaltecas...', 'blue');
  
  const tests = [
    { input: { city: 'Guatemala' }, expected: true },
    { input: { department: 'Quetzaltenango' }, expected: true },
    { input: { pais: 'Guatemala' }, expected: true },
    { input: { city: 'New York' }, expected: false },
    { input: { city: 'Madrid' }, expected: false },
    { input: { department: 'Texas' }, expected: false }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const testCase of tests) {
    try {
      const result = mapsAgent.isGuatemalan(testCase.input);
      
      if (result === testCase.expected) {
        log(`  ✅ ${JSON.stringify(testCase.input)} → ${result}`, 'green');
        passed++;
      } else {
        log(`  ❌ ${JSON.stringify(testCase.input)} → Expected: ${testCase.expected}, Got: ${result}`, 'red');
      }
    } catch (error) {
      log(`  🚨 ${JSON.stringify(testCase.input)} → Error: ${error.message}`, 'red');
    }
  }
  
  log(`\n📊 Validación guatemalteca: ${passed}/${total} casos exitosos`, passed === total ? 'green' : 'yellow');
  return passed === total;
}

/**
 * Prueba información del mapeo
 */
async function testMappingInfo() {
  log('\n📋 Probando información del mapeo...', 'blue');
  
  try {
    const mapping = mapsAgent.GUATEMALA_MAPPING;
    
    const stats = {
      departments: Object.keys(mapping.departments).length,
      total_municipalities: Object.values(mapping.departments).reduce((acc, dept) => 
        acc + (dept.municipalities ? dept.municipalities.length : 0), 0),
      cultural_aliases: Object.keys(mapping.cultural_aliases).length,
      countries: Object.keys(mapping.countries).length
    };
    
    log(`  📊 Estadísticas del mapeo:`, 'cyan');
    log(`    - Departamentos: ${stats.departments}`, 'cyan');
    log(`    - Municipios totales: ${stats.total_municipalities}`, 'cyan');
    log(`    - Aliases culturales: ${stats.cultural_aliases}`, 'cyan');
    log(`    - Países: ${stats.countries}`, 'cyan');
    
    const requiredMinimums = {
      departments: 22, // Guatemala tiene 22 departamentos
      total_municipalities: 300, // Al menos 300 municipios
      cultural_aliases: 50, // Al menos 50 aliases
      countries: 10 // Al menos 10 países
    };
    
    let passed = 0;
    let total = Object.keys(requiredMinimums).length;
    
    for (const [key, minimum] of Object.entries(requiredMinimums)) {
      if (stats[key] >= minimum) {
        log(`    ✅ ${key}: ${stats[key]} >= ${minimum}`, 'green');
        passed++;
      } else {
        log(`    ❌ ${key}: ${stats[key]} < ${minimum}`, 'red');
      }
    }
    
    log(`\n📊 Mapeo: ${passed}/${total} requisitos cumplidos`, passed === total ? 'green' : 'yellow');
    return passed === total;
  } catch (error) {
    log(`  🚨 Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Ejecuta todas las pruebas
 */
async function runAllTests() {
  log('🚀 INICIANDO PRUEBAS DEL AGENTE MAPS', 'magenta');
  log('========================================', 'magenta');
  
  const testResults = [];
  
  // Ejecutar todas las pruebas
  testResults.push(await testCountryNormalization());
  testResults.push(await testDepartmentDetection());
  testResults.push(await testLocationTypeDetection());
  testResults.push(await testGeographicInfoNormalization());
  testResults.push(await testSimilarLocations());
  testResults.push(await testBatchNormalization());
  testResults.push(await testGuatemalanValidation());
  testResults.push(await testMappingInfo());
  
  // Resumen final
  const passedTests = testResults.filter(result => result).length;
  const totalTests = testResults.length;
  
  log('\n========================================', 'magenta');
  log(`🎯 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS EXITOSAS`, 
    passedTests === totalTests ? 'green' : 'yellow');
  
  if (passedTests === totalTests) {
    log('🎉 ¡TODAS LAS PRUEBAS PASARON! El agente Maps está funcionando correctamente.', 'green');
  } else {
    log('⚠️  Algunas pruebas fallaron. Revisar logs para más detalles.', 'yellow');
  }
  
  log('========================================', 'magenta');
  
  return passedTests === totalTests;
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('🚨 Error ejecutando pruebas:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testCountryNormalization,
  testDepartmentDetection,
  testLocationTypeDetection,
  testGeographicInfoNormalization,
  testSimilarLocations,
  testBatchNormalization,
  testGuatemalanValidation,
  testMappingInfo
}; 