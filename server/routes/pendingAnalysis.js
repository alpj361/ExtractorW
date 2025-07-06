const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { transcribeFile } = require('../services/transcription');
const { checkCreditsFunction, debitCreditsFunction } = require('../middlewares/credits');
const { verifyUserAccess } = require('../middlewares/auth');
const supabase = require('../utils/supabase');

// Función para detectar si una URL es multimedia (videos, imágenes, etc.)
function isMediaUrl(url) {
    const mediaPatterns = [
        /twitter\.com\/\w+\/status\/\d+/,
        /x\.com\/\w+\/status\/\d+/,
        /youtube\.com\/watch\?v=/,
        /youtu\.be\//,
        /instagram\.com\/p\//,
        /tiktok\.com\/@[\w.]+\/video\/\d+/,
        /facebook\.com\/\w+\/videos\/\d+/,
        /vimeo\.com\/\d+/,
        /twitch\.tv\/videos\/\d+/,
        /\.(mp4|mov|avi|mkv|webm|m4v|mp3|wav|aac|ogg|flac|m4a|jpg|jpeg|png|gif|webp)$/i
    ];
    
    return mediaPatterns.some(pattern => pattern.test(url));
}

// Función para descargar medios desde ExtractorT
async function downloadMediaFromUrl(url) {
    const candidateBaseUrls = [];

    const isProduction = process.env.NODE_ENV === 'production';

    // 1) URL explícita de entorno LOCAL (tiene prioridad absoluta si existe)
    if (process.env.EXTRACTORT_LOCAL_URL) {
        candidateBaseUrls.push(process.env.EXTRACTORT_LOCAL_URL);
    }

    // 2) Servicio interno docker-compose (ExtractorW y ExtractorT misma red)
    candidateBaseUrls.push('http://extractor_api:8000');

    // 3) Puerto publicado al host (cuando ExtractorT corre en Docker y ExtractorW fuera de Docker)
    candidateBaseUrls.push('http://localhost:8000');

    // 4) Gateway especial hacia el host desde un contenedor (ExtractorW dentro de Docker)
    candidateBaseUrls.push('http://host.docker.internal:8000');

    // 5) URL de producción (solo si estamos en producción o no hay otra opción)
    if (isProduction && process.env.EXTRACTORT_URL) {
        candidateBaseUrls.push(process.env.EXTRACTORT_URL);
    } else if (!isProduction && process.env.EXTRACTORT_URL) {
        // Colocar al final como último recurso
        candidateBaseUrls.push(process.env.EXTRACTORT_URL);
    }

    console.log('🔗 URLs candidatas ExtractorT:', candidateBaseUrls.join(' | '));

    // Iterar sobre las URLs candidatas hasta que una funcione
    for (const baseUrl of candidateBaseUrls) {
        try {
            console.log(`📥 Descargando medios desde: ${url} vía ${baseUrl}`);

            const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/download_media`, {
                tweet_url: url,
                download_videos: true,
                download_images: false,
                quality: 'medium'
            }, {
                timeout: 60000,
                headers: { 'Content-Type': 'application/json' }
            });

            // Extraer campos relevantes considerando la nueva estructura { status, message, data }
            const { status, message: respMessage, data: respData } = response.data || {};
            const downloadedFiles = respData?.downloaded_files || respData?.files || response.data.downloaded_files || [];

            if (status === 'success' && downloadedFiles.length > 0) {
                console.log(`✅ Descarga exitosa (${downloadedFiles.length} archivos) usando ${baseUrl}`);
                return {
                    success: true,
                    files: downloadedFiles,
                    message: respMessage,
                    baseUrl
                };
            } else {
                console.warn(`⚠️ Descarga sin archivos desde ${baseUrl}: ${respMessage || 'Sin mensaje'}`);
            }
        } catch (err) {
            console.warn(`⚠️ Fallo al intentar ${baseUrl}: ${err.message}`);
            // Continúa con la siguiente URL candidata
        }
    }

    // Si llegamos aquí ninguna URL funcionó
    return {
        success: false,
        files: [],
        message: 'No se pudo descargar medios desde ninguna instancia de ExtractorT'
    };
}

// Función para procesar un archivo descargado
async function processDownloadedFile(filePath, fileName, userId, itemId) {
    try {
        console.log(`🔄 Procesando archivo: ${fileName}`);
        
        // Verificar si el archivo existe
        if (!fs.existsSync(filePath)) {
            throw new Error(`Archivo no encontrado: ${filePath}`);
        }
        
        // Limpiar nombre de archivo (quitar query params y decodificar)
        let cleanName = fileName;
        try {
            cleanName = decodeURIComponent(fileName);
        } catch {}
        if (cleanName.includes('?')) {
            cleanName = cleanName.split('?')[0];
        }
        // Algunos nombres vienen con %3fname%3dsmall... ya decodificado lo anterior elimina parte posterior
        const fileExt = path.extname(cleanName).toLowerCase();
        const audioFormats = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a'];
        const videoFormats = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
        const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        if (audioFormats.includes(fileExt) || videoFormats.includes(fileExt)) {
            // Transcribir audio/video
            console.log(`🎵 Transcribiendo archivo de audio/video: ${fileName}`);
            const transcriptionResult = await transcribeFile(filePath, userId, {
                updateItemId: itemId, // Actualizar el item existente con la transcripción
                noAutoTags: true // No crear etiquetas automáticamente
            });
            
            return {
                type: 'transcription',
                result: transcriptionResult.transcription,
                metadata: transcriptionResult.metadata
            };
            
        } else if (imageFormats.includes(fileExt)) {
            // Para imágenes, hacer análisis descriptivo básico
            console.log(`🖼️ Analizando imagen: ${fileName}`);
            return {
                type: 'image_analysis',
                result: `Imagen descargada: ${fileName}. Archivo de tipo ${fileExt.substring(1).toUpperCase()} listo para análisis visual.`,
                metadata: {
                    fileName: fileName,
                    fileType: fileExt.substring(1).toUpperCase(),
                    timestamp: new Date().toISOString()
                }
            };
            
        } else {
            // Archivo no compatible
            throw new Error(`Formato de archivo no compatible: ${fileExt}`);
        }
        
    } catch (error) {
        console.error(`❌ Error procesando archivo: ${error.message}`);
        throw error;
    }
}

// Endpoint principal para analizar enlaces pendientes
router.post('/analyze-pending-links', verifyUserAccess, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            itemIds = null, // IDs específicos a procesar (opcional)
            processAll = false, // Si procesar todos los pendientes
            dryRun = false // Solo simular, no realizar cambios
        } = req.body;
        
        console.log(`🔍 Iniciando análisis de enlaces pendientes para usuario: ${userId}`);
        
        // Obtener enlaces pendientes de análisis
        let query = supabase
            .from('codex_items')
            .select('*')
            .eq('user_id', userId)
            .eq('tipo', 'enlace')
            .contains('etiquetas', ['pendiente-analisis']);
        
        if (itemIds && itemIds.length > 0) {
            query = query.in('id', itemIds);
        }
        
        const { data: pendingItems, error: fetchError } = await query;
        
        if (fetchError) {
            console.error('❌ Error obteniendo elementos pendientes:', fetchError);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener elementos pendientes',
                error: fetchError.message
            });
        }
        
        if (!pendingItems || pendingItems.length === 0) {
            return res.json({
                success: true,
                message: 'No hay enlaces pendientes de análisis',
                processed: 0,
                results: []
            });
        }
        
        console.log(`📋 Encontrados ${pendingItems.length} enlaces pendientes`);
        
        const results = [];
        let processedCount = 0;
        let totalCreditsUsed = 0;
        
        for (const item of pendingItems) {
            try {
                console.log(`\n🔄 Procesando item: ${item.id} - ${item.titulo}`);
                
                const url = item.url;
                if (!url) {
                    console.log(`⚠️ Item sin URL: ${item.id}`);
                    results.push({
                        itemId: item.id,
                        success: false,
                        message: 'Item sin URL',
                        creditsUsed: 0
                    });
                    continue;
                }
                
                // Verificar si es URL multimedia
                if (!isMediaUrl(url)) {
                    console.log(`⚠️ URL no es multimedia: ${url}`);
                    
                    // Procesar como enlace básico (menos créditos)
                    const basicAnalysis = `Enlace analizado: ${url}. Título: ${item.titulo}. Descripción: ${item.descripcion || 'Sin descripción'}.`;
                    
                    if (!dryRun) {
                        // Verificar créditos (5 créditos para análisis básico)
                        const creditsCheck = await checkCreditsFunction(userId, 5);
                        if (!creditsCheck.hasCredits) {
                            results.push({
                                itemId: item.id,
                                success: false,
                                message: 'Créditos insuficientes para análisis básico',
                                creditsUsed: 0
                            });
                            continue;
                        }
                        
                        // Actualizar item con análisis básico
                        const { error: updateError } = await supabase
                            .from('codex_items')
                            .update({
                                descripcion: item.descripcion ? `${item.descripcion}\n\n[ANÁLISIS BÁSICO]\n${basicAnalysis}` : basicAnalysis
                            })
                            .eq('id', item.id);
                        
                        if (updateError) {
                            throw updateError;
                        }
                        
                        // No debitar créditos si es admin
                        const adminCheck = await checkCreditsFunction(userId, 0);
                        const creditsToDebit = adminCheck.isAdmin ? 0 : 5;
                        if (creditsToDebit > 0) {
                            await debitCreditsFunction(userId, creditsToDebit, 'basic_link_analysis', { itemId: item.id, url });
                            totalCreditsUsed += creditsToDebit;
                        }
                    }
                    
                    results.push({
                        itemId: item.id,
                        success: true,
                        message: 'Análisis básico completado',
                        creditsUsed: 5,
                        analysisType: 'basic'
                    });
                    
                    processedCount++;
                    continue;
                }
                
                // Es URL multimedia, procesar descarga
                console.log(`📱 URL multimedia detectada: ${url}`);
                
                if (!dryRun) {
                    // Verificar créditos (5 créditos para multimedia)
                    const creditsCheck = await checkCreditsFunction(userId, 5);
                    if (!creditsCheck.hasCredits) {
                        results.push({
                            itemId: item.id,
                            success: false,
                            message: 'Créditos insuficientes para análisis multimedia',
                            creditsUsed: 0
                        });
                        continue;
                    }
                }
                
                // Descargar medios
                const downloadResult = await downloadMediaFromUrl(url);
                
                if (!downloadResult.success) {
                    console.log(`❌ Falló descarga: ${downloadResult.message}`);
                    
                    // Continuar con análisis básico si falla la descarga
                    const basicAnalysis = `Enlace multimedia procesado: ${url}. Descarga falló: ${downloadResult.message}. Análisis básico realizado.`;
                    
                    if (!dryRun) {
                        // Verificar créditos para análisis básico
                        const creditsCheck = await checkCreditsFunction(userId, 5);
                        if (!creditsCheck.hasCredits) {
                            results.push({
                                itemId: item.id,
                                success: false,
                                message: 'Créditos insuficientes para análisis básico',
                                creditsUsed: 0
                            });
                            continue;
                        }
                        
                        // Actualizar con análisis básico
                        const { error: updateError } = await supabase
                            .from('codex_items')
                            .update({
                                descripcion: item.descripcion ? `${item.descripcion}\n\n[ANÁLISIS BÁSICO]\n${basicAnalysis}` : basicAnalysis
                            })
                            .eq('id', item.id);
                        
                        if (updateError) {
                            throw updateError;
                        }
                        
                        // No debitar créditos si es admin
                        const adminCheck = await checkCreditsFunction(userId, 0);
                        const creditsToDebit = adminCheck.isAdmin ? 0 : 5;
                        if (creditsToDebit > 0) {
                            await debitCreditsFunction(userId, creditsToDebit, 'basic_link_analysis', { itemId: item.id, url });
                            totalCreditsUsed += creditsToDebit;
                        }
                    }
                    
                    results.push({
                        itemId: item.id,
                        success: true,
                        message: 'Análisis básico completado (descarga falló)',
                        creditsUsed: 5,
                        analysisType: 'basic_fallback'
                    });
                    
                    processedCount++;
                    continue;
                }
                
                // Procesar archivos descargados
                let finalAnalysis = '';
                const tempFilesToCleanup = [];
                
                const usedBaseUrl = downloadResult.baseUrl || candidateBaseUrls.find(u=>u); // fallback just in case

                for (const file of downloadResult.files) {
                    try {
                        let effectivePath = file.path || file.filepath;
                        if (!effectivePath || !fs.existsSync(effectivePath)) {
                            // Construir URL del endpoint /media/ en ExtractorT si existe
                            let remoteFileUrl = file.url;
                            if (!remoteFileUrl && usedBaseUrl) {
                                remoteFileUrl = `${usedBaseUrl.replace(/\/$/, '')}/media/${encodeURIComponent(file.filename)}`;
                            }
                            if (!remoteFileUrl) {
                                throw new Error('Ruta de archivo inaccesible y no se pudo construir URL remota');
                            }

                            const tempDir = '/tmp';
                            const localFilename = `${Date.now()}_${file.filename || path.basename(remoteFileUrl)}`;
                            effectivePath = path.join(tempDir, localFilename);

                            console.log(`⬇️ Descargando archivo faltante a ${effectivePath}`);
                            const writer = fs.createWriteStream(effectivePath);
                            const resp = await axios.get(remoteFileUrl, { responseType: 'stream', timeout: 60000 });
                            await new Promise((resolve, reject) => {
                                resp.data.pipe(writer);
                                let error = null;
                                writer.on('error', err => {
                                    error = err;
                                    writer.close();
                                    reject(err);
                                });
                                writer.on('close', () => {
                                    if (!error) resolve();
                                });
                            });
                            console.log(`✅ Archivo descargado localmente (${(fs.statSync(effectivePath).size/1024/1024).toFixed(2)} MB)`);
                        }

                        const filePath = effectivePath;
                        const fileName = file.filename;
                        tempFilesToCleanup.push(filePath);
                        
                        const processResult = await processDownloadedFile(filePath, fileName, userId, item.id);
                        
                        if (processResult.type === 'transcription') {
                            finalAnalysis += `\n\n[TRANSCRIPCIÓN - ${fileName}]\n${processResult.result}`;
                        } else if (processResult.type === 'image_analysis') {
                            finalAnalysis += `\n\n[ANÁLISIS DE IMAGEN - ${fileName}]\n${processResult.result}`;
                        }
                        
                    } catch (procError) {
                        console.error(`❌ Error procesando ${file.filename}:`, procError);
                        finalAnalysis += `\n\n[ERROR - ${file.filename}]\nError procesando archivo: ${procError.message}`;
                    }
                }
                
                // Limpiar archivos temporales
                for (const tempFile of tempFilesToCleanup) {
                    try {
                        if (fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                            console.log(`✅ Archivo eliminado temporalmente: ${tempFile}`);
                        }
                    } catch (cleanupError) {
                        console.error(`❌ Error al intentar eliminar archivo temporal: ${cleanupError.message}`);
                    }
                }
                
                // Actualizar item con análisis final
                const { error: updateError } = await supabase
                    .from('codex_items')
                    .update({
                        descripcion: item.descripcion ? `${item.descripcion}\n\n[ANÁLISIS FINAL]\n${finalAnalysis}` : finalAnalysis
                    })
                    .eq('id', item.id);
                
                if (updateError) {
                    throw updateError;
                }
                
                // No debitar créditos si es admin
                const adminCheck = await checkCreditsFunction(userId, 0);
                // Costo fijo de 5 créditos para análisis multimedia (igual que básico)
                let calculatedCost = 5;
                const creditsToDebit = adminCheck.isAdmin ? 0 : calculatedCost;
                if (creditsToDebit > 0) {
                    await debitCreditsFunction(userId, creditsToDebit, 'final_link_analysis', { itemId: item.id, url });
                    totalCreditsUsed += creditsToDebit;
                }
                
                results.push({
                    itemId: item.id,
                    success: true,
                    message: 'Análisis final completado',
                    creditsUsed: creditsToDebit,
                    analysisType: 'final'
                });
                
                processedCount++;
                
            } catch (error) {
                console.error(`❌ Error procesando item: ${item.id} - ${item.titulo}:`, error);
                results.push({
                    itemId: item.id,
                    success: false,
                    message: error.message,
                    creditsUsed: 0
                });
                processedCount++;
            }
        }
        
        return res.json({
            success: true,
            message: 'Análisis de enlaces pendientes completado',
            processed: processedCount,
            totalCreditsUsed: totalCreditsUsed,
            results: results
        });
    } catch (error) {
        console.error('❌ Error al procesar análisis de enlaces pendientes:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al procesar análisis de enlaces pendientes',
            error: error.message
        });
    }
});

module.exports = router;