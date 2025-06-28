require('dotenv').config();
const { processNitterContext } = require('./server/services/nitterContext');

async function testNitterContext() {
  console.log('🧪 PRUEBA DE NITTER_CONTEXT\n');

  // Datos de prueba
  const testQuery = 'Guatemala';
  const testUserId = 'test-user-123';
  const testSessionId = `test-session-${Date.now()}`;
  const testLocation = 'guatemala';
  const testLimit = 5;

  console.log('📋 Configuración de prueba:');
  console.log(`   Query: "${testQuery}"`);
  console.log(`   Usuario: ${testUserId}`);
  console.log(`   Sesión: ${testSessionId}`);
  console.log(`   Ubicación: ${testLocation}`);
  console.log(`   Límite: ${testLimit} tweets`);
  console.log('');

  // Verificar variables de entorno
  console.log('🔧 Verificando configuración:');
  console.log(`   EXTRACTOR_T_URL: ${process.env.EXTRACTOR_T_URL || 'http://localhost:8001'}`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ Configurado' : '❌ Faltante'}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Configurado' : '❌ Faltante'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Configurado' : '❌ Faltante'}`);
  console.log('');

  try {
    console.log('🚀 Iniciando prueba de nitter_context...\n');
    
    const startTime = Date.now();
    const result = await processNitterContext(
      testQuery,
      testUserId,
      testSessionId,
      testLocation,
      testLimit
    );
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    console.log('\n📊 RESULTADO DE LA PRUEBA:');
    console.log('='.repeat(50));
    
    if (result.success) {
      console.log('✅ ÉXITO: La herramienta funcionó correctamente');
      console.log('');
      console.log('📈 Métricas:');
      console.log(`   • Query procesado: "${result.data.query}"`);
      console.log(`   • Categoría detectada: ${result.data.categoria}`);
      console.log(`   • Tweets encontrados: ${result.data.tweets_found}`);
      console.log(`   • Engagement total: ${result.data.total_engagement}`);
      console.log(`   • Engagement promedio: ${result.data.avg_engagement}`);
      console.log(`   • Tiempo de ejecución: ${executionTime}ms`);
      console.log('');
      
      if (result.data.tweets && result.data.tweets.length > 0) {
        console.log('🐦 Muestra de tweets analizados:');
        result.data.tweets.forEach((tweet, index) => {
          console.log(`   ${index + 1}. @${tweet.usuario}`);
          console.log(`      📝 "${tweet.texto.substring(0, 80)}..."`);
          console.log(`      💭 Sentimiento: ${tweet.sentimiento} (${tweet.score_sentimiento})`);
          console.log(`      🎯 Intención: ${tweet.intencion_comunicativa}`);
          console.log(`      📊 Engagement: ${tweet.likes + tweet.retweets + tweet.replies}`);
          console.log(`      🏷️ Entidades: ${tweet.entidades_mencionadas.length}`);
          console.log('');
        });
      }
      
      console.log('📝 Resumen:');
      console.log(`   ${result.data.summary}`);
      
    } else {
      console.log('❌ ERROR: La herramienta falló');
      console.log(`   Mensaje: ${result.error}`);
      console.log(`   Tiempo de ejecución: ${executionTime}ms`);
      
      if (result.data) {
        console.log('   Datos parciales:');
        console.log(`     • Query: "${result.data.query}"`);
        console.log(`     • Tweets encontrados: ${result.data.tweets_found}`);
      }
    }

  } catch (error) {
    console.error('💥 ERROR INESPERADO:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n🏁 Prueba completada');
}

// Ejecutar prueba si es llamado directamente
if (require.main === module) {
  testNitterContext()
    .then(() => {
      console.log('\n✨ Script finalizado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { testNitterContext }; 