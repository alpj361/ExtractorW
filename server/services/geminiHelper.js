const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Helper genérico para Gemini 2.5 Flash como motor de razonamiento
 * @param {Array} messages - Array de mensajes con formato {role, content}
 * @param {Object} options - Opciones de generación (temperature, maxTokens, etc.)
 * @returns {string} Texto generado por Gemini
 */
async function geminiChat(messages, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurado');
  }
  
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash' // Actualizado a 2.5 Flash como principal
  });
  
  // Convertir mensajes al formato de Gemini
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'system' ? 'user' : msg.role,
    parts: [{ text: msg.content }]
  }));
  
  const lastMessage = messages[messages.length - 1];
  
  const chat = model.startChat({ 
    history: history,
    generationConfig: {
      temperature: options.temperature || 0.2,
      maxOutputTokens: options.maxTokens || 2048,
      topP: options.topP || 0.95,
      topK: options.topK || 40
    }
  });
  
  const result = await chat.sendMessage(lastMessage.content);
  const response = await result.response;
  
  return response.text();
}

module.exports = { geminiChat };