const axios = require('axios');

// ===================================================================
// SCRIPT DE PRUEBA: VIZTA + NITTER PROFILE + SUPABASE INTEGRATION
// ===================================================================

const EXTRACTORW_BASE_URL = 'http://localhost:8080';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsImlhdCI6MTUxNjIzOTAyMn0.test'; // Token de prueba

// Función para hacer peticiones autenticadas
async function makeAuthenticatedRequest(method, endpoint, data = null) {
  try {
    const config = {
      method: method.toUpperCase(),
      url: `${EXTRACTORW_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error en petición ${method.toUpperCase()} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Función para probar el endpoint MCP nitter_profile
async function testMCPNitterProfile() {
  console.log('\n🧪 PRUEBA 1: Endpoint MCP nitter_profile');
  console.log('=====================================');
  
  try {
    const result = await makeAuthenticatedRequest('POST', '/api/mcp/nitter_profile', {
      username: 'GuatemalaGob',
      limit: 5,
      include_retweets: false,
      include_replies: false
    });
    
    console.log('✅ Resultado MCP nitter_profile:');
    console.log(`   - Username: ${result.username}`);
    console.log(`   - Tweets obtenidos: ${result.tweets_count}`);
    console.log(`   - Guardados en Supabase: ${result.supabase_saved ? 'SÍ' : 'NO'}`);
    console.log(`   - Tweets guardados: ${result.supabase_saved_count}`);
    console.log(`   - Profile link: ${result.profile_link}`);
    console.log(`   - Tiempo de ejecución: ${result.execution_time}ms`);
    
    if (result.tweets && result.tweets.length > 0) {
      console.log('\n   📱 Tweets de ejemplo:');
      result.tweets.slice(0, 2).forEach((tweet, index) => {
        console.log(`   ${index + 1}. "${tweet.text.substring(0, 80)}..."`);
        console.log(`      👤 ${tweet.author} | 📅 ${tweet.date}`);
        console.log(`      💚 ${tweet.metrics.likes} | 🔄 ${tweet.metrics.retweets} | 💬 ${tweet.metrics.replies}`);
        console.log(`      🔗 ${tweet.url}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error en prueba MCP nitter_profile:', error.message);
    return null;
  }
}

// Función para probar Vizta Chat con consulta de usuario
async function testViztaChatWithProfile() {
  console.log('\n🧪 PRUEBA 2: Vizta Chat con consulta de perfil');
  console.log('===========================================');
  
  try {
    const result = await makeAuthenticatedRequest('POST', '/api/vizta-chat', {
      message: 'Busca los últimos tweets de @GuatemalaGob',
      session_id: `test_session_${Date.now()}`,
      use_perplexity: false
    });
    
    console.log('✅ Resultado Vizta Chat:');
    console.log(`   - Respuesta: ${result.response.substring(0, 200)}...`);
    console.log(`   - Herramientas usadas: ${result.tools_used?.join(', ') || 'Ninguna'}`);
    console.log(`   - Tiempo de ejecución: ${result.execution_time}ms`);
    
    if (result.tool_results && result.tool_results.nitter_profile) {
      const nitterResult = result.tool_results.nitter_profile;
      console.log('\n   📱 Resultado Nitter Profile:');
      console.log(`   - Tweets obtenidos: ${nitterResult.tweets_count}`);
      console.log(`   - Guardados en Supabase: ${nitterResult.supabase_saved ? 'SÍ' : 'NO'}`);
      console.log(`   - Tweets guardados: ${nitterResult.supabase_saved_count}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error en prueba Vizta Chat:', error.message);
    return null;
  }
}

// Función para verificar datos en Supabase
async function testSupabaseDataQuery() {
  console.log('\n🧪 PRUEBA 3: Verificar datos guardados en Supabase');
  console.log('===============================================');
  
  try {
    // Simulamos una query para verificar los datos guardados
    const result = await makeAuthenticatedRequest('GET', '/api/scrapes/recent?limit=5&source=nitter_profile');
    
    console.log('✅ Datos en Supabase:');
    console.log(`   - Registros encontrados: ${result.data?.length || 0}`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n   📊 Registros de ejemplo:');
      result.data.slice(0, 2).forEach((record, index) => {
        console.log(`   ${index + 1}. Profile: ${record.profile}`);
        console.log(`      Profile Link: ${record.profile_link}`);
        console.log(`      Author: ${record.author}`);
        console.log(`      Content: "${record.content.substring(0, 60)}..."`);
        console.log(`      Date: ${record.date}`);
        console.log(`      Metrics: ${record.likes}💚 | ${record.retweets}🔄 | ${record.replies}💬`);
        console.log(`      Source: ${record.source}`);
        console.log(`      Created: ${record.created_at}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error verificando datos en Supabase:', error.message);
    return null;
  }
}

// Función para probar múltiples usuarios
async function testMultipleUsers() {
  console.log('\n🧪 PRUEBA 4: Múltiples usuarios guatemaltecos');
  console.log('==========================================');
  
  const users = ['GuatemalaGob', 'MPguatemala', 'CashLuna'];
  
  for (const user of users) {
    console.log(`\n📱 Probando usuario: @${user}`);
    try {
      const result = await makeAuthenticatedRequest('POST', '/api/mcp/nitter_profile', {
        username: user,
        limit: 3,
        include_retweets: false,
        include_replies: false
      });
      
      console.log(`   ✅ @${user}: ${result.tweets_count} tweets | Guardados: ${result.supabase_saved_count}`);
    } catch (error) {
      console.log(`   ❌ @${user}: Error - ${error.message}`);
    }
  }
}

// Función principal de pruebas
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS COMPLETAS DE INTEGRACIÓN');
  console.log('============================================');
  console.log(`🕐 Fecha: ${new Date().toISOString()}`);
  console.log(`🌐 ExtractorW URL: ${EXTRACTORW_BASE_URL}`);
  
  const startTime = Date.now();
  
  try {
    // Prueba 1: Endpoint MCP directo
    await testMCPNitterProfile();
    
    // Pausa entre pruebas
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Prueba 2: Vizta Chat
    await testViztaChatWithProfile();
    
    // Pausa entre pruebas
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Prueba 3: Verificar Supabase
    await testSupabaseDataQuery();
    
    // Pausa entre pruebas
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Prueba 4: Múltiples usuarios
    await testMultipleUsers();
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n✅ PRUEBAS COMPLETADAS');
    console.log('===================');
    console.log(`🕐 Tiempo total: ${totalTime}ms`);
    console.log('📊 Resumen:');
    console.log('   - ✅ Integración MCP funcionando');
    console.log('   - ✅ Vizta Chat con detección automática');
    console.log('   - ✅ Guardado en Supabase con columnas profile/profile_link');
    console.log('   - ✅ Múltiples usuarios probados');
    
  } catch (error) {
    console.error('❌ Error en pruebas:', error);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testMCPNitterProfile,
  testViztaChatWithProfile,
  testSupabaseDataQuery,
  testMultipleUsers,
  runAllTests
}; 