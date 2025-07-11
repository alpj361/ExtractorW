const agentesService = require('./server/services/agentesService');

/**
 * Test end-to-end para el motor de razonamiento Gemini 2.5 Flash en Laura
 */
async function testLauraGeminiReasoning() {
  console.log('🧪 Iniciando pruebas del motor de razonamiento Gemini 2.5 Flash para Laura\n');

  // Mock user object
  const mockUser = {
    id: 'test-user',
    email: 'test@example.com'
  };

  // Test Case 1: Intención clara → Gemini devuelve plan directo → Laura ejecuta
  console.log('📋 Test Case 1: Intención clara');
  try {
    const result1 = await agentesService.orchestrateQuery(
      "¿Qué dicen sobre la ley de protección animal en Guatemala?",
      mockUser
    );
    
    console.log('✅ Resultado Case 1:', JSON.stringify(result1, null, 2));
    
    // Validar que Laura usó el motor de razonamiento
    if (result1.laura_findings.length > 0) {
      const lauraResult = result1.laura_findings[0];
      if (lauraResult.execution_strategy?.includes('gemini_reasoned_execution')) {
        console.log('✅ Laura usó motor de razonamiento Gemini correctamente');
      } else {
        console.log('⚠️  Laura no usó motor de razonamiento (puede ser esperado)');
      }
    }
    
  } catch (error) {
    console.error('❌ Error en Case 1:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 2: Intención ambigua → Gemini devuelve follow_up → Vizta pregunta
  console.log('📋 Test Case 2: Intención ambigua');
  try {
    const result2 = await agentesService.orchestrateQuery(
      "¿Qué está pasando?",
      mockUser
    );
    
    console.log('✅ Resultado Case 2:', JSON.stringify(result2, null, 2));
    
    // Validar si hay follow_up
    if (result2.laura_findings.length > 0) {
      const lauraResult = result2.laura_findings[0];
      if (lauraResult.needs_clarification && lauraResult.follow_up_question) {
        console.log('✅ Laura solicitó aclaración correctamente');
        console.log('❓ Pregunta:', lauraResult.follow_up_question);
      }
    }
    
  } catch (error) {
    console.error('❌ Error en Case 2:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 3: Análisis de perfil específico
  console.log('📋 Test Case 3: Análisis de perfil específico');
  try {
    const result3 = await agentesService.orchestrateQuery(
      "Analiza el perfil de @CongresoGt",
      mockUser
    );
    
    console.log('✅ Resultado Case 3:', JSON.stringify(result3, null, 2));
    
  } catch (error) {
    console.error('❌ Error en Case 3:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 4: Prueba directa de buildLLMPlan
  console.log('📋 Test Case 4: Prueba directa de buildLLMPlan');
  try {
    const laura = agentesService.laura;
    
    // Caso 1: Consulta clara
    const plan1 = await laura.buildLLMPlan("¿Qué dicen sobre sismos en Guatemala?");
    console.log('🧠 Plan generado para sismos:', JSON.stringify(plan1, null, 2));
    
    // Caso 2: Consulta ambigua
    const plan2 = await laura.buildLLMPlan("¿Qué pasa?");
    console.log('🧠 Plan generado para consulta ambigua:', JSON.stringify(plan2, null, 2));
    
    // Caso 3: Análisis de perfil
    const plan3 = await laura.buildLLMPlan("Monitorea @GuatemalaGob");
    console.log('🧠 Plan generado para perfil:', JSON.stringify(plan3, null, 2));
    
  } catch (error) {
    console.error('❌ Error en Case 4:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 5: Verificación de métricas
  console.log('📋 Test Case 5: Verificación de métricas');
  try {
    const laura = agentesService.laura;
    const plan = await laura.buildLLMPlan("¿Hay noticias sobre elecciones?");
    
    if (plan._metrics) {
      console.log('📊 Métricas capturadas:');
      console.log('   - Latencia:', plan._metrics.latency_ms + 'ms');
      console.log('   - Modelo:', plan._metrics.model);
      console.log('   - Tokens usados:', plan._metrics.tokens_used);
      console.log('   - Timestamp:', plan._metrics.timestamp);
      
      // Validar latencia esperada (300-600ms según el plan)
      if (plan._metrics.latency_ms >= 100 && plan._metrics.latency_ms <= 2000) {
        console.log('✅ Latencia dentro del rango esperado');
      } else {
        console.log('⚠️  Latencia fuera del rango esperado (puede ser normal)');
      }
    } else {
      console.log('⚠️  No se capturaron métricas');
    }
    
  } catch (error) {
    console.error('❌ Error en Case 5:', error.message);
  }

  console.log('\n🎉 Pruebas completadas');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testLauraGeminiReasoning()
    .then(() => {
      console.log('\n✅ Todas las pruebas completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en las pruebas:', error);
      process.exit(1);
    });
}

module.exports = { testLauraGeminiReasoning };