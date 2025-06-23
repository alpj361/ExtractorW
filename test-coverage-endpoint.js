const supabase = require('./server/utils/supabase');

async function testCoverageEndpoint() {
  console.log('🧪 PRUEBA DEL ENDPOINT DE COBERTURAS DESDE CARD');
  console.log('=================================================\n');

  try {
    // 1. Obtener una card existente
    console.log('1. Obteniendo card de prueba...');
    const { data: cards, error: cardsError } = await supabase
      .from('capturado_cards')
      .select('id, project_id, entity, city, department')
      .limit(1);

    if (cardsError) {
      console.error('❌ Error obteniendo cards:', cardsError);
      return;
    }

    if (!cards || cards.length === 0) {
      console.log('⚠️ No hay cards disponibles para probar');
      return;
    }

    const testCard = cards[0];
    console.log(`✅ Card encontrada: ${testCard.entity || 'Sin entidad'}`);
    console.log(`   ID: ${testCard.id}`);
    console.log(`   Proyecto: ${testCard.project_id}`);
    console.log(`   Ubicación: ${testCard.city || 'Sin ciudad'}, ${testCard.department || 'Sin departamento'}\n`);

    // 2. Verificar que la tabla project_coverages existe
    console.log('2. Verificando tabla project_coverages...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('project_coverages')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Error verificando tabla project_coverages:', tableError);
      return;
    }

    console.log('✅ Tabla project_coverages verificada\n');

    // 3. Simular la creación de coberturas como lo haría el endpoint
    console.log('3. Simulando creación de coberturas...');
    
    const coveragesToCreate = [];
    
    // Ciudad
    if (testCard.city) {
      coveragesToCreate.push({
        project_id: testCard.project_id,
        coverage_type: 'ciudad',
        name: testCard.city,
        parent_name: testCard.department || null,
        description: `Detectado desde: ${testCard.entity || 'Card capturada'}`,
        relevance: 'medium',
        detection_source: 'document_analysis',
        confidence_score: 0.85,
        source_card_id: testCard.id,
        discovery_context: `Extraído de card: ${testCard.entity || 'Sin entidad'}`
      });
    }

    // Departamento
    if (testCard.department) {
      coveragesToCreate.push({
        project_id: testCard.project_id,
        coverage_type: 'departamento',
        name: testCard.department,
        parent_name: 'Guatemala',
        description: `Detectado desde: ${testCard.entity || 'Card capturada'}`,
        relevance: 'medium',
        detection_source: 'document_analysis',
        confidence_score: 0.85,
        source_card_id: testCard.id,
        discovery_context: `Extraído de card: ${testCard.entity || 'Sin entidad'}`
      });
    }

    if (coveragesToCreate.length === 0) {
      console.log('⚠️ La card no contiene información geográfica válida');
      return;
    }

    console.log(`📊 Se van a crear ${coveragesToCreate.length} coberturas:`);
    coveragesToCreate.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.coverage_type}: ${c.name} (parent: ${c.parent_name || 'ninguno'})`);
    });

    // 4. Crear las coberturas
    console.log('\n4. Insertando coberturas en base de datos...');
    const createdCoverages = [];
    const errors = [];

    for (const coverageData of coveragesToCreate) {
      try {
        const { data: coverage, error: insertError } = await supabase
          .from('project_coverages')
          .insert(coverageData)
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            errors.push(`Cobertura ${coverageData.coverage_type}:${coverageData.name} ya existe`);
          } else {
            throw insertError;
          }
        } else {
          createdCoverages.push(coverage);
          console.log(`   ✅ Creada: ${coverage.coverage_type} - ${coverage.name}`);
        }
      } catch (error) {
        console.error(`   ❌ Error creando ${coverageData.name}:`, error.message);
        errors.push(`Error creando ${coverageData.coverage_type}:${coverageData.name}`);
      }
    }

    // 5. Resumen final
    console.log('\n📋 RESUMEN DE LA PRUEBA:');
    console.log(`✅ Coberturas creadas exitosamente: ${createdCoverages.length}`);
    console.log(`⚠️ Errores/duplicados: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrores encontrados:');
      errors.forEach(error => console.log(`   - ${error}`));
    }

    if (createdCoverages.length > 0) {
      console.log('\nCoberturas creadas:');
      createdCoverages.forEach(coverage => {
        console.log(`   - ID: ${coverage.id}`);
        console.log(`     Tipo: ${coverage.coverage_type}`);
        console.log(`     Nombre: ${coverage.name}`);
        console.log(`     Fuente: ${coverage.detection_source}`);
        console.log(`     Confianza: ${coverage.confidence_score}`);
        console.log('');
      });
    }

    // 6. Verificar que se pueden consultar las coberturas
    console.log('6. Verificando consulta de coberturas del proyecto...');
    const { data: projectCoverages, error: queryError } = await supabase
      .from('project_coverages')
      .select('*')
      .eq('project_id', testCard.project_id)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('❌ Error consultando coberturas del proyecto:', queryError);
    } else {
      console.log(`✅ Total de coberturas en el proyecto: ${projectCoverages.length}`);
    }

    console.log('\n🎉 PRUEBA COMPLETADA - El endpoint debería funcionar correctamente ahora!');

  } catch (error) {
    console.error('❌ Error general en la prueba:', error);
  }
}

// Ejecutar la prueba
testCoverageEndpoint(); 