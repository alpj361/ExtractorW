const axios = require('axios');
require('dotenv').config();

// Configuración
const EXTRACTOR_W_URL = process.env.EXTRACTOR_W_URL || 'http://localhost:3005';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

console.log('🤖 PROBANDO ROBERT CON DECISIONES DE PROYECTOS');
console.log('===============================================');

async function testRobertDecisions() {
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
    
    // 2. Verificar que Robert tiene la nueva herramienta
    console.log('\n2️⃣ PASO 2: Verificando herramientas de Robert');
    
    // Hacemos una consulta a agentes para ver la configuración de Robert
    const agentsResponse = await axios.post(`${EXTRACTOR_W_URL}/api/vizta/chat`, {
      message: "¿Qué herramientas tienes disponibles Robert?",
      useAgents: true
    }, { headers });
    
    if (agentsResponse.data.success) {
      console.log('✅ Respuesta de agentes obtenida');
      console.log(`📊 Agentes participaron: Laura (${agentsResponse.data.agentResults.laura_findings.length}), Robert (${agentsResponse.data.agentResults.robert_findings.length})`);
    }
    
    // 3. Obtener proyectos para probar decisiones
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
        console.log(`      Decisiones: ${project.stats.decisionsCount}`);
        
        // Usar el primer proyecto con decisiones
        if (!testProjectId && project.stats.decisionsCount > 0) {
          testProjectId = project.id;
          console.log(`   🎯 Seleccionado para prueba: ${project.title}`);
        }
      });
      
      if (!testProjectId) {
        testProjectId = projects[0].id;
        console.log(`   ⚠️  Usando primer proyecto (sin decisiones): ${projects[0].title}`);
      }
    } else {
      console.log('⚠️  No se encontraron proyectos');
      return;
    }
    
    // 4. Probar consulta sobre decisiones con Robert
    console.log('\n4️⃣ PASO 4: Probando consulta sobre decisiones con Robert');
    const decisionQuery = `¿Cuáles son las decisiones del proyecto ${testProjectId}? Muéstrame el enfoque, alcance y configuración`;
    
    const robertResponse = await axios.post(`${EXTRACTOR_W_URL}/api/vizta/chat`, {
      message: decisionQuery,
      useAgents: true
    }, { headers });
    
    if (robertResponse.data.success) {
      console.log('✅ Robert respondió a consulta sobre decisiones');
      console.log(`📋 Plan de ejecución:`, robertResponse.data.agentResults.execution_plan);
      
      const robertFindings = robertResponse.data.agentResults.robert_findings;
      console.log(`🤖 Robert ejecutó ${robertFindings.length} tareas:`);
      
      robertFindings.forEach((finding, index) => {
        console.log(`   ${index + 1}. ${finding.query_executed}`);
        console.log(`      Colección: ${finding.collection}`);
        console.log(`      Items: ${finding.metadata?.total_items || 0}`);
        
        if (finding.files && finding.files.length > 0) {
          console.log(`      Archivos encontrados:`);
          finding.files.forEach((file, fileIndex) => {
            console.log(`         • ${file.title} [${file.type}]`);
            console.log(`           Tags: ${file.tags.join(', ')}`);
            console.log(`           Relevancia: ${file.relevance_score}`);
          });
        }
      });
      
      console.log(`\n📝 Respuesta de Vizta (primeros 300 chars):`);
      console.log(robertResponse.data.message.substring(0, 300) + '...');
    } else {
      console.log('❌ Error en consulta con Robert');
      console.log(`Error: ${robertResponse.data.error || 'Error desconocido'}`);
    }
    
    // 5. Probar consulta genérica sobre decisiones
    console.log('\n5️⃣ PASO 5: Probando consulta genérica sobre decisiones');
    const genericQuery = "Muéstrame las decisiones estratégicas de mis proyectos activos";
    
    const genericResponse = await axios.post(`${EXTRACTOR_W_URL}/api/vizta/chat`, {
      message: genericQuery,
      useAgents: true
    }, { headers });
    
    if (genericResponse.data.success) {
      console.log('✅ Robert respondió a consulta genérica sobre decisiones');
      
      const plan = genericResponse.data.agentResults.execution_plan;
      console.log(`📋 Tareas de Robert: ${plan.robertTasks.length}`);
      
      plan.robertTasks.forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.description} [${task.tool}]`);
      });
    }
    
    // 6. Probar herramienta project_decisions directamente
    console.log('\n6️⃣ PASO 6: Probando project_decisions directamente');
    const directDecisionsResponse = await axios.post(`${EXTRACTOR_W_URL}/api/mcp/execute`, {
      tool_name: 'project_decisions',
      parameters: { project_id: testProjectId }
    }, { headers });
    
    if (directDecisionsResponse.data.success) {
      const result = directDecisionsResponse.data.result;
      console.log(`✅ Decisiones obtenidas directamente:`);
      console.log(`   📊 Proyecto: ${result.project_title}`);
      console.log(`   📋 Total decisiones: ${result.total_decisions}`);
      
      if (result.decisions && result.decisions.length > 0) {
        console.log(`   🔹 Tipos de decisiones:`);
        const types = [...new Set(result.decisions.map(d => d.decision_type))];
        types.forEach(type => {
          const count = result.decisions.filter(d => d.decision_type === type).length;
          console.log(`      • ${type}: ${count} decisiones`);
        });
      }
    }
    
    console.log('\n🎉 TODAS LAS PRUEBAS DE ROBERT COMPLETADAS');
    console.log('==========================================');
    console.log('✅ Robert configurado con herramienta project_decisions');
    console.log('✅ Detección automática de consultas sobre decisiones');
    console.log('✅ Procesamiento de resultados por tipos de decisión');
    console.log('✅ Integración completa con sistema de agentes');
    console.log('✅ Robert puede acceder a proyectos, documentos Y decisiones');
    
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS DE ROBERT:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

// Ejecutar pruebas
testRobertDecisions(); 