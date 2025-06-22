require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' }
});

async function debugCapturados() {
  console.log('🔍 DIAGNÓSTICO DE CAPTURADOS\n');

  try {
    // 1. Verificar configuración
    console.log('1. Verificando configuración...');
    console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Configurado' : '❌ Faltante');
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Configurado' : '❌ Faltante');
    console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓ Configurado' : '❌ Faltante');

    // 2. Buscar proyectos existentes
    console.log('\n2. Buscando proyectos...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .limit(5);

    if (projectsError) {
      console.error('❌ Error obteniendo proyectos:', projectsError);
      return;
    }

    console.log(`   Encontrados ${projects.length} proyectos:`);
    projects.forEach(p => console.log(`   - ${p.name} (${p.id})`));

    if (projects.length === 0) {
      console.log('❌ No hay proyectos para probar');
      return;
    }

    const testProjectId = projects[0].id;
    console.log(`\n   Usando proyecto de prueba: ${testProjectId}`);

    // 3. Buscar codex_items con transcripciones
    console.log('\n3. Buscando codex_items con transcripciones...');
    const { data: codexItems, error: codexError } = await supabase
      .from('codex_items')
      .select('id, title, tipo, audio_transcription')
      .eq('project_id', testProjectId)
      .not('audio_transcription', 'is', null);

    if (codexError) {
      console.error('❌ Error obteniendo codex_items:', codexError);
      return;
    }

    console.log(`   Encontrados ${codexItems.length} items con transcripción:`);
    codexItems.forEach(item => {
      const transcriptionLength = item.audio_transcription ? item.audio_transcription.length : 0;
      console.log(`   - ${item.title} (${item.tipo}) - ${transcriptionLength} chars`);
    });

    if (codexItems.length === 0) {
      console.log('❌ No hay items con transcripción para procesar');
      return;
    }

    // 4. Verificar capturado_cards existentes
    console.log('\n4. Verificando capturado_cards existentes...');
    const { data: existingCards, error: cardsError } = await supabase
      .from('capturado_cards')
      .select('codex_item_id')
      .eq('project_id', testProjectId);

    if (cardsError) {
      console.error('❌ Error obteniendo capturado_cards:', cardsError);
      return;
    }

    const capturedIds = existingCards.map(c => c.codex_item_id);
    console.log(`   Cards existentes: ${existingCards.length}`);
    console.log(`   Items ya procesados: ${capturedIds.length}`);

    // 5. Identificar items pendientes
    const pendingItems = codexItems.filter(item => !capturedIds.includes(item.id));
    console.log(`\n5. Items pendientes de procesar: ${pendingItems.length}`);
    
    if (pendingItems.length === 0) {
      console.log('   ⚠️  Todos los items ya fueron procesados');
      console.log('   Para probar nuevamente, puedes eliminar cards existentes:');
      console.log(`   DELETE FROM capturado_cards WHERE project_id = '${testProjectId}';`);
    } else {
      console.log('   Items que serían procesados:');
      pendingItems.forEach(item => {
        const transcriptionLength = item.audio_transcription.length;
        console.log(`   - ${item.title} (${transcriptionLength} chars)`);
      });
    }

    // 6. Probar función bulkCreateCardsForProject
    console.log('\n6. Probando función bulkCreateCardsForProject...');
    const { bulkCreateCardsForProject } = require('./server/services/capturados');
    
    const result = await bulkCreateCardsForProject(testProjectId);
    console.log('   Resultado:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Ejecutar diagnóstico
debugCapturados().then(() => {
  console.log('\n✅ Diagnóstico completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 