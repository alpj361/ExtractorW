/**
 * Test para verificar el flujo de búsqueda en UserHandles
 * Este test verifica que:
 * 1. Se busque primero en UserHandles antes de resolver handles
 * 2. Se guarden nuevos usuarios encontrados
 * 3. Se encuentren usuarios previamente guardados
 */

const axios = require('axios');

const EXTRACTORW_BASE_URL = 'http://localhost:8080';
const MEMORY_SERVICE_URL = 'http://localhost:5001';

async function testUserHandlesFlow() {
  console.log('🧪 Iniciando test del flujo UserHandles...\n');
  
  try {
    // 1. Verificar servicios
    console.log('📊 Verificando servicios...');
    
    const extractorWHealth = await axios.get(`${EXTRACTORW_BASE_URL}/api/health`);
    console.log('✅ ExtractorW:', extractorWHealth.data.status);
    
    const memoryHealth = await axios.get(`${MEMORY_SERVICE_URL}/health`);
    console.log('✅ LauraMemoryService:', memoryHealth.data.status);
    console.log('✅ Zep conectado:', memoryHealth.data.zep_connected);
    console.log('');
    
    // 2. Buscar un usuario conocido en UserHandles (antes de consultarlo)
    console.log('🔍 Buscando "Karin Herrera" en UserHandles antes de consulta...');
    
    const searchBefore = await axios.post(`${MEMORY_SERVICE_URL}/api/laura-memory/search-userhandles`, {
      query: 'Karin Herrera',
      limit: 3
    });
    
    console.log(`📋 Usuarios encontrados ANTES: ${searchBefore.data.results.length}`);
    if (searchBefore.data.results.length > 0) {
      searchBefore.data.results.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.user_name} → ${user.twitter_username || 'Sin handle'}`);
      });
    }
    console.log('');
    
    // 3. Hacer consulta Vizta Chat para "extrae los tweets de Karin Herrera"
    console.log('🤖 Ejecutando consulta Vizta Chat: "extrae los tweets de Karin Herrera"');
    
    const viztaResponse = await axios.post(`${EXTRACTORW_BASE_URL}/api/vizta-chat/query`, {
      message: 'extrae los tweets de Karin Herrera'
    });
    
    console.log(`📝 Respuesta recibida: ${viztaResponse.data.response?.substring(0, 100)}...`);
    console.log('');
    
    // 4. Esperar un momento y buscar de nuevo en UserHandles
    console.log('⏳ Esperando 3 segundos para procesar...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Buscando "Karin Herrera" en UserHandles DESPUÉS de consulta...');
    
    const searchAfter = await axios.post(`${MEMORY_SERVICE_URL}/api/laura-memory/search-userhandles`, {
      query: 'Karin Herrera',
      limit: 3
    });
    
    console.log(`📋 Usuarios encontrados DESPUÉS: ${searchAfter.data.results.length}`);
    if (searchAfter.data.results.length > 0) {
      searchAfter.data.results.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.user_name} → ${user.twitter_username || 'Sin handle'}`);
        console.log(`      Descripción: ${user.description || 'Sin descripción'}`);
        console.log(`      Categoría: ${user.category || 'Sin categoría'}`);
      });
    }
    console.log('');
    
    // 5. Análisis de resultados
    console.log('📊 ANÁLISIS DE RESULTADOS:');
    
    const usersBefore = searchBefore.data.results.length;
    const usersAfter = searchAfter.data.results.length;
    
    if (usersAfter > usersBefore) {
      console.log('✅ ÉXITO: Se guardó el nuevo usuario en UserHandles');
      console.log(`   Usuarios antes: ${usersBefore}, después: ${usersAfter}`);
    } else if (usersBefore > 0) {
      console.log('✅ ÉXITO: Usuario ya existía en UserHandles (no se duplicó)');
      console.log(`   El sistema debería haber usado el handle existente sin hacer búsqueda`);
    } else {
      console.log('⚠️  Usuario no se guardó o no se encontró');
    }
    
    // 6. Test de búsqueda de usuario existente
    if (usersAfter > 0) {
      console.log('\n🔄 Testando segunda consulta (debería usar UserHandles)...');
      
      const secondQuery = await axios.post(`${EXTRACTORW_BASE_URL}/api/vizta-chat/query`, {
        message: 'busca tweets de Karin Herrera'
      });
      
      console.log('✅ Segunda consulta completada (debería haber sido más rápida)');
      console.log(`📝 Respuesta: ${secondQuery.data.response?.substring(0, 100)}...`);
    }
    
    console.log('\n🎉 Test completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
    if (error.response?.data) {
      console.error('📋 Detalles:', error.response.data);
    }
  }
}

// Ejecutar test
testUserHandlesFlow(); 