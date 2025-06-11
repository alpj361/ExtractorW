const fs = require('fs');
const path = require('path');

// Ruta del archivo server.js
const serverJsPath = path.join(__dirname, 'server.js');

try {
  console.log('Leyendo archivo server.js...');
  let serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
  
  // Código a añadir al final del archivo
  const codeToAdd = `

// Registrar proceso y errores
process.on('uncaughtException', (error) => {
  console.error('ERROR NO CAPTURADO:', error);
  // No terminar el proceso para mantener el servidor en ejecución
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PROMESA RECHAZADA NO MANEJADA:', reason);
  // No terminar el proceso para mantener el servidor en ejecución
});

// Imprimir variables de entorno disponibles (sin valores sensibles)
console.log('Variables de entorno disponibles:');
console.log('PORT:', process.env.PORT || '8080 (default)');
console.log('NODE_ENV:', process.env.NODE_ENV || 'no configurado');
console.log('OPENAI_API_KEY configurada:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_ORG_ID configurada:', !!process.env.OPENAI_ORG_ID);
console.log('SUPABASE_URL configurada:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY configurada:', !!process.env.SUPABASE_ANON_KEY);

// Iniciar el servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(\`[\${new Date().toISOString()}] Servidor iniciado en puerto \${PORT}\`);
  console.log(\`📊 Endpoints de tendencias disponibles:\`);
  console.log(\`   - POST /api/processTrends\`);
  console.log(\`   - POST /api/sondeo\`);
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && supabase) {
    console.log(\`- Supabase configurado: \${process.env.SUPABASE_URL}\`);
  } else {
    console.log('- Supabase no configurado o no inicializado, no se guardarán datos');
  }
});

// Exportar para testing y depuración
module.exports = { app };
`;

  // Añadir el código al final del archivo
  serverJsContent += codeToAdd;
  
  console.log('Escribiendo archivo server.js modificado...');
  fs.writeFileSync(serverJsPath, serverJsContent);
  
  console.log('✅ Archivo server.js actualizado correctamente.');
  console.log('El servidor ahora incluye manejo de errores y código de inicialización.');
  
} catch (error) {
  console.error('❌ Error actualizando server.js:', error);
} 