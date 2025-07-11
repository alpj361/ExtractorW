// Verificar que el helper de Gemini se carga correctamente
const { geminiChat } = require('./server/services/geminiHelper');

console.log('✅ Helper de Gemini cargado correctamente');
console.log('GEMINI_API_KEY configurada:', !!process.env.GEMINI_API_KEY);

// Verificar que agentesService se carga sin errores
const agentesService = require('./server/services/agentesService');
console.log('✅ AgentesService cargado correctamente');

console.log('🎉 Todos los archivos se cargan sin errores de sintaxis');