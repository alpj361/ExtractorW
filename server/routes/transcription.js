const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyUserAccess } = require('../middlewares/auth');
const { createClient } = require('@supabase/supabase-js');
const { checkCreditsFunction, debitCreditsFunction } = require('../middlewares/credits');
const { transcribeFile, detectFileType, SUPPORTED_AUDIO_FORMATS, SUPPORTED_VIDEO_FORMATS } = require('../services/transcription');

const router = express.Router();

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/tmp/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Mantener el nombre original con timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

// Filtro de archivos permitidos
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allSupportedFormats = [...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS];
  
  if (allSupportedFormats.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Formato de archivo no soportado. Formatos permitidos: ${allSupportedFormats.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB máximo
  }
});

/**
 * POST /api/transcription/upload
 * Sube y transcribe un archivo de audio/video
 */
router.post('/upload', verifyUserAccess, upload.single('audioFile'), async (req, res) => {
  try {
    console.log('📤 Solicitud de transcripción recibida');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ningún archivo'
      });
    }

    const { titulo, descripcion, etiquetas, proyecto, project_id, prompt } = req.body;
    const userId = req.user.id;
    const filePath = req.file.path;
    const fileType = detectFileType(filePath);

    console.log(`📁 Archivo recibido: ${req.file.originalname} (${fileType})`);

    // Crear cliente Supabase autenticado con token para respetar RLS
    const authToken = req.headers.authorization?.split(' ')[1] || '';
    const userSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    // Verificar créditos (costo base: 20 créditos por transcripción)
    const creditsCost = 20;
    const creditsCheck = await checkCreditsFunction(userId, creditsCost);
    
    if (!creditsCheck.hasCredits) {
      // Limpiar archivo subido
      fs.unlinkSync(filePath);
      return res.status(402).json({
        success: false,
        error: 'Créditos insuficientes',
        required: creditsCost,
        available: creditsCheck.currentCredits
      });
    }

    // Preparar opciones de transcripción
    const options = {
      titulo: titulo || `Transcripción de ${req.file.originalname}`,
      descripcion,
      etiquetas: etiquetas ? etiquetas.split(',').map(tag => tag.trim()) : [],
      proyecto,
      project_id,
      prompt: prompt || undefined
    };

    // Iniciar transcripción
    const result = await transcribeFile(filePath, userId, { ...options, supabaseClient: userSupabase });

    // Limpiar archivo subido
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Archivo temporal eliminado: ${filePath}`);
    } catch (cleanupError) {
      console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
    }

    if (result.success) {
      // Debitar créditos solo si fue exitoso
      await debitCreditsFunction(userId, creditsCost, 'Transcripción de audio/video', {
        fileName: req.file.originalname,
        fileType: fileType,
        wordsCount: result.metadata.wordsCount,
        charactersCount: result.metadata.charactersCount
      });

      console.log(`✅ Transcripción completada para usuario ${userId}`);

      res.json({
        success: true,
        message: result.message,
        data: {
          transcription: result.transcription,
          metadata: result.metadata,
          codexItem: result.codexItem,
          creditsUsed: creditsCost
        }
      });
    } else {
      console.error(`❌ Error en transcripción para usuario ${userId}:`, result.error);
      
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Error en endpoint de transcripción:', error);

    // Limpiar archivo si existe
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ No se pudo eliminar archivo tras error:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error interno del servidor durante la transcripción'
    });
  }
});

/**
 * POST /api/transcription/from-codex
 * Transcribe un archivo que ya está en el Codex
 */
router.post('/from-codex', verifyUserAccess, async (req, res) => {
  try {
    const { codexItemId, titulo, descripcion, etiquetas, proyecto, project_id, prompt } = req.body;
    const userId = req.user.id;

    if (!codexItemId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID del item del Codex'
      });
    }

    console.log(`🔄 Transcribiendo item del Codex: ${codexItemId}`);

    // Crear cliente de Supabase con el token del usuario para RLS
    const { createClient } = require('@supabase/supabase-js');
    const authToken = req.headers.authorization?.split(' ')[1] || '';
    
    const userSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    });

    console.log(`🔑 Usando token para RLS: ${authToken.substring(0, 20)}...`);

    // Obtener item del Codex usando el cliente autenticado
    const { data: codexItem, error: fetchError } = await userSupabase
      .from('codex_items')
      .select('*')
      .eq('id', codexItemId)
      .single();

    if (fetchError || !codexItem) {
      console.log(`❌ Error obteniendo item del Codex:`, fetchError);
      return res.status(404).json({
        success: false,
        error: 'Item del Codex no encontrado o no tienes permisos para accederlo',
        details: fetchError?.message
      });
    }

    console.log(`✅ Item del Codex encontrado: ${codexItem.titulo}`);

    // Verificar que el item tenga un archivo asociado
    if (!codexItem.storage_path) {
      return res.status(400).json({
        success: false,
        error: 'El item del Codex no tiene un archivo asociado'
      });
    }

    // Descargar archivo desde Supabase Storage usando el cliente autenticado
    const { data: fileData, error: downloadError } = await userSupabase.storage
      .from('digitalstorage')
      .download(codexItem.storage_path);

    if (downloadError || !fileData) {
      console.log(`❌ Error descargando archivo:`, downloadError);
      return res.status(404).json({
        success: false,
        error: 'No se pudo descargar el archivo del Codex',
        details: downloadError?.message
      });
    }

    // Guardar archivo temporalmente
    const tempDir = '/tmp/codex-transcriptions';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `${Date.now()}_${codexItem.nombre_archivo}`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);

    console.log(`📁 Archivo descargado temporalmente: ${tempFilePath}`);

    // Verificar formato de archivo
    const fileType = detectFileType(tempFilePath);
    if (fileType === 'unsupported') {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        error: 'El archivo no es de un formato compatible para transcripción'
      });
    }

    // Verificar créditos
    const creditsCost = 20;
    const creditsCheck = await checkCreditsFunction(userId, creditsCost);
    
    if (!creditsCheck.hasCredits) {
      fs.unlinkSync(tempFilePath);
      return res.status(402).json({
        success: false,
        error: 'Créditos insuficientes',
        required: creditsCost,
        available: creditsCheck.currentCredits
      });
    }

    // Preparar opciones
    const options = {
      titulo: titulo || `Transcripción de ${codexItem.titulo}`,
      descripcion: descripcion || `Transcripción del archivo: ${codexItem.titulo}`,
      etiquetas: etiquetas ? etiquetas.split(',').map(tag => tag.trim()) : [...(codexItem.etiquetas || []), 'transcripcion-derivada'],
      proyecto: proyecto || codexItem.proyecto,
      project_id: project_id || codexItem.project_id,
      prompt: prompt || undefined
    };

    // Transcribir
    const result = await transcribeFile(tempFilePath, userId, { ...options, supabaseClient: userSupabase });

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
    }

    if (result.success) {
      // Debitar créditos
      await debitCreditsFunction(userId, creditsCost, 'Transcripción desde Codex', {
        originalCodexItemId: codexItemId,
        originalFileName: codexItem.nombre_archivo,
        fileType: fileType,
        wordsCount: result.metadata.wordsCount,
        charactersCount: result.metadata.charactersCount
      });

      console.log(`✅ Transcripción desde Codex completada para usuario ${userId}`);

      res.json({
        success: true,
        message: result.message,
        data: {
          transcription: result.transcription,
          metadata: result.metadata,
          codexItem: result.codexItem,
          originalItem: codexItem,
          creditsUsed: creditsCost
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Error transcribiendo desde Codex:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/transcription/supported-formats
 * Obtiene los formatos de archivo soportados
 */
router.get('/supported-formats', (req, res) => {
  res.json({
    success: true,
    data: {
      audio: SUPPORTED_AUDIO_FORMATS,
      video: SUPPORTED_VIDEO_FORMATS,
      all: [...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS]
    }
  });
});

/**
 * GET /api/transcription/cost
 * Obtiene el costo en créditos para transcripción
 */
router.get('/cost', verifyUserAccess, async (req, res) => {
  const userId = req.user.id;
  const creditsCost = 20;

  try {
    const creditsCheck = await checkCreditsFunction(userId, creditsCost);
    
    res.json({
      success: true,
      data: {
        cost: creditsCost,
        userCredits: creditsCheck.currentCredits,
        canAfford: creditsCheck.hasCredits,
        description: 'Costo por transcripción de archivo de audio o video'
      }
    });
  } catch (error) {
    console.error('Error verificando créditos:', error);
    res.status(500).json({
      success: false,
      error: 'Error verificando créditos del usuario'
    });
  }
});

module.exports = router; 