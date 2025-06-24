const { createClient } = require('@supabase/supabase-js');

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
    console.log('🧹 LIMPIEZA DE COBERTURAS DUPLICADAS');
    console.log('====================================\n');

    try {
        // 1. Obtener todas las coberturas
        console.log('1️⃣ Obteniendo todas las coberturas...');
        const { data: allCoverages, error: fetchError } = await supabase
            .from('project_coverages')
            .select('*')
            .order('created_at', { ascending: true }); // Ordenar por más antiguas primero

        if (fetchError) {
            throw new Error(`Error obteniendo coberturas: ${fetchError.message}`);
        }

        console.log(`   📊 Total de coberturas encontradas: ${allCoverages.length}`);

        // 2. Agrupar por proyecto + tipo + nombre + parent_name para encontrar duplicados
        console.log('2️⃣ Identificando duplicados...');
        const coverageGroups = {};
        const duplicates = [];

        allCoverages.forEach(coverage => {
            const key = `${coverage.project_id}|${coverage.coverage_type}|${coverage.name}|${coverage.parent_name || 'null'}`;
            
            if (!coverageGroups[key]) {
                coverageGroups[key] = [];
            }
            coverageGroups[key].push(coverage);
        });

        // Identificar grupos con duplicados
        Object.entries(coverageGroups).forEach(([key, coverages]) => {
            if (coverages.length > 1) {
                // Mantener la primera cobertura (más antigua) y marcar el resto como duplicados
                const [keep, ...toDelete] = coverages;
                duplicates.push({
                    key,
                    keep,
                    toDelete,
                    count: coverages.length
                });
            }
        });

        console.log(`   🔍 Grupos de duplicados encontrados: ${duplicates.length}`);
        
        if (duplicates.length === 0) {
            console.log('✅ No se encontraron coberturas duplicadas. ¡Todo está limpio!');
            return;
        }

        // 3. Mostrar resumen de duplicados
        console.log('\n3️⃣ Resumen de duplicados encontrados:');
        let totalToDelete = 0;
        duplicates.forEach((duplicate, index) => {
            const [projectId, type, name, parentName] = duplicate.key.split('|');
            console.log(`   ${index + 1}. ${type}:${name} (parent: ${parentName === 'null' ? 'ninguno' : parentName})`);
            console.log(`      Proyecto: ${projectId}`);
            console.log(`      Duplicados: ${duplicate.count} (eliminar ${duplicate.toDelete.length})`);
            console.log(`      Mantener: ID ${duplicate.keep.id} (creado: ${duplicate.keep.created_at})`);
            console.log(`      Eliminar: IDs ${duplicate.toDelete.map(c => c.id).join(', ')}\n`);
            totalToDelete += duplicate.toDelete.length;
        });

        console.log(`📊 Total de coberturas a eliminar: ${totalToDelete}`);

        // 4. Confirmar antes de proceder
        console.log('\n⚠️  ATENCIÓN: Esta operación eliminará las coberturas duplicadas de forma permanente.');
        console.log('   Se mantendrá la cobertura más antigua de cada grupo.');
        
        // En un entorno automatizado, descomenta la siguiente línea para proceder automáticamente
        // const proceed = true;
        
        // Para modo interactivo (requiere readline):
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const proceed = await new Promise(resolve => {
            rl.question('\n¿Proceder con la eliminación? (y/N): ', (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });

        if (!proceed) {
            console.log('❌ Operación cancelada por el usuario.');
            return;
        }

        // 5. Eliminar duplicados
        console.log('\n4️⃣ Eliminando coberturas duplicadas...');
        let deletedCount = 0;
        const errors = [];

        for (const duplicate of duplicates) {
            for (const coverage of duplicate.toDelete) {
                try {
                    const { error: deleteError } = await supabase
                        .from('project_coverages')
                        .delete()
                        .eq('id', coverage.id);

                    if (deleteError) {
                        errors.push(`Error eliminando cobertura ${coverage.id}: ${deleteError.message}`);
                    } else {
                        deletedCount++;
                        console.log(`   ✅ Eliminada cobertura duplicada: ${coverage.coverage_type}:${coverage.name} (ID: ${coverage.id})`);
                    }
                } catch (error) {
                    errors.push(`Error eliminando cobertura ${coverage.id}: ${error.message}`);
                }
            }
        }

        // 6. Resumen final
        console.log('\n5️⃣ RESUMEN DE LIMPIEZA:');
        console.log('========================');
        console.log(`✅ Coberturas eliminadas exitosamente: ${deletedCount}`);
        console.log(`❌ Errores durante eliminación: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n❌ Errores encontrados:');
            errors.forEach(error => console.log(`   ${error}`));
        }

        // 7. Verificación final
        const { data: finalCoverages, error: finalFetchError } = await supabase
            .from('project_coverages')
            .select('*');

        if (!finalFetchError) {
            console.log(`📊 Total de coberturas después de limpieza: ${finalCoverages.length}`);
            console.log(`🧹 Coberturas eliminadas: ${allCoverages.length - finalCoverages.length}`);
        }

        console.log('\n🎉 LIMPIEZA COMPLETADA');

    } catch (error) {
        console.error('❌ ERROR DURANTE LA LIMPIEZA:', error.message);
        process.exit(1);
    }
}

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
    cleanupDuplicateCoverages();
} 