# 🚨 SOLUCIÓN RÁPIDA: Dependencias de Vizta Chat

## Problema
```
❌ Uncaught Exception: Error: Cannot find module 'openai'
```

## Solución Inmediata

### Opción 1: Script automático
```bash
cd ExtractorW
npm run install-vizta
```

### Opción 2: Instalación manual
```bash
cd ExtractorW
npm install openai@^4.67.3 uuid@^9.0.1
```

### Opción 3: Script bash
```bash
cd ExtractorW
./install-vizta-deps.sh
```

## Estado Actual

✅ **Servidor funcionando**: El servidor ahora tiene un modo fallback que no crashea
✅ **Funcionalidad básica**: Vizta Chat funciona sin OpenAI usando nitter_context directamente
⚠️ **Funcionalidad limitada**: Sin IA inteligente hasta instalar dependencias

## Verificación

Después de instalar, verifica que funcione:

```bash
node -e "
try {
  const OpenAI = require('openai');
  const { v4: uuidv4 } = require('uuid');
  console.log('✅ OpenAI disponible');
  console.log('✅ UUID disponible');
  console.log('🎉 Vizta Chat listo!');
} catch (error) {
  console.error('❌ Error:', error.message);
}
"
```

## Reiniciar Servidor

Después de instalar las dependencias:

```bash
# Si usas Docker
docker-compose restart extractorw-api

# Si usas npm
npm restart
```

## Modo Fallback

Mientras tanto, Vizta Chat funciona en modo básico:
- ✅ Acepta consultas
- ✅ Ejecuta nitter_context automáticamente
- ✅ Guarda resultados en base de datos
- ❌ No usa IA para análisis inteligente
- ❌ No selecciona herramientas automáticamente

## Funcionalidad Completa

Una vez instaladas las dependencias:
- ✅ GPT-4o mini para análisis inteligente
- ✅ Selección automática de herramientas
- ✅ Respuestas contextuales
- ✅ Function calling avanzado 