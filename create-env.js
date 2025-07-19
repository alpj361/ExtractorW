/**
 * Script para crear archivo .env de configuración
 * Ejecutar con: node create-env.js
 */

const fs = require('fs');
const path = require('path');

// Ruta del archivo .env
const envFilePath = path.join(__dirname, '.env');

// Contenido del archivo .env
const envContent = `# API Keys y credenciales
OPENROUTER_API_KEY=tu_api_key_aqui
VPS_API_URL=tu_url_api_aqui

# Supabase
SUPABASE_URL=https://tuproyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui

# Configuración
USE_AI=false  # true para usar IA, false para procesamiento local (más rápido)

# Sondeos Configuration
USE_MOCK_DATA=false  # true para usar datos simulados en visualizaciones, false para datos reales

# Puerto del servidor
PORT=8080
`;

// Escribir el archivo
try {
  fs.writeFileSync(envFilePath, envContent);
  console.log(`✅ Archivo .env creado exitosamente en ${envFilePath}`);
  console.log('Por favor, reemplaza los valores con tus credenciales reales');
} catch (error) {
  console.error('❌ Error al crear archivo .env:', error.message);
} 