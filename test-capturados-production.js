#!/usr/bin/env node

// Script para probar endpoints de capturados en producción
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const BASE_URL = 'http://localhost:8080';

// Token de prueba - necesitarás reemplazar con un token válido
const TEST_TOKEN = 'Bearer YOUR_TEST_TOKEN_HERE';

// IDs de prueba - necesitarás reemplazar con IDs válidos de tu base de datos
const TEST_PROJECT_ID = 'YOUR_PROJECT_ID_HERE';
const TEST_CODEX_ITEM_ID = 'YOUR_CODEX_ITEM_ID_HERE';

async function runCurl(url, method = 'GET', data = null, headers = {}) {
  let command = `curl -X ${method} "${url}"`;
  
  // Agregar headers
  Object.entries(headers).forEach(([key, value]) => {
    command += ` -H "${key}: ${value}"`;
  });
  
  // Agregar datos si es POST
  if (data && method === 'POST') {
    command += ` -d '${JSON.stringify(data)}'`;
    command += ` -H "Content-Type: application/json"`;
  }
  
  command += ' -s'; // Silent mode para output limpio
  
  console.log(`🔄 Ejecutando: ${command}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.error('❌ Error:', stderr);
      return null;
    }
    
    try {
      return JSON.parse(stdout);
    } catch (e) {
      console.log('📄 Respuesta (texto):', stdout);
      return stdout;
    }
  } catch (error) {
    console.error('❌ Error ejecutando curl:', error.message);
    return null;
  }
}

async function testCapturadosEndpoints() {
  console.log('🧪 PROBANDO ENDPOINTS DE CAPTURADOS\n');
  console.log('==========================================\n');

  // 1. Probar endpoint GET /api/capturados (sin autenticación primero)
  console.log('1. Probando GET /api/capturados sin autenticación...');
  const result1 = await runCurl(`${BASE_URL}/api/capturados?project_id=${TEST_PROJECT_ID}`);
  console.log('Resultado:', result1);
  console.log('\n');

  // 2. Probar endpoint POST /api/capturados/bulk (sin autenticación)
  console.log('2. Probando POST /api/capturados/bulk sin autenticación...');
  const result2 = await runCurl(
    `${BASE_URL}/api/capturados/bulk`,
    'POST',
    { project_id: TEST_PROJECT_ID }
  );
  console.log('Resultado:', result2);
  console.log('\n');

  // 3. Probar con autenticación (si tienes token)
  if (TEST_TOKEN !== 'Bearer YOUR_TEST_TOKEN_HERE') {
    console.log('3. Probando con autenticación...');
    const result3 = await runCurl(
      `${BASE_URL}/api/capturados/bulk`,
      'POST',
      { project_id: TEST_PROJECT_ID },
      { 'Authorization': TEST_TOKEN }
    );
    console.log('Resultado:', result3);
    console.log('\n');
  } else {
    console.log('3. ⚠️ Saltando pruebas con autenticación (configura TEST_TOKEN)');
    console.log('\n');
  }

  // 4. Probar endpoint de stats o health para verificar que el servidor funciona
  console.log('4. Probando endpoint de salud del servidor...');
  const result4 = await runCurl(`${BASE_URL}/api/latestTrends`);
  console.log('Resultado trends:', result4 ? 'Servidor respondió' : 'Sin respuesta');
  console.log('\n');

  console.log('==========================================');
  console.log('✅ Pruebas completadas');
  console.log('\n📋 INSTRUCCIONES PARA CONFIGURAR:');
  console.log('1. Obtén un token válido de autenticación');
  console.log('2. Obtén un project_id válido de tu base de datos');
  console.log('3. Reemplaza TEST_TOKEN y TEST_PROJECT_ID en este script');
  console.log('4. Ejecuta nuevamente: node test-capturados-production.js');
}

// Verificar si se proporcionaron argumentos para configurar automáticamente
if (process.argv.length >= 4) {
  const providedToken = process.argv[2];
  const providedProjectId = process.argv[3];
  
  if (providedToken && providedProjectId) {
    console.log('🔧 Configuración detectada desde argumentos...');
    // Reemplazar valores
    TEST_TOKEN = `Bearer ${providedToken}`;
    TEST_PROJECT_ID = providedProjectId;
  }
}

// Ejecutar pruebas
testCapturadosEndpoints().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 