const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const supabase = require('../utils/supabase');

const execAsync = promisify(exec);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TRANSCRIBE_MODEL = 'whisper-1';
const OPENAI_VISION_MODEL = (process.env.IMAGE_TRANSCRIBE_MODEL || 'gpt-4o-mini').trim();

const TEMP_DIR = '/tmp/audio_transcriptions';
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a'];
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.m4v'];
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Crear directorio temporal si no existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (SUPPORTED_AUDIO_FORMATS.includes(ext)) { return 'audio'; }
  if (SUPPORTED_VIDEO_FORMATS.includes(ext)) { return 'video'; }
  return 'unsupported';
}

async function extractAudioFromVideo(videoPath) {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const audioPath = path.join(TEMP_DIR, `${videoName}_${Date.now()}.wav`);
  console.log(`🎵 Extrayendo audio de video: ${videoPath}`);
  const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -ac 1 -ar 16000 -y "${audioPath}"`;
  try { await execAsync(ffmpegCommand); console.log(`✅ Audio extraído: ${audioPath}`); return audioPath; }
  catch (error) { console.error('❌ Error extrayendo audio:', error); throw new Error(`Error al extraer audio del video: ${error.message}`); }
}

async function prepareAudioFile(inputPath) {
  const fileType = detectFileType(inputPath);
  if (fileType === 'unsupported') {
    throw new Error(`Formato de archivo no soportado. Formatos soportados: ${[...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS].join(', ')}`);
  }
  if (fileType === 'video') {
    const audioPath = await extractAudioFromVideo(inputPath);
    return { audioPath, isTemporary: true };
  } else {
    return { audioPath: inputPath, isTemporary: false };
  }
}

// Transcripción de audio usando OpenAI
async function transcribeWithOpenAI(audioPath, options = {}) {
  try {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');
    if (!fs.existsSync(audioPath)) throw new Error(`Archivo de audio no encontrado: ${audioPath}`);

    // Leer el archivo como buffer
    const fileBuffer = fs.readFileSync(audioPath);
    
    const form = new (require('form-data'))();
    form.append('model', OPENAI_TRANSCRIBE_MODEL);
    form.append('file', fileBuffer, {
      filename: path.basename(audioPath),
      contentType: 'audio/wav'
    });
    if (options.language) form.append('language', options.language);
    if (options.prompt) form.append('prompt', options.prompt);

    const axios = require('axios');
    const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders()
      }
    });
    const data = resp.data;
    const transcription = data.text || '';

    return {
      transcription,
      metadata: {
        originalFile: path.basename(audioPath),
        model: OPENAI_TRANSCRIBE_MODEL,
        timestamp: new Date().toISOString(),
        charactersCount: transcription.length,
        wordsCount: transcription.split(' ').length
      }
    };
  } catch (error) {
    console.error('❌ Error en transcripción OpenAI:', error);
    throw new Error(`Error al transcribir con OpenAI: ${error.message}`);
  }
}

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
    const codexItemData = {
      user_id: userId,
      tipo: originalFileType,
      titulo: metadata.titulo || `Transcripción: ${originalFileName}`,
      descripcion: metadata.descripcion || `Transcripción automática de ${originalFileType === 'video' ? 'video' : 'audio'} generada con OpenAI (${OPENAI_TRANSCRIBE_MODEL}). ${transcriptionResult.metadata.wordsCount} palabras, ${transcriptionResult.metadata.charactersCount} caracteres.`,
      etiquetas: metadata.noAutoTags ? (metadata.etiquetas || []) : [
        'transcripcion', 'audio', originalFileType, 'openai-gpt', ...(metadata.etiquetas || [])
      ],
      proyecto: metadata.proyecto || 'Transcripciones Automáticas',
      project_id: metadata.project_id || null,
      storage_path: null,
      url: null,
      nombre_archivo: `${originalFileName}.transcripcion.txt`,
      tamano: transcriptionResult.transcription.length,
      fecha: new Date().toISOString().split('T')[0],
      audio_transcription: transcriptionResult.transcription
    };
    let codexData, codexError;
    if (updateItemId) {
      console.log(`📝 Actualizando item existente ${updateItemId} con transcripción...`);
      const updateData = { audio_transcription: codexItemData.audio_transcription, descripcion: codexItemData.descripcion, nombre_archivo: codexItemData.nombre_archivo };
      if (!metadata.noAutoTags) { updateData.etiquetas = codexItemData.etiquetas; }
      ({ data: codexData, error: codexError } = await supabaseClient
        .from('codex_items')
        .update(updateData)
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
    if (codexError) { console.error('❌ Error insertando en codex_items:', codexError); throw codexError; }
    console.log(`✅ Transcripción guardada en codex_items id: ${codexData.id}`);
    return { codexItem: codexData, transcriptionResult: transcriptionResult, storagePath: null };
  } catch (error) {
    console.error('❌ Error guardando transcripción en Codex:', error);
    throw new Error(`Error al guardar transcripción: ${error.message}`);
  }
}

function cleanupTempFiles(tempFiles) {
  tempFiles.forEach(filePath => { try { if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); console.log(`🗑️ Archivo temporal eliminado: ${filePath}`); } } catch (e) { console.warn(`⚠️ No se pudo eliminar archivo temporal ${filePath}:`, e.message); } });
}

async function transcribeFile(filePath, userId, options = {}) {
  const spClient = options.supabaseClient || supabase;
  const updateItemId = options.updateItemId || null;
  const tempFiles = [];
  try {
    console.log(`🎬 Iniciando proceso de transcripción: ${filePath}`);
    const { audioPath, isTemporary } = await prepareAudioFile(filePath);
    if (isTemporary) { tempFiles.push(audioPath); }
    const transcriptionResult = await transcribeWithOpenAI(audioPath, options);
    const saveResult = await saveTranscriptionToCodex(transcriptionResult, filePath, userId, options, spClient, updateItemId);
    return { success: true, transcription: transcriptionResult.transcription, metadata: transcriptionResult.metadata, codexItem: saveResult.codexItem, message: `Transcripción completada. ${transcriptionResult.metadata.wordsCount} palabras.` };
  } catch (error) {
    console.error('❌ Error en proceso de transcripción:', error);
    return { success: false, error: error.message, message: 'Error durante el proceso de transcripción' };
  } finally { if (tempFiles.length > 0) { cleanupTempFiles(tempFiles); } }
}

// Imagen → descripción/transcripción con OpenAI vision
async function transcribeImageWithGemini(imagePath, options = {}) {
  try {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');
    if (!fs.existsSync(imagePath)) throw new Error(`Archivo de imagen no encontrado: ${imagePath}`);
    let imageExt = path.extname(imagePath).toLowerCase();
    if (imageExt.includes('%') || imageExt.includes('?')) { const clean = imagePath.split('?')[0]; imageExt = path.extname(decodeURIComponent(clean)).toLowerCase(); }
    if (!SUPPORTED_IMAGE_FORMATS.includes(imageExt)) { throw new Error(`Formato de imagen no soportado para transcripción: ${imageExt}`); }
    const imageData = fs.readFileSync(imagePath).toString('base64');

    const prompt = options.prompt || `Describe detalladamente el contenido de esta imagen en español. Si hay texto, transcríbelo exactamente. Devuelve solo el texto.`;
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        messages: [
          { role: 'system', content: 'Eres un asistente de visión. Responde solo texto.' },
          { role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/${imageExt.replace('.','')};base64,${imageData}` } }
          ] }
        ],
        max_tokens: 500,
        temperature: 0.2
      })
    });
    if (!resp.ok) { const t = await resp.text(); throw new Error(`OpenAI vision error: ${resp.status} ${resp.statusText} - ${t}`); }
    const data = await resp.json();
    const transcription = (data.choices?.[0]?.message?.content || '').trim();
    return { transcription, metadata: { originalFile: path.basename(imagePath), model: OPENAI_VISION_MODEL, timestamp: new Date().toISOString(), charactersCount: transcription.length, wordsCount: transcription.split(' ').length } };
  } catch (error) {
    console.error('❌ Error en transcripción de imagen con OpenAI:', error);
    throw new Error(`Error al transcribir imagen con OpenAI: ${error.message}`);
  }
}

module.exports = {
  transcribeFile,
  detectFileType,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
  SUPPORTED_IMAGE_FORMATS,
  transcribeImageWithGemini
}; 