#!/usr/bin/env node

/**
 * Script de prueba para verificar el endpoint de transcripción desde Codex
 * con políticas RLS habilitadas
 */

const fetch = require('node-fetch');

// Configuración
const EXTRACTORW_URL = process.env.EXTRACTORW_URL || 'https://server.standatpd.com';

// Token real de tu usuario - ACTUALIZA ESTE TOKEN
// Para obtener un token fresco:
// 1. Ve a PulseJ → DevTools (F12) → Console
// 2. Ejecuta: localStorage.getItem('sb-qqshdccpmypelhmyqnut-auth-token')
// 3. O en Application → Local Storage → busca el token de Supabase
const TEST_TOKEN = process.env.TEST_TOKEN || 'ACTUALIZA_ESTE_TOKEN';

const TEST_CODEX_ITEM_ID = 'b2197afe-caa9-4dc0-b9fa-a435e8f11a60';

console.log('🧪 PRUEBA DE TRANSCRIPCIÓN DESDE CODEX CON RLS');
console.log('='.repeat(60));

async function testTranscriptionFromCodex() {
  try {
    console.log(`\\n📡 Probando endpoint: ${EXTRACTORW_URL}/api/transcription/from-codex`);
    console.log(`🔑 Token: ${TEST_TOKEN.substring(0, 30)}...`);
    console.log(`📄 Codex Item ID: ${TEST_CODEX_ITEM_ID}`);

    const response = await fetch(`${EXTRACTORW_URL}/api/transcription/from-codex`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        codexItemId: TEST_CODEX_ITEM_ID,
        titulo: 'Prueba de Transcripción RLS',
        descripcion: 'Prueba del sistema de transcripción con políticas RLS',
        etiquetas: 'prueba,rls,transcripcion'
      })
    });

    console.log(`\\n📊 Status Code: ${response.status} ${response.statusText}`);
    console.log(`📋 Headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`\\n📄 Response Body:`, responseText);

    if (response.ok) {
      console.log('\\n✅ ÉXITO: El endpoint funcionó correctamente');
      const data = JSON.parse(responseText);
      if (data.success) {
        console.log(`   💬 Mensaje: ${data.message}`);
        console.log(`   📝 Transcripción creada con ID: ${data.data?.codexItem?.id}`);
        console.log(`   🔢 Créditos usados: ${data.data?.creditsUsed}`);
      }
    } else {
      console.log('\\n❌ ERROR: El endpoint falló');
      try {
        const errorData = JSON.parse(responseText);
        console.log(`   🚨 Error: ${errorData.error}`);
        console.log(`   📝 Detalles: ${errorData.details || 'No disponibles'}`);
      } catch (parseError) {
        console.log(`   📄 Respuesta cruda: ${responseText}`);
      }
    }

  } catch (error) {
    console.error('\\n💥 ERROR FATAL:', error.message);
  }
}

async function testOtherEndpoints() {
  console.log('\\n\\n🔧 PROBANDO OTROS ENDPOINTS...');
  
  // Test 1: Status del servidor
  try {
    console.log('\\n1️⃣ Verificando status del servidor...');
    const statusResponse = await fetch(`${EXTRACTORW_URL}/api/status`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`✅ Servidor online: ${statusData.status}`);
    } else {
      console.log(`❌ Servidor no disponible: ${statusResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ Error conectando al servidor: ${error.message}`);
  }

  // Test 2: Formatos soportados
  try {
    console.log('\\n2️⃣ Verificando formatos soportados...');
    const formatsResponse = await fetch(`${EXTRACTORW_URL}/api/transcription/supported-formats`);
    if (formatsResponse.ok) {
      const formatsData = await formatsResponse.json();
      console.log(`✅ Formatos disponibles:`, formatsData.data?.all?.length || 0);
    } else {
      console.log(`❌ No se pudieron obtener formatos: ${formatsResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ Error obteniendo formatos: ${error.message}`);
  }

  // Test 3: Costo de transcripción
  try {
    console.log('\\n3️⃣ Verificando costo de transcripción...');
    const costResponse = await fetch(`${EXTRACTORW_URL}/api/transcription/cost`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });
    if (costResponse.ok) {
      const costData = await costResponse.json();
      console.log(`✅ Costo: ${costData.data?.cost} créditos`);
      console.log(`💰 Créditos disponibles: ${costData.data?.userCredits}`);
    } else {
      console.log(`❌ No se pudo obtener costo: ${costResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ Error obteniendo costo: ${error.message}`);
  }
}

// Ejecutar pruebas
async function runTests() {
  await testOtherEndpoints();
  await testTranscriptionFromCodex();
  
  console.log('\\n\\n📋 RESUMEN:');
  console.log('- Si ves "✅ ÉXITO", el problema está resuelto');
  console.log('- Si ves "❌ ERROR", revisa los detalles arriba');
  console.log('- Asegúrate de que el token no esté expirado');
  console.log('- Verifica que el Codex Item ID exista y te pertenezca');
}

runTests().catch(console.error); 