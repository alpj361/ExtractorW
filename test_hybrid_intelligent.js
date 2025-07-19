const { LauraAgent } = require('./server/services/agentesService');

// Test del pipeline Híbrido Inteligente - Perplexity + LLM Multi-Search + Auto-Extract
async function testHybridIntelligentPipeline() {
  console.log('🎯 INICIANDO TEST: Pipeline Híbrido Inteligente');
  console.log('Perplexity + LLM Multi-Search + Auto-Extract');
  console.log('==============================================\n');

  // Crear instancia de Laura
  const laura = new LauraAgent();

  // Test cases optimizados con las mejoras implementadas
  const testCases = [
    {
      name: 'Diego España',
      description: 'Persona real guatemalteca - test del prompt específico "¿Cuál es el perfil de X de..."'
    },
    {
      name: 'Bernardo Arévalo',
      description: 'Presidente conocido - debería encontrar handle rápidamente'
    },
    {
      name: '@DiegoEspana_',
      description: 'Handle directo - debería validar inmediatamente'
    },
    {
      name: 'Pia Flores',
      description: 'Periodista guatemalteca - test de fallback a GPT-4 Web Search'
    },
    {
      name: 'Persona Completamente Inventada 2025',
      description: 'Persona ficticia - debería devolver NONE con alta confianza'
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`🔍 PROBANDO: "${testCase.name}"`);
    console.log(`   Descripción: ${testCase.description}`);
    
    try {
      const startTime = Date.now();
      
      const result = await laura.resolveTwitterHandle({
        name: testCase.name,
        context: '',
        sector: ''
      }, null);
      
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ RESULTADO (${duration}ms):`);
      console.log(`      Success: ${result.success}`);
      console.log(`      Handle: ${result.handle || 'N/A'}`);
      console.log(`      Confidence: ${result.confidence || 0}`);
      console.log(`      Method: ${result.method}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
      
      results.push({
        input: testCase.name,
        success: result.success,
        handle: result.handle,
        confidence: result.confidence,
        method: result.method,
        duration: duration,
        description: testCase.description
      });

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({
        input: testCase.name,
        success: false,
        error: error.message,
        duration: 0,
        description: testCase.description
      });
    }
    
    console.log(''); // Línea en blanco
    
    // Pausa entre tests para no saturar APIs
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Resumen final
  console.log('📊 RESUMEN DE RESULTADOS:');
  console.log('==========================');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;
  
  console.log(`✅ Exitosos: ${successful}/${total} (${Math.round(successful/total*100)}%)`);
  console.log(`⏱️  Duración promedio: ${Math.round(avgDuration)}ms`);
  console.log('');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const handle = result.handle ? `@${result.handle}` : 'NONE';
    console.log(`${status} ${result.input} → ${handle} (${result.method || 'error'}) - ${result.duration}ms`);
  });

  console.log('\n🎯 TEST COMPLETADO - Pipeline Híbrido Inteligente');
  console.log('📋 Métodos exitosos:', results.filter(r => r.success).map(r => r.method).join(', '));
  return results;
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testHybridIntelligentPipeline().catch(console.error);
}

module.exports = { testHybridIntelligentPipeline }; 