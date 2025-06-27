const jwt = require('jsonwebtoken');

// ===================================================================
// GENERADOR DE TOKEN DE PRUEBA PARA N8N MCP CLIENT
// ===================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Datos del usuario de prueba
const testUser = {
  id: 'test-user-n8n',
  email: 'n8n@test.com',
  name: 'N8N Test User',
  role: 'user'
};

// Generar token con expiración de 30 días
const token = jwt.sign(
  testUser,
  JWT_SECRET,
  { 
    expiresIn: '30d',
    issuer: 'ExtractorW-MCP-Server'
  }
);

console.log('🔐 TOKEN GENERADO PARA N8N MCP CLIENT');
console.log('='.repeat(60));
console.log('📋 Copia este token completo:');
console.log('');
console.log(token);
console.log('');
console.log('📝 Configuración en N8N:');
console.log('   Authentication: Header Auth');
console.log('   Name: Authorization');
console.log(`   Value: Bearer ${token}`);
console.log('');
console.log('⏰ Expira en: 30 días');
console.log('👤 Usuario: N8N Test User');
console.log('🔑 ID: test-user-n8n'); 