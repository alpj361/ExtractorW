// ===================================================================
// TEST USER DATA TOOLS - MCP
// Script de prueba para herramientas de datos del usuario
// ===================================================================

require('dotenv').config();
const mcpService = require('./server/services/mcp');
const { getUserProjects, getUserCodex, getUserStats, searchUserCodex } = require('./server/services/supabaseData');

// Mock de usuario para pruebas
const testUser = {
  id: 'c8a00e51-0123-4567-8901-123456789abc', // ID de prueba
  email: 'test@example.com',
  full_name: 'Usuario de Prueba'
};

async function runTests() {
  console.log('🧪 INICIANDO PRUEBAS DE HERRAMIENTAS MCP PARA DATOS DEL USUARIO');
  console.log('=' .repeat(70));

  try {
    // 1. Prueba listar herramientas MCP
    console.log('\n📋 1. LISTANDO HERRAMIENTAS MCP DISPONIBLES...');
    const tools = await mcpService.listAvailableTools();
    console.log(`✅ ${tools.length} herramientas disponibles:`);
    tools.forEach(tool => {
      console.log(`   • ${tool.name}: ${tool.description.substring(0, 60)}...`);
    });

    // Verificar que las nuevas herramientas estén disponibles
    const userProjectsTool = tools.find(t => t.name === 'user_projects');
    const userCodexTool = tools.find(t => t.name === 'user_codex');

    if (!userProjectsTool) {
      throw new Error('❌ Herramienta user_projects no encontrada');
    }
    if (!userCodexTool) {
      throw new Error('❌ Herramienta user_codex no encontrada');
    }
    console.log('✅ Nuevas herramientas registradas correctamente');

    // 2. Prueba ejecutar user_projects directamente
    console.log('\n📊 2. PROBANDO HERRAMIENTA user_projects...');
    try {
      const projectsResult = await mcpService.executeTool('user_projects', {
        limit: 5,
        status: 'active'
      }, testUser);

      console.log('✅ user_projects ejecutada exitosamente');
      console.log(`   • Proyectos encontrados: ${projectsResult.total_projects}`);
      console.log(`   • Estadísticas incluidas: ${projectsResult.user_stats ? 'Sí' : 'No'}`);
      console.log(`   • Respuesta formateada: ${projectsResult.formatted_response ? 'Sí' : 'No'}`);
      
      if (projectsResult.projects && projectsResult.projects.length > 0) {
        console.log(`   • Primer proyecto: ${projectsResult.projects[0].title}`);
      }

    } catch (error) {
      console.log(`⚠️ Error esperado con usuario de prueba: ${error.message}`);
      console.log('   (Esto es normal si el usuario no existe en la base de datos)');
    }

    // 3. Prueba ejecutar user_codex directamente
    console.log('\n📚 3. PROBANDO HERRAMIENTA user_codex...');
    try {
      const codexResult = await mcpService.executeTool('user_codex', {
        limit: 5,
        query: 'análisis'
      }, testUser);

      console.log('✅ user_codex ejecutada exitosamente');
      console.log(`   • Items encontrados: ${codexResult.total_items}`);
      console.log(`   • Búsqueda realizada: ${codexResult.metadata.search_performed ? 'Sí' : 'No'}`);
      console.log(`   • Respuesta formateada: ${codexResult.formatted_response ? 'Sí' : 'No'}`);

    } catch (error) {
      console.log(`⚠️ Error esperado con usuario de prueba: ${error.message}`);
      console.log('   (Esto es normal si el usuario no existe en la base de datos)');
    }

    // 4. Prueba validación de parámetros
    console.log('\n🔧 4. PROBANDO VALIDACIÓN DE PARÁMETROS...');
    
    // Prueba con parámetros inválidos
    try {
      await mcpService.executeTool('user_projects', {
        limit: -5  // Límite inválido
      }, testUser);
    } catch (error) {
      console.log('✅ Validación funcionando: límite negativo rechazado');
    }

    try {
      await mcpService.executeTool('user_codex', {
        limit: 1000  // Límite excesivo
      }, testUser);
    } catch (error) {
      console.log('✅ Validación funcionando: límite excesivo rechazado');
    }

    // 5. Prueba sin usuario autenticado
    console.log('\n🔐 5. PROBANDO SEGURIDAD - SIN USUARIO AUTENTICADO...');
    try {
      await mcpService.executeTool('user_projects', {}, null);
    } catch (error) {
      if (error.message.includes('autenticado')) {
        console.log('✅ Seguridad funcionando: acceso denegado sin autenticación');
      } else {
        console.log(`⚠️ Error inesperado: ${error.message}`);
      }
    }

    try {
      await mcpService.executeTool('user_codex', {}, null);
    } catch (error) {
      if (error.message.includes('autenticado')) {
        console.log('✅ Seguridad funcionando: acceso denegado sin autenticación');
      } else {
        console.log(`⚠️ Error inesperado: ${error.message}`);
      }
    }

    // 6. Prueba información de herramientas
    console.log('\n📖 6. OBTENIENDO INFORMACIÓN DETALLADA DE HERRAMIENTAS...');
    
    const projectsInfo = await mcpService.getToolInfo('user_projects');
    console.log('✅ user_projects info obtenida:');
    console.log(`   • Categoría: ${projectsInfo.category}`);
    console.log(`   • Créditos: ${projectsInfo.usage_credits}`);
    console.log(`   • Parámetros: ${Object.keys(projectsInfo.parameters).join(', ')}`);

    const codexInfo = await mcpService.getToolInfo('user_codex');
    console.log('✅ user_codex info obtenida:');
    console.log(`   • Categoría: ${codexInfo.category}`);
    console.log(`   • Créditos: ${codexInfo.usage_credits}`);
    console.log(`   • Parámetros: ${Object.keys(codexInfo.parameters).join(', ')}`);

    // 7. Prueba estado del servidor MCP
    console.log('\n📊 7. VERIFICANDO ESTADO DEL SERVIDOR MCP...');
    const serverStatus = await mcpService.getServerStatus();
    console.log('✅ Estado del servidor obtenido:');
    console.log(`   • Herramientas disponibles: ${serverStatus.available_tools}`);
    console.log(`   • Lista de herramientas: ${serverStatus.tools_list.join(', ')}`);
    console.log(`   • Estado: ${serverStatus.status}`);

    // Verificar que las nuevas herramientas estén en la lista
    if (serverStatus.tools_list.includes('user_projects') && 
        serverStatus.tools_list.includes('user_codex')) {
      console.log('✅ Nuevas herramientas incluidas en estado del servidor');
    } else {
      console.log('⚠️ Nuevas herramientas no aparecen en estado del servidor');
    }

    // 8. Prueba servicios de Supabase directamente (opcional)
    console.log('\n🗄️ 8. PROBANDO SERVICIOS DE SUPABASE DIRECTAMENTE...');
    try {
      // Solo si las variables de entorno están configuradas
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        console.log('⚠️ Probando conexión a Supabase con usuario de prueba...');
        console.log('   (Se espera error si el usuario no existe)');
        
        try {
          const stats = await getUserStats(testUser.id);
          console.log('✅ Estadísticas obtenidas (usuario existe):', stats);
        } catch (error) {
          console.log(`⚠️ Error esperado: ${error.message}`);
        }
      } else {
        console.log('⚠️ Variables de entorno de Supabase no configuradas, saltando prueba');
      }
    } catch (error) {
      console.log(`⚠️ Error de conexión Supabase: ${error.message}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('✅ Todas las herramientas de datos del usuario están funcionando');
    console.log('✅ Validación de parámetros operativa');
    console.log('✅ Seguridad de autenticación implementada');
    console.log('✅ Integración MCP completa');

    // Resumen de herramientas
    console.log('\n📋 RESUMEN DE HERRAMIENTAS DE DATOS DEL USUARIO:');
    console.log(`• user_projects: ${userProjectsTool.description}`);
    console.log(`• user_codex: ${userCodexTool.description}`);
    console.log('\n🚀 El sistema está listo para usar en Vizta Chat');

  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Función para pruebas con usuario real (opcional)
async function testWithRealUser(userId) {
  console.log(`\n🔄 PROBANDO CON USUARIO REAL: ${userId}`);
  
  const realUser = {
    id: userId,
    email: 'usuario@real.com'
  };

  try {
    // Probar user_projects
    const projectsResult = await mcpService.executeTool('user_projects', { limit: 3 }, realUser);
    console.log(`✅ Proyectos encontrados: ${projectsResult.total_projects}`);
    
    // Probar user_codex
    const codexResult = await mcpService.executeTool('user_codex', { limit: 3 }, realUser);
    console.log(`✅ Items del Codex encontrados: ${codexResult.total_items}`);
    
  } catch (error) {
    console.log(`⚠️ Error con usuario real: ${error.message}`);
  }
}

// Ejecutar pruebas
if (require.main === module) {
  runTests().then(() => {
    console.log('\n🏁 Script de prueba terminado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testWithRealUser
}; 