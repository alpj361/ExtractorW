const supabase = require('./server/utils/supabase');

async function checkCoverageTableStructure() {
  console.log('🔍 Verificando estructura de tabla project_coverages...');
  
  try {
    // Obtener algunos registros para ver la estructura
    const { data, error } = await supabase
      .from('project_coverages')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Estructura de la tabla (basada en un registro existente):');
      console.log('📋 Columnas disponibles:', Object.keys(data[0]));
      console.log('\n📝 Ejemplo de registro:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('⚠️ No hay registros en la tabla, intentando insertar uno de prueba...');
      
      // Intentar insertar un registro mínimo para ver qué campos son requeridos
      const testRecord = {
        project_id: '12345678-1234-1234-1234-123456789012', // UUID válido
        coverage_type: 'test',
        name: 'Test Coverage',
        description: 'Test description'
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('project_coverages')
        .insert(testRecord)
        .select();
      
      if (insertError) {
        console.log('❌ Error al insertar registro de prueba:');
        console.log(insertError.message);
        console.log('\n💡 Esto nos ayuda a entender qué campos son requeridos');
      } else {
        console.log('✅ Registro de prueba insertado exitosamente');
        console.log('📋 Columnas de la tabla:', Object.keys(insertData[0]));
        
        // Limpiar el registro de prueba
        await supabase
          .from('project_coverages')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Registro de prueba eliminado');
      }
    }
    
  } catch (error) {
    console.log('💥 Error fatal:', error.message);
  }
}

async function getTableColumns() {
  console.log('\n🔍 Intentando obtener información de metadatos de la tabla...');
  
  try {
    // Usar información del sistema de PostgreSQL para obtener columnas
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'project_coverages'
    });
    
    if (error) {
      console.log('❌ No hay función RPC get_table_columns disponible');
      console.log('💡 Esto es normal, usaremos otro método');
    } else {
      console.log('📋 Columnas obtenidas via RPC:', data);
    }
  } catch (error) {
    console.log('⚠️ Método RPC no disponible, continuando...');
  }
}

// Ejecutar verificaciones
async function main() {
  console.log('🧪 VERIFICACIÓN DE TABLA PROJECT_COVERAGES');
  console.log('==========================================');
  
  await checkCoverageTableStructure();
  await getTableColumns();
  
  console.log('\n✨ Verificación completada');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkCoverageTableStructure }; 