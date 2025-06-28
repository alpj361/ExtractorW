require('dotenv').config();
const recentScrapesService = require('./server/services/recentScrapes');

// ===================================================================
// SCRIPT DE PRUEBA: RECENT SCRAPES SERVICE
// Prueba directa del servicio de recentScrapes
// ===================================================================

async function testRecentScrapesService() {
  console.log('🧪 PROBANDO SERVICIO DE RECENT SCRAPES');
  console.log('=====================================');

  try {
    // Test data
    const testUserId = '85c93b4b-455e-450b-9d01-e18f9e8dfaaa'; // Tu user ID
    const testSessionId = `test-scrape-session-${Date.now()}`;

    console.log(`📱 Session ID de prueba: ${testSessionId}`);
    console.log(`👤 User ID de prueba: ${testUserId}`);

    // Mock tweets data
    const mockTweets = [
      {
        id: '1',
        username: 'usuario1',
        content: 'Tweet de prueba sobre política en Guatemala',
        likes: 15,
        retweets: 5,
        replies: 3,
        timestamp: '2024-01-15T10:00:00Z'
      },
      {
        id: '2',
        username: 'usuario2',
        content: 'Otro tweet sobre la situación actual',
        likes: 8,
        retweets: 2,
        replies: 1,
        timestamp: '2024-01-15T10:30:00Z'
      }
    ];

    // ==========================================
    // PRUEBA 1: Guardar un scrape
    // ==========================================
    console.log('\n1️⃣ Guardando scrape...');
    
    const scrapeData = {
      queryOriginal: '¿Qué está pasando con la política en Guatemala?',
      queryClean: 'política Guatemala',
      herramienta: 'nitter_context',
      categoria: 'Política',
      tweets: mockTweets,
      userId: testUserId,
      sessionId: testSessionId,
      mcpRequestId: `test-mcp-${Date.now()}`,
      mcpExecutionTime: 1500,
      location: 'guatemala'
    };

    const saveResult = await recentScrapesService.saveScrape(scrapeData);
    
    console.log('✅ Scrape guardado exitosamente');
    console.log(`📊 Scrape ID: ${saveResult.scrapeId}`);
    console.log(`📊 Tweet count: ${saveResult.data.tweet_count}`);
    console.log(`📊 Total engagement: ${saveResult.data.total_engagement}`);
    console.log(`📊 Avg engagement: ${saveResult.data.avg_engagement}`);

    // ==========================================
    // PRUEBA 2: Obtener scrapes del usuario
    // ==========================================
    console.log('\n2️⃣ Obteniendo scrapes del usuario...');
    
    const userScrapes = await recentScrapesService.getUserScrapes(testUserId, {
      limit: 10,
      offset: 0
    });
    
    console.log(`✅ ${userScrapes.length} scrapes obtenidos:`);
    userScrapes.forEach((scrape, index) => {
      console.log(`   ${index + 1}. "${scrape.query_original}" - ${scrape.tweet_count} tweets (${scrape.herramienta})`);
    });

    // ==========================================
    // PRUEBA 3: Obtener scrapes por herramienta
    // ==========================================
    console.log('\n3️⃣ Filtrando por herramienta...');
    
    const toolScrapes = await recentScrapesService.getUserScrapes(testUserId, {
      herramienta: 'nitter_context',
      limit: 5
    });
    
    console.log(`✅ ${toolScrapes.length} scrapes con nitter_context obtenidos`);

    // ==========================================
    // PRUEBA 4: Obtener scrapes de sesión
    // ==========================================
    console.log('\n4️⃣ Obteniendo scrapes de la sesión...');
    
    const sessionScrapes = await recentScrapesService.getSessionScrapes(testSessionId);
    
    console.log(`✅ ${sessionScrapes.length} scrapes de la sesión obtenidos:`);
    sessionScrapes.forEach((scrape, index) => {
      console.log(`   ${index + 1}. "${scrape.query_original}" - ${scrape.tweet_count} tweets`);
    });

    // ==========================================
    // PRUEBA 5: Obtener estadísticas
    // ==========================================
    console.log('\n5️⃣ Obteniendo estadísticas del usuario...');
    
    const stats = await recentScrapesService.getUserScrapeStats(testUserId);
    
    console.log('✅ Estadísticas obtenidas:');
    console.log(`   📊 Total scrapes: ${stats.totalScrapes}`);
    console.log(`   📊 Total tweets: ${stats.totalTweets}`);
    console.log(`   📊 Total engagement: ${stats.totalEngagement}`);
    console.log(`   📊 Avg tweets por scrape: ${stats.avgTweetsPerScrape}`);
    console.log(`   📊 Avg engagement por scrape: ${stats.avgEngagementPerScrape}`);
    console.log(`   📊 Herramientas usadas:`, Object.keys(stats.herramientasCount));
    console.log(`   📊 Categorías usadas:`, Object.keys(stats.categoriasCount));

    // ==========================================
    // PRUEBA 6: Guardar otro scrape para probar métricas
    // ==========================================
    console.log('\n6️⃣ Guardando segundo scrape...');
    
    const secondScrapeData = {
      queryOriginal: '¿Qué dicen sobre el presidente?',
      queryClean: 'presidente Guatemala',
      herramienta: 'nitter_context',
      categoria: 'Política',
      tweets: [
        {
          id: '3',
          username: 'usuario3',
          content: 'Opinión sobre el presidente',
          likes: 25,
          retweets: 10,
          replies: 5,
          timestamp: '2024-01-15T11:00:00Z'
        }
      ],
      userId: testUserId,
      sessionId: testSessionId,
      mcpRequestId: `test-mcp-2-${Date.now()}`,
      mcpExecutionTime: 1200,
      location: 'guatemala'
    };

    const secondSaveResult = await recentScrapesService.saveScrape(secondScrapeData);
    console.log('✅ Segundo scrape guardado exitosamente');

    // Verificar estadísticas actualizadas
    const updatedStats = await recentScrapesService.getUserScrapeStats(testUserId);
    console.log(`📊 Estadísticas actualizadas - Total scrapes: ${updatedStats.totalScrapes}`);

    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('============================================');
    console.log('💡 El servicio de recent scrapes está funcionando correctamente');
    console.log(`📱 Session ID de prueba: ${testSessionId}`);

  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', error);
    
    if (error.code) {
      console.error('📄 Código de error:', error.code);
      console.error('📄 Mensaje:', error.message);
    }
    
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testRecentScrapesService();
}

module.exports = { testRecentScrapesService }; 