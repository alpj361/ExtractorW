/**
 * Script de Prueba del Sistema Modular de Agentes
 * Permite probar Vizta desde el backend con diferentes tipos de consultas
 */

const agentesService = require('./server/services/agentesService');

// Mock de usuario para testing
const testUser = {
  id: 'test-user-123',
  name: 'Usuario de Prueba',
  email: 'test@example.com'
};

// Función para ejecutar prueba
async function testQuery(userMessage, description = '') {
  console.log('\n' + '='.repeat(80));
  console.log(`🧪 PRUEBA: ${description || userMessage}`);
  console.log('='.repeat(80));
  console.log(`📝 Query: "${userMessage}"`);
  console.log('');
  
  try {
    const startTime = Date.now();
    
    // Usar el nuevo método del sistema modular
    const result = await agentesService.processUserQuery(userMessage, testUser);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`⏱️  Tiempo de procesamiento: ${processingTime}ms`);
    console.log(`🎯 Conversación ID: ${result.conversationId}`);
    console.log(`📊 Agentes involucrados: ${result.metadata?.agentsInvolved?.join(', ') || 'N/A'}`);
    
    if (result.response?.success !== false) {
      console.log('✅ ÉXITO');
      console.log(`🤖 Agente: ${result.response?.agent}`);
      console.log(`💬 Respuesta:\n${result.response?.message || JSON.stringify(result.response, null, 2)}`);
    } else {
      console.log('❌ ERROR');
      console.log(`🚨 Error: ${result.response?.error}`);
      console.log(`💬 Mensaje: ${result.response?.message}`);
    }
    
    if (result.metadata?.error) {
      console.log(`⚠️  Metadata de error: ${JSON.stringify(result.metadata, null, 2)}`);
    }
    
  } catch (error) {
    console.log('💥 EXCEPCIÓN');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`);
  }
}

// Función principal de testing
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA MODULAR DE AGENTES');
  console.log(`📅 Fecha: ${new Date().toLocaleString()}`);
  
  try {
    // Verificar que el sistema esté inicializado
    const stats = agentesService.getSystemStats();
    console.log('📊 Estadísticas del sistema:');
    console.log(JSON.stringify(stats, null, 2));
    
    // Test 1: Saludo simple
    await testQuery('hola', 'Saludo básico - Respuesta directa de Vizta');
    
    // Test 2: Pregunta casual
    await testQuery('cómo estás', 'Conversación casual - Respuesta directa de Vizta');
    
    // Test 3: Solicitar ayuda
    await testQuery('ayuda', 'Solicitud de ayuda - Respuesta directa de Vizta');
    
    // Test 4: Consulta social (Laura)
    await testQuery('analiza los tweets sobre el congreso', 'Consulta social - Routing a Laura');
    
    // Test 5: Consulta personal (Robert)
    await testQuery('muéstrame mis proyectos', 'Consulta personal - Routing a Robert');
    
    // Test 6: Consulta política con contexto
    await testQuery('¿qué dice el presidente Giammattei?', 'Consulta política - Laura con PulsePolitics');
    
    // Test 7: Consulta mixta
    await testQuery('investiga el congreso y relacionalo con mis documentos', 'Consulta mixta - Múltiples agentes');
    
    // Test 8: Consulta ambigua
    await testQuery('información sobre Guatemala', 'Consulta ambigua - Fallback');
    
  } catch (error) {
    console.error('💥 Error en las pruebas:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 PRUEBAS COMPLETADAS');
  console.log('='.repeat(80));
}

// Función para pruebas interactivas
async function interactiveMode() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n🎮 MODO INTERACTIVO ACTIVADO');
  console.log('Escribe tus consultas y presiona Enter. Escribe "exit" para salir.\n');
  
  const askQuestion = () => {
    rl.question('Vizta> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('👋 ¡Hasta luego!');
        rl.close();
        return;
      }
      
      if (input.trim()) {
        await testQuery(input, 'Consulta interactiva');
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// Manejo de argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.includes('--interactive') || args.includes('-i')) {
  interactiveMode();
} else if (args.length > 0) {
  // Ejecutar consulta específica
  const query = args.join(' ');
  testQuery(query, 'Consulta desde línea de comandos').then(() => {
    console.log('\n✅ Prueba completada');
    process.exit(0);
  });
} else {
  // Ejecutar suite de pruebas completa
  runTests().then(() => {
    console.log('\n🎯 Para modo interactivo: node test-modular-system.js --interactive');
    console.log('🎯 Para consulta específica: node test-modular-system.js "tu consulta aquí"');
    process.exit(0);
  });
}

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
}); 