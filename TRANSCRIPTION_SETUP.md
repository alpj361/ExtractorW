# ⚡ Instalación Rápida - Sistema de Transcripción

## 🚀 Pasos de Instalación (5 minutos)

### 1. Instalar FFmpeg
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Verificar instalación
ffmpeg -version
```

### 2. Instalar Dependencias
```bash
cd ExtractorW
npm install @google/generative-ai fluent-ffmpeg
```

### 3. Configurar Variables de Entorno
```bash
# Agregar a .env
echo "GEMINI_API_KEY=tu_api_key_de_gemini" >> .env
```

### 4. Aplicar Migración de BD
```bash
# En Supabase SQL Editor, ejecutar:
# add_audio_transcription_to_codex.sql
```

### 5. Verificar Funcionamiento
```bash
node test-transcription.js
```

## ✅ Resultado Esperado
- ✅ Endpoints de transcripción funcionando
- ✅ Detección automática de formatos
- ✅ Sistema de créditos integrado
- ✅ UI lista en PulseJ

---

## 🎯 Uso Inmediato

1. Ve al **Codex** en PulseJ
2. Sube un archivo de audio/video
3. Click en **⋮** → **Transcribir Audio**
4. ¡Listo! La transcripción aparece automáticamente

---

## 🔧 Troubleshooting Rápido

**Error: FFmpeg no encontrado**
```bash
which ffmpeg  # Debe mostrar la ruta
```

**Error: Gemini API**
- Verificar API key en Google AI Studio
- Confirmar cuota disponible

**Error: Créditos insuficientes**
- Revisar saldo en base de datos `profiles.credits`

---

*¿Problemas? Ver documentación completa en `AUDIO_TRANSCRIPTION_SYSTEM.md`* 