require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createCardsFromCodex } = require('./server/services/capturados');

// Usar las credenciales correctas
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

async function testSingleVideo() {
  console.log('🧪 PROBANDO VIDEO ESPECÍFICO: "Buses Sin Usar"\n');
  
  const projectId = '70b20c74-c140-4929-ac11-18e125aea1d4';
  const codexItemId = '0548f4bd-c291-4e0d-a6fd-759cfccee07a'; // Buses Sin Usar
  
  try {
    // 1. Verificar el contenido de la transcripción
    console.log('1. Obteniendo transcripción completa...');
    const { data: item, error } = await supabase
      .from('codex_items')
      .select('titulo, audio_transcription')
      .eq('id', codexItemId)
      .single();
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ Video: ${item.titulo}`);
    console.log(`📄 Transcripción (${item.audio_transcription.length} chars):`);
    console.log(item.audio_transcription);
    console.log('\n' + '='.repeat(80) + '\n');
    
    // 2. Verificar si ya tiene capturados
    const { data: existing } = await supabase
      .from('capturado_cards')
      .select('*')
      .eq('codex_item_id', codexItemId);
    
    console.log(`📋 Capturados existentes: ${existing?.length || 0}`);
    
    if (existing && existing.length > 0) {
      console.log('🗑️ Eliminando capturados existentes para probar nuevamente...');
      await supabase
        .from('capturado_cards')
        .delete()
        .eq('codex_item_id', codexItemId);
    }
    
    // 3. Procesar con el nuevo prompt
    console.log('⚙️ Procesando con el nuevo prompt ampliado...');
    const result = await createCardsFromCodex({
      codexItemId,
      projectId
    });
    
    console.log(`✅ Resultado: ${result.length} capturados creados`);
    
    if (result.length > 0) {
      console.log('\n📋 CAPTURADOS CREADOS:');
      result.forEach((card, index) => {
        console.log(`\n--- CAPTURADO ${index + 1} ---`);
        console.log(`Entity: ${card.entity}`);
        console.log(`Discovery: ${card.discovery}`);
        console.log(`Description: ${card.description}`);
        console.log(`Amount: ${card.amount} ${card.currency || ''}`);
        console.log(`City: ${card.city || 'N/A'}`);
        console.log(`Source: "${card.source}"`);
      });
    } else {
      console.log('⚠️ No se crearon capturados. Puede ser que el contenido no tenga hallazgos relevantes.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSingleVideo().then(() => {
  console.log('\n✅ Prueba completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 