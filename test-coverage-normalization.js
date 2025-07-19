// ===================================================================
// SCRIPT DE PRUEBA PARA NORMALIZACIÓN GEOGRÁFICA EN COVERAGES
// Verifica que la integración con mapsAgent funcione correctamente
// ===================================================================

const { normalizeGeographicInfo } = require('./server/services/mapsAgent');

// Datos de prueba
const testLocations = [
  { city: 'Xeputul 2', department: null, pais: 'Guatemala' },
  { city: 'Ixquisis', department: null, pais: 'Guatemala' },
  { city: 'Quisaché', department: null, pais: 'Guatemala' },
  { city: 'Cidabenque', department: null, pais: 'Guatemala' },
  { city: 'Chana', department: null, pais: 'Guatemala' },
  { city: 'Xela', department: null, pais: 'Guatemala' },
  { city: 'Antigua', department: null, pais: 'Guatemala' },
  { city: 'Departamento de Comisión Bancaria', department: null, pais: 'Guatemala' },
  { city: 'Guatemala', department: null, pais: 'Guatemala' },
  { city: 'Cobán', department: null, pais: 'Guatemala' }
];

console.log('🧪 PRUEBA DE NORMALIZACIÓN GEOGRÁFICA EN COVERAGES');
console.log('='.repeat(60));

async function testNormalization() {
  for (let i = 0; i < testLocations.length; i++) {
    const location = testLocations[i];
    
    console.log(`\n${i + 1}. Probando: "${location.city}"`);
    console.log(`   Entrada: ${JSON.stringify(location)}`);
    
    try {
      const normalized = normalizeGeographicInfo(location);
      console.log(`   ✅ Salida: ${JSON.stringify(normalized)}`);
      
      // Verificar si se detectó departamento
      if (!location.department && normalized.department) {
        console.log(`   🎯 Departamento detectado: ${normalized.department}`);
      }
      
      // Verificar si es una localidad válida
      if (normalized.city && normalized.department && normalized.pais) {
        console.log(`   ✅ Ubicación completa y válida`);
      } else if (location.city === 'Departamento de Comisión Bancaria') {
        console.log(`   ⚠️  Texto no geográfico detectado correctamente`);
      } else {
        console.log(`   ⚠️  Información incompleta`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 PRUEBA COMPLETADA');
  console.log('📋 Ahora puedes probar en el frontend:');
  console.log('   1. Crear una nueva cobertura con cualquiera de estas ubicaciones');
  console.log('   2. Usar el endpoint /api/coverages/normalize-location');
  console.log('   3. Verificar que se detecten y normalicen correctamente');
}

// Ejecutar prueba
testNormalization().catch(console.error); 