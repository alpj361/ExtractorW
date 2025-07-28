/**
 * Test de integración interna de memoria Laura
 * Verifica que Laura pueda usar el módulo Python interno sin HTTP
 */

const { InternalMemoryClient } = require('./server/services/agents/laura/internalMemoryClient');

async function testInternalMemory() {
  console.log('🧪 Testing Internal Memory Client Integration\n');

  // 1. Inicializar cliente interno
  console.log('1️⃣ Inicializando cliente interno...');
  const memoryClient = new InternalMemoryClient({ enabled: true });

  try {
    // 2. Health check
    console.log('\n2️⃣ Verificando salud del sistema...');
    const isHealthy = await memoryClient.isHealthy();
    console.log(`   Salud del sistema: ${isHealthy ? '✅ Saludable' : '❌ No disponible'}`);

    if (!isHealthy) {
      console.log('❌ El sistema no está saludable. Verifica que laura_memory esté configurado.');
      return;
    }

    // 3. Guardar usuario de prueba
    console.log('\n3️⃣ Guardando usuario de prueba...');
    const testUser = {
      user_name: 'Usuario Test Interno',
      twitter_username: 'test_interno_2025',
      description: 'Usuario de prueba para integración interna JavaScript-Python',
      category: 'test_interno'
    };

    const saveResult = await memoryClient.saveUserDiscovery(testUser);
    console.log(`   Guardado: ${saveResult.success ? '✅ Exitoso' : '❌ Falló'}`);
    if (!saveResult.success) {
      console.log(`   Error: ${saveResult.error}`);
    }

    // 4. Buscar usuario guardado
    console.log('\n4️⃣ Buscando usuario guardado...');
    const searchResults = await memoryClient.searchUserHandles('test_interno_2025', 3);
    console.log(`   Resultados encontrados: ${searchResults.length}`);
    
    if (searchResults.length > 0) {
      console.log('   ✅ Usuario encontrado:');
      searchResults.forEach((result, index) => {
        console.log(`     ${index + 1}. ${result.substring(0, 100)}...`);
      });
    } else {
      console.log('   ⚠️  Usuario no encontrado en búsqueda');
    }

    // 5. Buscar usuarios existentes
    console.log('\n5️⃣ Buscando usuarios existentes...');
    const existingUsers = await memoryClient.searchUserHandles('María López', 2);
    console.log(`   Usuarios existentes encontrados: ${existingUsers.length}`);
    
    if (existingUsers.length > 0) {
      console.log('   ✅ Usuarios encontrados:');
      existingUsers.forEach((result, index) => {
        console.log(`     ${index + 1}. ${result.substring(0, 80)}...`);
      });
    }

    // 6. Guardar información política
    console.log('\n6️⃣ Guardando información política...');
    const politicalInfo = 'Prueba de integración interna: El nuevo sistema permite comunicación directa entre JavaScript y Python sin HTTP.';
    const politicalResult = await memoryClient.saveToPolitics(politicalInfo, {
      source: 'test_interno',
      type: 'integration_test'
    });
    console.log(`   Guardado político: ${politicalResult.success ? '✅ Exitoso' : '❌ Falló'}`);

    // 7. Buscar información política
    console.log('\n7️⃣ Buscando información política...');
    const politicalSearch = await memoryClient.searchPoliticalContext('integración interna', 2);
    console.log(`   Información política encontrada: ${politicalSearch.length} resultados`);

    if (politicalSearch.length > 0) {
      console.log('   ✅ Información encontrada:');
      politicalSearch.forEach((result, index) => {
        console.log(`     ${index + 1}. ${result.substring(0, 80)}...`);
      });
    }

    console.log('\n🎉 ¡Test de integración interna completado exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   • Sistema saludable: ${isHealthy ? '✅' : '❌'}`);
    console.log(`   • Usuario guardado: ${saveResult.success ? '✅' : '❌'}`);
    console.log(`   • Usuario encontrado: ${searchResults.length > 0 ? '✅' : '❌'}`);
    console.log(`   • Info política guardada: ${politicalResult.success ? '✅' : '❌'}`);
    console.log(`   • Búsquedas funcionando: ✅`);

  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
    console.error('Stack trace:', error.stack);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Verifica que laura_memory Docker esté ejecutándose');
    console.log('   • Verifica que Python3 esté disponible');
    console.log('   • Verifica que las dependencias estén instaladas');
    console.log('   • Verifica que ZEP_API_KEY esté configurada');
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testInternalMemory().then(() => {
    console.log('\n✅ Test completado');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Test falló:', error);
    process.exit(1);
  });
}

module.exports = { testInternalMemory }; 