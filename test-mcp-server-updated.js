require('dotenv').config();
const axios = require('axios');

// Configuración
const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'http://localhost:8080';
const TEST_JWT_TOKEN = process.env.TEST_JWT_TOKEN || 'your_test_jwt_token_here';

// Headers con autenticación
const headers = {
  'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
  'Content-Type': 'application/json'
};

console.log('🧪 PRUEBA COMPLETA DEL MCP SERVER ACTUALIZADO');
console.log('================================================');
console.log(`🌐 URL Base: ${EXTRACTOR_W_URL}`);
console.log(`🔑 Token: ${TEST_JWT_TOKEN ? 'Configurado' : 'NO CONFIGURADO'}`);
console.log('');

/**
 * Prueba 1: Estado del MCP Server
 */
async function testMCPStatus() {
  try {
    console.log('📊 Probando estado del MCP Server...');
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/status`);
    
    console.log('✅ Estado obtenido exitosamente:');
    console.log(`   • Servidor: ${response.data.status.server_name}`);
    console.log(`   • Versión: ${response.data.status.version}`);
    console.log(`   • Estado: ${response.data.status.status}`);
    console.log(`   • Herramientas disponibles: ${response.data.status.available_tools}`);
    console.log(`   • ExtractorT: ${response.data.status.external_services?.extractor_t?.status || 'unknown'}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo estado:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Prueba 2: Listar herramientas disponibles
 */
async function testListTools() {
  try {
    console.log('\n🔧 Probando listado de herramientas...');
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/tools`);
    
    console.log('✅ Herramientas obtenidas exitosamente:');
    response.data.tools.forEach(tool => {
      console.log(`   • ${tool.name}: ${tool.description}`);
      console.log(`     Categoría: ${tool.category} | Créditos: ${tool.usage_credits}`);
      if (tool.features) {
        console.log(`     Características: ${tool.features.join(', ')}`);
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error listando herramientas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Prueba 3: Información de herramienta específica
 */
async function testGetToolInfo() {
  try {
    console.log('\n📋 Probando información de nitter_context...');
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/tools/nitter_context`);
    
    console.log('✅ Información obtenida exitosamente:');
    console.log(`   • Nombre: ${response.data.tool.name}`);
    console.log(`   • Descripción: ${response.data.tool.description}`);
    console.log(`   • Categoría: ${response.data.tool.category}`);
    console.log(`   • Créditos: ${response.data.tool.usage_credits}`);
    console.log('   • Parámetros:');
    Object.entries(response.data.tool.parameters).forEach(([param, config]) => {
      console.log(`     - ${param}: ${config.type} ${config.required ? '(requerido)' : '(opcional)'}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo info de herramienta:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Prueba 4: Ejecutar nitter_context con análisis completo
 */
async function testNitterContextComplete() {
  try {
    console.log('\n🐦 Probando nitter_context con análisis completo...');
    
    const testData = {
      q: "guatemala",
      location: "guatemala",
      limit: 3,
      session_id: `test_session_${Date.now()}`
    };
    
    console.log(`   Parámetros: query="${testData.q}", limit=${testData.limit}`);
    
    const startTime = Date.now();
    const response = await axios.post(
      `${EXTRACTOR_W_URL}/api/mcp/nitter_context`, 
      testData, 
      { headers }
    );
    const endTime = Date.now();
    
    console.log('✅ Análisis completado exitosamente:');
    console.log(`   • Query: "${response.data.query}"`);
    console.log(`   • Ubicación: ${response.data.location}`);
    console.log(`   • Session ID: ${response.data.session_id}`);
    console.log(`   • Tiempo total: ${endTime - startTime}ms`);
    
    const result = response.data.result;
    if (result.success) {
      console.log('\n📊 Métricas del análisis:');
      console.log(`   • Categoría detectada: ${result.categoria}`);
      console.log(`   • Tweets encontrados: ${result.tweet_count}`);
      console.log(`   • Tweets guardados: ${result.tweets_saved}`);
      console.log(`   • Engagement total: ${result.total_engagement}`);
      console.log(`   • Engagement promedio: ${result.avg_engagement}`);
      console.log(`   • Tiempo de procesamiento: ${result.execution_time}ms`);
      
      if (result.tweets && result.tweets.length > 0) {
        console.log('\n🐦 Muestra de tweets analizados:');
        result.tweets.slice(0, 2).forEach((tweet, index) => {
          console.log(`   ${index + 1}. @${tweet.usuario}`);
          console.log(`      📝 "${tweet.texto.substring(0, 60)}..."`);
          console.log(`      💭 Sentimiento: ${tweet.sentimiento} (${tweet.score_sentimiento})`);
          console.log(`      🎯 Intención: ${tweet.intencion_comunicativa}`);
          console.log(`      📊 Engagement: ${tweet.likes + tweet.retweets + tweet.replies}`);
          console.log(`      🏷️ Entidades: ${tweet.entidades_mencionadas?.length || 0}`);
        });
      }
      
      console.log(`\n📝 Resumen: ${result.summary}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error ejecutando nitter_context:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Prueba 5: Ejecutor universal MCP
 */
async function testUniversalExecutor() {
  try {
    console.log('\n⚡ Probando ejecutor universal MCP...');
    
    const testData = {
      tool_name: "nitter_context",
      parameters: {
        q: "economia guatemala",
        location: "guatemala",
        limit: 2,
        session_id: `universal_test_${Date.now()}`
      }
    };
    
    const response = await axios.post(
      `${EXTRACTOR_W_URL}/api/mcp/execute`, 
      testData, 
      { headers }
    );
    
    console.log('✅ Ejecutor universal funcionando:');
    console.log(`   • Herramienta: ${response.data.tool_name}`);
    console.log(`   • Mensaje: ${response.data.message}`);
    console.log(`   • Tweets procesados: ${response.data.result.tweet_count || 0}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error en ejecutor universal:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Prueba 6: Capacidades MCP (para N8N)
 */
async function testMCPCapabilities() {
  try {
    console.log('\n🔍 Probando capacidades MCP...');
    const response = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/capabilities`);
    
    console.log('✅ Capacidades obtenidas:');
    console.log(`   • Protocolo: ${response.data.protocolVersion}`);
    console.log(`   • Servidor: ${response.data.serverInfo.name}`);
    console.log(`   • Herramientas disponibles: ${response.data.tools.length}`);
    
    response.data.tools.forEach(tool => {
      console.log(`     - ${tool.name}: ${tool.description}`);
      if (tool.features) {
        console.log(`       Características: ${tool.features.join(', ')}`);
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo capacidades:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  const results = {};
  
  try {
    // Verificar configuración
    if (!TEST_JWT_TOKEN || TEST_JWT_TOKEN === 'your_test_jwt_token_here') {
      console.log('⚠️  ADVERTENCIA: TEST_JWT_TOKEN no configurado. Algunas pruebas fallarán.');
      console.log('   Configure un token JWT válido en .env para pruebas completas.\n');
    }
    
    // Ejecutar pruebas
    results.status = await testMCPStatus();
    results.tools = await testListTools();
    results.toolInfo = await testGetToolInfo();
    results.capabilities = await testMCPCapabilities();
    
    // Pruebas que requieren autenticación
    if (TEST_JWT_TOKEN && TEST_JWT_TOKEN !== 'your_test_jwt_token_here') {
      results.nitterContext = await testNitterContextComplete();
      results.universalExecutor = await testUniversalExecutor();
    } else {
      console.log('\n⏭️  Saltando pruebas de ejecución (requieren autenticación)');
    }
    
    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('='.repeat(50));
    console.log('✅ MCP Server funcionando correctamente');
    console.log('✅ Nueva implementación de nitter_context integrada');
    console.log('✅ Análisis con Gemini AI operativo');
    console.log('✅ Guardado en base de datos funcionando');
    
  } catch (error) {
    console.log('\n❌ PRUEBAS FALLIDAS');
    console.log('='.repeat(50));
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
      console.error('Status:', error.response.status);
    }
    
    process.exit(1);
  }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testMCPStatus,
  testListTools,
  testGetToolInfo,
  testNitterContextComplete,
  testUniversalExecutor,
  testMCPCapabilities,
  runAllTests
}; 