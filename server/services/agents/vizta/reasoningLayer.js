const { InternalMemoryClient } = require('../laura/internalMemoryClient');

// DeepSeek (v3.1 / Reasoner) - Direct API
async function deepseekChat(messages, options = {}) {
  const dsKey = process.env.DEEPSEEK_API_KEY;
  const model = (process.env.VIZTA_DEEPSEEK_MODEL || 'deepseek-reasoner').trim();

  // Prefer direct DeepSeek API if key present
  if (dsKey) {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dsKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 800,
        top_p: options.topP ?? 0.95
      })
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`DeepSeek API error: ${resp.status} - ${t}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Fallback to OpenRouter if configured (optional)
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    const orModel = model.startsWith('deepseek/') ? model : `deepseek/${model}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: orModel,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 800,
        top_p: options.topP ?? 0.95
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek/OpenRouter error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error('No hay credenciales para DeepSeek (DEEPSEEK_API_KEY u OPENROUTER_API_KEY)');
}

// Fallback: GPT‑4o Mini (OpenAI)
async function openaiMiniChat(messages, options = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurado');
  const model = process.env.VIZTA_FALLBACK_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 800,
      top_p: options.topP ?? 0.95
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
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
        'Eres Vizta, analista político orientado a Guatemala y chatbot operativo.',
        'Responde de forma concisa y accionable, y explica brevemente tu plan/razonamiento al final.',
        'Indica explícitamente qué herramientas/llamadas planeas usar si es necesario (p.ej. OpenPipe toolcalling).',
        'No inventes datos; si falta evidencia, dilo.'
      ].join(' ');

      const contextText = JSON.stringify(pulseResults).slice(0, 6000);
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Pregunta: ${userMessage}` },
        { role: 'user', content: `Contexto PulsePolitics (resumido): ${contextText}` }
      ];

      const startTime = Date.now();
      let answer;
      try {
        // Prioridad: DeepSeek V3.1 (razonamiento)
        answer = await deepseekChat(messages, { temperature: 0.1, maxTokens: 700 });
      } catch (e) {
        // Fallback: GPT‑4o Mini
        answer = await openaiMiniChat(messages, { temperature: 0.1, maxTokens: 700 });
      }
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

