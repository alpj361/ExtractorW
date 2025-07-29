/**
 * Prueba simple del clasificador de intenciones para User Discovery
 * No requiere conexión a Supabase
 */

const LLMIntentClassifier = require('./server/services/agents/vizta/helpers/llmIntentClassifier');

async function testIntentClassifier() {
  console.log('🧪 === PRUEBA DEL CLASIFICADOR DE INTENCIONES ===\n');
  
  // Verificar que tenemos OpenAI API Key
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY no configurado');
    console.log('💡 Para probar con LLM, configura la variable de entorno OPENAI_API_KEY');
    console.log('📝 Usando solo clasificación fallback...\n');
  }
  
  const classifier = new LLMIntentClassifier();
  
  // Casos de prueba
  const testCases = [
    // Casos que DEBERÍAN detectar user_discovery
    { message: 'busca Mario López', expected: 'user_discovery' },
    { message: 'quien es Ana García', expected: 'user_discovery' },
    { message: 'encuentra Pedro González', expected: 'user_discovery' },
    { message: 'información sobre Karin Herrera', expected: 'user_discovery' },
    { message: '@pedrogonzalez', expected: 'user_discovery' },
    { message: 'twitter de Sandra Torres', expected: 'user_discovery' },
    { message: 'handle de Bernardo Arevalo', expected: 'user_discovery' },
    { message: 'cuenta de Alejandro Giammattei', expected: 'user_discovery' },
    
    // Casos que NO deberían detectar user_discovery
    { message: 'busca información sobre el clima', expected: 'other' },
    { message: 'hola como estas', expected: 'casual_conversation' },
    { message: 'analiza sentimientos en twitter', expected: 'twitter_analysis' },
    { message: 'tendencias en guatemala', expected: 'nitter_search' },
    { message: 'perfil de twitter @usuario', expected: 'twitter_profile' },
  ];
  
  let correctClassifications = 0;
  let totalTests = testCases.length;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 Caso ${i + 1}: "${testCase.message}"`);
    console.log(`   Esperado: ${testCase.expected}`);
    
    try {
      const result = await classifier.classifyIntent(testCase.message);
      
      console.log(`   Detectado: ${result.intent} (${result.method}, ${result.confidence})`);
      
      const isCorrect = (testCase.expected === 'user_discovery' && result.intent === 'user_discovery') ||
                       (testCase.expected !== 'user_discovery' && result.intent !== 'user_discovery') ||
                       (testCase.expected === result.intent);
      
      if (isCorrect) {
        console.log(`   ✅ CORRECTO`);
        correctClassifications++;
      } else {
        console.log(`   ❌ INCORRECTO`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Resumen
  const accuracy = (correctClassifications / totalTests * 100).toFixed(1);
  console.log('📊 === RESUMEN ===');
  console.log(`✅ Clasificaciones correctas: ${correctClassifications}/${totalTests} (${accuracy}%)`);
  
  if (accuracy >= 80) {
    console.log('🎉 ¡Clasificador funcionando correctamente!');
  } else {
    console.log('⚠️ El clasificador necesita ajustes');
  }
}

// Verificar solo el fallback classifier sin LLM
function testFallbackOnly() {
  console.log('🔧 === PRUEBA SOLO FALLBACK (SIN LLM) ===\n');
  
  const classifier = new LLMIntentClassifier();
  
  const testCases = [
    'busca Mario López',
    'quien es Ana García', 
    '@pedrogonzalez',
    'twitter de Sandra Torres',
    'hola como estas',
    'analiza sentimientos en twitter'
  ];
  
  testCases.forEach((message, i) => {
    console.log(`📝 Caso ${i + 1}: "${message}"`);
    const result = classifier.fallbackClassification(message);
    console.log(`   Resultado: ${result.intent} (${result.method}, ${result.confidence})`);
    console.log('');
  });
}

// Ejecutar pruebas
async function main() {
  // Primero probar fallback
  testFallbackOnly();
  
  // Luego probar con LLM si está disponible
  if (process.env.OPENAI_API_KEY) {
    await testIntentClassifier();
  } else {
    console.log('💡 Para probar clasificación LLM completa, configura OPENAI_API_KEY');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testIntentClassifier, testFallbackOnly };