require('dotenv').config();

async function findTestData() {
  console.log('🔍 BUSCANDO DATOS DE PRUEBA PARA CAPTURADOS\n');
  
  try {
    // Simular una consulta directa usando curl al endpoint que sabemos que funciona
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    console.log('📋 Para hacer pruebas reales, necesitamos:');
    console.log('1. Un project_id válido');
    console.log('2. Codex_items con audio_transcription en ese proyecto');
    console.log('3. Verificar que no todos los items ya estén procesados\n');
    
    console.log('🔧 INSTRUCCIONES PARA OBTENER DATOS DE PRUEBA:');
    console.log('');
    console.log('1. Conecta a tu base de datos Supabase y ejecuta:');
    console.log('   SELECT id, name FROM projects LIMIT 5;');
    console.log('');
    console.log('2. Para un project_id específico, verifica items con transcripción:');
    console.log('   SELECT id, title, tipo, ');
    console.log('          CASE WHEN audio_transcription IS NOT NULL ');
    console.log('               THEN LENGTH(audio_transcription) ');
    console.log('               ELSE 0 END as transcription_length');
    console.log('   FROM codex_items ');
    console.log('   WHERE project_id = \'TU_PROJECT_ID\' ');
    console.log('   AND audio_transcription IS NOT NULL;');
    console.log('');
    console.log('3. Verifica capturados existentes:');
    console.log('   SELECT COUNT(*) as existing_cards, ');
    console.log('          COUNT(DISTINCT codex_item_id) as processed_items');
    console.log('   FROM capturado_cards ');
    console.log('   WHERE project_id = \'TU_PROJECT_ID\';');
    console.log('');
    console.log('4. Ejecuta la prueba con:');
    console.log('   node test-capturados-simple.js TU_PROJECT_ID');
    console.log('');
    
    // Intentar hacer una consulta básica para verificar conectividad
    console.log('🔍 Intentando verificar conectividad del servidor...');
    
    try {
      const { stdout } = await execAsync('curl -s http://localhost:8080/api/latestTrends');
      const response = JSON.parse(stdout);
      
      if (response && (response.data || response.error)) {
        console.log('✅ Servidor responde correctamente');
        console.log('📊 Ejemplo de respuesta:', response.data ? 'Con datos' : 'Sin datos/error');
      }
    } catch (e) {
      console.log('⚠️  No se pudo verificar la respuesta del servidor');
    }
    
    console.log('\n💡 SUGERENCIA:');
    console.log('Si tienes acceso directo a Supabase, puedes usar el panel web o psql para ejecutar las consultas.');
    console.log('Una vez que tengas un project_id, ejecuta:');
    console.log('node test-capturados-simple.js [PROJECT_ID]');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findTestData().then(() => {
  console.log('\n✅ Búsqueda completada');
}).catch(error => {
  console.error('❌ Error fatal:', error);
}); 