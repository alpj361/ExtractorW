/**
 * Script para iniciar el servidor con valores por defecto para desarrollo
 * 
 * Este script carga primero las variables de entorno desde .env
 * Si alguna variable crítica no está definida, establece valores de desarrollo
 */

// Cargar dotenv para leer variables desde .env
require('dotenv').config();

// Establecer valores por defecto para desarrollo si no existen
if (!process.env.PORT) process.env.PORT = '8080';
if (!process.env.USE_AI) process.env.USE_AI = 'false';

// Verificar variables críticas y mostrar advertencias
const criticalVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingVars = criticalVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('\n⚠️  ADVERTENCIA: Las siguientes variables de entorno no están definidas:');
  missingVars.forEach(varName => console.warn(`   - ${varName}`));
  console.warn('   El servidor funcionará con limitaciones o podría fallar.\n');
} else {
  console.log('✅ Variables de entorno críticas configuradas correctamente.');
}

// Mostrar configuración
console.log('\n📊 Configuración:');
console.log(`   - Puerto: ${process.env.PORT}`);
console.log(`   - Uso de IA: ${process.env.USE_AI === 'true' ? 'Activado' : 'Desactivado'}`);
console.log(`   - Supabase URL: ${process.env.SUPABASE_URL ? '✓ Configurado' : '✗ No configurado'}`);
console.log(`   - VPS API URL: ${process.env.VPS_API_URL ? '✓ Configurado' : '✗ No configurado'}`);
console.log('\n');

// Iniciar el servidor
require('./server.js'); 