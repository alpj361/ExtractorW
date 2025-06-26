const axios = require('axios');

// Configuración
const API_BASE_URL = 'http://localhost:3001/api'; // Cambiar según tu configuración
const TEST_PROJECT_ID = 'test-api-project-' + Date.now();

// Colores para logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

// Datos de prueba simulando hallazgos del frontend
const testFindings = [
  {
    id: 'api-finding-1',
    summary: 'Problemas en contratación pública',
    description: 'Proceso de licitación sin transparencia adecuada',
    theme: 'Transparencia',
    geographic_info: {
      city: 'Guatemala',
      department: null,
      pais: 'Guatemala'
    }
  },
  {
    id: 'api-finding-2',
    summary: 'Deficiencias en servicios municipales',
    description: 'Recolección de basura irregular en sector urbano',
    theme: 'Servicios Municipales',
    geographic_info: {
      city: 'Mixco',
      department: null,
      pais: 'Guatemala'
    }
  },
  {
    id: 'api-finding-3',
    summary: 'Corrupción en obra pública',
    description: 'Sobreprecio detectado en construcción de puente',
    theme: 'Transparencia',
    geographic_info: {
      city: 'Quetzaltenango',
      department: null,
      pais: 'Guatemala'
    }
  }
];

async function testServerConnection() {
  log('\n🔌 Probando conexión al servidor...', 'blue');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/coverages/test`, {
      timeout: 5000
    });
    
    log('✅ Servidor responde correctamente', 'green');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ No se puede conectar al servidor. ¿Está corriendo en puerto 3001?', 'red');
    } else if (error.response) {
      log(`❌ Error del servidor: ${error.response.status} - ${error.response.statusText}`, 'red');
    } else {
      log(`❌ Error de conexión: ${error.message}`, 'red');
    }
    return false;
  }
}

async function testAutoDetectEndpoint() {
  log('\n🤖 Probando endpoint de auto-detect...', 'blue');
  
  try {
    const requestData = {
      project_id: TEST_PROJECT_ID,
      findings: testFindings
    };
    
    log(`📤 Enviando ${testFindings.length} hallazgos para auto-detect...`, 'cyan');
    
    const response = await axios.post(`${API_BASE_URL}/coverages/auto-detect`, requestData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 segundos para operaciones IA
    });
    
    if (response.status === 200) {
      const { created_count, updated_count, total_coverages, coverages } = response.data;
      
      log('✅ Auto-detect ejecutado exitosamente:', 'green');
      log(`  • Coberturas creadas: ${created_count}`, 'green');
      log(`  • Coberturas actualizadas: ${updated_count}`, 'green');
      log(`  • Total de coberturas: ${total_coverages}`, 'green');
      
      if (coverages && coverages.length > 0) {
        log('\n📋 Coberturas generadas:', 'cyan');
        coverages.forEach(coverage => {
          log(`  • ${coverage.coverage_type}: ${coverage.name} (${coverage.findings_count} hallazgos)`, 'cyan');
        });
      }
      
      return { success: true, data: response.data };
    } else {
      log(`❌ Respuesta inesperada: ${response.status}`, 'red');
      return { success: false, error: 'Unexpected status' };
    }
    
  } catch (error) {
    log(`❌ Error en auto-detect: ${error.message}`, 'red');
    if (error.response && error.response.data) {
      log(`   Detalles: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return { success: false, error: error.message };
  }
}

async function testGetCoveragesEndpoint() {
  log('\n📖 Probando endpoint de obtener coberturas...', 'blue');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/coverages/${TEST_PROJECT_ID}`, {
      timeout: 10000
    });
    
    if (response.status === 200) {
      const coverages = response.data;
      
      log(`✅ Obtenidas ${coverages.length} coberturas`, 'green');
      
      // Agrupar por tipo para análisis
      const byType = coverages.reduce((acc, coverage) => {
        if (!acc[coverage.coverage_type]) acc[coverage.coverage_type] = [];
        acc[coverage.coverage_type].push(coverage);
        return acc;
      }, {});
      
      for (const [type, coveragesList] of Object.entries(byType)) {
        log(`  • ${type}: ${coveragesList.length}`, 'cyan');
        coveragesList.forEach(c => {
          log(`    - ${c.name} (${c.findings_count} hallazgos)`, 'cyan');
        });
      }
      
      return { success: true, data: coverages };
    } else {
      log(`❌ Error: ${response.status}`, 'red');
      return { success: false, error: 'Unexpected status' };
    }
    
  } catch (error) {
    log(`❌ Error obteniendo coberturas: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testUpdateGeographyEndpoint(coverageId) {
  log('\n🗺️ Probando endpoint de actualización geográfica...', 'blue');
  
  if (!coverageId) {
    log('⚠️ No hay ID de cobertura para probar actualización', 'yellow');
    return { success: false, error: 'No coverage ID' };
  }
  
  try {
    const updateData = {
      additional_findings: [
        {
          id: 'update-finding-1',
          summary: 'Nuevo hallazgo para actualización',
          description: 'Problema adicional detectado en la misma área',
          theme: 'Servicios Públicos',
          geographic_info: {
            city: 'Guatemala',
            department: 'Guatemala',
            pais: 'Guatemala'
          }
        }
      ]
    };
    
    log(`🔄 Actualizando cobertura ${coverageId}...`, 'cyan');
    
    const response = await axios.put(`${API_BASE_URL}/coverages/${coverageId}/update-geography`, updateData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    
    if (response.status === 200) {
      const { message, coverage } = response.data;
      
      log('✅ Actualización geográfica exitosa:', 'green');
      log(`  • ${message}`, 'green');
      log(`  • Nuevos hallazgos: ${coverage.findings_count}`, 'green');
      
      return { success: true, data: response.data };
    } else {
      log(`❌ Error en actualización: ${response.status}`, 'red');
      return { success: false, error: 'Unexpected status' };
    }
    
  } catch (error) {
    log(`❌ Error actualizando geografía: ${error.message}`, 'red');
    if (error.response && error.response.data) {
      log(`   Detalles: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return { success: false, error: error.message };
  }
}

async function testDuplicateAutoDetect() {
  log('\n🔁 Probando prevención de duplicados con auto-detect...', 'blue');
  
  try {
    // Ejecutar auto-detect por segunda vez con los mismos datos
    const requestData = {
      project_id: TEST_PROJECT_ID,
      findings: testFindings
    };
    
    log('📤 Enviando los mismos hallazgos por segunda vez...', 'cyan');
    
    const response = await axios.post(`${API_BASE_URL}/coverages/auto-detect`, requestData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    if (response.status === 200) {
      const { created_count, updated_count, total_coverages } = response.data;
      
      log('✅ Segunda ejecución completada:', 'green');
      log(`  • Nuevas coberturas creadas: ${created_count}`, created_count === 0 ? 'green' : 'yellow');
      log(`  • Coberturas actualizadas: ${updated_count}`, updated_count > 0 ? 'green' : 'yellow');
      log(`  • Total de coberturas: ${total_coverages}`, 'green');
      
      if (created_count === 0 && updated_count > 0) {
        log('🎯 ¡Excelente! No se crearon duplicados, solo se actualizaron existentes', 'green');
        return { success: true, noDuplicates: true };
      } else if (created_count > 0) {
        log('⚠️ Se crearon nuevas coberturas cuando no debería haber duplicados', 'yellow');
        return { success: true, noDuplicates: false };
      }
      
      return { success: true, noDuplicates: true };
    } else {
      log(`❌ Error en segunda ejecución: ${response.status}`, 'red');
      return { success: false, error: 'Unexpected status' };
    }
    
  } catch (error) {
    log(`❌ Error en prueba de duplicados: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function cleanup() {
  log('\n🧹 Limpiando datos de prueba de API...', 'yellow');
  
  try {
    // Intentar eliminar coberturas de prueba mediante endpoint
    const response = await axios.delete(`${API_BASE_URL}/coverages/project/${TEST_PROJECT_ID}`, {
      timeout: 10000
    });
    
    if (response.status === 200) {
      log('✅ Datos de prueba eliminados via API', 'green');
    } else {
      log('⚠️ No se pudieron eliminar todos los datos via API', 'yellow');
    }
  } catch (error) {
    log('⚠️ Error al limpiar via API, datos pueden quedar residuales', 'yellow');
  }
}

async function runAPITestSuite() {
  log('🌐 INICIANDO PRUEBAS DE LA API DE COBERTURAS', 'magenta');
  log('==============================================', 'magenta');
  
  const results = {
    serverConnection: false,
    autoDetect: { success: false },
    getCoverages: { success: false },
    updateGeography: { success: false },
    duplicatePrevention: { success: false, noDuplicates: false }
  };
  
  try {
    // 1. Conexión al servidor
    results.serverConnection = await testServerConnection();
    if (!results.serverConnection) {
      log('\n❌ Pruebas abortadas: no hay conexión al servidor', 'red');
      log('💡 Asegúrate de que ExtractorW esté corriendo con: npm start', 'yellow');
      return results;
    }
    
    // 2. Auto-detect de coberturas
    results.autoDetect = await testAutoDetectEndpoint();
    
    // 3. Obtener coberturas
    results.getCoverages = await testGetCoveragesEndpoint();
    
    // 4. Actualizar geografía (si hay coberturas disponibles)
    if (results.getCoverages.success && results.getCoverages.data.length > 0) {
      const firstCoverageId = results.getCoverages.data[0].id;
      results.updateGeography = await testUpdateGeographyEndpoint(firstCoverageId);
    }
    
    // 5. Prevención de duplicados
    results.duplicatePrevention = await testDuplicateAutoDetect();
    
  } catch (error) {
    log(`\n❌ Error general en pruebas de API: ${error.message}`, 'red');
  }
  
  // Resumen final
  log('\n📋 RESUMEN DE PRUEBAS API', 'magenta');
  log('=========================', 'magenta');
  
  log(`• Conexión Servidor: ${results.serverConnection ? '✅' : '❌'}`, results.serverConnection ? 'green' : 'red');
  log(`• Auto-detect: ${results.autoDetect.success ? '✅' : '❌'}`, results.autoDetect.success ? 'green' : 'red');
  log(`• Obtener Coberturas: ${results.getCoverages.success ? '✅' : '❌'}`, results.getCoverages.success ? 'green' : 'red');
  log(`• Actualizar Geografía: ${results.updateGeography.success ? '✅' : '❌'}`, results.updateGeography.success ? 'green' : 'red');
  log(`• Prevención Duplicados: ${results.duplicatePrevention.success ? '✅' : '❌'}`, results.duplicatePrevention.success ? 'green' : 'red');
  
  if (results.duplicatePrevention.success) {
    log(`  └─ Sin duplicados: ${results.duplicatePrevention.noDuplicates ? '✅' : '❌'}`, 
        results.duplicatePrevention.noDuplicates ? 'green' : 'yellow');
  }
  
  const allTestsPassed = results.serverConnection && 
                        results.autoDetect.success && 
                        results.getCoverages.success && 
                        results.duplicatePrevention.success &&
                        results.duplicatePrevention.noDuplicates;
  
  log(`\n🎯 RESULTADO API: ${allTestsPassed ? 'TODAS LAS PRUEBAS EXITOSAS ✅' : 'ALGUNAS PRUEBAS FALLARON ❌'}`, 
      allTestsPassed ? 'green' : 'red');
  
  // Limpiar datos de prueba
  await cleanup();
  
  return results;
}

// Función de ayuda para pruebas manuales
async function quickTest() {
  log('🚀 PRUEBA RÁPIDA DE API', 'cyan');
  log('======================', 'cyan');
  
  const connected = await testServerConnection();
  if (connected) {
    log('🎉 ¡Servidor está funcionando correctamente!', 'green');
    log('💡 Ejecuta el test completo con: node test-coverages-api.js', 'cyan');
  }
}

// Ejecutar las pruebas si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    quickTest()
      .then(() => process.exit(0))
      .catch(error => {
        log(`💥 Error: ${error.message}`, 'red');
        process.exit(1);
      });
  } else {
    runAPITestSuite()
      .then(() => {
        log('\n✨ Pruebas de API completadas', 'cyan');
        process.exit(0);
      })
      .catch(error => {
        log(`\n💥 Error fatal en API: ${error.message}`, 'red');
        process.exit(1);
      });
  }
}

module.exports = {
  runAPITestSuite,
  testServerConnection,
  testAutoDetectEndpoint,
  testGetCoveragesEndpoint,
  testUpdateGeographyEndpoint,
  quickTest
}; 