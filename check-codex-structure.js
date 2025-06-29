// Script para verificar la estructura de la tabla codex_items
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCodexStructure() {
  try {
    console.log('🔍 Verificando estructura de tabla codex_items...');
    
    // Intentar obtener algunos registros para ver la estructura
    const { data, error } = await supabase
      .from('codex_items')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Estructura de codex_items:');
      console.log('Columnas disponibles:', Object.keys(data[0]));
      console.log('\nPrimer registro:', data[0]);
    } else {
      console.log('⚠️ No hay registros en codex_items, verificando con describe');
      
      // Intentar obtener metadatos de la tabla
      const { data: tableInfo, error: tableError } = await supabase
        .rpc('get_table_columns', { table_name: 'codex_items' });
      
      if (tableError) {
        console.log('⚠️ No se pudo obtener metadatos:', tableError.message);
      } else {
        console.log('✅ Metadatos de tabla:', tableInfo);
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

checkCodexStructure(); 