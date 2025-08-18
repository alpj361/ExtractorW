const { InternalMemoryClient } = require('../laura/internalMemoryClient');

async function gptChat(messages, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurado');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.VIZTA_REASONING_MODEL || 'gpt-3.5-turbo',
      messages,
      temperature: options.temperature || 0.2,
      max_tokens: options.maxTokens || 800,
      top_p: options.topP || 0.95
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

class ReasoningLayer {
  constructor(viztaAgent) {
    this.vizta = viztaAgent;
    this.enabled = String(process.env.VIZTA_REASONED_DIRECT || 'true') === 'true';
    this.memory = new InternalMemoryClient();
  }

  isEnabled() {
    return this.enabled;
  }

  async tryDirectPulseAnswer(userMessage, user, conversationId) {
    if (!this.enabled) return null;
    try {
      const pulseResults = await this.memory.searchPoliticalContext(userMessage, 6);
      const hasContext = Array.isArray(pulseResults) && pulseResults.length > 0;
      if (!hasContext) {
        return null;
      }

      const systemPrompt = [
        'Eres Vizta, analista político enfocado en Guatemala.',
        'Usa el contexto de PulsePolitics provisto para responder de forma concisa, útil y accionable.',
        'Si algo no está respaldado por el contexto, dilo explícitamente. No inventes.',
        'Incluye un bloque final breve de "Razonamiento" explicando por qué tu respuesta es válida para el usuario.'
      ].join(' ');

      const contextText = JSON.stringify(pulseResults).slice(0, 6000);
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Pregunta: ${userMessage}` },
        { role: 'user', content: `Contexto PulsePolitics (resumido): ${contextText}` }
      ];

      const startTime = Date.now();
      const answer = await gptChat(messages, { temperature: 0.1, maxTokens: 700 });
      const latency = Date.now() - startTime;

      return {
        success: true,
        agent: 'Vizta',
        message: answer,
        type: 'chat_response',
        mode: 'vizta_reasoned',
        timestamp: new Date().toISOString(),
        processingTime: latency,
        pulseContextUsed: true,
        contextItems: pulseResults.length,
        conversationId
      };
    } catch (error) {
      return { success: false, agent: 'Vizta', error: error.message, mode: 'vizta_reasoned_error' };
    }
  }
}

module.exports = { ReasoningLayer };

