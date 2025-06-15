const axios = require('axios');

// Configuración del test
const BASE_URL = 'http://localhost:3001'; // Cambiar por la URL del VPS si es necesario
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NWM5M2I0Yi00NTVlLTQ1MGItOWQwMS1lMThmOWU4ZGZhYWEiLCJlbWFpbCI6InBhYmxvam9zZWEzNjFAZ21haWwuY29tIiwiaWF0IjoxNzM0MjI5NzE5LCJleHAiOjE3MzQzMTYxMTl9.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'; // Token de prueba

async function testSondeoEndpoint() {
  console.log('🧪 INICIANDO PRUEBA DEL ENDPOINT DE SONDEOS');
  console.log('=' .repeat(60));

  try {
    // Datos de prueba
    const testData = {
      pregunta: "¿Cuál es la situación actual de la educación en Guatemala?",
      selectedContexts: ["tendencias", "noticias"]
    };

    console.log('📝 Datos de prueba:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('');

    // Configurar headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_TOKEN}`
    };

    console.log('🚀 Enviando solicitud al endpoint...');
    const startTime = Date.now();

    // Hacer la solicitud
    const response = await axios.post(`${BASE_URL}/api/sondeo`, testData, {
      headers,
      timeout: 60000 // 60 segundos de timeout
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ RESPUESTA RECIBIDA');
    console.log(`⏱️  Tiempo de respuesta: ${duration}ms`);
    console.log(`📊 Status: ${response.status}`);
    console.log('');

    // Analizar la respuesta
    const data = response.data;
    
    console.log('📋 ANÁLISIS DE LA RESPUESTA:');
    console.log('=' .repeat(40));
    
    console.log(`✅ Success: ${data.success}`);
    console.log(`📝 Pregunta procesada: ${data.sondeo?.pregunta}`);
    console.log(`📊 Contextos utilizados: ${data.sondeo?.contextos_utilizados?.join(', ')}`);
    console.log(`👤 Usuario: ${data.sondeo?.usuario}`);
    console.log('');

    // Verificar contexto
    if (data.contexto) {
      console.log('📊 ESTADÍSTICAS DEL CONTEXTO:');
      console.log(`- Total fuentes: ${data.contexto.estadisticas?.total_fuentes}`);
      console.log(`- Total items: ${data.contexto.estadisticas?.total_items}`);
      console.log(`- Fuentes con datos: ${data.contexto.estadisticas?.fuentes_con_datos}`);
      console.log(`- Fuentes utilizadas: ${data.contexto.fuentes_utilizadas?.join(', ')}`);
      console.log('');
    }

    // Verificar resultado
    if (data.resultado) {
      console.log('🤖 RESULTADO DE IA:');
      console.log(`- Tiene respuesta: ${!!data.resultado.respuesta}`);
      console.log(`- Longitud respuesta: ${data.resultado.respuesta?.length || 0} caracteres`);
      console.log(`- Tiene metadata: ${!!data.resultado.metadata}`);
      console.log(`- Modelo usado: ${data.resultado.metadata?.modelo}`);
      console.log('');

      // Verificar datos de análisis (nuevas mejoras)
      if (data.resultado.datos_analisis) {
        console.log('📈 DATOS DE ANÁLISIS (NUEVAS MEJORAS):');
        const analisis = data.resultado.datos_analisis;
        
        if (analisis.temas_relevantes) {
          console.log(`- Temas relevantes: ${analisis.temas_relevantes.length} items`);
        }
        if (analisis.distribucion_categorias) {
          console.log(`- Distribución categorías: ${analisis.distribucion_categorias.length} items`);
        }
        if (analisis.conclusiones) {
          console.log(`- Conclusiones: ${Object.keys(analisis.conclusiones).length} secciones`);
        }
        if (analisis.metodologia) {
          console.log(`- Metodología: ${Object.keys(analisis.metodologia).length} explicaciones`);
        }
        console.log('');
      }
    }

    // Verificar créditos
    if (data.creditos) {
      console.log('💳 INFORMACIÓN DE CRÉDITOS:');
      console.log(`- Costo total: ${data.creditos.costo_total}`);
      console.log(`- Créditos restantes: ${data.creditos.creditos_restantes}`);
      console.log('');
    }

    // Mostrar metadata
    if (data.metadata) {
      console.log('📋 METADATA:');
      console.log(`- Procesado en: ${data.metadata.procesado_en}`);
      console.log(`- Versión: ${data.metadata.version}`);
      console.log(`- Modelo IA: ${data.metadata.modelo_ia}`);
      console.log('');
    }

    // Mostrar muestra de la respuesta
    if (data.resultado?.respuesta) {
      console.log('📄 MUESTRA DE LA RESPUESTA:');
      console.log('-' .repeat(40));
      const respuesta = data.resultado.respuesta;
      const muestra = respuesta.length > 300 ? respuesta.substring(0, 300) + '...' : respuesta;
      console.log(muestra);
      console.log('-' .repeat(40));
      console.log('');
    }

    console.log('🎉 PRUEBA COMPLETADA EXITOSAMENTE');
    
  } catch (error) {
    console.error('❌ ERROR EN LA PRUEBA:');
    console.error('=' .repeat(40));
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor');
      console.error('Request:', error.request);
    } else {
      console.error('Error configurando la solicitud:', error.message);
    }
    
    console.error('Stack trace:', error.stack);
  }
}

// Ejecutar la prueba
if (require.main === module) {
  testSondeoEndpoint();
}

module.exports = { testSondeoEndpoint }; 