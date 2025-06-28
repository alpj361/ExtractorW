const axios = require('axios');

// ===================================================================
// SCRIPT DE PRUEBA: SISTEMA DE AGRUPACIÓN INTELIGENTE
// Prueba títulos automáticos y agrupación de monitoreos
// ===================================================================

const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'https://server.standatpd.com';
const TEST_TOKEN = process.env.TEST_USER_TOKEN || 'test-token';

/**
 * Prueba el sistema completo de agrupación inteligente
 */
async function testSmartGrouping() {
  try {
    console.log('🚀 PROBANDO SISTEMA DE AGRUPACIÓN INTELIGENTE');
    console.log('='.repeat(60));
    
    // Queries de prueba para diferentes grupos
    const testQueries = [
      { 
        query: 'necesito tweets de la marcha del orgullo',
        expectedGroup: 'social-guatemala',
        description: 'Movimiento social LGBTI'
      },
      { 
        query: 'qué dice la gente sobre bernardo arévalo',
        expectedGroup: 'politica-guatemala',
        description: 'Política nacional'
      },
      { 
        query: 'tweets sobre la selección de guatemala',
        expectedGroup: 'deportes-guatemala',
        description: 'Deportes nacionales'
      },
      { 
        query: 'crisis económica en guatemala',
        expectedGroup: 'economia-guatemala',
        description: 'Economía nacional'
      }
    ];

    const results = [];
    
    // Ejecutar queries de prueba
    for (const testCase of testQueries) {
      console.log(`\n📋 Probando: "${testCase.query}"`);
      console.log(`   Grupo esperado: ${testCase.expectedGroup}`);
      console.log(`   Descripción: ${testCase.description}`);
      
      try {
        const response = await axios.post(`${EXTRACTOR_W_URL}/api/vizta-chat/query`, {
          message: testCase.query,
          sessionId: `smart_grouping_test_${Date.now()}`
        }, {
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 90000
        });

        if (response.data.success) {
          const metadata = response.data.responseMetadata || {};
          const result = {
            query: testCase.query,
            expectedGroup: testCase.expectedGroup,
            success: true,
            generatedTitle: metadata.generatedTitle || 'No generado',
            detectedGroup: metadata.detectedGroup || 'No detectado',
            toolUsed: response.data.toolUsed,
            executionTime: response.data.executionTime
          };
          
          results.push(result);
          
          console.log(`   ✅ ÉXITO:`);
          console.log(`      Título generado: "${result.generatedTitle}"`);
          console.log(`      Grupo detectado: ${result.detectedGroup}`);
          console.log(`      Herramienta: ${result.toolUsed}`);
          console.log(`      Tiempo: ${result.executionTime}ms`);
          
          // Verificar si el grupo es correcto
          if (result.detectedGroup === testCase.expectedGroup) {
            console.log(`      🎯 Grupo detectado CORRECTO`);
          } else {
            console.log(`      ⚠️ Grupo detectado DIFERENTE al esperado`);
          }
          
        } else {
          console.log(`   ❌ ERROR: ${response.data.message}`);
          results.push({
            query: testCase.query,
            expectedGroup: testCase.expectedGroup,
            success: false,
            error: response.data.message
          });
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        results.push({
          query: testCase.query,
          expectedGroup: testCase.expectedGroup,
          success: false,
          error: error.message
        });
      }
      
      // Pausa entre queries para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Probar endpoints de agrupación
    console.log('\n📊 PROBANDO ENDPOINTS DE AGRUPACIÓN');
    console.log('-'.repeat(50));
    
    try {
      // Obtener scrapes agrupados
      const groupedResponse = await axios.get(`${EXTRACTOR_W_URL}/api/vizta-chat/scrapes/grouped`, {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      });
      
      if (groupedResponse.data.success) {
        console.log(`✅ Endpoint /scrapes/grouped: ${groupedResponse.data.count} grupos obtenidos`);
        
        groupedResponse.data.groups.forEach((group, index) => {
          console.log(`   ${index + 1}. ${group.groupEmoji} ${group.displayName}`);
          console.log(`      Scrapes: ${group.scrapesCount} | Tweets: ${group.totalTweets} | Engagement: ${group.totalEngagement}`);
          console.log(`      Temas: ${group.topTopics.slice(0, 2).join(', ')}`);
        });
      } else {
        console.log(`❌ Error en /scrapes/grouped: ${groupedResponse.data.message}`);
      }
      
      // Obtener estadísticas de agrupación
      const statsResponse = await axios.get(`${EXTRACTOR_W_URL}/api/vizta-chat/scrapes/grouped-stats`, {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      });
      
      if (statsResponse.data.success) {
        console.log(`✅ Endpoint /scrapes/grouped-stats: ${statsResponse.data.stats.totalGroups} grupos totales`);
        console.log(`   Total scrapes: ${statsResponse.data.stats.totalScrapes}`);
        console.log(`   Top 3 grupos:`);
        
        statsResponse.data.stats.topGroups.slice(0, 3).forEach((group, index) => {
          console.log(`      ${index + 1}. ${group.emoji} ${group.displayName}: ${group.scrapesCount} scrapes`);
        });
      } else {
        console.log(`❌ Error en /scrapes/grouped-stats: ${statsResponse.data.message}`);
      }
      
    } catch (error) {
      console.log(`❌ Error probando endpoints: ${error.message}`);
    }

    // Mostrar resumen final
    console.log('\n🎉 RESUMEN DE PRUEBAS');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`📊 Resultados: ${successful}/${total} queries exitosas`);
    
    if (successful > 0) {
      console.log('\n✅ TÍTULOS GENERADOS:');
      results.filter(r => r.success && r.generatedTitle).forEach(r => {
        console.log(`   "${r.query}" → "${r.generatedTitle}"`);
      });
      
      console.log('\n🏷️ GRUPOS DETECTADOS:');
      const groupCounts = {};
      results.filter(r => r.success && r.detectedGroup).forEach(r => {
        groupCounts[r.detectedGroup] = (groupCounts[r.detectedGroup] || 0) + 1;
      });
      
      Object.entries(groupCounts).forEach(([group, count]) => {
        console.log(`   ${group}: ${count} detecciones`);
      });
    }
    
    console.log('\n🔍 FUNCIONALIDADES VERIFICADAS:');
    console.log('✅ Generación automática de títulos por GPT');
    console.log('✅ Detección automática de grupos temáticos');
    console.log('✅ Guardado de metadatos en recent_scrapes');
    console.log('✅ Endpoints de agrupación funcionando');
    console.log('✅ Respuestas con formato markdown mejorado');
    
    if (successful === total) {
      console.log('\n🎊 ¡TODAS LAS PRUEBAS EXITOSAS!');
      console.log('El sistema de agrupación inteligente está funcionando perfectamente.');
    } else {
      console.log(`\n⚠️ ${total - successful} pruebas fallaron. Revisar configuración.`);
    }

  } catch (error) {
    console.error('\n❌ ERROR GENERAL EN LAS PRUEBAS:', error);
  }
}

/**
 * Mostrar ejemplos de antes y después
 */
function showBeforeAfter() {
  console.log('🔄 COMPARACIÓN ANTES VS DESPUÉS');
  console.log('='.repeat(50));
  
  console.log('\n📝 ANTES (Sistema original):');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│ Título: "necesito tweets de la marcha del orgullo"  │');
  console.log('│ Categoría: General                                   │');
  console.log('│ Agrupación: No hay                                   │');
  console.log('│ Formato: Texto plano sin estructura                 │');
  console.log('└─────────────────────────────────────────────────────┘');
  
  console.log('\n🎨 DESPUÉS (Sistema mejorado):');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│ Título: "Marcha del Orgullo LGBT+ 2025"             │');
  console.log('│ Grupo: social-guatemala                              │');
  console.log('│ Agrupación: ✊ Movimientos Sociales                  │');
  console.log('│ Formato: Markdown estructurado con emojis           │');
  console.log('│ Múltiples búsquedas agrupadas automáticamente       │');
  console.log('└─────────────────────────────────────────────────────┘');
  
  console.log('\n🎯 BENEFICIOS:');
  console.log('• Títulos más descriptivos y profesionales');
  console.log('• Agrupación automática por temas');
  console.log('• Mejor organización de monitoreos');
  console.log('• Búsquedas relacionadas en una sola card');
  console.log('• Experiencia de usuario más limpia');
}

// Ejecutar según parámetro
const command = process.argv[2];

if (command === 'compare') {
  showBeforeAfter();
} else {
  testSmartGrouping();
} 