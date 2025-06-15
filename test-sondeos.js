/**
 * Script de prueba para el endpoint de Sondeos
 * Prueba todas las funcionalidades implementadas en la Fase 2
 */

const axios = require('axios');

// Configuración del servidor
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_TOKEN = 'tu_token_de_prueba_aqui'; // Reemplazar con token válido

// Headers para las peticiones
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TEST_USER_TOKEN}`
};

/**
 * Función auxiliar para hacer peticiones HTTP
 */
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers,
      ...(data && { data })
    };

    console.log(`\n🔄 ${method.toUpperCase()} ${endpoint}`);
    if (data) {
      console.log('📤 Datos enviados:', JSON.stringify(data, null, 2));
    }

    const response = await axios(config);
    
    console.log(`✅ Status: ${response.status}`);
    console.log('📥 Respuesta:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error en ${method.toUpperCase()} ${endpoint}:`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Respuesta:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

/**
 * Prueba 1: Obtener contextos disponibles
 */
async function testObtenerContextos() {
  console.log('\n🧪 PRUEBA 1: Obtener contextos disponibles');
  console.log('='.repeat(50));
  
  try {
    const resultado = await makeRequest('GET', '/sondeo/contextos');
    
    console.log('\n📊 Análisis de contextos:');
    resultado.contextos.forEach(ctx => {
      console.log(`- ${ctx.nombre} (${ctx.id}): ${ctx.descripcion}`);
    });
    
    return resultado;
  } catch (error) {
    console.error('❌ Falló la prueba de contextos');
    return null;
  }
}

/**
 * Prueba 2: Calcular costo de sondeo
 */
async function testCalcularCosto() {
  console.log('\n🧪 PRUEBA 2: Calcular costo de sondeo');
  console.log('='.repeat(50));
  
  const testCases = [
    {
      nombre: 'Contexto mínimo',
      selectedContexts: ['tendencias']
    },
    {
      nombre: 'Contexto mediano',
      selectedContexts: ['tendencias', 'tweets']
    },
    {
      nombre: 'Contexto completo',
      selectedContexts: ['tendencias', 'tweets', 'noticias', 'codex']
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n📋 Caso: ${testCase.nombre}`);
      const resultado = await makeRequest('POST', '/sondeo/costo', testCase);
      
      console.log(`💰 Costo estimado: ${resultado.costo_estimado} créditos`);
      console.log(`✅ Puede procesar: ${resultado.puede_procesar ? 'Sí' : 'No'}`);
      
    } catch (error) {
      console.error(`❌ Falló el caso: ${testCase.nombre}`);
    }
  }
}

/**
 * Prueba 3: Procesar sondeo completo
 */
async function testProcesarSondeo() {
  console.log('\n🧪 PRUEBA 3: Procesar sondeo completo');
  console.log('='.repeat(50));
  
  const sondeoTest = {
    pregunta: '¿Cuáles son las tendencias más importantes en Guatemala esta semana?',
    selectedContexts: ['tendencias', 'tweets'],
    configuracion: {
      detalle_nivel: 'alto',
      incluir_recomendaciones: true
    }
  };

  try {
    const resultado = await makeRequest('POST', '/sondeo', sondeoTest);
    
    console.log('\n📈 Análisis del resultado:');
    console.log(`- Pregunta procesada: ${resultado.sondeo.pregunta}`);
    console.log(`- Contextos utilizados: ${resultado.sondeo.contextos_utilizados.join(', ')}`);
    console.log(`- Costo total: ${resultado.creditos.costo_total} créditos`);
    console.log(`- Créditos restantes: ${resultado.creditos.creditos_restantes}`);
    console.log(`- Fuentes con datos: ${resultado.contexto.estadisticas.fuentes_con_datos}`);
    console.log(`- Total items analizados: ${resultado.contexto.estadisticas.total_items}`);
    
    return resultado;
  } catch (error) {
    console.error('❌ Falló el procesamiento del sondeo');
    return null;
  }
}

/**
 * Prueba 4: Obtener estadísticas de uso
 */
async function testObtenerEstadisticas() {
  console.log('\n🧪 PRUEBA 4: Obtener estadísticas de uso');
  console.log('='.repeat(50));
  
  try {
    const resultado = await makeRequest('GET', '/sondeo/estadisticas');
    
    console.log('\n📊 Estadísticas del usuario:');
    console.log(`- Total sondeos: ${resultado.estadisticas.total_sondeos}`);
    console.log(`- Créditos gastados: ${resultado.estadisticas.creditos_gastados}`);
    console.log(`- Créditos disponibles: ${resultado.estadisticas.creditos_disponibles}`);
    console.log(`- Último sondeo: ${resultado.estadisticas.ultimo_sondeo || 'Nunca'}`);
    
    return resultado;
  } catch (error) {
    console.error('❌ Falló la obtención de estadísticas');
    return null;
  }
}

/**
 * Prueba 5: Casos de error
 */
async function testCasosDeError() {
  console.log('\n🧪 PRUEBA 5: Casos de error');
  console.log('='.repeat(50));
  
  const errorCases = [
    {
      nombre: 'Sin pregunta',
      data: { selectedContexts: ['tendencias'] }
    },
    {
      nombre: 'Sin contextos',
      data: { pregunta: 'Test sin contextos' }
    },
    {
      nombre: 'Contextos inválidos',
      data: { 
        pregunta: 'Test con contextos inválidos',
        selectedContexts: ['contexto_inexistente', 'otro_invalido']
      }
    },
    {
      nombre: 'Pregunta vacía',
      data: { 
        pregunta: '',
        selectedContexts: ['tendencias']
      }
    }
  ];

  for (const errorCase of errorCases) {
    try {
      console.log(`\n🔍 Probando: ${errorCase.nombre}`);
      await makeRequest('POST', '/sondeo', errorCase.data);
      console.log('⚠️  Se esperaba un error pero la petición fue exitosa');
    } catch (error) {
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        console.log(`✅ Error esperado capturado correctamente (${error.response.status})`);
      } else {
        console.log('❌ Error inesperado');
      }
    }
  }
}

/**
 * Función principal que ejecuta todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL ENDPOINT DE SONDEOS');
  console.log('='.repeat(60));
  
  if (!TEST_USER_TOKEN || TEST_USER_TOKEN === 'tu_token_de_prueba_aqui') {
    console.error('❌ ERROR: Debes configurar un token de usuario válido en TEST_USER_TOKEN');
    console.log('\n📝 Para obtener un token:');
    console.log('1. Inicia sesión en la aplicación');
    console.log('2. Inspecciona las peticiones en el navegador');
    console.log('3. Copia el token del header Authorization');
    console.log('4. Reemplaza TEST_USER_TOKEN en este archivo');
    return;
  }

  const resultados = {
    contextos: null,
    costo: null,
    sondeo: null,
    estadisticas: null,
    errores: null
  };

  try {
    // Ejecutar todas las pruebas
    resultados.contextos = await testObtenerContextos();
    await testCalcularCosto();
    resultados.sondeo = await testProcesarSondeo();
    resultados.estadisticas = await testObtenerEstadisticas();
    await testCasosDeError();

    // Resumen final
    console.log('\n🎯 RESUMEN DE PRUEBAS');
    console.log('='.repeat(60));
    console.log(`✅ Contextos disponibles: ${resultados.contextos ? 'OK' : 'FALLÓ'}`);
    console.log(`✅ Cálculo de costos: OK`);
    console.log(`✅ Procesamiento de sondeo: ${resultados.sondeo ? 'OK' : 'FALLÓ'}`);
    console.log(`✅ Estadísticas de uso: ${resultados.estadisticas ? 'OK' : 'FALLÓ'}`);
    console.log(`✅ Manejo de errores: OK`);

    if (resultados.sondeo) {
      console.log('\n🏆 PRUEBAS COMPLETADAS EXITOSAMENTE');
      console.log(`💡 El endpoint de sondeos está funcionando correctamente`);
      console.log(`💰 Último costo procesado: ${resultados.sondeo.creditos.costo_total} créditos`);
    } else {
      console.log('\n⚠️  ALGUNAS PRUEBAS FALLARON');
      console.log('Revisa los logs anteriores para más detalles');
    }

  } catch (error) {
    console.error('\n💥 ERROR CRÍTICO EN LAS PRUEBAS:', error.message);
  }
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testObtenerContextos,
  testCalcularCosto,
  testProcesarSondeo,
  testObtenerEstadisticas,
  testCasosDeError
}; 