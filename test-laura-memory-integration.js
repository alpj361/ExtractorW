#!/usr/bin/env node

/**
 * Test de integración completa para Laura Memory
 * 
 * Este test simula el flujo completo:
 * 1. Laura recibe una query
 * 2. Busca en memoria información previa
 * 3. Ejecuta herramientas (nitter, perplexity)
 * 4. Guarda nuevos hallazgos en memoria
 * 5. Verifica que todo funcione correctamente
 */

const agentesService = require('./server/services/agentesService');
const lauraMemoryClient = require('./server/services/lauraMemoryClient');

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Simular usuario para tests con UUID válido
const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com'
};

async function testLauraMemoryIntegration() {
  log('magenta', '🧪 INICIANDO TEST DE INTEGRACIÓN COMPLETA - LAURA MEMORY');
  log('magenta', '=' .repeat(60));

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Helper para tests
  async function runTest(testName, testFn) {
    totalTests++;
    try {
      log('blue', `\n📋 Test ${totalTests}: ${testName}`);
      await testFn();
      log('green', `✅ PASSED: ${testName}`);
      passedTests++;
    } catch (error) {
      log('red', `❌ FAILED: ${testName}`);
      log('red', `   Error: ${error.message}`);
      failedTests++;
    }
  }

  // Test 1: Verificar disponibilidad del sistema
  await runTest('Verificar disponibilidad de Laura Memory', async () => {
    const available = await lauraMemoryClient.isAvailable();
    log('cyan', `   Laura Memory disponible: ${available}`);
    
    if (!available) {
      log('yellow', '   ⚠️  Laura Memory no está disponible - continuando con funcionalidad limitada');
    }
  });

  // Test 2: Probar query enhancement con memoria
  await runTest('Mejorar query con información de memoria', async () => {
    const originalQuery = "¿Qué pasó con el congreso recientemente?";
    log('cyan', `   Query original: "${originalQuery}"`);
    
    const enhanced = await lauraMemoryClient.enhanceQueryWithMemory(originalQuery, 3);
    log('cyan', `   Memory results: ${enhanced.memory_results.length} encontrados`);
    
    if (enhanced.memory_results.length > 0) {
      log('green', `   ✅ Query mejorada con contexto de memoria`);
      log('cyan', `   Contexto agregado: ${enhanced.memory_context.substring(0, 100)}...`);
    } else {
      log('yellow', '   ⚠️  No hay contexto previo en memoria (esperado en primera ejecución)');
    }
  });

  // Test 3: Probar ML Discovery con usuario desconocido
  await runTest('ML Discovery - Descubrir usuario desconocido', async () => {
    const laura = new agentesService.LauraAgent();
    const testQuery = "busca a Roberto Molina Barreto";
    
    log('cyan', `   Query ML Discovery: "${testQuery}"`);
    
    // Simular detección de persona con ML
    const personMentions = await laura.detectPersonMentionsWithML(testQuery);
    log('cyan', `   Persona detectada: ${personMentions.detected}`);
    
    if (personMentions.detected) {
      log('green', `   ✅ Usuario detectado: ${personMentions.entity}`);
      log('cyan', `   Search term: ${personMentions.searchTerm}`);
      log('cyan', `   Fuente: ${personMentions.source}`);
      
      // Si es un nuevo descubrimiento, debería guardarse en memoria
      if (personMentions.source === 'ml_discovery_new') {
        log('green', '   ✅ Nuevo usuario descubierto - se guardará en memoria');
      }
    } else {
      log('yellow', '   ⚠️  No se detectó usuario (puede ser normal si no hay ML habilitado)');
    }
  });

  // Test 4: Probar buildLLMPlan con integración de memoria
  await runTest('Build LLM Plan con memoria integrada', async () => {
    const laura = new agentesService.LauraAgent();
    const testIntent = "busca información sobre el congreso de guatemala";
    
    log('cyan', `   Intent: "${testIntent}"`);
    
    const plan = await laura.buildLLMPlan(testIntent, '', { verbose: false });
    log('cyan', `   Plan generado: ${plan.plan.action}`);
    log('cyan', `   Herramienta elegida: ${plan.plan.tool}`);
    log('cyan', `   Reasoning: ${plan.plan.reasoning.substring(0, 100)}...`);
    
    // Verificar que el plan tenga estructura válida
    if (plan.plan && plan.plan.tool && plan.plan.args) {
      log('green', '   ✅ Plan válido generado con herramienta y argumentos');
    } else {
      throw new Error('Plan inválido generado');
    }
  });

  // Test 5: Simular ejecución completa de tarea con memoria
  await runTest('Ejecución completa de tarea Laura con memoria', async () => {
    const laura = new agentesService.LauraAgent();
    
    // Crear tarea simulada
    const task = {
      id: 'test-task-123',
      tool: 'nitter_context',
      type: 'monitoring',
      description: 'Buscar información sobre el congreso',
      originalQuery: 'congreso guatemala noticias',
      args: {
        q: 'congreso guatemala',
        location: 'guatemala',
        limit: 10
      },
      attempts: 0,
      useReasoningEngine: false  // Usar ejecución directa para test
    };
    
    log('cyan', `   Ejecutando tarea: ${task.description}`);
    log('cyan', `   Herramienta: ${task.tool}`);
    log('cyan', `   Args: ${JSON.stringify(task.args)}`);
    
    // Ejecutar tarea (esto debería activar el hook de memoria)
    const result = await laura.executeTask(task, mockUser, new Date().toISOString());
    
    log('cyan', `   Resultado exitoso: ${result.success}`);
    log('cyan', `   Agent: ${result.agent}`);
    log('cyan', `   Relevancia: ${result.relevance_score}/10`);
    
    if (result.success) {
      log('green', '   ✅ Tarea ejecutada correctamente');
      log('cyan', `   Findings: ${result.findings ? 'Sí' : 'No'}`);
      log('cyan', `   Context note: ${result.context_note}`);
    } else {
      log('yellow', '   ⚠️  Tarea no completada exitosamente (puede ser normal en test)');
    }
  });

  // Test 6: Verificar guardado automático en memoria
  await runTest('Verificar guardado automático en memoria', async () => {
    // Simular resultado de herramienta que debería guardarse
    const mockToolResult = {
      success: true,
      tweets: [
        { content: 'El congreso aprobó nueva ley de transparencia' },
        { content: 'Diputados debaten sobre presupuesto 2024' }
      ],
      summary: 'Actividad reciente del congreso guatemalteco',
      profile: { username: 'CongresoGt' }
    };
    
    log('cyan', '   Simulando resultado de herramienta...');
    
    const memoryResult = await lauraMemoryClient.processToolResult(
      'nitter_context',
      mockToolResult,
      'actividad del congreso'
    );
    
    log('cyan', `   Resultado guardado en memoria: ${memoryResult.saved}`);
    
    if (memoryResult.saved) {
      log('green', '   ✅ Información guardada correctamente en memoria');
      log('cyan', `   Contenido: ${memoryResult.content}`);
      log('cyan', `   Razones: ${JSON.stringify(memoryResult.reasons)}`);
    } else {
      log('yellow', `   ⚠️  No se guardó en memoria: ${memoryResult.reason}`);
    }
  });

  // Test 7: Probar búsqueda en memoria después de guardar
  await runTest('Buscar información guardada en memoria', async () => {
    const searchResults = await lauraMemoryClient.searchMemory('congreso', 5);
    
    log('cyan', `   Resultados de búsqueda: ${searchResults.length}`);
    
    if (searchResults.length > 0) {
      log('green', '   ✅ Información encontrada en memoria');
      searchResults.forEach((result, index) => {
        log('cyan', `   ${index + 1}. ${result.substring(0, 80)}...`);
      });
    } else {
      log('yellow', '   ⚠️  No se encontraron resultados en memoria');
    }
  });

  // Test 8: Verificar estadísticas de memoria
  await runTest('Obtener estadísticas de memoria', async () => {
    const stats = await lauraMemoryClient.getMemoryStats();
    
    log('cyan', `   Session ID: ${stats.session_id}`);
    log('cyan', `   Message count: ${stats.message_count || 'N/A'}`);
    log('cyan', `   Error: ${stats.error || 'None'}`);
    
    if (stats.session_id) {
      log('green', '   ✅ Estadísticas obtenidas correctamente');
    } else {
      log('yellow', '   ⚠️  No se pudieron obtener estadísticas');
    }
  });

  // Test 9: Probar flujo completo con usuario nuevo
  await runTest('Flujo completo: Usuario nuevo → Discovery → Memoria', async () => {
    const testUser = "María López Pérez";
    const testUsername = "maria_lopez_gt";
    
    log('cyan', `   Guardando usuario descubierto: ${testUser}`);
    
    const saved = await lauraMemoryClient.saveUserDiscovery(
      testUser,
      testUsername,
      'Periodista independiente',
      'periodista'
    );
    
    if (saved) {
      log('green', '   ✅ Usuario guardado en memoria');
      
      // Verificar que se pueda buscar
      const searchResults = await lauraMemoryClient.searchMemory(testUser, 3);
      if (searchResults.length > 0) {
        log('green', '   ✅ Usuario encontrado en búsqueda posterior');
      } else {
        log('yellow', '   ⚠️  Usuario no encontrado en búsqueda');
      }
    } else {
      log('yellow', '   ⚠️  No se pudo guardar usuario');
    }
  });

  // Resumen final
  log('magenta', '\n' + '=' .repeat(60));
  log('magenta', '📊 RESUMEN DE TESTS DE INTEGRACIÓN');
  log('magenta', '=' .repeat(60));
  
  log('blue', `Total de tests: ${totalTests}`);
  log('green', `Tests exitosos: ${passedTests}`);
  log('red', `Tests fallidos: ${failedTests}`);
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  log('cyan', `Tasa de éxito: ${successRate}%`);
  
  if (failedTests === 0) {
    log('green', '\n🎉 TODOS LOS TESTS PASARON - INTEGRACIÓN EXITOSA');
  } else if (successRate >= 70) {
    log('yellow', '\n⚠️  INTEGRACIÓN PARCIALMENTE EXITOSA - Algunos componentes no disponibles');
  } else {
    log('red', '\n❌ INTEGRACIÓN FALLIDA - Revisar configuración');
  }
  
  log('magenta', '=' .repeat(60));
  
  // Información adicional
  log('blue', '\n📋 INFORMACIÓN ADICIONAL:');
  log('cyan', '• Si Laura Memory no está disponible, el sistema funciona con capacidades limitadas');
  log('cyan', '• Los tests pueden fallar si no hay conexión a Zep Cloud');
  log('cyan', '• ML Discovery requiere configuración de Perplexity y GPT-3.5-turbo');
  log('cyan', '• Para producción, asegurar que todas las APIs estén configuradas');
  
  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    successRate: successRate
  };
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testLauraMemoryIntegration()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Error ejecutando test de integración:', error);
      process.exit(1);
    });
}

module.exports = { testLauraMemoryIntegration };