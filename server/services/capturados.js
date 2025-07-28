const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const supabaseUtil = require('../utils/supabase');
const { analyzeDocument } = require('./documentAnalysis');
const { normalizeGeographicInfoSync } = require('./mapsAgent');
const { normalizeString } = require('../utils/coverageNormalization');
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
- department (string) - Departamento del país (ej: Guatemala, Sacatepéquez, Quetzaltenango), área geográfica o región administrativa
- pais (string) - País mencionado (ej: Guatemala, Honduras, El Salvador, México)
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

/**
 * Fragmenta texto largo en chunks y extrae tarjetas de cada fragmento
 * @param {string} fullText - Texto completo a procesar
 * @returns {Promise<Array<Object>>} - Array consolidado de tarjetas
 */
async function extractCapturadoCardsInChunks(fullText) {
  console.log(`🔄 Iniciando procesamiento en chunks para ${fullText.length} caracteres...`);
  
  // Función de fragmentación (reutilizada de documentAnalysis.js)
  function fragmentText(text, maxChunkSize = 8000) {
    if (text.length <= maxChunkSize) {
      return [text];
    }
    
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/); // Dividir por párrafos vacíos
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // Si el párrafo solo ya es muy largo, dividirlo por oraciones
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChunkSize) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence + '.';
          } else {
            currentChunk += sentence + '.';
          }
        }
      } else {
        // Verificar si podemos agregar el párrafo al chunk actual
        if (currentChunk.length + paragraph.length > maxChunkSize) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
    }
    
    // Agregar el último chunk si tiene contenido
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Fragmentar el texto
  const chunks = fragmentText(fullText, 8000);
  console.log(`📄 Texto fragmentado en ${chunks.length} chunks (promedio: ${Math.round(fullText.length / chunks.length)} chars por chunk)`);
  
  // Procesar cada chunk individualmente
  const allCards = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      console.log(`🔍 Procesando chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);
      
      const chunkCards = await extractCapturadoCards(chunks[i]);
      
      if (chunkCards && Array.isArray(chunkCards)) {
        allCards.push(...chunkCards);
        console.log(`✅ Chunk ${i + 1}: ${chunkCards.length} tarjetas extraídas`);
      } else {
        console.log(`⚠️ Chunk ${i + 1}: sin tarjetas extraídas`);
      }
      
      // Pausa breve entre chunks para evitar rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ Error procesando chunk ${i + 1}:`, error.message);
      // Continuar con el siguiente chunk en lugar de fallar completamente
    }
  }
  
  console.log(`✅ Procesamiento en chunks completado: ${allCards.length} tarjetas totales de ${chunks.length} chunks`);
  
  // Eliminar duplicados potenciales basados en criterios similares
  const uniqueCards = [];
  const seen = new Set();
  
  for (const card of allCards) {
    const fingerprint = `${card.entity || ''}|${card.city || ''}|${card.department || ''}|${card.discovery || ''}|${(card.description || '').substring(0, 50)}`;
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      uniqueCards.push(card);
    }
  }
  
  if (uniqueCards.length < allCards.length) {
    console.log(`🔄 Eliminados ${allCards.length - uniqueCards.length} duplicados, quedando ${uniqueCards.length} tarjetas únicas`);
  }
  
  return uniqueCards;
}

function isValidISODate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// Ensure cards fields are clean
function sanitizeCard(card, codexItem = null) {
  // Log de datos originales para debug
  if (card.duration_days !== null && card.duration_days !== undefined) {
    console.log(`🔍 Datos originales duration_days: "${card.duration_days}" (tipo: ${typeof card.duration_days})`);
  }
  
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
  // duration_days numeric - manejo más robusto para evitar errores de tipo
  if (sanitized.duration_days !== null && sanitized.duration_days !== undefined) {
    const numFloat = parseFloat(sanitized.duration_days);
    const numInt = Math.floor(numFloat);
    sanitized.duration_days = isNaN(numInt) ? null : numInt;
    console.log(`🔢 Convertir duration_days: "${sanitized.duration_days}" → ${numInt}`);
  }
  // Nueva lógica: usar el título del archivo/documento como topic
  if (codexItem && codexItem.titulo) {
    // Extraer el tema del título del archivo, limpiando prefijos como "Análisis automático:"
    let topic = codexItem.titulo;
    if (topic.includes('Análisis automático:')) {
      topic = topic.replace('Análisis automático:', '').trim();
    }
    // Remover extensiones de archivo
    topic = topic.replace(/\.(pdf|doc|docx|txt|rtf|mp3|wav|mp4|avi|mov)$/i, '');
    sanitized.topic = topic || 'General';
  } else {
    // Fallback a las propiedades originales o General
    sanitized.topic = card.categoria || card.category || card.tipo_tema || 'General';
  }

  // 🌎 NORMALIZACIÓN GEOGRÁFICA CON IA
  // La normalización con IA se hará en el procesamiento en lote para mejor eficiencia
  // Por ahora se mantiene la información original para procesar después

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
  // 1. Obtener información completa del item (incluyendo campos de enlaces)
  const { data: codexItem, error: codexError } = await supabase
    .from('codex_items')
    .select('id, audio_transcription, document_analysis, transcripcion, descripcion, url, tipo, titulo, nombre_archivo, storage_path, proyecto, project_id')
    .eq('id', codexItemId)
    .single();

  if (codexError) {
    throw new Error(`Error obteniendo codex_item: ${codexError.message}`);
  }

  if (!codexItem) {
    throw new Error('El codex_item no existe');
  }

  // 2. Determinar qué contenido usar para extracción (incluyendo enlaces)
  let contentToAnalyze = null;
  let contentType = 'unknown';

  if (codexItem.audio_transcription && codexItem.audio_transcription.trim()) {
    contentToAnalyze = codexItem.audio_transcription;
    contentType = 'audio_transcription';
    console.log(`📄 Procesando transcripción de audio para item: ${codexItem.titulo}`);
  } else if (codexItem.transcripcion && codexItem.transcripcion.trim()) {
    contentToAnalyze = codexItem.transcripcion;
    contentType = 'transcripcion';
    console.log(`📄 Procesando transcripción para item: ${codexItem.titulo}`);
  } else if (codexItem.document_analysis && codexItem.document_analysis.trim()) {
    contentToAnalyze = codexItem.document_analysis;
    contentType = 'document_analysis';
    console.log(`📋 Procesando análisis de documento existente para item: ${codexItem.titulo}`);
  } else if (codexItem.tipo === 'enlace' && codexItem.descripcion && codexItem.descripcion.trim()) {
    // 🆕 NUEVO: Procesar enlaces con descripción/análisis básico
    let linkContent = `ENLACE ANALIZADO: ${codexItem.titulo}\n`;
    linkContent += `URL: ${codexItem.url || 'No disponible'}\n`;
    linkContent += `DESCRIPCIÓN/ANÁLISIS: ${codexItem.descripcion}\n`;
    
    contentToAnalyze = linkContent;
    contentType = 'link_basic_analysis';
    console.log(`🔗 Procesando enlace con análisis básico para item: ${codexItem.titulo}`);
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
    throw new Error('El codex_item no contiene contenido analizable (audio_transcription, transcripcion, document_analysis, descripción de enlace, o documento)');
  }

  console.log(`🎯 Tipo de contenido detectado: ${contentType} (${contentToAnalyze.length} caracteres)`);

  // 3. Extraer tarjetas con Gemini (usando chunks para documentos largos)
  let cards = [];
  
  if (contentToAnalyze.length > 10000) {
    console.log(`📄 Contenido largo detectado (${contentToAnalyze.length} chars), procesando en chunks...`);
    cards = await extractCapturadoCardsInChunks(contentToAnalyze);
  } else {
    console.log(`📄 Contenido corto, procesando directamente...`);
    cards = await extractCapturadoCards(contentToAnalyze);
  }

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
  const initialData = cards
    .map(raw => {
      const card = sanitizeCard(raw, codexItem);
      return {
        ...card,
        project_id: projectId,
        codex_item_id: codexItemId
      };
    })
    .filter(c => !existingFingerprints.has(`${c.entity}|${c.city}|${c.department}|${c.discovery}|${c.description}`));

  if (initialData.length === 0) return [];

  // 🌎 NORMALIZACIÓN GEOGRÁFICA CON COORDENADAS EN LOTE (Sistema actualizado)
  console.log(`🔍 Normalizando geografía con coordenadas para ${initialData.length} hallazgos...`);
  
  try {
    // Extraer información geográfica para normalización
    const geoData = initialData.map(card => ({
      city: card.city,
      department: card.department,
      pais: card.pais
    }));

    // ✅ USAR SISTEMA ACTUALIZADO: Mismo que en coverages con coordenadas
    const { batchNormalizeGeographyWithCoordinates } = require('../services/mapsAgent');
    const normalizedGeoData = await batchNormalizeGeographyWithCoordinates(geoData);

    // ✅ MANEJAR MÚLTIPLES UBICACIONES: Puede haber más resultados que inputs originales
    const insertData = [];
    
    // Agrupar resultados normalizados por índice original
    const resultsByOriginalIndex = {};
    normalizedGeoData.forEach(normalized => {
      const originalIndex = normalized._originalIndex || 0;
      if (!resultsByOriginalIndex[originalIndex]) {
        resultsByOriginalIndex[originalIndex] = [];
      }
      resultsByOriginalIndex[originalIndex].push(normalized);
    });
    
    // Crear cards: una card por cada ubicación normalizada
    initialData.forEach((card, index) => {
      const normalizedForThisCard = resultsByOriginalIndex[index] || [{}];
      
      normalizedForThisCard.forEach((normalized, subIndex) => {
        const cardWithGeo = {
          ...card,
          city: normalized.city || card.city,
          department: normalized.department || card.department,
          pais: normalized.pais || card.pais,
          coordinates: normalized.coordinates || null, // ✅ INCLUIR COORDENADAS
          // Agregar metadatos de detección como campos internos (no se guardan en DB)
          _detection_method: normalized.detection_method || 'original',
          _confidence: normalized.confidence || 'medium',
          _reasoning: normalized.reasoning || 'Sin normalización geográfica',
          _geocoded: normalized.geocoded || false,
          _isMultiLocation: normalized._isMultiLocation || false,
          _multiType: normalized._multiType || null,
          _locationIndex: subIndex // Para diferenciar múltiples ubicaciones de la misma card
        };
        
        insertData.push(cardWithGeo);
      });
    });

    console.log(`✅ Normalización geográfica completada para ${insertData.length} hallazgos (incluyendo múltiples ubicaciones)`);
    
    // Log resumen de detecciones
    const detectionStats = {
      original_cards: initialData.length,
      final_cards: insertData.length,
      expansion_factor: (insertData.length / initialData.length).toFixed(2),
      mapsAgent_detections: insertData.filter(c => c._detection_method === 'mapsAgent').length,
      mapsAgent_multi_detections: insertData.filter(c => c._detection_method === 'mapsAgent_multi').length,
      ai_detections: insertData.filter(c => c._detection_method === 'ai').length,
      manual_detections: insertData.filter(c => c._detection_method === 'manual').length,
      geocoded_locations: insertData.filter(c => c._geocoded).length,
      with_coordinates: insertData.filter(c => c.coordinates).length,
      multi_location_cards: insertData.filter(c => c._isMultiLocation).length,
      multi_departments: insertData.filter(c => c._multiType === 'departments').length,
      multi_municipalities: insertData.filter(c => c._multiType === 'municipalities').length
    };
    
    console.log(`📊 Estadísticas de detección:`, detectionStats);

    // Limpiar metadatos antes de insertar (manteniendo coordinates)
    const cleanInsertData = insertData.map(card => {
      const { 
        _detection_method, 
        _confidence, 
        _reasoning, 
        _geocoded, 
        _isMultiLocation, 
        _multiType, 
        _locationIndex, 
        _originalIndex,
        ...cleanCard 
      } = card;
      return cleanCard;
    });

    // =============================================
    // VINCULAR CADA CARD A SU COVERAGE (coverage_id)
    // =============================================

    async function getOrCreateCoverage({ projectId, city, department, pais }) {
      // Normalizar usando mapsAgent
      const norm = normalizeGeographicInfoSync({ city, department, pais });
      city = norm.city;
      department = norm.department;
      pais = norm.pais;
      // Prioridad: ciudad > departamento > país
      let coverageRow = null;
      if (city) {
        const { data } = await supabase
          .from('project_coverages')
          .select('id')
          .eq('project_id', projectId)
          .eq('coverage_type', 'ciudad')
          .eq('name', city.trim())
          .eq('parent_name', department ? department.trim() : '')
          .single();
        coverageRow = data || null;
        if (!coverageRow && department) {
          // Crear ciudad bajo departamento existente o país
          const newCoverage = {
            project_id: projectId,
            coverage_type: 'ciudad',
            name: city.trim(),
            parent_name: department.trim(),
            description: `Cobertura municipal generada al crear tarjeta capturado`,
            detection_source: 'ai_detection',
            confidence_score: 0.9,
            local_name: 'Municipio'
          };
          const { data: inserted } = await supabase
            .from('project_coverages')
            .upsert(newCoverage, { onConflict: 'project_id,coverage_type,name,parent_name', ignoreDuplicates: false })
            .select('id')
            .single();
          coverageRow = inserted;
        }
      }

      if (!coverageRow && department) {
        const { data } = await supabase
          .from('project_coverages')
          .select('id')
          .eq('project_id', projectId)
          .eq('coverage_type', 'departamento')
          .eq('name', department.trim())
          .single();
        coverageRow = data || null;
        if (!coverageRow) {
          const newCoverage = {
            project_id: projectId,
            coverage_type: 'departamento',
            name: department.trim(),
            parent_name: pais || 'Guatemala',
            description: `Cobertura departamental generada al crear tarjeta capturado`,
            detection_source: 'ai_detection',
            confidence_score: 0.85,
            local_name: 'Departamento'
          };
          const { data: inserted } = await supabase
            .from('project_coverages')
            .upsert(newCoverage, { onConflict: 'project_id,coverage_type,name,parent_name', ignoreDuplicates: false })
            .select('id')
            .single();
          coverageRow = inserted;
        }
      }

      if (!coverageRow && pais) {
        const { data } = await supabase
          .from('project_coverages')
          .select('id')
          .eq('project_id', projectId)
          .eq('coverage_type', 'pais')
          .eq('name', pais.trim())
          .single();
        coverageRow = data || null;
        if (!coverageRow) {
          const newCoverage = {
            project_id: projectId,
            coverage_type: 'pais',
            name: pais.trim(),
            description: `Cobertura nacional generada al crear tarjeta capturado`,
            detection_source: 'ai_detection',
            confidence_score: 1.0,
            local_name: 'País'
          };
          const { data: inserted } = await supabase
            .from('project_coverages')
            .upsert(newCoverage, { onConflict: 'project_id,coverage_type,name,parent_name', ignoreDuplicates: false })
            .select('id')
            .single();
          coverageRow = inserted;
        }
      }
      return coverageRow ? coverageRow.id : null;
    }

    // Añadir coverage_id a cada card antes de insertar
    for (const card of cleanInsertData) {
      try {
        const coverageId = await getOrCreateCoverage({
          projectId,
          city: card.city,
          department: card.department,
          pais: card.pais
        });
        card.coverage_id = coverageId;
      } catch (covErr) {
        console.error('⚠️ No se pudo vincular coverage para card:', covErr.message);
      }
    }

    // Log de los datos antes de insertar para debug
    console.log(`🔍 Insertando ${cleanInsertData.length} cards con datos:`, cleanInsertData.slice(0, 2).map(card => ({
      coverage_id: card.coverage_id,
      duration_days: card.duration_days,
      item_count: card.item_count,
      amount: card.amount
    })));

    const { data: inserted, error: insertError } = await supabase
      .from('capturado_cards')
      .insert(cleanInsertData)
      .select();

    if (insertError) {
      console.error(`❌ Error en inserción - Datos problemáticos:`, cleanInsertData.slice(0, 2));
      throw new Error(`Error insertando capturado_cards: ${insertError.message}`);
    }

    return inserted;

  } catch (geoError) {
    console.error(`⚠️ Error en normalización geográfica:`, geoError.message);
    console.log(`🔄 Continuando con fallback manual...`);
    
    // Fallback: usar normalización manual para todas las cards
    const { batchNormalizeGeography: manualBatch } = require('../utils/guatemala-geography');
    const insertData = initialData.map(card => {
      const manualNormalized = manualNormalize({
        city: card.city,
        department: card.department,
        pais: card.pais
      });
      
      return {
        ...card,
        city: manualNormalized.city,
        department: manualNormalized.department,
        pais: manualNormalized.pais
      };
    });

    // =============================================
    // AGREGAR COVERAGE_ID TAMBIÉN EN EL FALLBACK
    // =============================================
    async function getOrCreateCoverageFallback({ projectId, city, department, pais }) {
      // Normalizar usando mapsAgent
      const norm = normalizeGeographicInfoSync({ city, department, pais });
      city = norm.city;
      department = norm.department;
      pais = norm.pais;
      // Misma lógica que la función principal
      let coverageRow = null;
      if (city) {
        const { data } = await supabase
          .from('project_coverages')
          .select('id')
          .eq('project_id', projectId)
          .eq('coverage_type', 'ciudad')
          .eq('name', city.trim())
          .eq('parent_name', department ? department.trim() : '')
          .single();
        coverageRow = data || null;
        if (!coverageRow && department) {
          const newCoverage = {
            project_id: projectId,
            coverage_type: 'ciudad',
            name: city.trim(),
            parent_name: department.trim(),
            description: `Cobertura municipal generada al crear tarjeta capturado (fallback)`,
            detection_source: 'ai_detection',
            confidence_score: 0.9,
            local_name: 'Municipio'
          };
          const { data: inserted } = await supabase
            .from('project_coverages')
            .upsert(newCoverage, { onConflict: 'project_id,coverage_type,name,parent_name', ignoreDuplicates: false })
            .select('id')
            .single();
          coverageRow = inserted;
        }
      }

      if (!coverageRow && department) {
        const { data } = await supabase
          .from('project_coverages')
          .select('id')
          .eq('project_id', projectId)
          .eq('coverage_type', 'departamento')
          .eq('name', department.trim())
          .single();
        coverageRow = data || null;
        if (!coverageRow) {
          const newCoverage = {
            project_id: projectId,
            coverage_type: 'departamento',
            name: department.trim(),
            parent_name: pais || 'Guatemala',
            description: `Cobertura departamental generada al crear tarjeta capturado (fallback)`,
            detection_source: 'ai_detection',
            confidence_score: 0.85,
            local_name: 'Departamento'
          };
          const { data: inserted } = await supabase
            .from('project_coverages')
            .upsert(newCoverage, { onConflict: 'project_id,coverage_type,name,parent_name', ignoreDuplicates: false })
            .select('id')
            .single();
          coverageRow = inserted;
        }
      }

      if (!coverageRow && pais) {
        const { data } = await supabase
          .from('project_coverages')
          .select('id')
          .eq('project_id', projectId)
          .eq('coverage_type', 'pais')
          .eq('name', pais.trim())
          .single();
        coverageRow = data || null;
        if (!coverageRow) {
          const newCoverage = {
            project_id: projectId,
            coverage_type: 'pais',
            name: pais.trim(),
            description: `Cobertura nacional generada al crear tarjeta capturado (fallback)`,
            detection_source: 'ai_detection',
            confidence_score: 1.0,
            local_name: 'País'
          };
          const { data: inserted } = await supabase
            .from('project_coverages')
            .upsert(newCoverage, { onConflict: 'project_id,coverage_type,name,parent_name', ignoreDuplicates: false })
            .select('id')
            .single();
          coverageRow = inserted;
        }
      }
      return coverageRow ? coverageRow.id : null;
    }

    // Añadir coverage_id a cada card en el fallback también
    for (const card of insertData) {
      try {
        const coverageId = await getOrCreateCoverageFallback({
          projectId,
          city: card.city,
          department: card.department,
          pais: card.pais
        });
        card.coverage_id = coverageId;
      } catch (covErr) {
        console.error('⚠️ No se pudo vincular coverage para card en fallback:', covErr.message);
      }
    }

    // Log de los datos antes de insertar en fallback para debug
    console.log(`🔍 Fallback insertando ${insertData.length} cards con datos:`, insertData.slice(0, 2).map(card => ({
      coverage_id: card.coverage_id,
      duration_days: card.duration_days,
      item_count: card.item_count,
      amount: card.amount
    })));

    const { data: inserted, error: insertError } = await supabase
      .from('capturado_cards')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error(`❌ Error en inserción fallback - Datos problemáticos:`, insertData.slice(0, 2));
      throw new Error(`Error insertando capturado_cards con fallback: ${insertError.message}`);
    }

    return inserted;
  }
}

/**
 * Procesa todos los codex_items con contenido analizable que aún no tengan capturado_cards
 * Tipos soportados:
 * - Audio/Video: Con transcripción en audio_transcription
 * - Enlaces/Videos: Con transcripción en transcripcion
 * - Documentos: Con análisis en document_analysis o para análisis automático
 * - Enlaces básicos: Con descripción/análisis en descripcion
 * @param {string} projectId - ID del proyecto
 * @param {string} userId - ID del usuario (requerido para análisis automático de documentos)
 * @param {string[]} [codexItemIds] - Opcional: Array de IDs de codex_items a procesar. Si no se provee, procesa todos los pendientes.
 */
async function bulkCreateCardsForProject(projectId, userId, codexItemIds) {
  console.log(`🔍 Iniciando bulk processing para proyecto: ${projectId}`);
  
  let query = supabase
    .from('codex_items')
    .select('id, tipo, titulo, audio_transcription, transcripcion, document_analysis, descripcion, url, storage_path')
    .eq('project_id', projectId);

  // Si se especifican IDs, solo procesar esos.
  if (codexItemIds && codexItemIds.length > 0) {
    console.log(`🎯 Procesando ${codexItemIds.length} items específicos.`);
    query = query.in('id', codexItemIds);
  } else {
    // Comportamiento original: buscar todos los analizables que no han sido capturados.
    console.log('📋 Procesando todos los items pendientes del proyecto.');
    const { data: rowsCaptured } = await supabase
      .from('capturado_cards')
      .select('codex_item_id')
      .eq('project_id', projectId);
    const capturedIds = (rowsCaptured || []).map(r => r.codex_item_id);
    
    if (capturedIds.length > 0) {
      query = query.not('id', 'in', `(${capturedIds.join(',')})`);
    }

    query = query.or('audio_transcription.not.is.null,transcripcion.not.is.null,document_analysis.not.is.null,and(tipo.eq.enlace,descripcion.not.is.null),and(tipo.eq.documento,storage_path.not.is.null)');
  }

  const { data: allItems, error: errorAllItems } = await query;
  
  if (errorAllItems) {
    console.error('❌ Error obteniendo todos los items:', errorAllItems);
    throw errorAllItems;
  }
  
  console.log(`📋 Items a procesar: ${allItems?.length || 0}`);
  
  const pendingItems = allItems;

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