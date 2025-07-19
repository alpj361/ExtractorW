const dotenv = require('dotenv');
dotenv.config();

// Importar el servicio de agentes (es una instancia, no una clase)
const agentesService = require('./server/services/agentesService');

async function testOptimizedPipeline() {
  console.log('🧪 PRUEBA: Pipeline Híbrido OPTIMIZADO - Detención Temprana');
  console.log('========================================================');
  
  // Test case que debería encontrar resultado rápidamente
  const testCases = [
    {
      name: 'Diego España',
      context: 'periodista guatemalteco',
      sector: 'medios',
      description: 'Caso que debería resolverse con Perplexity'
    },
    {
      name: 'Juan Pérez',
      context: 'persona ficticia',
      sector: 'test',
      description: 'Caso que debería activar múltiples estrategias'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🔍 PROBANDO: ${testCase.description}`);
    console.log(`📝 Nombre: ${testCase.name}`);
    console.log(`⏰ Inicio: ${new Date().toISOString()}`);
    
    const startTime = Date.now();
    
    try {
      const result = await agentesService.resolveTwitterHandle(
        {
          name: testCase.name,
          context: testCase.context,
          sector: testCase.sector
        },
        { id: 'test-user' }
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️ Duración: ${duration}ms (${(duration/1000).toFixed(1)}s)`);
      console.log(`📊 Resultado:`, JSON.stringify(result, null, 2));
      
      // Verificar que se detuvo temprano si encontró resultado confiable
      if (result.success && result.confidence >= 7) {
        console.log(`✅ ÉXITO: Se detuvo temprano con alta confianza (${result.confidence})`);
        if (result.method === 'perplexity_direct') {
          console.log(`🎯 ÓPTIMO: Resuelto solo con Perplexity`);
        } else if (result.method === 'gpt4_web_search') {
          console.log(`🎯 BUENO: Resuelto con GPT-4 fallback`);
        }
      } else {
        console.log(`⚠️ FALLBACK: Tuvo que usar estrategias múltiples`);
      }
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`❌ ERROR después de ${duration}ms:`, error.message);
    }
    
    console.log('─'.repeat(50));
  }
}

// Función para mostrar log de rendimiento
function logPerformanceMetrics() {
  console.log(`\n📈 MÉTRICAS ESPERADAS:`);
  console.log(`✅ Caso exitoso: ~3-5 segundos (solo Perplexity)`);
  console.log(`⚠️ Caso fallback: ~10-15 segundos (Perplexity + GPT-4)`);
  console.log(`❌ Caso múltiple: ~30+ segundos (todas las estrategias)`);
  console.log(`\n🎯 OBJETIVO: Minimizar casos que lleguen a estrategias múltiples\n`);
}

// Ejecutar prueba
if (require.main === module) {
  logPerformanceMetrics();
  testOptimizedPipeline()
    .then(() => {
      console.log('\n✅ Prueba completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error en prueba:', error);
      process.exit(1);
    });
}

module.exports = { testOptimizedPipeline }; 