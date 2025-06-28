const axios = require('axios');

// ===================================================================
// SCRIPT DE PRUEBA RÁPIDO: MEJORAS DE FORMATO EN VIZTA CHAT
// ===================================================================

const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'https://server.standatpd.com';
const TEST_TOKEN = process.env.TEST_USER_TOKEN || 'test-token';

/**
 * Prueba las mejoras de formato con una consulta específica
 */
async function testFormatImprovements() {
  try {
    console.log('🚀 PROBANDO MEJORAS DE FORMATO EN VIZTA CHAT');
    console.log('='.repeat(50));
    
    const testQuery = 'necesito tweets de la marcha del orgullo';
    console.log(`\n🔍 Consulta de prueba: "${testQuery}"`);
    
    console.log('\n⏳ Enviando consulta al backend...');
    
    const response = await axios.post(`${EXTRACTOR_W_URL}/api/vizta-chat/query`, {
      message: testQuery,
      sessionId: `format_test_${Date.now()}`
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    if (response.data.success) {
      console.log('\n✅ CONSULTA EXITOSA - ANALIZANDO FORMATO:');
      console.log('-'.repeat(50));
      
      const responseData = response.data;
      
      console.log(`🔧 Herramienta usada: ${responseData.toolUsed || 'Ninguna'}`);
      console.log(`⏱️ Tiempo de ejecución: ${responseData.executionTime || 0}ms`);
      
      if (responseData.responseMetadata) {
        console.log(`📊 Longitud original: ${responseData.responseMetadata.originalLength} caracteres`);
        console.log(`📝 Longitud formateada: ${responseData.responseMetadata.formattedLength} caracteres`);
        console.log(`🎨 Formato aplicado: ${responseData.responseMetadata.formatApplied ? '✅ SÍ' : '❌ NO'}`);
        console.log(`📈 Tweets analizados: ${responseData.responseMetadata.tweetsAnalyzed || 0}`);
      }
      
      console.log('\n📋 RESPUESTA FORMATEADA:');
      console.log('='.repeat(50));
      console.log(responseData.response);
      console.log('='.repeat(50));
      
      // Verificar mejoras aplicadas
      const mejoras = [];
      if (responseData.response.includes('##')) mejoras.push('✅ Headers markdown');
      if (responseData.response.includes('###')) mejoras.push('✅ Subheaders markdown');
      if (responseData.response.includes('•')) mejoras.push('✅ Bullets para listas');
      if (responseData.response.length < 2000) mejoras.push('✅ Longitud controlada');
      if (/[📊📈💭⚡🎯🔍]/.test(responseData.response)) mejoras.push('✅ Emojis visuales');
      if (responseData.response.includes('**')) mejoras.push('✅ Texto en negrita');
      
      console.log('\n🎉 MEJORAS DETECTADAS:');
      if (mejoras.length > 0) {
        mejoras.forEach(mejora => console.log(`  ${mejora}`));
      } else {
        console.log('  ⚠️ No se detectaron mejoras de formato');
      }
      
      // Verificar estructura
      const tieneEstructura = responseData.response.includes('Análisis') || 
                             responseData.response.includes('Hallazgos') ||
                             responseData.response.includes('Sentimiento');
      
      console.log(`\n📐 Estructura organizada: ${tieneEstructura ? '✅ SÍ' : '❌ NO'}`);
      
      if (responseData.toolArgs) {
        console.log(`\n🎯 EXPANSIÓN DE TÉRMINOS:`);
        console.log(`  Original: "${testQuery}"`);
        console.log(`  Expandido: "${responseData.toolArgs.q}"`);
        console.log(`  Expansión aplicada: ${responseData.toolArgs.q !== testQuery ? '✅ SÍ' : '❌ NO'}`);
      }
      
      console.log('\n🎉 ¡PRUEBA COMPLETADA!');
      
      if (mejoras.length >= 4) {
        console.log('✅ Las mejoras de formato están funcionando correctamente');
      } else {
        console.log('⚠️ Algunas mejoras podrían no estar aplicándose correctamente');
      }
      
    } else {
      throw new Error(response.data.message || 'Error en la consulta');
    }

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:');
    console.error(`Mensaje: ${error.message}`);
    
    if (error.response) {
      console.error(`Código HTTP: ${error.response.status}`);
      console.error(`Datos: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    console.log('\n🔧 VERIFICACIONES:');
    console.log('1. ¿Está corriendo el servidor ExtractorW?');
    console.log('2. ¿Tienes un token de usuario válido?');
    console.log('3. ¿Las dependencias de OpenAI están instaladas?');
  }
}

/**
 * Comparar antes y después del formato
 */
async function compareFormats() {
  console.log('🔄 COMPARACIÓN DE FORMATOS');
  console.log('='.repeat(40));
  
  // Ejemplo de respuesta sin formato
  const sinFormato = `Basándome en los datos obtenidos, he encontrado información relevante sobre la marcha del orgullo en Guatemala. Los tweets analizados muestran una variedad de opiniones y sentimientos. Se detectaron hashtags como #Orgullo2025 y menciones de diversos usuarios. El sentimiento general es mixto con tendencia positiva. Hay discusiones sobre derechos LGBTI y eventos relacionados. La participación ciudadana es notable y se observa un incremento en la conversación digital sobre estos temas. Los datos sugieren una mayor visibilidad del movimiento.`;
  
  // Simular formato mejorado
  const conFormato = `## 📊 Análisis de Marcha del Orgullo

**🔍 Búsqueda realizada:** Tweets sobre eventos y manifestaciones del orgullo LGBTI en Guatemala

### 📈 Hallazgos principales:
• 15 tweets analizados con hashtags #Orgullo2025 y #MarchadelOrgullo
• Participación activa de usuarios verificados y organizaciones
• Conversación digital en aumento comparado con años anteriores

### 💭 Sentimiento general:
Predominantemente positivo (60%), con mensajes de apoyo y celebración de la diversidad

### ⚡ Insights clave:
• Mayor visibilidad del movimiento LGBTI en redes sociales guatemaltecas
• Incremento en la organización digital de eventos y actividades

### 🎯 Conclusión:
La comunidad digital muestra creciente apoyo al movimiento del orgullo en Guatemala`;

  console.log('📝 ANTES (sin formato):');
  console.log('-'.repeat(30));
  console.log(sinFormato);
  
  console.log('\n🎨 DESPUÉS (con formato):');
  console.log('-'.repeat(30));
  console.log(conFormato);
  
  console.log('\n📊 MEJORAS APLICADAS:');
  console.log('✅ Estructura clara con headers y subheaders');
  console.log('✅ Emojis para mejor navegación visual');
  console.log('✅ Bullets para información fácil de escanear');
  console.log('✅ Secciones específicas (hallazgos, sentimiento, insights)');
  console.log('✅ Respuesta más concisa y organizada');
}

// Ejecutar según parámetro
const command = process.argv[2];

if (command === 'compare') {
  compareFormats();
} else {
  testFormatImprovements();
} 