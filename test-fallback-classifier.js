/**
 * Prueba del clasificador fallback (regex) para User Discovery
 * No requiere API keys ni configuración
 */

// Importar solo la lógica de fallback
function testFallbackClassification(message) {
  const text = message.toLowerCase().trim();
  
  // Conversacional
  if (/hola|hi|hello|buenos días|buenas tardes|cómo estás|qué tal|gracias|adiós/i.test(text)) {
    return { intent: 'casual_conversation', confidence: 0.7, method: 'fallback' };
  }
  
  if (/qué puedes hacer|quién eres|para qué sirves|qué haces|ayuda|help/i.test(text)) {
    return { intent: 'capability_question', confidence: 0.7, method: 'fallback' };
  }
  
  // Agéntico
  if (/buscar en twitter|twitter|trending|hashtag|viral/i.test(text)) {
    return { intent: 'nitter_search', confidence: 0.6, method: 'fallback' };
  }
  
  if (/analiza.*twitter|sentimiento.*twitter/i.test(text)) {
    return { intent: 'twitter_analysis', confidence: 0.6, method: 'fallback' };
  }
  
  if (/perfil.*twitter|usuario.*twitter/i.test(text)) {
    return { intent: 'twitter_profile', confidence: 0.6, method: 'fallback' };
  }
  
  // User discovery patterns - EXACTAMENTE IGUALES AL ARCHIVO PRINCIPAL
  
  // Handles y menciones de Twitter (máxima prioridad)
  if (/@\w+/i.test(text)) {
    return { intent: 'user_discovery', confidence: 0.8, method: 'fallback' };
  }
  
  // Búsqueda específica de personas con nombres propios
  if (/^(busca|quien es|encuentra|información sobre) [A-Z][a-z]+(\s+[A-Z][a-z]+)+/i.test(text)) {
    return { intent: 'user_discovery', confidence: 0.8, method: 'fallback' };
  }
  
  // Twitter de + nombres propios
  if (/twitter de [A-Z][a-z]+(\s+[A-Z][a-z]+)+/i.test(text)) {
    return { intent: 'user_discovery', confidence: 0.8, method: 'fallback' };
  }
  
  // Handle/cuenta de + nombres propios
  if (/(handle|cuenta) de [A-Z][a-z]+(\s+[A-Z][a-z]+)+/i.test(text)) {
    return { intent: 'user_discovery', confidence: 0.8, method: 'fallback' };
  }
  
  // Web search - solo si no es sobre personas
  if (/busca información sobre (el|la|los|las)|investiga sobre (el|la|los|las)|búsqueda web/i.test(text)) {
    return { intent: 'web_search', confidence: 0.6, method: 'fallback' };
  }
  
  if (/codex|mis documentos|archivos personales/i.test(text)) {
    return { intent: 'search_codex', confidence: 0.6, method: 'fallback' };
  }
  
  if (/mis proyectos|proyectos activos/i.test(text)) {
    return { intent: 'search_projects', confidence: 0.6, method: 'fallback' };
  }
  
  if (/analiza.*documento|resumen.*documento/i.test(text)) {
    return { intent: 'analyze_document', confidence: 0.6, method: 'fallback' };
  }
  
  // Default
  return { intent: 'unknown', confidence: 0.3, method: 'fallback' };
}

function runTests() {
  console.log('🧪 === PRUEBA CLASIFICADOR FALLBACK (REGEX) ===\n');
  
  const testCases = [
    // Casos que DEBERÍAN detectar user_discovery
    { message: 'busca Mario López', expected: 'user_discovery', shouldMatch: true },
    { message: 'quien es Ana García', expected: 'user_discovery', shouldMatch: true },
    { message: 'encuentra Pedro González', expected: 'user_discovery', shouldMatch: true },
    { message: 'información sobre Karin Herrera', expected: 'user_discovery', shouldMatch: true },
    { message: '@pedrogonzalez', expected: 'user_discovery', shouldMatch: true },
    { message: 'twitter de Sandra Torres', expected: 'user_discovery', shouldMatch: true },
    { message: 'handle de Bernardo Arevalo', expected: 'user_discovery', shouldMatch: true },
    { message: 'cuenta de Alejandro Giammattei', expected: 'user_discovery', shouldMatch: true },
    
    // Casos que NO deberían detectar user_discovery
    { message: 'busca información sobre el clima', expected: 'user_discovery', shouldMatch: false },
    { message: 'hola como estas', expected: 'user_discovery', shouldMatch: false },
    { message: 'analiza sentimientos en twitter', expected: 'user_discovery', shouldMatch: false },
    { message: 'tendencias en guatemala', expected: 'user_discovery', shouldMatch: false },
    { message: 'perfil de twitter @usuario', expected: 'user_discovery', shouldMatch: false },
  ];
  
  let correct = 0;
  let userDiscoveryDetected = 0;
  let userDiscoveryExpected = 0;
  
  testCases.forEach((testCase, i) => {
    console.log(`📝 Caso ${i + 1}: "${testCase.message}"`);
    
    const result = testFallbackClassification(testCase.message);
    const detected = result.intent === 'user_discovery';
    
    console.log(`   Detectado: ${result.intent} (${result.confidence})`);
    console.log(`   Esperado user_discovery: ${testCase.shouldMatch ? 'SÍ' : 'NO'}`);
    
    if (testCase.shouldMatch) {
      userDiscoveryExpected++;
      if (detected) {
        userDiscoveryDetected++;
        console.log(`   ✅ CORRECTO - User Discovery detectado`);
        correct++;
      } else {
        console.log(`   ❌ FALLO - Debería detectar User Discovery`);
      }
    } else {
      if (!detected) {
        console.log(`   ✅ CORRECTO - No es User Discovery`);
        correct++;
      } else {
        console.log(`   ❌ FALLO - No debería detectar User Discovery`);
      }
    }
    
    console.log('');
  });
  
  console.log('📊 === RESUMEN ===');
  console.log(`✅ Clasificaciones correctas: ${correct}/${testCases.length} (${(correct/testCases.length*100).toFixed(1)}%)`);
  console.log(`🔍 User Discovery detectado: ${userDiscoveryDetected}/${userDiscoveryExpected} casos esperados`);
  
  if (userDiscoveryDetected === userDiscoveryExpected && correct >= testCases.length * 0.8) {
    console.log('🎉 ¡Clasificador fallback funcionando correctamente!');
  } else {
    console.log('⚠️ El clasificador fallback necesita ajustes');
  }
}

// Ejecutar pruebas
runTests();

module.exports = { testFallbackClassification, runTests };