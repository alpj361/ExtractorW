# Sistema de Transcripción de Audio - Codex

## 📖 Resumen

Sistema completo de transcripción de audio y video integrado al Codex de PulseJ. Utiliza **Gemini AI** para convertir archivos de audio/video en texto, con extracción automática de audio de archivos de video.

---

## 🏗️ Arquitectura del Sistema

### Backend (ExtractorW)

#### Servicios Principales
- **`server/services/transcription.js`**: Motor de transcripción con Gemini AI
- **`server/routes/transcription.js`**: Endpoints API para transcripción
- **`server/middlewares/credits.js`**: Sistema de créditos (25-35 créditos por transcripción)

#### Funcionalidades Clave
- ✅ Extracción de audio de archivos de video
- ✅ Transcripción directa de archivos de audio
- ✅ Integración con sistema de créditos
- ✅ Guardado automático en Codex
- ✅ Metadatos detallados (palabras, tiempo de procesamiento)

### Frontend (PulseJ)

#### Integración UI
- **Menú contextual**: Opción "Transcribir Audio" en cada archivo compatible
- **Indicador de progreso**: Barra de progreso visual con porcentajes
- **Detección automática**: Solo se muestra en archivos de audio/video
- **Estados visuales**: Loading, success, error con iconos animados

---

## 🎯 Formatos Soportados

### Audio
- `.mp3` - MPEG Audio Layer 3
- `.wav` - Waveform Audio File
- `.aac` - Advanced Audio Coding
- `.ogg` - Ogg Vorbis
- `.flac` - Free Lossless Audio Codec
- `.m4a` - MPEG-4 Audio

### Video (extracción de audio)
- `.mp4` - MPEG-4 Video
- `.avi` - Audio Video Interleave
- `.mov` - QuickTime Movie
- `.mkv` - Matroska Video
- `.webm` - WebM Video
- `.m4v` - iTunes Video

---

## 🔧 Configuración e Instalación

### 1. Variables de Entorno (ExtractorW)

```bash
# .env file
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 2. Dependencias Requeridas

```bash
# ExtractorW - Backend
npm install @google/generative-ai
npm install fluent-ffmpeg  # Para extracción de audio

# Sistema operativo - FFmpeg
# Ubuntu/Debian:
sudo apt update && sudo apt install ffmpeg

# macOS:
brew install ffmpeg

# Windows:
# Descargar desde https://ffmpeg.org/download.html
```

### 3. Migración de Base de Datos

```bash
# Aplicar migración en Supabase
cd ExtractorW
psql -h your-supabase-host -U postgres -d postgres -f add_audio_transcription_to_codex.sql
```

### 4. Verificación del Sistema

```bash
# Ejecutar script de pruebas
cd ExtractorW
node test-transcription.js
```

---

## 🚀 Uso del Sistema

### Desde el Frontend (PulseJ)

1. **Acceder al Codex**: Ve a la sección Codex en PulseJ
2. **Localizar archivo**: Encuentra un archivo de audio o video
3. **Abrir menú**: Click en los 3 puntos (⋮) del archivo
4. **Iniciar transcripción**: Click en "Transcribir Audio" (ícono de micrófono)
5. **Monitorear progreso**: Observa la barra de progreso azul
6. **Resultado**: Nueva entrada de transcripción aparece automáticamente

### Proceso Automático

```
1. Usuario hace click en "Transcribir Audio"
2. Frontend envía solicitud a ExtractorW
3. Backend verifica créditos disponibles
4. Si es video: extrae audio usando FFmpeg
5. Gemini AI procesa el audio/texto
6. Resultado se guarda en Codex como nuevo item
7. Frontend actualiza lista y muestra éxito
```

---

## 💰 Sistema de Créditos

### Costo por Transcripción
- **Audio pequeño** (< 5 min): 25 créditos
- **Audio mediano** (5-15 min): 30 créditos  
- **Audio largo** (> 15 min): 35 créditos

### Estimación de Costos
```javascript
// Endpoint para estimar costo antes de transcribir
POST /api/transcription/estimate-cost
{
  "type": "audio|video",
  "duration": 300,    // segundos
  "size": 5242880     // bytes
}
```

---

## 📡 API Endpoints

### 1. Transcripción desde Codex
```http
POST /api/transcription/from-codex
Authorization: Bearer <token>
Content-Type: application/json

{
  "codexItemId": "uuid-del-archivo",
  "titulo": "Transcripción: Nombre del archivo",
  "descripcion": "Descripción de la transcripción",
  "etiquetas": "tag1,tag2,transcripcion,gemini-ai",
  "proyecto": "Nombre del proyecto",
  "project_id": "uuid-del-proyecto"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "codexItem": {
      "id": "nuevo-uuid",
      "titulo": "Transcripción: Archivo Original",
      "audio_transcription": "Texto transcrito completo...",
      "user_id": "usuario-uuid"
    },
    "metadata": {
      "wordsCount": 1247,
      "processingTime": 8340,
      "confidence": 0.94
    },
    "creditsUsed": 30
  }
}
```

### 2. Formatos Soportados
```http
GET /api/transcription/supported-formats
```

### 3. Estadísticas de Usuario
```http
GET /api/transcription/stats
Authorization: Bearer <token>
```

### 4. Estimación de Costo
```http
POST /api/transcription/estimate-cost
Authorization: Bearer <token>
```

---

## 🔍 Troubleshooting

### Problemas Comunes

#### 1. "FFmpeg no encontrado"
```bash
# Verificar instalación
ffmpeg -version

# Instalar si falta (Ubuntu)
sudo apt install ffmpeg
```

#### 2. "Error de Gemini API"
- Verificar `GEMINI_API_KEY` en variables de entorno
- Confirmar que la API key tiene permisos para Gemini Pro
- Revisar cuota de la API en Google Cloud Console

#### 3. "Créditos insuficientes"
- Verificar saldo de créditos del usuario
- Revisar middleware de créditos en ExtractorW
- Confirmar que el débito de créditos funciona correctamente

#### 4. "Archivo no soportado"
- Verificar que el formato está en la lista de soportados
- Confirmar que el archivo no está corrupto
- Revisar logs del servidor para detalles específicos

### Logs de Depuración

```bash
# ExtractorW - Ver logs en tiempo real
cd ExtractorW
npm run dev

# Revisar logs específicos de transcripción
grep "transcription" logs/server.log
```

---

## 📊 Métricas y Monitoreo

### Estadísticas Rastreadas
- Total de transcripciones por usuario
- Créditos gastados en transcripciones
- Palabras totales procesadas
- Tiempo promedio de procesamiento
- Rate de éxito/error

### Dashboard de Admin
- Uso de transcripciones por periodo
- Usuarios más activos
- Formatos más utilizados
- Costos de API de Gemini

---

## 🔮 Roadmap Futuro

### Funcionalidades Planeadas
- [ ] **Transcripción por lotes**: Procesar múltiples archivos
- [ ] **Traducción automática**: Traducir transcripciones a otros idiomas
- [ ] **Análisis de sentimientos**: Detectar tono y emociones
- [ ] **Resúmenes automáticos**: Generar resúmenes de transcripciones largas
- [ ] **Detección de hablantes**: Identificar diferentes voces
- [ ] **Marcas de tiempo**: Timestamps para cada segmento
- [ ] **Exportación**: PDF, DOCX, SRT de transcripciones

### Optimizaciones Técnicas
- [ ] **Cache de transcripciones**: Evitar reprocesar archivos idénticos
- [ ] **Compresión de audio**: Reducir tamaño antes de enviar a API
- [ ] **Procesamiento en background**: Queue system para archivos grandes
- [ ] **Integración con OpenAI Whisper**: Alternativa local a Gemini

---

## 🛡️ Seguridad

### Medidas Implementadas
- ✅ Autenticación obligatoria via JWT tokens
- ✅ Validación de formatos de archivo
- ✅ Límites de tamaño de archivo
- ✅ Rate limiting en endpoints
- ✅ Sanitización de metadatos

### Datos Sensibles
- Los archivos de audio se procesan temporalmente y se eliminan después
- Las transcripciones se almacenan en Supabase con RLS habilitado
- Los API keys se manejan como variables de entorno
- No se almacenan archivos originales permanentemente

---

## 🤝 Contribución

Para contribuir al sistema de transcripción:

1. Fork del repositorio
2. Crear branch para feature: `git checkout -b feature/transcription-improvement`
3. Hacer cambios y commitear: `git commit -m "Add: nueva funcionalidad"`
4. Push al branch: `git push origin feature/transcription-improvement`
5. Crear Pull Request

### Áreas que Necesitan Contribución
- Testing automatizado más robusto
- Optimización de performance para archivos grandes
- UI/UX improvements en el frontend
- Documentación de API más detallada
- Integración con más proveedores de IA

---

*Sistema desarrollado para PulseJ - Plataforma de Análisis Municipal* 🏛️ 