// Test script para verificar conectividad frontend-backend

async function testFrontendToBackend() {
  console.log('🧪 Probando conectividad Frontend -> Backend');
  console.log('================================================');
  
  // URLs a probar
  const urls = [
    'https://extractorw.onrender.com/api/processTrends', // Producción
  ];
  
  for (const url of urls) {
    console.log(`\n🔍 Probando: ${url}`);
    console.log('-'.repeat(50));
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('✅ Conexión exitosa');
      console.log(`📊 Keywords encontrados: ${data.topKeywords?.length || 0}`);
      console.log(`🎨 WordCloud items: ${data.wordCloudData?.length || 0}`);
      console.log(`📈 Categorías: ${data.categoryData?.length || 0}`);
      console.log(`📝 About disponible: ${data.about?.length > 0 ? 'Sí' : 'No'}`);
      console.log(`📊 Estadísticas disponibles: ${Object.keys(data.statistics || {}).length > 0 ? 'Sí' : 'No'}`);
      console.log(`⏰ Timestamp: ${data.timestamp}`);
      console.log(`🔄 Estado: ${data.processing_status}`);
      
      // Mostrar muestra de datos
      if (data.topKeywords && data.topKeywords.length > 0) {
        console.log('\n📋 Muestra de keywords:');
        data.topKeywords.slice(0, 3).forEach((item, i) => {
          console.log(`   ${i+1}. ${item.keyword} (${item.count})`);
        });
      }
      
    } catch (error) {
      console.log('❌ Error de conexión');
      console.log(`   Error: ${error.message}`);
    }
  }
  
  console.log('\n🏁 Pruebas completadas');
}

// Ejecutar pruebas
testFrontendToBackend().catch(console.error); 