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
 * Genera un prompt estructurado para extraer tarjetas de información relevante ("capturados")
 * desde la transcripción de audio, adaptándose automáticamente al tipo de contenido.
 * @param {string} transcription - Texto completo de la transcripción
 */
function buildPrompt(transcription) {
  return `Eres un sistema experto en análisis de transcripciones de contenido en español. Analiza la siguiente transcripción y DETECTA automáticamente el tipo de contenido, luego EXTRAE TODA la información relevante según el contexto identificado.

TIPOS DE CONTENIDO Y QUÉ EXTRAER:

🔍 INVESTIGATIVO (casos, auditorías, investigaciones):
- Hallazgos, irregularidades, problemas detectados
- Corrupción, malversación, mala gestión
- Proyectos fallidos, gastos excesivos
- Evidencias, testimonios, datos comprometedores

📰 INFORMATIVO (noticias, reportes, datos):
- Eventos importantes, anuncios, declaraciones
- Estadísticas, cifras, datos relevantes
- Cambios, nuevas políticas, decisiones
- Hechos verificables y fechas importantes

📚 EDUCATIVO (tutoriales, explicaciones, capacitaciones):
- Conceptos clave, definiciones importantes
- Procesos, metodologías, pasos a seguir
- Herramientas, recursos, recomendaciones
- Lecciones aprendidas, mejores prácticas

💼 COMERCIAL (productos, servicios, ventas):
- Productos/servicios mencionados, precios
- Ofertas, promociones, descuentos
- Empresas, marcas, contactos
- Oportunidades de negocio, inversiones

👤 PERSONAL (experiencias, opiniones, historias):
- Experiencias significativas, anécdotas
- Opiniones importantes, recomendaciones
- Logros, fracasos, lecciones de vida
- Contactos, relaciones, colaboraciones

INSTRUCCIONES:
1. DETECTA automáticamente el tipo de contenido predominante
2. ADAPTA la extracción según el contexto identificado
3. EXTRAE información específica y relevante para ese tipo
4. Si hay múltiples tipos, incluye información de todos

FORMATO DE RESPUESTA:
Devuelve **exclusivamente** un ARRAY JSON. **No** incluyas comentarios ni formateo Markdown.

Cada elemento debe tener **exactamente** estas claves (usa null si no aplica):
- entity (string) - Persona, institución, empresa o entidad mencionada
- amount (number) - Cantidad de dinero, precio, costo o cifra numérica relevante
- currency (string) - Moneda si aplica (ej: "GTQ", "USD", "EUR")
- city (string) - Ciudad, lugar o ubicación mencionada
- department (string) - Departamento, área, región o categoría
- discovery (string) - Tipo de hallazgo, información o dato extraído
- source (string) - Extracto de máximo 120 caracteres de la transcripción
- start_date (string) - Fecha mencionada en formato YYYY-MM-DD o null
- duration_days (number) - Duración en días si se menciona
- description (string) - Resumen conciso del punto extraído (≤ 150 caracteres)

Si no hay información relevante que extraer, devuelve un array vacío [].

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
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

function isValidISODate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// Ensure cards fields are clean
function sanitizeCard(card) {
  const sanitized = { ...card };
  // start_date
  if (sanitized.start_date && !isValidISODate(sanitized.start_date)) {
    sanitized.start_date = null;
  }
  // amount numeric
  if (sanitized.amount !== null && sanitized.amount !== undefined) {
    const num = Number(sanitized.amount);
    sanitized.amount = isNaN(num) ? null : num;
  }
  // duration_days numeric
  if (sanitized.duration_days !== null && sanitized.duration_days !== undefined) {
    const num = parseInt(sanitized.duration_days, 10);
    sanitized.duration_days = isNaN(num) ? null : num;
  }
  return sanitized;
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
  const insertData = cards.map(raw => {
    const card = sanitizeCard(raw);
    return {
      ...card,
      project_id: projectId,
      codex_item_id: codexItemId
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from('capturado_cards')
    .insert(insertData)
    .select();

  if (insertError) {
    throw new Error(`Error insertando capturado_cards: ${insertError.message}`);
  }

  return inserted;
}

/**
 * Procesa todos los codex_items de audio/video con transcripción que aún no tengan capturado_cards
 * @param {string} projectId
 */
async function bulkCreateCardsForProject(projectId) {
  console.log(`🔍 Iniciando bulk processing para proyecto: ${projectId}`);
  
  // 1. Obtener ids ya capturados
  const { data: rowsCaptured, error: errorCaptured } = await supabase
    .from('capturado_cards')
    .select('codex_item_id')
    .eq('project_id', projectId);
  if (errorCaptured) throw errorCaptured;
  const capturedIds = (rowsCaptured || []).map(r => r.codex_item_id);
  console.log(`📋 Items ya capturados: ${capturedIds.length}`);

  // 2. Obtener codex_items pendientes
  console.log('🔍 Buscando items con transcripción...');
  const { data: allItems, error: errorAllItems } = await supabase
    .from('codex_items')
    .select('id, tipo, titulo')
    .eq('project_id', projectId)
    .not('audio_transcription', 'is', null);
  
  if (errorAllItems) {
    console.error('❌ Error obteniendo todos los items:', errorAllItems);
    throw errorAllItems;
  }
  
  console.log(`📋 Todos los items con transcripción: ${allItems?.length || 0}`);
  if (allItems && allItems.length > 0) {
    console.log('📝 Items encontrados:');
    allItems.forEach(item => {
      console.log(`   - ${item.id} | ${item.titulo} | ${item.tipo}`);
    });
  }
  
  // También buscar específicamente videos para debug
  console.log('🎥 Verificando items de video específicamente...');
  const { data: videoItems, error: videoError } = await supabase
    .from('codex_items')
    .select('id, tipo, titulo')
    .eq('project_id', projectId)
    .eq('tipo', 'video');
  
  if (!videoError && videoItems) {
    console.log(`📹 Videos en el proyecto: ${videoItems.length}`);
    videoItems.forEach(item => {
      console.log(`   - ${item.id} | ${item.titulo} | ${item.tipo}`);
    });
  }
  
  // Filtrar items que no han sido procesados
  const pendingItems = (allItems || []).filter(item => !capturedIds.includes(item.id));
  const errorPending = null; // No hay error ya que filtramos en memoria
  if (errorPending) {
    console.error('❌ Error obteniendo items pendientes:', errorPending);
    throw errorPending;
  }
  
  console.log(`📝 Items pendientes encontrados: ${pendingItems?.length || 0}`);
  if (pendingItems?.length > 0) {
    console.log('📋 Items a procesar:', pendingItems.map(item => `${item.id} (${item.tipo})`));
  }

  let totalCards = 0;
  const processed = [];
  for (const item of pendingItems || []) {
    try {
      console.log(`⚙️ Procesando item: ${item.id}`);
      const cards = await createCardsFromCodex({ codexItemId: item.id, projectId });
      totalCards += cards.length;
      processed.push({ codex_item_id: item.id, cards_created: cards.length });
      console.log(`✅ Item ${item.id} procesado: ${cards.length} cards creadas`);
    } catch (err) {
      console.error('❌ Error bulk capturados en item', item.id, ':', err.message);
      // Continuar con el siguiente item en lugar de fallar completamente
      processed.push({ codex_item_id: item.id, cards_created: 0, error: err.message });
    }
  }
  
  console.log(`🎯 Procesamiento completado: ${processed.length} items procesados, ${totalCards} cards totales`);
  return { processed_count: processed.length, total_cards: totalCards, details: processed };
}

module.exports = {
  createCardsFromCodex,
  bulkCreateCardsForProject
}; 