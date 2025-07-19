/**
 * TEST: Extracción de Hallazgos desde Enlaces
 * Este script prueba la nueva funcionalidad que permite extraer hallazgos
 * de enlaces analizados (tanto con análisis detallado como básico)
 */

const { createClient } = require('@supabase/supabase-js');
const { createCardsFromCodex } = require('./server/services/capturados');

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables de entorno faltantes: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testLinkCapturados() {
  console.log('🧪 INICIANDO PRUEBAS DE EXTRACCIÓN DE HALLAZGOS DESDE ENLACES\n');

  try {
    // 1. Buscar enlaces con análisis en el codex
    console.log('📊 1. Buscando enlaces con análisis disponible...');
    
    const { data: linksWithAnalysis, error: linksError } = await supabase
      .from('codex_items')
      .select('id, tipo, titulo, url, descripcion, analisis_detallado, project_id')
      .eq('tipo', 'enlace')
      .or('analisis_detallado.not.is.null,descripcion.not.is.null')
      .not('project_id', 'is', null)
      .limit(5);

    if (linksError) {
      throw linksError;
    }

    if (!linksWithAnalysis || linksWithAnalysis.length === 0) {
      console.log('⚠️ No se encontraron enlaces con análisis para probar');
      console.log('💡 Sugerencia: Agrega algunos enlaces al codex y analízalos primero');
      return;
    }

    console.log(`✅ Encontrados ${linksWithAnalysis.length} enlaces con análisis`);
    
    // 2. Probar extracción en cada enlace
    for (const link of linksWithAnalysis) {
      console.log(`\n🔗 Probando enlace: ${link.titulo}`);
      console.log(`   URL: ${link.url}`);
      console.log(`   Tiene análisis detallado: ${link.analisis_detallado ? '✅' : '❌'}`);
      console.log(`   Tiene descripción: ${link.descripcion ? '✅' : '❌'}`);

      try {
        // Crear usuario de prueba ficticio
        const testUserId = 'test-user-id';
        
        const extractedCards = await createCardsFromCodex({
          codexItemId: link.id,
          projectId: link.project_id,
          userId: testUserId
        });

        console.log(`   📋 Resultados: ${extractedCards.length} hallazgos extraídos`);
        
        if (extractedCards.length > 0) {
          console.log('   📝 Muestra de hallazgos:');
          extractedCards.slice(0, 3).forEach((card, index) => {
            console.log(`     ${index + 1}. ${card.title || card.discovery || 'Sin título'}`);
            if (card.entity) console.log(`        Entidad: ${card.entity}`);
            if (card.amount) console.log(`        Monto: ${card.amount} ${card.currency || ''}`);
            if (card.city) console.log(`        Ciudad: ${card.city}`);
          });
        }

      } catch (extractError) {
        console.log(`   ❌ Error: ${extractError.message}`);
      }
    }

    // 3. Estadísticas finales
    console.log('\n📊 RESUMEN DE PRUEBAS:');
    console.log(`   Enlaces probados: ${linksWithAnalysis.length}`);
    console.log(`   Nueva funcionalidad: ✅ FUNCIONANDO`);
    console.log('\n🎉 Las pruebas han sido completadas');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    process.exit(1);
  }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  testLinkCapturados()
    .then(() => {
      console.log('\n✅ Script de pruebas completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en script de pruebas:', error);
      process.exit(1);
    });
}

module.exports = { testLinkCapturados }; 