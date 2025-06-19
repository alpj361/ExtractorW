#!/bin/bash

# Script de despliegue de ExtractorW con soporte para FFmpeg
# Este script reconstruye completamente el contenedor Docker

echo "🚀 DESPLIEGUE DE EXTRACTORW CON FFMPEG"
echo "================================="

# Funciones de logging
log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_warning() {
    echo -e "\033[0;33m[WARNING]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -f "Dockerfile" ]; then
    log_error "Este script debe ejecutarse desde el directorio de ExtractorW"
    exit 1
fi

log_info "Directorio verificado: $(pwd)"

# 1. Detener servicios existentes
log_info "Deteniendo servicios existentes..."
docker-compose down --remove-orphans

# 2. Limpiar imágenes antigas (opcional)
read -p "¿Quieres limpiar imágenes Docker antiguas? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Limpiando imágenes Docker antiguas..."
    docker system prune -f
    docker image prune -f
fi

# 3. Reconstruir imagen con FFmpeg
log_info "Reconstruyendo imagen Docker con FFmpeg..."
docker-compose build --no-cache

if [ $? -ne 0 ]; then
    log_error "Error al construir la imagen Docker"
    exit 1
fi

log_info "Imagen construida exitosamente"

# 4. Verificar dependencias antes del arranque
log_info "Verificando package.json..."
if grep -q "fluent-ffmpeg" package.json; then
    log_info "✅ fluent-ffmpeg encontrado en dependencias"
else
    log_warning "⚠️ fluent-ffmpeg no encontrado en package.json"
fi

# 5. Iniciar servicios
log_info "Iniciando servicios..."
docker-compose up -d

if [ $? -ne 0 ]; then
    log_error "Error al iniciar los servicios"
    exit 1
fi

# 6. Esperar a que el servicio esté listo
log_info "Esperando a que el servicio esté listo..."
sleep 10

# 7. Verificar que el servicio esté funcionando
log_info "Verificando estado del servicio..."
if docker-compose ps | grep -q "Up"; then
    log_info "✅ Servicio iniciado correctamente"
else
    log_error "❌ El servicio no está funcionando"
    docker-compose logs extractorw
    exit 1
fi

# 8. Probar FFmpeg en el contenedor
log_info "Probando FFmpeg en el contenedor..."
docker-compose exec extractorw ffmpeg -version > /dev/null 2>&1

if [ $? -eq 0 ]; then
    log_info "✅ FFmpeg está funcionando en el contenedor"
else
    log_error "❌ FFmpeg no está funcionando en el contenedor"
    log_info "Mostrando logs del contenedor:"
    docker-compose logs extractorw
    exit 1
fi

# 9. Ejecutar verificación completa
log_info "Ejecutando verificación completa..."
docker-compose exec extractorw node check-ffmpeg.js

# 10. Mostrar status final
echo
echo "🎉 DESPLIEGUE COMPLETO"
echo "====================="
log_info "ExtractorW está funcionando con soporte completo para transcripción"
log_info "Servicios disponibles:"
echo "  📡 API: http://localhost:8080"
echo "  🎬 Transcripción: /api/transcription/*"
echo "  📊 Status: /api/status"

echo
log_info "Para verificar logs: docker-compose logs -f extractorw"
log_info "Para detener: docker-compose down"
log_info "Para reiniciar: docker-compose restart"

# 11. Opcional: Ejecutar prueba de transcripción
echo
read -p "¿Quieres ejecutar una prueba de transcripción? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Ejecutando prueba de transcripción..."
    docker-compose exec extractorw node test-transcription-rls.js
fi

log_info "¡Despliegue completado exitosamente! 🚀" 