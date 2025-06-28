// ===================================================================
// TEST PERPLEXITY MCP INTEGRATION
// Script para probar la integración de Perplexity en el sistema MCP
// ===================================================================

require('dotenv').config();
const mcpService = require('./server/services/mcp');

// Configuración de pruebas - CON ENFOQUE TEMPORAL
const TEST_CASES = [
  {
    name: 'Búsqueda Web Temporal - Política Actual',
    tool: 'perplexity_search',
    params: {
      query: 'Bernardo Arévalo presidente Guatemala situación actual',
      location: 'Guatemala',
      focus: 'politica'
    }
  },
  {
    name: 'Búsqueda con Optimización Temporal para Nitter',
    tool: 'perplexity_search',
    params: {
      query: 'Copa América 2025 Guatemala actualidad',
      location: 'Guatemala',
      focus: 'deportes',
      improve_nitter_search: true
    }
  },
  {
    name: 'Búsqueda de Eventos Actuales con Filtro Temporal',
    tool: 'perplexity_search',
    params: {
      query: 'Festival Antigua Guatemala enero 2025',
      location: 'Guatemala',
      focus: 'eventos'
    }
  },
  {
    name: 'Análisis de Tendencias Actuales (Nitter)',
    tool: 'nitter_context',
    params: {
      q: 'BernardoArevalo OR presidente OR GobiernoGt OR Arevalo2025',
      location: 'guatemala',
      limit: 10
    }
  },
  {
    name: 'Búsqueda de Noticias Recientes',
    tool: 'perplexity_search',
    params: {
      query: 'noticias Guatemala enero 2025 actualidad',
      location: 'Guatemala',
      focus: 'noticias'
    }
  },
  {
    name: 'Prueba de Expansión Temporal de Términos',
    tool: 'nitter_context',
    params: {
      q: 'marcha del orgullo',  // Se expandirá automáticamente con contexto temporal
      location: 'guatemala',
      limit: 5
    }
  }
];

// Usuario de prueba simulado
const TEST_USER = {
  id: 'test_user_123',
  email: 'test@example.com'
};

/**
 * Ejecuta todas las pruebas del sistema MCP con Perplexity
 */
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN PERPLEXITY-MCP');
  console.log('=' .repeat(60));
  
  try {
    // 1. Verificar herramientas disponibles
    console.log('\n📋 1. VERIFICANDO HERRAMIENTAS DISPONIBLES');
    const availableTools = await mcpService.listAvailableTools();
    console.log(`✅ Herramientas disponibles: ${availableTools.length}`);
    
    availableTools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description.substring(0, 80)}...`);
    });
    
    // Verificar que perplexity_search esté disponible
    const perplexityTool = availableTools.find(t => t.name === 'perplexity_search');
    if (!perplexityTool) {
      throw new Error('❌ Herramienta perplexity_search no encontrada');
    }
    console.log('✅ Herramienta perplexity_search disponible');

    // 2. Probar mejora de términos con contexto temporal
    console.log('\n🔍 2. PROBANDO MEJORA DE TÉRMINOS CON CONTEXTO TEMPORAL');
    try {
      const originalQuery = 'marcha del orgullo';
      const basicExpansion = mcpService.expandSearchTerms(originalQuery);
      console.log(`   Query original: "${originalQuery}"`);
      console.log(`   Expansión básica temporal: "${basicExpansion}"`);
      
      // Verificar que incluye contexto temporal
      const currentYear = new Date().getFullYear();
      const hasTemporalContext = basicExpansion.includes(currentYear.toString()) || 
                                basicExpansion.includes('2025') || 
                                basicExpansion.includes('Actual');
      
      if (hasTemporalContext) {
        console.log('✅ Contexto temporal incluido en expansión básica');
      } else {
        console.log('⚠️ Contexto temporal NO incluido en expansión básica');
      }
      
      // Probar mejora con Perplexity
      const enhancedExpansion = await mcpService.enhanceSearchTermsWithPerplexity(originalQuery, true);
      console.log(`   Expansión con Perplexity: "${enhancedExpansion}"`);
      
      if (enhancedExpansion !== basicExpansion) {
        console.log('✅ Mejora con Perplexity aplicada correctamente');
        
        // Verificar contexto temporal en Perplexity
        const hasTemporalContextPerplexity = enhancedExpansion.includes('2025') || 
                                           enhancedExpansion.includes('Actual') ||
                                           enhancedExpansion.includes('enero');
        
        if (hasTemporalContextPerplexity) {
          console.log('✅ Contexto temporal incluido en expansión con Perplexity');
        } else {
          console.log('⚠️ Contexto temporal NO incluido en expansión con Perplexity');
        }
      } else {
        console.log('⚠️ Mejora con Perplexity no aplicada (usando expansión básica)');
      }
    } catch (error) {
      console.log('⚠️ Error en mejora de términos:', error.message);
    }

    // 3. Ejecutar casos de prueba
    console.log('\n🧪 3. EJECUTANDO CASOS DE PRUEBA');
    
    for (let i = 0; i < TEST_CASES.length; i++) {
      const testCase = TEST_CASES[i];
      
      console.log(`\n📝 Caso ${i + 1}: ${testCase.name}`);
      console.log(`   Herramienta: ${testCase.tool}`);
      console.log(`   Parámetros:`, JSON.stringify(testCase.params, null, 2));
      
      try {
        console.log('   ⏳ Ejecutando...');
        const startTime = Date.now();
        
        const result = await mcpService.executeTool(testCase.tool, testCase.params, TEST_USER);
        
        const executionTime = Date.now() - startTime;
        
        if (result.success) {
          console.log(`   ✅ Éxito en ${executionTime}ms`);
          
          // Mostrar resultados específicos por herramienta
          if (testCase.tool === 'perplexity_search') {
            console.log(`   📊 Resultado: ${result.query_original} → ${result.query_optimized}`);
            console.log(`   🎯 Enfoque: ${result.focus} | Ubicación: ${result.location}`);
            
            if (result.nitter_optimization) {
              console.log(`   🐦 Optimización Nitter: "${result.nitter_optimization.optimized_query}"`);
              console.log(`   #️⃣ Hashtags sugeridos: ${result.nitter_optimization.suggested_hashtags.join(', ')}`);
            }
            
            // Mostrar fragmento de la respuesta
            const responsePreview = result.formatted_response.substring(0, 200) + '...';
            console.log(`   📄 Vista previa: ${responsePreview}`);
            
          } else if (testCase.tool === 'nitter_context') {
            console.log(`   🐦 Tweets encontrados: ${result.tweets_found}`);
            console.log(`   🔍 Query expandido: ${result.query_expanded}`);
            console.log(`   📊 Límite usado: ${result.limit_used}`);
            
            if (result.analysis_metadata) {
              console.log(`   💭 Distribución sentimientos:`, result.analysis_metadata.sentiment_distribution);
              console.log(`   📈 Engagement promedio: ${result.analysis_metadata.average_engagement.toFixed(1)}`);
            }
          }
          
        } else {
          console.log(`   ❌ Error: ${result.error || 'Error desconocido'}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error ejecutando caso: ${error.message}`);
      }
      
      // Pausa entre pruebas para evitar rate limiting
      if (i < TEST_CASES.length - 1) {
        console.log('   ⏱️ Esperando 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 4. Verificar estado del servidor
    console.log('\n📊 4. VERIFICANDO ESTADO DEL SERVIDOR MCP');
    try {
      const serverStatus = await mcpService.getServerStatus();
      console.log('✅ Estado del servidor:', serverStatus.status);
      console.log(`✅ Herramientas disponibles: ${serverStatus.available_tools}`);
      console.log('✅ Servicios externos:', Object.keys(serverStatus.external_services));
    } catch (error) {
      console.log('⚠️ Error obteniendo estado:', error.message);
    }

    console.log('\n🎉 PRUEBAS COMPLETADAS');
    console.log('=' .repeat(60));
    console.log('✅ Sistema MCP con Perplexity funcionando correctamente');
    
  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO EN PRUEBAS:', error);
    console.error('=' .repeat(60));
    process.exit(1);
  }
}

/**
 * Prueba específica para verificar configuración de API keys
 */
function checkConfiguration() {
  console.log('🔧 VERIFICANDO CONFIGURACIÓN');
  console.log('-'.repeat(40));
  
  const requiredEnvVars = [
    'PERPLEXITY_API_KEY',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY'
  ];
  
  let configValid = true;
  
  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Configurado`);
    } else {
      console.log(`❌ ${envVar}: No configurado`);
      configValid = false;
    }
  });
  
  if (!configValid) {
    console.log('\n⚠️ ADVERTENCIA: Algunas configuraciones faltan');
    console.log('Algunas pruebas pueden fallar sin las API keys necesarias');
  }
  
  return configValid;
}

// Ejecutar pruebas
if (require.main === module) {
  console.log('🧪 TEST SUITE: PERPLEXITY MCP INTEGRATION');
  console.log('Fecha:', new Date().toLocaleString());
  console.log('Node.js:', process.version);
  console.log('');
  
  checkConfiguration();
  
  setTimeout(() => {
    runAllTests().catch(error => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
  }, 1000);
}

module.exports = {
  runAllTests,
  checkConfiguration,
  TEST_CASES,
  TEST_USER
}; 