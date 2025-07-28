/**
 * Test rápido para verificar que la corrección de tabla codex_items funciona
 */

const { agentesService } = require('./server/services/agentesService');

const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'admin'
};

async function testCodexFix() {
  console.log('🧪 Probando corrección de tabla codex_items...\n');

  try {
    // Prueba de consulta que debería activar Robert y acceder al codex
    console.log('📝 Probando: "busca en mi codex información sobre migración"');
    const result = await agentesService.processUserQuery('busca en mi codex información sobre migración', TEST_USER);
    
    console.log(`✅ Respuesta: "${result.response.message}"`);
    console.log(`🎯 Intención: ${result.metadata.intent}`);
    console.log(`🔧 Modo: ${result.metadata.mode}`);
    console.log(`📨 Agente: ${result.response.agent}`);
    
    if (result.response.error) {
      console.log(`❌ Error: ${result.response.error}`);
      console.log(`📝 Detalles: ${result.response.details}`);
    } else {
      console.log(`✅ ¡Sin errores de tabla! El fix funcionó.`);
    }
    
  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    
    if (error.message.includes('42P01') || error.message.includes('user_codex')) {
      console.error('💥 Aún hay referencias a user_codex que no se corrigieron');
    }
  }
}

testCodexFix(); 