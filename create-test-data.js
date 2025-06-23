const supabase = require('./server/utils/supabase');

async function createTestData() {
  console.log('🧪 CREANDO DATOS DE PRUEBA PARA SISTEMA DE COBERTURAS');
  console.log('=====================================================\n');

  try {
    // 1. Crear un proyecto de prueba
    console.log('1. Creando proyecto de prueba...');
    
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        title: 'Proyecto de Prueba - Coberturas',
        description: 'Proyecto creado automáticamente para probar el sistema de coberturas geográficas',
        user_id: '00000000-0000-0000-0000-000000000000', // Usuario de prueba
        status: 'active',
        priority: 'medium',
        visibility: 'private'
      })
      .select()
      .single();

    if (projectError) {
      console.error('❌ Error creando proyecto:', projectError);
      return;
    }

    console.log(`✅ Proyecto creado: ${project.title} (ID: ${project.id})`);

    // 2. Crear un codex_item con transcripción
    console.log('\n2. Creando item con transcripción...');
    
    const sampleTranscription = `
    En este audio se discuten varios hallazgos importantes:
    
    La empresa Constructora San Miguel, con sede en la ciudad de Quetzaltenango, departamento de Quetzaltenango, 
    ha recibido un contrato por Q.2,500,000 para la construcción de un puente en la zona.
    
    También se menciona que la municipalidad de Antigua Guatemala, en el departamento de Sacatepéquez,
    está evaluando un proyecto de Q.850,000 para mejoras en el parque central.
    
    Adicionalmente, se reportó que en la ciudad de Guatemala, zona 1, se están realizando trabajos
    de infraestructura por parte de la empresa Desarrollo Urbano GT por un monto de Q.1,200,000.
    `;

    const { data: codexItem, error: codexError } = await supabase
      .from('codex_items')
      .insert({
        project_id: project.id,
        titulo: 'Transcripción de Audio - Contratos Municipales',
        tipo: 'audio',
        contenido: 'Transcripción procesada de audio sobre contratos municipales',
        audio_transcription: sampleTranscription.trim(),
        tags: ['contratos', 'municipalidades', 'infraestructura']
      })
      .select()
      .single();

    if (codexError) {
      console.error('❌ Error creando codex_item:', codexError);
      return;
    }

    console.log(`✅ Item creado: ${codexItem.titulo} (ID: ${codexItem.id})`);

    // 3. Crear cards capturadas manualmente (simulando el procesamiento de Gemini)
    console.log('\n3. Creando cards capturadas...');
    
    const testCards = [
      {
        project_id: project.id,
        codex_item_id: codexItem.id,
        entity: 'Constructora San Miguel',
        amount: 2500000,
        currency: 'Q',
        city: 'Quetzaltenango',
        department: 'Quetzaltenango',
        discovery: 'Contrato para construcción de puente',
        source: 'Transcripción de audio municipal',
        description: 'Empresa constructora con contrato de Q.2,500,000 para puente'
      },
      {
        project_id: project.id,
        codex_item_id: codexItem.id,
        entity: 'Municipalidad de Antigua Guatemala',
        amount: 850000,
        currency: 'Q',
        city: 'Antigua Guatemala',
        department: 'Sacatepéquez',
        discovery: 'Proyecto de mejoras en parque central',
        source: 'Transcripción de audio municipal',
        description: 'Municipalidad evaluando proyecto de Q.850,000 para parque'
      },
      {
        project_id: project.id,
        codex_item_id: codexItem.id,
        entity: 'Desarrollo Urbano GT',
        amount: 1200000,
        currency: 'Q',
        city: 'Guatemala',
        department: 'Guatemala',
        discovery: 'Trabajos de infraestructura en zona 1',
        source: 'Transcripción de audio municipal',
        description: 'Empresa realizando trabajos de infraestructura por Q.1,200,000'
      }
    ];

    const { data: insertedCards, error: cardsError } = await supabase
      .from('capturado_cards')
      .insert(testCards)
      .select();

    if (cardsError) {
      console.error('❌ Error creando cards:', cardsError);
      return;
    }

    console.log(`✅ Cards creadas: ${insertedCards.length}`);
    insertedCards.forEach((card, index) => {
      console.log(`   ${index + 1}. ${card.entity} - ${card.city}, ${card.department} (${card.currency}${card.amount?.toLocaleString()})`);
    });

    // 4. Mostrar resumen final
    console.log('\n4. 🎉 DATOS DE PRUEBA CREADOS EXITOSAMENTE');
    console.log('==========================================');
    console.log(`📁 Proyecto: ${project.title}`);
    console.log(`📄 ID del Proyecto: ${project.id}`);
    console.log(`🎵 Item de Codex: ${codexItem.titulo}`);
    console.log(`🏷️ Cards Capturadas: ${insertedCards.length}`);
    console.log('');
    console.log('✅ Ahora puedes:');
    console.log('   1. Ir al frontend de PulseJ');
    console.log(`   2. Seleccionar el proyecto "${project.title}"`);
    console.log('   3. Ir a la pestaña "Capturado"');
    console.log('   4. Hacer clic en el botón de cobertura (📍) en cualquier card');
    console.log('   5. Ver cómo se crean las coberturas geográficas automáticamente');
    console.log('');
    console.log('🗂️ Las cards incluyen información de:');
    console.log('   - Quetzaltenango, Quetzaltenango');
    console.log('   - Antigua Guatemala, Sacatepéquez');
    console.log('   - Guatemala, Guatemala');

  } catch (error) {
    console.error('💥 Error creando datos de prueba:', error);
  }
}

// Ejecutar solo si este archivo se ejecuta directamente
if (require.main === module) {
  createTestData();
}

module.exports = { createTestData }; 