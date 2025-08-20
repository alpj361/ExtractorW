/**
 * Helper genérico para usar OpenAI Chat Completions con modelo GPT-5-mini
 * Mantiene la misma firma que el helper anterior para no romper dependencias.
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} options
 * @returns {Promise<string>} Texto generado por el modelo
 */
async function geminiChat(messages, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurado');
  }

  const body = {
    model: 'gpt-5-mini',
    messages: messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 2048,
    top_p: options.topP ?? 0.95
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return text.trim();
}

module.exports = { geminiChat };