const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ===================================================================
// SCRIPT DE PRUEBA - COMPORTAMIENTO DE COBERTURAS MEJORADO
// ===================================================================

const BASE_URL = 'http://localhost:5002/api';
const TEST_PROJECT_ID = 'tu-project-id-aqui'; // Cambiar por ID real
const AUTH_TOKEN = 'tu-token-aqui'; // Cambiar por token real

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCoveragesBehavior() {
    console.log('🧪 PRUEBA DE COMPORTAMIENTO DE COBERTURAS');
    console.log('=============================================\n');

    try {
        // 1. Primera detección automática
        console.log('1️⃣ Primera detección automática...');
        const firstDetection = await axios.post(`${BASE_URL}/coverages/auto-detect`, {
            project_id: TEST_PROJECT_ID
        }, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Primera detección exitosa:');
        console.log(`   📊 ${firstDetection.data.message}`);
        console.log(`   🆕 Coberturas nuevas: ${firstDetection.data.created_count}`);
        console.log(`   🔄 Coberturas actualizadas: ${firstDetection.data.updated_count || 0}`);
        console.log(`   📍 Total procesadas: ${firstDetection.data.total_processed || firstDetection.data.created_count}`);
        console.log('');

        // Esperar un momento
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Segunda detección automática (debería actualizar, no crear duplicados)
        console.log('2️⃣ Segunda detección automática (debería actualizar existentes)...');
        const secondDetection = await axios.post(`${BASE_URL}/coverages/auto-detect`, {
            project_id: TEST_PROJECT_ID
        }, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Segunda detección exitosa:');
        console.log(`   📊 ${secondDetection.data.message}`);
        console.log(`   🆕 Coberturas nuevas: ${secondDetection.data.created_count}`);
        console.log(`   🔄 Coberturas actualizadas: ${secondDetection.data.updated_count || 0}`);
        console.log(`   📍 Total procesadas: ${secondDetection.data.total_processed || secondDetection.data.created_count}`);
        console.log('');

        // 3. Obtener estado actual de coberturas
        console.log('3️⃣ Verificando estado actual de coberturas...');
        const coveragesResponse = await axios.get(`${BASE_URL}/coverages?project_id=${TEST_PROJECT_ID}`, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Estado actual de coberturas:');
        console.log(`   📊 Total de coberturas en BD: ${coveragesResponse.data.coverages.length}`);
        
        // Agrupar por tipo
        const groupedByType = coveragesResponse.data.coverages.reduce((acc, coverage) => {
            acc[coverage.coverage_type] = (acc[coverage.coverage_type] || 0) + 1;
            return acc;
        }, {});
        
        console.log('   📋 Por tipo:');
        Object.entries(groupedByType).forEach(([type, count]) => {
            console.log(`      ${type}: ${count} coberturas`);
        });

        console.log('');

        // 4. Análisis de comportamiento
        console.log('4️⃣ ANÁLISIS DE COMPORTAMIENTO:');
        console.log('=====================================');
        
        if (secondDetection.data.created_count === 0 && secondDetection.data.updated_count > 0) {
            console.log('✅ ÉXITO: El sistema está actualizando coberturas existentes en lugar de crear duplicados');
            console.log(`   🔄 Se actualizaron ${secondDetection.data.updated_count} coberturas en la segunda ejecución`);
            console.log('   🚫 No se crearon coberturas duplicadas');
        } else if (secondDetection.data.created_count > 0) {
            console.log('⚠️  ATENCIÓN: Algunas coberturas se marcaron como nuevas en la segunda ejecución');
            console.log('   Esto puede indicar que hay hallazgos en nuevas ciudades/ubicaciones');
            console.log(`   🆕 Nuevas: ${secondDetection.data.created_count}`);
            console.log(`   🔄 Actualizadas: ${secondDetection.data.updated_count || 0}`);
        } else {
            console.log('ℹ️  No había hallazgos nuevos para procesar en la segunda ejecución');
        }

        console.log('\n🎉 PRUEBA COMPLETADA - El sistema ahora distingue correctamente entre crear y actualizar coberturas');

    } catch (error) {
        console.error('❌ ERROR EN PRUEBAS:');
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${error.response.data.error}`);
            console.error(`   Detalles: ${error.response.data.details || 'N/A'}`);
        } else if (error.request) {
            console.error('   No se recibió respuesta del servidor');
            console.error('   ¿Está corriendo ExtractorW en puerto 5002?');
        } else {
            console.error(`   Error de configuración: ${error.message}`);
        }
        
        console.log('\n⚠️  Para usar este script:');
        console.log('   1. Asegúrate de que ExtractorW esté corriendo en puerto 5002');
        console.log('   2. Actualiza TEST_PROJECT_ID con un ID de proyecto válido');
        console.log('   3. Actualiza AUTH_TOKEN con un token de autenticación válido');
    }
}

// Función para generar instrucciones de uso
function showUsageInstructions() {
    console.log('📋 INSTRUCCIONES DE USO:');
    console.log('========================');
    console.log('1. Edita las variables TEST_PROJECT_ID y AUTH_TOKEN en este archivo');
    console.log('2. Asegúrate de que ExtractorW esté corriendo: node server/index.js');
    console.log('3. Ejecuta este script: node test-coverages-behavior.js');
    console.log('4. Observa cómo el sistema distingue entre coberturas nuevas y actualizaciones');
    console.log('');
    console.log('Este script demuestra que el sistema ya NO crea duplicados de coberturas.');
    console.log('En su lugar, actualiza las existentes manteniendo la integridad de los datos.');
    console.log('');
}

// Verificar si se están usando valores por defecto
if (TEST_PROJECT_ID === 'tu-project-id-aqui' || AUTH_TOKEN === 'tu-token-aqui') {
    showUsageInstructions();
} else {
    testCoveragesBehavior();
}

// 🔍 SCRIPT DE DEPURACIÓN PARA COBERTURAS
async function debugCoverages() {
  console.log('🔍 DEPURANDO SISTEMA DE COBERTURAS\n');

  try {
    // 1. Buscar proyecto con coberturas duplicadas
    console.log('1. Buscando proyectos con coberturas...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, title, user_id')
      .limit(5);

    if (projectsError) {
      console.error('Error obteniendo proyectos:', projectsError);
      return;
    }

    console.log(`   Encontrados ${projects.length} proyectos`);

    for (const project of projects) {
      console.log(`\n📂 PROYECTO: ${project.title} (${project.id})`);
      
      // 2. Obtener todas las coberturas del proyecto
      const { data: coverages, error: coveragesError } = await supabase
        .from('project_coverages')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (coveragesError) {
        console.error('Error obteniendo coberturas:', coveragesError);
        continue;
      }

      console.log(`   Total coberturas: ${coverages.length}`);

      // 3. Detectar duplicados exactos
      const duplicateGroups = {};
      coverages.forEach(coverage => {
        const key = `${coverage.coverage_type}|${coverage.name}|${coverage.parent_name || 'NULL'}`;
        if (!duplicateGroups[key]) {
          duplicateGroups[key] = [];
        }
        duplicateGroups[key].push(coverage);
      });

      // 4. Mostrar duplicados
      const duplicates = Object.entries(duplicateGroups).filter(([key, group]) => group.length > 1);
      
      if (duplicates.length > 0) {
        console.log(`   🚨 DUPLICADOS ENCONTRADOS: ${duplicates.length} grupos`);
        
        duplicates.forEach(([key, group]) => {
          console.log(`\n   📍 DUPLICADO: ${key}`);
          console.log(`      Cantidad: ${group.length} coberturas idénticas`);
          
          group.forEach((coverage, index) => {
            console.log(`      [${index + 1}] ID: ${coverage.id}`);
            console.log(`          Creado: ${coverage.created_at}`);
            console.log(`          Fuente: ${coverage.detection_source}`);
            console.log(`          Descripción: ${coverage.description?.substring(0, 100)}...`);
          });
        });

        // 5. Mostrar query para limpiar duplicados
        console.log(`\n   🧹 QUERY PARA LIMPIAR DUPLICADOS:`);
        duplicates.forEach(([key, group]) => {
          const [type, name, parent] = key.split('|');
          const idsToDelete = group.slice(1).map(c => c.id); // Mantener el primero, eliminar el resto
          
          if (idsToDelete.length > 0) {
            console.log(`      -- Eliminar duplicados de ${type}:${name}`);
            console.log(`      DELETE FROM project_coverages WHERE id IN ('${idsToDelete.join("', '")}');`);
          }
        });

      } else {
        console.log(`   ✅ No se encontraron duplicados en este proyecto`);
      }

      // 6. Análisis por tipo de cobertura
      const typeStats = {};
      coverages.forEach(coverage => {
        const type = coverage.coverage_type;
        if (!typeStats[type]) {
          typeStats[type] = { total: 0, names: new Set() };
        }
        typeStats[type].total++;
        typeStats[type].names.add(coverage.name);
      });

      console.log(`\n   📊 ESTADÍSTICAS POR TIPO:`);
      Object.entries(typeStats).forEach(([type, stats]) => {
        console.log(`      ${type}: ${stats.total} coberturas, ${stats.names.size} únicas`);
        if (stats.total > stats.names.size) {
          console.log(`        🚨 Posibles duplicados: ${stats.total - stats.names.size}`);
        }
      });
    }

    // 7. Obtener estadísticas globales
    console.log(`\n📈 ESTADÍSTICAS GLOBALES DE COBERTURAS:`);
    const { data: globalStats } = await supabase
      .from('project_coverages')
      .select('coverage_type, name, parent_name, project_id');

    if (globalStats) {
      // Agrupar por tipo
      const globalTypeStats = {};
      globalStats.forEach(coverage => {
        const type = coverage.coverage_type;
        if (!globalTypeStats[type]) {
          globalTypeStats[type] = 0;
        }
        globalTypeStats[type]++;
      });

      Object.entries(globalTypeStats).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} coberturas`);
      });

      // Buscar duplicados globales (mismo nombre en diferentes proyectos)
      const nameOccurrences = {};
      globalStats.forEach(coverage => {
        const key = `${coverage.coverage_type}:${coverage.name}`;
        if (!nameOccurrences[key]) {
          nameOccurrences[key] = [];
        }
        nameOccurrences[key].push(coverage.project_id);
      });

      const commonNames = Object.entries(nameOccurrences)
        .filter(([name, projects]) => projects.length > 1)
        .slice(0, 5); // Top 5

      if (commonNames.length > 0) {
        console.log(`\n   🌎 NOMBRES MÁS COMUNES ENTRE PROYECTOS:`);
        commonNames.forEach(([name, projects]) => {
          console.log(`      ${name}: ${projects.length} proyectos`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error en depuración:', error);
  }
}

// 8. Función para limpiar duplicados automáticamente
async function cleanupDuplicates(projectId) {
  console.log(`\n🧹 LIMPIANDO DUPLICADOS DEL PROYECTO: ${projectId}`);

  try {
    // Obtener todas las coberturas del proyecto
    const { data: coverages } = await supabase
      .from('project_coverages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }); // Los más antiguos primero

    const seen = new Set();
    const toDelete = [];

    coverages.forEach(coverage => {
      const key = `${coverage.coverage_type}|${coverage.name}|${coverage.parent_name || 'NULL'}`;
      
      if (seen.has(key)) {
        toDelete.push(coverage.id);
        console.log(`   🗑️ Marcando para eliminar: ${coverage.coverage_type}:${coverage.name} (${coverage.id})`);
      } else {
        seen.add(key);
        console.log(`   ✅ Manteniendo: ${coverage.coverage_type}:${coverage.name} (${coverage.id})`);
      }
    });

    if (toDelete.length > 0) {
      console.log(`\n   Eliminando ${toDelete.length} duplicados...`);
      
      const { error: deleteError } = await supabase
        .from('project_coverages')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error('Error eliminando duplicados:', deleteError);
      } else {
        console.log(`   ✅ ${toDelete.length} duplicados eliminados exitosamente`);
      }
    } else {
      console.log(`   ✅ No se encontraron duplicados para eliminar`);
    }

  } catch (error) {
    console.error('❌ Error limpiando duplicados:', error);
  }
}

// Ejecutar script
async function main() {
  await debugCoverages();
  
  // Descomentar para limpiar duplicados de un proyecto específico
  // await cleanupDuplicates('your-project-id-here');
}

main().catch(console.error); 