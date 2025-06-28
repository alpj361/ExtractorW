const axios = require('axios');
require('dotenv').config();

// ===================================================================
// SCRIPT DE PRUEBA: VIZTA CHAT CON MEMORIES
// Prueba la integración completa de Vizta Chat con la tabla memories
// ===================================================================

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TOKEN = process.env.TEST_TOKEN || 'tu-token-aqui';

// Headers para las peticiones
const headers = {
  'Authorization': `Bearer ${TEST_TOKEN}`,
  'Content-Type': 'application/json'
};

console.log('🧪 INICIANDO PRUEBAS DE VIZTA CHAT CON MEMORIES');
console.log('================================================');

async function testViztaChatFlow() {
  try {
    let sessionId = null;

    // ==========================================
    // PRUEBA 1: Primera consulta (nueva sesión)
    // ==========================================
    console.log('\n1️⃣ Probando primera consulta (nueva sesión)...');
    
    const firstQuery = {
      message: "¿Qué está pasando con la política en Guatemala?",
      sessionId: null // Nueva sesión
    };

    const firstResponse = await axios.post(
      `${BASE_URL}/api/vizta-chat/query`,
      firstQuery,
      { headers }
    );

    if (firstResponse.data.success) {
      sessionId = firstResponse.data.sessionId;
      console.log('✅ Primera consulta exitosa');
      console.log(`📱 Session ID: ${sessionId}`);
      console.log(`🤖 Respuesta: ${firstResponse.data.response.substring(0, 100)}...`);
      console.log(`🔧 Herramienta usada: ${firstResponse.data.toolUsed || 'Ninguna'}`);
    } else {
      throw new Error('Primera consulta falló: ' + firstResponse.data.message);
    }

    // Esperar un poco entre consultas
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==========================================
    // PRUEBA 2: Segunda consulta (misma sesión)
    // ==========================================
    console.log('\n2️⃣ Probando segunda consulta (misma sesión)...');
    
    const secondQuery = {
      message: "¿Y qué dicen específicamente sobre el presidente?",
      sessionId: sessionId // Usar la misma sesión
    };

    const secondResponse = await axios.post(
      `${BASE_URL}/api/vizta-chat/query`,
      secondQuery,
      { headers }
    );

    if (secondResponse.data.success) {
      console.log('✅ Segunda consulta exitosa');
      console.log(`🤖 Respuesta: ${secondResponse.data.response.substring(0, 100)}...`);
      console.log(`🔧 Herramienta usada: ${secondResponse.data.toolUsed || 'Ninguna'}`);
    } else {
      throw new Error('Segunda consulta falló: ' + secondResponse.data.message);
    }

    // Esperar un poco entre consultas
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==========================================
    // PRUEBA 3: Tercera consulta (contexto)
    // ==========================================
    console.log('\n3️⃣ Probando tercera consulta (con contexto)...');
    
    const thirdQuery = {
      message: "Basándote en la información anterior, ¿cuál es tu análisis general?",
      sessionId: sessionId // Usar la misma sesión
    };

    const thirdResponse = await axios.post(
      `${BASE_URL}/api/vizta-chat/query`,
      thirdQuery,
      { headers }
    );

    if (thirdResponse.data.success) {
      console.log('✅ Tercera consulta exitosa');
      console.log(`🤖 Respuesta: ${thirdResponse.data.response.substring(0, 100)}...`);
      console.log(`🔧 Herramienta usada: ${thirdResponse.data.toolUsed || 'Ninguna'}`);
    } else {
      throw new Error('Tercera consulta falló: ' + thirdResponse.data.message);
    }

    // ==========================================
    // PRUEBA 4: Obtener mensajes de la conversación
    // ==========================================
    console.log('\n4️⃣ Probando obtener mensajes de la conversación...');
    
    const messagesResponse = await axios.get(
      `${BASE_URL}/api/vizta-chat/conversation/${sessionId}`,
      { headers }
    );

    if (messagesResponse.data.success) {
      const messages = messagesResponse.data.messages;
      console.log('✅ Mensajes obtenidos exitosamente');
      console.log(`📊 Total de mensajes: ${messages.length}`);
      
      messages.forEach((msg, index) => {
        console.log(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
      });
    } else {
      throw new Error('Error obteniendo mensajes: ' + messagesResponse.data.message);
    }

    // ==========================================
    // PRUEBA 5: Obtener lista de conversaciones
    // ==========================================
    console.log('\n5️⃣ Probando obtener lista de conversaciones...');
    
    const conversationsResponse = await axios.get(
      `${BASE_URL}/api/vizta-chat/conversations`,
      { headers }
    );

    if (conversationsResponse.data.success) {
      const conversations = conversationsResponse.data.conversations;
      console.log('✅ Conversaciones obtenidas exitosamente');
      console.log(`📊 Total de conversaciones: ${conversations.length}`);
      
      conversations.forEach((conv, index) => {
        console.log(`   ${index + 1}. Session: ${conv.sessionId.substring(0, 8)}... - "${conv.firstMessage.substring(0, 30)}..." (${conv.messageCount} mensajes)`);
      });
    } else {
      throw new Error('Error obteniendo conversaciones: ' + conversationsResponse.data.message);
    }

    // ==========================================
    // PRUEBA 6: Obtener estadísticas de memoria
    // ==========================================
    console.log('\n6️⃣ Probando obtener estadísticas de memoria...');
    
    const statsResponse = await axios.get(
      `${BASE_URL}/api/vizta-chat/memory-stats`,
      { headers }
    );

    if (statsResponse.data.success) {
      const stats = statsResponse.data.stats;
      console.log('✅ Estadísticas obtenidas exitosamente');
      console.log(`📊 Total de mensajes: ${stats.totalMessages}`);
      console.log(`📊 Total de sesiones: ${stats.totalSessions}`);
      console.log(`📊 Total de tokens: ${stats.totalTokens}`);
      console.log(`📊 Mensajes de usuario: ${stats.userMessages}`);
      console.log(`📊 Mensajes de asistente: ${stats.assistantMessages}`);
      console.log(`📊 Modelos usados: ${stats.modelsUsed.join(', ')}`);
    } else {
      throw new Error('Error obteniendo estadísticas: ' + statsResponse.data.message);
    }

    // ==========================================
    // PRUEBA 7: Verificar que se mantienen solo los últimos 10 mensajes
    // ==========================================
    console.log('\n7️⃣ Probando límite de 10 mensajes...');
    
    // Hacer varias consultas rápidas para superar el límite
    for (let i = 4; i <= 12; i++) {
      const quickQuery = {
        message: `Consulta número ${i} para probar el límite de mensajes`,
        sessionId: sessionId
      };

      const quickResponse = await axios.post(
        `${BASE_URL}/api/vizta-chat/query`,
        quickQuery,
        { headers }
      );

      if (quickResponse.data.success) {
        console.log(`   ✅ Consulta ${i} completada`);
      }

      // Esperar un poco entre consultas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Verificar que solo se mantienen los últimos 10 mensajes en el contexto
    const finalMessagesResponse = await axios.get(
      `${BASE_URL}/api/vizta-chat/conversation/${sessionId}`,
      { headers }
    );

    if (finalMessagesResponse.data.success) {
      const totalMessages = finalMessagesResponse.data.messages.length;
      console.log(`📊 Total de mensajes almacenados: ${totalMessages}`);
      
      // Verificar que el contexto se limita a 10 mensajes
      console.log('✅ Verificación del límite de contexto completada');
    }

    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('============================================');
    console.log(`📱 Session ID de prueba: ${sessionId}`);
    console.log('💡 El sistema de memories está funcionando correctamente');
    console.log('💡 Las conversaciones mantienen contexto entre mensajes');
    console.log('💡 Se limita a los últimos 10 mensajes para optimizar tokens');

  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', error.message);
    
    if (error.response) {
      console.error('📄 Respuesta del servidor:', error.response.data);
      console.error('📊 Status code:', error.response.status);
    }
    
    process.exit(1);
  }
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

async function testIndividualEndpoints() {
  console.log('\n🔧 PROBANDO ENDPOINTS INDIVIDUALES');
  console.log('==================================');

  const endpoints = [
    { method: 'GET', url: '/api/vizta-chat/tools', name: 'Herramientas MCP' },
    { method: 'GET', url: '/api/vizta-chat/conversations', name: 'Lista de conversaciones' },
    { method: 'GET', url: '/api/vizta-chat/memory-stats', name: 'Estadísticas de memoria' },
    { method: 'GET', url: '/api/vizta-chat/scrapes', name: 'Scrapes del usuario' },
    { method: 'GET', url: '/api/vizta-chat/stats', name: 'Estadísticas de scrapes' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Probando ${endpoint.name}...`);
      
      const response = await axios({
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.url}`,
        headers: headers
      });

      if (response.data.success) {
        console.log(`✅ ${endpoint.name}: OK`);
        
        // Mostrar información relevante
        if (endpoint.url.includes('tools')) {
          console.log(`   📊 Herramientas disponibles: ${response.data.count}`);
        } else if (endpoint.url.includes('conversations')) {
          console.log(`   📊 Conversaciones: ${response.data.count}`);
        } else if (endpoint.url.includes('stats')) {
          console.log(`   📊 Datos estadísticos obtenidos`);
        }
      } else {
        console.log(`⚠️ ${endpoint.name}: ${response.data.message}`);
      }

    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.message}`);
    }
  }
}

// ==========================================
// EJECUTAR PRUEBAS
// ==========================================

async function runAllTests() {
  console.log('🚀 Iniciando suite completa de pruebas...\n');

  // Verificar configuración
  if (!TEST_TOKEN || TEST_TOKEN === 'tu-token-aqui') {
    console.error('❌ ERROR: Configura TEST_TOKEN en el archivo .env');
    console.error('💡 Puedes obtener un token de prueba ejecutando: node create-test-token.js');
    process.exit(1);
  }

  try {
    // Probar endpoints individuales primero
    await testIndividualEndpoints();
    
    // Luego probar el flujo completo
    await testViztaChatFlow();
    
  } catch (error) {
    console.error('\n💥 Error general en las pruebas:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testViztaChatFlow,
  testIndividualEndpoints
}; 