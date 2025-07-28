/**
 * Prueba rápida del sistema LLM híbrido
 */

const { agentesService } = require('./server/services/agentesService');

const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'admin'
};

async function quickTest() {
  console.log('🚀 Ejecutando prueba rápida del sistema LLM híbrido mejorado...\n');

  try {
    // Prueba 1: Saludo
    console.log('📝 Prueba 1: "hola"');
    const result1 = await agentesService.processUserQuery('hola', TEST_USER);
    console.log(`✅ Respuesta: "${result1.response.message}"`);
    console.log(`🎯 Intención: ${result1.metadata.intent}`);
    console.log(`🔧 Modo: ${result1.metadata.mode}`);
    console.log(`📨 Agente: ${result1.response.agent}`);
    console.log(`⚡ Tiempo: ${result1.metadata.processingTime}ms\n`);

    // Prueba 2: Pregunta sobre capacidades
    console.log('📝 Prueba 2: "en que me puedes ayudar?"');
    const result2 = await agentesService.processUserQuery('en que me puedes ayudar?', TEST_USER);
    console.log(`✅ Respuesta: "${result2.response.message}"`);
    console.log(`🎯 Intención: ${result2.metadata.intent}`);
    console.log(`🔧 Modo: ${result2.metadata.mode}`);
    console.log(`📨 Agente: ${result2.response.agent}`);
    console.log(`⚡ Tiempo: ${result2.metadata.processingTime}ms\n`);

    // Prueba 3: Solicitud de ayuda
    console.log('📝 Prueba 3: "ayuda"');
    const result3 = await agentesService.processUserQuery('ayuda', TEST_USER);
    console.log(`✅ Respuesta: "${result3.response.message}"`);
    console.log(`🎯 Intención: ${result3.metadata.intent}`);
    console.log(`🔧 Modo: ${result3.metadata.mode}`);
    console.log(`📨 Agente: ${result3.response.agent}`);
    console.log(`⚡ Tiempo: ${result3.metadata.processingTime}ms\n`);

    // Prueba 4: Query agéntico (debería llamar a Laura)
    console.log('📝 Prueba 4: "busca en twitter sobre guatemala"');
    const result4 = await agentesService.processUserQuery('busca en twitter sobre guatemala', TEST_USER);
    console.log(`✅ Respuesta: "${result4.response.message}"`);
    console.log(`🎯 Intención: ${result4.metadata.intent}`);
    console.log(`🔧 Modo: ${result4.metadata.mode}`);
    console.log(`📨 Agente: ${result4.response.agent}`);
    console.log(`⚡ Tiempo: ${result4.metadata.processingTime}ms\n`);

    console.log('🎉 ¡Todas las pruebas completadas exitosamente!');
    console.log('💡 Nota: Las respuestas conversacionales ahora evitan la carga de agentes');
    
  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    console.error('Stack:', error.stack);
  }
}

quickTest(); 