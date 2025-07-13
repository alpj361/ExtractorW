const { getAboutFromPerplexityIndividual } = require('./server/services/perplexity');

/**
 * Script de prueba para verificar las correcciones al parsing JSON de Perplexity
 */

async function testPerplexityFix() {
  console.log('🧪 PRUEBA DE CORRECCIONES AL PARSING JSON DE PERPLEXITY');
  console.log('='.repeat(60));
  
  // Simular algunos casos de prueba
  const testCases = [
    'Honduras',
    'Santa María de Jesús',
    'Justin Bieber',
    'Guatemala política',
    'Joviel'
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Probando: "${testCase}"`);
    console.log('-'.repeat(40));
    
    try {
      const result = await getAboutFromPerplexityIndividual(testCase, 'Guatemala');
      
      console.log(`✅ Éxito para "${testCase}"`);
      console.log(`   📝 Nombre: ${result.nombre}`);
      console.log(`   🏷️  Categoría: ${result.categoria}`);
      console.log(`   📊 Relevancia: ${result.relevancia}`);
      console.log(`   🔍 Fuente: ${result.source}`);
      console.log(`   📄 Resumen: ${result.resumen ? result.resumen.substring(0, 100) + '...' : 'N/A'}`);
      
      // Verificar que se incluya análisis de controversia
      if (result.controversy_analysis) {
        console.log(`   🎯 Controversia: Nivel ${result.controversy_analysis.controversy_level}, Score ${result.controversy_analysis.controversy_score}`);
      } else {
        console.log(`   ⚠️ Sin análisis de controversia`);
      }
      
    } catch (error) {
      console.error(`❌ Error para "${testCase}": ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
    
    // Pausa entre pruebas para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 PRUEBA COMPLETADA');
  console.log('='.repeat(60));
}

// Función para probar el parsing JSON con diferentes casos
function testJSONParsing() {
  console.log('\n🧪 PRUEBA DE PARSING JSON');
  console.log('='.repeat(40));
  
  const testJSONs = [
    // JSON válido
    '{"nombre": "Test", "categoria": "Prueba", "resumen": "Test válido"}',
    
    // JSON con coma final
    '{"nombre": "Test", "categoria": "Prueba", "resumen": "Test con coma",}',
    
    // JSON incompleto
    '{"nombre": "Test", "categoria": "Prueba", "resumen": "Test incompleto"',
    
    // JSON en markdown
    '```json\n{"nombre": "Test", "categoria": "Prueba", "resumen": "Test en markdown"}\n```',
    
    // JSON con explicación
    'Aquí está el análisis:\n{"nombre": "Test", "categoria": "Prueba", "resumen": "Test con explicación"}',
  ];
  
  for (const [index, testJson] of testJSONs.entries()) {
    console.log(`\n🔍 Caso ${index + 1}: ${testJson.substring(0, 50)}...`);
    
    try {
      // Simular el proceso de extracción y limpieza
      let jsonString = null;
      
      // Patrón 1: JSON completo entre llaves
      const jsonMatch1 = testJson.match(/\{[\s\S]*\}/);
      if (jsonMatch1) {
        jsonString = jsonMatch1[0];
        console.log(`   ✅ JSON encontrado con patrón 1`);
      }
      
      // Patrón 2: JSON después de ``` (código JSON)
      if (!jsonString) {
        const jsonMatch2 = testJson.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch2) {
          jsonString = jsonMatch2[1];
          console.log(`   ✅ JSON encontrado con patrón 2`);
        }
      }
      
      if (jsonString) {
        // Limpiar JSON
        jsonString = jsonString.trim();
        jsonString = jsonString.replace(/,\s*}/g, '}');
        jsonString = jsonString.replace(/,\s*]/g, ']');
        
        // Reparar JSON incompleto
        if (!jsonString.endsWith('}')) {
          const openBraces = (jsonString.match(/\{/g) || []).length;
          const closeBraces = (jsonString.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          
          if (missingBraces > 0) {
            jsonString += '}'.repeat(missingBraces);
            console.log(`   🔧 Agregadas ${missingBraces} llaves faltantes`);
          }
        }
        
        const parsed = JSON.parse(jsonString);
        console.log(`   ✅ Parsing exitoso: ${JSON.stringify(parsed)}`);
      } else {
        console.log(`   ❌ No se pudo extraer JSON`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

// Ejecutar pruebas
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA PERPLEXITY');
  console.log('='.repeat(70));
  
  // Verificar variables de entorno
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY no está configurada');
    console.log('   Configurar: export PERPLEXITY_API_KEY="tu_api_key"');
    return;
  }
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Variables de Supabase no están configuradas');
    console.log('   Configurar: SUPABASE_URL y SUPABASE_ANON_KEY');
    return;
  }
  
  console.log('✅ Variables de entorno configuradas');
  
  // Ejecutar pruebas
  testJSONParsing();
  await testPerplexityFix();
  
  console.log('\n✅ TODAS LAS PRUEBAS COMPLETADAS');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testPerplexityFix, testJSONParsing }; 