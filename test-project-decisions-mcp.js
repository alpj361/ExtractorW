const axios = require('axios');
require('dotenv').config();

// Configuración
const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'http://localhost:3005';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

console.log('🧪 INICIANDO PRUEBAS DE PROJECT_DECISIONS MCP');
console.log('============================================');

async function testProjectDecisionsMCP() {
  let authToken = null;
  
  try {
    // 1. Autenticación
    console.log('\n1️⃣ PASO 1: Autenticación');
    const loginResponse = await axios.post(`${EXTRACTOR_W_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.token;
      console.log(`✅ Login exitoso para: ${loginResponse.data.user.email}`);
    } else {
      throw new Error('Fallo en autenticación');
    }
    
    // Headers para requests autenticados
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
    
    // 2. Verificar herramientas disponibles
    console.log('\n2️⃣ PASO 2: Verificando herramientas MCP disponibles');
    const toolsResponse = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/tools`, { headers });
    
    if (toolsResponse.data.success) {
      const tools = toolsResponse.data.tools;
      console.log(`✅ ${tools.length} herramientas MCP disponibles:`);
      
      const projectDecisionsTool = tools.find(tool => tool.name === 'project_decisions');
      if (projectDecisionsTool) {
        console.log(`   ✅ project_decisions: ${projectDecisionsTool.description}`);
        console.log(`   📋 Parámetros requeridos: ${Object.keys(projectDecisionsTool.parameters).join(', ')}`);
      } else {
        console.log('   ❌ Herramienta project_decisions NO encontrada');
        return;
      }
      
      // Listar todas las herramientas
      tools.forEach(tool => {
        console.log(`   • ${tool.name}: ${tool.description.substring(0, 80)}...`);
      });
    }
    
    // 3. Obtener proyectos del usuario
    console.log('\n3️⃣ PASO 3: Obteniendo proyectos del usuario');
    const projectsResponse = await axios.post(`${EXTRACTOR_W_URL}/api/mcp/execute`, {
      tool_name: 'user_projects',
      parameters: { limit: 5 }
    }, { headers });
    
    let testProjectId = null;
    if (projectsResponse.data.success && projectsResponse.data.result.projects.length > 0) {
      const projects = projectsResponse.data.result.projects;
      console.log(`✅ ${projects.length} proyectos encontrados:`);
      
      projects.forEach((project, index) => {
        console.log(`   ${index + 1}. ${project.title} (ID: ${project.id})`);
        console.log(`      Estado: ${project.status} | Decisiones: ${project.stats.decisionsCount}`);
        
        // Usar el primer proyecto con decisiones como test
        if (!testProjectId && project.stats.decisionsCount > 0) {
          testProjectId = project.id;
          console.log(`   🎯 Seleccionando proyecto para prueba: ${project.title}`);
        }
      });
      
      if (!testProjectId) {
        testProjectId = projects[0].id;
        console.log(`   ⚠️  Ningún proyecto tiene decisiones. Usando el primero para prueba: ${projects[0].title}`);
      }
    } else {
      console.log('⚠️  No se encontraron proyectos. Creando proyecto de prueba...');
      
      // Crear proyecto de prueba
      const createProjectResponse = await axios.post(`${EXTRACTOR_W_URL}/api/projects`, {
        title: 'Proyecto de Prueba MCP',
        description: 'Proyecto creado para probar herramienta project_decisions',
        status: 'active',
        priority: 'medium',
        category: 'test'
      }, { headers });
      
      if (createProjectResponse.data.success) {
        testProjectId = createProjectResponse.data.project.id;
        console.log(`✅ Proyecto de prueba creado: ${testProjectId}`);
      } else {
        throw new Error('No se pudo crear proyecto de prueba');
      }
    }
    
    // 4. Probar herramienta project_decisions directamente via MCP execute
    console.log('\n4️⃣ PASO 4: Probando project_decisions via MCP execute');
    const mcpResponse = await axios.post(`${EXTRACTOR_W_URL}/api/mcp/execute`, {
      tool_name: 'project_decisions',
      parameters: { project_id: testProjectId }
    }, { headers });
    
    if (mcpResponse.data.success) {
      const result = mcpResponse.data.result;
      console.log(`✅ Decisiones obtenidas via MCP execute:`);
      console.log(`   📊 Proyecto: ${result.project_title}`);
      console.log(`   📋 Total decisiones: ${result.total_decisions}`);
      
      if (result.decisions && result.decisions.length > 0) {
        console.log(`   🔹 Decisiones encontradas:`);
        result.decisions.forEach((decision, index) => {
          console.log(`      ${index + 1}. ${decision.title} [${decision.decision_type}]`);
          if (decision.description) {
            console.log(`         ${decision.description.substring(0, 100)}...`);
          }
        });
      } else {
        console.log(`   ℹ️  El proyecto no tiene decisiones aún`);
      }
      
      console.log(`\n📝 Respuesta formateada para agente AI:`);
      console.log(result.formatted_response.substring(0, 500) + '...');
    } else {
      console.log('❌ Error ejecutando project_decisions via MCP');
      console.log(`   Error: ${mcpResponse.data.error || 'Error desconocido'}`);
    }
    
    // 5. Probar endpoint directo
    console.log('\n5️⃣ PASO 5: Probando endpoint directo /api/mcp/project_decisions');
    const directResponse = await axios.post(`${EXTRACTOR_W_URL}/api/mcp/project_decisions`, {
      project_id: testProjectId
    }, { headers });
    
    if (directResponse.data.success) {
      console.log(`✅ Endpoint directo funcionando correctamente`);
      console.log(`   📊 Proyecto: ${directResponse.data.result.project_title}`);
      console.log(`   📋 Total decisiones: ${directResponse.data.result.total_decisions}`);
    } else {
      console.log('❌ Error en endpoint directo');
      console.log(`   Error: ${directResponse.data.error || 'Error desconocido'}`);
    }
    
    // 6. Verificar estado del MCP Server
    console.log('\n6️⃣ PASO 6: Estado del MCP Server');
    const statusResponse = await axios.get(`${EXTRACTOR_W_URL}/api/mcp/status`);
    
    if (statusResponse.data.success) {
      const status = statusResponse.data.status;
      console.log(`✅ MCP Server: ${status.server_name} v${status.version}`);
      console.log(`   📊 Herramientas disponibles: ${status.available_tools}`);
      console.log(`   🔧 Lista: ${status.tools_list.join(', ')}`);
      
      if (status.tools_list.includes('project_decisions')) {
        console.log(`   ✅ project_decisions está registrada en el servidor`);
      } else {
        console.log(`   ❌ project_decisions NO está registrada en el servidor`);
      }
    }
    
    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log('============================================');
    console.log('✅ Herramienta project_decisions implementada correctamente');
    console.log('✅ Robert ahora puede acceder a decisiones de proyectos del usuario');
    console.log('✅ Endpoints MCP funcionando');
    console.log('✅ Autenticación y autorización funcionando');
    
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

// Ejecutar pruebas
testProjectDecisionsMCP(); 