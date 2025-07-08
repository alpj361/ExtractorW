const axios = require('axios');

// ===================================================================
// PRUEBA FINAL: VIZTA + NITTER PROFILE + RECENT_SCRAPES
// ===================================================================

const EXTRACTORW_URL = 'http://localhost:8080';
const EXTRACTOR_T_URL = 'http://localhost:8000';

// Función para hacer peticiones
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method: method.toUpperCase(),
      url: endpoint,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error en ${method} ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
}

// Función para probar el endpoint directo de ExtractorT
async function testExtractorTNitterProfile() {
  console.log('\n🧪 1. PROBANDO EXTRACTOR T - NITTER PROFILE');
  console.log('='`='.repeat(50));

  const result = await makeRequest('POST', `${EXTRACTOR_T_URL}/api/nitter_profile/`, {
    username: 'GuatemalaGob',
    limit: 5,
    include_retweets: false,
    include_replies: false
  });

  if (result && result.success) {
    console.log('✅ ExtractorT funcionando correctamente');
    console.log(`📊 Tweets obtenidos: ${result.tweets?.length || 0}`);
    console.log(`👤 Usuario: @${result.username}`);
    console.log(`🔗 Perfil: ${result.profile_link}`);
    
    if (result.tweets && result.tweets.length > 0) {
      console.log(`📝 Primer tweet: "${result.tweets[0].text.substring(0, 100)}..."`);
    }
  } else {
    console.log('❌ ExtractorT no está funcionando');
  }

  return result;
}

// Función para probar el endpoint MCP de ExtractorW
async function testExtractorWMCP() {
  console.log('\n🧪 2. PROBANDO EXTRACTOR W - MCP NITTER PROFILE');
  console.log('='`='.repeat(50));

  const result = await makeRequest('POST', `${EXTRACTORW_URL}/api/mcp/nitter_profile`, {
    username: 'GuatemalaGob',
    limit: 5,
    include_retweets: false,
    include_replies: false
  });

  if (result && result.success) {
    console.log('✅ ExtractorW MCP funcionando correctamente');
    console.log(`📊 Tweets obtenidos: ${result.tweets?.length || 0}`);
    console.log(`👤 Usuario: @${result.username}`);
    console.log(`🔗 Perfil: ${result.profile_link}`);
    console.log(`💾 Guardado en Supabase: ${result.supabase_saved ? 'SÍ' : 'NO'}`);
    
    if (result.supabase_saved) {
      console.log(`📝 Registros guardados: ${result.supabase_saved_count || 0}`);
    }
  } else {
    console.log('❌ ExtractorW MCP no está funcionando');
  }

  return result;
}

// Función para probar Vizta Chat con detección automática
async function testViztaChatDetection() {
  console.log('\n🧪 3. PROBANDO VIZTA CHAT - DETECCIÓN AUTOMÁTICA');
  console.log('='`='.repeat(50));

  const testMessages = [
    "Busca los últimos tweets de @GuatemalaGob",
    "¿Qué dice @MPguatemala últimamente?",
    "Analiza la actividad de @CashLuna"
  ];

  for (const message of testMessages) {
    console.log(`\n📱 Enviando: "${message}"`);
    
    const result = await makeRequest('POST', `${EXTRACTORW_URL}/api/vizta-chat`, {
      message: message,
      conversation_id: `test_${Date.now()}`,
      user_id: 'test_user'
    });

    if (result && result.success) {
      console.log('✅ Vizta respondió correctamente');
      console.log(`💬 Respuesta: "${result.response?.substring(0, 150)}..."`);
      
      if (result.tools_used && result.tools_used.length > 0) {
        console.log(`🔧 Herramientas usadas: ${result.tools_used.join(', ')}`);
      }
    } else {
      console.log('❌ Vizta no respondió correctamente');
    }
  }
}

// Función para verificar datos guardados en Supabase (requiere conexión directa)
async function checkSupabaseData() {
  console.log('\n🧪 4. VERIFICANDO DATOS EN SUPABASE');
  console.log('='`='.repeat(50));

  console.log('📊 Para verificar los datos guardados, ejecuta esta consulta SQL:');
  console.log(`
  SELECT 
    profile, 
    profile_link, 
    content, 
    author, 
    date, 
    likes, 
    retweets,
    created_at 
  FROM recent_scrapes 
  WHERE source = 'nitter_profile' 
  AND profile IS NOT NULL
  ORDER BY created_at DESC 
  LIMIT 10;
  `);

  console.log('\n📝 También puedes verificar las columnas:');
  console.log(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'recent_scrapes' 
  AND column_name IN ('profile', 'profile_link');
  `);
}

// Función principal
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS COMPLETAS DE INTEGRACIÓN');
  console.log('='`='.repeat(60));

  // Prueba 1: ExtractorT directo
  const extractorTResult = await testExtractorTNitterProfile();
  
  // Prueba 2: ExtractorW MCP
  const extractorWResult = await testExtractorWMCP();
  
  // Prueba 3: Vizta Chat
  await testViztaChatDetection();
  
  // Prueba 4: Verificar Supabase
  await checkSupabaseData();

  // Resumen
  console.log('\n🎯 RESUMEN DE PRUEBAS');
  console.log('='`='.repeat(30));
  console.log(`ExtractorT Nitter Profile: ${extractorTResult ? '✅' : '❌'}`);
  console.log(`ExtractorW MCP: ${extractorWResult ? '✅' : '❌'}`);
  console.log(`Vizta Chat: En proceso...`);
  console.log(`Supabase: Verificar manualmente`);

  console.log('\n💡 PRÓXIMOS PASOS:');
  console.log('1. Verifica que ExtractorT esté corriendo en puerto 8000');
  console.log('2. Verifica que ExtractorW esté corriendo en puerto 8080');
  console.log('3. Ejecuta las consultas SQL para verificar datos en Supabase');
  console.log('4. Prueba manualmente con Vizta Chat: "Busca tweets de @GuatemalaGob"');
}

// Ejecutar todas las pruebas
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testExtractorTNitterProfile,
  testExtractorWMCP,
  testViztaChatDetection,
  checkSupabaseData,
  runAllTests
}; 