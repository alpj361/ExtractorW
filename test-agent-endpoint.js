const fetch = require('node-fetch');

async function testAgentEndpoint() {
  const testData = {
    instructions: "Quiero extraer todos los títulos de noticias de la portada, junto con sus fechas de publicación y enlaces",
    siteMap: {
      site_name: "Test News Site",
      base_url: "https://example-news.com",
      structure: {
        navigation: ["Home", "News", "Sports", "Politics"],
        main_content: "news-grid",
        pagination: "pagination-controls"
      },
      navigation_summary: "Sitio de noticias con navegación principal y grid de noticias en la portada"
    }
  };

  try {
    console.log('🧪 Probando endpoint de generación de agentes...');
    console.log('📤 Enviando datos de prueba:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://localhost:8080/webagent/generate-agent-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('📥 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Respuesta exitosa:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error del servidor:');
      console.log(errorText);
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('💡 Asegúrate de que el servidor esté ejecutándose en el puerto 8080');
  }
}

// Ejecutar la prueba
testAgentEndpoint();


