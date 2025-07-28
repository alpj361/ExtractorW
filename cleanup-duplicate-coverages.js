const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ===================================================================
// SCRIPT DE LIMPIEZA - ELIMINAR COBERTURAS DUPLICADAS
// ===================================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables de entorno faltantes:');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateCoverages() {
    console.log('🧹 INICIANDO LIMPIEZA DE DUPLICADOS DE COBERTURAS\n');

    try {
        // 1. Obtener todas las coberturas agrupadas por proyecto
        const { data: allCoverages, error: coveragesError } = await supabase
            .from('project_coverages')
            .select('*')
            .order('project_id, created_at');

        if (coveragesError) {
            console.error('Error obteniendo coberturas:', coveragesError);
            return;
        }

        console.log(`📊 Total de coberturas en base de datos: ${allCoverages.length}`);

        // 2. Agrupar por proyecto y detectar duplicados
        const projectGroups = {};
        allCoverages.forEach(coverage => {
            if (!projectGroups[coverage.project_id]) {
                projectGroups[coverage.project_id] = [];
            }
            projectGroups[coverage.project_id].push(coverage);
        });

        let totalDuplicatesFound = 0;
        let totalDuplicatesRemoved = 0;

        // 3. Procesar cada proyecto
        for (const [projectId, coverages] of Object.entries(projectGroups)) {
            console.log(`\n📂 Procesando proyecto: ${projectId}`);
            console.log(`   Coberturas totales: ${coverages.length}`);

            // Detectar duplicados usando la misma lógica que el constraint UNIQUE
            const uniqueGroups = {};
            const duplicatesToDelete = [];

            coverages.forEach(coverage => {
                // Usar la misma lógica que el constraint: project_id, coverage_type, name, parent_name
                const key = `${coverage.coverage_type}|||${coverage.name}|||${coverage.parent_name || 'NULL'}`;
                
                if (!uniqueGroups[key]) {
                    uniqueGroups[key] = [];
                }
                uniqueGroups[key].push(coverage);
            });

            // Identificar duplicados (mantener el más reciente, eliminar los demás)
            Object.entries(uniqueGroups).forEach(([key, group]) => {
                if (group.length > 1) {
                    // Ordenar por fecha de creación (más reciente primero)
                    group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    
                    const toKeep = group[0]; // El más reciente
                    const toDelete = group.slice(1); // El resto
                    
                    console.log(`\n   🚨 DUPLICADO ENCONTRADO: ${key.replace(/\|\|\|/g, ' | ')}`);
                    console.log(`      Manteniendo (más reciente): ${toKeep.id} - ${toKeep.created_at}`);
                    console.log(`      Eliminando ${toDelete.length} duplicado(s):`);
                    
                    toDelete.forEach(dup => {
                        console.log(`         - ${dup.id} - ${dup.created_at}`);
                        duplicatesToDelete.push(dup.id);
                    });
                    
                    totalDuplicatesFound += toDelete.length;
                }
            });

            // 4. Eliminar duplicados de este proyecto
            if (duplicatesToDelete.length > 0) {
                console.log(`\n   🗑️ Eliminando ${duplicatesToDelete.length} duplicados...`);
                
                const { error: deleteError } = await supabase
                    .from('project_coverages')
                    .delete()
                    .in('id', duplicatesToDelete);

                if (deleteError) {
                    console.error(`   ❌ Error eliminando duplicados:`, deleteError);
                } else {
                    console.log(`   ✅ ${duplicatesToDelete.length} duplicados eliminados exitosamente`);
                    totalDuplicatesRemoved += duplicatesToDelete.length;
                }
            } else {
                console.log(`   ✅ No se encontraron duplicados en este proyecto`);
            }
        }

        // 5. Resumen final
        console.log(`\n📋 RESUMEN DE LIMPIEZA:`);
        console.log(`   🚨 Duplicados encontrados: ${totalDuplicatesFound}`);
        console.log(`   🗑️ Duplicados eliminados: ${totalDuplicatesRemoved}`);
        console.log(`   ✅ Limpieza completada`);

        // 6. Verificar que no quedaron duplicados
        console.log(`\n🔍 VERIFICACIÓN POST-LIMPIEZA:`);
        await verifyNoDuplicates();

    } catch (error) {
        console.error('❌ Error en limpieza de duplicados:', error);
    }
}

// Función auxiliar para verificar que no hay duplicados
async function verifyNoDuplicates() {
    try {
        const { data: remainingCoverages } = await supabase
            .from('project_coverages')
            .select('project_id, coverage_type, name, parent_name');

        const duplicateCheck = {};
        let duplicatesFound = 0;

        remainingCoverages.forEach(coverage => {
            const key = `${coverage.project_id}|||${coverage.coverage_type}|||${coverage.name}|||${coverage.parent_name || 'NULL'}`;
            
            if (duplicateCheck[key]) {
                duplicatesFound++;
                console.log(`   🚨 DUPLICADO RESTANTE: ${key.replace(/\|\|\|/g, ' | ')}`);
            } else {
                duplicateCheck[key] = true;
            }
        });

        if (duplicatesFound === 0) {
            console.log(`   ✅ Verificación exitosa: No se encontraron duplicados restantes`);
            console.log(`   📊 Total de coberturas únicas: ${Object.keys(duplicateCheck).length}`);
        } else {
            console.log(`   ❌ ADVERTENCIA: Se encontraron ${duplicatesFound} duplicados restantes`);
        }

    } catch (error) {
        console.error('Error en verificación:', error);
    }
}

// 7. Función para probar el comportamiento del UPSERT
async function testUpsertBehavior() {
    console.log('\n🧪 PROBANDO COMPORTAMIENTO DEL UPSERT\n');

    // Datos de prueba
    const testData = {
        project_id: 'b36e711c-6206-4258-83b6-6a566f7b2766', // Proyecto real del output
        coverage_type: 'pais',
        name: 'Guatemala',
        parent_name: null,
        description: 'Prueba de UPSERT',
        detection_source: 'manual',
        confidence_score: 0.95
    };

    try {
        console.log('1. Intentando UPSERT con datos de prueba...');
        console.log('   Datos:', JSON.stringify(testData, null, 2));

        // Primer UPSERT
        const { data: result1, error: error1 } = await supabase
            .from('project_coverages')
            .upsert(testData, {
                onConflict: 'project_id,coverage_type,name,parent_name',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error1) {
            console.log('   ❌ Error en primer UPSERT:', error1);
        } else {
            console.log('   ✅ Primer UPSERT exitoso:', result1.id);
        }

        // Segundo UPSERT (debería actualizar, no crear nuevo)
        console.log('\n2. Segundo UPSERT con los mismos datos...');
        
        const { data: result2, error: error2 } = await supabase
            .from('project_coverages')
            .upsert({
                ...testData,
                description: 'Prueba de UPSERT - ACTUALIZADA',
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id,coverage_type,name,parent_name',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error2) {
            console.log('   ❌ Error en segundo UPSERT:', error2);
        } else {
            console.log('   ✅ Segundo UPSERT exitoso:', result2.id);
            console.log('   🔍 ¿Mismo ID?', result1?.id === result2?.id ? 'SÍ (actualización)' : 'NO (nuevo registro)');
        }

        // Verificar cuántos registros hay con estos datos
        const { data: duplicateCheck, count } = await supabase
            .from('project_coverages')
            .select('id, created_at, description', { count: 'exact' })
            .eq('project_id', testData.project_id)
            .eq('coverage_type', testData.coverage_type)
            .eq('name', testData.name)
            .is('parent_name', null);

        console.log(`\n3. Verificación de duplicados:`);
        console.log(`   Registros encontrados: ${count}`);
        
        if (duplicateCheck && duplicateCheck.length > 0) {
            duplicateCheck.forEach((record, index) => {
                console.log(`   [${index + 1}] ID: ${record.id}`);
                console.log(`       Descripción: ${record.description}`);
                console.log(`       Creado: ${record.created_at}`);
            });
        }

        // Limpiar datos de prueba
        console.log(`\n4. Limpiando datos de prueba...`);
        if (result2?.id) {
            const { error: deleteError } = await supabase
                .from('project_coverages')
                .delete()
                .eq('id', result2.id);

            if (deleteError) {
                console.log('   ❌ Error eliminando datos de prueba:', deleteError);
            } else {
                console.log('   ✅ Datos de prueba eliminados');
            }
        }

    } catch (error) {
        console.error('❌ Error en prueba de UPSERT:', error);
    }
}

// Ejecutar funciones
async function main() {
    console.log('='.repeat(60));
    console.log('🛠️  HERRAMIENTAS DE MANTENIMIENTO DE COBERTURAS');
    console.log('='.repeat(60));

    // Opción 1: Solo verificar duplicados
    console.log('\n🔍 VERIFICANDO DUPLICADOS ACTUALES...');
    await verifyNoDuplicates();

    // Opción 2: Limpiar duplicados
    console.log('\n🧹 INICIANDO LIMPIEZA...');
    await cleanupDuplicateCoverages();

    // Opción 3: Probar comportamiento del UPSERT
    console.log('\n🧪 PROBANDO UPSERT...');
    await testUpsertBehavior();
}

main().catch(console.error);

// Función de ayuda para modo automatizado
function showUsageInstructions() {
    console.log('📋 INSTRUCCIONES DE USO:');
    console.log('========================');
    console.log('1. Asegúrate de tener las variables de entorno configuradas:');
    console.log('   - SUPABASE_URL');
    console.log('   - SUPABASE_SERVICE_ROLE_KEY');
    console.log('');
    console.log('2. Ejecuta el script:');
    console.log('   node cleanup-duplicate-coverages.js');
    console.log('');
    console.log('3. Revisa el resumen de duplicados y confirma la eliminación');
    console.log('');
    console.log('⚠️  IMPORTANTE: Esta operación es irreversible. Se recomienda hacer backup antes.');
    console.log('');
}

// Verificar configuración antes de ejecutar
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsageInstructions();
} else {
    main();
} 