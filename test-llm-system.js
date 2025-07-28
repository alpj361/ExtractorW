/**
 * Script de prueba para el sistema híbrido LLM de Vizta
 * Prueba tanto el modo conversacional como el modo agéntico
 */

const { agentesService } = require('./server/services/agentesService');

// Configuración de pruebas
const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'admin'
};

const SESSION_ID = `test_session_${Date.now()}`;

/**
 * Ejecutar una consulta de prueba
 */
async function testQuery(query, description = '') {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 PRUEBA: ${description || query}`);
  console.log(`📝 Query: "${query}"`);
  console.log(`${'='.repeat(80)}`);
  
  const startTime = Date.now();
  
  try {
    const result = await agentesService.processUserQuery(query, TEST_USER, SESSION_ID);
    const processingTime = Date.now() - startTime;
    
    console.log(`\n✅ RESPUESTA EXITOSA (${processingTime}ms):`);
    console.log(`📨 Agente: ${result.response.agent}`);
    console.log(`🎯 Intención: ${result.metadata.intent} (${result.metadata.intentMethod})`);
    console.log(`🧠 Confianza: ${result.metadata.intentConfidence}`);
    console.log(`🔧 Modo: ${result.metadata.mode}`);
    console.log(`💬 Mensaje: "${result.response.message}"`);
    
    if (result.response.data) {
      console.log(`📊 Datos disponibles: Sí`);
    }
    
    return { success: true, result, processingTime };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.log(`\n❌ ERROR (${processingTime}ms):`);
    console.log(`⚠️ Tipo: ${error.name}`);
    console.log(`📝 Mensaje: ${error.message}`);
    
    return { success: false, error, processingTime };
  }
}

/**
 * Pruebas de modo conversacional
 */
async function testConversationalMode() {
  console.log(`\n${'🗣️  MODO CONVERSACIONAL'.padEnd(80, '🗣️')}`);
  
  const conversationalTests = [
    {
      query: "hola",
      description: "Saludo básico"
    },
    {
      query: "¿qué puedes hacer?",
      description: "Pregunta sobre capacidades"
    },
    {
      query: "ayuda",
      description: "Solicitud de ayuda"
    },
    {
      query: "gracias, eso está perfecto",
      description: "Agradecimiento casual"
    },
    {
      query: "buenos días",
      description: "Saludo formal"
    },
    {
      query: "¿cómo funciona esto?",
      description: "Pregunta sobre funcionamiento"
    }
  ];
  
  const results = [];
  
  for (const test of conversationalTests) {
    const result = await testQuery(test.query, test.description);
    results.push({ ...test, ...result });
    
    // Pausa pequeña entre pruebas
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

/**
 * Pruebas de modo agéntico
 */
async function testAgentialMode() {
  console.log(`\n${'🤖 MODO AGÉNTICO'.padEnd(80, '🤖')}`);
  
  const agentialTests = [
    {
      query: "busca en twitter sobre guatemala",
      description: "Búsqueda en Twitter - Laura",
      expectedAgent: "Laura",
      expectedIntent: "nitter_search"
    },
    {
      query: "analiza el sentimiento en twitter sobre las elecciones",
      description: "Análisis de Twitter - Laura",
      expectedAgent: "Laura", 
      expectedIntent: "twitter_analysis"
    },
    {
      query: "busca el perfil de @jimmymoralesgt",
      description: "Búsqueda de perfil - Laura",
      expectedAgent: "Laura",
      expectedIntent: "twitter_profile"
    },
    {
      query: "investiga sobre la situación económica de Guatemala",
      description: "Búsqueda web - Laura",
      expectedAgent: "Laura",
      expectedIntent: "web_search"
    },
    {
      query: "busca en mi codex información sobre migración",
      description: "Búsqueda en Codex - Robert",
      expectedAgent: "Robert",
      expectedIntent: "search_codex"
    },
    {
      query: "¿cuáles son mis proyectos activos?",
      description: "Consulta de proyectos - Robert",
      expectedAgent: "Robert",
      expectedIntent: "search_projects"
    },
    {
      query: "analiza este documento sobre política",
      description: "Análisis de documento - Robert",
      expectedAgent: "Robert",
      expectedIntent: "analyze_document"
    },
    {
      query: "compara mis proyectos con las tendencias en twitter",
      description: "Análisis mixto - Varios agentes",
      expectedAgent: "Vizta",
      expectedIntent: "mixed_analysis"
    }
  ];
  
  const results = [];
  
  for (const test of agentialTests) {
    const result = await testQuery(test.query, test.description);
    
    // Validar expectativas
    if (result.success) {
      const response = result.result.response;
      const metadata = result.result.metadata;
      
      console.log(`\n🔍 VALIDACIÓN:`);
      console.log(`   Intención esperada: ${test.expectedIntent} | Detectada: ${metadata.intent} ${metadata.intent === test.expectedIntent ? '✅' : '❌'}`);
      console.log(`   Agente esperado: ${test.expectedAgent} | Usado: ${response.agent} ${response.agent === test.expectedAgent ? '✅' : '❌'}`);
    }
    
    results.push({ ...test, ...result });
    
    // Pausa entre pruebas agénticas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Pruebas de casos edge y ambiguos
 */
async function testEdgeCases() {
  console.log(`\n${'🔍 CASOS EDGE'.padEnd(80, '🔍')}`);
  
  const edgeTests = [
    {
      query: "dsdfsdfsdfsdf",
      description: "Texto sin sentido"
    },
    {
      query: "",
      description: "Query vacío"
    },
    {
      query: "twitter guatemala projects analysis sentiment user profile",
      description: "Múltiples keywords mezcladas"
    },
    {
      query: "¿Puedes buscar en twitter información sobre mis proyectos y analizar documentos?",
      description: "Query complejo multi-intención"
    },
    {
      query: "Hello, can you help me with Twitter analysis?",
      description: "Query en inglés"
    }
  ];
  
  const results = [];
  
  for (const test of edgeTests) {
    const result = await testQuery(test.query, test.description);
    results.push({ ...test, ...result });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

/**
 * Generar reporte de resultados
 */
function generateReport(conversationalResults, agentialResults, edgeResults) {
  console.log(`\n${'📊 REPORTE FINAL'.padEnd(80, '📊')}`);
  
  const allResults = [...conversationalResults, ...agentialResults, ...edgeResults];
  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  
  console.log(`\n📈 ESTADÍSTICAS GENERALES:`);
  console.log(`   Total de pruebas: ${allResults.length}`);
  console.log(`   Exitosas: ${successful.length} (${((successful.length / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`   Fallidas: ${failed.length} (${((failed.length / allResults.length) * 100).toFixed(1)}%)`);
  
  // Estadísticas por modo
  const conversationalSuccess = conversationalResults.filter(r => r.success).length;
  const agentialSuccess = agentialResults.filter(r => r.success).length;
  const edgeSuccess = edgeResults.filter(r => r.success).length;
  
  console.log(`\n📊 ESTADÍSTICAS POR MODO:`);
  console.log(`   Conversacional: ${conversationalSuccess}/${conversationalResults.length} (${((conversationalSuccess / conversationalResults.length) * 100).toFixed(1)}%)`);
  console.log(`   Agéntico: ${agentialSuccess}/${agentialResults.length} (${((agentialSuccess / agentialResults.length) * 100).toFixed(1)}%)`);
  console.log(`   Casos Edge: ${edgeSuccess}/${edgeResults.length} (${((edgeSuccess / edgeResults.length) * 100).toFixed(1)}%)`);
  
  // Tiempo de procesamiento promedio
  const avgProcessingTime = allResults.reduce((sum, r) => sum + r.processingTime, 0) / allResults.length;
  console.log(`\n⏱️ RENDIMIENTO:`);
  console.log(`   Tiempo promedio: ${avgProcessingTime.toFixed(0)}ms`);
  console.log(`   Tiempo máximo: ${Math.max(...allResults.map(r => r.processingTime))}ms`);
  console.log(`   Tiempo mínimo: ${Math.min(...allResults.map(r => r.processingTime))}ms`);
  
  // Métodos de intención utilizados
  const intentMethods = {};
  successful.forEach(r => {
    if (r.result && r.result.metadata && r.result.metadata.intentMethod) {
      const method = r.result.metadata.intentMethod;
      intentMethods[method] = (intentMethods[method] || 0) + 1;
    }
  });
  
  console.log(`\n🧠 MÉTODOS DE CLASIFICACIÓN:`);
  Object.entries(intentMethods).forEach(([method, count]) => {
    console.log(`   ${method}: ${count} veces (${((count / successful.length) * 100).toFixed(1)}%)`);
  });
  
  // Errores encontrados
  if (failed.length > 0) {
    console.log(`\n❌ ERRORES ENCONTRADOS:`);
    failed.forEach(r => {
      console.log(`   "${r.query}" → ${r.error.name}: ${r.error.message}`);
    });
  }
  
  console.log(`\n${'✅ REPORTE COMPLETADO'.padEnd(80, '✅')}`);
  
  return {
    total: allResults.length,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / allResults.length) * 100,
    avgProcessingTime,
    intentMethods
  };
}

/**
 * Función principal de pruebas
 */
async function runTests() {
  console.log(`🚀 INICIANDO PRUEBAS DEL SISTEMA LLM HÍBRIDO DE VIZTA`);
  console.log(`👤 Usuario de prueba: ${TEST_USER.email}`);
  console.log(`🔗 Session ID: ${SESSION_ID}`);
  console.log(`⏰ Inicio: ${new Date().toLocaleString()}`);
  
  try {
    // Ejecutar pruebas
    const conversationalResults = await testConversationalMode();
    const agentialResults = await testAgentialMode();
    const edgeResults = await testEdgeCases();
    
    // Generar reporte
    const report = generateReport(conversationalResults, agentialResults, edgeResults);
    
    return report;
    
  } catch (error) {
    console.error(`❌ Error ejecutando pruebas:`, error);
    throw error;
  }
}

/**
 * Modo interactivo
 */
async function interactiveMode() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log(`\n🎮 MODO INTERACTIVO ACTIVADO`);
  console.log(`Escribe 'exit' para salir\n`);
  
  const askQuestion = () => {
    rl.question('💬 Tu consulta: ', async (query) => {
      if (query.toLowerCase() === 'exit') {
        console.log('¡Hasta luego! 👋');
        rl.close();
        return;
      }
      
      if (query.trim()) {
        await testQuery(query, 'Consulta interactiva');
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// Verificar argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.includes('--interactive')) {
  interactiveMode().catch(console.error);
} else if (args.includes('--quick')) {
  // Prueba rápida con solo algunos casos
  testQuery("hola").then(() => {
    return testQuery("busca en twitter sobre guatemala");
  }).catch(console.error);
} else {
  // Ejecutar suite completa
  runTests().catch(console.error);
}

module.exports = {
  testQuery,
  runTests,
  interactiveMode
}; 