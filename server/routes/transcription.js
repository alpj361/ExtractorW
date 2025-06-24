const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyUserAccess } = require('../middlewares/auth');
const { createClient } = require('@supabase/supabase-js');
const { logUsage } = require('../services/logs');
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
    const name = sanitizeFileName(path.basename(file.originalname, ext));
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

// Sanitiza nombres de archivo para evitar rutas demasiado largas o caracteres no válidos
function sanitizeFileName(fileName, maxLength = 120) {
  if (!fileName) return `${Date.now()}`;
  // Separar extensión
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  // Normalizar y remover caracteres no ASCII que suelen causar problemas
  let sanitized = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // tildes
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return `${sanitized}${ext}`;
}

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
      // Calcular tokens y costo aproximado
      const tokensConsumed = Math.ceil(result.metadata.charactersCount / 4);
      const dollarsPerToken = parseFloat(process.env.GEMINI_TRANSCRIPTION_COST_PER_TOKEN || '0.000015');
      const dollarsConsumed = parseFloat((tokensConsumed * dollarsPerToken).toFixed(6));

      // Guardar métricas para el log
      req.tokens_consumed = tokensConsumed;
      req.dollars_consumed = dollarsConsumed;

      // Registrar uso (créditos 0 porque es gratuito)
      await logUsage(req.user, req.path, 0, req);

      console.log(`✅ Transcripción completada para usuario ${userId} (${tokensConsumed} tokens, $${dollarsConsumed})`);

      res.json({
        success: true,
        message: result.message,
        data: {
          transcription: result.transcription,
          metadata: result.metadata,
          codexItem: result.codexItem,
          tokensConsumed,
          dollarsConsumed
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

    // ------------------------------------------------------------------
    // Obtener archivo asociado (Supabase Storage o Google Drive)
    // ------------------------------------------------------------------

    const tempDir = '/tmp/codex-transcriptions';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let tempFilePath;

    if (codexItem.storage_path) {
      // -----------------------------
      // Archivo en Supabase Storage
      // -----------------------------
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

      tempFilePath = path.join(tempDir, `${codexItem.id}_${Date.now()}${path.extname(codexItem.nombre_archivo || 'audio.wav')}`);
      fs.writeFileSync(tempFilePath, Buffer.from(await fileData.arrayBuffer()));

    } else if (codexItem.is_drive) {
      // -----------------------------
      // Archivo en Google Drive
      // -----------------------------
      const { drive_file_id, drive_access_token } = req.body;

      if (!drive_file_id || !drive_access_token) {
        return res.status(400).json({
          success: false,
          error: 'Faltan parámetros de Google Drive (drive_file_id o drive_access_token)'
        });
      }

      try {
        console.log(`⬇️ Descargando archivo de Google Drive: ${drive_file_id}`);
        const axios = require('axios');
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${drive_file_id}?alt=media&supportsAllDrives=true`;
        let response;
        try {
          response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            headers: { Authorization: `Bearer ${drive_access_token}` }
          });
        } catch (primaryErr) {
          // 404 / insuficiente permiso
          console.warn('⚠️ Descarga directa falló:', primaryErr.response?.status, primaryErr.message);
          try {
            // Copiar el archivo a un espacio que pertenezca a la aplicación
            const copyUrl = `https://www.googleapis.com/drive/v3/files/${drive_file_id}/copy?supportsAllDrives=true`;
            const copyRes = await axios.post(copyUrl, { name: `copied_${drive_file_id}` }, {
              headers: { Authorization: `Bearer ${drive_access_token}` }
            });
            const newId = copyRes.data.id;
            console.log('📄 Archivo copiado, nuevo ID:', newId);
            const newDownload = `https://www.googleapis.com/drive/v3/files/${newId}?alt=media`;
            response = await axios.get(newDownload, {
              responseType: 'arraybuffer',
              headers: { Authorization: `Bearer ${drive_access_token}` }
            });
          } catch (copyErr) {
            console.warn('⚠️ Copia falló, intentando enlace uc...', copyErr.message);
            const altUrl = `https://drive.google.com/uc?export=download&id=${drive_file_id}`;
            response = await axios.get(altUrl, {
              responseType: 'arraybuffer',
              maxRedirects: 5
            });
          }
        }

        const ext = path.extname(codexItem.nombre_archivo || '.wav') || '.wav';
        tempFilePath = path.join(tempDir, `${codexItem.id}_${Date.now()}${ext}`);
        fs.writeFileSync(tempFilePath, response.data);
        console.log(`✅ Archivo de Drive descargado: ${tempFilePath}`);

        // ----- DEBUG: inspeccionar respuesta -----
        try {
          const dbgType = response.headers['content-type'] || 'unknown';
          const dbgSize = response.data?.byteLength || response.data?.length || 0;
          console.log(`📦 Drive download status: ${response.status} (${dbgType}) size=${dbgSize} bytes`);
          // Si es HTML (aviso de descarga grande), extraer confirm token
          if (dbgType.startsWith('text/html')) {
            const html = response.data.toString('utf8');
            const tokenMatch = /confirm=([0-9A-Za-z_]+)/.exec(html);
            if (tokenMatch) {
              const confirmToken = tokenMatch[1];
              console.log('🔑 Confirm token encontrado:', confirmToken);
              const confirmUrl = `https://drive.google.com/uc?export=download&id=${drive_file_id}&confirm=${confirmToken}`;
              response = await axios.get(confirmUrl, {
                responseType: 'arraybuffer',
                maxRedirects: 5
              });
              console.log('✅ Descarga confirmada, tamaño', response.data?.byteLength || response.data?.length);
            } else {
              console.warn('⚠️ No se encontró confirm token en HTML de Drive');
            }
          }
          // Si es texto, mostrar primeros 200 caracteres para inspección
          if (dbgType.startsWith('text') && dbgSize < 20000) {
            const preview = response.data.toString().slice(0, 200);
            console.log('🔍 Response preview:', preview.replace(/\n/g, ' '));
          }
        } catch (dbgErr) {
          console.warn('⚠️ No se pudo inspeccionar respuesta:', dbgErr.message);
        }

      } catch (driveErr) {
        console.error('❌ Error descargando desde Google Drive:', driveErr.message);
        return res.status(500).json({
          success: false,
          error: 'No se pudo descargar el archivo desde Google Drive',
          details: driveErr.message
        });
      }

    } else {
      return res.status(400).json({
        success: false,
        error: 'El item del Codex no tiene un archivo asociado'
      });
    }

    console.log(`�� Archivo descargado a: ${tempFilePath}`);

    // Verificar formato de archivo
    const fileType = detectFileType(tempFilePath);
    if (fileType === 'unsupported') {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        error: 'El archivo no es de un formato compatible para transcripción'
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
    const result = await transcribeFile(tempFilePath, userId, { ...options, supabaseClient: userSupabase, updateItemId: codexItemId });

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
    }

    if (result.success) {
      // Calcular tokens y costo aproximado
      const tokensConsumed = Math.ceil(result.metadata.charactersCount / 4);
      const dollarsPerToken = parseFloat(process.env.GEMINI_TRANSCRIPTION_COST_PER_TOKEN || '0.000015');
      const dollarsConsumed = parseFloat((tokensConsumed * dollarsPerToken).toFixed(6));

      // Guardar métricas para el log
      req.tokens_consumed = tokensConsumed;
      req.dollars_consumed = dollarsConsumed;

      // Registrar uso (créditos 0 porque es gratuito)
      await logUsage(req.user, req.path, 0, req);

      console.log(`✅ Transcripción desde Codex completada para usuario ${userId} (${tokensConsumed} tokens, $${dollarsConsumed})`);

      res.json({
        success: true,
        message: result.message,
        data: {
          transcription: result.transcription,
          metadata: result.metadata,
          codexItem: result.codexItem,
          originalItem: codexItem,
          tokensConsumed,
          dollarsConsumed
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
    res.json({
      success: true,
      data: {
      cost: 0,
      description: 'La transcripción de audio/video es ahora gratuita para todos los usuarios'
    }
  });
});

module.exports = router; 