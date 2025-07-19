#!/usr/bin/env node

// Test del sistema de ML Discovery para Laura
// Este script testea la nueva funcionalidad de aprendizaje dinámico

const agentesService = require('./server/services/agentesService');

async function testMLDiscovery() {
  console.log('🧪 Iniciando test del sistema ML Discovery...\n');

  // Test 1: Persona conocida (debería usar detección tradicional)
  console.log('📝 Test 1: Persona conocida');
  try {
    const result1 = await agentesService.LauraAgent.prototype.detectPersonMentionsWithML('busca a Almicar Montejo');
    console.log('Resultado:', result1);
    console.log('✅ Test 1 completado\n');
  } catch (error) {
    console.error('❌ Error en Test 1:', error.message, '\n');
  }

  // Test 2: Persona desconocida (debería usar ML Discovery)
  console.log('📝 Test 2: Persona desconocida');
  try {
    const result2 = await agentesService.LauraAgent.prototype.detectPersonMentionsWithML('busca a Roberto Molina Barreto');
    console.log('Resultado:', result2);
    console.log('✅ Test 2 completado\n');
  } catch (error) {
    console.error('❌ Error en Test 2:', error.message, '\n');
  }

  // Test 3: Query sin nombres propios
  console.log('📝 Test 3: Query sin nombres propios');
  try {
    const result3 = await agentesService.LauraAgent.prototype.detectPersonMentionsWithML('qué dicen sobre el tráfico en guatemala');
    console.log('Resultado:', result3);
    console.log('✅ Test 3 completado\n');
  } catch (error) {
    console.error('❌ Error en Test 3:', error.message, '\n');
  }

  // Test 4: Buildplan completo con persona desconocida
  console.log('📝 Test 4: Plan completo con ML Discovery');
  try {
    const laura = new agentesService.LauraAgent();
    const result4 = await laura.buildLLMPlan('busca tweets de Roberto Molina Barreto', '', { verbose: true });
    console.log('Plan generado:', JSON.stringify(result4, null, 2));
    console.log('✅ Test 4 completado\n');
  } catch (error) {
    console.error('❌ Error en Test 4:', error.message, '\n');
  }

  console.log('🏁 Tests completados');
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  testMLDiscovery().catch(console.error);
}

module.exports = { testMLDiscovery };