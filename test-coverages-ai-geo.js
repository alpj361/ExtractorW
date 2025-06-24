const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:5002/api';
const TEST_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000'; // Usar un project_id de prueba
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'; // Token de prueba

async function testCoveragesWithAI() {
    console.log('🧪 PROBANDO SISTEMA DE COBERTURAS CON IA GEOGRÁFICA\n');

    try {
        // 1. Probar auto-detect con IA
        console.log('1️⃣ Probando auto-detect de coberturas con IA...');
        
        const autoDetectResponse = await axios.post(`${BASE_URL}/coverages/auto-detect`, {
            project_id: TEST_PROJECT_ID
        }, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Auto-detect exitoso:');
        console.log(`   - Hallazgos procesados: ${autoDetectResponse.data.cards_processed}`);
        console.log(`   - Temas encontrados: ${autoDetectResponse.data.themes_count}`);
        console.log(`   - Coberturas creadas: ${autoDetectResponse.data.created_count}`);
        console.log(`   - Mensaje: ${autoDetectResponse.data.message}\n`);

        if (autoDetectResponse.data.coverage_groups.length > 0) {
            console.log('📊 Grupos de cobertura generados:');
            autoDetectResponse.data.coverage_groups.forEach(group => {
                console.log(`   Tema: ${group.topic}`);
                console.log(`   - Países: ${group.countries.length} (${group.countries.join(', ')})`);
                console.log(`   - Departamentos: ${group.departments.length} (${group.departments.join(', ')})`);
                console.log(`   - Ciudades: ${group.cities.length} (${group.cities.join(', ')})`);
                console.log(`   - Coberturas creadas: ${group.coverages_created.length}`);
                console.log('');
            });
        }

        // 2. Probar actualización de geografía
        console.log('2️⃣ Probando actualización de información geográfica...');
        
        const updateResponse = await axios.post(`${BASE_URL}/coverages/update-geography`, {
            project_id: TEST_PROJECT_ID
            // Sin card_ids para actualizar todos los hallazgos
        }, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Actualización geográfica exitosa:');
        console.log(`   - Hallazgos procesados: ${updateResponse.data.stats.total_processed}`);
        console.log(`   - Actualizados: ${updateResponse.data.stats.updated_count}`);
        console.log(`   - Sin cambios: ${updateResponse.data.stats.no_changes_count}`);
        console.log(`   - Errores: ${updateResponse.data.stats.error_count}`);
        console.log(`   - Detecciones por IA: ${updateResponse.data.stats.ai_detections || 0}`);
        console.log(`   - Fallback manual: ${updateResponse.data.stats.manual_fallback || 0}`);
        console.log(`   - Mensaje: ${updateResponse.data.message}\n`);

        if (updateResponse.data.details && updateResponse.data.details.length > 0) {
            console.log('📋 Detalles de actualización:');
            updateResponse.data.details.slice(0, 5).forEach(detail => {
                console.log(`   Card ${detail.card_id}: ${detail.updated ? '✅ Actualizada' : '⏸️ Sin cambios'} (${detail.detection_method || 'N/A'})`);
            });
            if (updateResponse.data.details.length > 5) {
                console.log(`   ... y ${updateResponse.data.details.length - 5} más`);
            }
        }

        // 3. Probar actualización de IDs específicos
        console.log('\n3️⃣ Probando actualización de hallazgos específicos...');
        
        const specificUpdateResponse = await axios.post(`${BASE_URL}/coverages/update-geography`, {
            project_id: TEST_PROJECT_ID,
            card_ids: ['test-id-1', 'test-id-2', 'test-id-3'] // IDs de ejemplo
        }, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Actualización específica exitosa:');
        console.log(`   - Mensaje: ${specificUpdateResponse.data.message}`);

        console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');

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
    }
}

async function testCoveragesList() {
    console.log('\n📋 PROBANDO LISTADO DE COBERTURAS EXISTENTES...');

    try {
        const response = await axios.get(`${BASE_URL}/coverages`, {
            params: { project_id: TEST_PROJECT_ID },
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });

        console.log('✅ Listado exitoso:');
        console.log(`   - Total de coberturas: ${response.data.data.length}`);
        
        if (response.data.data.length > 0) {
            console.log('\n📊 Coberturas existentes:');
            const coveragesByType = {};
            
            response.data.data.forEach(coverage => {
                if (!coveragesByType[coverage.coverage_type]) {
                    coveragesByType[coverage.coverage_type] = [];
                }
                coveragesByType[coverage.coverage_type].push(coverage);
            });

            Object.entries(coveragesByType).forEach(([type, coverages]) => {
                console.log(`   ${type.toUpperCase()}: ${coverages.length}`);
                coverages.slice(0, 3).forEach(c => {
                    console.log(`     - ${c.name} (${c.detection_source || 'manual'}) - ${c.topic || 'Sin tema'}`);
                });
                if (coverages.length > 3) {
                    console.log(`     ... y ${coverages.length - 3} más`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Error obteniendo coberturas:', error.response?.data || error.message);
    }
}

// Funciones de prueba rápida
async function quickTestGeography() {
    console.log('⚡ PRUEBA RÁPIDA - Solo actualización geográfica');
    
    try {
        const response = await axios.post(`${BASE_URL}/coverages/update-geography`, {
            project_id: TEST_PROJECT_ID
        }, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Actualización exitosa:', response.data.message);
        console.log('📊 Stats:', response.data.stats);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

async function quickTestAutoDetect() {
    console.log('⚡ PRUEBA RÁPIDA - Solo auto-detect');
    
    try {
        const response = await axios.post(`${BASE_URL}/coverages/auto-detect`, {
            project_id: TEST_PROJECT_ID
        }, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Auto-detect exitoso:', response.data.message);
        console.log('📊 Coberturas creadas:', response.data.created_count);
        console.log('📊 Temas procesados:', response.data.themes_count);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

// Ejecutar pruebas según argumentos
if (process.argv.includes('--quick-geo')) {
    quickTestGeography();
} else if (process.argv.includes('--quick-detect')) {
    quickTestAutoDetect();
} else if (process.argv.includes('--list')) {
    testCoveragesList();
} else if (process.argv.includes('--full')) {
    testCoveragesWithAI().then(() => testCoveragesList());
} else {
    console.log('🧪 SCRIPT DE PRUEBA DE COBERTURAS CON IA GEOGRÁFICA');
    console.log('');
    console.log('Opciones de uso:');
    console.log('  node test-coverages-ai-geo.js --full           # Prueba completa');
    console.log('  node test-coverages-ai-geo.js --quick-geo      # Solo actualización geográfica');
    console.log('  node test-coverages-ai-geo.js --quick-detect   # Solo auto-detect');
    console.log('  node test-coverages-ai-geo.js --list           # Listar coberturas existentes');
    console.log('');
    console.log('Configuración actual:');
    console.log(`  - Base URL: ${BASE_URL}`);
    console.log(`  - Project ID: ${TEST_PROJECT_ID}`);
    console.log('');
    console.log('💡 Ejecuta con --full para prueba completa');
} 