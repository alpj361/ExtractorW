# Sistema de Análisis Automático de Enlaces Multimedia

## Descripción General

El Sistema de Análisis Automático de Enlaces Multimedia es una integración completa entre ExtractorW, ExtractorT y PulseJ que permite analizar automáticamente enlaces multimedia agregados al codex. El sistema descarga medios temporalmente, los procesa usando IA y genera transcripciones o análisis automáticamente.

## Arquitectura del Sistema

### Componentes Principales

1. **ExtractorW (Backend Principal)**
   - Endpoint de análisis de enlaces pendientes
   - Integración con sistema de transcripción existente
   - Gestión de créditos y autenticación
   - Actualización de elementos en base de datos

2. **ExtractorT (Scraper y Descarga)**
   - Servicio de descarga de medios
   - Soporte para múltiples plataformas (Twitter, YouTube, Instagram, etc.)
   - Descarga temporal de archivos multimedia

3. **PulseJ (Frontend)**
   - Interfaz para marcar enlaces como "pendiente-análisis"
   - Visualización de transcripciones y análisis
   - Gestión de etiquetas y proyectos

## Flujo de Procesamiento

### 1. Marcado de Enlaces (PulseJ)
```typescript
// Usuario agrega enlaces con checkbox "¿Analizar enlaces?"
const shouldAnalyzeLinks = true;
etiquetas: shouldAnalyzeLinks ? [...finalTags, 'pendiente-analisis'] : finalTags
```

### 2. Detección de URLs Multimedia
```javascript
// Patrones de detección automática
const mediaPatterns = [
    /twitter\.com\/\w+\/status\/\d+/,
    /x\.com\/\w+\/status\/\d+/,
    /youtube\.com\/watch\?v=/,
    /instagram\.com\/p\//,
    /tiktok\.com\/@[\w.]+\/video\/\d+/,
    /\.(mp4|mov|avi|mkv|webm|m4v|mp3|wav|aac|ogg|flac|m4a|jpg|jpeg|png|gif|webp)$/i
];
```

### 3. Descarga y Procesamiento
```javascript
// Descarga desde ExtractorT
const downloadResult = await downloadMediaFromUrl(url);

// Procesamiento según tipo de archivo
if (audioFormats.includes(fileExt) || videoFormats.includes(fileExt)) {
    // Transcripción con Gemini AI
    const transcriptionResult = await transcribeFile(filePath, userId);
} else if (imageFormats.includes(fileExt)) {
    // Análisis descriptivo básico
    const imageAnalysis = generateImageAnalysis(fileName);
}
```

## Endpoints Disponibles

### POST /api/pending-analysis/analyze-pending-links
Analiza enlaces marcados como pendientes.

**Request Body:**
```json
{
  "itemIds": ["id1", "id2"], // Opcional: IDs específicos
  "processAll": true,        // Procesar todos los pendientes
  "dryRun": false           // Simular sin hacer cambios
}
```

**Response:**
```json
{
  "success": true,
  "message": "Análisis completado. Procesados: 5/7",
  "processed": 5,
  "total": 7,
  "creditsUsed": 135,
  "results": [
    {
      "itemId": "abc123",
      "success": true,
      "message": "Análisis multimedia completado",
      "creditsUsed": 25,
      "analysisType": "multimedia",
      "filesProcessed": 2
    }
  ]
}
```

### GET /api/pending-analysis/pending-stats
Obtiene estadísticas de enlaces pendientes.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalPending": 12,
    "multimediaUrls": 8,
    "basicUrls": 4,
    "items": [
      {
        "id": "abc123",
        "titulo": "Video tutorial",
        "url": "https://youtube.com/watch?v=...",
        "isMultimedia": true,
        "creditsRequired": 25,
        "created_at": "2024-01-20T10:00:00Z"
      }
    ]
  }
}
```

## Sistema de Créditos

### Costos de Procesamiento
- **Enlaces multimedia**: 25 créditos
  - Incluye descarga y transcripción/análisis
  - Formatos: videos, audios, imágenes de redes sociales
- **Enlaces básicos**: 5 créditos
  - Análisis descriptivo simple
  - Enlaces web estándar

### Verificación de Créditos
```javascript
// Verificar créditos antes del procesamiento
const creditsCheck = await checkCredits(userId, creditsRequired);
if (!creditsCheck.hasCredits) {
    return { success: false, message: 'Créditos insuficientes' };
}

// Debitar créditos tras procesamiento exitoso
await debitCredits(userId, creditsUsed, 'multimedia_analysis', metadata);
```

## Formatos Soportados

### Multimedia (25 créditos)
- **Videos**: .mp4, .mov, .avi, .mkv, .webm, .m4v
- **Audios**: .mp3, .wav, .aac, .ogg, .flac, .m4a
- **Imágenes**: .jpg, .jpeg, .png, .gif, .webp
- **Plataformas**: Twitter/X, YouTube, Instagram, TikTok, Facebook, Vimeo, Twitch

### Básicos (5 créditos)
- Cualquier URL web que no sea multimedia
- Análisis descriptivo simple
- Procesamiento sin descarga

## Configuración y Dependencias

### Variables de Entorno
```bash
# ExtractorW
EXTRACTORT_URL=http://localhost:8000
GEMINI_API_KEY=your_gemini_api_key

# ExtractorT
NITTER_INSTANCES=https://nitter.poast.org,https://nitter.net
DOCKER_ENVIRONMENT=true  # Si se ejecuta en Docker
```

### Dependencias Requeridas
```json
{
  "ExtractorW": [
    "axios",
    "@google/generative-ai",
    "fluent-ffmpeg"
  ],
  "ExtractorT": [
    "playwright",
    "aiohttp",
    "fastapi"
  ]
}
```

## Instalación y Configuración

### 1. Configurar ExtractorW
```bash
cd ExtractorW
npm install axios @google/generative-ai fluent-ffmpeg
```

### 2. Configurar ExtractorT
```bash
cd ExtractorT
pip install playwright aiohttp fastapi
playwright install firefox
```

### 3. Variables de Entorno
```bash
# En ExtractorW/.env
EXTRACTORT_URL=http://localhost:8000
GEMINI_API_KEY=your_gemini_api_key

# En ExtractorT/.env
NITTER_INSTANCES=https://nitter.poast.org,https://nitter.net
```

## Uso del Sistema

### 1. Desde PulseJ (Interfaz Web)
1. Agregar enlaces al codex
2. Marcar checkbox "¿Analizar enlaces?"
3. Los enlaces se etiquetan como "pendiente-analisis"
4. El sistema procesará automáticamente en segundo plano

### 2. Desde API (Programático)
```javascript
// Obtener estadísticas
const stats = await fetch('/api/pending-analysis/pending-stats');

// Procesar enlaces
const result = await fetch('/api/pending-analysis/analyze-pending-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ processAll: true })
});
```

### 3. Desde CLI (Script de Prueba)
```bash
cd ExtractorW
node test-pending-analysis.js
```

## Monitoreo y Debugging

### Logs del Sistema
```javascript
// ExtractorW logs
console.log('📥 Descargando medios desde:', url);
console.log('🎵 Transcribiendo archivo:', fileName);
console.log('✅ Análisis completado:', itemId);

// ExtractorT logs
logger.info('Media download request for tweet:', tweetUrl);
logger.info('Successfully extracted media from:', instance);
```

### Archivos de Debug
- `ExtractorT/temp_media/`: Archivos descargados temporalmente
- `ExtractorW/server/logs/`: Logs de procesamiento
- `ExtractorW/test-pending-analysis.js`: Script de pruebas

## Manejo de Errores

### Errores Comunes
1. **ExtractorT no disponible**: Verificar que esté ejecutándose
2. **Créditos insuficientes**: Usuario sin créditos suficientes
3. **Formato no soportado**: Archivo no compatible
4. **Error de descarga**: Problema con la URL o plataforma

### Recuperación Automática
```javascript
// Si falla la descarga multimedia, continuar con análisis básico
if (!downloadResult.success) {
    console.log('❌ Falló descarga, procesando como básico');
    const basicAnalysis = generateBasicAnalysis(url);
    await updateItemWithBasicAnalysis(itemId, basicAnalysis);
}
```

## Escalabilidad y Performance

### Procesamiento Paralelo
- Procesamiento secuencial para evitar sobrecarga
- Limpieza automática de archivos temporales
- Timeout configurable para descargas

### Límites del Sistema
- Máximo 100 elementos por procesamiento batch
- Timeout de 60 segundos por descarga
- Límite de tamaño de archivo según ExtractorT

## Roadmap y Mejoras Futuras

### Funcionalidades Planeadas
1. **Procesamiento en Background**: Queue de tareas asíncronas
2. **Análisis de Imágenes con IA**: Integración con visión artificial
3. **Caché de Resultados**: Evitar re-procesamiento de URLs
4. **Notificaciones**: Alertas cuando se completa el análisis
5. **Batch Processing**: Procesamiento optimizado en lotes

### Mejoras Técnicas
1. **Retry Logic**: Reintentos automáticos en caso de error
2. **Rate Limiting**: Control de velocidad de procesamiento
3. **Metrics**: Métricas de performance y uso
4. **Health Checks**: Monitoreo de salud del sistema

## Soporte y Troubleshooting

### Problemas Frecuentes

**Q: Los enlaces no se procesan automáticamente**
A: Verificar que tengan la etiqueta "pendiente-analisis" y que ExtractorT esté ejecutándose.

**Q: Error "Créditos insuficientes"**
A: Verificar balance de créditos del usuario en la base de datos.

**Q: No se descargan medios de Twitter**
A: Verificar que las instancias de Nitter estén funcionando correctamente.

### Contacto
Para soporte técnico, crear un issue en el repositorio o contactar al equipo de desarrollo.

---

**Última actualización**: Enero 2024
**Versión**: 1.0.0
**Autor**: Sistema de Análisis Automático de Enlaces Multimedia 