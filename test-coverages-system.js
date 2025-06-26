const supabase = require('./server/utils/supabase');
const { normalizeGeographicInfo, getDepartmentForCity } = require('./server/utils/guatemala-geography');

// Colores para logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

// Configuración de pruebas
const TEST_PROJECT_ID = 'b36e711c-6206-4258-83b6-6a566f7b2766'; // Proyecto existente
const TEST_USER_ID = '85c93b4b-455e-450b-9d01-e18f9e8dfaaa'; // Usuario propietario

// Datos de prueba
const testFindings = [
  // Caso 1: Múltiples hallazgos en la misma ciudad (deben agruparse)
  {
    id: 'finding-1',
    summary: 'Problema de transparencia en municipalidad',
    description: 'Falta de información pública en procesos de contratación',
    theme: 'Transparencia',
    city: 'Guatemala',
    department: null, // Will be auto-detected
    pais: 'Guatemala'
  },
  {
    id: 'finding-2', 
    summary: 'Irregularidades presupuestarias',
    description: 'Gastos no justificados en área administrativa',
    theme: 'Finanzas Públicas',
    city: 'Guatemala',
    department: null, // Will be auto-detected
    pais: 'Guatemala'
  },
  
  // Caso 2: Hallazgos en diferentes ciudades del mismo departamento
  {
    id: 'finding-3',
    summary: 'Deficiencias en servicios de salud',
    description: 'Falta de medicamentos en centro de salud',
    theme: 'Salud',
    city: 'Mixco',
    department: null, // Will be auto-detected
    pais: 'Guatemala'
  },
  {
    id: 'finding-4',
    summary: 'Problemas de infraestructura',
    description: 'Calles en mal estado y falta de alumbrado',
    theme: 'Infraestructura',
    city: 'Villa Nueva',
    department: null, // Will be auto-detected  
    pais: 'Guatemala'
  },
  
  // Caso 3: Hallazgos en departamentos diferentes
  {
    id: 'finding-5',
    summary: 'Corrupción en obras públicas',
    description: 'Sobreprecio en construcción de escuela',
    theme: 'Transparencia',
    city: 'Quetzaltenango',
    department: null, // Will be auto-detected
    pais: 'Guatemala'
  },
  {
    id: 'finding-6',
    summary: 'Negligencia en gestión ambiental',
    description: 'Contaminación de río por desechos industriales',
    theme: 'Medio Ambiente',
    city: 'Cobán',
    department: null, // Will be auto-detected
    pais: 'Guatemala'
  },
  
  // Caso 4: Hallazgo con ciudad que necesita normalización
  {
    id: 'finding-7',
    summary: 'Problemas educativos',
    description: 'Falta de maestros en escuela primaria',
    theme: 'Educación',
    city: 'Antigua', // Should be normalized to "Antigua Guatemala"
    department: null,
    pais: 'Guatemala'
  }
];

async function createTestProject() {
  log('\n📝 Creando proyecto de prueba...', 'blue');
  
  try {
    const projectData = {
      id: TEST_PROJECT_ID,
      name: 'Test Project - Coberturas',
      description: 'Proyecto temporal para pruebas del sistema de coberturas',
      user_id: TEST_USER_ID,
      visibility: 'private',
      status: 'active',
      category: 'test'
    };
    
    const { data, error } = await supabase
      .from('projects')
      .upsert(projectData, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) throw error;
    
    log('✅ Proyecto de prueba creado exitosamente', 'green');
    return true;
  } catch (error) {
    log(`❌ Error creando proyecto: ${error.message}`, 'red');
    return false;
  }
}

async function cleanup() {
  log('\n🧹 Limpiando datos de prueba...', 'yellow');
  
  try {
    // Eliminar coberturas de prueba
    const { error: coveragesError } = await supabase
      .from('project_coverages')
      .delete()
      .eq('project_id', TEST_PROJECT_ID);
    
    if (coveragesError) throw coveragesError;
    
    // No eliminamos proyecto existente
    
    log('✅ Datos de prueba eliminados correctamente', 'green');
  } catch (error) {
    log(`❌ Error al limpiar datos: ${error.message}`, 'red');
  }
}

async function testDatabaseConnection() {
  log('\n📡 Probando conexión a la base de datos...', 'blue');
  
  try {
    const { data, error } = await supabase
      .from('project_coverages')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    log('✅ Conexión a base de datos exitosa', 'green');
    return true;
  } catch (error) {
    log(`❌ Error de conexión: ${error.message}`, 'red');
    return false;
  }
}

async function testGeographicNormalization() {
  log('\n🗺️ Probando normalización geográfica...', 'blue');
  
  const testCases = [
    { input: { city: 'Guatemala' }, expected: { department: 'Guatemala' } },
    { input: { city: 'Mixco' }, expected: { department: 'Guatemala' } },
    { input: { city: 'Antigua' }, expected: { department: 'Sacatepéquez' } },
    { input: { city: 'Cobán' }, expected: { department: 'Alta Verapaz' } },
    { input: { city: 'Quetzaltenango' }, expected: { department: 'Quetzaltenango' } }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  for (const testCase of testCases) {
    const result = normalizeGeographicInfo(testCase.input);
    const expectedDept = testCase.expected.department;
    
    if (result.department === expectedDept) {
      log(`  ✅ ${testCase.input.city} → ${result.department}`, 'green');
      passed++;
    } else {
      log(`  ❌ ${testCase.input.city} → Expected: ${expectedDept}, Got: ${result.department}`, 'red');
    }
  }
  
  log(`\n📊 Normalización geográfica: ${passed}/${total} casos exitosos`, passed === total ? 'green' : 'yellow');
  return passed === total;
}

async function simulateAutoDetectCoverages() {
  log('\n🤖 Simulando auto-detect de coberturas...', 'blue');
  
  // Normalizar datos geográficos de los hallazgos
  const normalizedFindings = testFindings.map(finding => {
    const geoInfo = normalizeGeographicInfo({
      city: finding.city,
      department: finding.department,
      pais: finding.pais
    });
    
    return {
      ...finding,
      ...geoInfo
    };
  });
  
  log('📋 Hallazgos normalizados:', 'cyan');
  normalizedFindings.forEach(finding => {
    log(`  • ${finding.city} (${finding.department}) - ${finding.theme}`, 'cyan');
  });
  
  // Simular el algoritmo de agrupación por ubicación
  const locationGroups = new Map();
  
  normalizedFindings.forEach(finding => {
    // Crear clave por país, departamento y ciudad
    const countryKey = finding.pais || 'Unknown';
    const deptKey = finding.department || 'Unknown';
    const cityKey = finding.city || 'Unknown';
    
    // Agrupar por país
    if (!locationGroups.has(countryKey)) {
      locationGroups.set(countryKey, {
        type: 'country',
        name: countryKey,
        findings: [],
        themes: new Set()
      });
    }
    
    // Agrupar por departamento
    const deptFullKey = `${countryKey}|${deptKey}`;
    if (!locationGroups.has(deptFullKey)) {
      locationGroups.set(deptFullKey, {
        type: 'department',
        name: deptKey,
        parent_name: countryKey,
        findings: [],
        themes: new Set()
      });
    }
    
    // Agrupar por ciudad
    const cityFullKey = `${countryKey}|${deptKey}|${cityKey}`;
    if (!locationGroups.has(cityFullKey)) {
      locationGroups.set(cityFullKey, {
        type: 'city',
        name: cityKey,
        parent_name: deptKey,
        findings: [],
        themes: new Set()
      });
    }
    
    // Agregar hallazgo a todos los niveles correspondientes
    locationGroups.get(countryKey).findings.push(finding);
    locationGroups.get(countryKey).themes.add(finding.theme);
    
    locationGroups.get(deptFullKey).findings.push(finding);
    locationGroups.get(deptFullKey).themes.add(finding.theme);
    
    locationGroups.get(cityFullKey).findings.push(finding);
    locationGroups.get(cityFullKey).themes.add(finding.theme);
  });
  
  log('\n📍 Grupos de ubicación creados:', 'magenta');
  for (const [key, group] of locationGroups) {
    const themesArray = Array.from(group.themes);
    log(`  • ${group.type}: ${group.name} (${group.findings.length} hallazgos, temas: ${themesArray.join(', ')})`, 'magenta');
  }
  
  return Array.from(locationGroups.values());
}

async function testCoverageCreation(locationGroups) {
  log('\n💾 Probando creación de coberturas en base de datos...', 'blue');
  
  let created = 0;
  let errors = 0;
  
  for (const group of locationGroups) {
    try {
      const themesArray = Array.from(group.themes);
      const description = `Cobertura ${group.type === 'country' ? 'nacional' : group.type === 'department' ? 'departamental' : 'municipal'} con ${group.findings.length} hallazgo${group.findings.length > 1 ? 's' : ''} en los siguientes temas: ${themesArray.join(', ')}.`;
      
      // Mapear tipos del sistema a tipos de la BD
      const typeMapping = {
        'country': 'pais',
        'department': 'departamento', 
        'city': 'ciudad'
      };
      
      const coverageData = {
        project_id: TEST_PROJECT_ID,
        coverage_type: typeMapping[group.type] || group.type,
        name: group.name,
        parent_name: group.parent_name || null,
        description,
        detection_source: 'ai_detection',
        confidence_score: 0.95,
        discovery_context: `Generado automáticamente durante pruebas con ${group.findings.length} hallazgos`,
        tags: themesArray,
        capturados_count: group.findings.length
      };
      
      const { data, error } = await supabase
        .from('project_coverages')
        .upsert(coverageData, {
          onConflict: 'project_id,coverage_type,name,parent_name',
          ignoreDuplicates: false
        })
        .select();
      
      if (error) throw error;
      
      log(`  ✅ Creada: ${group.type} "${group.name}" (${group.findings.length} hallazgos)`, 'green');
      created++;
      
    } catch (error) {
      log(`  ❌ Error creando ${group.type} "${group.name}": ${error.message}`, 'red');
      errors++;
    }
  }
  
  log(`\n📊 Creación de coberturas: ${created} exitosas, ${errors} errores`, errors === 0 ? 'green' : 'yellow');
  return { created, errors };
}

async function testDuplicatePrevention() {
  log('\n🔒 Probando prevención de duplicados...', 'blue');
  
  // Intentar crear la misma cobertura dos veces
  const testCoverage = {
    project_id: TEST_PROJECT_ID,
    coverage_type: 'ciudad',
    name: 'Test City Duplicate',
    parent_name: 'Test Department',
    description: 'Cobertura de prueba para duplicados',
    detection_source: 'ai_detection',
    confidence_score: 0.95,
    discovery_context: 'Prueba de duplicados',
    capturados_count: 1
  };
  
  try {
    // Primera inserción
    const { data: first, error: firstError } = await supabase
      .from('project_coverages')
      .insert(testCoverage)
      .select();
    
    if (firstError) throw firstError;
    log('  ✅ Primera inserción exitosa', 'green');
    
    // Segunda inserción (debe usar UPSERT)
    const updatedCoverage = {
      ...testCoverage,
      description: 'Cobertura actualizada - no duplicada',
      capturados_count: 2
    };
    
    const { data: second, error: secondError } = await supabase
      .from('project_coverages')
      .upsert(updatedCoverage, {
        onConflict: 'project_id,coverage_type,name,parent_name',
        ignoreDuplicates: false
      })
      .select();
    
    if (secondError) throw secondError;
    
    // Verificar que solo existe una cobertura
    const { data: check, error: checkError } = await supabase
      .from('project_coverages')
      .select('*')
      .eq('project_id', TEST_PROJECT_ID)
      .eq('name', 'Test City Duplicate');
    
    if (checkError) throw checkError;
    
    if (check.length === 1 && check[0].capturados_count === 2) {
      log('  ✅ UPSERT funcionó correctamente - no hay duplicados', 'green');
      log(`  ✅ Cobertura actualizada: ${check[0].capturados_count} hallazgos`, 'green');
      return true;
    } else {
      log(`  ❌ Se encontraron ${check.length} coberturas, esperaba 1`, 'red');
      if (check.length > 0) {
        log(`     Capturados count: ${check[0].capturados_count}`, 'red');
      }
      return false;
    }
    
  } catch (error) {
    log(`  ❌ Error en prueba de duplicados: ${error.message}`, 'red');
    return false;
  }
}

async function testExistingCoveragesRetrieval() {
  log('\n📖 Probando recuperación de coberturas existentes...', 'blue');
  
  try {
    const { data, error } = await supabase
      .from('project_coverages')
      .select('*')
      .eq('project_id', TEST_PROJECT_ID)
      .order('coverage_type', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    log(`  ✅ Recuperadas ${data.length} coberturas`, 'green');
    
    // Agrupar por tipo
    const byType = data.reduce((acc, coverage) => {
      if (!acc[coverage.coverage_type]) acc[coverage.coverage_type] = [];
      acc[coverage.coverage_type].push(coverage);
      return acc;
    }, {});
    
    for (const [type, coverages] of Object.entries(byType)) {
      log(`    • ${type}: ${coverages.length} coberturas`, 'cyan');
      coverages.forEach(c => {
        const findingsCount = c.capturados_count || 0;
        const themes = c.tags?.join(', ') || 'N/A';
        log(`      - ${c.name} (${findingsCount} hallazgos, temas: ${themes})`, 'cyan');
      });
    }
    
    return data;
    
  } catch (error) {
    log(`  ❌ Error recuperando coberturas: ${error.message}`, 'red');
    return [];
  }
}

async function testGeographicHierarchy() {
  log('\n🏗️ Probando jerarquía geográfica...', 'blue');
  
  try {
    const { data, error } = await supabase
      .from('project_coverages')
      .select('*')
      .eq('project_id', TEST_PROJECT_ID);
    
    if (error) throw error;
    
    // Verificar jerarquía: país → departamento → ciudad
    const countries = data.filter(c => c.coverage_type === 'pais');
    const departments = data.filter(c => c.coverage_type === 'departamento');
    const cities = data.filter(c => c.coverage_type === 'ciudad');
    
    log(`  📊 Estructura jerárquica:`, 'cyan');
    log(`    • Países: ${countries.length}`, 'cyan');
    log(`    • Departamentos: ${departments.length}`, 'cyan');
    log(`    • Ciudades: ${cities.length}`, 'cyan');
    
    // Verificar que las relaciones padre-hijo sean correctas
    let hierarchyErrors = 0;
    
    for (const dept of departments) {
      const parentCountry = countries.find(c => c.name === dept.parent_name);
      if (!parentCountry) {
        log(`    ❌ Departamento "${dept.name}" no tiene país padre válido: "${dept.parent_name}"`, 'red');
        hierarchyErrors++;
      }
    }
    
    for (const city of cities) {
      const parentDept = departments.find(d => d.name === city.parent_name);
      if (!parentDept) {
        log(`    ❌ Ciudad "${city.name}" no tiene departamento padre válido: "${city.parent_name}"`, 'red');
        hierarchyErrors++;
      }
    }
    
    if (hierarchyErrors === 0) {
      log('  ✅ Jerarquía geográfica correcta', 'green');
      return true;
    } else {
      log(`  ❌ ${hierarchyErrors} errores en jerarquía geográfica`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`  ❌ Error verificando jerarquía: ${error.message}`, 'red');
    return false;
  }
}

async function runTestSuite() {
  log('🧪 INICIANDO PRUEBAS DEL SISTEMA DE COBERTURAS', 'magenta');
  log('================================================', 'magenta');
  
  const results = {
    dbConnection: false,
    geoNormalization: false,
    coverageCreation: { created: 0, errors: 0 },
    duplicatePrevention: false,
    hierarchyValidation: false,
    totalCoverages: 0
  };
  
  try {
    // 1. Conectividad
    results.dbConnection = await testDatabaseConnection();
    if (!results.dbConnection) {
      log('\n❌ Pruebas abortadas: sin conexión a base de datos', 'red');
      return results;
    }
    
    // 1.5. Se omite creación de proyecto; se usa proyecto existente
    
    // 2. Normalización geográfica
    results.geoNormalization = await testGeographicNormalization();
    
    // 3. Simulación de auto-detect
    const locationGroups = await simulateAutoDetectCoverages();
    
    // 4. Creación de coberturas
    results.coverageCreation = await testCoverageCreation(locationGroups);
    
    // 5. Prevención de duplicados
    results.duplicatePrevention = await testDuplicatePrevention();
    
    // 6. Recuperación de coberturas
    const existingCoverages = await testExistingCoveragesRetrieval();
    results.totalCoverages = existingCoverages.length;
    
    // 7. Validación de jerarquía
    results.hierarchyValidation = await testGeographicHierarchy();
    
  } catch (error) {
    log(`\n❌ Error general en las pruebas: ${error.message}`, 'red');
  }
  
  // Resumen final
  log('\n📋 RESUMEN DE RESULTADOS', 'magenta');
  log('========================', 'magenta');
  
  log(`• Conexión BD: ${results.dbConnection ? '✅' : '❌'}`, results.dbConnection ? 'green' : 'red');
  log(`• Normalización Geo: ${results.geoNormalization ? '✅' : '❌'}`, results.geoNormalization ? 'green' : 'red');
  log(`• Creación Coberturas: ${results.coverageCreation.created} creadas, ${results.coverageCreation.errors} errores`, 
      results.coverageCreation.errors === 0 ? 'green' : 'yellow');
  log(`• Prevención Duplicados: ${results.duplicatePrevention ? '✅' : '❌'}`, results.duplicatePrevention ? 'green' : 'red');
  log(`• Jerarquía Geográfica: ${results.hierarchyValidation ? '✅' : '❌'}`, results.hierarchyValidation ? 'green' : 'red');
  log(`• Total Coberturas: ${results.totalCoverages}`, 'blue');
  
  const allTestsPassed = results.dbConnection && 
                        results.geoNormalization && 
                        results.coverageCreation.errors === 0 && 
                        results.duplicatePrevention && 
                        results.hierarchyValidation;
  
  log(`\n🎯 RESULTADO GENERAL: ${allTestsPassed ? 'TODAS LAS PRUEBAS EXITOSAS ✅' : 'ALGUNAS PRUEBAS FALLARON ❌'}`, 
      allTestsPassed ? 'green' : 'red');
  
  // Limpiar datos de prueba
  await cleanup();
  
  return results;
}

// Ejecutar las pruebas si se llama directamente
if (require.main === module) {
  runTestSuite()
    .then(() => {
      log('\n✨ Pruebas completadas', 'cyan');
      process.exit(0);
    })
    .catch(error => {
      log(`\n💥 Error fatal: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = {
  runTestSuite,
  testDatabaseConnection,
  testGeographicNormalization,
  simulateAutoDetectCoverages,
  testCoverageCreation,
  testDuplicatePrevention,
  cleanup
}; 