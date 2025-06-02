#!/bin/bash

# Script para configurar subdominio para ExtractorW
# Uso: ./setup-subdomain.sh [subdominio]
# Si no se proporciona subdominio, usa server.standatpd.com por defecto

set -e

# Usar server.standatpd.com como dominio por defecto
SUBDOMAIN=${1:-server.standatpd.com}
NGINX_CONF="/etc/nginx/sites-available/extractorw-$SUBDOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/extractorw-$SUBDOMAIN"

echo "🚀 Configurando subdominio: $SUBDOMAIN"

# Verificar que Nginx esté instalado
if ! command -v nginx &> /dev/null; then
    echo "📦 Instalando Nginx..."
    sudo apt update
    sudo apt install nginx -y
fi

# Crear configuración de Nginx personalizada
echo "📝 Creando configuración de Nginx..."
sudo cp nginx-subdomain.conf "$NGINX_CONF"

# Reemplazar placeholders si es necesario (para otros subdominios)
if [ "$SUBDOMAIN" != "server.standatpd.com" ]; then
    sudo sed -i "s/server.standatpd.com/$SUBDOMAIN/g" "$NGINX_CONF"
fi

# Habilitar el sitio
echo "✅ Habilitando sitio..."
sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

# Remover configuración por defecto si existe
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "🗑️ Removiendo configuración por defecto..."
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Verificar configuración
echo "🔍 Verificando configuración de Nginx..."
if sudo nginx -t; then
    echo "✅ Configuración válida"
    sudo systemctl reload nginx
else
    echo "❌ Error en configuración"
    exit 1
fi

# Verificar que ExtractorW esté corriendo
echo "🔍 Verificando ExtractorW..."
if curl -f -s http://localhost:8080/health > /dev/null; then
    echo "✅ ExtractorW funcionando correctamente"
else
    echo "⚠️ ExtractorW no responde. Iniciando contenedor..."
    docker-compose up -d
    sleep 5
fi

# Configurar firewall
echo "🔒 Configurando firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    echo "✅ Puertos 80 y 443 abiertos (UFW)"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --reload
    echo "✅ Puertos 80 y 443 abiertos (firewalld)"
fi

echo ""
echo "🎉 ¡Configuración completa!"
echo ""
echo "📋 Próximos pasos:"
echo "1. ✅ DNS ya está configurado para: $SUBDOMAIN"
echo "2. Espera la propagación DNS (5-30 minutos)"
echo "3. Configura SSL:"
echo "   sudo certbot --nginx -d $SUBDOMAIN"
echo "4. Prueba tu API:"
echo "   curl http://$SUBDOMAIN/health"
echo ""

# Mostrar información adicional
echo "🔧 Información útil:"
echo "  - Configuración Nginx: $NGINX_CONF"
echo "  - Logs access: /var/log/nginx/extractorw_access.log"
echo "  - Logs error: /var/log/nginx/extractorw_error.log"
echo "  - Health check: http://$SUBDOMAIN/health"
echo "  - API principal: http://$SUBDOMAIN/api/processTrends"
echo "  - Trending tweets: http://$SUBDOMAIN/api/trending-tweets"
echo ""
echo "🌐 URLs para tu frontend:"
echo "  - VPS_API_URL=https://$SUBDOMAIN" 