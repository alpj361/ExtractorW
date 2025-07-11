require('dotenv').config();
const { geminiChat } = require('./server/services/geminiHelper');

/**
 * Prueba simple del helper de Gemini 2.5 Flash
 */
async function testGeminiHelper() {
  console.log('🧪 Iniciando prueba simple del helper de Gemini 2.5 Flash\n');

  // Verificar que la API key esté configurada
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY no está configurada en .env');
    console.log('📋 Para configurar:');
    console.log('   1. Visita https://aistudio.google.com/app/apikey');
    console.log('   2. Crea una nueva API key');
    console.log('   3. Agrega GEMINI_API_KEY=tu_key_aqui a tu archivo .env');
    return;
  }

  try {
    // Test básico
    console.log('📋 Test 1: Respuesta básica');
    const messages1 = [
      { role: 'system', content: 'Eres un asistente útil. Responde con JSON válido.' },
      { role: 'user', content: 'Responde con {"test": "exitoso", "timestamp": "' + new Date().toISOString() + '"}' }
    ];

    const startTime = Date.now();
    const response1 = await geminiChat(messages1);
    const endTime = Date.now();

    console.log('✅ Respuesta:', response1);
    console.log('⏱️  Latencia:', (endTime - startTime) + 'ms');

    // Test del formato del motor de razonamiento
    console.log('\n📋 Test 2: Formato motor de razonamiento');
    const messages2 = [
      { role: 'system', content: 'Eres Laura, experta en análisis de tendencias. Responde SOLO con JSON válido.' },
      { role: 'user', content: 'Intent: ¿Qué dicen sobre sismos en Guatemala?' }
    ];

    const startTime2 = Date.now();
    const response2 = await geminiChat(messages2, { temperature: 0.2 });
    const endTime2 = Date.now();

    console.log('✅ Respuesta:', response2);
    console.log('⏱️  Latencia:', (endTime2 - startTime2) + 'ms');

    // Intentar parsear como JSON
    try {
      const parsed = JSON.parse(response2);
      console.log('✅ JSON válido parseado:', parsed);
    } catch (e) {
      console.log('⚠️  Respuesta no es JSON válido:', e.message);
    }

    console.log('\n🎉 Pruebas del helper completadas exitosamente');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('💡 Verifica que tu GEMINI_API_KEY sea válida');
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testGeminiHelper()
    .then(() => {
      console.log('\n✅ Pruebas completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { testGeminiHelper };