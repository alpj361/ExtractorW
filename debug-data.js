/**
 * Script para analizar y depurar datos JSON
 * 
 * Uso:
 * 1. Guarda los datos JSON que causan problemas en un archivo json
 * 2. Ejecuta: node debug-data.js ruta/al/archivo.json
 */

const fs = require('fs');
const path = require('path');

// Cargar dotenv para tener acceso a variables de entorno
require('dotenv').config();

// Función para analizar la estructura de datos JSON
function analyzeStructure(data, path = 'root') {
  if (data === null) {
    return { type: 'null', path };
  }
  
  if (Array.isArray(data)) {
    console.log(`📚 ${path} es un array con ${data.length} elementos`);
    if (data.length > 0) {
      console.log(`   Primer elemento (${typeof data[0]}):`);
      console.log('   ' + JSON.stringify(data[0]).substring(0, 120) + (JSON.stringify(data[0]).length > 120 ? '...' : ''));
      
      if (data.length > 1) {
        // Verificar si todos los elementos tienen la misma estructura
        const sampleKeys = Object.keys(data[0] || {}).sort().join(',');
        let allSameStructure = true;
        
        for (let i = 1; i < Math.min(data.length, 10); i++) {
          const currentKeys = Object.keys(data[i] || {}).sort().join(',');
          if (currentKeys !== sampleKeys) {
            allSameStructure = false;
            console.log(`   ⚠️ El elemento ${i} tiene estructura diferente:`);
            console.log('   ' + JSON.stringify(data[i]).substring(0, 120) + (JSON.stringify(data[i]).length > 120 ? '...' : ''));
            break;
          }
        }
        
        if (allSameStructure) {
          console.log('   ✅ Todos los elementos tienen la misma estructura');
        }
      }
      
      // Verificar propiedades comunes que necesitamos
      const keyNames = ['name', 'keyword', 'text', 'value'];
      const volumeNames = ['volume', 'count', 'value'];
      
      if (typeof data[0] === 'object' && data[0] !== null) {
        const hasNameKey = keyNames.some(key => data[0][key]);
        const hasVolumeKey = volumeNames.some(key => data[0][key]);
        
        if (hasNameKey) {
          console.log('   ✅ El primer elemento tiene una propiedad de nombre válida');
        } else {
          console.log('   ⚠️ El primer elemento NO tiene una propiedad de nombre reconocible');
        }
        
        if (hasVolumeKey) {
          console.log('   ✅ El primer elemento tiene una propiedad de volumen válida');
        } else {
          console.log('   ⚠️ El primer elemento NO tiene una propiedad de volumen reconocible');
        }
      }
    }
    
    return { type: 'array', length: data.length, path };
  }
  
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    console.log(`🔑 ${path} es un objeto con ${keys.length} propiedades: ${keys.join(', ')}`);
    
    // Buscar propiedades específicas que nos interesan
    const arrayProps = ['trends', 'data', 'items', 'results', 'keywords', 'topics', 'wordCloudData', 'topKeywords', 'categoryData'];
    
    for (const prop of arrayProps) {
      if (data[prop]) {
        if (Array.isArray(data[prop])) {
          console.log(`   📚 Encontrado array en .${prop} con ${data[prop].length} elementos`);
          analyzeStructure(data[prop], `${path}.${prop}`);
        } else if (typeof data[prop] === 'object') {
          console.log(`   📦 Encontrado objeto en .${prop}`);
          analyzeStructure(data[prop], `${path}.${prop}`);
        }
      }
    }
    
    return { type: 'object', keys, path };
  }
  
  return { type: typeof data, value: data, path };
}

// Detectar la estructura de un archivo JSON
function detectJsonStructure(jsonString) {
  try {
    // Intenta analizarlo como JSON
    const parsedData = JSON.parse(jsonString);
    console.log('\n✅ JSON válido detectado');
    
    return analyzeStructure(parsedData);
  } catch (error) {
    console.error('\n❌ Error al analizar JSON:', error.message);
    
    // Intentar recuperar parte del JSON
    let validPart = '';
    try {
      // Intenta encontrar un objeto o array válido
      const objMatch = jsonString.match(/\{.*\}/s);
      const arrMatch = jsonString.match(/\[.*\]/s);
      
      if (objMatch) {
        validPart = objMatch[0];
        console.log('🔄 Intentando analizar un objeto JSON encontrado en el contenido');
      } else if (arrMatch) {
        validPart = arrMatch[0];
        console.log('🔄 Intentando analizar un array JSON encontrado en el contenido');
      }
      
      if (validPart) {
        const recovered = JSON.parse(validPart);
        console.log('✅ Recuperación parcial exitosa');
        return analyzeStructure(recovered, 'recovered');
      }
    } catch (e) {
      console.error('❌ No se pudo recuperar un JSON válido');
    }
    
    return { type: 'invalid', error: error.message };
  }
}

// Función principal
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n⚠️ Uso: node debug-data.js [ruta/al/archivo.json]');
    console.log('\nEste script analiza la estructura de un archivo JSON para ayudar a depurar problemas de procesamiento.');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  try {
    console.log(`\n📂 Analizando archivo: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log(`📊 Tamaño del archivo: ${(fileContent.length / 1024).toFixed(2)} KB`);
    
    // Analizar la estructura
    detectJsonStructure(fileContent);
    
    console.log('\n🧪 Simulando procesamiento con el parser de tendencias...');
    // Importar funciones del servidor
    const { processLocalTrends } = require('./server');
    
    if (typeof processLocalTrends === 'function') {
      try {
        const jsonData = JSON.parse(fileContent);
        const processed = processLocalTrends(jsonData);
        
        console.log('\n✅ Procesamiento exitoso:');
        if (processed.topKeywords && processed.topKeywords.length > 0) {
          console.log('📊 Top Keywords:');
          processed.topKeywords.forEach((kw, i) => {
            console.log(`   ${i+1}. ${kw.keyword} (${kw.count})`);
          });
        }
      } catch (e) {
        console.error('\n❌ Error al procesar los datos:', e);
      }
    } else {
      console.log('\n⚠️ La función processLocalTrends no está disponible para pruebas');
    }
    
  } catch (error) {
    console.error(`\n❌ Error al leer el archivo: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar
main(); 