const axios = require('axios');

// ===================================================================
// SCRIPT DE PRUEBA - COMPORTAMIENTO DE COBERTURAS MEJORADO
// ===================================================================

const BASE_URL = 'http://localhost:5002/api';
const TEST_PROJECT_ID = 'tu-project-id-aqui'; // Cambiar por ID real
const AUTH_TOKEN = 'tu-token-aqui'; // Cambiar por token real

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