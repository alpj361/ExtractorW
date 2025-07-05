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
    const extractorTUrl = process.env.EXTRACTORT_URL || 'http://localhost:8000';
    
    try {
        console.log(`📥 Descargando medios desde: ${url}`);
        
        // Llamar al endpoint de media downloader de ExtractorT
        const response = await axios.get(`${extractorTUrl}/media/download`, {
            params: {
                tweet_url: url,
                download_videos: true,
                download_images: true,
                quality: 'medium'
            },
            timeout: 60000 // 60 segundos timeout
        });
        
        if (response.data.status === 'success' && response.data.downloaded_files.length > 0) {
            console.log(`✅ Descarga exitosa: ${response.data.downloaded_files.length} archivos`);
            return {
                success: true,
                files: response.data.downloaded_files,
                message: response.data.message
            };
        } else {
            console.log(`⚠️ Sin archivos descargados: ${response.data.message}`);
            return {
                success: false,
                files: [],
                message: response.data.message || 'No se encontraron archivos multimedia'
            };
        }
        
    } catch (error) {
        console.error(`❌ Error descargando medios: ${error.message}`);
        return {
            success: false,
            files: [],
            message: `Error al descargar medios: ${error.message}`
        };
    }
}

// Función para procesar un archivo descargado
async function processDownloadedFile(filePath, fileName, userId) {
    try {
        console.log(`🔄 Procesando archivo: ${fileName}`);
        
        // Verificar si el archivo existe
        if (!fs.existsSync(filePath)) {
            throw new Error(`Archivo no encontrado: ${filePath}`);
        }
        
        // Detectar el tipo de archivo
        const fileExt = path.extname(fileName).toLowerCase();
        const audioFormats = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a'];
        const videoFormats = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
        const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        if (audioFormats.includes(fileExt) || videoFormats.includes(fileExt)) {
            // Transcribir audio/video
            console.log(`🎵 Transcribiendo archivo de audio/video: ${fileName}`);
            const transcriptionResult = await transcribeFile(filePath, userId, {
                updateExistingItem: false // No crear nuevo item, solo obtener transcripción
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
                        const updatedTags = item.etiquetas.filter(tag => tag !== 'pendiente-analisis');
                        updatedTags.push('analizado');
                        
                        const { error: updateError } = await supabase
                            .from('codex_items')
                            .update({
                                descripcion: item.descripcion ? `${item.descripcion}\n\n[ANÁLISIS BÁSICO]\n${basicAnalysis}` : basicAnalysis,
                                etiquetas: updatedTags,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', item.id);
                        
                        if (updateError) {
                            throw updateError;
                        }
                        
                        // Debitar créditos
                        await debitCreditsFunction(userId, 5, 'basic_link_analysis', { itemId: item.id, url });
                        totalCreditsUsed += 5;
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
                    // Verificar créditos (25 créditos para multimedia)
                    const creditsCheck = await checkCreditsFunction(userId, 25);
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
                        const updatedTags = item.etiquetas.filter(tag => tag !== 'pendiente-analisis');
                        updatedTags.push('analizado');
                        
                        const { error: updateError } = await supabase
                            .from('codex_items')
                            .update({
                                descripcion: item.descripcion ? `${item.descripcion}\n\n[ANÁLISIS BÁSICO]\n${basicAnalysis}` : basicAnalysis,
                                etiquetas: updatedTags
                            })
                            .eq('id', item.id);
                        
                        if (updateError) {
                            throw updateError;
                        }
                        
                        // Debitar créditos básicos
                        await debitCreditsFunction(userId, 5, 'basic_link_analysis', { itemId: item.id, url });
                        totalCreditsUsed += 5;
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
                
                for (const file of downloadResult.files) {
                    try {
                        const filePath = file.path;
                        const fileName = file.filename;
                        tempFilesToCleanup.push(filePath);
                        
                        const processResult = await processDownloadedFile(filePath, fileName, userId);
                        
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
                            console.log(`🗑️ Archivo temporal eliminado: ${tempFile}`);
                        }
                    } catch (cleanupError) {
                        console.error(`⚠️ Error limpiando archivo temporal:`, cleanupError);
                    }
                }
                
                if (!dryRun) {
                    // Actualizar item con análisis multimedia
                    const updatedTags = item.etiquetas.filter(tag => tag !== 'pendiente-analisis');
                    updatedTags.push('analizado');
                    
                    const { error: updateError } = await supabase
                        .from('codex_items')
                        .update({
                            descripcion: item.descripcion ? `${item.descripcion}${finalAnalysis}` : finalAnalysis.trim(),
                            etiquetas: updatedTags
                        })
                        .eq('id', item.id);
                    
                    if (updateError) {
                        throw updateError;
                    }
                    
                    // Debitar créditos multimedia
                    await debitCreditsFunction(userId, 25, 'multimedia_analysis', { 
                        itemId: item.id, 
                        url,
                        filesProcessed: downloadResult.files.length
                    });
                    totalCreditsUsed += 25;
                }
                
                results.push({
                    itemId: item.id,
                    success: true,
                    message: 'Análisis multimedia completado',
                    creditsUsed: 25,
                    analysisType: 'multimedia',
                    filesProcessed: downloadResult.files.length
                });
                
                processedCount++;
                
            } catch (itemError) {
                console.error(`❌ Error procesando item ${item.id}:`, itemError);
                results.push({
                    itemId: item.id,
                    success: false,
                    message: `Error: ${itemError.message}`,
                    creditsUsed: 0
                });
            }
        }
        
        console.log(`\n✅ Análisis completado. Procesados: ${processedCount}/${pendingItems.length}`);
        
        return res.json({
            success: true,
            message: `Análisis completado. Procesados: ${processedCount}/${pendingItems.length}`,
            processed: processedCount,
            total: pendingItems.length,
            creditsUsed: totalCreditsUsed,
            results
        });
        
    } catch (error) {
        console.error('❌ Error en análisis de enlaces:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Endpoint para obtener estadísticas de enlaces pendientes
router.get('/pending-stats', verifyUserAccess, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const { data: pendingItems, error } = await supabase
            .from('codex_items')
            .select('id, url, titulo, created_at')
            .eq('user_id', userId)
            .eq('tipo', 'enlace')
            .contains('etiquetas', ['pendiente-analisis']);
        
        if (error) {
            throw error;
        }
        
        const stats = {
            totalPending: pendingItems.length,
            multimediaUrls: 0,
            basicUrls: 0,
            items: []
        };
        
        for (const item of pendingItems) {
            const isMultimedia = item.url ? isMediaUrl(item.url) : false;
            
            if (isMultimedia) {
                stats.multimediaUrls++;
            } else {
                stats.basicUrls++;
            }
            
            stats.items.push({
                id: item.id,
                titulo: item.titulo,
                url: item.url,
                isMultimedia,
                creditsRequired: isMultimedia ? 25 : 5,
                created_at: item.created_at
            });
        }
        
        return res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas',
            error: error.message
        });
    }
});

module.exports = router; 