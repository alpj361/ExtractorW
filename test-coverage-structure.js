const axios = require('axios');

// ===================================================================
// SCRIPT DE PRUEBA - ESTRUCTURA DE AGRUPAMIENTO DE COBERTURAS
// ===================================================================

const BASE_URL = 'http://localhost:5002/api';
const TEST_PROJECT_ID = 'tu-project-id-aqui'; // Cambiar por ID real
const AUTH_TOKEN = 'tu-token-aqui'; // Cambiar por token real

async function testCoverageStructure() {
    console.log('🧪 PRUEBA DE ESTRUCTURA DE COBERTURAS');
    console.log('=====================================\n');

    try {
        const headers = {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        };

        // 1. Ejecutar auto-detect de coberturas
        console.log('1️⃣ Ejecutando auto-detect de coberturas...');
        const autoDetectResponse = await axios.post(`${BASE_URL}/coverages/auto-detect`, {
            project_id: TEST_PROJECT_ID
        }, { headers });

        console.log('✅ Auto-detect completado:');
        console.log(`   📊 Coberturas creadas: ${autoDetectResponse.data.created_count}`);
        console.log(`   📊 Coberturas actualizadas: ${autoDetectResponse.data.updated_count || 0}`);
        console.log(`   📊 Temas procesados: ${autoDetectResponse.data.themes_count}`);
        console.log(`   📊 Hallazgos analizados: ${autoDetectResponse.data.cards_processed}\n`);

        // 2. Obtener lista de coberturas
        console.log('2️⃣ Obteniendo lista de coberturas...');
        const coveragesResponse = await axios.get(`${BASE_URL}/coverages`, {
            params: { project_id: TEST_PROJECT_ID },
            headers
        });

        const coverages = coveragesResponse.data.coverages;
        console.log(`✅ Encontradas ${coverages.length} coberturas:`);
        
        // Agrupar por tipo para mostrar resumen
        const byType = {};
        coverages.forEach(coverage => {
            if (!byType[coverage.coverage_type]) {
                byType[coverage.coverage_type] = [];
            }
            byType[coverage.coverage_type].push(coverage);
        });

        Object.entries(byType).forEach(([type, items]) => {
            console.log(`   📍 ${type.toUpperCase()}: ${items.length} cobertura(s)`);
            items.forEach(item => {
                console.log(`      - ${item.name} (${item.tags?.length || 0} temas)`);
            });
        });

        // 3. Probar detalles de una cobertura específica (ej: Guatemala departamento)
        const guatemalaDept = coverages.find(c => 
            c.coverage_type === 'departamento' && 
            c.name.toLowerCase().includes('guatemala')
        );

        if (guatemalaDept) {
            console.log(`\n3️⃣ Probando detalles de cobertura: ${guatemalaDept.name}...`);
            
            const detailsResponse = await axios.get(`${BASE_URL}/coverages/${guatemalaDept.id}/details`, {
                headers
            });

            const details = detailsResponse.data;
            console.log('✅ Detalles obtenidos:');
            console.log(`   📊 Total de temas: ${details.stats.total_themes}`);
            console.log(`   📊 Total de hallazgos: ${details.stats.total_cards}`);
            console.log(`   🔍 Fuente de detección: ${details.stats.detection_source}\n`);

            // Mostrar estructura por temas
            console.log('📋 ESTRUCTURA POR TEMAS:');
            console.log('========================');
            
            Object.entries(details.full_breakdown).forEach(([themeName, themeData]) => {
                console.log(`\n🎯 Tema: ${themeName}`);
                console.log(`   📊 Hallazgos: ${themeData.cards_count}`);
                console.log(`   📝 Ejemplos:`);
                
                themeData.cards.slice(0, 3).forEach((card, index) => {
                    const preview = card.discovery?.substring(0, 100) || card.description?.substring(0, 100) || 'Sin descripción';
                    console.log(`      ${index + 1}. ${card.entity || 'Sin entidad'}: ${preview}...`);
                });
                
                if (themeData.cards.length > 3) {
                    console.log(`      ... y ${themeData.cards.length - 3} hallazgos más`);
                }
            });

            // 4. Probar estructura JSON guardada en discovery_context
            console.log('\n4️⃣ Verificando estructura JSON en discovery_context...');
            
            if (details.theme_summary && Object.keys(details.theme_summary).length > 0) {
                console.log('✅ Discovery context tiene estructura JSON válida:');
                Object.entries(details.theme_summary).forEach(([themeName, themeData]) => {
                    console.log(`   🎯 ${themeName}: ${themeData.cards_count} hallazgo(s), ${themeData.sample_cards?.length || 0} muestra(s)`);
                });
            } else {
                console.log('⚠️  Discovery context no tiene estructura JSON o está vacío');
            }

        } else {
            console.log('\n⚠️  No se encontró cobertura de departamento Guatemala para probar detalles');
        }

        // 5. Verificar que no hay duplicados
        console.log('\n5️⃣ Verificando duplicados...');
        const locationCounts = {};
        coverages.forEach(coverage => {
            const key = `${coverage.coverage_type}:${coverage.name}`;
            locationCounts[key] = (locationCounts[key] || 0) + 1;
        });

        const duplicates = Object.entries(locationCounts).filter(([_, count]) => count > 1);
        
        if (duplicates.length === 0) {
            console.log('✅ No se encontraron coberturas duplicadas');
        } else {
            console.log('❌ Se encontraron duplicados:');
            duplicates.forEach(([location, count]) => {
                console.log(`   - ${location}: ${count} veces`);
            });
        }

        console.log('\n🎉 PRUEBA COMPLETADA EXITOSAMENTE');

    } catch (error) {
        console.error('❌ ERROR DURANTE LA PRUEBA:');
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${error.response.data?.error || error.response.data}`);
            console.error(`   Details: ${error.response.data?.details || 'No details'}`);
        } else {
            console.error(`   Message: ${error.message}`);
        }
        
        console.log('\n💡 SOLUCIONES POSIBLES:');
        console.log('1. Verificar que el servidor ExtractorW esté corriendo en puerto 5002');
        console.log('2. Actualizar TEST_PROJECT_ID con un ID de proyecto válido');
        console.log('3. Actualizar AUTH_TOKEN con un token de autenticación válido');
        console.log('4. Verificar que el proyecto tenga hallazgos con información geográfica');
    }
}

// Función de ayuda
function showUsageInstructions() {
    console.log('📋 INSTRUCCIONES DE USO:');
    console.log('========================');
    console.log('1. Actualizar las variables en el script:');
    console.log('   - TEST_PROJECT_ID: ID del proyecto a probar');
    console.log('   - AUTH_TOKEN: Token de autenticación del usuario');
    console.log('');
    console.log('2. Asegurar que ExtractorW esté corriendo:');
    console.log('   cd ExtractorW && npm start');
    console.log('');
    console.log('3. Ejecutar el script:');
    console.log('   node test-coverage-structure.js');
    console.log('');
    console.log('🎯 Este script verificará:');
    console.log('   - Agrupamiento correcto por ubicación (no por tema)');
    console.log('   - Estructura interna de temas dentro de cada cobertura');
    console.log('   - Ausencia de duplicados');
    console.log('   - Funcionalidad del endpoint de detalles');
    console.log('');
}

// Verificar argumentos
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsageInstructions();
} else if (TEST_PROJECT_ID === 'tu-project-id-aqui' || AUTH_TOKEN === 'tu-token-aqui') {
    console.log('⚠️  CONFIGURACIÓN REQUERIDA');
    console.log('===========================');
    console.log('Por favor actualiza las variables TEST_PROJECT_ID y AUTH_TOKEN en el script.');
    console.log('Usa --help para ver instrucciones completas.');
} else {
    testCoverageStructure();
} 