const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const supabase = require('../utils/supabase');

// Configurar Gemini
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TEMP_DIR = '/tmp/document_analysis';
const SUPPORTED_DOCUMENT_FORMATS = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];

// Crear directorio temporal si no existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Detecta si el archivo es un documento analizable
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - 'document', 'image', o 'unsupported'
 */
function detectDocumentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (SUPPORTED_DOCUMENT_FORMATS.includes(ext)) {
    return 'document';
  } else if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
    return 'image';
  }
  
  return 'unsupported';
}

/**
 * Extrae texto de un archivo PDF usando pdf-parse
 * @param {string} pdfPath - Ruta del archivo PDF
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextFromPDF(pdfPath) {
  try {
    console.log(`📄 Extrayendo texto de PDF: ${pdfPath}`);
    
    // Intentar usar pdf-parse primero
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    
    const extractedText = pdfData.text;
    console.log(`✅ Texto extraído del PDF: ${extractedText.length} caracteres, ${pdfData.numpages} páginas`);
    
    if (extractedText.trim().length < 100) {
      console.warn('⚠️ PDF con poco texto, puede contener imágenes');
      throw new Error('PDF_REQUIRES_OCR');
    }
    
    return {
      text: extractedText,
      metadata: {
        pages: pdfData.numpages,
        method: 'pdf-parse'
      }
    };
    
  } catch (error) {
    console.error('❌ Error extrayendo texto de PDF:', error.message);
    
    // Si pdf-parse falla, intentar OCR como fallback
    if (error.message === 'PDF_REQUIRES_OCR') {
      console.log('🔍 Intentando OCR para PDF con imágenes...');
      return await extractTextWithOCR(pdfPath, 'pdf');
    }
    
    throw new Error(`Error al extraer texto del PDF: ${error.message}`);
  }
}

/**
 * Extrae texto de un archivo Word usando mammoth
 * @param {string} docPath - Ruta del archivo Word
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextFromWord(docPath) {
  try {
    console.log(`📝 Extrayendo texto de Word: ${docPath}`);
    
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: docPath });
    
    console.log(`✅ Texto extraído de Word: ${result.value.length} caracteres`);
    
    return {
      text: result.value,
      metadata: {
        method: 'mammoth',
        warnings: result.messages
      }
    };
    
  } catch (error) {
    console.error('❌ Error extrayendo texto de Word:', error);
    throw new Error(`Error al extraer texto del documento Word: ${error.message}`);
  }
}

/**
 * Extrae texto de un archivo de texto plano
 * @param {string} textPath - Ruta del archivo de texto
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextFromPlainText(textPath) {
  try {
    console.log(`📃 Leyendo archivo de texto: ${textPath}`);
    
    const content = fs.readFileSync(textPath, 'utf8');
    
    console.log(`✅ Texto leído: ${content.length} caracteres`);
    
    return {
      text: content,
      metadata: {
        method: 'direct-read',
        encoding: 'utf8'
      }
    };
    
  } catch (error) {
    console.error('❌ Error leyendo archivo de texto:', error);
    throw new Error(`Error al leer el archivo de texto: ${error.message}`);
  }
}

/**
 * Extrae texto usando OCR para imágenes o PDFs complejos
 * @param {string} imagePath - Ruta del archivo de imagen
 * @param {string} type - Tipo de archivo ('image' o 'pdf')
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextWithOCR(imagePath, type = 'image') {
  try {
    console.log(`🔍 Extrayendo texto con OCR: ${imagePath}`);
    
    // Usar Tesseract.js para OCR
    const Tesseract = require('tesseract.js');
    
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'spa', // Español
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progreso: ${(m.progress * 100).toFixed(1)}%`);
          }
        }
      }
    );
    
    console.log(`✅ Texto extraído con OCR: ${text.length} caracteres`);
    
    return {
      text: text,
      metadata: {
        method: 'tesseract-ocr',
        language: 'spa',
        type: type
      }
    };
    
  } catch (error) {
    console.error('❌ Error en OCR:', error);
    throw new Error(`Error al extraer texto con OCR: ${error.message}`);
  }
}

/**
 * Prepara el texto del documento para análisis
 * @param {string} inputPath - Ruta del archivo original
 * @returns {Promise<{text: string, metadata: Object}>}
 */
async function prepareDocumentText(inputPath) {
  const docType = detectDocumentType(inputPath);
  
  if (docType === 'unsupported') {
    throw new Error(`Formato de archivo no soportado. Formatos soportados: ${[...SUPPORTED_DOCUMENT_FORMATS, ...SUPPORTED_IMAGE_FORMATS].join(', ')}`);
  }
  
  const ext = path.extname(inputPath).toLowerCase();
  
  // Extraer texto según el formato
  if (ext === '.pdf') {
    return await extractTextFromPDF(inputPath);
  } else if (['.doc', '.docx'].includes(ext)) {
    return await extractTextFromWord(inputPath);
  } else if (['.txt', '.rtf'].includes(ext)) {
    return await extractTextFromPlainText(inputPath);
  } else if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
    return await extractTextWithOCR(inputPath, 'image');
  }
  
  throw new Error(`Formato no implementado: ${ext}`);
}

/**
 * Fragmenta texto largo en chunks manejables
 * @param {string} text - Texto completo
 * @param {number} maxChunkSize - Tamaño máximo del chunk en caracteres
 * @returns {Array<string>} - Array de fragmentos
 */
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
  
  console.log(`📄 Texto fragmentado en ${chunks.length} chunks (promedio: ${Math.round(text.length / chunks.length)} chars por chunk)`);
  
  return chunks;
}

/**
 * Analiza un fragmento de texto con Gemini AI
 * @param {string} textChunk - Fragmento de texto
 * @param {Object} options - Opciones de análisis
 * @returns {Promise<Object>} - Resultado del análisis
 */
async function analyzeTextChunkWithGemini(textChunk, options = {}) {
  try {
    console.log(`🧠 Analizando chunk con Gemini: ${textChunk.length} caracteres`);
    
    // Configurar modelo Gemini
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Prompt personalizado para análisis de documentos
    const prompt = options.prompt || `
    Analiza este documento en español y extrae información relevante y hallazgos importantes.
    
    OBJETIVO: Identificar y extraer información clave que sería valiosa para un periodista o investigador.
    
    TIPOS DE INFORMACIÓN A EXTRAER:
    
    🔍 HALLAZGOS INVESTIGATIVOS:
    - Irregularidades, corrupción, malversación
    - Gastos excesivos, proyectos fallidos
    - Violaciones de procedimientos
    - Evidencias de mala gestión
    
    📊 DATOS IMPORTANTES:
    - Cifras monetarias significativas
    - Estadísticas relevantes
    - Fechas importantes, plazos
    - Cantidades, métricas, indicadores
    
    👥 ACTORES CLAVE:
    - Personas involucradas (nombres, cargos)
    - Instituciones mencionadas
    - Empresas, organizaciones
    - Responsables de decisiones
    
    📍 CONTEXTO GEOGRÁFICO Y TEMPORAL:
    - Ubicaciones específicas
    - Períodos de tiempo
    - Eventos o hitos relevantes
    
    🎯 DECISIONES Y POLÍTICAS:
    - Resoluciones importantes
    - Cambios de normativa
    - Aprobaciones o rechazos
    - Compromisos adquiridos
    
    FORMATO DE RESPUESTA:
    Devuelve un JSON con esta estructura exacta:
    {
      "hallazgos": [
        {
          "tipo": "irregularidad|dato_importante|actor_clave|decision|evento",
          "titulo": "Título corto del hallazgo (máximo 60 caracteres)",
          "descripcion": "Descripción detallada (máximo 200 caracteres)",
          "entidad": "Persona, institución o empresa involucrada (si aplica)",
          "monto": "Cantidad de dinero relevante como número (si aplica)",
          "moneda": "GTQ|USD|EUR (si aplica)",
          "cantidad": "Número de unidades si es conteo (obras, casos, etc.)",
          "ubicacion": "Ciudad, departamento o lugar (si aplica)",
          "fecha": "YYYY-MM-DD (si aplica)",
          "fuente": "Extracto textual de máximo 120 caracteres",
          "relevancia": "alta|media|baja",
          "categoria": "corrupcion|gestion|finanzas|social|politica|legal|otro"
        }
      ],
      "resumen": "Resumen ejecutivo del fragmento analizado (máximo 300 caracteres)",
      "palabras_clave": ["lista", "de", "palabras", "clave", "extraídas"],
      "metadatos": {
        "fragmento_numero": 1,
        "caracteres_analizados": ${textChunk.length},
        "hallazgos_encontrados": 0
      }
    }
    
    Si no hay información relevante que extraer, devuelve la estructura con arrays vacíos.
    
    TEXTO A ANALIZAR:
    """
    ${textChunk}
    """
    `;
    
    console.log(`🎯 Enviando chunk a Gemini (${textChunk.length} caracteres)...`);
    
    // Llamar a Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Intentar parsear como JSON
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('⚠️ Respuesta no es JSON válido, intentando extraer...');
      // Buscar JSON dentro del texto
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se pudo extraer JSON válido de la respuesta');
      }
    }
    
    console.log(`✅ Análisis completado: ${analysis.hallazgos?.length || 0} hallazgos encontrados`);
    
    return {
      analysis: analysis,
      metadata: {
        model: 'gemini-2.0-flash-exp',
        timestamp: new Date().toISOString(),
        inputLength: textChunk.length,
        responseLength: responseText.length
      }
    };
    
  } catch (error) {
    console.error('❌ Error en análisis con Gemini:', error);
    throw new Error(`Error al analizar con Gemini: ${error.message}`);
  }
}

/**
 * Consolidar resultados de múltiples fragmentos
 * @param {Array} fragmentResults - Array de resultados de análisis
 * @returns {Object} - Resultado consolidado
 */
function consolidateAnalysisResults(fragmentResults) {
  console.log(`📊 Consolidando ${fragmentResults.length} fragmentos analizados...`);
  
  const consolidatedHallazgos = [];
  const consolidatedPalabrasClave = new Set();
  let totalCaracteres = 0;
  let totalHallazgos = 0;
  
  fragmentResults.forEach((fragmentResult, index) => {
    const analysis = fragmentResult.analysis;
    
    // Agregar hallazgos con número de fragmento
    if (analysis.hallazgos && Array.isArray(analysis.hallazgos)) {
      analysis.hallazgos.forEach(hallazgo => {
        consolidatedHallazgos.push({
          ...hallazgo,
          fragmento_numero: index + 1
        });
      });
      totalHallazgos += analysis.hallazgos.length;
    }
    
    // Consolidar palabras clave
    if (analysis.palabras_clave && Array.isArray(analysis.palabras_clave)) {
      analysis.palabras_clave.forEach(palabra => {
        consolidatedPalabrasClave.add(palabra.toLowerCase());
      });
    }
    
    // Sumar caracteres analizados
    totalCaracteres += fragmentResult.metadata.inputLength;
  });
  
  // Crear resumen consolidado
  const resumenGeneral = `Análisis completo de documento: ${totalHallazgos} hallazgos encontrados en ${fragmentResults.length} fragmentos. ${totalCaracteres} caracteres procesados.`;
  
  console.log(`✅ Consolidación completada: ${totalHallazgos} hallazgos, ${consolidatedPalabrasClave.size} palabras clave únicas`);
  
  return {
    hallazgos: consolidatedHallazgos,
    resumen_general: resumenGeneral,
    palabras_clave: Array.from(consolidatedPalabrasClave),
    estadisticas: {
      fragmentos_procesados: fragmentResults.length,
      caracteres_totales: totalCaracteres,
      hallazgos_totales: totalHallazgos,
      palabras_clave_unicas: consolidatedPalabrasClave.size
    },
    metadatos: {
      modelo_usado: 'gemini-2.0-flash-exp',
      fecha_analisis: new Date().toISOString(),
      fragmentos_detalle: fragmentResults.map(fr => fr.metadata)
    }
  };
}

/**
 * Guarda el análisis de documento en Supabase
 * @param {Object} analysisResult - Resultado del análisis
 * @param {string} originalFilePath - Ruta del archivo original
 * @param {string} userId - ID del usuario
 * @param {Object} metadata - Metadatos adicionales
 * @param {Object} supabaseClient - Cliente de Supabase autenticado
 * @param {string} updateItemId - ID del item existente para UPDATE (opcional)
 * @returns {Promise<Object>} - Datos del item guardado
 */
async function saveDocumentAnalysisToCodex(
  analysisResult,
  originalFilePath,
  userId,
  metadata = {},
  supabaseClient = supabase,
  updateItemId = null
) {
  try {
    console.log(`💾 Guardando análisis de documento en Codex para usuario: ${userId}`);
    
    const originalFileName = path.basename(originalFilePath);
    const originalFileType = detectDocumentType(originalFilePath);
    
    // Convertir análisis a texto legible para almacenar
    const analysisText = [
      `ANÁLISIS DE DOCUMENTO: ${originalFileName}`,
      `=====================================`,
      '',
      `RESUMEN: ${analysisResult.resumen_general}`,
      '',
      `ESTADÍSTICAS:`,
      `- Fragmentos procesados: ${analysisResult.estadisticas.fragmentos_procesados}`,
      `- Caracteres analizados: ${analysisResult.estadisticas.caracteres_totales}`,
      `- Hallazgos encontrados: ${analysisResult.estadisticas.hallazgos_totales}`,
      `- Palabras clave únicas: ${analysisResult.estadisticas.palabras_clave_unicas}`,
      '',
      `PALABRAS CLAVE: ${analysisResult.palabras_clave.join(', ')}`,
      '',
      `HALLAZGOS DETALLADOS:`,
      `=====================`,
      ''
    ];
    
    // Agregar cada hallazgo
    analysisResult.hallazgos.forEach((hallazgo, index) => {
      analysisText.push(`${index + 1}. ${hallazgo.titulo}`);
      analysisText.push(`   Tipo: ${hallazgo.tipo}`);
      analysisText.push(`   Descripción: ${hallazgo.descripcion}`);
      if (hallazgo.entidad) analysisText.push(`   Entidad: ${hallazgo.entidad}`);
      if (hallazgo.monto) analysisText.push(`   Monto: ${hallazgo.monto} ${hallazgo.moneda || ''}`);
      if (hallazgo.cantidad) analysisText.push(`   Cantidad: ${hallazgo.cantidad}`);
      if (hallazgo.ubicacion) analysisText.push(`   Ubicación: ${hallazgo.ubicacion}`);
      if (hallazgo.fecha) analysisText.push(`   Fecha: ${hallazgo.fecha}`);
      analysisText.push(`   Relevancia: ${hallazgo.relevancia}`);
      analysisText.push(`   Categoría: ${hallazgo.categoria}`);
      analysisText.push(`   Fuente: "${hallazgo.fuente}"`);
      analysisText.push(`   Fragmento: ${hallazgo.fragmento_numero}`);
      analysisText.push('');
    });
    
    const analysisTextFinal = analysisText.join('\n');
    
    // Datos comunes para INSERT o UPDATE
    const codexItemData = {
      user_id: userId,
      tipo: 'documento', // Mantener como documento
      titulo: metadata.titulo || `Análisis: ${originalFileName}`,
      descripcion: metadata.descripcion || `Análisis automático de documento con ${analysisResult.estadisticas.hallazgos_totales} hallazgos encontrados. Procesado con Gemini AI.`,
      etiquetas: [
        'analisis-documento',
        'gemini-ai',
        'hallazgos',
        ...(metadata.etiquetas || [])
      ],
      proyecto: metadata.proyecto || 'Análisis de Documentos',
      project_id: metadata.project_id || null,
      storage_path: null,
      url: null,
      nombre_archivo: `${originalFileName}.analisis.txt`,
      tamano: analysisTextFinal.length,
      fecha: new Date().toISOString().split('T')[0],
      // Guardar el análisis en la nueva columna
      document_analysis: analysisTextFinal
    };
    
    let codexData, codexError;
    if (updateItemId) {
      console.log(`📝 Actualizando item existente ${updateItemId} con análisis...`);
      ({ data: codexData, error: codexError } = await supabaseClient
        .from('codex_items')
        .update({
          document_analysis: codexItemData.document_analysis,
          descripcion: codexItemData.descripcion,
          nombre_archivo: codexItemData.nombre_archivo,
          etiquetas: codexItemData.etiquetas
        })
        .eq('id', updateItemId)
        .select()
        .single());
    } else {
      console.log(`📝 Creando registro con análisis de ${analysisTextFinal.length} caracteres...`);
      ({ data: codexData, error: codexError } = await supabaseClient
        .from('codex_items')
        .insert([codexItemData])
        .select()
        .single());
    }
    
    if (codexError) {
      console.error('❌ Error insertando en codex_items:', codexError);
      throw codexError;
    }
    
    console.log(`✅ Análisis guardado en codex_items id: ${codexData.id}`);
    
    return {
      codexItem: codexData,
      analysisResult: analysisResult,
      analysisText: analysisTextFinal
    };
    
  } catch (error) {
    console.error('❌ Error guardando análisis en Codex:', error);
    throw new Error(`Error al guardar análisis: ${error.message}`);
  }
}

/**
 * Función principal para analizar documentos
 * @param {string} filePath - Ruta del archivo a analizar
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de análisis
 * @returns {Promise<Object>} - Resultado completo del análisis
 */
async function analyzeDocument(filePath, userId, options = {}) {
  const spClient = options.supabaseClient || supabase;
  const updateItemId = options.updateItemId || null;
  
  try {
    console.log(`📄 Iniciando proceso de análisis de documento: ${filePath}`);
    
    // Extraer texto del documento
    const { text, metadata: extractionMetadata } = await prepareDocumentText(filePath);
    
    if (text.trim().length < 100) {
      throw new Error('El documento contiene muy poco texto para analizar');
    }
    
    // Fragmentar texto para documentos largos
    const textChunks = fragmentText(text, 8000);
    console.log(`📊 Documento fragmentado en ${textChunks.length} partes`);
    
    // Analizar cada fragmento
    const fragmentResults = [];
    for (let i = 0; i < textChunks.length; i++) {
      console.log(`🔍 Procesando fragmento ${i + 1}/${textChunks.length}...`);
      
      const result = await analyzeTextChunkWithGemini(textChunks[i], {
        ...options,
        fragmentNumber: i + 1,
        totalFragments: textChunks.length
      });
      
      // Actualizar metadatos del fragmento
      result.analysis.metadatos = {
        ...result.analysis.metadatos,
        fragmento_numero: i + 1
      };
      
      fragmentResults.push(result);
      
      // Pausa breve entre fragmentos para evitar rate limiting
      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Consolidar resultados
    const consolidatedAnalysis = consolidateAnalysisResults(fragmentResults);
    
    // Guardar en Codex
    const saveResult = await saveDocumentAnalysisToCodex(
      consolidatedAnalysis,
      filePath,
      userId,
      options,
      spClient,
      updateItemId
    );
    
    return {
      success: true,
      analysis: consolidatedAnalysis,
      extractionMetadata: extractionMetadata,
      codexItem: saveResult.codexItem,
      message: `Análisis completado exitosamente. ${consolidatedAnalysis.estadisticas.hallazgos_totales} hallazgos encontrados en ${consolidatedAnalysis.estadisticas.fragmentos_procesados} fragmentos.`
    };
    
  } catch (error) {
    console.error('❌ Error en proceso de análisis de documento:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error durante el proceso de análisis de documento'
    };
  }
}

module.exports = {
  analyzeDocument,
  detectDocumentType,
  prepareDocumentText,
  SUPPORTED_DOCUMENT_FORMATS,
  SUPPORTED_IMAGE_FORMATS
}; 