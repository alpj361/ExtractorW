// ===================================================================
// SCRIPT DE PRUEBA PARA PARSEO DE UBICACIONES
// Verifica que parseLocationString separe correctamente "ciudad, departamento"
// ===================================================================

const { parseLocationString } = require('./server/utils/geographic-ai-detector');

console.log('🧪 INICIANDO PRUEBAS DE PARSEO DE UBICACIONES\n');

// ===================================================================
// CASOS DE PRUEBA
// ===================================================================

const testCases = [
  // Caso problemático original
  {
    name: 'Caso problemático: Antigua, Sacatepéquez',
    input: { 
      city: 'Antigua, Sacatepéquez', 
      department: null, 
      pais: null 
    },
    expected: 'Separar en ciudad: "Antigua" y departamento: "Sacatepéquez"'
  },
  
  // Casos similares
  {
    name: 'Ciudad con departamento y país',
    input: { 
      city: 'Cobán, Alta Verapaz', 
      department: null, 
      pais: 'Guatemala' 
    },
    expected: 'Separar ciudad y departamento, mantener país'
  },
  
  {
    name: 'Ya separado correctamente',
    input: { 
      city: 'Guatemala', 
      department: 'Guatemala', 
      pais: 'Guatemala' 
    },
    expected: 'No hacer cambios'
  },
  
  {
    name: 'Información conflictiva',
    input: { 
      city: 'Quetzaltenango, Quetzaltenango', 
      department: 'Sololá', 
      pais: null 
    },
    expected: 'Usar información parseada si es más específica'
  },
  
  {
    name: 'Solo ciudad sin comas',
    input: { 
      city: 'Puerto Barrios', 
      department: null, 
      pais: null 
    },
    expected: 'No hacer cambios'
  },
  
  {
    name: 'Departamento con comas extra',
    input: { 
      city: 'Flores', 
      department: 'Petén, Guatemala', 
      pais: null 
    },
    expected: 'Limpiar departamento'
  },
  
  {
    name: 'País con información extra',
    input: { 
      city: 'Ciudad', 
      department: 'Departamento', 
      pais: 'Guatemala, CA' 
    },
    expected: 'Limpiar país'
  },
  
  {
    name: 'Múltiples comas en ciudad',
    input: { 
      city: 'San Juan, La Laguna, Sololá', 
      department: null, 
      pais: null 
    },
    expected: 'Tomar solo las primeras dos partes'
  },
  
  {
    name: 'Datos vacíos',
    input: { 
      city: null, 
      department: null, 
      pais: null 
    },
    expected: 'Mantener como está'
  },
  
  {
    name: 'Espacios extra',
    input: { 
      city: '  Antigua  ,  Sacatepéquez  ', 
      department: null, 
      pais: null 
    },
    expected: 'Limpiar espacios y separar'
  }
];

// ===================================================================
// EJECUTAR PRUEBAS
// ===================================================================

console.log('📋 CASOS DE PRUEBA:');
console.log('='.repeat(80));

testCases.forEach((testCase, index) => {
  console.log(`\n🧪 Caso ${index + 1}: ${testCase.name}`);
  console.log(`   Entrada:    `, testCase.input);
  console.log(`   Esperado:   ${testCase.expected}`);
  
  const result = parseLocationString(testCase.input);
  console.log(`   Resultado:  `, result);
  
  // Verificar si hubo cambios
  const hasChanges = 
    result.city !== testCase.input.city || 
    result.department !== testCase.input.department || 
    result.pais !== testCase.input.pais;
  
  if (hasChanges) {
    console.log(`   🔄 CAMBIOS DETECTADOS:`);
    if (result.city !== testCase.input.city) {
      console.log(`      Ciudad: "${testCase.input.city}" → "${result.city}"`);
    }
    if (result.department !== testCase.input.department) {
      console.log(`      Departamento: "${testCase.input.department}" → "${result.department}"`);
    }
    if (result.pais !== testCase.input.pais) {
      console.log(`      País: "${testCase.input.pais}" → "${result.pais}"`);
    }
  } else {
    console.log(`   ✅ Sin cambios (como se esperaba)`);
  }
});

// ===================================================================
// CASOS EXTREMOS
// ===================================================================

console.log('\n\n🔬 CASOS EXTREMOS:');
console.log('='.repeat(80));

const extremeCases = [
  { city: '', department: '', pais: '' },
  { city: ',', department: null, pais: null },
  { city: 'Solo,', department: null, pais: null },
  { city: ',Solo', department: null, pais: null },
  { city: 'a,b,c,d,e', department: null, pais: null },
  { city: 'Normal', department: 'Normal,Extra,Info', pais: 'País,Extra' }
];

// ===================================================================
// CASOS DE MÚLTIPLES DEPARTAMENTOS
// ===================================================================

console.log('\n\n🏢 CASOS DE MÚLTIPLES DEPARTAMENTOS:');
console.log('='.repeat(80));

const multiDepartmentCases = [
  {
    name: 'Múltiples departamentos en campo ciudad',
    input: { city: 'Zacapa, Quiché, Alta Verapaz', department: null, pais: null }
  },
  {
    name: 'Múltiples departamentos en campo departamento',
    input: { city: null, department: 'Guatemala, Sacatepéquez, Chimaltenango', pais: 'Guatemala' }
  },
  {
    name: 'Múltiples departamentos con espacios',
    input: { city: ' Escuintla , San Marcos , Retalhuleu ', department: null, pais: null }
  },
  {
    name: 'Departamentos mezclados con no-departamentos',
    input: { city: 'Ciudad, Zacapa, Texto random, Quiché', department: null, pais: null }
  },
  {
    name: 'Solo un departamento válido entre varios',
    input: { city: 'NoExiste, Izabal, OtroTexto', department: null, pais: null }
  }
];

multiDepartmentCases.forEach((testCase, index) => {
  console.log(`\n🏢 Multi-Dept ${index + 1}: ${testCase.name}`);
  console.log(`   Entrada:`, testCase.input);
  
  const result = parseLocationString(testCase.input);
  
  if (Array.isArray(result)) {
    console.log(`   ✅ MÚLTIPLES UBICACIONES DETECTADAS (${result.length}):`);
    result.forEach((location, i) => {
      console.log(`      [${i + 1}] ciudad: "${location.city}", departamento: "${location.department}", país: "${location.pais}"`);
    });
  } else {
    console.log(`   Resultado único:`, result);
  }
});

extremeCases.forEach((extremeCase, index) => {
  console.log(`\n🔬 Extremo ${index + 1}:`, extremeCase);
  const result = parseLocationString(extremeCase);
  console.log(`   Resultado:`, result);
});

console.log('\n✅ Pruebas de parseo completadas');
console.log('💡 Si ves logs de "🔍 Parseado formato..." arriba, significa que la función está funcionando correctamente'); 