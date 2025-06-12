#!/usr/bin/env node

/**
 * Script para migrar el servidor monolítico a una estructura modular
 * Ejecutar con: node migrate-to-modular.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Iniciando migración a estructura modular...');

// Verificar existencia del directorio server
if (!fs.existsSync(path.join(__dirname, 'server'))) {
  console.log('📁 Creando estructura de directorios...');
  fs.mkdirSync(path.join(__dirname, 'server'));
  fs.mkdirSync(path.join(__dirname, 'server/routes'));
  fs.mkdirSync(path.join(__dirname, 'server/controllers'));
  fs.mkdirSync(path.join(__dirname, 'server/services'));
  fs.mkdirSync(path.join(__dirname, 'server/middlewares'));
  fs.mkdirSync(path.join(__dirname, 'server/utils'));
  fs.mkdirSync(path.join(__dirname, 'server/models'));
} else {
  console.log('⚠️ El directorio server ya existe. Se actualizarán los archivos existentes.');
}

// Crear respaldo del archivo original
const originalServerPath = path.join(__dirname, 'server.js');
const backupPath = path.join(__dirname, 'server.js.bak');

if (fs.existsSync(originalServerPath)) {
  console.log('💾 Creando respaldo del servidor original...');
  fs.copyFileSync(originalServerPath, backupPath);
}

// Copiar archivos modulares
console.log('📋 Copiando nuevos archivos modulares...');

// Actualizar package.json para incluir la nueva estructura
try {
  console.log('📦 Actualizando package.json...');
  const packagePath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Actualizar script start
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts.start = 'node server/index.js';
    packageJson.scripts['start:original'] = 'node server.js';
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ package.json actualizado correctamente');
  } else {
    console.log('⚠️ No se encontró package.json');
  }
} catch (err) {
  console.error('❌ Error al actualizar package.json:', err);
}

// Instrucciones finales
console.log(`
✅ Migración completada!

Ahora puedes iniciar el servidor modular con:
  npm start

O el servidor original con:
  npm run start:original

Para completar la migración, actualiza las dependencias:
  npm install

Si encuentras algún problema, puedes restaurar el servidor original desde:
  ${backupPath}
`); 