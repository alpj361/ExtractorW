/**
 * Prueba solo del módulo interno de memoria (Python)
 * Sin dependencias de servicios HTTP externos
 */

require('dotenv').config();

const { InternalMemoryClient } = require('./server/services/agents/laura/internalMemoryClient');

async function testInternalMemoryOnly() {
  console.log('🧪 === PRUEBA MÓDULO INTERNO DE MEMORIA ===\n');
  
  try {
    // Inicializar cliente interno
    const memoryClient = new InternalMemoryClient({ enabled: true });
    
    console.log('🔍 1. Probando búsqueda en UserHandles...');
    const searchResults = await memoryClient.searchUserHandles('Mario López', 3);
    console.log('Resultados de búsqueda:', searchResults);
    
    console.log('\n💾 2. Probando guardar usuario en UserHandles...');
    const saveResult = await memoryClient.saveUserDiscovery({
      user_name: 'Test User',
      twitter_username: 'testuser123',
      description: 'Usuario de prueba',
      category: 'test'
    }, {
      discovery_type: 'test',
      context: 'testing'
    });
    
    console.log('Resultado de guardado:', saveResult);
    
    console.log('\n🔍 3. Verificando que se guardó correctamente...');
    const verifyResults = await memoryClient.searchUserHandles('Test User', 3);
    console.log('Resultados de verificación:', verifyResults);
    
    console.log('\n📊 4. Obteniendo estadísticas...');
    const result = await memoryClient.executePythonCommand('get_stats', {});
    console.log('Estadísticas:', result);
    
    console.log('\n✅ Prueba del módulo interno completada!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

if (require.main === module) {
  testInternalMemoryOnly().catch(console.error);
}

module.exports = { testInternalMemoryOnly };