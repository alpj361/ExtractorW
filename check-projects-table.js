const supabase = require('./server/utils/supabase');

async function checkProjectsTable() {
  console.log('🔍 Verificando tabla projects...');
  
  try {
    // Obtener algunos proyectos existentes
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .limit(3);
    
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Proyectos encontrados:', data.length);
      console.log('📋 Columnas disponibles:', Object.keys(data[0]));
      console.log('\n📝 Ejemplo de proyecto:');
      console.log(JSON.stringify(data[0], null, 2));
      
      console.log('\n🎯 Proyecto recomendado para pruebas:');
      console.log(`   ID: ${data[0].id}`);
      console.log(`   Nombre: ${data[0].title || data[0].proyecto_nombre || 'N/A'}`);
    } else {
      console.log('⚠️ No hay proyectos en la tabla');
      
      // Intentar crear un proyecto mínimo
      const testProject = {
        id: '12345678-1234-1234-1234-123456789012'
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('projects')
        .insert(testProject)
        .select();
      
      if (insertError) {
        console.log('❌ Error al insertar proyecto de prueba:');
        console.log(insertError.message);
        console.log('\n💡 Esto nos muestra qué campos son requeridos');
      } else {
        console.log('✅ Proyecto de prueba creado');
        console.log('📋 Columnas:', Object.keys(insertData[0]));
        
        // Limpiar
        await supabase
          .from('projects')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Proyecto de prueba eliminado');
      }
    }
    
  } catch (error) {
    console.log('💥 Error fatal:', error.message);
  }
}

if (require.main === module) {
  checkProjectsTable().catch(console.error);
}

module.exports = { checkProjectsTable }; 