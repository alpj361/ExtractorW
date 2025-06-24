// ===================================================================
// SCRIPT DE PRUEBA PARA DETECCIÓN GEOGRÁFICA CON IA
// Verifica que Gemini AI pueda detectar departamentos correctamente
// ===================================================================

const { 
  detectGeographyWithAI, 
  normalizeGeographicInfoWithAI,
  batchNormalizeGeography,
  getCacheStats,
  clearGeographyCache
} = require('./server/utils/geographic-ai-detector');

async function runTests() {
  console.log('🧪 INICIANDO PRUEBAS DE DETECCIÓN GEOGRÁFICA CON IA\n');

  // ===================================================================
  // PRUEBA 1: Detección individual con IA
  // ===================================================================
  console.log('🤖 PRUEBA 1: Detección individual con Gemini AI');
  console.log('='.repeat(60));

  const testCities = [
    'Antigua Guatemala',
    'Quetzaltenango', 
    'Cobán',
    'Puerto Barrios',
    'Chiquimula'
  ];

  for (const city of testCities) {
    try {
      console.log(`\n🔍 Detectando: ${city}`);
      const result = await detectGeographyWithAI(city);
      
      if (result) {
        console.log(`✅ Resultado:`, {
          ciudad: result.city,
          departamento: result.department,
          país: result.country,
          confianza: result.confidence
        });
      } else {
        console.log(`❌ No se pudo detectar información para: ${city}`);
      }
      
      // Pequeña pausa para no sobrecargar la API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error detectando ${city}:`, error.message);
    }
  }

  console.log('\n');

  // ===================================================================
  // PRUEBA 2: Normalización híbrida (IA + fallback manual)
  // ===================================================================
  console.log('🔄 PRUEBA 2: Normalización híbrida');
  console.log('='.repeat(60));

  const testCases = [
    { 
      input: { city: 'Antigua Guatemala', department: null, pais: null },
      description: 'Ciudad famosa, IA debería detectar Sacatepéquez'
    },
    { 
      input: { city: 'Cobán', department: null, pais: null },
      description: 'Capital departamental, IA debería detectar Alta Verapaz'
    }
  ];

  for (const [index, testCase] of testCases.entries()) {
    try {
      console.log(`\n🧪 Caso ${index + 1}: ${testCase.description}`);
      console.log(`   Entrada:`, testCase.input);
      
      const result = await normalizeGeographicInfoWithAI(testCase.input);
      
      console.log(`   Resultado:`, {
        ciudad: result.city,
        departamento: result.department,
        país: result.pais,
        método: result.detection_method,
        confianza: result.confidence
      });
      
      // Pausa entre casos
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error en caso ${index + 1}:`, error.message);
    }
  }

  console.log('\n🏁 PRUEBAS COMPLETADAS');
  console.log('='.repeat(60));
  console.log('ℹ️  El sistema de detección geográfica con IA está listo.');
}

// Ejecutar las pruebas
runTests().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error.message);
  process.exit(1);
}); 