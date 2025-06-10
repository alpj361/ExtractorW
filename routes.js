const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar un nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

// Filtro para solo permitir archivos de video
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/mkv'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de video'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB límite
  }
});

// Función para ejecutar el script de Python de forma asíncrona
const executeVideoTranslation = (inputPath, outputPath, targetLanguage = 'español') => {
  return new Promise((resolve, reject) => {
    // Crear un script Python temporal que use nuestro traductor
    const pythonScript = `
import sys
import os
sys.path.append('${path.join(__dirname, '..')}')

# Importar el traductor de video
from video_translator import extraer_textos_con_posiciones, crear_modificador_de_frame, traducir_con_gemini
from moviepy.editor import VideoFileClip
import cv2

def procesar_video_custom(input_path, output_path, idioma_destino):
    try:
        print("🔍 Extrayendo textos...")
        textos_detectados = extraer_textos_con_posiciones(input_path)
        
        print("🌐 Traduciendo con Gemini 1.5 Flash...")
        textos_unicos = list({t["texto"] for t in textos_detectados})
        traducciones = {}
        
        for i, texto in enumerate(textos_unicos):
            print(f"  Traduciendo ({i+1}/{len(textos_unicos)}): {texto[:50]}...")
            traducciones[texto] = traducir_con_gemini(texto, idioma_destino)
        
        for t in textos_detectados:
            t["traducido"] = traducciones.get(t["texto"], t["texto"])
        
        print("🎬 Procesando video...")
        clip = VideoFileClip(input_path)
        modificador = crear_modificador_de_frame(textos_detectados)
        nuevo_clip = clip.fl_image(modificador)
        nuevo_clip.write_videofile(output_path, codec="libx264", audio=True)
        
        # Limpiar recursos
        clip.close()
        nuevo_clip.close()
        
        print("✅ Video guardado como:", output_path)
        return True
        
    except Exception as e:
        print(f"❌ Error procesando video: {str(e)}")
        return False

if __name__ == "__main__":
    input_file = "${inputPath}"
    output_file = "${outputPath}"
    target_lang = "${targetLanguage}"
    
    success = procesar_video_custom(input_file, output_file, target_lang)
    if success:
        print("SUCCESS")
    else:
        print("ERROR")
`;

    // Guardar el script temporal
    const tempScriptPath = path.join(__dirname, 'temp_translator.py');
    fs.writeFileSync(tempScriptPath, pythonScript);

    // Ejecutar el script de Python
    const command = `cd ${path.dirname(tempScriptPath)} && python temp_translator.py`;
    
    console.log(`Ejecutando: ${command}`);
    
    exec(command, { 
      timeout: 10 * 60 * 1000, // 10 minutos timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    }, (error, stdout, stderr) => {
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (cleanupError) {
        console.log('Error limpiando archivo temporal:', cleanupError.message);
      }

      if (error) {
        console.error('Error ejecutando script de Python:', error);
        console.error('stderr:', stderr);
        reject(error);
        return;
      }

      console.log('stdout:', stdout);
      
      if (stdout.includes('SUCCESS')) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error('El script de Python no completó exitosamente'));
      }
    });
  });
};

// RUTA: POST /translate-video
router.post('/translate-video', upload.single('video'), async (req, res) => {
  try {
    console.log('📹 Nueva solicitud de traducción de video recibida');
    
    // Verificar que se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        error: 'No se proporcionó ningún archivo de video',
        message: 'Debes subir un archivo de video para traducir'
      });
    }

    // Obtener parámetros
    const inputPath = req.file.path;
    const targetLanguage = req.body.target_language || 'español';
    const outputFileName = 'translated_' + req.file.filename;
    const outputPath = path.join(path.dirname(inputPath), outputFileName);

    console.log(`📄 Archivo recibido: ${req.file.originalname}`);
    console.log(`🌍 Idioma destino: ${targetLanguage}`);
    console.log(`📂 Ruta entrada: ${inputPath}`);
    console.log(`📂 Ruta salida: ${outputPath}`);

    // Responder inmediatamente que el procesamiento ha comenzado
    res.status(202).json({
      message: 'Video recibido, procesamiento iniciado',
      status: 'processing',
      input_file: req.file.originalname,
      target_language: targetLanguage,
      estimated_time: 'El tiempo depende del tamaño del video',
      processing_id: req.file.filename
    });

    // Procesar video en segundo plano
    try {
      console.log('🚀 Iniciando traducción de video...');
      await executeVideoTranslation(inputPath, outputPath, targetLanguage);
      
      console.log('✅ Traducción completada exitosamente');
      
      // Aquí podrías notificar al usuario por webhook, email, etc.
      // Por ahora solo logueamos el éxito
      
    } catch (translationError) {
      console.error('❌ Error durante la traducción:', translationError);
      
      // Limpiar archivos en caso de error
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        console.error('Error limpiando archivos:', cleanupError);
      }
    }

  } catch (error) {
    console.error('❌ Error general en translate-video:', error);
    
    // Limpiar archivo subido en caso de error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error limpiando archivo:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// RUTA: GET /translate-video/status/:processing_id
router.get('/translate-video/status/:processing_id', (req, res) => {
  try {
    const processingId = req.params.processing_id;
    const uploadsDir = path.join(__dirname, 'uploads');
    const originalFile = path.join(uploadsDir, processingId);
    const translatedFile = path.join(uploadsDir, 'translated_' + processingId);

    // Verificar estados
    const originalExists = fs.existsSync(originalFile);
    const translatedExists = fs.existsSync(translatedFile);

    if (!originalExists && !translatedExists) {
      return res.status(404).json({
        status: 'not_found',
        message: 'No se encontró el video con ese ID de procesamiento'
      });
    }

    if (translatedExists) {
      // Archivo traducido existe - procesamiento completado
      const stats = fs.statSync(translatedFile);
      return res.json({
        status: 'completed',
        message: 'Traducción completada',
        file_size: stats.size,
        download_url: `/translate-video/download/${processingId}`
      });
    }

    if (originalExists) {
      // Solo archivo original existe - aún procesando
      return res.json({
        status: 'processing',
        message: 'Video en proceso de traducción'
      });
    }

  } catch (error) {
    console.error('Error verificando estado:', error);
    res.status(500).json({
      error: 'Error verificando estado del procesamiento'
    });
  }
});

// RUTA: GET /translate-video/download/:processing_id
router.get('/translate-video/download/:processing_id', (req, res) => {
  try {
    const processingId = req.params.processing_id;
    const uploadsDir = path.join(__dirname, 'uploads');
    const translatedFile = path.join(uploadsDir, 'translated_' + processingId);

    if (!fs.existsSync(translatedFile)) {
      return res.status(404).json({
        error: 'Archivo no encontrado',
        message: 'El video traducido no existe o aún está procesándose'
      });
    }

    // Configurar headers para descarga
    const originalName = processingId.replace(/video-\d+-\d+/, 'translated_video');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'video/mp4');

    // Enviar archivo
    const fileStream = fs.createReadStream(translatedFile);
    fileStream.pipe(res);

    // Limpiar archivos después de la descarga (opcional)
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          const originalFile = path.join(uploadsDir, processingId);
          if (fs.existsSync(originalFile)) fs.unlinkSync(originalFile);
          if (fs.existsSync(translatedFile)) fs.unlinkSync(translatedFile);
          console.log(`🗑️ Archivos limpiados para ${processingId}`);
        } catch (cleanupError) {
          console.error('Error limpiando archivos:', cleanupError);
        }
      }, 5000); // Esperar 5 segundos después de completar descarga
    });

  } catch (error) {
    console.error('Error descargando archivo:', error);
    res.status(500).json({
      error: 'Error descargando archivo'
    });
  }
});

// RUTA: GET /translate-video/health
router.get('/translate-video/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Video Translation API',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /translate-video': 'Subir video para traducir',
      'GET /translate-video/status/:id': 'Verificar estado de traducción',
      'GET /translate-video/download/:id': 'Descargar video traducido',
      'GET /translate-video/health': 'Estado del servicio'
    }
  });
});

module.exports = router; 