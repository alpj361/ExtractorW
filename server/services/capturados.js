const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const supabaseUtil = require('../utils/supabase');
let supabase = supabaseUtil;

// Instanciar Gemini para análisis de texto
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Si existe clave service_role, usarla para omitir RLS en inserciones
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });
}

/**
 * Genera un prompt estructurado para extraer tarjetas de hallazgos ("capturados")
 * desde la transcripción de audio.
 * @param {string} transcription - Texto completo de la transcripción
 */
function buildPrompt(transcription) {
  return `Eres un sistema experto en análisis de transcripciones de audios de investigaciones sobre contrataciones públicas en Guatemala. Analiza la siguiente transcripción en español y EXTRAERÁS TODA la información sobre hallazgos que implique posible corrupción (llamados \"capturados\").

1. Devuelve la respuesta **exclusivamente** como un ARRAY JSON. **No** incluyas comentarios, claves adicionales ni formateo Markdown.
2. Cada elemento del array debe tener **exactamente** estas claves (usa null si no se encontró valor):
   - entity (string)
   - amount (number)
   - currency (string)
   - city (string)
   - department (string)
   - discovery (string)
   - source (string)
   - start_date (string, formato YYYY-MM-DD o null)
   - duration_days (number)
   - description (string)
3. La clave **source** debe ser un extracto máximo de 120 caracteres que cite la parte de la transcripción donde se menciona el hallazgo.
4. La clave **description** es un resumen conciso (\u2264 150 caracteres).
5. Si no hay capturados, devuelve un array vacío [].

TRANSCRIPCIÓN A ANALIZAR:
"""
${transcription}
"""`;
}

/**
 * Utiliza Gemini para extraer información de capturados como tarjetas estructuradas.
 * @param {string} transcription
 * @returns {Promise<Array<Object>>}
 */
async function extractCapturadoCards(transcription) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const prompt = buildPrompt(transcription);
  const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Eliminar bloques ```json ... ``` si existen
  text = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('La respuesta no es un array JSON');
  } catch (err) {
    console.error('❌ Error parseando JSON de capturados:', err);
    throw new Error('No se pudo interpretar la respuesta del modelo como JSON');
  }
}

/**
 * Crea registros en la tabla capturado_cards a partir de un codex_item.
 * @param {Object} params
 * @param {string} params.codexItemId - ID del item de Codex (con transcripción)
 * @param {string} params.projectId - ID del proyecto al que pertenece
 * @returns {Promise<Array<Object>>} Registros insertados
 */
async function createCardsFromCodex({ codexItemId, projectId }) {
  // 1. Obtener transcripción
  const { data: codexItem, error: codexError } = await supabase
    .from('codex_items')
    .select('audio_transcription')
    .eq('id', codexItemId)
    .single();

  if (codexError) {
    throw new Error(`Error obteniendo codex_item: ${codexError.message}`);
  }

  if (!codexItem || !codexItem.audio_transcription) {
    throw new Error('El codex_item no contiene audio_transcription');
  }

  // 2. Extraer tarjetas con Gemini
  const cards = await extractCapturadoCards(codexItem.audio_transcription);

  if (!cards || cards.length === 0) {
    return [];
  }

  // 3. Preparar datos para inserción
  const insertData = cards.map(card => ({
    ...card,
    project_id: projectId,
    codex_item_id: codexItemId
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('capturado_cards')
    .insert(insertData)
    .select();

  if (insertError) {
    throw new Error(`Error insertando capturado_cards: ${insertError.message}`);
  }

  return inserted;
}

module.exports = {
  createCardsFromCodex
}; 