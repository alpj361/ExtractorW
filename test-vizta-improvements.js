const axios = require('axios');

// ===================================================================
// VIZTA CHAT IMPROVEMENTS TESTING SCRIPT
// Prueba las mejoras de expansión inteligente de términos de búsqueda
// ===================================================================

const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'https://server.standatpd.com';

// Configuración de prueba
const TEST_CONFIG = {
  userToken: process.env.TEST_USER_TOKEN || 'test-token', // Usar token real para pruebas
  testQueries: [
    // Casos específicos mencionados por el usuario
    'necesito tweets de la marcha del orgullo',
    'tweets sobre la marcha del orgullo',
    'qué dicen sobre el orgullo',
    
    // Otros casos para probar la expansión
    'análisis de sentimiento sobre las elecciones',
    'opiniones del presidente',
    'qué piensan del gobierno',
    'tweets sobre seguridad en Guatemala',
    'sentimiento sobre la economía',
    
    // Casos edge
    'guatemala',
    'política',
    'congreso'
  ]
};

/**
 * Prueba el endpoint de test de expansión
 */
async function testQueryExpansion(query) {
  try {
    console.log(`\n🧪 Probando expansión para: "${query}"`);
    
    const response = await axios.post(`${EXTRACTOR_W_URL}/api/vizta-chat/test-expansion`, {
      query: query
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.userToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.success) {
      console.log('✅ Prueba de expansión exitosa');
      console.log(`📝 Tipo de análisis: ${response.data.test_results.analysis_type}`);
      console.log(`🔍 Expansiones sugeridas:`);
      Object.entries(response.data.instructions.example_expansions).forEach(([key, value]) => {
        if (query.toLowerCase().includes(key.toLowerCase())) {
          console.log(`   "${key}" → "${value}"`);
        }
      });
      console.log(`📊 Límite recomendado: ${response.data.test_results.suggested_improvements.recommended_limit}`);
      
      return {
        success: true,
        original: query,
        analysis_type: response.data.test_results.analysis_type,
        recommended_limit: response.data.test_results.suggested_improvements.recommended_limit
      };
    } else {
      throw new Error(response.data.message || 'Error desconocido');
    }

  } catch (error) {
    console.error('❌ Error en prueba de expansión:', error.message);
    return {
      success: false,
      error: error.message,
      original: query
    };
  }
}

/**
 * Prueba una consulta completa con Vizta Chat mejorado
 */
async function testImprovedViztaChat(query) {
  try {
    console.log(`\n🤖 Probando Vizta Chat mejorado: "${query}"`);
    
    const response = await axios.post(`${EXTRACTOR_W_URL}/api/vizta-chat/query`, {
      message: query,
      sessionId: `test_session_${Date.now()}`
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.userToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 segundos para análisis completo
    });

    if (response.data.success) {
      console.log('✅ Consulta Vizta Chat exitosa');
      console.log(`🔧 Herramienta usada: ${response.data.toolUsed || 'Ninguna'}`);
      
      if (response.data.toolArgs) {
        console.log(`🎯 Query original: "${query}"`);
        console.log(`🚀 Query enviada a herramienta: "${response.data.toolArgs.q || 'N/A'}"`);
        console.log(`📊 Límite usado: ${response.data.toolArgs.limit || 'N/A'}`);
        
        // Verificar si se aplicó expansión
        const expansionApplied = response.data.toolArgs.q !== query;
        console.log(`🎛️ Expansión aplicada: ${expansionApplied ? '✅ SÍ' : '❌ NO'}`);
      }
      
      console.log(`📝 Respuesta (primeros 200 chars): ${response.data.response.substring(0, 200)}...`);
      console.log(`⏱️ Tiempo de ejecución: ${response.data.executionTime || 0}ms`);
      
      return {
        success: true,
        original_query: query,
        tool_used: response.data.toolUsed,
        tool_args: response.data.toolArgs,
        expansion_applied: response.data.toolArgs && response.data.toolArgs.q !== query,
        response_preview: response.data.response.substring(0, 100)
      };
    } else {
      throw new Error(response.data.message || 'Error desconocido');
    }

  } catch (error) {
    console.error('❌ Error en consulta Vizta Chat:', error.message);
    return {
      success: false,
      error: error.message,
      original_query: query
    };
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DE MEJORAS DE VIZTA CHAT');
  console.log('='.repeat(60));
  
  const results = {
    expansions: [],
    queries: []
  };

  // 1. Probar expansiones de términos
  console.log('\n📋 FASE 1: PRUEBAS DE EXPANSIÓN DE TÉRMINOS');
  console.log('-'.repeat(50));
  
  for (const query of TEST_CONFIG.testQueries.slice(0, 5)) { // Probar solo los primeros 5
    const result = await testQueryExpansion(query);
    results.expansions.push(result);
    
    // Esperar un poco entre pruebas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 2. Probar consultas completas
  console.log('\n🤖 FASE 2: PRUEBAS DE CONSULTAS COMPLETAS');
  console.log('-'.repeat(50));
  
  // Probar solo las consultas más importantes
  const priorityQueries = [
    'necesito tweets de la marcha del orgullo',
    'análisis de sentimiento sobre las elecciones',
    'qué piensan del gobierno'
  ];
  
  for (const query of priorityQueries) {
    const result = await testImprovedViztaChat(query);
    results.queries.push(result);
    
    // Esperar más tiempo entre consultas completas
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // 3. Generar resumen de resultados
  console.log('\n📊 RESUMEN DE RESULTADOS');
  console.log('='.repeat(60));
  
  const expansionSuccesses = results.expansions.filter(r => r.success).length;
  const querySuccesses = results.queries.filter(r => r.success).length;
  const expansionsApplied = results.queries.filter(r => r.expansion_applied).length;
  
  console.log(`✅ Pruebas de expansión exitosas: ${expansionSuccesses}/${results.expansions.length}`);
  console.log(`✅ Consultas completas exitosas: ${querySuccesses}/${results.queries.length}`);
  console.log(`🎯 Expansiones aplicadas en consultas: ${expansionsApplied}/${results.queries.length}`);
  
  if (expansionsApplied > 0) {
    console.log('\n🎉 ¡LAS MEJORAS ESTÁN FUNCIONANDO CORRECTAMENTE!');
    console.log('El sistema ahora expande inteligentemente los términos de búsqueda.');
  } else if (querySuccesses > 0) {
    console.log('\n⚠️ Las consultas funcionan pero la expansión podría no estar aplicándose.');
    console.log('Revisa los logs del servidor para más detalles.');
  } else {
    console.log('\n❌ Hay problemas con el sistema. Revisa la configuración.');
  }
  
  console.log('\n📋 CASOS DE PRUEBA DETALLADOS:');
  results.queries.forEach(result => {
    if (result.success) {
      console.log(`\n📝 "${result.original_query}"`);
      console.log(`   🔧 Herramienta: ${result.tool_used}`);
      console.log(`   🎯 Expansión: ${result.expansion_applied ? '✅' : '❌'}`);
      if (result.tool_args && result.tool_args.q) {
        console.log(`   🚀 Query expandida: "${result.tool_args.q}"`);
      }
    }
  });
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'expansion') {
    const query = process.argv[3] || 'necesito tweets de la marcha del orgullo';
    testQueryExpansion(query);
  } else if (command === 'query') {
    const query = process.argv[3] || 'necesito tweets de la marcha del orgullo';
    testImprovedViztaChat(query);
  } else {
    runAllTests();
  }
}

module.exports = {
  testQueryExpansion,
  testImprovedViztaChat,
  runAllTests
}; 