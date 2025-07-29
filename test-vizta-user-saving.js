#!/usr/bin/env node
/**
 * Test para verificar que Vizta guarde usuarios nuevos en userhandles
 */

const { ViztaAgent } = require('./server/services/agents/vizta');

async function testViztaUserSaving() {
  console.log('🧪 Iniciando test de guardado de usuarios en Vizta...\n');
  
  try {
    // 1. Inicializar Vizta
    console.log('1️⃣ Inicializando Vizta Agent...');
    const vizta = new ViztaAgent();
    console.log('✅ Vizta inicializado\n');
    
    // 2. Simular usuario
    const testUser = {
      id: 'test_user',
      email: 'test@example.com'
    };
    
    // 3. Test: Búsqueda de usuario que podría descubrir handles nuevos
    console.log('2️⃣ Test: User Discovery que debería guardar en userhandles...');
    const userDiscoveryQuery = "busca Mario López";
    
    try {
      const discoveryResult = await vizta.processUserQuery(userDiscoveryQuery, testUser, 'test_discovery_session');
      
      console.log('📊 Resultado User Discovery:');
      console.log(`   Intent: ${discoveryResult.metadata?.intent || 'unknown'}`);
      console.log(`   Agent: ${discoveryResult.response?.agent || 'unknown'}`);
      console.log(`   Success: ${discoveryResult.response?.error ? 'No' : 'Yes'}`);
      
      if (discoveryResult.response?.message) {
        const preview = discoveryResult.response.message.substring(0, 100) + '...';
        console.log(`   Message preview: ${preview}`);
      }
      
    } catch (error) {
      console.error('❌ Error en User Discovery:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // 4. Test: Búsqueda web que podría encontrar handles
    console.log('3️⃣ Test: Web Search que podría descubrir usuarios...');
    const webSearchQuery = "información sobre Sandra Torres Guatemala Twitter";
    
    try {
      const webResult = await vizta.processUserQuery(webSearchQuery, testUser, 'test_web_session');
      
      console.log('📊 Resultado Web Search:');
      console.log(`   Intent: ${webResult.metadata?.intent || 'unknown'}`);
      console.log(`   Agent: ${webResult.response?.agent || 'unknown'}`);
      console.log(`   Success: ${webResult.response?.error ? 'No' : 'Yes'}`);
      
      if (webResult.response?.message) {
        const preview = webResult.response.message.substring(0, 100) + '...';
        console.log(`   Message preview: ${preview}`);
      }
      
    } catch (error) {
      console.error('❌ Error en Web Search:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // 5. Test: Búsqueda de perfil
    console.log('4️⃣ Test: Profile Search que debería guardar si encuentra...');
    const profileQuery = "perfil de bernardo arevalo";
    
    try {
      const profileResult = await vizta.processUserQuery(profileQuery, testUser, 'test_profile_session');
      
      console.log('📊 Resultado Profile Search:');
      console.log(`   Intent: ${profileResult.metadata?.intent || 'unknown'}`);
      console.log(`   Agent: ${profileResult.response?.agent || 'unknown'}`);
      console.log(`   Success: ${profileResult.response?.error ? 'No' : 'Yes'}`);
      
      if (profileResult.response?.message) {
        const preview = profileResult.response.message.substring(0, 100) + '...';
        console.log(`   Message preview: ${preview}`);
      }
      
    } catch (error) {
      console.error('❌ Error en Profile Search:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completado. Verifica los logs para confirmar que se guardaron usuarios en userhandles.');
    console.log('\n💡 Busca en los logs mensajes como:');
    console.log('   - "💾 Guardando usuario descubierto"');
    console.log('   - "✅ Usuario guardado en userhandles"');
    console.log('   - "💾 Nuevo usuario guardado en UserHandles"');
    
  } catch (error) {
    console.error('❌ Error principal en test:', error);
  }
}

// Ejecutar test
testViztaUserSaving().catch(console.error);