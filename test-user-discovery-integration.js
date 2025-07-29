/**
 * Script de prueba para verificar la integración de User Discovery en Vizta
 */

const { AgentesService } = require('./server/services/agentesService');

// Simular usuario de prueba
const testUser = {
  id: 'test_user_123',
  email: 'test@example.com'
};

// Casos de prueba para User Discovery
const testCases = [
  // Casos que deberían activar user_discovery
  'busca Mario López',
  'quien es Ana García',
  'encuentra Pedro González',
  'información sobre Karin Herrera',
  '@pedrogonzalez en twitter',
  'twitter de Sandra Torres',
  'handle de Bernardo Arevalo',
  'cuenta de Alejandro Giammattei',
  
  // Casos que NO deberían activar user_discovery (control)
  'busca información sobre el clima',
  'hola como estas',
  'analiza sentimientos en twitter',
  'tendencias en guatemala'
];

async function testUserDiscoveryIntegration() {
  console.log('🧪 === INICIANDO PRUEBAS DE INTEGRACIÓN USER DISCOVERY ===\n');
  
  const agentesService = new AgentesService();
  
  for (let i = 0; i < testCases.length; i++) {
    const testMessage = testCases[i];
    console.log(`\n📝 Caso ${i + 1}: "${testMessage}"`);
    console.log('─'.repeat(60));
    
    try {
      const result = await agentesService.processUserQuery(testMessage, testUser);
      
      console.log(`✅ Resultado:`);
      console.log(`   Agent: ${result.response?.agent}`);
      console.log(`   Intent: ${result.metadata?.intent}`);
      console.log(`   Mode: ${result.metadata?.mode}`);
      console.log(`   Success: ${result.response?.success !== false}`);
      
      if (result.response?.message) {
        console.log(`   Message (primeros 100 chars): ${result.response.message.substring(0, 100)}...`);
      }
      
      // Verificar si se activó user_discovery correctamente
      const expectedUserDiscovery = i < 8; // Primeros 8 casos deberían activar user_discovery
      const actualUserDiscovery = result.metadata?.intent === 'user_discovery';
      
      if (expectedUserDiscovery === actualUserDiscovery) {
        console.log(`   ✅ Intent clasificado correctamente: ${actualUserDiscovery ? 'user_discovery' : 'otro'}`);
      } else {
        console.log(`   ❌ Intent MAL clasificado. Esperado: ${expectedUserDiscovery ? 'user_discovery' : 'otro'}, Actual: ${result.metadata?.intent}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n🏁 === PRUEBAS COMPLETADAS ===');
}

// Verificar que las dependencias están disponibles
async function checkDependencies() {
  console.log('🔍 Verificando dependencias...');
  
  try {
    // Verificar OPENAI_API_KEY
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OPENAI_API_KEY no configurado');
      return false;
    }
    console.log('✅ OPENAI_API_KEY configurado');
    
    // Verificar LAURA_MEMORY_URL
    const lauraUrl = process.env.LAURA_MEMORY_URL || 'http://localhost:5001';
    console.log(`✅ LAURA_MEMORY_URL: ${lauraUrl}`);
    
    console.log('✅ Dependencias verificadas\n');
    return true;
    
  } catch (error) {
    console.log(`❌ Error verificando dependencias: ${error.message}`);
    return false;
  }
}

// Ejecutar pruebas
async function main() {
  const dependenciesOk = await checkDependencies();
  
  if (!dependenciesOk) {
    console.log('❌ Dependencias faltantes. Configura las variables de entorno necesarias.');
    process.exit(1);
  }
  
  await testUserDiscoveryIntegration();
}

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testUserDiscoveryIntegration,
  checkDependencies
};