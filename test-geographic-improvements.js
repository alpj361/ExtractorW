// ===================================================================
// SCRIPT DE PRUEBA: Mejoras al sistema de detección geográfica
// Verifica que funcionen coordenadas y múltiples ubicaciones
// ===================================================================

const { batchNormalizeGeographyWithCoordinates } = require('./server/services/mapsAgent');

async function testGeographicImprovements() {
  console.log('🧪 INICIANDO PRUEBAS DE MEJORAS GEOGRÁFICAS\n');

  // ===================================================================
  // CASO 1: Ubicaciones únicas (comportamiento existente)
  // ===================================================================
  console.log('📍 CASO 1: Ubicaciones únicas');
  const singleLocations = [
    { city: 'Antigua Guatemala', department: null, pais: null },
    { city: 'Cobán', department: null, pais: null },
    { city: null, department: 'Petén', pais: 'Guatemala' },
    { city: 'Puerto Barrios', department: 'Izabal', pais: 'Guatemala' }
  ];

  const singleResults = await batchNormalizeGeographyWithCoordinates(singleLocations);
  
  console.log(`   ✅ Procesadas ${singleLocations.length} ubicaciones únicas`);
  console.log(`   ✅ Resultados: ${singleResults.length} ubicaciones`);
  console.log(`   ✅ Con coordenadas: ${singleResults.filter(r => r.coordinates).length}`);
  
  singleResults.forEach((result, i) => {
    console.log(`   📊 [${i}] ${result.city || result.department} - Coords: ${result.coordinates ? 'SÍ' : 'NO'} - Método: ${result.detection_method}`);
  });

  // ===================================================================
  // CASO 2: Múltiples departamentos en una sola entrada
  // ===================================================================
  console.log('\n📍 CASO 2: Múltiples departamentos');
  const multiDepartments = [
    { city: 'Zacapa, Quiché, Alta Verapaz', department: null, pais: null },
    { city: 'Petén, Huehuetenango', department: null, pais: null }
  ];

  const multiDeptResults = await batchNormalizeGeographyWithCoordinates(multiDepartments);
  
  console.log(`   ✅ Procesadas ${multiDepartments.length} entradas con múltiples departamentos`);
  console.log(`   ✅ Resultados: ${multiDeptResults.length} ubicaciones separadas`);
  console.log(`   ✅ Factor de expansión: ${(multiDeptResults.length / multiDepartments.length).toFixed(2)}x`);
  console.log(`   ✅ Con coordenadas: ${multiDeptResults.filter(r => r.coordinates).length}`);
  
  multiDeptResults.forEach((result, i) => {
    const multiFlag = result._isMultiLocation ? '🔄 MULTI' : '⚫ SINGLE';
    console.log(`   📊 [${i}] ${multiFlag} ${result.department} - Coords: ${result.coordinates ? 'SÍ' : 'NO'} - Método: ${result.detection_method}`);
  });

  // ===================================================================
  // CASO 3: Múltiples municipios en el mismo departamento
  // ===================================================================
  console.log('\n📍 CASO 3: Múltiples municipios');
  const multiMunicipalities = [
    { city: 'El Estor, Livingston, Izabal', department: null, pais: null },
    { city: 'Antigua Guatemala, Jocotenango, Sacatepéquez', department: null, pais: null }
  ];

  const multiMuniResults = await batchNormalizeGeographyWithCoordinates(multiMunicipalities);
  
  console.log(`   ✅ Procesadas ${multiMunicipalities.length} entradas con múltiples municipios`);
  console.log(`   ✅ Resultados: ${multiMuniResults.length} ubicaciones separadas`);
  console.log(`   ✅ Factor de expansión: ${(multiMuniResults.length / multiMunicipalities.length).toFixed(2)}x`);
  console.log(`   ✅ Con coordenadas: ${multiMuniResults.filter(r => r.coordinates).length}`);
  
  multiMuniResults.forEach((result, i) => {
    const multiFlag = result._isMultiLocation ? '🔄 MULTI' : '⚫ SINGLE';
    console.log(`   📊 [${i}] ${multiFlag} ${result.city}, ${result.department} - Coords: ${result.coordinates ? 'SÍ' : 'NO'} - Método: ${result.detection_method}`);
  });

  // ===================================================================
  // CASO 4: Mezcla de ubicaciones únicas y múltiples
  // ===================================================================
  console.log('\n📍 CASO 4: Mezcla de ubicaciones');
  const mixedLocations = [
    { city: 'Guatemala', department: null, pais: null }, // Única
    { city: 'Quetzaltenango, San Marcos', department: null, pais: null }, // Múltiple
    { city: 'Flores', department: 'Petén', pais: 'Guatemala' }, // Única con departamento
    { city: 'Cobán, Salamá, Chisec', department: null, pais: null } // Múltiple municipios
  ];

  const mixedResults = await batchNormalizeGeographyWithCoordinates(mixedLocations);
  
  console.log(`   ✅ Procesadas ${mixedLocations.length} entradas mixtas`);
  console.log(`   ✅ Resultados: ${mixedResults.length} ubicaciones`);
  console.log(`   ✅ Factor de expansión: ${(mixedResults.length / mixedLocations.length).toFixed(2)}x`);
  console.log(`   ✅ Con coordenadas: ${mixedResults.filter(r => r.coordinates).length}`);
  console.log(`   ✅ Múltiples ubicaciones: ${mixedResults.filter(r => r._isMultiLocation).length}`);
  
  mixedResults.forEach((result, i) => {
    const multiFlag = result._isMultiLocation ? '🔄 MULTI' : '⚫ SINGLE';
    const location = result.city ? `${result.city}, ${result.department}` : result.department;
    console.log(`   📊 [${i}] ${multiFlag} ${location} - Coords: ${result.coordinates ? 'SÍ' : 'NO'} - Método: ${result.detection_method}`);
  });

  // ===================================================================
  // RESUMEN GENERAL
  // ===================================================================
  console.log('\n🎯 RESUMEN GENERAL DE PRUEBAS:');
  
  const allResults = [...singleResults, ...multiDeptResults, ...multiMuniResults, ...mixedResults];
  const allInputs = [...singleLocations, ...multiDepartments, ...multiMunicipalities, ...mixedLocations];
  
  console.log(`   📊 Entradas totales: ${allInputs.length}`);
  console.log(`   📊 Resultados totales: ${allResults.length}`);
  console.log(`   📊 Factor de expansión global: ${(allResults.length / allInputs.length).toFixed(2)}x`);
  console.log(`   📊 Con coordenadas: ${allResults.filter(r => r.coordinates).length} (${((allResults.filter(r => r.coordinates).length / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`   📊 Múltiples ubicaciones: ${allResults.filter(r => r._isMultiLocation).length} (${((allResults.filter(r => r._isMultiLocation).length / allResults.length) * 100).toFixed(1)}%)`);
  
  const detectionMethods = {};
  allResults.forEach(r => {
    detectionMethods[r.detection_method] = (detectionMethods[r.detection_method] || 0) + 1;
  });
  
  console.log(`   📊 Métodos de detección:`, detectionMethods);
  
  console.log('\n✅ PRUEBAS COMPLETADAS EXITOSAMENTE');
}

// Ejecutar las pruebas
if (require.main === module) {
  testGeographicImprovements()
    .then(() => {
      console.log('\n🎉 Todas las pruebas de mejoras geográficas completadas');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error en las pruebas:', error);
      process.exit(1);
    });
}

module.exports = { testGeographicImprovements }; 