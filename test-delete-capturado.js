require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables de entorno faltantes: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' }
});

async function testDeleteCapturado() {
  console.log('🧪 Test: Eliminar Capturado Card');
  console.log('=====================================\n');

  try {
    // 1. Primero obtener una tarjeta existente para eliminar
    console.log('1. Obteniendo tarjetas existentes...');
    const { data: cards, error: fetchError } = await supabase
      .from('capturado_cards')
      .select('id, entity, description, project_id')
      .limit(5);

    if (fetchError) {
      throw fetchError;
    }

    if (!cards || cards.length === 0) {
      console.log('❌ No hay tarjetas capturado para probar eliminación');
      return;
    }

    console.log(`✅ Encontradas ${cards.length} tarjetas:`);
    cards.forEach((card, index) => {
      console.log(`   ${index + 1}. ID: ${card.id} | Entidad: ${card.entity} | Proyecto: ${card.project_id}`);
    });

    // 2. Tomar la primera tarjeta para eliminar
    const cardToDelete = cards[0];
    console.log(`\n2. Eliminando tarjeta: ${cardToDelete.id}`);

    // 3. Probar el endpoint DELETE
    const EXTRACTORW_URL = process.env.EXTRACTORW_API_URL || 'http://localhost:3000';
    const response = await fetch(`${EXTRACTORW_URL}/api/capturados/${cardToDelete.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer dummy-token-for-test`, // En producción usar token real
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log('✅ Respuesta del endpoint:', result);

    // 4. Verificar que la tarjeta fue eliminada
    console.log('\n3. Verificando eliminación...');
    const { data: deletedCard, error: verifyError } = await supabase
      .from('capturado_cards')
      .select('id')
      .eq('id', cardToDelete.id)
      .single();

    if (verifyError && verifyError.code === 'PGRST116') {
      console.log('✅ Tarjeta eliminada correctamente de la base de datos');
    } else if (deletedCard) {
      console.log('❌ La tarjeta aún existe en la base de datos');
    } else {
      console.log('⚠️ Error verificando eliminación:', verifyError);
    }

    // 5. Mostrar estado final
    console.log('\n4. Estado final de tarjetas...');
    const { data: finalCards, error: finalError } = await supabase
      .from('capturado_cards')
      .select('id, entity')
      .eq('project_id', cardToDelete.project_id);

    if (finalError) {
      throw finalError;
    }

    console.log(`✅ Tarjetas restantes en proyecto ${cardToDelete.project_id}: ${finalCards?.length || 0}`);

  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

// Ejecutar test
testDeleteCapturado(); 