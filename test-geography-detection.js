// ===================================================================
// SCRIPT DE PRUEBA PARA NORMALIZACIÓN GEOGRÁFICA
// Verifica la detección automática de departamentos desde ciudades
// ===================================================================

const { 
  getDepartmentForCity, 
  getCitiesForDepartment, 
  isCityInDepartment, 
  normalizeGeographicInfo,
  GUATEMALA_GEOGRAPHY 
} = require('./server/utils/guatemala-geography');

console.log('🧪 INICIANDO PRUEBAS DE NORMALIZACIÓN GEOGRÁFICA\n');

// ===================================================================
// PRUEBA 1: Detección de departamentos por ciudad
// ===================================================================
console.log('📍 PRUEBA 1: Detección de departamentos por ciudad');
console.log('='.repeat(50));

const testCities = [
  'Antigua Guatemala',
  'Quetzaltenango', 
  'Cobán',
  'Puerto Barrios',
  'Mixco',
  'Villa Nueva',
  'Chiquimula',
  'Huehuetenango',
  'Flores',
  'Esquipulas',
  'Mazatenango',
  'Retalhuleu'
];

testCities.forEach(city => {
  const department = getDepartmentForCity(city);
  console.log(`🏙️  ${city} → ${department || 'NO DETECTADO'}`);
});

console.log('\n');

// ===================================================================
// PRUEBA 2: Normalización automática con casos reales
// ===================================================================
console.log('🔄 PRUEBA 2: Normalización automática');
console.log('='.repeat(50));

const testCases = [
  // Caso 1: Solo ciudad (debe detectar departamento)
  {
    input: { city: 'Antigua Guatemala', department: null, pais: null },
    expected: 'Detectar Sacatepéquez automáticamente'
  },
  // Caso 2: Ciudad y departamento (debe mantener)
  {
    input: { city: 'Cobán', department: 'Alta Verapaz', pais: null },
    expected: 'Mantener Alta Verapaz y agregar Guatemala'
  },
  // Caso 3: Solo departamento (debe mantener)
  {
    input: { city: null, department: 'Quetzaltenango', pais: null },
    expected: 'Mantener Quetzaltenango y agregar Guatemala'
  },
  // Caso 4: Información completa (debe mantener todo)
  {
    input: { city: 'Chiquimula', department: 'Chiquimula', pais: 'Guatemala' },
    expected: 'Mantener toda la información'
  },
  // Caso 5: Ciudad no reconocida
  {
    input: { city: 'Ciudad Inexistente', department: null, pais: null },
    expected: 'No debe detectar departamento'
  }
];

testCases.forEach((testCase, index) => {
  console.log(`\n🧪 Caso ${index + 1}: ${testCase.expected}`);
  console.log(`   Entrada:   `, testCase.input);
  
  const result = normalizeGeographicInfo(testCase.input);
  console.log(`   Resultado: `, result);
  
  // Verificar si la normalización funcionó como se esperaba
  const cityDetected = result.department && !testCase.input.department;
  const countryAdded = result.pais && !testCase.input.pais;
  
  if (cityDetected) {
    console.log(`   ✅ Departamento detectado automáticamente: ${result.department}`);
  }
  if (countryAdded) {
    console.log(`   ✅ País agregado automáticamente: ${result.pais}`);
  }
});

console.log('\n');

// ===================================================================
// PRUEBA 3: Estadísticas del mapeo
// ===================================================================
console.log('📊 PRUEBA 3: Estadísticas del mapeo geográfico');
console.log('='.repeat(50));

const departments = Object.keys(GUATEMALA_GEOGRAPHY);
const totalCities = Object.values(GUATEMALA_GEOGRAPHY).reduce((sum, cities) => sum + cities.length, 0);

console.log(`📋 Total de departamentos: ${departments.length}`);
console.log(`🏙️  Total de ciudades/municipios: ${totalCities}`);
console.log(`📈 Promedio de municipios por departamento: ${(totalCities / departments.length).toFixed(1)}`);

console.log('\n📊 Departamentos con más municipios:');
const deptStats = departments.map(dept => ({
  name: dept,
  count: GUATEMALA_GEOGRAPHY[dept].length
})).sort((a, b) => b.count - a.count);

deptStats.slice(0, 5).forEach((dept, index) => {
  console.log(`   ${index + 1}. ${dept.name}: ${dept.count} municipios`);
});

console.log('\n');

// ===================================================================
// PRUEBA 4: Validación de consistencia
// ===================================================================
console.log('🔍 PRUEBA 4: Validación de consistencia');
console.log('='.repeat(50));

let validationErrors = 0;

// Verificar que cada ciudad está en el departamento correcto
departments.forEach(dept => {
  const cities = GUATEMALA_GEOGRAPHY[dept];
  cities.forEach(city => {
    const detectedDept = getDepartmentForCity(city);
    if (detectedDept !== dept) {
      console.log(`❌ ERROR: Ciudad "${city}" en departamento "${dept}" detectada como "${detectedDept}"`);
      validationErrors++;
    }
  });
});

// Verificar función de validación
const validationTests = [
  { city: 'Antigua Guatemala', dept: 'Sacatepéquez', shouldMatch: true },
  { city: 'Quetzaltenango', dept: 'Quetzaltenango', shouldMatch: true },
  { city: 'Antigua Guatemala', dept: 'Guatemala', shouldMatch: false },
  { city: 'Mixco', dept: 'Sacatepéquez', shouldMatch: false }
];

validationTests.forEach(test => {
  const result = isCityInDepartment(test.city, test.dept);
  const passed = result === test.shouldMatch;
  
  console.log(`${passed ? '✅' : '❌'} ${test.city} en ${test.dept}: ${result} (esperado: ${test.shouldMatch})`);
  if (!passed) validationErrors++;
});

if (validationErrors === 0) {
  console.log('\n🎉 ¡Todas las validaciones pasaron exitosamente!');
} else {
  console.log(`\n⚠️  Se encontraron ${validationErrors} errores de validación`);
}

console.log('\n');

// ===================================================================
// PRUEBA 5: Casos específicos de uso común
// ===================================================================
console.log('🎯 PRUEBA 5: Casos específicos de uso común');
console.log('='.repeat(50));

const commonUseCases = [
  'Guatemala',           // Capital (debería detectar departamento Guatemala)
  'Xela',               // Nombre coloquial (no debería detectar)
  'Antigua',            // Nombre corto (no debería detectar)
  'Quetzaltenango',     // Nombre completo (debería detectar)
  'Ciudad de Guatemala', // Variación del nombre (no debería detectar exactamente)
  'Puerto Barrios',     // Dos palabras (debería detectar Izabal)
  'San Marcos',         // Mismo nombre que departamento (debería detectar)
  'santa cruz del quiche', // Minúsculas (debería detectar con normalización)
  'COBAN',              // Mayúsculas (debería detectar con normalización)
  'San Pedro Sacatepéquez' // Ambiguo (está en Guatemala y San Marcos)
];

commonUseCases.forEach(city => {
  const normalized = normalizeGeographicInfo({ city, department: null, pais: null });
  console.log(`🏙️  "${city}" → Dept: ${normalized.department || 'NO DETECTADO'}, País: ${normalized.pais || 'NO DETECTADO'}`);
});

console.log('\n🏁 PRUEBAS COMPLETADAS');
console.log('='.repeat(50));
console.log('ℹ️  La normalización geográfica está lista para mejorar');
console.log('   la detección de departamentos en el sistema de coberturas.'); 