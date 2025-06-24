const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const supabaseUtil = require('../utils/supabase');
const { analyzeDocument } = require('./documentAnalysis');
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
- title (string) - Título corto (≤ 60 caracteres) que describa el hallazgo
- entity (string) - Persona, institución, empresa o entidad mencionada
- amount (number) - Cantidad de dinero relevante. Si la cifra NO es dinero (p.ej. "286 obras"), pon null.
- currency (string) - Moneda si aplica (ej: "GTQ", "USD", "EUR")
- item_count (number) - Un conteo de unidades (obras, proyectos, víctimas, etc.). Usa null si no corresponde.
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
  // title
  if (!sanitized.title || sanitized.title.trim() === '') {
    sanitized.title = sanitized.discovery ? sanitized.discovery.slice(0, 60) : null;
  }
  // start_date
  if (sanitized.start_date && !isValidISODate(sanitized.start_date)) {
    sanitized.start_date = null;
  }
  // amount numeric
  if (sanitized.amount !== null && sanitized.amount !== undefined) {
    const num = Number(sanitized.amount);
    sanitized.amount = isNaN(num) ? null : num;
  }
  // item_count derivado de amount cuando no es dinero
  if (!sanitized.currency && sanitized.amount !== null) {
    const hintText = `${card.description || ''} ${card.discovery || ''}`.toLowerCase();
    if (hintText.includes('obra') || hintText.includes('obras') || hintText.includes('proyecto') || hintText.includes('proyectos')) {
      sanitized.item_count = sanitized.amount;
      sanitized.amount = null;
      sanitized.currency = null;
    }
  }
  // duration_days numeric
  if (sanitized.duration_days !== null && sanitized.duration_days !== undefined) {
    const num = parseInt(sanitized.duration_days, 10);
    sanitized.duration_days = isNaN(num) ? null : num;
  }
  // Nueva lógica: determinar topic para agrupación basándonos en propiedades originales
  sanitized.topic = card.categoria || card.category || card.tipo_tema || 'General';
  return sanitized;
}

/**
 * Analiza automáticamente un documento si no tiene análisis previo
 * @param {Object} codexItem - Item del codex
 * @param {string} userId - ID del usuario
 * @returns {Promise<string|null>} - Análisis del documento o null si no se pudo analizar
 */
async function ensureDocumentAnalysis(codexItem, userId) {
  // Si ya tiene análisis, no hacer nada
  if (codexItem.document_analysis && codexItem.document_analysis.trim()) {
    return codexItem.document_analysis;
  }

  // Solo procesar documentos que tengan storage_path (archivo físico)
  if (codexItem.tipo !== 'documento' || !codexItem.storage_path) {
    console.log(`⚠️ Item ${codexItem.id} no es un documento con archivo físico, saltando análisis automático`);
    return null;
  }

  console.log(`🔍 Analizando documento automáticamente: ${codexItem.titulo}`);

  try {
    // Construir ruta completa del archivo desde Supabase Storage
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('digitalstorage')
      .download(codexItem.storage_path);

    if (downloadError) {
      console.error(`❌ Error descargando archivo para análisis: ${downloadError.message}`);
      return null;
    }

    // Crear archivo temporal para análisis
    const fs = require('fs');
    const path = require('path');
    const tempDir = '/tmp/document_analysis';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFileName = `${Date.now()}_${codexItem.id}_${codexItem.nombre_archivo || 'documento'}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Escribir archivo temporal
    const arrayBuffer = await downloadData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFilePath, buffer);

    console.log(`📁 Archivo temporal creado: ${tempFilePath}`);

    // Analizar documento
    const analysisOptions = {
      titulo: `Análisis automático: ${codexItem.titulo}`,
      descripcion: `Análisis automático generado durante extracción de hallazgos`,
      etiquetas: ['analisis-automatico', 'extraccion-hallazgos'],
      proyecto: codexItem.proyecto || 'Sin proyecto',
      project_id: codexItem.project_id
    };

    const analysisResult = await analyzeDocument(tempFilePath, userId, {
      ...analysisOptions,
      updateItemId: codexItem.id // guardar en el mismo codex_item
    });

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.warn(`⚠️ No se pudo limpiar archivo temporal: ${cleanupError.message}`);
    }

    if (analysisResult.success) {
      console.log(`✅ Documento analizado exitosamente: ${analysisResult.analysis.estadisticas.hallazgos_totales} hallazgos encontrados`);

      // Obtener el análisis actualizado del item
      const { data: updatedItem, error: updateError } = await supabase
        .from('codex_items')
        .select('document_analysis')
        .eq('id', codexItem.id)
        .single();

      if (updateError) {
        console.error(`❌ Error obteniendo análisis actualizado: ${updateError.message}`);
        return null;
      }

      return updatedItem.document_analysis;
    } else {
      console.error(`❌ Error en análisis de documento: ${analysisResult.error}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error en ensureDocumentAnalysis para item ${codexItem.id}:`, error.message);
    return null;
  }
}

/**
 * Crea registros en la tabla capturado_cards a partir de un codex_item.
 * @param {Object} params
 * @param {string} params.codexItemId - ID del item de Codex (con transcripción o análisis de documento)
 * @param {string} params.projectId - ID del proyecto al que pertenece
 * @param {string} params.userId - ID del usuario (requerido para análisis automático de documentos)
 * @returns {Promise<Array<Object>>} Registros insertados
 */
async function createCardsFromCodex({ codexItemId, projectId, userId }) {
  // 1. Obtener información completa del item
  const { data: codexItem, error: codexError } = await supabase
    .from('codex_items')
    .select('id, audio_transcription, document_analysis, tipo, titulo, nombre_archivo, storage_path, proyecto, project_id')
    .eq('id', codexItemId)
    .single();

  if (codexError) {
    throw new Error(`Error obteniendo codex_item: ${codexError.message}`);
  }

  if (!codexItem) {
    throw new Error('El codex_item no existe');
  }

  // 2. Determinar qué contenido usar para extracción
  let contentToAnalyze = null;
  let contentType = 'unknown';

  if (codexItem.audio_transcription && codexItem.audio_transcription.trim()) {
    contentToAnalyze = codexItem.audio_transcription;
    contentType = 'audio_transcription';
    console.log(`📄 Procesando transcripción de audio para item: ${codexItem.titulo}`);
  } else if (codexItem.document_analysis && codexItem.document_analysis.trim()) {
    contentToAnalyze = codexItem.document_analysis;
    contentType = 'document_analysis';
    console.log(`📋 Procesando análisis de documento existente para item: ${codexItem.titulo}`);
  } else if (codexItem.tipo === 'documento') {
    // 3. Intentar análisis automático de documento si no hay análisis previo
    console.log(`📄 Documento sin análisis detectado, intentando análisis automático...`);
    if (!userId) {
      throw new Error('userId es requerido para análisis automático de documentos');
    }
    
    const autoAnalysis = await ensureDocumentAnalysis(codexItem, userId);
    if (autoAnalysis) {
      contentToAnalyze = autoAnalysis;
      contentType = 'document_analysis_auto';
      console.log(`✅ Análisis automático completado para documento: ${codexItem.titulo}`);
    } else {
      throw new Error('No se pudo generar análisis automático del documento');
    }
  } else {
    throw new Error('El codex_item no contiene audio_transcription, document_analysis, ni es un documento analizable');
  }

  console.log(`🎯 Tipo de contenido detectado: ${contentType} (${contentToAnalyze.length} caracteres)`);

  // 3. Extraer tarjetas con Gemini
  const cards = await extractCapturadoCards(contentToAnalyze);

  if (!cards || cards.length === 0) {
    return [];
  }

  // 3. Obtener tarjetas existentes para evitar duplicados
  const { data: existingCards, error: existingErr } = await supabase
    .from('capturado_cards')
    .select('*')
    .eq('codex_item_id', codexItemId);

  if (existingErr) throw new Error(`Error leyendo capturado_cards existentes: ${existingErr.message}`);

  const existingFingerprints = new Set(
    (existingCards || []).map(c => `${c.entity}|${c.city}|${c.department}|${c.discovery}|${c.description}`)
  );

  // 4. Preparar datos filtrando duplicados
  const insertData = cards
    .map(raw => {
      const card = sanitizeCard(raw);
      return {
        ...card,
        project_id: projectId,
        codex_item_id: codexItemId
      };
    })
    .filter(c => !existingFingerprints.has(`${c.entity}|${c.city}|${c.department}|${c.discovery}|${c.description}`));

  if (insertData.length === 0) return [];

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
 * Procesa todos los codex_items de audio/video con transcripción o documentos que aún no tengan capturado_cards
 * @param {string} projectId - ID del proyecto
 * @param {string} userId - ID del usuario (requerido para análisis automático de documentos)
 */
async function bulkCreateCardsForProject(projectId, userId) {
  console.log(`🔍 Iniciando bulk processing para proyecto: ${projectId}`);
  
  // 1. Obtener ids ya capturados
  const { data: rowsCaptured, error: errorCaptured } = await supabase
    .from('capturado_cards')
    .select('codex_item_id')
    .eq('project_id', projectId);
  if (errorCaptured) throw errorCaptured;
  const capturedIds = (rowsCaptured || []).map(r => r.codex_item_id);
  console.log(`📋 Items ya capturados: ${capturedIds.length}`);

  // 2. Obtener codex_items pendientes (con transcripción, análisis de documento O documentos sin análisis)
  console.log('🔍 Buscando items con transcripción, análisis de documento o documentos analizables...');
  const { data: allItems, error: errorAllItems } = await supabase
    .from('codex_items')
    .select('id, tipo, titulo, audio_transcription, document_analysis, storage_path')
    .eq('project_id', projectId)
    .or('audio_transcription.not.is.null,document_analysis.not.is.null,and(tipo.eq.documento,storage_path.not.is.null)');
  
  if (errorAllItems) {
    console.error('❌ Error obteniendo todos los items:', errorAllItems);
    throw errorAllItems;
  }
  
  console.log(`📋 Todos los items con contenido analizable: ${allItems?.length || 0}`);
  if (allItems && allItems.length > 0) {
    console.log('📝 Items encontrados:');
    allItems.forEach(item => {
      const hasTranscription = item.audio_transcription && item.audio_transcription.trim();
      const hasDocumentAnalysis = item.document_analysis && item.document_analysis.trim();
      const isAnalyzableDocument = item.tipo === 'documento' && item.storage_path;
      let contentType = 'sin contenido';
      
      if (hasTranscription) contentType = 'transcripción';
      else if (hasDocumentAnalysis) contentType = 'análisis';
      else if (isAnalyzableDocument) contentType = 'documento analizable';
      
      console.log(`   - ${item.id} | ${item.titulo} | ${item.tipo} | ${contentType}`);
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
      console.log(`⚙️ Procesando item: ${item.id} (${item.tipo})`);
      const cards = await createCardsFromCodex({ 
        codexItemId: item.id, 
        projectId, 
        userId 
      });
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