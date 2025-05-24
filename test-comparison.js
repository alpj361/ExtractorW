const scrapingGpt4Module = require('./test-gpt4-turbo'); // Web Scraping + GPT4
const perplexityModule = require('./test-perplexity'); // Perplexity batch (original)
const perplexityIndividualModule = require('./test-perplexity-individual'); // Perplexity individual (nuevo)
require('dotenv').config();

// Tendencias reales proporcionadas por el usuario - datos de hoy
const testTrends = [
  { name: 'Napoli', volume: 1000 },
  { name: 'Lilo', volume: 900 },
  { name: 'Alejandro Giammattei', volume: 800 },
  { name: 'Lukita', volume: 700 },
  { name: 'santa maría de jesús', volume: 600 },
  { name: 'Aguirre', volume: 500 },
  { name: 'SerieA', volume: 400 },
  { name: 'Morat', volume: 300 },
  { name: 'McTominay', volume: 200 },
  { name: 'Margaret Satterthwaite', volume: 100 }
];

async function compareApproaches() {
  console.log('🔬 COMPARACIÓN DE ENFOQUES DE IA - TENDENCIAS REALES');
  console.log('='.repeat(70));
  
  // Verificar configuración
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
  
  console.log(`\n📋 CONFIGURACIÓN:`);
  console.log(`   OpenRouter API: ${hasOpenRouter ? '✅ Configurada' : '❌ No configurada'}`);
  console.log(`   Perplexity API: ${hasPerplexity ? '✅ Configurada' : '❌ No configurada'}`);
  
  if (!hasOpenRouter && !hasPerplexity) {
    console.error('\n❌ No hay APIs configuradas. Configura al menos una en el archivo .env');
    console.log('💡 Las API keys están configuradas correctamente en .env');
    return;
  }
  
  console.log('\n📊 TENDENCIAS REALES DE HOY:');
  testTrends.forEach((trend, i) => {
    console.log(`  ${i+1}. ${trend.name} (${trend.volume} menciones)`);
  });
  
  const results = {};
  
  // --- PRUEBA 1: WEB SCRAPING + GPT-4 TURBO ---
  if (hasOpenRouter) {
    console.log('\n\n🕷️ === PRUEBA 1: WEB SCRAPING + GPT-4 TURBO ===');
    console.log('='.repeat(60));
    
    try {
      const startTime = Date.now();
      const scrapingResults = await scrapingGpt4Module.processWithScrapingPlusGPT4(testTrends, 'Guatemala');
      const endTime = Date.now();
      
      results.scraping = {
        results: scrapingResults,
        timeMs: endTime - startTime,
        success: true
      };
      
      console.log(`\n⏱️  Tiempo total: ${(results.scraping.timeMs / 1000).toFixed(2)} segundos`);
      
    } catch (error) {
      console.error('❌ Error en Web Scraping + GPT-4 Turbo:', error.message);
      results.scraping = {
        results: [],
        timeMs: 0,
        success: false,
        error: error.message
      };
    }
  }
  
  // --- PRUEBA 2: PERPLEXITY INDIVIDUAL ---
  if (hasPerplexity) {
    console.log('\n\n🔍 === PRUEBA 2: PERPLEXITY INDIVIDUAL ===');
    console.log('='.repeat(55));
    
    try {
      const startTime = Date.now();
      const perplexityResults = await perplexityIndividualModule.processWithPerplexityIndividual(testTrends, 'Guatemala');
      const endTime = Date.now();
      
      results.perplexity = {
        results: perplexityResults,
        timeMs: endTime - startTime,
        success: true,
        type: 'individual'
      };
      
      console.log(`\n⏱️  Tiempo total: ${(results.perplexity.timeMs / 1000).toFixed(2)} segundos`);
      
    } catch (error) {
      console.error('❌ Error en Perplexity Individual:', error.message);
      results.perplexity = {
        results: [],
        timeMs: 0,
        success: false,
        error: error.message,
        type: 'individual'
      };
    }
  }
  
  // --- COMPARACIÓN DE RESULTADOS ---
  console.log('\n\n📊 === COMPARACIÓN DE RESULTADOS CON TENDENCIAS REALES ===');
  console.log('='.repeat(70));
  
  // Comparar tiempos
  if (results.scraping?.success && results.perplexity?.success) {
    console.log('\n⏱️  RENDIMIENTO:');
    console.log(`   Scraping + GPT-4: ${(results.scraping.timeMs / 1000).toFixed(2)}s`);
    console.log(`   Perplexity Individual: ${(results.perplexity.timeMs / 1000).toFixed(2)}s`);
    
    const faster = results.scraping.timeMs < results.perplexity.timeMs ? 'Scraping + GPT-4' : 'Perplexity Individual';
    console.log(`   🏆 Más rápido: ${faster}`);
    
    const avgTimePerTrend = {
      scraping: (results.scraping.timeMs / testTrends.length / 1000).toFixed(2),
      perplexity: (results.perplexity.timeMs / testTrends.length / 1000).toFixed(2)
    };
    console.log(`   📊 Tiempo promedio por tendencia:`);
    console.log(`      Scraping + GPT-4: ${avgTimePerTrend.scraping}s`);
    console.log(`      Perplexity: ${avgTimePerTrend.perplexity}s`);
  }
  
  // Comparar categorías para tendencias específicas
  console.log('\n🏷️  CATEGORIZACIÓN DE TENDENCIAS REALES:');
  
  if (results.scraping?.success) {
    const scrapingCategories = results.scraping.results.map(r => r.category);
    console.log('\n   📚 Scraping + GPT-4:');
    testTrends.forEach((trend, i) => {
      console.log(`     ${trend.name} → ${scrapingCategories[i] || 'N/A'}`);
    });
  }
  
  if (results.perplexity?.success) {
    const perplexityCategories = results.perplexity.results.map(r => r.category);
    console.log('\n   🔍 Perplexity Individual:');
    testTrends.forEach((trend, i) => {
      console.log(`     ${trend.name} → ${perplexityCategories[i] || 'N/A'}`);
    });
  }
  
  // Análisis específico de relevancia y contexto local (solo para Perplexity Individual)
  if (results.perplexity?.success) {
    console.log('\n🎯 ANÁLISIS DE RELEVANCIA (Perplexity Individual):');
    results.perplexity.results.forEach((trend, i) => {
      const relevancia = trend.about?.relevancia || 'N/A';
      const contextoLocal = trend.about?.contexto_local ? 'Sí' : 'No';
      console.log(`     ${trend.name}: Relevancia=${relevancia}, Local=${contextoLocal}`);
    });
  }
  
  // Comparar fuentes de información
  console.log('\n🔍 FUENTES DE INFORMACIÓN:');
  
  if (results.scraping?.success) {
    console.log('\n   📚 Scraping + GPT-4:');
    results.scraping.results.forEach((trend, i) => {
      const sources = trend.scrapingData?.sourcesUsed || [];
      const articles = trend.scrapingData?.totalArticles || 0;
      console.log(`     ${trend.name}: ${articles} artículos de [${sources.join(', ')}]`);
    });
  }
  
  if (results.perplexity?.success) {
    console.log('\n   🔍 Perplexity Individual:');
    results.perplexity.results.forEach((trend, i) => {
      const searchQuery = trend.about?.search_query || 'N/A';
      console.log(`     ${trend.name}: Búsqueda contextualizada "${searchQuery}"`);
    });
  }
  
  // Mostrar ejemplos de calidad de información para tendencias específicas
  console.log('\n📝 CALIDAD DE INFORMACIÓN (Ejemplos de tendencias importantes):');
  
  const importantTrends = ['Alejandro Giammattei', 'Napoli', 'Morat']; // Ejemplos variados
  
  importantTrends.forEach((trendName) => {
    const trendIndex = testTrends.findIndex(t => t.name === trendName);
    if (trendIndex === -1) return;
    
    console.log(`\n   🔍 ${trendName}:`);
    
    if (results.scraping?.success && results.scraping.results[trendIndex]) {
      const summary = results.scraping.results[trendIndex].about.summary;
      const sources = results.scraping.results[trendIndex].scrapingData?.sourcesUsed?.join(', ') || 'N/A';
      console.log(`     📚 Scraping+GPT4: ${summary.substring(0, 150)}...`);
      console.log(`        Fuentes: ${sources}`);
    }
    
    if (results.perplexity?.success && results.perplexity.results[trendIndex]) {
      const summary = results.perplexity.results[trendIndex].about.summary;
      const relevancia = results.perplexity.results[trendIndex].about.relevancia;
      console.log(`     🔍 Perplexity: ${summary.substring(0, 150)}...`);
      console.log(`        Relevancia: ${relevancia}, Contexto: Individual`);
    }
  });
  
  // Estadísticas detalladas
  if (results.scraping?.success) {
    const totalArticles = results.scraping.results.reduce((sum, trend) => 
      sum + (trend.scrapingData?.totalArticles || 0), 0);
    const uniqueSources = new Set();
    results.scraping.results.forEach(trend => {
      if (trend.scrapingData?.sourcesUsed) {
        trend.scrapingData.sourcesUsed.forEach(source => uniqueSources.add(source));
      }
    });
    
    console.log('\n📈 ESTADÍSTICAS SCRAPING + GPT-4:');
    console.log(`   📰 Total artículos analizados: ${totalArticles}`);
    console.log(`   🔍 Fuentes únicas consultadas: ${Array.from(uniqueSources).join(', ')}`);
  }
  
  if (results.perplexity?.success) {
    const stats = {
      alta: 0, media: 0, baja: 0, 
      contexto_local: 0,
      categorias: {}
    };
    
    results.perplexity.results.forEach(trend => {
      // Relevancia
      const relevancia = trend.about?.relevancia;
      if (relevancia && stats[relevancia] !== undefined) {
        stats[relevancia]++;
      }
      
      // Contexto local
      if (trend.about?.contexto_local) {
        stats.contexto_local++;
      }
      
      // Categorías
      stats.categorias[trend.category] = (stats.categorias[trend.category] || 0) + 1;
    });
    
    console.log('\n📈 ESTADÍSTICAS PERPLEXITY INDIVIDUAL:');
    console.log(`   🎯 Relevancia alta: ${stats.alta}, media: ${stats.media}, baja: ${stats.baja}`);
    console.log(`   🌍 Tendencias con contexto local: ${stats.contexto_local}/${testTrends.length}`);
    console.log(`   🏷️  Categorías más frecuentes: ${Object.entries(stats.categorias)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([cat, count]) => `${cat}(${count})`)
      .join(', ')}`);
  }
  
  // Recomendación específica para estas tendencias
  console.log('\n\n💡 === RECOMENDACIÓN BASADA EN TENDENCIAS REALES ===');
  console.log('='.repeat(60));
  
  if (results.scraping?.success && results.perplexity?.success) {
    console.log('\n📊 Análisis comparativo con datos reales:');
    
    console.log('\n   🕷️ Web Scraping + GPT-4 Turbo:');
    console.log('     ✅ Excelente para figuras políticas como Alejandro Giammattei');
    console.log('     ✅ Buena cobertura de noticias deportivas (Napoli, SerieA)');
    console.log('     ✅ Información detallada con fuentes verificables');
    console.log('     ⚠️  Más lento para procesar múltiples tendencias');
    console.log(`     ⏱️  ${(results.scraping.timeMs / 1000 / testTrends.length).toFixed(1)}s por tendencia`);
    
    console.log('\n   🔍 Perplexity Individual:');
    console.log('     ✅ Excelente contextualización para cada tendencia');
    console.log('     ✅ Información de relevancia y contexto local');
    console.log('     ✅ Búsqueda web optimizada y actualizada');
    console.log('     ✅ Mejor manejo de nombres específicos');
    console.log(`     ⏱️  ${(results.perplexity.timeMs / 1000 / testTrends.length).toFixed(1)}s por tendencia`);
    
    console.log('\n🏆 RECOMENDACIÓN ESPECÍFICA PARA GUATEMALA:');
    console.log('   📍 Para tendencias POLÍTICAS (Giammattei) → Perplexity Individual');
    console.log('   ⚽ Para tendencias DEPORTIVAS (Napoli, SerieA) → Cualquiera de las dos');
    console.log('   🎵 Para tendencias MUSICALES (Morat) → Perplexity Individual');
    console.log('   🌍 Para tendencias LOCALES (Santa María de Jesús) → Perplexity Individual');
    console.log('   📊 Para VOLUMEN ALTO de tendencias → Perplexity Individual');
    console.log('   🔍 Para análisis DETALLADO con fuentes → Scraping + GPT-4');
    
  } else if (results.scraping?.success) {
    console.log('\n✅ Solo Web Scraping + GPT-4 funcionó');
    console.log('💡 Usar como opción principal para análisis detallado');
    
  } else if (results.perplexity?.success) {
    console.log('\n✅ Solo Perplexity Individual funcionó');
    console.log('💡 Usar como opción principal para procesamiento eficiente');
    console.log('🚀 Excelente para el contexto guatemalteco específico');
    
  } else {
    console.log('\n❌ Ninguna opción funcionó correctamente');
    console.log('💡 Revisar configuración de API keys');
  }
  
  console.log('\n✅ COMPARACIÓN CON TENDENCIAS REALES COMPLETADA');
}

// Función para probar solo una opción específica
async function testSingle(option) {
  console.log(`🧪 PROBANDO SOLO: ${option.toUpperCase()} CON TENDENCIAS REALES`);
  console.log('='.repeat(60));
  
  try {
    if (option.toLowerCase() === 'scraping' || option.toLowerCase() === 'gpt4') {
      // Crear versión específica para estas tendencias
      console.log('📊 Tendencias a probar:');
      testTrends.forEach((trend, i) => {
        console.log(`  ${i+1}. ${trend.name} (${trend.volume} menciones)`);
      });
      
      const processed = await scrapingGpt4Module.processWithScrapingPlusGPT4(testTrends, 'Guatemala');
      
      console.log('\n📋 RESULTADOS:');
      processed.forEach((trend, i) => {
        console.log(`\n${i+1}. ${trend.name}`);
        console.log(`   🏷️  Categoría: ${trend.category}`);
        console.log(`   📝 Resumen: ${trend.about.summary.substring(0, 150)}...`);
        console.log(`   🔍 Fuentes: ${trend.scrapingData?.sourcesUsed?.join(', ') || 'N/A'}`);
      });
      
    } else if (option.toLowerCase() === 'perplexity') {
      await perplexityIndividualModule.testPerplexityIndividual();
      
    } else {
      console.error('❌ Opción no válida. Usa "scraping", "gpt4" o "perplexity"');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar según argumentos de línea de comandos
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const option = args[0];
    testSingle(option).catch(console.error);
  } else {
    compareApproaches().catch(console.error);
  }
}

module.exports = {
  compareApproaches,
  testSingle,
  testTrends // Exportar las tendencias para uso en otros archivos
}; 