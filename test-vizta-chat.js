const axios = require('axios');

// ===================================================================
// VIZTA CHAT TESTING SCRIPT
// Prueba completa del sistema Vizta Chat + MCP Server + GPT-4o mini
// ===================================================================

const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'https://server.standatpd.com';

// Configuración de prueba
const TEST_CONFIG = {
  userToken: process.env.TEST_USER_TOKEN || 'test-token', // Usar token real para pruebas
  testQueries: [
    'Analízame tweets sobre Guatemala',
    'Qué están diciendo en Twitter sobre política en Guatemala',
    'Monitorea la tendencia sobre elecciones',
    'Busca tweets sobre economía guatemalteca',
    'Analiza el sentimiento sobre el gobierno actual'
  ]
};

/**
 * Prueba el endpoint principal de Vizta Chat
 */
async function testViztaChatQuery(query, sessionId) {
  try {
    console.log(`\n🤖 Probando consulta: "${query}"`);
    
    const response = await axios.post(`${EXTRACTOR_W_URL}/api/vizta-chat/query`, {
      message: query,
      sessionId: sessionId
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.userToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 segundos timeout
    });

    if (response.data.success) {
      console.log('✅ Consulta exitosa');
      console.log(`📝 Respuesta: ${response.data.response.substring(0, 200)}...`);
      console.log(`🔧 Herramienta usada: ${response.data.toolUsed || 'Ninguna'}`);
      console.log(`⏱️ Tiempo de ejecución: ${response.data.executionTime || 0}ms`);
      
      return {
        success: true,
        sessionId: response.data.sessionId,
        toolUsed: response.data.toolUsed,
        response: response.data.response
      };
    } else {
      throw new Error(response.data.message || 'Error desconocido');
    }

  } catch (error) {
    console.error('❌ Error en consulta:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Prueba obtener scrapes del usuario
 */
async function testGetUserScrapes() {
  try {
    console.log('\n📋 Probando obtener scrapes del usuario...');
    
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/vizta-chat/scrapes?limit=5`, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.userToken}`
      }
    });

    if (response.data.success) {
      console.log(`✅ ${response.data.scrapes.length} scrapes obtenidos`);
      
      response.data.scrapes.forEach((scrape, index) => {
        console.log(`  ${index + 1}. ${scrape.query_original} (${scrape.herramienta})`);
      });
      
      return response.data.scrapes;
    } else {
      throw new Error(response.data.message || 'Error obteniendo scrapes');
    }

  } catch (error) {
    console.error('❌ Error obteniendo scrapes:', error.message);
    return [];
  }
}

/**
 * Prueba obtener estadísticas del usuario
 */
async function testGetUserStats() {
  try {
    console.log('\n📊 Probando estadísticas del usuario...');
    
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/vizta-chat/stats`, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.userToken}`
      }
    });

    if (response.data.success) {
      console.log('✅ Estadísticas obtenidas:');
      console.log(`  Total scrapes: ${response.data.stats.totalScrapes}`);
      console.log(`  Herramientas usadas:`, response.data.stats.toolsUsed);
      console.log(`  Categorías encontradas:`, response.data.stats.categoriesFound);
      
      return response.data.stats;
    } else {
      throw new Error(response.data.message || 'Error obteniendo estadísticas');
    }

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.message);
    return null;
  }
}

/**
 * Prueba obtener herramientas MCP disponibles
 */
async function testGetMCPTools() {
  try {
    console.log('\n🔧 Probando herramientas MCP disponibles...');
    
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/vizta-chat/tools`, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.userToken}`
      }
    });

    if (response.data.success) {
      console.log(`✅ ${response.data.tools.length} herramientas disponibles:`);
      
      response.data.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      
      return response.data.tools;
    } else {
      throw new Error(response.data.message || 'Error obteniendo herramientas');
    }

  } catch (error) {
    console.error('❌ Error obteniendo herramientas:', error.message);
    return [];
  }
}

/**
 * Ejecuta todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DE VIZTA CHAT');
  console.log('=====================================');

  // Generar sessionId para las pruebas
  const sessionId = `test_session_${Date.now()}`;
  console.log(`📱 Session ID: ${sessionId}`);

  // 1. Probar herramientas MCP
  await testGetMCPTools();

  // 2. Probar consultas de chat
  let successfulQueries = 0;
  for (const query of TEST_CONFIG.testQueries) {
    const result = await testViztaChatQuery(query, sessionId);
    if (result.success) {
      successfulQueries++;
    }
    
    // Esperar un poco entre consultas
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 3. Probar obtener scrapes
  await testGetUserScrapes();

  // 4. Probar estadísticas
  await testGetUserStats();

  // Resumen final
  console.log('\n📊 RESUMEN DE PRUEBAS');
  console.log('=====================');
  console.log(`✅ Consultas exitosas: ${successfulQueries}/${TEST_CONFIG.testQueries.length}`);
  console.log(`📱 Session ID usado: ${sessionId}`);
  
  if (successfulQueries === TEST_CONFIG.testQueries.length) {
    console.log('🎉 ¡Todas las pruebas pasaron exitosamente!');
  } else {
    console.log('⚠️ Algunas pruebas fallaron. Revisa los logs arriba.');
  }
}

/**
 * Prueba específica para verificar que el MCP Server responde
 */
async function testMCPServerDirect() {
  try {
    console.log('\n🔍 Probando MCP Server directamente...');
    
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/status`);
    
    if (response.data.success) {
      console.log('✅ MCP Server operativo');
      console.log(`📊 Herramientas disponibles: ${response.data.status.available_tools}`);
      console.log(`🔗 ExtractorT status: ${response.data.status.external_services?.extractor_t?.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error conectando con MCP Server:', error.message);
  }
}

// Verificar argumentos de línea de comandos
const args = process.argv.slice(2);
const command = args[0];

if (command === 'mcp') {
  // Solo probar MCP Server
  testMCPServerDirect();
} else if (command === 'query' && args[1]) {
  // Probar una consulta específica
  const sessionId = `test_${Date.now()}`;
  testViztaChatQuery(args[1], sessionId);
} else {
  // Ejecutar todas las pruebas
  runAllTests();
}

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
}); 