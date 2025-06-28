const recentScrapesService = require('./server/services/recentScrapes');

async function testRecentScrapesService() {
  try {
    console.log('🧪 Probando servicio recentScrapes...\n');
    
    // Verificar que todas las funciones están disponibles
    const functions = [
      'saveScrape',
      'getUserScrapes', 
      'getUserScrapeStats',
      'getSessionScrapes',
      'cleanupOldScrapes'
    ];
    
    functions.forEach(func => {
      if (typeof recentScrapesService[func] === 'function') {
        console.log(`✅ ${func}: disponible`);
      } else {
        console.error(`❌ ${func}: NO disponible`);
        process.exit(1);
      }
    });
    
    console.log('\n🎯 Todas las funciones del servicio están disponibles');
    console.log('📋 El servicio debería funcionar correctamente con Vizta Chat');
    
  } catch (error) {
    console.error('❌ Error probando servicio:', error);
    process.exit(1);
  }
}

testRecentScrapesService(); 