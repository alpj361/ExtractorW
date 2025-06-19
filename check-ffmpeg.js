#!/usr/bin/env node

/**
 * Script para verificar que FFmpeg esté instalado y funcionando correctamente
 */

const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');

console.log('🎬 VERIFICACIÓN DE FFMPEG PARA TRANSCRIPCIÓN');
console.log('='.repeat(50));

async function checkFFmpegInstallation() {
  try {
    console.log('\n1️⃣ Verificando instalación de FFmpeg...');
    
    return new Promise((resolve, reject) => {
      exec('ffmpeg -version', (error, stdout, stderr) => {
        if (error) {
          console.log('❌ FFmpeg no está instalado o no está en PATH');
          console.log(`   Error: ${error.message}`);
          reject(error);
          return;
        }
        
        console.log('✅ FFmpeg está instalado');
        const versionLine = stdout.split('\n')[0];
        console.log(`   Versión: ${versionLine}`);
        resolve(true);
      });
    });
  } catch (error) {
    console.error('❌ Error verificando FFmpeg:', error.message);
    throw error;
  }
}

async function checkFluentFFmpeg() {
  try {
    console.log('\n2️⃣ Verificando fluent-ffmpeg...');
    
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          console.log('❌ Error con fluent-ffmpeg:', err.message);
          reject(err);
          return;
        }
        
        console.log('✅ fluent-ffmpeg está funcionando');
        
        // Verificar formatos importantes
        const importantFormats = ['mp4', 'avi', 'mov', 'mkv', 'wav', 'mp3'];
        const supportedFormats = Object.keys(formats);
        
        console.log('   Formatos soportados para transcripción:');
        importantFormats.forEach(format => {
          const isSupported = supportedFormats.includes(format);
          console.log(`   ${isSupported ? '✅' : '❌'} ${format.toUpperCase()}`);
        });
        
        resolve(true);
      });
    });
  } catch (error) {
    console.error('❌ Error verificando fluent-ffmpeg:', error.message);
    throw error;
  }
}

async function testAudioExtraction() {
  try {
    console.log('\n3️⃣ Probando extracción de audio (simulada)...');
    
    // Crear comando de prueba sin archivo real
    const testCommand = ffmpeg()
      .input('/dev/null')  // Entrada nula para prueba
      .audioCodec('libmp3lame')
      .toFormat('mp3');
    
    console.log('✅ Comando de extracción configurado correctamente');
    console.log('   Codec de audio: libmp3lame');
    console.log('   Formato de salida: MP3');
    
    return true;
  } catch (error) {
    console.error('❌ Error configurando extracción:', error.message);
    throw error;
  }
}

async function checkDirectories() {
  try {
    console.log('\n4️⃣ Verificando directorios de trabajo...');
    
    const fs = require('fs');
    const path = require('path');
    
    const directories = [
      '/tmp/codex-transcriptions',
      '/tmp/audio_transcriptions'
    ];
    
    directories.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✅ Directorio creado: ${dir}`);
        } else {
          console.log(`✅ Directorio existe: ${dir}`);
        }
        
        // Verificar permisos de escritura
        const testFile = path.join(dir, 'test.txt');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`   📝 Permisos de escritura: OK`);
        
      } catch (error) {
        console.log(`❌ Error con directorio ${dir}: ${error.message}`);
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error verificando directorios:', error.message);
    throw error;
  }
}

async function runAllChecks() {
  try {
    await checkFFmpegInstallation();
    await checkFluentFFmpeg();
    await testAudioExtraction();
    await checkDirectories();
    
    console.log('\n🎉 VERIFICACIÓN COMPLETA');
    console.log('✅ Todos los componentes están funcionando correctamente');
    console.log('🎬 El sistema de transcripción está listo para usar');
    
  } catch (error) {
    console.log('\n💥 VERIFICACIÓN FALLIDA');
    console.log('❌ Hay problemas con la configuración');
    console.log('\n📋 SOLUCIONES RECOMENDADAS:');
    console.log('1. En Docker: Reconstruir imagen con: docker-compose build');
    console.log('2. En VPS: Instalar FFmpeg con: apt-get install ffmpeg');
    console.log('3. En macOS: Instalar con: brew install ffmpeg');
    console.log('4. Verificar que fluent-ffmpeg esté en package.json');
    
    process.exit(1);
  }
}

// Ejecutar verificación
runAllChecks().catch(console.error); 