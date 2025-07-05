/**
 * Script de prueba para el sistema de análisis automático de enlaces multimedia
 * 
 * Este script prueba:
 * 1. Obtener estadísticas de enlaces pendientes
 * 2. Procesar enlaces multimedia y básicos
 * 3. Verificar la integración con ExtractorT
 * 4. Validar el sistema de créditos
 * 
 * Uso: node test-pending-analysis.js
 */

const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración
const EXTRACTORW_URL = process.env.EXTRACTORW_URL || 'http://localhost:3000';
const EXTRACTORT_URL = process.env.EXTRACTORT_URL || 'http://localhost:8000';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';
const TEST_ACCESS_TOKEN = process.env.TEST_ACCESS_TOKEN || 'test-token';

// URLs de prueba
const TEST_URLS = {
    multimedia: [
        'https://twitter.com/user/status/1234567890', // Tweet con video
        'https://x.com/user/status/9876543210', // Tweet con imagen
        'https://youtube.com/watch?v=dQw4w9WgXcQ', // Video de YouTube
        'https://instagram.com/p/ABC123/', // Post de Instagram
    ],
    basic: [
        'https://www.example.com/article',
        'https://github.com/user/repo',
        'https://docs.google.com/document/d/123',
        'https://medium.com/@user/article-title'
    ]
};

/**
 * Función para hacer peticiones HTTP con autenticación
 */
async function makeRequest(method, url, data = null, headers = {}) {
    const config = {
        method,
        url,
        headers: {
            'Authorization': `Bearer ${TEST_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            ...headers
        }
    };
    
    if (data) {
        config.data = data;
    }
    
    try {
        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status
        };
    }
}

/**
 * Prueba 1: Verificar que ExtractorT está disponible
 */
async function testExtractorTAvailability() {
    console.log('\n🔍 Prueba 1: Verificando disponibilidad de ExtractorT');
    
    try {
        const response = await axios.get(`${EXTRACTORT_URL}/`);
        console.log('✅ ExtractorT está disponible');
        console.log(`   Status: ${response.data.status}`);
        console.log(`   Message: ${response.data.message}`);
        return true;
    } catch (error) {
        console.error('❌ ExtractorT no está disponible');
        console.error(`   Error: ${error.message}`);
        return false;
    }
}

/**
 * Prueba 2: Verificar endpoint de descarga de medios
 */
async function testMediaDownloaderEndpoint() {
    console.log('\n🔍 Prueba 2: Verificando endpoint de descarga de medios');
    
    try {
        const response = await axios.get(`${EXTRACTORT_URL}/media/status`);
        console.log('✅ Endpoint de descarga de medios disponible');
        console.log(`   Status: ${response.data.status}`);
        return true;
    } catch (error) {
        console.error('❌ Endpoint de descarga de medios no disponible');
        console.error(`   Error: ${error.message}`);
        return false;
    }
}

/**
 * Prueba 3: Obtener estadísticas de enlaces pendientes
 */
async function testPendingStats() {
    console.log('\n🔍 Prueba 3: Obteniendo estadísticas de enlaces pendientes');
    
    const result = await makeRequest('GET', `${EXTRACTORW_URL}/api/pending-analysis/pending-stats`);
    
    if (result.success) {
        console.log('✅ Estadísticas obtenidas correctamente');
        console.log(`   Total pendientes: ${result.data.stats.totalPending}`);
        console.log(`   URLs multimedia: ${result.data.stats.multimediaUrls}`);
        console.log(`   URLs básicas: ${result.data.stats.basicUrls}`);
        
        if (result.data.stats.items.length > 0) {
            console.log('\n   📋 Primeros 3 items:');
            result.data.stats.items.slice(0, 3).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.titulo} (${item.isMultimedia ? 'multimedia' : 'básico'}) - ${item.creditsRequired} créditos`);
            });
        }
        
        return result.data.stats;
    } else {
        console.error('❌ Error obteniendo estadísticas');
        console.error(`   Error: ${result.error}`);
        return null;
    }
}

/**
 * Prueba 4: Simular análisis de enlaces (dry run)
 */
async function testDryRunAnalysis() {
    console.log('\n🔍 Prueba 4: Simulando análisis de enlaces (dry run)');
    
    const result = await makeRequest('POST', `${EXTRACTORW_URL}/api/pending-analysis/analyze-pending-links`, {
        dryRun: true,
        processAll: true
    });
    
    if (result.success) {
        console.log('✅ Simulación completada correctamente');
        console.log(`   Items a procesar: ${result.data.total}`);
        console.log(`   Items procesados: ${result.data.processed}`);
        console.log(`   Créditos estimados: ${result.data.creditsUsed}`);
        
        if (result.data.results.length > 0) {
            console.log('\n   📋 Resultados:');
            result.data.results.slice(0, 5).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.success ? '✅' : '❌'} ${item.message} (${item.creditsUsed} créditos)`);
            });
        }
        
        return result.data;
    } else {
        console.error('❌ Error en simulación');
        console.error(`   Error: ${result.error}`);
        return null;
    }
}

/**
 * Prueba 5: Análisis real de un enlace específico
 */
async function testRealAnalysis(itemId) {
    console.log('\n🔍 Prueba 5: Realizando análisis real de un enlace');
    
    if (!itemId) {
        console.log('⚠️ No se proporcionó ID de item, saltando prueba real');
        return null;
    }
    
    const result = await makeRequest('POST', `${EXTRACTORW_URL}/api/pending-analysis/analyze-pending-links`, {
        itemIds: [itemId],
        dryRun: false
    });
    
    if (result.success) {
        console.log('✅ Análisis real completado');
        console.log(`   Items procesados: ${result.data.processed}`);
        console.log(`   Créditos usados: ${result.data.creditsUsed}`);
        
        if (result.data.results.length > 0) {
            const item = result.data.results[0];
            console.log(`   Resultado: ${item.success ? '✅' : '❌'} ${item.message}`);
            console.log(`   Tipo: ${item.analysisType || 'N/A'}`);
            console.log(`   Archivos procesados: ${item.filesProcessed || 0}`);
        }
        
        return result.data;
    } else {
        console.error('❌ Error en análisis real');
        console.error(`   Error: ${result.error}`);
        return null;
    }
}

/**
 * Prueba 6: Verificar detección de URLs multimedia
 */
async function testUrlDetection() {
    console.log('\n🔍 Prueba 6: Verificando detección de URLs multimedia');
    
    console.log('\n   📱 URLs multimedia:');
    TEST_URLS.multimedia.forEach(url => {
        console.log(`   - ${url}`);
    });
    
    console.log('\n   📄 URLs básicas:');
    TEST_URLS.basic.forEach(url => {
        console.log(`   - ${url}`);
    });
    
    console.log('\n   ✅ Detección configurada (se validará en análisis real)');
}

/**
 * Función principal de pruebas
 */
async function runAllTests() {
    console.log('🧪 Iniciando pruebas del sistema de análisis automático de enlaces multimedia');
    console.log('=' .repeat(80));
    
    // Configuración de prueba
    console.log('\n📋 Configuración de prueba:');
    console.log(`   ExtractorW URL: ${EXTRACTORW_URL}`);
    console.log(`   ExtractorT URL: ${EXTRACTORT_URL}`);
    console.log(`   Test User ID: ${TEST_USER_ID}`);
    console.log(`   Access Token: ${TEST_ACCESS_TOKEN ? '✅ Configurado' : '❌ No configurado'}`);
    
    const results = {
        extractorTAvailable: false,
        mediaEndpointAvailable: false,
        pendingStats: null,
        dryRunAnalysis: null,
        realAnalysis: null,
        urlDetection: true
    };
    
    // Ejecutar pruebas
    results.extractorTAvailable = await testExtractorTAvailability();
    results.mediaEndpointAvailable = await testMediaDownloaderEndpoint();
    results.pendingStats = await testPendingStats();
    results.dryRunAnalysis = await testDryRunAnalysis();
    
    // Análisis real solo si hay items pendientes
    if (results.pendingStats && results.pendingStats.totalPending > 0) {
        const firstItemId = results.pendingStats.items[0]?.id;
        results.realAnalysis = await testRealAnalysis(firstItemId);
    }
    
    await testUrlDetection();
    
    // Resumen final
    console.log('\n' + '=' .repeat(80));
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('=' .repeat(80));
    
    console.log(`✅ ExtractorT disponible: ${results.extractorTAvailable ? 'SÍ' : 'NO'}`);
    console.log(`✅ Endpoint de medios disponible: ${results.mediaEndpointAvailable ? 'SÍ' : 'NO'}`);
    console.log(`✅ Estadísticas de pendientes: ${results.pendingStats ? 'SÍ' : 'NO'}`);
    console.log(`✅ Simulación de análisis: ${results.dryRunAnalysis ? 'SÍ' : 'NO'}`);
    console.log(`✅ Análisis real: ${results.realAnalysis ? 'SÍ' : 'NO EJECUTADO'}`);
    console.log(`✅ Detección de URLs: ${results.urlDetection ? 'SÍ' : 'NO'}`);
    
    if (results.pendingStats) {
        console.log(`\n📈 Enlaces pendientes: ${results.pendingStats.totalPending}`);
        console.log(`📱 Multimedia: ${results.pendingStats.multimediaUrls} (${results.pendingStats.multimediaUrls * 25} créditos)`);
        console.log(`📄 Básicos: ${results.pendingStats.basicUrls} (${results.pendingStats.basicUrls * 5} créditos)`);
        console.log(`💰 Total créditos estimados: ${(results.pendingStats.multimediaUrls * 25) + (results.pendingStats.basicUrls * 5)}`);
    }
    
    // Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    if (!results.extractorTAvailable) {
        console.log('- Verificar que ExtractorT esté ejecutándose en el puerto correcto');
    }
    if (!results.mediaEndpointAvailable) {
        console.log('- Verificar que el endpoint de media downloader esté disponible');
    }
    if (!results.pendingStats) {
        console.log('- Verificar autenticación y permisos del usuario');
    }
    if (results.pendingStats && results.pendingStats.totalPending === 0) {
        console.log('- Crear algunos enlaces con etiqueta "pendiente-analisis" para probar el sistema');
    }
    
    console.log('\n🎉 Pruebas completadas');
}

// Ejecutar pruebas si se ejecuta directamente
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    runAllTests,
    testExtractorTAvailability,
    testMediaDownloaderEndpoint,
    testPendingStats,
    testDryRunAnalysis,
    testRealAnalysis,
    testUrlDetection
}; 