#!/usr/bin/env node

/**
 * Script de verificación del servicio de transcripción en ExtractorW
 * Ejecutar: node check-transcription-service.js
 */

const fs = require('fs');
const path = require('path');

console.log('🎤 VERIFICACIÓN DEL SERVICIO DE TRANSCRIPCIÓN - ExtractorW');
console.log('='.repeat(65));

// Verificar archivos principales
const checkFiles = () => {
  console.log('\n📁 Verificando archivos del sistema...');
  
  const requiredFiles = [
    'server/routes/transcription.js',
    'server/services/transcription.js',
    'server/middlewares/credits.js',
    'server/middlewares/auth.js',
    'server/utils/supabase.js'
  ];

  let allFilesExist = true;

  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - FALTANTE`);
      allFilesExist = false;
    }
  });

  if (!allFilesExist) {
    console.log('\n🚨 PROBLEMA: Algunos archivos del sistema de transcripción faltan');
    return false;
  }

  return true;
};

// Verificar variables de entorno
const checkEnvironment = () => {
  console.log('\n🔧 Verificando variables de entorno...');
  
  const requiredEnvVars = [
    'GEMINI_API_KEY',
    'SUPABASE_URL', 
    'SUPABASE_KEY'
  ];

  let allVarsPresent = true;

  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar} - Configurada`);
    } else {
      console.log(`❌ ${envVar} - FALTANTE`);
      allVarsPresent = false;
    }
  });

  if (!allVarsPresent) {
    console.log('\n🚨 PROBLEMA: Variables de entorno faltantes');
    console.log('💡 Asegúrate de tener un archivo .env con:');
    console.log('   GEMINI_API_KEY=tu_gemini_api_key');
    console.log('   SUPABASE_URL=tu_supabase_url');
    console.log('   SUPABASE_KEY=tu_supabase_anon_key');
    return false;
  }

  return true;
};

// Verificar dependencias
const checkDependencies = () => {
  console.log('\n📦 Verificando dependencias...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredPackages = [
      '@google/generative-ai',
      'fluent-ffmpeg',
      'multer'
    ];

    let allPackagesInstalled = true;

    requiredPackages.forEach(pkg => {
      if (dependencies[pkg]) {
        console.log(`✅ ${pkg} - v${dependencies[pkg]}`);
      } else {
        console.log(`❌ ${pkg} - NO INSTALADO`);
        allPackagesInstalled = false;
      }
    });

    if (!allPackagesInstalled) {
      console.log('\n🚨 PROBLEMA: Dependencias faltantes');
      console.log('💡 Ejecuta: npm install @google/generative-ai fluent-ffmpeg multer');
      return false;
    }

    return true;
  } catch (error) {
    console.log('❌ Error leyendo package.json:', error.message);
    return false;
  }
};

// Verificar FFmpeg
const checkFFmpeg = () => {
  console.log('\n🎬 Verificando FFmpeg...');
  
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('ffmpeg -version', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ FFmpeg no encontrado');
        console.log('💡 Instala FFmpeg:');
        console.log('   Ubuntu/Debian: sudo apt install ffmpeg');
        console.log('   macOS: brew install ffmpeg');
        console.log('   Windows: Descargar desde https://ffmpeg.org/download.html');
        resolve(false);
      } else {
        const version = stdout.split('\n')[0];
        console.log(`✅ FFmpeg instalado: ${version}`);
        resolve(true);
      }
    });
  });
};

// Verificar rutas registradas
const checkRoutes = () => {
  console.log('\n🛤️ Verificando configuración de rutas...');
  
  try {
    // Verificar que las rutas estén registradas en index.js
    const indexFile = fs.readFileSync('server/routes/index.js', 'utf8');
    
    if (indexFile.includes('transcription')) {
      console.log('✅ Rutas de transcripción registradas');
      return true;
    } else {
      console.log('❌ Rutas de transcripción NO registradas');
      console.log('💡 Verifica que server/routes/index.js incluya las rutas de transcripción');
      return false;
    }
  } catch (error) {
    console.log('❌ Error verificando rutas:', error.message);
    return false;
  }
};

// Función principal
const runChecks = async () => {
  console.log('\n🚀 Iniciando verificación...\n');

  const results = {
    files: checkFiles(),
    environment: checkEnvironment(),
    dependencies: checkDependencies(),
    routes: checkRoutes(),
    ffmpeg: await checkFFmpeg()
  };

  console.log('\n📊 RESUMEN DE VERIFICACIÓN:');
  console.log('─'.repeat(40));
  
  Object.entries(results).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check.toUpperCase()}: ${passed ? 'OK' : 'FALLO'}`);
  });

  const allPassed = Object.values(results).every(result => result === true);

  if (allPassed) {
    console.log('\n🎉 ¡Todo está configurado correctamente!');
    console.log('💡 Si aún tienes problemas, verifica que el servidor esté corriendo:');
    console.log('   npm run dev  O  node server/index.js');
  } else {
    console.log('\n🚨 Se encontraron problemas que deben corregirse');
    console.log('💡 Sigue las recomendaciones arriba para resolver los issues');
  }

  console.log('\n✨ Verificación completada\n');
};

// Ejecutar verificación
runChecks().catch(error => {
  console.error('\n❌ Error durante la verificación:', error);
  process.exit(1);
}); 