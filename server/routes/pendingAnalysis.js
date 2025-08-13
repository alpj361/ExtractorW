const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { transcribeFile, transcribeImageWithGemini } = require('../services/transcription');
const { checkCreditsFunction, debitCreditsFunction } = require('../middlewares/credits');
const { verifyUserAccess } = require('../middlewares/auth');
const supabase = require('../utils/supabase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Función para generar descripción basada en transcripción
async function generateDescriptionFromTranscription(transcription, url = null) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('❌ GEMINI_API_KEY no configurada, saltando generación de descripción');
            return null;
        }

        const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Analiza la siguiente transcripción de un audio/video de X (Twitter) y genera una descripción concisa y útil.

TRANSCRIPCIÓN:
"""
${transcription}
"""

INSTRUCCIONES:
1. Identifica el tema principal y los puntos clave mencionados
2. Describe el tipo de contenido (entrevista, opinión, noticia, explicación, etc.)
3. Menciona si hay datos importantes, nombres relevantes o información específica
4. Mantén un tono profesional y objetivo
5. Máximo 150 caracteres para que sea útil como descripción

FORMATO DE RESPUESTA:
Solo devuelve la descripción en texto plano, sin JSON ni formateo adicional.

Ejemplos de buenas descripciones:
- "Entrevista sobre políticas públicas con datos estadísticos y propuestas específicas"
- "Explicación detallada del proceso electoral guatemalteco con ejemplos prácticos"
- "Análisis político sobre declaraciones presidenciales con contexto histórico"

Genera una descripción similar basada en la transcripción proporcionada.`;

        console.log('🤖 Generando descripción con Gemini...');
        const result = await model.generateContent(prompt);
        const description = result.response.text().trim();
        
        console.log('✅ Descripción generada:', description.substring(0, 100) + '...');
        return description;

    } catch (error) {
        console.error('❌ Error generando descripción:', error);
        return null;
    }
}

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
                download_images: true,
                quality: 'medium'
            }, {
                timeout: 60000,
                headers: { 'Content-Type': 'application/json' }
            });

            // Extraer campos relevantes considerando la nueva estructura { status, message, data }
            const { status, message: respMessage, data: respData } = response.data || {};
            const downloadedFiles = respData?.downloaded_files || respData?.files || response.data.downloaded_files || [];

            if (status === 'success') {
                if (downloadedFiles.length > 0) {
                    console.log(`✅ Descarga exitosa (${downloadedFiles.length} archivos) usando ${baseUrl}`);
                } else {
                    console.warn(`⚠️ Descarga sin medios desde ${baseUrl} (solo texto del tweet)`);
                }
                return {
                    success: true,
                    files: downloadedFiles,
                    message: respMessage,
                    baseUrl,
                    tweet_text: respData?.tweet_text || null
                };
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
        message: 'No se pudo descargar medios desde ninguna instancia de ExtractorT',
        tweet_text: null
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
            
            if (transcriptionResult.success === false) {
                console.warn('⚠️ Transcripción fallida, no se obtuvo audio. Se usará análisis básico.');
                return {
                    type: 'transcription_error',
                    result: `No se pudo transcribir audio del video ${fileName}. (${transcriptionResult.error})`,
                    metadata: transcriptionResult
                };
            }
            
            return {
                type: 'transcription',
                result: transcriptionResult.transcription,
                metadata: transcriptionResult.metadata
            };
            
        } else if (imageFormats.includes(fileExt)) {
            // Para imágenes, generar transcripción/descripción usando Gemini Vision
            console.log(`🖼️ Generando transcripción de imagen vía Gemini: ${fileName}`);
            try {
                const imgResult = await transcribeImageWithGemini(filePath, {
                    prompt: `Describe detalladamente el contenido de esta imagen de X (Twitter) en español. Si la imagen contiene texto, transcríbelo exactamente como aparece.`
                });

                return {
                    type: 'image_transcription',
                    result: imgResult.transcription,
                    metadata: imgResult.metadata
                };
            } catch (visionError) {
                console.error('❌ Error en Gemini Vision, usando fallback básico:', visionError.message);
                return {
                    type: 'image_analysis',
                    result: `Imagen descargada: ${fileName}. No se pudo generar transcripción automática.`,
                    metadata: {
                        fileName: fileName,
                        fileType: fileExt.substring(1).toUpperCase(),
                        timestamp: new Date().toISOString(),
                        error: visionError.message
                    }
                };
            }
        } else {
            // Archivo no compatible
            throw new Error(`Formato de archivo no compatible: ${fileExt}`);
        }
        
    } catch (error) {
        console.error(`❌ Error procesando archivo: ${error.message}`);
        throw error;
    }
}

// Endpoint para analizar enlaces multimedia (ya no requiere etiqueta "pendiente-analisis")
router.post('/analyze-pending-links', verifyUserAccess, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            itemIds = null, // IDs específicos a procesar (opcional)
            processAll = false, // Si procesar enlaces recientes (últimos 30 días)
            dryRun = false, // Solo simular, no realizar cambios
            shouldGenerateDescription = false // Si generar descripción con IA después de transcripción
        } = req.body;
        
        console.log(`🔍 Iniciando análisis de enlaces multimedia para usuario: ${userId}`);
        console.log(`🤖 Generar descripción con IA: ${shouldGenerateDescription}`);
        
        // Obtener enlaces para procesar - usar consulta más simple para evitar problemas
        console.log(`📊 Construyendo consulta para obtener enlaces para procesar...`);
        console.log(`👤 User ID: ${userId}`);
        
        let pendingItems, fetchError;
        
        try {
            // Primero intentar consulta simplificada si hay IDs específicos
            if (itemIds && itemIds.length > 0) {
                console.log(`🎯 Filtrando por IDs específicos: ${itemIds.join(', ')}`);
                console.log(`🔄 Ejecutando consulta específica a Supabase...`);
                
                const { data, error } = await supabase
                    .from('codex_items')
                    .select('*')
                    .eq('user_id', userId)
                    .in('id', itemIds);
                
                // Aceptar tanto el esquema antiguo (tipo = 'enlace') como el nuevo (tipo = 'item' + original_type = 'link')
                pendingItems = (data || []).filter((i) => i && (i.tipo === 'enlace' || (i.tipo === 'item' && (i.original_type === 'link' || i.original_type === 'enlace'))));
                fetchError = error;
                
                console.log(`✅ Consulta específica completada. Encontrados ${pendingItems?.length || 0} elementos`);
                
                // Ya no filtramos por etiqueta "pendiente-analisis" ya que se eliminó del sistema
                // Procesamos directamente los enlaces especificados por ID
                console.log(`✅ Enlaces específicos para procesar: ${pendingItems?.length || 0}`);
            } else {
                // Consulta general para todos los enlaces del usuario
                console.log(`🔄 Ejecutando consulta general a Supabase...`);
                
                const { data, error } = await supabase
                    .from('codex_items')
                    .select('*')
                    .eq('user_id', userId)
                    .in('tipo', ['enlace', 'item']);
                
                // Filtrar por tipos soportados
                pendingItems = (data || []).filter((i) => i && (i.tipo === 'enlace' || (i.tipo === 'item' && (i.original_type === 'link' || i.original_type === 'enlace'))));
                fetchError = error;
                
                console.log(`✅ Consulta general completada. Encontrados ${pendingItems?.length || 0} enlaces totales`);
                
                // Para consulta general, filtramos enlaces recientes (últimos 30 días) para evitar procesar demasiados
                if (pendingItems && !fetchError) {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    
                    pendingItems = pendingItems.filter(item => {
                        const itemDate = new Date(item.created_at);
                        return itemDate >= thirtyDaysAgo;
                    });
                    console.log(`📅 Filtrados por fecha (últimos 30 días): ${pendingItems.length} enlaces recientes`);
                }
            }
        } catch (queryError) {
            console.error(`❌ Error en consulta a Supabase:`, queryError);
            fetchError = queryError;
            pendingItems = null;
        }
        
        console.log(`🔍 Verificando errores de consulta...`);
        if (fetchError) {
            console.error('❌ Error obteniendo elementos pendientes:', fetchError);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener elementos pendientes',
                error: fetchError.message
            });
        }
        
        console.log(`📊 Verificando resultados de consulta...`);
        if (!pendingItems || pendingItems.length === 0) {
            console.log(`ℹ️ No se encontraron enlaces para procesar`);
            return res.json({
                success: true,
                message: 'No hay enlaces para procesar (sin IDs específicos o sin enlaces recientes)',
                processed: 0,
                results: []
            });
        }
        
        console.log(`📋 Encontrados ${pendingItems.length} enlaces para procesar`);
        console.log(`🔄 Iniciando procesamiento de enlaces...`);
        
        const results = [];
        let processedCount = 0;
        let totalCreditsUsed = 0;
        
        console.log(`🎯 Iniciando bucle de procesamiento para ${pendingItems.length} elementos...`);
        
        for (let index = 0; index < pendingItems.length; index++) {
            const item = pendingItems[index];
            try {
                console.log(`\n🔄 Procesando item ${index + 1}/${pendingItems.length}: ${item.id} - ${item.titulo}`);
                
                // Compatibilidad con nuevo modelo: usar source_url cuando url esté vacío
                const url = item.url || item.source_url;
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
                
                console.log(`🔗 URL del item: ${url}`);
                
                // Verificar si es URL multimedia
                console.log(`🔍 Verificando si es URL multimedia...`);
                const isMultimedia = isMediaUrl(url);
                console.log(`📱 Es multimedia: ${isMultimedia}`);
                
                if (!isMultimedia) {
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
                    console.log(`💰 Verificando créditos para análisis multimedia...`);
                    // Verificar créditos (5 créditos para multimedia)
                    const creditsCheck = await checkCreditsFunction(userId, 5);
                    console.log(`💰 Resultado verificación créditos: ${creditsCheck.hasCredits}`);
                    if (!creditsCheck.hasCredits) {
                        console.log(`❌ Créditos insuficientes para ${item.id}`);
                        results.push({
                            itemId: item.id,
                            success: false,
                            message: 'Créditos insuficientes para análisis multimedia',
                            creditsUsed: 0
                        });
                        continue;
                    }
                    console.log(`✅ Créditos verificados correctamente`);
                }
                
                // Descargar medios con timeout
                console.log(`📥 Iniciando descarga de medios para: ${url}`);
                
                let downloadResult;
                try {
                    // Crear timeout para descarga (máximo 45 segundos)
                    const downloadPromise = downloadMediaFromUrl(url);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Timeout: La descarga tardó más de 45 segundos')), 45000);
                    });
                    
                    downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
                    console.log(`📥 Resultado de descarga:`, downloadResult.success ? 'ÉXITO' : 'FALLO');
                } catch (downloadTimeout) {
                    console.error(`⏰ Timeout en descarga de medios: ${downloadTimeout.message}`);
                    downloadResult = {
                        success: false,
                        files: [],
                        message: `Timeout en descarga: ${downloadTimeout.message}`,
                        tweet_text: null
                    };
                }
                
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
                const usedBaseUrl = downloadResult.baseUrl || candidateBaseUrls.find(u=>u);

                // NUEVO: Obtener tweet_text de la respuesta de descarga
                const tweetText = downloadResult.tweet_text || null;
                let combinedTranscription = null;

                for (const file of downloadResult.files) {
                    try {
                        let effectivePath = file.path || file.filepath;
                        if (!effectivePath || !fs.existsSync(effectivePath)) {
                            // Construir URL del endpoint /media/ en ExtractorT
                            let remoteFileUrl = file.url;
                            
                            // Si la URL es relativa (/media/filename), construir URL completa
                            if (remoteFileUrl && remoteFileUrl.startsWith('/media/')) {
                                remoteFileUrl = `${usedBaseUrl.replace(/\/$/, '')}${remoteFileUrl}`;
                            } else if (!remoteFileUrl && usedBaseUrl) {
                                // Fallback: construir URL usando filename
                                remoteFileUrl = `${usedBaseUrl.replace(/\/$/, '')}/media/${encodeURIComponent(file.filename)}`;
                            }
                            
                            if (!remoteFileUrl) {
                                throw new Error('Ruta de archivo inaccesible y no se pudo construir URL remota');
                            }

                            const tempDir = '/tmp';
                            let rawName = file.filename || path.basename(remoteFileUrl);
                            try { rawName = decodeURIComponent(rawName);} catch {}
                            if (rawName.includes('?')) {
                                rawName = rawName.split('?')[0];
                            }
                            const localFilename = `${Date.now()}_${rawName}`;
                            effectivePath = path.join(tempDir, localFilename);

                            console.log(`⬇️ Descargando archivo faltante desde ${remoteFileUrl} a ${effectivePath}`);
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
                            // Combinar tweet_text con la transcripción si está disponible
                            if (tweetText && processResult.result) {
                                combinedTranscription = `${tweetText}\n-----\n${processResult.result}`;
                            } else {
                                combinedTranscription = processResult.result;
                            }
                            // Si está habilitada la generación de descripción, generar descripción basada en la combinación
                            if (shouldGenerateDescription && !dryRun) {
                                console.log('🤖 Generando descripción basada en tweet_text + transcripción...');
                                const aiDescription = await generateDescriptionFromTranscription(combinedTranscription, item.url);
                                if (aiDescription) {
                                    try {
                                        const { error: descUpdateError } = await supabase
                                            .from('codex_items')
                                            .update({ descripcion: aiDescription })
                                            .eq('id', item.id);
                                        if (descUpdateError) {
                                            console.error('❌ Error actualizando descripción del item:', descUpdateError);
                                        } else {
                                            console.log('✅ Descripción del item actualizada con IA (solo resumen)');
                                        }
                                    } catch (descError) {
                                        console.error('❌ Error en actualización de descripción:', descError);
                                    }
                                } else {
                                    console.log('⚠️ No se pudo generar descripción IA');
                                }
                            }
                            // Guardar el texto combinado en analisis_detallado
                            finalAnalysis += `\n\n[TRANSCRIPCIÓN - ${fileName}]\n${combinedTranscription}`;
                        } else if (processResult.type === 'image_transcription') {
                            // Generar combinación con tweetText si existe
                            if (tweetText && processResult.result) {
                                combinedTranscription = `${tweetText}\n-----\n${processResult.result}`;
                            } else {
                                combinedTranscription = processResult.result;
                            }

                            // Guardar descripción IA si aplica
                            if (shouldGenerateDescription && !dryRun) {
                                try {
                                    console.log('🤖 Generando descripción basada en tweet_text + transcripción de imagen...');
                                    const aiDescription = await generateDescriptionFromTranscription(combinedTranscription, item.url);
                                    if (aiDescription) {
                                        const { error: descUpdateError } = await supabase
                                            .from('codex_items')
                                            .update({ descripcion: aiDescription })
                                            .eq('id', item.id);
                                        if (descUpdateError) {
                                            console.error('❌ Error actualizando descripción del item:', descUpdateError);
                                        }
                                    }
                                } catch(e){ console.error('❌ Error generando descripción IA:', e);} 
                            }

                            finalAnalysis += `\n\n[TRANSCRIPCIÓN IMAGEN - ${fileName}]\n${processResult.result}`;
                        } else if (processResult.type === 'image_analysis') {
                            finalAnalysis += `\n\n[ANÁLISIS DE IMAGEN - ${fileName}]\n${processResult.result}`;
                        } else if (processResult.type === 'transcription_error') {
                            finalAnalysis += `\n\n[ERROR TRANSCRIPCIÓN - ${fileName}]\n${processResult.result}`;
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
                await supabase
                    .from('codex_items')
                    .update({ analisis_detallado: finalAnalysis })
                    .eq('id', item.id);
                
                // NUEVO: Actualizar también el campo transcripcion con el texto combinado
                if (combinedTranscription) {
                    console.log('🟢 Guardando en transcripcion:', combinedTranscription);
                    await supabase
                        .from('codex_items')
                        .update({ transcripcion: combinedTranscription })
                        .eq('id', item.id);
                    const { data: txAfter, error: txErr } = await supabase
                        .from('codex_items')
                        .select('transcripcion, audio_transcription')
                        .eq('id', item.id);
                    if (txErr) {
                        console.error('❌ Error verificando transcripción después del update:', txErr);
                    } else {
                        console.log('🟢 Valor en supabase después de update (transcripcion):', txAfter && txAfter[0] && txAfter[0].transcripcion);
                        console.log('🟢 Valor en supabase después de update (audio_transcription):', txAfter && txAfter[0] && txAfter[0].audio_transcription);
                    }
                }
                
                // --- NUEVO: Manejar tweets sin media descargada ---
                if (downloadResult.files.length === 0 && tweetText) {
                    console.log('📝 Tweet sin media: usando tweet.text como transcripción');
                    combinedTranscription = tweetText;

                    // Generar descripción IA si corresponde
                    if (shouldGenerateDescription && !dryRun) {
                        try {
                            console.log('🤖 Generando descripción basada en tweet_text (sin media)...');
                            const aiDescription = await generateDescriptionFromTranscription(combinedTranscription, item.url);
                            if (aiDescription) {
                                const { error: descUpdateError } = await supabase
                                    .from('codex_items')
                                    .update({ descripcion: aiDescription })
                                    .eq('id', item.id);
                                if (descUpdateError) {
                                    console.error('❌ Error actualizando descripción del item:', descUpdateError);
                                } else {
                                    console.log('✅ Descripción del item actualizada con IA (solo tweet texto)');
                                }
                            }
                        } catch (tweetDescErr) {
                            console.error('❌ Error generando descripción IA para tweet sin media:', tweetDescErr);
                        }
                    }

                    finalAnalysis += `\n\n[TRANSCRIPCIÓN - TWEET]\n${tweetText}`;

                    // Actualizar campos de transcripción directamente
                    try {
                        await supabase
                            .from('codex_items')
                            .update({
                                transcripcion: combinedTranscription,
                                audio_transcription: combinedTranscription
                            })
                            .eq('id', item.id);
                        console.log('✅ Campos transcripcion y audio_transcription actualizados con tweet_text');
                    } catch (txUpdateErr) {
                        console.error('❌ Error actualizando campos de transcripción:', txUpdateErr);
                    }
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
                    analysisType: 'final',
                    tweetData: {
                        source: url,
                        text: tweetText,
                        timestamp: new Date().toISOString(),
                        media_url: downloadResult.files && downloadResult.files.length > 0 ? (downloadResult.files[0].url || null) : null,
                        type: downloadResult.files && downloadResult.files.length > 0 ? (/\.(jpg|jpeg|png|gif|webp)$/i.test(downloadResult.files[0].filename || '') ? 'image' : 'other') : 'text',
                        transcription: combinedTranscription
                    }
                });
                
                processedCount++;
                console.log(`✅ Item ${index + 1}/${pendingItems.length} completado exitosamente`);
                
            } catch (error) {
                console.error(`❌ Error procesando item ${index + 1}/${pendingItems.length}: ${item.id} - ${item.titulo}:`, error);
                results.push({
                    itemId: item.id,
                    success: false,
                    message: error.message,
                    creditsUsed: 0
                });
                processedCount++;
                console.log(`💥 Item ${index + 1}/${pendingItems.length} completado con error`);
            }
            
            console.log(`📊 Progreso: ${index + 1}/${pendingItems.length} procesados hasta ahora`);
        }
        
        console.log(`🎉 Bucle de procesamiento completado. Total procesados: ${processedCount}`);
        console.log(`💰 Total créditos usados: ${totalCreditsUsed}`);
        
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

// Exportar función para pruebas
module.exports.generateDescriptionFromTranscription = generateDescriptionFromTranscription;