const axios = require('axios');

// ===================================================================
// SCRIPT DE PRUEBA: VIZTA + NITTER PROFILE INTEGRATION
// ===================================================================

const EXTRACTORW_BASE_URL = 'http://localhost:8080';

// Función para probar el endpoint MCP de nitter_profile
async function testMCPNitterProfile() {
  console.log('🧪 Probando endpoint MCP nitter_profile...');
  
  try {
    const response = await axios.post(`${EXTRACTORW_BASE_URL}/api/mcp/nitter_profile`, {
      username: 'GuatemalaGob',
      limit: 5,
      include_retweets: false,
      include_replies: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Aquí necesitarías un token JWT válido en una prueba real
        'Authorization': 'Bearer test-token'
      },
      timeout: 30000
    });
    
    console.log('✅ Respuesta MCP nitter_profile:', {
      success: response.data.success,
      username: response.data.username,
      tweetsCount: response.data.result?.tweets_count || 0,
      executionTime: response.data.result?.execution_time || 0
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error en MCP nitter_profile:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    return null;
  }
}

// Función para probar las capacidades del MCP
async function testMCPCapabilities() {
  console.log('🧪 Probando capacidades del MCP...');
  
  try {
    const response = await axios.get(`${EXTRACTORW_BASE_URL}/api/mcp/capabilities`);
    
    const nitterProfileTool = response.data.tools.find(tool => tool.name === 'nitter_profile');
    
    if (nitterProfileTool) {
      console.log('✅ Herramienta nitter_profile encontrada en capacidades:', {
        name: nitterProfileTool.name,
        description: nitterProfileTool.description,
        hasFeatures: nitterProfileTool.features?.length > 0
      });
    } else {
      console.error('❌ Herramienta nitter_profile NO encontrada en capacidades');
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo capacidades MCP:', error.message);
    return null;
  }
}

// Función para simular una consulta de Vizta
async function testViztalChatWithProfile() {
  console.log('🧪 Simulando consulta de Vizta Chat con nitter_profile...');
  
  try {
    const response = await axios.post(`${EXTRACTORW_BASE_URL}/api/vizta-chat/query`, {
      message: 'Busca los últimos tweets de @GuatemalaGob',
      sessionId: `test_${Date.now()}`
    }, {
      headers: {
        'Content-Type': 'application/json',
        // En una prueba real necesitarías autenticación
        'Authorization': 'Bearer test-token'
      },
      timeout: 45000
    });
    
    console.log('✅ Respuesta Vizta Chat:', {
      success: response.data.success,
      toolUsed: response.data.toolUsed,
      responseLength: response.data.response?.length || 0,
      executionTime: response.data.executionTime || 0
    });
    
    if (response.data.toolResult?.tweets_count) {
      console.log(`📊 Tweets analizados: ${response.data.toolResult.tweets_count}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error en Vizta Chat:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    return null;
  }
}

// Función para probar herramientas disponibles
async function testAvailableTools() {
  console.log('🧪 Probando herramientas disponibles...');
  
  try {
    const response = await axios.get(`${EXTRACTORW_BASE_URL}/api/vizta-chat/tools`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    const nitterProfileTool = response.data.tools.find(tool => tool.name === 'nitter_profile');
    
    if (nitterProfileTool) {
      console.log('✅ nitter_profile disponible en Vizta:', {
        name: nitterProfileTool.name,
        category: nitterProfileTool.category,
        examples: nitterProfileTool.examples?.length || 0
      });
    } else {
      console.error('❌ nitter_profile NO disponible en herramientas de Vizta');
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo herramientas:', error.message);
    return null;
  }
}

// Función principal de pruebas
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN VIZTA + NITTER PROFILE');
  console.log('=' .repeat(60));
  
  const results = {
    capabilities: false,
    tools: false,
    mcpEndpoint: false,
    viztaChat: false
  };
  
  // Test 1: Capacidades MCP
  console.log('\n1. PROBANDO CAPACIDADES MCP...');
  const capabilities = await testMCPCapabilities();
  results.capabilities = capabilities !== null;
  
  // Test 2: Herramientas disponibles en Vizta
  console.log('\n2. PROBANDO HERRAMIENTAS DISPONIBLES...');
  const tools = await testAvailableTools();
  results.tools = tools !== null;
  
  // Test 3: Endpoint MCP directo
  console.log('\n3. PROBANDO ENDPOINT MCP DIRECTO...');
  const mcpResult = await testMCPNitterProfile();
  results.mcpEndpoint = mcpResult !== null;
  
  // Test 4: Vizta Chat completo
  console.log('\n4. PROBANDO VIZTA CHAT COMPLETO...');
  const viztaResult = await testViztalChatWithProfile();
  results.viztaChat = viztaResult !== null;
  
  // Resumen de resultados
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMEN DE RESULTADOS:');
  console.log('=' .repeat(60));
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASÓ' : '❌ FALLÓ';
    console.log(`${test.padEnd(20)} | ${status}`);
  });
  
  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('\n' + '-' .repeat(60));
  console.log(`🎯 RESULTADO FINAL: ${totalPassed}/${totalTests} pruebas pasaron`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 ¡INTEGRACIÓN EXITOSA! Vizta puede usar nitter_profile');
  } else {
    console.log('⚠️  INTEGRACIÓN PARCIAL. Revisar configuración y autenticación');
  }
  
  return results;
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testMCPNitterProfile,
  testMCPCapabilities,
  testViztalChatWithProfile,
  testAvailableTools,
  runTests
}; 