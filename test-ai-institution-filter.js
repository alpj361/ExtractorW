// ===================================================================
// SCRIPT DE PRUEBA PARA FILTRO DE INSTITUCIONES CON IA
// Verifica que la IA clasifique correctamente ubicaciones vs instituciones
// ===================================================================

const { isInstitutionNotLocationWithAI, normalizeGeographicInfo } = require('./server/services/mapsAgent');

// Datos de prueba
const testCases = [
  // UBICACIONES GEOGRÁFICAS (deben retornar false)
  { text: 'Guatemala', expected: false, type: 'país' },
  { text: 'Quetzaltenango', expected: false, type: 'departamento' },
  { text: 'Huehuetenango', expected: false, type: 'departamento' },
  { text: 'Xeputul 2', expected: false, type: 'aldea' },
  { text: 'Ixquisis', expected: false, type: 'comunidad' },
  { text: 'Quisaché', expected: false, type: 'aldea' },
  { text: 'Antigua Guatemala', expected: false, type: 'ciudad' },
  { text: 'Puerto Barrios', expected: false, type: 'ciudad' },
  
  // INSTITUCIONES (deben retornar true)
  { text: 'Departamento de normativa bancaria', expected: true, type: 'institución' },
  { text: 'Comisión de Agricultura', expected: true, type: 'institución' },
  { text: 'Ministerio de Finanzas', expected: true, type: 'institución' },
  { text: 'Banco Central', expected: true, type: 'institución' },
  { text: 'Departamento de Recursos Humanos', expected: true, type: 'institución' },
  { text: 'Comisión Nacional Electoral', expected: true, type: 'institución' },
  { text: 'Superintendencia de Bancos', expected: true, type: 'institución' },
  { text: 'Dirección General de Migración', expected: true, type: 'institución' },
];

// Test de clasificación individual
async function testInstitutionClassification() {
  console.log('🧪 === TEST DE CLASIFICACIÓN DE INSTITUCIONES CON IA ===\n');
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    try {
      console.log(`\n🔍 Probando: "${testCase.text}" (${testCase.type})`);
      
      const result = await isInstitutionNotLocationWithAI(testCase.text);
      const isCorrect = result === testCase.expected;
      
      if (isCorrect) {
        console.log(`✅ CORRECTO: ${result ? 'INSTITUCIÓN' : 'GEOGRÁFICO'}`);
        passedTests++;
      } else {
        console.log(`❌ INCORRECTO: Esperado ${testCase.expected ? 'INSTITUCIÓN' : 'GEOGRÁFICO'}, obtuvo ${result ? 'INSTITUCIÓN' : 'GEOGRÁFICO'}`);
      }
      
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
    }
  }
  
  console.log(`\n📊 === RESULTADOS ===`);
  console.log(`✅ Pruebas pasadas: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
  
  return passedTests === totalTests;
}

// Test de normalización completa
async function testCompleteNormalization() {
  console.log('\n\n🗺️ === TEST DE NORMALIZACIÓN COMPLETA ===\n');
  
  const normalizationTests = [
    { 
      input: { city: 'Departamento de normativa bancaria', department: null, pais: 'Guatemala' },
      description: 'Institución como ciudad'
    },
    { 
      input: { city: 'Xeputul 2', department: null, pais: 'Guatemala' },
      description: 'Aldea guatemalteca'
    },
    { 
      input: { city: null, department: 'Comisión de Agricultura', pais: 'Guatemala' },
      description: 'Institución como departamento'
    },
    { 
      input: { city: 'Quetzaltenango', department: null, pais: 'Guatemala' },
      description: 'Ciudad guatemalteca'
    }
  ];
  
  for (const test of normalizationTests) {
    try {
      console.log(`\n🔄 Probando: ${test.description}`);
      console.log(`   Entrada: ${JSON.stringify(test.input)}`);
      
      const result = await normalizeGeographicInfo(test.input);
      
      console.log(`   Resultado:`);
      console.log(`     Ciudad: ${result.city || 'null'}`);
      console.log(`     Departamento: ${result.department || 'null'}`);
      console.log(`     País: ${result.pais || 'null'}`);
      console.log(`     Método: ${result.detection_method}`);
      console.log(`     Confianza: ${result.confidence}`);
      
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
    }
  }
}

// Ejecutar todas las pruebas
async function runAllTests() {
  try {
    const classificationPassed = await testInstitutionClassification();
    await testCompleteNormalization();
    
    console.log('\n\n🎯 === RESUMEN FINAL ===');
    if (classificationPassed) {
      console.log('✅ Sistema de filtrado de instituciones funcionando correctamente');
      console.log('✅ Las instituciones serán rechazadas automáticamente');
      console.log('✅ Las ubicaciones geográficas serán procesadas normalmente');
    } else {
      console.log('❌ Sistema necesita ajustes en la clasificación');
    }
    
  } catch (error) {
    console.error('💥 Error ejecutando pruebas:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests();
}

module.exports = { testInstitutionClassification, testCompleteNormalization }; 