/**
 * Prueba del flujo completo de User Discovery:
 * 1. Buscar en Zep Memory
 * 2. Si no encuentra, buscar en Perplexity 
 * 3. Agregar usuario encontrado a Zep Memory
 */

require('dotenv').config();

const { LauraAgent } = require('./server/services/agents/laura');
const LLMIntentClassifier = require('./server/services/agents/vizta/helpers/llmIntentClassifier');
const agentHandlers = require('./server/services/agents/vizta/agentHandlers');

// Mock básico para agentesService
const mockAgentesService = {
  laura: null,
  robert: null,
  vizta: null
};

async function testUserDiscoveryFlow() {
  console.log('🧪 === PRUEBA FLUJO COMPLETO USER DISCOVERY ===\n');
  
  try {
    // 1. Inicializar Laura Agent
    console.log('🤖 Inicializando Laura Agent...');
    const laura = new LauraAgent(mockAgentesService);
    
    // 2. Probar casos de búsqueda de usuarios
    const testCases = [
      'busca Mario López',
      'quien es Ana García', 
      'twitter de Sandra Torres',
      '@pedrogonzalez'
    ];
    
    const mockUser = { id: 'test_user', name: 'Test User' };
    
    for (const testQuery of testCases) {
      console.log(`\n📝 Probando: "${testQuery}"`);
      
      // 2.1. Clasificar intención
      console.log('🧠 Clasificando intención...');
      const intentResult = await LLMIntentClassifier.classifyIntent(testQuery);
      console.log(`   Intent detectado: ${intentResult.intent} (${intentResult.method}, ${intentResult.confidence})`);
      
      if (intentResult.intent === 'user_discovery') {
        // 2.2. Ejecutar User Discovery
        console.log('🔍 Ejecutando User Discovery...');
        
        try {
          const discoveryResult = await laura.userDiscovery.enhancedUserDetection(testQuery, mockUser);
          
          if (discoveryResult && discoveryResult !== 'USER_NOT_FOUND') {
            console.log(`   ✅ Usuario encontrado: @${discoveryResult}`);
            
            // 2.3. Obtener perfil completo (si es necesario)
            console.log('📊 Obteniendo perfil completo...');
            const profileTask = {
              id: `test_profile_${Date.now()}`,
              tool: 'nitter_profile',
              type: 'profile',
              args: { username: discoveryResult },
              originalQuery: testQuery
            };
            
            const profileResult = await laura.executeTask(profileTask, mockUser);
            console.log(`   📋 Perfil obtenido: ${profileResult.success ? 'SÍ' : 'NO'}`);
            
            if (profileResult.success) {
              console.log(`   👤 Usuario: ${profileResult.profile?.name || 'N/A'}`);
              console.log(`   📝 Bio: ${profileResult.profile?.bio?.substring(0, 100) || 'N/A'}...`);
            }
            
          } else {
            console.log(`   ❌ Usuario no encontrado`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error en User Discovery: ${error.message}`);
        }
        
      } else {
        console.log(`   ⚠️ No es consulta de User Discovery, se clasificó como: ${intentResult.intent}`);
      }
    }
    
    // 3. Prueba de estadísticas
    console.log('\n📊 === ESTADÍSTICAS ===');
    const stats = laura.userDiscovery.getStats();
    console.log('Laura UserDiscovery Stats:', JSON.stringify(stats, null, 2));
    
    console.log('\n🎉 Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    console.error('Stack:', error.stack);
  }
}

// Función para probar solo el flujo de búsqueda en memoria
async function testMemorySearchOnly() {
  console.log('\n🔍 === PRUEBA SOLO BÚSQUEDA EN MEMORIA ===\n');
  
  try {
    const laura = new LauraAgent(mockAgentesService);
    
    // Verificar que los clientes de memoria estén habilitados
    console.log('Memoria HTTP habilitada:', laura.memoryClient?.enabled);
    console.log('Memoria interna habilitada:', laura.internalMemoryClient?.enabled);
    
    if (laura.internalMemoryClient?.enabled) {
      console.log('✅ InternalMemoryClient está disponible y habilitado');
      
      // Probar búsqueda directa
      const searchQuery = 'Mario López';
      console.log(`🔍 Buscando en UserHandles: "${searchQuery}"`);
      
      try {
        const searchResults = await laura.internalMemoryClient.searchUserHandles(searchQuery, 3);
        console.log('Resultados de búsqueda:', searchResults);
      } catch (error) {
        console.log('Error en búsqueda:', error.message);
      }
      
    } else {
      console.log('❌ InternalMemoryClient no está habilitado');
    }
    
  } catch (error) {
    console.error('Error en prueba de memoria:', error);
  }
}

// Ejecutar pruebas
async function main() {
  // Solo probar memoria si están las variables configuradas
  if (process.env.LAURA_MEMORY_URL && process.env.ZEP_API_KEY) {
    await testUserDiscoveryFlow();
  } else {
    console.log('⚠️ Variables de entorno faltantes para prueba completa');
    console.log('   - LAURA_MEMORY_URL:', process.env.LAURA_MEMORY_URL ? 'OK' : 'FALTA');
    console.log('   - ZEP_API_KEY:', process.env.ZEP_API_KEY ? 'OK' : 'FALTA');
    console.log('\n📝 Ejecutando solo prueba de memoria local...');
    await testMemorySearchOnly();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testUserDiscoveryFlow, testMemorySearchOnly };