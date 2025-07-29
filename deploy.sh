#!/bin/bash

# Script de deployment para ExtractorW
# Uso: ./deploy.sh [production|staging]

set -e  # Exit on any error

ENV=${1:-production}
APP_NAME="extractorw"
CONTAINER_NAME="${APP_NAME}-api"

echo "🚀 Iniciando deployment de ExtractorW en modo: $ENV"

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi

# Verificar si existe el archivo .env
if [ ! -f .env ]; then
    echo "❌ Archivo .env no encontrado. Creando desde template..."
    if [ -f env-template.txt ]; then
        cp env-template.txt .env
        echo "📝 Por favor edita el archivo .env con tus variables de entorno reales"
        echo "⚠️  Deployment pausado. Edita .env y ejecuta nuevamente este script."
        exit 1
    else
        echo "❌ Template de .env no encontrado. Crea manualmente el archivo .env"
        exit 1
    fi
fi

echo "📦 Construyendo imagen Docker..."
docker-compose build --no-cache

echo "🛑 Deteniendo contenedores existentes..."
docker-compose down || true

echo "🚀 Iniciando nuevos contenedores..."
docker-compose up -d

echo "⏳ Esperando que la aplicación esté lista..."
sleep 10

# Verificar que la aplicación esté funcionando
echo "🔍 Verificando estado de la aplicación..."
if curl -f -s http://localhost:8080/health > /dev/null; then
    echo "✅ ExtractorW está funcionando correctamente!"
    echo "🌐 Aplicación disponible en: http://localhost:8080"
else
    echo "⚠️  La aplicación podría no estar respondiendo. Verificando logs..."
    docker-compose logs --tail=20 extractorw
fi

echo "📊 Estado de contenedores:"
docker-compose ps

echo "🎉 Deployment completado!"
echo ""
echo "Comandos útiles:"
echo "  Ver logs: docker-compose logs -f"
echo "  Reiniciar: docker-compose restart"
echo "  Detener: docker-compose down"
echo "  Estado: docker-compose ps" 