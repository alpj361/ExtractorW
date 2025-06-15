const axios = require('axios');

// Script de prueba simple para el endpoint de sondeos
async function testSondeoSimple() {
  console.log('🧪 PRUEBA SIMPLE DEL ENDPOINT DE SONDEOS');
  console.log('=' .repeat(50));

  try {
    const response = await axios.post('http://localhost:3001/api/sondeo', {
      pregunta: "¿Cuál es la situación de la educación en Guatemala?",
      selectedContexts: ["tendencias"]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NWM5M2I0Yi00NTVlLTQ1MGItOWQwMS1lMThmOWU4ZGZhYWEiLCJlbWFpbCI6InBhYmxvam9zZWEzNjFAZ21haWwuY29tIiwiaWF0IjoxNzM0MjI5NzE5LCJleHAiOjE3MzQzMTYxMTl9.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
      },
      timeout: 30000
    });

    console.log('✅ RESPUESTA RECIBIDA');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    
    if (response.data.sondeo) {
      console.log('Pregunta procesada:', response.data.sondeo.pregunta);
      console.log('Contextos utilizados:', response.data.sondeo.contextos_utilizados);
    }
    
    if (response.data.resultado) {
      console.log('Tiene respuesta:', !!response.data.resultado.respuesta);
      console.log('Tiene datos de análisis:', !!response.data.resultado.datos_analisis);
    }
    
    console.log('🎉 PRUEBA EXITOSA');

  } catch (error) {
    console.error('❌ ERROR:', error.response?.data || error.message);
  }
}

testSondeoSimple(); 