const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const supabase = require('../utils/supabase');

const execAsync = promisify(exec);

// Configurar Gemini
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TEMP_DIR = '/tmp/audio_transcriptions';
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a'];
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.m4v'];

// Crear directorio temporal si no existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Detecta si el archivo es de audio o video
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - 'audio', 'video', o 'unsupported'
 */
function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (SUPPORTED_AUDIO_FORMATS.includes(ext)) {
    return 'audio';
  } else if (SUPPORTED_VIDEO_FORMATS.includes(ext)) {
    return 'video';
  }
  
  return 'unsupported';
}

/**
 * Extrae audio de un archivo de video usando ffmpeg
 * @param {string} videoPath - Ruta del archivo de video
 * @returns {Promise<string>} - Ruta del archivo de audio extraído
 */
async function extractAudioFromVideo(videoPath) {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const audioPath = path.join(TEMP_DIR, `${videoName}_${Date.now()}.wav`);
  
  console.log(`🎵 Extrayendo audio de video: ${videoPath}`);
  
  // Comando ffmpeg para extraer audio optimizado para transcripción
  const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -ac 1 -ar 16000 -y "${audioPath}"`;
  
  try {
    await execAsync(ffmpegCommand);
    console.log(`✅ Audio extraído exitosamente: ${audioPath}`);
    return audioPath;
  } catch (error) {
    console.error('❌ Error extrayendo audio:', error);
    throw new Error(`Error al extraer audio del video: ${error.message}`);
  }
}

/**
 * Prepara el archivo de audio para transcripción
 * @param {string} inputPath - Ruta del archivo original
 * @returns {Promise<{audioPath: string, isTemporary: boolean}>}
 */
async function prepareAudioFile(inputPath) {
  const fileType = detectFileType(inputPath);
  
  if (fileType === 'unsupported') {
    throw new Error(`Formato de archivo no soportado. Formatos soportados: ${[...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS].join(', ')}`);
  }
  
  if (fileType === 'video') {
    // Extraer audio del video
    const audioPath = await extractAudioFromVideo(inputPath);
    return { audioPath, isTemporary: true };
  } else {
    // Es un archivo de audio, usar directamente
    return { audioPath: inputPath, isTemporary: false };
  }
}

/**
 * Transcriben archivo de audio usando Gemini AI
 * @param {string} audioPath - Ruta del archivo de audio
 * @param {Object} options - Opciones de transcripción
 * @returns {Promise<Object>} - Resultado de la transcripción
 */
async function transcribeWithGemini(audioPath, options = {}) {
  try {
    console.log(`🧠 Iniciando transcripción con Gemini: ${audioPath}`);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Archivo de audio no encontrado: ${audioPath}`);
    }
    
    // Leer archivo de audio
    const audioData = fs.readFileSync(audioPath);
    const audioSize = (audioData.length / 1024 / 1024).toFixed(2); // MB
    console.log(`📁 Tamaño del archivo: ${audioSize} MB`);
    
    // Configurar modelo Gemini
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Preparar prompt personalizado
    const prompt = options.prompt || `
    Genera una transcripción detallada y precisa de este audio en español.
    
    Instrucciones:
    - Incluye puntuación apropiada
    - Separa en párrafos lógicos
    - Indica [PAUSA] para silencios largos
    - Indica [INAUDIBLE] si no se entiende algo
    - Mantén el tono y estilo del hablante
    - Si hay múltiples hablantes, diferéncialos como "Hablante 1:", "Hablante 2:", etc.
    
    Devuelve solo la transcripción, sin comentarios adicionales.
    `;
    
    // Determinar tipo MIME del audio
    const audioExt = path.extname(audioPath).toLowerCase();
    let mimeType = 'audio/wav'; // Por defecto
    
    switch (audioExt) {
      case '.mp3': mimeType = 'audio/mp3'; break;
      case '.wav': mimeType = 'audio/wav'; break;
      case '.aac': mimeType = 'audio/aac'; break;
      case '.ogg': mimeType = 'audio/ogg'; break;
      case '.flac': mimeType = 'audio/flac'; break;
      case '.m4a': mimeType = 'audio/m4a'; break;
    }
    
    console.log(`🎯 Enviando a Gemini (${mimeType}, ${audioSize} MB)...`);
    
    // Llamar a Gemini
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: audioData.toString('base64')
        }
      }
    ]);
    
    const transcription = result.response.text();
    
    console.log(`✅ Transcripción completada: ${transcription.length} caracteres`);
    
    return {
      transcription: transcription,
      metadata: {
        originalFile: path.basename(audioPath),
        fileSize: audioSize,
        mimeType: mimeType,
        model: 'gemini-2.0-flash-exp',
        timestamp: new Date().toISOString(),
        charactersCount: transcription.length,
        wordsCount: transcription.split(' ').length
      }
    };
    
  } catch (error) {
    console.error('❌ Error en transcripción con Gemini:', error);
    throw new Error(`Error al transcribir con Gemini: ${error.message}`);
  }
}

/**
 * Guarda la transcripción en Supabase Storage y crea registro en codex_items
 * @param {Object} transcriptionResult - Resultado de la transcripción
 * @param {string} originalFilePath - Ruta del archivo original
 * @param {string} userId - ID del usuario
 * @param {Object} metadata - Metadatos adicionales
 * @param {Object} supabaseClient - Cliente de Supabase autenticado
 * @param {string} updateItemId - ID del item existente para UPDATE (opcional)
 * @returns {Promise<Object>} - Datos del item guardado
 */
async function saveTranscriptionToCodex(
  transcriptionResult,
  originalFilePath,
  userId,
  metadata = {},
  supabaseClient = supabase,
  updateItemId = null
) {
  try {
    console.log(`💾 Guardando transcripción en Codex para usuario: ${userId}`);
    
    const originalFileName = path.basename(originalFilePath);
    const originalFileType = detectFileType(originalFilePath);
    
    // Datos comunes para INSERT o UPDATE
    const codexItemData = {
      user_id: userId,
      // Usamos el mismo tipo del archivo original para cumplir con RLS (audio|video)
      tipo: originalFileType,
      titulo: metadata.titulo || `Transcripción: ${originalFileName}`,
      descripcion: metadata.descripcion || `Transcripción automática de ${originalFileType === 'video' ? 'video' : 'audio'} generada con Gemini AI. ${transcriptionResult.metadata.wordsCount} palabras, ${transcriptionResult.metadata.charactersCount} caracteres.`,
      etiquetas: [
        'transcripcion',
        'audio',
        originalFileType,
        'gemini-ai',
        ...(metadata.etiquetas || [])
      ],
      proyecto: metadata.proyecto || 'Transcripciones Automáticas',
      project_id: metadata.project_id || null,
      storage_path: null, // No necesitamos storage para transcripciones
      url: null,
      nombre_archivo: `${originalFileName}.transcripcion.txt`,
      tamano: transcriptionResult.transcription.length,
      fecha: new Date().toISOString().split('T')[0],
      // CLAVE: Guardar la transcripción en la columna específica
      audio_transcription: transcriptionResult.transcription
    };
    
    let codexData, codexError;
    if (updateItemId) {
      console.log(`📝 Actualizando item existente ${updateItemId} con transcripción...`);
      ({ data: codexData, error: codexError } = await supabaseClient
        .from('codex_items')
        .update({
          audio_transcription: codexItemData.audio_transcription,
          descripcion: codexItemData.descripcion,
          nombre_archivo: codexItemData.nombre_archivo,
          etiquetas: codexItemData.etiquetas
        })
        .eq('id', updateItemId)
        .select()
        .single());
    } else {
      console.log(`📝 Creando registro con transcripción de ${transcriptionResult.transcription.length} caracteres...`);
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
    
    console.log(`✅ Transcripción guardada en codex_items id: ${codexData.id}`);
    
    return {
      codexItem: codexData,
      transcriptionResult: transcriptionResult,
      storagePath: null // No se usa storage
    };
    
  } catch (error) {
    console.error('❌ Error guardando transcripción en Codex:', error);
    throw new Error(`Error al guardar transcripción: ${error.message}`);
  }
}

/**
 * Limpia archivos temporales
 * @param {string[]} tempFiles - Array de rutas de archivos temporales
 */
function cleanupTempFiles(tempFiles) {
  tempFiles.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Archivo temporal eliminado: ${filePath}`);
      }
    } catch (error) {
      console.warn(`⚠️ No se pudo eliminar archivo temporal ${filePath}:`, error.message);
    }
  });
}

/**
 * Función principal para transcribir audio/video
 * @param {string} filePath - Ruta del archivo a transcribir
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones de transcripción
 * @returns {Promise<Object>} - Resultado completo de la transcripción
 */
async function transcribeFile(filePath, userId, options = {}) {
  // Permitimos pasar un cliente de Supabase autenticado a través de options.supabaseClient
  const spClient = options.supabaseClient || supabase;
  const updateItemId = options.updateItemId || null;
  const tempFiles = [];
  
  try {
    console.log(`🎬 Iniciando proceso de transcripción: ${filePath}`);
    
    // Preparar archivo de audio
    const { audioPath, isTemporary } = await prepareAudioFile(filePath);
    
    if (isTemporary) {
      tempFiles.push(audioPath);
    }
    
    // Transcribir con Gemini
    const transcriptionResult = await transcribeWithGemini(audioPath, options);
    
    // Guardar en Codex
    const saveResult = await saveTranscriptionToCodex(
      transcriptionResult,
      filePath,
      userId,
      options,
      spClient,
      updateItemId
    );
    
    return {
      success: true,
      transcription: transcriptionResult.transcription,
      metadata: transcriptionResult.metadata,
      codexItem: saveResult.codexItem,
      message: `Transcripción completada exitosamente. ${transcriptionResult.metadata.wordsCount} palabras procesadas.`
    };
    
  } catch (error) {
    console.error('❌ Error en proceso de transcripción:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error durante el proceso de transcripción'
    };
  } finally {
    // Limpiar archivos temporales
    if (tempFiles.length > 0) {
      cleanupTempFiles(tempFiles);
    }
  }
}

module.exports = {
  transcribeFile,
  detectFileType,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS
}; 