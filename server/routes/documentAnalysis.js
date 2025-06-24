const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyUserAccess } = require('../middlewares/auth');
const { checkCredits, debitCredits } = require('../middlewares/credits');
const { createClient } = require('@supabase/supabase-js');
const { logUsage } = require('../services/logs');
const { analyzeDocument, detectDocumentType, SUPPORTED_DOCUMENT_FORMATS, SUPPORTED_IMAGE_FORMATS } = require('../services/documentAnalysis');

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
  const allSupportedFormats = [...SUPPORTED_DOCUMENT_FORMATS, ...SUPPORTED_IMAGE_FORMATS];
  
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
    fileSize: 100 * 1024 * 1024 // 100MB máximo
  }
});

// Sanitiza nombres de archivo
function sanitizeFileName(fileName, maxLength = 120) {
  if (!fileName) return `${Date.now()}`;
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let sanitized = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return `${sanitized}${ext}`;
}

/**
 * POST /api/document-analysis/from-codex
 * Analiza un documento existente en el Codex
 */
router.post('/from-codex', verifyUserAccess, async (req, res) => {
  let tempFilePath = null;
  const tempDir = '/tmp/document_analysis';

  try {
    const userId = req.user.id;
    const {
      codexItemId,
      titulo,
      descripcion,
      etiquetas,
      proyecto,
      project_id,
      prompt,
      // Para archivos de Google Drive
      is_drive,
      drive_file_id,
      file_url,
      drive_access_token,
      download_url,
      file_name,
      file_type,
      file_size,
      // Para archivos de Supabase (compatibilidad)
      storage_path
    } = req.body;

    console.log(`📄 Iniciando análisis de documento desde Codex para usuario ${userId}, item ${codexItemId}`);

    if (!codexItemId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID del elemento del Codex'
      });
    }

    // Crear Supabase cliente con el token del usuario para verificar permisos
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      }
    );

    // Obtener el item del Codex
    const { data: codexItem, error: codexError } = await userSupabase
      .from('codex_items')
      .select('*')
      .eq('id', codexItemId)
      .eq('user_id', userId)
      .single();

    if (codexError || !codexItem) {
      console.error('❌ Error obteniendo item del Codex:', codexError);
      return res.status(404).json({
        success: false,
        error: 'Elemento del Codex no encontrado o sin permisos'
      });
    }

    console.log(`📁 Item del Codex encontrado: ${codexItem.titulo} (tipo: ${codexItem.tipo})`);

    // Calcular créditos necesarios basado en el tamaño estimado del documento
    let estimatedSize = codexItem.tamano || 50000; // 50KB por defecto
    let creditsNeeded = 20; // Base

    if (estimatedSize < 10000) { // < 10KB
      creditsNeeded = 10;
    } else if (estimatedSize < 50000) { // < 50KB
      creditsNeeded = 20;
    } else if (estimatedSize < 200000) { // < 200KB
      creditsNeeded = 35;
    } else { // > 200KB
      creditsNeeded = 50;
    }

    // Verificar créditos del usuario
    const creditsCheck = await checkCredits(req.user, creditsNeeded);
    if (!creditsCheck.hasEnoughCredits) {
      return res.status(402).json({
        success: false,
        error: `Créditos insuficientes. Necesitas ${creditsNeeded} créditos, tienes ${creditsCheck.currentCredits}`,
        data: {
          creditsNeeded,
          currentCredits: creditsCheck.currentCredits,
          creditsShortfall: creditsNeeded - creditsCheck.currentCredits
        }
      });
    }

    // Crear directorio temporal si no existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Descargar el archivo según su origen
    if (is_drive && drive_file_id && drive_access_token) {
      // Archivo de Google Drive
      try {
        console.log(`⬇️ Descargando archivo de Google Drive: ${drive_file_id}`);
        const axios = require('axios');
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${drive_file_id}?alt=media&supportsAllDrives=true`;
        
        const response = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          headers: { Authorization: `Bearer ${drive_access_token}` }
        });

        const ext = path.extname(codexItem.nombre_archivo || '.pdf') || '.pdf';
        tempFilePath = path.join(tempDir, `${codexItem.id}_${Date.now()}${ext}`);
        
        fs.writeFileSync(tempFilePath, response.data);
        console.log(`✅ Archivo de Drive descargado: ${tempFilePath}`);

      } catch (driveErr) {
        console.error('❌ Error descargando desde Google Drive:', driveErr.message);
        return res.status(500).json({
          success: false,
          error: 'No se pudo descargar el archivo desde Google Drive',
          details: driveErr.message
        });
      }

    } else if (codexItem.storage_path) {
      // Archivo de Supabase Storage
      try {
        console.log(`⬇️ Descargando archivo de Supabase: ${codexItem.storage_path}`);
        
        const { data: fileData, error: downloadError } = await userSupabase.storage
          .from('digitalstorage')
          .download(codexItem.storage_path);

        if (downloadError) throw downloadError;

        const ext = path.extname(codexItem.nombre_archivo || '.pdf') || '.pdf';
        tempFilePath = path.join(tempDir, `${codexItem.id}_${Date.now()}${ext}`);
        
        const buffer = await fileData.arrayBuffer();
        fs.writeFileSync(tempFilePath, Buffer.from(buffer));
        console.log(`✅ Archivo de Supabase descargado: ${tempFilePath}`);

      } catch (supabaseErr) {
        console.error('❌ Error descargando desde Supabase:', supabaseErr.message);
        return res.status(500).json({
          success: false,
          error: 'No se pudo descargar el archivo desde Supabase Storage',
          details: supabaseErr.message
        });
      }

    } else {
      return res.status(400).json({
        success: false,
        error: 'El item del Codex no tiene un archivo asociado'
      });
    }

    console.log(`📂 Archivo descargado a: ${tempFilePath}`);

    // Verificar formato de archivo
    const docType = detectDocumentType(tempFilePath);
    if (docType === 'unsupported') {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        error: 'El archivo no es de un formato compatible para análisis de documentos'
      });
    }

    // Preparar opciones
    const options = {
      titulo: titulo || `Análisis de ${codexItem.titulo}`,
      descripcion: descripcion || `Análisis del documento: ${codexItem.titulo}`,
      etiquetas: etiquetas ? etiquetas.split(',').map(tag => tag.trim()) : [...(codexItem.etiquetas || []), 'analisis-derivado'],
      proyecto: proyecto || codexItem.proyecto,
      project_id: project_id || codexItem.project_id,
      prompt: prompt || undefined
    };

    // Analizar documento
    const result = await analyzeDocument(tempFilePath, userId, { ...options, supabaseClient: userSupabase, updateItemId: codexItemId });

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
    }

    if (result.success) {
      // Debitar créditos después del análisis exitoso
      await debitCredits(req.user, creditsNeeded, req.path);

      // Calcular métricas aproximadas
      const charactersAnalyzed = result.analysis.estadisticas.caracteres_totales;
      const tokensConsumed = Math.ceil(charactersAnalyzed / 4);
      
      // Guardar métricas para el log
      req.tokens_consumed = tokensConsumed;
      req.characters_analyzed = charactersAnalyzed;

      // Registrar uso
      await logUsage(req.user, req.path, creditsNeeded, req);

      console.log(`✅ Análisis de documento completado para usuario ${userId} (${charactersAnalyzed} caracteres, ${creditsNeeded} créditos)`);

      res.json({
        success: true,
        message: result.message,
        data: {
          analysis: result.analysis,
          extractionMetadata: result.extractionMetadata,
          originalItem: codexItem,
          creditsUsed: creditsNeeded,
          tokensConsumed,
          charactersAnalyzed
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
    console.error('❌ Error analizando documento desde Codex:', error);
    
    // Limpiar archivo temporal en caso de error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('⚠️ No se pudo eliminar archivo temporal tras error:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/document-analysis/upload
 * Analiza un documento subido directamente
 */
router.post('/upload', verifyUserAccess, upload.single('document'), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      titulo,
      descripcion,
      etiquetas,
      proyecto,
      project_id,
      prompt
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ningún archivo'
      });
    }

    console.log(`📄 Analizando documento subido: ${req.file.originalname}`);

    // Verificar formato
    const docType = detectDocumentType(req.file.path);
    if (docType === 'unsupported') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Formato de archivo no soportado'
      });
    }

    // Calcular créditos basado en tamaño
    let creditsNeeded = 20;
    const fileSize = req.file.size;
    
    if (fileSize < 10000) creditsNeeded = 10;
    else if (fileSize < 50000) creditsNeeded = 20;
    else if (fileSize < 200000) creditsNeeded = 35;
    else creditsNeeded = 50;

    // Verificar créditos
    const creditsCheck = await checkCredits(req.user, creditsNeeded);
    if (!creditsCheck.hasEnoughCredits) {
      fs.unlinkSync(req.file.path);
      return res.status(402).json({
        success: false,
        error: `Créditos insuficientes. Necesitas ${creditsNeeded} créditos, tienes ${creditsCheck.currentCredits}`,
        data: {
          creditsNeeded,
          currentCredits: creditsCheck.currentCredits
        }
      });
    }

    // Preparar opciones
    const options = {
      titulo: titulo || `Análisis de ${req.file.originalname}`,
      descripcion: descripcion || `Análisis del documento subido: ${req.file.originalname}`,
      etiquetas: etiquetas ? etiquetas.split(',').map(tag => tag.trim()) : ['documento-subido', 'analisis'],
      proyecto: proyecto || 'Análisis de Documentos',
      project_id: project_id || null,
      prompt: prompt || undefined
    };

    // Analizar documento
    const result = await analyzeDocument(req.file.path, userId, options);

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
    }

    if (result.success) {
      // Debitar créditos
      await debitCredits(req.user, creditsNeeded, req.path);

      // Métricas
      const charactersAnalyzed = result.analysis.estadisticas.caracteres_totales;
      const tokensConsumed = Math.ceil(charactersAnalyzed / 4);
      
      req.tokens_consumed = tokensConsumed;
      req.characters_analyzed = charactersAnalyzed;

      await logUsage(req.user, req.path, creditsNeeded, req);

      res.json({
        success: true,
        message: result.message,
        data: {
          analysis: result.analysis,
          extractionMetadata: result.extractionMetadata,
          fileName: req.file.originalname,
          creditsUsed: creditsNeeded,
          tokensConsumed,
          charactersAnalyzed
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
    console.error('❌ Error analizando documento subido:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/document-analysis/supported-formats
 * Obtiene los formatos de archivo soportados
 */
router.get('/supported-formats', (req, res) => {
  res.json({
    success: true,
    data: {
      documents: SUPPORTED_DOCUMENT_FORMATS,
      images: SUPPORTED_IMAGE_FORMATS,
      all: [...SUPPORTED_DOCUMENT_FORMATS, ...SUPPORTED_IMAGE_FORMATS]
    }
  });
});

/**
 * POST /api/document-analysis/estimate-cost
 * Estima el costo de análisis de un documento
 */
router.post('/estimate-cost', verifyUserAccess, async (req, res) => {
  try {
    const { fileSize } = req.body;
    
    let creditsNeeded = 20; // Base
    
    if (fileSize < 10000) creditsNeeded = 10;
    else if (fileSize < 50000) creditsNeeded = 20;
    else if (fileSize < 200000) creditsNeeded = 35;
    else creditsNeeded = 50;

    res.json({
      success: true,
      data: {
        estimatedCredits: creditsNeeded,
        description: `Análisis de documento (${Math.round(fileSize / 1024)} KB)`
      }
    });

  } catch (error) {
    console.error('❌ Error estimando costo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/document-analysis/stats
 * Obtiene estadísticas de análisis del usuario
 */
router.get('/stats', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Crear cliente con token del usuario
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      }
    );

    // Contar documentos analizados
    const { data: analyzedDocs, error } = await userSupabase
      .from('codex_items')
      .select('id, document_analysis, created_at')
      .eq('user_id', userId)
      .not('document_analysis', 'is', null);

    if (error) throw error;

    // Estadísticas básicas
    const stats = {
      documentsAnalyzed: analyzedDocs.length,
      totalCharactersAnalyzed: analyzedDocs.reduce((total, doc) => {
        return total + (doc.document_analysis?.length || 0);
      }, 0),
      averageDocumentSize: analyzedDocs.length > 0 
        ? Math.round(analyzedDocs.reduce((total, doc) => total + (doc.document_analysis?.length || 0), 0) / analyzedDocs.length)
        : 0,
      lastAnalysis: analyzedDocs.length > 0 
        ? analyzedDocs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
        : null
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 