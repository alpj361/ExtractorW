const { obtenerContextoTweets, getAboutFromPerplexityIndividual } = require('./server/services/perplexity');

async function testContextoTweets() {
  console.log('🧪 PRUEBA: Contexto de Tweets');
  console.log('='.repeat(50));
  
  // Términos de prueba
  const terminos = [
    'Guatemala',
    'Messi', 
    'fútbol',
    'política'
  ];
  
  for (const termino of terminos) {
    console.log(`\n🔍 Probando: "${termino}"`);
    console.log('-'.repeat(30));
    
    try {
      const contexto = await obtenerContextoTweets(termino, 3);
      
      if (contexto) {
        console.log('✅ Contexto obtenido:');
        console.log(contexto);
      } else {
        console.log('📭 No se encontró contexto para este término');
      }
      
      // Pausa entre pruebas
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

async function testPerplexityConContexto() {
  console.log('\n\n🧪 PRUEBA: Perplexity con Contexto de Tweets');
  console.log('='.repeat(50));
  
  const termino = 'Guatemala'; // Término que probablemente tenga tweets
  
  try {
    console.log(`🔍 Analizando "${termino}" con Perplexity...`);
    
    const resultado = await getAboutFromPerplexityIndividual(termino, 'Guatemala', 2025);
    
    console.log('✅ Resultado de Perplexity:');
    console.log(JSON.stringify(resultado, null, 2));
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function main() {
  try {
    await testContextoTweets();
    await testPerplexityConContexto();
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

main(); 