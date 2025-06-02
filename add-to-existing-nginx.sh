#!/bin/bash

# Script para agregar ExtractorW al nginx existente (sin interferir con scraper)
# Uso: ./add-to-existing-nginx.sh

set -e

DOMAIN="server.standatpd.com"
NGINX_CONF="/etc/nginx/sites-available/extractorw-$DOMAIN"

echo "🔧 CONFIGURANDO ExtractorW en nginx existente"
echo "=============================================="
echo "✅ Detectado nginx corriendo para scraper"
echo "📝 Agregando configuración para $DOMAIN sin interferir"
echo ""

# 1. Verificar que el nginx existente funciona
echo "🔍 1. Verificando nginx existente..."
if curl -I http://localhost 2>/dev/null | grep -q "nginx"; then
    EXISTING_VERSION=$(curl -I http://localhost 2>/dev/null | grep "Server:" || echo "Unknown")
    echo "✅ Nginx funcionando: $EXISTING_VERSION"
else
    echo "❌ Nginx no responde correctamente"
    exit 1
fi

# 2. Verificar que ExtractorW está corriendo en puerto 8080
echo "🐳 2. Verificando ExtractorW en puerto 8080..."
if curl -f -s http://localhost:8080/health > /dev/null; then
    echo "✅ ExtractorW funcionando en puerto 8080"
    echo "   Respuesta: $(curl -s http://localhost:8080/health | jq -r .status 2>/dev/null || echo "OK")"
else
    echo "❌ ExtractorW no responde en puerto 8080"
    echo "🚀 Iniciando ExtractorW..."
    
    if [ -f "docker-compose.yml" ]; then
        docker-compose up -d
        sleep 10
        
        if curl -f -s http://localhost:8080/health > /dev/null; then
            echo "✅ ExtractorW iniciado correctamente"
        else
            echo "❌ ExtractorW sigue sin responder"
            echo "📋 Verificar logs: make logs"
            exit 1
        fi
    else
        echo "❌ docker-compose.yml no encontrado"
        echo "💡 Asegúrate de estar en /opt/extractorw"
        exit 1
    fi
fi

# 3. Crear configuración de nginx para ExtractorW (sin tocar la existente)
echo "📝 3. Creando configuración para $DOMAIN..."

# Verificar directorio sites-available
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# Crear configuración específica para ExtractorW
cat > temp_nginx_config << 'EOF'
server {
    listen 80;
    server_name server.standatpd.com;
    
    # ExtractorW API - proxy a puerto 8080
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
        
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Logs específicos para ExtractorW
    access_log /var/log/nginx/extractorw_access.log;
    error_log /var/log/nginx/extractorw_error.log;
}
EOF

# Mover la configuración al lugar correcto
sudo mv temp_nginx_config "$NGINX_CONF"

# 4. Habilitar el sitio
echo "🔗 4. Habilitando sitio para $DOMAIN..."
sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/extractorw-$DOMAIN"

# 5. Verificar configuración
echo "🔍 5. Verificando configuración de nginx..."
if sudo nginx -t; then
    echo "✅ Configuración válida"
else
    echo "❌ Error en configuración"
    echo "📋 Mostrando configuración:"
    sudo nginx -T | grep -A 20 -B 5 "$DOMAIN" || true
    exit 1
fi

# 6. Recargar nginx (SIN reiniciar, para no afectar el scraper)
echo "🔄 6. Recargando nginx..."
sudo systemctl reload nginx
echo "✅ Nginx recargado (scraper no afectado)"

# 7. Verificar que funciona
echo "🌐 7. Verificando que $DOMAIN funciona..."
sleep 3

if curl -f -s http://$DOMAIN/health > /dev/null; then
    echo "✅ ¡$DOMAIN funcionando correctamente!"
    echo "   Respuesta: $(curl -s http://$DOMAIN/health | jq -r .status 2>/dev/null || echo "OK")"
else
    echo "❌ $DOMAIN no responde"
    echo "🔍 Diagnóstico:"
    echo "   - DNS: $(nslookup $DOMAIN 2>/dev/null | grep Address || echo 'No resuelve')"
    echo "   - Nginx test: $(sudo nginx -t 2>&1)"
    echo "   - ExtractorW local: $(curl -s http://localhost:8080/health 2>/dev/null || echo 'No responde')"
    exit 1
fi

# 8. Configurar SSL/HTTPS
echo ""
echo "🔒 8. Configurando SSL..."

# Verificar si certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot..."
    sudo apt update
    if command -v snap &> /dev/null; then
        sudo snap install core 2>/dev/null || true
        sudo snap refresh core 2>/dev/null || true
        sudo snap install --classic certbot
        sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    else
        sudo apt install certbot python3-certbot-nginx -y
    fi
    echo "✅ Certbot instalado"
fi

echo "🔐 Generando certificados SSL para $DOMAIN..."
echo "⚠️  Esto NO afectará tu scraper"
echo "   Presiona ENTER para continuar o Ctrl+C para cancelar"
read -p ""

if sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --no-eff-email 2>/dev/null || \
   sudo certbot --nginx -d $DOMAIN; then
    echo "✅ SSL configurado exitosamente"
    
    # Verificar HTTPS
    sleep 5
    if curl -f -s https://$DOMAIN/health > /dev/null; then
        echo "✅ HTTPS funcionando correctamente"
    else
        echo "⚠️  HTTPS puede tardar 1-2 minutos en funcionar"
    fi
else
    echo "❌ Error configurando SSL"
    echo "💡 Puedes intentar manualmente: sudo certbot --nginx -d $DOMAIN"
fi

echo ""
echo "🎉 ¡CONFIGURACIÓN COMPLETA!"
echo "================================"
echo "✅ Scraper: funcionando normal (no afectado)"
echo "✅ ExtractorW: funcionando en $DOMAIN"
echo ""
echo "🎯 URLs de ExtractorW:"
echo "   - HTTP:  http://$DOMAIN/health"
echo "   - HTTPS: https://$DOMAIN/health"
echo "   - API:   https://$DOMAIN/api/processTrends"
echo ""
echo "🔧 Tu configuración:"
echo "   - Scraper: sigue en tu nginx original"
echo "   - ExtractorW: nuevo virtual host en $DOMAIN"
echo "   - Puerto interno: ExtractorW en localhost:8080"
echo ""
echo "💡 Para verificar: curl https://$DOMAIN/health" 