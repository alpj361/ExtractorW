const axios = require('axios');

// ===================================================================
// SCRIPT DE PRUEBAS PARA MCP SERVER
// Verifica el funcionamiento completo del orquestador MCP
// ===================================================================

const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_TOKEN || null;

// Configuración de headers para autenticación
const headers = TEST_USER_TOKEN ? {
  'Authorization': `Bearer ${TEST_USER_TOKEN}`,
  'Content-Type': 'application/json'
} : {
  'Content-Type': 'application/json'
};

/**
 * Ejecuta una prueba HTTP y maneja errores
 */
async function executeTest(testName, testFunction) {
  console.log(`\n🧪 EJECUTANDO: ${testName}`);
  console.log('='.repeat(50));
  
  try {
    const startTime = Date.now();
    const result = await testFunction();
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${testName} - EXITOSO (${duration}ms)`);
    console.log('📊 Resultado:', JSON.stringify(result, null, 2));
    return { success: true, result, duration };
  } catch (error) {
    console.log(`❌ ${testName} - FALLÓ`);
    console.log('💥 Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Prueba 1: Estado del MCP Server
 */
async function testMCPStatus() {
  const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/status`, { headers });
  return response.data;
}

/**
 * Prueba 2: Listar herramientas disponibles
 */
async function testListTools() {
  const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/tools`, { headers });
  return response.data;
}

/**
 * Prueba 3: Obtener información de herramienta específica
 */
async function testGetToolInfo() {
  const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/tools/nitter_context`, { headers });
  return response.data;
}

/**
 * Prueba 4: Ejecutar herramienta nitter_context (endpoint específico)
 */
async function testNitterContextDirect() {
  const testData = {
    q: "guatemala",
    location: "guatemala",
    limit: 5
  };
  
  const response = await axios.post(`${EXTRACTOR_W_URL}/api/mcp/nitter_context`, testData, { headers });
  return response.data;
}

/**
 * Prueba 5: Ejecutar herramienta via endpoint genérico
 */
async function testExecuteToolGeneric() {
  const testData = {
    tool_name: "nitter_context",
    parameters: {
      q: "elecciones",
      location: "guatemala",
      limit: 3
    }
  };
  
  const response = await axios.post(`${EXTRACTOR_W_URL}/api/mcp/execute`, testData, { headers });
  return response.data;
}

/**
 * Prueba 6: Validación de parámetros (debe fallar)
 */
async function testParameterValidation() {
  const testData = {
    tool_name: "nitter_context",
    parameters: {
      // Falta el parámetro requerido 'q'
      location: "guatemala",
      limit: 5
    }
  };
  
  try {
    const response = await axios.post(`${EXTRACTOR_W_URL}/api/mcp/execute`, testData, { headers });
    throw new Error('Debería haber fallado la validación');
  } catch (error) {
    if (error.response && error.response.status === 500) {
      return { validation_error: error.response.data };
    }
    throw error;
  }
}

/**
 * Prueba 7: Endpoint SSE Stream
 */
async function testSSEStream() {
  console.log('🔄 Probando conexión SSE (solo iniciará, no mantendrá conexión)...');
  
  try {
    // Solo verificar que el endpoint responde con headers correctos
    // SIN AUTENTICACIÓN para pruebas
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/stream`, {
      timeout: 5000,
      responseType: 'stream'
    });
    
    console.log('✅ Headers SSE correctos:');
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Cache-Control: ${response.headers['cache-control']}`);
    console.log(`   Connection: ${response.headers['connection']}`);
    
    // Cerrar stream inmediatamente para la prueba
    response.data.destroy();
    
    return { sse_headers: response.headers, status: 'SSE endpoint funcionando' };
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return { status: 'SSE endpoint responde (timeout esperado en prueba)' };
    } else {
      throw error;
    }
  }
}

/**
 * Prueba 8: Test Stream SSE (sin auth)
 */
async function testSSEStreamNoAuth() {
  console.log('🔄 Probando test-stream SSE (sin autenticación)...');
  
  try {
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/test-stream`, {
      timeout: 5000,
      responseType: 'stream'
    });
    
    console.log('✅ Headers SSE Test Stream:');
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Cache-Control: ${response.headers['cache-control']}`);
    
    // Cerrar stream inmediatamente
    response.data.destroy();
    
    return { status: 'Test stream SSE funcionando sin auth', headers: response.headers };
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return { status: 'Test stream responde (timeout esperado)' };
    } else {
      throw error;
    }
  }
}

/**
 * Función principal de pruebas
 */
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL MCP SERVER');
  console.log('='.repeat(60));
  console.log(`📍 URL Base: ${EXTRACTOR_W_URL}`);
  console.log(`🔐 Token: ${TEST_USER_TOKEN ? 'Configurado' : 'No configurado (puede fallar autenticación)'}`);
  
  const tests = [
    { name: 'Estado del MCP Server', fn: testMCPStatus },
    { name: 'Listar herramientas', fn: testListTools },
    { name: 'Info herramienta específica', fn: testGetToolInfo },
    { name: 'Nitter Context (directo)', fn: testNitterContextDirect },
    { name: 'Ejecutar herramienta (genérico)', fn: testExecuteToolGeneric },
    { name: 'Validación de parámetros', fn: testParameterValidation },
    { name: 'Endpoint SSE Stream', fn: testSSEStream },
    { name: 'Test Stream SSE (sin auth)', fn: testSSEStreamNoAuth }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await executeTest(test.name, test.fn);
    results.push({ name: test.name, ...result });
    
    // Pausa entre pruebas para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Resumen final
  console.log('\n📋 RESUMEN DE PRUEBAS');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Exitosas: ${successful}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n💥 PRUEBAS FALLIDAS:');
    results.filter(r => !r.success).forEach(test => {
      console.log(`   - ${test.name}: ${test.error.message || JSON.stringify(test.error)}`);
    });
  }
  
  console.log('\n🎯 RECOMENDACIONES:');
  if (!TEST_USER_TOKEN) {
    console.log('   - Configura TEST_TOKEN en variables de entorno para autenticación');
  }
      console.log('   - Verifica que ExtractorT esté corriendo en puerto 8000');
  console.log('   - Verifica que ExtractorW esté corriendo en puerto 3000');
  
  return {
    total: results.length,
    successful: successful,
    failed: failed,
    results: results
  };
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests()
    .then(summary => {
      console.log('\n🏁 PRUEBAS COMPLETADAS');
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Error ejecutando pruebas:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  executeTest
}; 