#!/bin/bash

# Script para corregir SSL en server.standatpd.com
# Uso: ./fix-ssl.sh

set -e

DOMAIN="server.standatpd.com"
NGINX_CONF="/etc/nginx/sites-available/extractorw-$DOMAIN"

echo "🔧 Solucionando problema de SSL para $DOMAIN"
echo "=================================================="

# Paso 1: Aplicar configuración temporal sin SSL
echo "📝 Paso 1: Aplicando configuración temporal sin SSL..."
sudo cp nginx-subdomain-temp.conf "$NGINX_CONF"

# Verificar y recargar Nginx
echo "🔍 Verificando configuración de Nginx..."
if sudo nginx -t; then
    echo "✅ Configuración válida"
    sudo systemctl reload nginx
else
    echo "❌ Error en configuración"
    exit 1
fi

# Paso 2: Verificar que HTTP funciona
echo "🌐 Paso 2: Verificando que HTTP funciona..."
sleep 2
if curl -f -s http://$DOMAIN/health > /dev/null; then
    echo "✅ HTTP funcionando correctamente"
    echo "   Respuesta: $(curl -s http://$DOMAIN/health | jq -r .status 2>/dev/null || echo "OK")"
else
    echo "❌ HTTP no responde. Verificando ExtractorW..."
    # Verificar si el contenedor está corriendo
    if docker-compose ps | grep -q "extractorw.*Up"; then
        echo "✅ Contenedor ExtractorW está corriendo"
    else
        echo "🚀 Iniciando contenedor ExtractorW..."
        docker-compose up -d
        sleep 10
    fi
    
    # Intentar de nuevo
    if curl -f -s http://$DOMAIN/health > /dev/null; then
        echo "✅ HTTP funcionando después de reiniciar contenedor"
    else
        echo "❌ HTTP sigue sin responder. Revisar logs:"
        echo "   - make logs (logs del contenedor)"
        echo "   - sudo tail -f /var/log/nginx/extractorw_error.log"
        exit 1
    fi
fi

# Paso 3: Instalar Certbot si no está instalado
echo "🔒 Paso 3: Verificando/instalando Certbot..."
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot..."
    sudo apt update
    sudo apt install snapd -y
    sudo snap install core
    sudo snap refresh core
    sudo snap install --classic certbot
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    echo "✅ Certbot instalado"
else
    echo "✅ Certbot ya está instalado"
fi

# Paso 4: Generar certificados SSL
echo "🔐 Paso 4: Generando certificados SSL..."
echo "⚠️  IMPORTANTE: Certbot va a pedir tu email y aceptar términos"
echo "   Presiona ENTER para continuar o Ctrl+C para cancelar"
read -p ""

if sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || \
   sudo certbot --nginx -d $DOMAIN; then
    echo "✅ Certificados SSL generados exitosamente"
else
    echo "❌ Error generando certificados SSL"
    echo "💡 Posibles soluciones:"
    echo "   1. Verificar que DNS apunte correctamente: nslookup $DOMAIN"
    echo "   2. Verificar puertos 80 y 443 abiertos: sudo ufw status"
    echo "   3. Intentar manualmente: sudo certbot --nginx -d $DOMAIN"
    exit 1
fi

# Paso 5: Verificar HTTPS
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
echo ""
echo "🔧 Comandos útiles:"
echo "   - Ver logs Nginx: sudo tail -f /var/log/nginx/extractorw_error.log"
echo "   - Ver logs app: make logs"
echo "   - Verificar certificados: sudo certbot certificates"
echo "   - Renovar certificados: sudo certbot renew --dry-run"
echo ""
echo "✅ ¡Configuración completa!" 