const { AgentesService } = require('./server/services/agentesService');

// Test de Ultra Simple URL-Only Approach
async function testSoloLLM() {
  console.log('🧪 Testing Ultra Simple URL-Only Approach...\n');
  
  const agentesService = new AgentesService();
  
  // Test cases
  const testCases = [
    {
      name: 'Diego España',
      expected: 'DiegoEspana_', // Based on the provided handle
      description: 'Periodista guatemalteco - URL-only approach'
    },
    {
      name: 'Bernardo Arévalo',
      expected: 'BArevaloN',
      description: 'Presidente - debería devolver URL directa'
    },
    {
      name: '@realDonaldTrump',
      expected: 'realDonaldTrump',
      description: 'Handle directo - bypass a verificación'
    },
    {
      name: 'Persona Totalmente Inexistente XYZ123',
      expected: null,
      description: 'Nombre falso - debería devolver NONE'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: "${testCase.name}"`);
    console.log(`💡 ${testCase.description}`);
    console.log('='.repeat(70));
    
    try {
      const startTime = Date.now();
      
      const result = await agentesService.resolveTwitterHandle({
        name: testCase.name,
        context: '',
        sector: ''
      });
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Result (${duration}ms):`, {
        success: result.success,
        handle: result.handle || 'NONE',
        method: result.method,
        confidence: result.confidence || 0,
        source_url: result.source_url ? result.source_url.substring(0, 50) + '...' : ''
      });
      
      if (testCase.expected && result.success) {
        const match = result.handle === testCase.expected;
        console.log(`🎯 Expected: ${testCase.expected}, Got: ${result.handle} - ${match ? '✅ MATCH' : '❌ DIFFERENT'}`);
      }
      
      // Explicar el método usado
      if (result.method) {
        const methodExplanations = {
          'direct_handle': '🎯 Handle directo verificado (bypass)',
          'url_only_success': '🎉 URL-Only: Perplexity → URL → Handle extraído',
          'url_only_none': '❌ URL-Only: Perplexity devolvió NONE',
          'llm_parse_failed': '🤖 LLM no pudo parsear respuesta',
          'invalid_parsed_handle': '❌ Handle parseado no válido',
          'handle_not_found': '🔍 Handle no existe en verificación',
          'direct_handle_failed': '❌ Handle directo no existe',
          'url_only_error': '💥 Error en pipeline URL-only'
        };
        
        console.log(`📋 Método: ${methodExplanations[result.method] || result.method}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing "${testCase.name}":`, error.message);
    }
  }
  
  console.log('\n🏁 Ultra Simple URL-Only test complete!');
  console.log('\n💡 Expected flow for "Diego España":');
  console.log('  1. 🎯 Prompt: "Devuélveme SOLO la URL completa del perfil oficial de X/Twitter de Diego España"');
  console.log('  2. 🔍 Perplexity: "https://twitter.com/DiegoEspana_"');
  console.log('  3. 🔧 Ultra-simple parsing: url.split("/").pop() → "DiegoEspana_"');
  console.log('  4. ✅ Verificación: HEAD request a nitter.net/DiegoEspana_');
  console.log('  5. 🚀 Auto-continue: nitter_profile(@DiegoEspana_)');
  console.log('\n⚡ Total latency: ~1-2 segundos (sin fallbacks ni regex complejos)');
}

// Run test if called directly
if (require.main === module) {
  testSoloLLM().catch(console.error);
}

module.exports = { testSoloLLM }; 