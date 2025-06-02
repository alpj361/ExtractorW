#!/bin/bash

# Script para corregir SSL en server.standatpd.com
# Uso: ./fix-ssl.sh

set -e

DOMAIN="server.standatpd.com"
NGINX_CONF="/etc/nginx/sites-available/extractorw-$DOMAIN"

echo "🔧 Solucionando problema de SSL para $DOMAIN"
echo "=================================================="

# Paso 0: Verificar e instalar/iniciar Nginx
echo "📦 Paso 0: Verificando Nginx..."
if ! command -v nginx &> /dev/null; then
    echo "🚀 Instalando Nginx..."
    sudo apt update
    sudo apt install nginx -y
    echo "✅ Nginx instalado"
fi

# Verificar si nginx está corriendo
if ! sudo systemctl is-active --quiet nginx; then
    echo "🚀 Iniciando servicio Nginx..."
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo "✅ Nginx iniciado y habilitado"
else
    echo "✅ Nginx ya está corriendo"
fi

# Verificar estado de nginx
echo "📊 Estado de Nginx:"
sudo systemctl status nginx --no-pager -l || true

# Paso 1: Aplicar configuración temporal sin SSL
echo ""
echo "📝 Paso 1: Aplicando configuración temporal sin SSL..."

# Crear directorio sites-available si no existe
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# Copiar configuración
sudo cp nginx-subdomain-temp.conf "$NGINX_CONF"

# Habilitar el sitio
echo "🔗 Habilitando sitio..."
sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/extractorw-$DOMAIN"

# Remover configuración por defecto si existe
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "🗑️ Removiendo configuración por defecto..."
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Verificar y recargar Nginx
echo "🔍 Verificando configuración de Nginx..."
if sudo nginx -t; then
    echo "✅ Configuración válida"
    sudo systemctl reload nginx
else
    echo "❌ Error en configuración"
    echo "📋 Mostrando configuración actual:"
    sudo nginx -T
    exit 1
fi

# Configurar firewall básico
echo "🔒 Configurando firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp   # SSH
    sudo ufw allow 80/tcp   # HTTP
    sudo ufw allow 443/tcp  # HTTPS
    echo "✅ Puertos abiertos (UFW): 22, 80, 443"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=22/tcp
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --reload
    echo "✅ Puertos abiertos (firewalld): 22, 80, 443"
else
    echo "⚠️  Firewall no detectado - verifica manualmente que puertos 80 y 443 estén abiertos"
fi

# Paso 2: Verificar que HTTP funciona
echo ""
echo "🌐 Paso 2: Verificando que HTTP funciona..."
sleep 3

# Primero verificar que el contenedor esté corriendo
echo "🐳 Verificando contenedor ExtractorW..."
if docker-compose ps | grep -q "extractorw.*Up"; then
    echo "✅ Contenedor ExtractorW está corriendo"
elif docker ps | grep -q "extractorw"; then
    echo "✅ Contenedor ExtractorW está corriendo (docker directo)"
else
    echo "🚀 Iniciando contenedor ExtractorW..."
    if [ -f "docker-compose.yml" ]; then
        docker-compose up -d
    else
        echo "❌ docker-compose.yml no encontrado"
        echo "💡 Asegúrate de estar en el directorio correcto: /opt/extractorw"
        exit 1
    fi
    sleep 10
    echo "✅ Contenedor iniciado"
fi

# Verificar endpoint local primero
echo "🔍 Verificando endpoint local..."
if curl -f -s http://localhost:8080/health > /dev/null; then
    echo "✅ ExtractorW respondiendo en localhost:8080"
    echo "   Respuesta: $(curl -s http://localhost:8080/health | jq -r .status 2>/dev/null || echo "OK")"
else
    echo "❌ ExtractorW no responde en localhost:8080"
    echo "📋 Verificando logs..."
    make logs || docker-compose logs --tail=20
    exit 1
fi

# Ahora verificar a través del dominio
echo "🌍 Verificando a través del dominio..."
if curl -f -s http://$DOMAIN/health > /dev/null; then
    echo "✅ HTTP funcionando correctamente a través del dominio"
    echo "   Respuesta: $(curl -s http://$DOMAIN/health | jq -r .status 2>/dev/null || echo "OK")"
else
    echo "❌ HTTP no responde a través del dominio"
    echo "🔍 Diagnóstico:"
    echo "   - DNS: $(nslookup $DOMAIN | grep Address || echo 'DNS no resuelve')"
    echo "   - Logs Nginx: sudo tail -5 /var/log/nginx/error.log"
    echo "   - Config test: sudo nginx -t"
    exit 1
fi

# Paso 3: Instalar Certbot si no está instalado
echo ""
echo "🔒 Paso 3: Verificando/instalando Certbot..."
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot..."
    sudo apt update
    
    # Intentar con snap primero
    if command -v snap &> /dev/null; then
        sudo snap install core 2>/dev/null || true
        sudo snap refresh core 2>/dev/null || true
        sudo snap install --classic certbot
        sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    else
        # Fallback a apt
        sudo apt install certbot python3-certbot-nginx -y
    fi
    echo "✅ Certbot instalado"
else
    echo "✅ Certbot ya está instalado"
fi

# Paso 4: Generar certificados SSL
echo ""
echo "🔐 Paso 4: Generando certificados SSL..."
echo "⚠️  IMPORTANTE: Certbot va a pedir tu email y aceptar términos"
echo "   Presiona ENTER para continuar o Ctrl+C para cancelar"
read -p ""

if sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --no-eff-email 2>/dev/null || \
   sudo certbot --nginx -d $DOMAIN; then
    echo "✅ Certificados SSL generados exitosamente"
else
    echo "❌ Error generando certificados SSL"
    echo "💡 Posibles soluciones:"
    echo "   1. Verificar que DNS apunte correctamente: nslookup $DOMAIN"
    echo "   2. Verificar puertos 80 y 443 abiertos: sudo ufw status"
    echo "   3. Verificar que HTTP funciona: curl http://$DOMAIN/health"
    echo "   4. Intentar manualmente: sudo certbot --nginx -d $DOMAIN"
    exit 1
fi

# Paso 5: Verificar HTTPS
echo ""
echo "🔍 Paso 5: Verificando HTTPS..."
sleep 5
if curl -f -s https://$DOMAIN/health > /dev/null; then
    echo "✅ HTTPS funcionando correctamente"
    echo "🎉 ¡SSL configurado exitosamente!"
else
    echo "⚠️  HTTPS no responde inmediatamente (normal después de generar certificados)"
    echo "💡 Espera 1-2 minutos y prueba: curl https://$DOMAIN/health"
fi

echo ""
echo "🎯 URLs finales:"
echo "   - HTTP:  http://$DOMAIN/health"
echo "   - HTTPS: https://$DOMAIN/health"
echo "   - API:   https://$DOMAIN/api/processTrends"
echo ""
echo "🔧 Comandos útiles:"
echo "   - Ver logs Nginx: sudo tail -f /var/log/nginx/extractorw_error.log"
echo "   - Ver logs app: make logs"
echo "   - Verificar certificados: sudo certbot certificates"
echo "   - Renovar certificados: sudo certbot renew --dry-run"
echo "   - Estado nginx: sudo systemctl status nginx"
echo ""
echo "✅ ¡Configuración completa!" 