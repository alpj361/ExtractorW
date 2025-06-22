require('dotenv').config();

// Test directo de la función bulkCreateCardsForProject
async function testCapturadosFunction() {
  console.log('🧪 PROBANDO FUNCIÓN BULKCREATECARDSFORPROJECT DIRECTAMENTE\n');

  try {
    // Importar la función directamente
    const { bulkCreateCardsForProject } = require('./server/services/capturados');
    
    // Usar un project_id de ejemplo (necesitarás reemplazar con uno real)
    const testProjectId = 'TEST_PROJECT_ID'; // Reemplaza con un ID real
    
    console.log(`📋 Probando con project_id: ${testProjectId}`);
    console.log('⏳ Ejecutando bulkCreateCardsForProject...\n');
    
    const result = await bulkCreateCardsForProject(testProjectId);
    
    console.log('✅ Resultado obtenido:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.total_cards === 0) {
      console.log('\n⚠️  POSIBLES CAUSAS DE 0 CARDS:');
      console.log('1. No hay items con audio_transcription en este proyecto');
      console.log('2. Todos los items ya fueron procesados anteriormente');
      console.log('3. El project_id no existe o no tiene items');
      console.log('4. Error en la configuración de Gemini API');
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando la función:', error.message);
    
    if (error.message.includes('GEMINI_API_KEY')) {
      console.log('\n🔑 PROBLEMA: GEMINI_API_KEY no configurada');
      console.log('Verifica que tengas la variable de entorno GEMINI_API_KEY en tu .env');
    }
    
    if (error.message.includes('supabaseKey is required')) {
      console.log('\n🔑 PROBLEMA: Supabase no configurado');
      console.log('Verifica que tengas SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env');
    }
  }
}

// Función para probar con un project_id específico si se proporciona como argumento
if (process.argv[2]) {
  const providedProjectId = process.argv[2];
  console.log(`🔧 Usando project_id proporcionado: ${providedProjectId}\n`);
  
  // Reemplazar el project_id de prueba
  testCapturadosFunction = async function() {
    console.log('🧪 PROBANDO FUNCIÓN BULKCREATECARDSFORPROJECT DIRECTAMENTE\n');

    try {
      const { bulkCreateCardsForProject } = require('./server/services/capturados');
      
      console.log(`📋 Probando con project_id: ${providedProjectId}`);
      console.log('⏳ Ejecutando bulkCreateCardsForProject...\n');
      
      const result = await bulkCreateCardsForProject(providedProjectId);
      
      console.log('✅ Resultado obtenido:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.total_cards === 0) {
        console.log('\n⚠️  POSIBLES CAUSAS DE 0 CARDS:');
        console.log('1. No hay items con audio_transcription en este proyecto');
        console.log('2. Todos los items ya fueron procesados anteriormente');
        console.log('3. El project_id no existe o no tiene items');
        console.log('4. Error en la configuración de Gemini API');
      }
      
    } catch (error) {
      console.error('❌ Error ejecutando la función:', error.message);
      
      if (error.message.includes('GEMINI_API_KEY')) {
        console.log('\n🔑 PROBLEMA: GEMINI_API_KEY no configurada');
        console.log('Verifica que tengas la variable de entorno GEMINI_API_KEY en tu .env');
      }
      
      if (error.message.includes('supabaseKey is required')) {
        console.log('\n🔑 PROBLEMA: Supabase no configurado');
        console.log('Verifica que tengas SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env');
      }
    }
  };
}

// Ejecutar la prueba
testCapturadosFunction().then(() => {
  console.log('\n✅ Prueba completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 