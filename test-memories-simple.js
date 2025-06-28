require('dotenv').config();
const memoriesService = require('./server/services/memories');

// ===================================================================
// SCRIPT DE PRUEBA SIMPLE: MEMORIES SERVICE
// Prueba directa del servicio de memories sin servidor
// ===================================================================

async function testMemoriesService() {
  console.log('🧪 PROBANDO SERVICIO DE MEMORIES');
  console.log('================================');

  try {
    // Test data
    const testUserId = '85c93b4b-455e-450b-9d01-e18f9e8dfaaa'; // Tu user ID
    const testSessionId = `test-session-${Date.now()}`;

    console.log(`📱 Session ID de prueba: ${testSessionId}`);
    console.log(`👤 User ID de prueba: ${testUserId}`);

    // ==========================================
    // PRUEBA 1: Guardar mensaje de usuario
    // ==========================================
    console.log('\n1️⃣ Guardando mensaje de usuario...');
    
    const userMessage = await memoriesService.saveMessage({
      sessionId: testSessionId,
      userId: testUserId,
      role: 'user',
      content: 'Hola, ¿cómo estás?',
      messageType: 'message',
      modelUsed: 'gpt-4o-mini',
      metadata: { test: true, requestId: 'test-123' }
    });

    console.log('✅ Mensaje de usuario guardado:', userMessage.id);

    // ==========================================
    // PRUEBA 2: Guardar mensaje de asistente
    // ==========================================
    console.log('\n2️⃣ Guardando mensaje de asistente...');
    
    const assistantMessage = await memoriesService.saveMessage({
      sessionId: testSessionId,
      userId: testUserId,
      role: 'assistant',
      content: '¡Hola! Estoy muy bien, gracias por preguntar. ¿En qué puedo ayudarte hoy?',
      messageType: 'message',
      tokensUsed: 25,
      modelUsed: 'gpt-4o-mini',
      toolsUsed: [],
      contextSources: [],
      metadata: { test: true, requestId: 'test-123', responseType: 'direct' }
    });

    console.log('✅ Mensaje de asistente guardado:', assistantMessage.id);

    // ==========================================
    // PRUEBA 3: Obtener mensajes de la sesión
    // ==========================================
    console.log('\n3️⃣ Obteniendo mensajes de la sesión...');
    
    const sessionMessages = await memoriesService.getSessionMessages(testSessionId, 10);
    
    console.log(`✅ ${sessionMessages.length} mensajes obtenidos:`);
    sessionMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
    });

    // ==========================================
    // PRUEBA 4: Formatear mensajes para OpenAI
    // ==========================================
    console.log('\n4️⃣ Formateando mensajes para OpenAI...');
    
    const formattedMessages = memoriesService.formatMessagesForOpenAI(sessionMessages);
    
    console.log(`✅ ${formattedMessages.length} mensajes formateados:`);
    formattedMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });

    // ==========================================
    // PRUEBA 5: Obtener sesiones del usuario
    // ==========================================
    console.log('\n5️⃣ Obteniendo sesiones del usuario...');
    
    const userSessions = await memoriesService.getUserSessions(testUserId, 5);
    
    console.log(`✅ ${userSessions.length} sesiones obtenidas:`);
    userSessions.forEach((session, index) => {
      console.log(`   ${index + 1}. ${session.sessionId.substring(0, 8)}... - "${session.firstMessage.substring(0, 30)}..." (${session.messageCount} mensajes)`);
    });

    // ==========================================
    // PRUEBA 6: Obtener estadísticas
    // ==========================================
    console.log('\n6️⃣ Obteniendo estadísticas de memoria...');
    
    const stats = await memoriesService.getUserMemoryStats(testUserId);
    
    console.log('✅ Estadísticas obtenidas:');
    console.log(`   📊 Total de mensajes: ${stats.totalMessages}`);
    console.log(`   📊 Total de sesiones: ${stats.totalSessions}`);
    console.log(`   📊 Total de tokens: ${stats.totalTokens}`);
    console.log(`   📊 Mensajes de usuario: ${stats.userMessages}`);
    console.log(`   📊 Mensajes de asistente: ${stats.assistantMessages}`);
    console.log(`   📊 Modelos usados: ${stats.modelsUsed.join(', ')}`);

    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('============================================');
    console.log('💡 El servicio de memories está funcionando correctamente');

  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', error);
    
    if (error.code) {
      console.error('📄 Código de error:', error.code);
      console.error('📄 Mensaje:', error.message);
    }
    
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testMemoriesService();
}

module.exports = { testMemoriesService }; 