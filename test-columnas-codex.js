/**
 * Test para verificar que las columnas del codex están corregidas
 */

const { agentesService } = require('./server/services/agentesService');

const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'admin'
};

async function testColumnasCodex() {
  console.log('🔧 Probando corrección de columnas en codex_items...\n');

  try {
    // Prueba que debería activar Robert y acceder al codex
    console.log('📝 Probando: "me puedes revisar si tengo algo de LGBT en mi codex?"');
    const result = await agentesService.processUserQuery('me puedes revisar si tengo algo de LGBT en mi codex?', TEST_USER);
    
    console.log(`✅ Respuesta: "${result.response.message}"`);
    console.log(`🎯 Intención: ${result.metadata.intent}`);
    console.log(`🔧 Modo: ${result.metadata.mode}`);
    console.log(`📨 Agente: ${result.response.agent}`);
    console.log(`⚡ Tiempo: ${result.metadata.processingTime}ms`);
    
    if (result.response.error) {
      console.log(`❌ Error: ${result.response.error}`);
      console.log(`📝 Detalles: ${result.response.details}`);
      
      if (result.response.details && result.response.details.includes('42703')) {
        console.error('💥 Aún hay problemas con las columnas');
      } else if (result.response.details && result.response.details.includes('title')) {
        console.error('💥 La columna "title" aún no se corrigió');
      } else if (result.response.details && result.response.details.includes('type')) {
        console.error('💥 La columna "type" aún no se corrigió');
      } else if (result.response.details && result.response.details.includes('category')) {
        console.error('💥 La columna "category" aún no se corrigió');
      }
    } else {
      console.log(`✅ ¡Sin errores de columnas! Las correcciones funcionaron.`);
    }
    
  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    
    if (error.message.includes('42703')) {
      console.error('💥 Error 42703: Aún hay columnas incorrectas');
    }
  }
}

testColumnasCodex(); 