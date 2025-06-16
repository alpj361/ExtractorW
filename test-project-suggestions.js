const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';

const testProjectData = {
  project: {
    title: "Auditoría de Transparencia Municipal 2024",
    description: "Revisión integral de los procesos de transparencia y acceso a información pública en la municipalidad de Guatemala",
    status: "active",
    priority: "high",
    category: "Auditoría",
    tags: ["transparencia", "municipal", "información pública"],
    start_date: "2024-01-15",
    target_date: "2024-06-30",
    created_at: "2024-01-15T00:00:00.000Z",
    updated_at: "2024-01-20T00:00:00.000Z",
    decisions: [
      {
        title: "Definir alcance de auditoría",
        description: "Establecer los departamentos y procesos específicos a auditar",
        decision_type: "alcance",
        sequence_number: 1,
        created_at: "2024-01-16T00:00:00.000Z"
      },
      {
        title: "Seleccionar metodología de evaluación",
        description: "Determinar las herramientas y criterios para evaluar transparencia",
        decision_type: "configuracion",
        sequence_number: 2,
        created_at: "2024-01-18T00:00:00.000Z"
      }
    ]
  }
};

async function testProjectSuggestions() {
  console.log('🚀 Iniciando prueba del endpoint de sugerencias de proyectos...\n');

  try {
    console.log('📦 Datos del proyecto de prueba:');
    console.log(JSON.stringify(testProjectData, null, 2));
    console.log('\n🔄 Enviando petición al backend...\n');

    const response = await fetch(`${BACKEND_URL}/api/project-suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // En una implementación real, aquí iría el token de Supabase
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(testProjectData)
    });

    console.log(`📊 Status de respuesta: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('\n✅ Respuesta exitosa del servidor:');
    console.log('==========================================');
    
    if (result.analysis) {
      console.log('\n📊 ANÁLISIS DEL PROYECTO:');
      console.log(result.analysis);
    }

    if (result.suggestions && result.suggestions.length > 0) {
      console.log(`\n💡 SUGERENCIAS GENERADAS (${result.suggestions.length}):`);
      console.log('==========================================');
      
      result.suggestions.forEach((suggestion, index) => {
        console.log(`\n${index + 1}. ${suggestion.title}`);
        console.log(`   Categoría: ${suggestion.category} | Prioridad: ${suggestion.priority}`);
        console.log(`   Tiempo estimado: ${suggestion.estimatedTime}`);
        console.log(`   Descripción: ${suggestion.description}`);
        console.log(`   Acción: ${suggestion.action}`);
        console.log(`   Herramientas: ${suggestion.tools.join(', ')}`);
      });
    }

    if (result.generatedAt) {
      console.log(`\n⏰ Generado el: ${new Date(result.generatedAt).toLocaleString('es-GT')}`);
    }

    console.log('\n🎉 Prueba completada exitosamente!');

  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.message);
    console.error('\n🔍 Detalles del error:');
    console.error(error);
  }
}

// Función para probar diferentes escenarios
async function testMultipleScenarios() {
  console.log('🧪 Probando múltiples escenarios de proyectos...\n');

  const scenarios = [
    {
      name: "Proyecto básico sin decisiones",
      project: {
        title: "Revisión de contratos municipales",
        description: "Análisis de transparencia en procesos de contratación",
        status: "active",
        priority: "medium",
        category: "Contratos",
        tags: ["contratos", "transparencia"],
        decisions: []
      }
    },
    {
      name: "Proyecto avanzado con múltiples decisiones",
      project: {
        title: "Auditoría integral de finanzas municipales",
        description: "Evaluación completa del manejo financiero municipal",
        status: "active",
        priority: "high",
        category: "Finanzas",
        tags: ["finanzas", "presupuesto", "auditoría"],
        decisions: [
          {
            title: "Definir período fiscal a revisar",
            decision_type: "alcance",
            sequence_number: 1
          },
          {
            title: "Seleccionar áreas prioritarias",
            decision_type: "enfoque",
            sequence_number: 2
          },
          {
            title: "Configurar herramientas de análisis",
            decision_type: "configuracion",
            sequence_number: 3
          }
        ]
      }
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n📋 Probando: ${scenario.name}`);
    console.log('----------------------------------------');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/project-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy-token-for-testing'
        },
        body: JSON.stringify({ project: scenario.project })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${scenario.name}: ${result.suggestions?.length || 0} sugerencias generadas`);
        
        if (result.suggestions && result.suggestions.length > 0) {
          console.log('   Primeras sugerencias:');
          result.suggestions.slice(0, 2).forEach((s, i) => {
            console.log(`   ${i + 1}. ${s.title} (${s.category}, ${s.priority})`);
          });
        }
      } else {
        console.log(`❌ ${scenario.name}: Error ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${scenario.name}: ${error.message}`);
    }
  }
}

// Ejecutar las pruebas
async function runAllTests() {
  console.log('🔬 INICIANDO SUITE DE PRUEBAS DE SUGERENCIAS DE PROYECTOS');
  console.log('================================================================\n');

  await testProjectSuggestions();
  
  console.log('\n\n');
  
  await testMultipleScenarios();
  
  console.log('\n\n🏁 Suite de pruebas completada.');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testProjectSuggestions,
  testMultipleScenarios,
  runAllTests
}; 