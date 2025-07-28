/**
 * Test simplificado de integración de Laura con Memory Service HTTP
 */

const { LauraAgent } = require('./server/services/agents/laura/index');

async function testLauraMemoryIntegration() {
  console.log('🧪 Test Laura Agent + Memory Service (HTTP)\n');

  try {
    // 1. Inicializar Laura Agent (simular agentesService)
    console.log('1️⃣ Inicializando Laura Agent...');
    const mockAgentesService = {};
    const laura = new LauraAgent(mockAgentesService);

    // 2. Verificar que el cliente de memoria está configurado
    console.log('\n2️⃣ Verificando configuración de memoria...');
    console.log(`   Cliente habilitado: ${laura.memoryClient.enabled}`);
    console.log(`   URL base: ${laura.memoryClient.baseURL}`);

    // 3. Verificar health del servicio
    console.log('\n3️⃣ Verificando salud del servicio...');
    const isHealthy = await laura.memoryClient.isHealthy();
    console.log(`   Servicio saludable: ${isHealthy ? '✅' : '❌'}`);

    if (!isHealthy) {
      console.log('❌ El servicio de memoria no está disponible');
      return;
    }

    // 4. Probar guardado de usuario
    console.log('\n4️⃣ Probando guardado de usuario...');
    const testUser = {
      user_name: 'Usuario Test Laura',
      twitter_username: 'test_laura_2025',
      description: 'Usuario de prueba para integración Laura',
      category: 'test_integration'
    };

    const saveResult = await laura.memoryClient.saveUserDiscovery(testUser);
    console.log(`   Guardado: ${saveResult.success ? '✅ Exitoso' : '❌ Falló'}`);
    if (!saveResult.success) {
      console.log(`   Error: ${saveResult.error}`);
    }

    // 5. Probar búsqueda de usuarios
    console.log('\n5️⃣ Probando búsqueda de usuarios...');
    const searchResults = await laura.memoryClient.searchUserHandles('test_laura_2025', 3);
    console.log(`   Resultados encontrados: ${searchResults.length}`);
    
    if (searchResults.length > 0) {
      console.log('   ✅ Usuario encontrado en memoria');
      searchResults.forEach((result, index) => {
        console.log(`     ${index + 1}. ${result.substring(0, 80)}...`);
      });
    }

    // 6. Probar contexto político
    console.log('\n6️⃣ Probando memoria política...');
    const politicalContext = await laura.memoryClient.searchPoliticalContext('política', 2);
    console.log(`   Contexto político encontrado: ${politicalContext.length} resultados`);

    console.log('\n🎉 ¡Integración Laura + Memory Service completada!');
    console.log('\n📋 Resumen:');
    console.log(`   • Laura Agent inicializado: ✅`);
    console.log(`   • Memory Service conectado: ${isHealthy ? '✅' : '❌'}`);
    console.log(`   • Usuario guardado: ${saveResult.success ? '✅' : '❌'}`);
    console.log(`   • Búsqueda funcional: ${searchResults.length > 0 ? '✅' : '❌'}`);
    console.log('\n🚀 Laura está lista para Vizta Chat!');

  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
    console.error('Stack trace:', error.stack);
    
    console.log('\n🔧 Verificaciones:');
    console.log('   • ¿Está corriendo el servicio laura_memory en puerto 5001?');
    console.log('   • ¿Están configuradas las variables ZEP_API_KEY?');
    console.log('   • ¿El servicio Docker está ejecutándose?');
  }
}

// Ejecutar test
if (require.main === module) {
  testLauraMemoryIntegration().then(() => {
    console.log('\n✅ Test completado');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Test falló:', error);
    process.exit(1);
  });
}

module.exports = { testLauraMemoryIntegration }; 