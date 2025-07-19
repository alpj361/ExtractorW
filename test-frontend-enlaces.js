/**
 * TEST: Verificar Frontend - Detección de Enlaces Analizables
 * Este script simula la consulta que hace el frontend para verificar
 * que los enlaces con análisis son detectados correctamente
 */

const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables de entorno faltantes: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testFrontendDetection() {
  console.log('🧪 PROBANDO DETECCIÓN DEL FRONTEND PARA ENLACES ANALIZABLES\n');

  try {
    // 1. Simular la consulta exacta del frontend actualizado
    console.log('📊 1. Simulando consulta del frontend actualizado...');
    
    const { data, error } = await supabase
      .from('codex_items')
      .select('id, titulo, tipo, nombre_archivo, storage_path, url, descripcion, audio_transcription, document_analysis, analisis_detallado, created_at')
      .not('project_id', 'is', null) // Solo elementos con proyecto
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    console.log(`✅ Consulta exitosa: ${data.length} elementos encontrados\n`);

    // 2. Aplicar la misma lógica de filtrado del frontend actualizado
    console.log('🔍 2. Aplicando lógica de filtrado actualizada...');
    
    const analyzableItems = data.filter((item) => {
      const hasTranscription = item.audio_transcription && item.audio_transcription.trim();
      const hasDocumentAnalysis = item.document_analysis && item.document_analysis.trim();
      const hasDetailedAnalysis = item.analisis_detallado && item.analisis_detallado.trim(); // 🆕 Enlaces multimedia
      const hasLinkDescription = item.tipo === 'enlace' && item.descripcion && item.descripcion.trim(); // 🆕 Enlaces básicos
      const isAnalyzableDocument = item.tipo === 'documento' && item.storage_path;
      
      return hasTranscription || hasDocumentAnalysis || hasDetailedAnalysis || hasLinkDescription || isAnalyzableDocument;
    });

    console.log(`📋 Total elementos analizables: ${analyzableItems.length}\n`);

    // 3. Desglosar por tipo de contenido
    const breakdown = {
      'Con transcripción': 0,
      'Con análisis de documento': 0,
      'Enlace analizado (detallado)': 0,
      'Enlace con contexto': 0,
      'Documento pendiente': 0
    };

    analyzableItems.forEach(item => {
      const hasTranscription = item.audio_transcription && item.audio_transcription.trim();
      const hasDocumentAnalysis = item.document_analysis && item.document_analysis.trim();
      const hasDetailedAnalysis = item.analisis_detallado && item.analisis_detallado.trim();
      const hasLinkDescription = item.tipo === 'enlace' && item.descripcion && item.descripcion.trim();
      const isAnalyzableDocument = item.tipo === 'documento' && item.storage_path;

      if (hasTranscription) {
        breakdown['Con transcripción']++;
      } else if (hasDocumentAnalysis) {
        breakdown['Con análisis de documento']++;
      } else if (hasDetailedAnalysis) {
        breakdown['Enlace analizado (detallado)']++;
      } else if (hasLinkDescription) {
        breakdown['Enlace con contexto']++;
      } else if (isAnalyzableDocument) {
        breakdown['Documento pendiente']++;
      }
    });

    // 4. Mostrar resultados detallados
    console.log('📊 3. Desglose por tipo de contenido:');
    Object.entries(breakdown).forEach(([tipo, cantidad]) => {
      if (cantidad > 0) {
        console.log(`   ${tipo}: ${cantidad} elemento(s)`);
      }
    });

    // 5. Mostrar ejemplos de enlaces detectados
    const linksDetected = analyzableItems.filter(item => 
      item.tipo === 'enlace' && (
        (item.analisis_detallado && item.analisis_detallado.trim()) ||
        (item.descripcion && item.descripcion.trim())
      )
    );

    if (linksDetected.length > 0) {
      console.log(`\n🔗 4. Enlaces detectados como analizables (${linksDetected.length}):`);
      linksDetected.slice(0, 5).forEach((link, index) => {
        const hasDetailedAnalysis = link.analisis_detallado && link.analisis_detallado.trim();
        const hasBasicDescription = link.descripcion && link.descripcion.trim();
        
        console.log(`   ${index + 1}. ${link.titulo}`);
        console.log(`      URL: ${link.url || 'No disponible'}`);
        console.log(`      Tipo: ${hasDetailedAnalysis ? 'Análisis detallado' : 'Descripción básica'}`);
        console.log(`      Preview: ${(hasDetailedAnalysis ? link.analisis_detallado : link.descripcion).substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ 4. No se encontraron enlaces analizables');
      console.log('💡 Sugerencia: Agrega algunos enlaces al codex con análisis o descripción');
    }

    // 6. Verificar que la mejora está funcionando
    console.log('📈 5. Verificación de la mejora:');
    console.log(`   ✅ Frontend puede detectar enlaces con análisis detallado: ${breakdown['Enlace analizado (detallado)'] > 0 ? 'SÍ' : 'NO'}`);
    console.log(`   ✅ Frontend puede detectar enlaces con contexto: ${breakdown['Enlace con contexto'] > 0 ? 'SÍ' : 'NO'}`);
    console.log(`   ✅ Total enlaces detectables: ${linksDetected.length}`);

    if (linksDetected.length > 0) {
      console.log('\n🎉 ¡ÉXITO! El frontend ahora puede detectar enlaces analizables correctamente');
    } else {
      console.log('\n⚠️ NO HAY ENLACES PARA PROBAR - Agrega algunos enlaces con análisis primero');
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    process.exit(1);
  }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  testFrontendDetection()
    .then(() => {
      console.log('\n✅ Prueba de detección del frontend completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en prueba de frontend:', error);
      process.exit(1);
    });
}

module.exports = { testFrontendDetection }; 