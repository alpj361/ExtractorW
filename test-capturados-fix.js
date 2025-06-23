const supabase = require('./server/utils/supabase');

async function diagnosticAndFix() {
  console.log('🔧 DIAGNÓSTICO Y REPARACIÓN DEL SISTEMA DE CAPTURADOS');
  console.log('=======================================================\n');

  try {
    // 1. Verificar estructura de la base de datos
    console.log('1. Verificando estructura de base de datos...');
    
    // Verificar tabla capturado_cards
    const { data: cardsCount, error: cardsError } = await supabase
      .from('capturado_cards')
      .select('id', { count: 'exact' })
      .limit(1);
    
    if (cardsError) {
      console.error('❌ Error accediendo a capturado_cards:', cardsError);
      return;
    }
    
    console.log(`✅ Tabla capturado_cards accesible`);
    console.log(`📊 Cards existentes: ${cardsCount?.length || 0}`);

    // 2. Verificar proyectos disponibles
    console.log('\n2. Verificando proyectos disponibles...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, title')
      .limit(5);
    
    if (projectsError) {
      console.error('❌ Error obteniendo proyectos:', projectsError);
      return;
    }
    
    console.log(`✅ Proyectos encontrados: ${projects?.length || 0}`);
    if (projects && projects.length > 0) {
      projects.forEach((project, index) => {
        console.log(`   ${index + 1}. ${project.title} (ID: ${project.id})`);
      });
    }

    // 3. Verificar codex_items con transcripción
    console.log('\n3. Verificando items con transcripción...');
    const { data: codexItems, error: codexError } = await supabase
      .from('codex_items')
      .select('id, titulo, tipo, project_id, audio_transcription')
      .not('audio_transcription', 'is', null)
      .limit(10);
    
    if (codexError) {
      console.error('❌ Error obteniendo codex_items:', codexError);
      return;
    }
    
    console.log(`✅ Items con transcripción: ${codexItems?.length || 0}`);
    if (codexItems && codexItems.length > 0) {
      codexItems.forEach((item, index) => {
        const transcriptionLength = item.audio_transcription?.length || 0;
        console.log(`   ${index + 1}. ${item.titulo} (${item.tipo}) - ${transcriptionLength} chars - Proyecto: ${item.project_id}`);
      });
    }

    // 4. Si hay items con transcripción pero no cards, ofrecer procesarlos
    if (codexItems && codexItems.length > 0 && (!cardsCount || cardsCount.length === 0)) {
      console.log('\n4. 🚀 OPORTUNIDAD DE REPARACIÓN DETECTADA');
      console.log('   Hay items con transcripción pero no cards extraídas.');
      console.log('   Vamos a procesar automáticamente...\n');

      // Procesar cada item
      const { bulkCreateCardsForProject } = require('./server/services/capturados');
      
      const projectsToProcess = [...new Set(codexItems.map(item => item.project_id))];
      
      for (const projectId of projectsToProcess) {
        console.log(`⚙️ Procesando proyecto: ${projectId}`);
        try {
          const result = await bulkCreateCardsForProject(projectId);
          console.log(`✅ Proyecto ${projectId} procesado:`);
          console.log(`   - Items procesados: ${result.processed_count}`);
          console.log(`   - Cards creadas: ${result.total_cards}`);
          
          if (result.details && result.details.length > 0) {
            result.details.forEach(detail => {
              if (detail.error) {
                console.log(`   ⚠️ Item ${detail.codex_item_id}: ${detail.error}`);
              } else {
                console.log(`   ✅ Item ${detail.codex_item_id}: ${detail.cards_created} cards`);
              }
            });
          }
        } catch (error) {
          console.error(`❌ Error procesando proyecto ${projectId}:`, error.message);
        }
      }
    }

    // 5. Verificar estado final
    console.log('\n5. Verificando estado final...');
    const { data: finalCards, error: finalError } = await supabase
      .from('capturado_cards')
      .select('id, entity, city, department, project_id')
      .limit(10);
    
    if (finalError) {
      console.error('❌ Error obteniendo estado final:', finalError);
      return;
    }
    
    console.log(`📊 Cards finales: ${finalCards?.length || 0}`);
    if (finalCards && finalCards.length > 0) {
      console.log('\n📋 Cards creadas:');
      finalCards.forEach((card, index) => {
        console.log(`   ${index + 1}. ${card.entity || 'Sin entidad'} - ${card.city || 'Sin ciudad'}, ${card.department || 'Sin departamento'} (Proyecto: ${card.project_id})`);
      });
      
      console.log('\n✅ SISTEMA REPARADO EXITOSAMENTE');
      console.log('   Ahora puedes usar el frontend para crear coberturas desde estas cards.');
    } else {
      console.log('\n⚠️ POSIBLES PROBLEMAS:');
      console.log('   1. No hay transcripciones válidas');
      console.log('   2. Error en la API de Gemini');
      console.log('   3. Transcripciones no contienen información extractable');
      console.log('   4. Variables de entorno faltantes (GEMINI_API_KEY)');
    }

  } catch (error) {
    console.error('💥 Error en diagnóstico:', error);
  }
}

// Ejecutar solo si este archivo se ejecuta directamente
if (require.main === module) {
  diagnosticAndFix();
}

module.exports = { diagnosticAndFix }; 