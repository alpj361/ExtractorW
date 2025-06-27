// ===================================================================
// DEBUG SCRIPT: Encontrar problema con coverage_id
// Identifica dónde está el error de tipo de dato
// ===================================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCoverageError() {
  console.log('🔍 Iniciando debug del error de coverage_id...\n');

  try {
    // 1. Verificar estructura de la tabla capturado_cards
    console.log('1️⃣ Verificando estructura de capturado_cards:');
    const { data: tableStructure, error: structError } = await supabase
      .rpc('get_table_info', { table_name: 'capturado_cards' })
      .single();

    if (structError) {
      console.log('   Usando consulta alternativa...');
      const { data: columns, error: colError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'capturado_cards')
        .eq('table_schema', 'public');

      if (colError) {
        console.error('❌ Error obteniendo estructura:', colError);
        return;
      }

      console.log('   Columnas de capturado_cards:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // 2. Verificar datos existentes en project_coverages
    console.log('\n2️⃣ Verificando datos en project_coverages:');
    const { data: coverages, error: covError } = await supabase
      .from('project_coverages')
      .select('id, name, coverage_type, capturados_count')
      .limit(5);

    if (covError) {
      console.error('❌ Error:', covError);
    } else {
      console.log('   Ejemplos de coberturas existentes:');
      coverages.forEach(cov => {
        console.log(`   - ID: ${cov.id} | Nombre: ${cov.name} | Tipo: ${cov.coverage_type} | Count: ${cov.capturados_count}`);
      });
    }

    // 3. Intentar una inserción de prueba
    console.log('\n3️⃣ Probando inserción con coverage_id válido:');
    
    if (coverages && coverages.length > 0) {
      const testCard = {
        title: 'Prueba Debug',
        entity: 'Test Entity',
        discovery: 'Test Discovery',
        description: 'Prueba para debug',
        project_id: '018cdec5-09ce-7bb4-aa9a-ea8b5eb4debb', // ID existente
        codex_item_id: '018cdec5-09ce-7bb4-aa9a-ea8b5eb4debb', // ID temporal
        topic: 'Debug',
        coverage_id: coverages[0].id, // UUID válido
        amount: null,
        currency: null,
        item_count: null,
        city: 'Test City',
        department: 'Test Department',
        pais: 'Guatemala',
        start_date: null,
        duration_days: null,
        source: 'Debug test'
      };

      console.log(`   Intentando insertar con coverage_id: ${testCard.coverage_id}`);
      
      const { data: insertResult, error: insertError } = await supabase
        .from('capturado_cards')
        .insert([testCard])
        .select();

      if (insertError) {
        console.error('❌ Error en inserción de prueba:', insertError);
        console.error('   Detalles del error:', JSON.stringify(insertError, null, 2));
      } else {
        console.log('✅ Inserción de prueba exitosa:', insertResult);
        
        // Limpiar el registro de prueba
        await supabase
          .from('capturado_cards')
          .delete()
          .eq('id', insertResult[0].id);
        console.log('🧹 Registro de prueba eliminado');
      }
    }

    // 4. Verificar si hay datos con coordenadas en campos incorrectos
    console.log('\n4️⃣ Buscando datos problemáticos en capturado_cards:');
    const { data: problematicData, error: probError } = await supabase
      .from('capturado_cards')
      .select('id, coverage_id, city, department, pais')
      .limit(10);

    if (probError) {
      console.error('❌ Error:', probError);
    } else {
      console.log('   Datos actuales en capturado_cards:');
      if (problematicData.length === 0) {
        console.log('   (Sin datos existentes)');
      } else {
        problematicData.forEach(card => {
          console.log(`   - ID: ${card.id} | Coverage: ${card.coverage_id} | City: ${card.city} | Dept: ${card.department}`);
        });
      }
    }

    // 5. Verificar los triggers
    console.log('\n5️⃣ Verificando triggers de capturados_count:');
    const { data: triggers, error: trigError } = await supabase
      .rpc('pg_get_triggerdef', { trigger_oid: 'trigger_capturados_count_insert' });

    if (trigError) {
      console.log('   Usando consulta alternativa para triggers...');
      const { data: triggersList, error: trigListError } = await supabase
        .from('information_schema.triggers')
        .select('trigger_name, event_manipulation, action_statement')
        .eq('event_object_table', 'capturado_cards');

      if (trigListError) {
        console.error('❌ Error verificando triggers:', trigListError);
      } else {
        if (triggersList.length === 0) {
          console.log('   ⚠️ No se encontraron triggers en capturado_cards');
        } else {
          console.log('   Triggers encontrados:');
          triggersList.forEach(t => {
            console.log(`   - ${t.trigger_name}: ${t.event_manipulation}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Error general en debug:', error);
  }
}

// Ejecutar debug
debugCoverageError().then(() => {
  console.log('\n✅ Debug completado');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error fatal en debug:', err);
  process.exit(1);
}); 