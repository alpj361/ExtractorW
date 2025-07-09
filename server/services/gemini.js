const fetch = require('node-fetch');
require('dotenv').config();

/**
 * Servicio para interactuar con la API Generative Language de Google (Gemini).
 * Actualmente usa el modelo "gemini-1.5-flash-latest" (Gemini Flash).
 * Si necesitas razonamiento más profundo, puedes usar "deepseek-llm" en el futuro.
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️  GEMINI_API_KEY no definido en variables de entorno.');
    }
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = 'gemini-1.5-flash-latest';
  }

  /**
   * Genera contenido dado un array de mensajes (formato similar a OpenAI).
   * @param {Array<{role: 'user'|'system'|'assistant', content: string}>} messages 
   * @param {Object} [options] - temperature, max_tokens, top_p, etc.
   * @returns {Promise<string>} texto generado
   */
  async generateContent(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY no configurado');
    }

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    // Convert messages to Gemini contentParts format
    const contents = messages.map(m => ({role: m.role, parts: [{text: m.content}]}));

    const body = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        topP: options.top_p ?? 0.95,
        maxOutputTokens: options.max_tokens ?? 512
      }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.trim();
    } catch (error) {
      console.error('❌ Error llamando a Gemini:', error);
      throw error;
    }
  }
}

module.exports = new GeminiService(); 