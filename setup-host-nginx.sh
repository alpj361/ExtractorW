#!/bin/bash

# Script para configurar nginx en el HOST (separado del Docker)
# Para ExtractorW en server.standatpd.com
# Uso: ./setup-host-nginx.sh

set -e

DOMAIN="server.standatpd.com"
NGINX_CONF="/etc/nginx/sites-available/extractorw-$DOMAIN"

echo "🔧 CONFIGURANDO NGINX EN HOST PARA ExtractorW"
echo "=============================================="
echo "✅ Nginx Docker (ExtractorT/scraper): NO se toca"
echo "📝 Nginx Host: para $DOMAIN → puerto 8080"
echo ""

# 1. Verificar que ExtractorW está corriendo
echo "🐳 1. Verificando ExtractorW en puerto 8080..."
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
        exit 1
    fi
fi

# 2. Detectar qué puerto usa el nginx de Docker
echo "🔍 2. Detectando configuración actual..."
DOCKER_NGINX_PORT=$(docker ps --format "table {{.Names}}\t{{.Ports}}" | grep nginx | head -1 | grep -o "0.0.0.0:[0-9]*" | cut -d: -f2 || echo "80")
echo "   Nginx Docker (ExtractorT): puerto $DOCKER_NGINX_PORT"
echo "   ExtractorW: puerto 8080 (interno)"

# 3. Determinar puerto libre para nginx host
NGINX_HOST_PORT=80
if [ "$DOCKER_NGINX_PORT" = "80" ]; then
    echo "⚠️  Puerto 80 ocupado por Docker nginx"
    echo "💡 Necesitamos configurar de manera diferente..."
    
    # Opción: usar iptables para redirigir o configurar nginx en puerto diferente
    echo "🔧 Configurando nginx host en puerto 8081 temporalmente"
    NGINX_HOST_PORT=8081
fi

# 4. Remover nginx Ubuntu si existe (evitar conflictos)
echo "🗑️ 3. Limpiando nginx Ubuntu si existe..."
sudo systemctl stop nginx 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true

# 5. Instalar nginx fresco para el host
echo "📦 4. Instalando nginx limpio para el host..."
sudo apt remove --purge nginx nginx-common nginx-core -y 2>/dev/null || true
sudo apt autoremove -y
sudo rm -rf /etc/nginx/
sudo apt update
sudo apt install nginx -y

# 6. Crear configuración específica para ExtractorW
echo "📝 5. Creando configuración para $DOMAIN..."

# Crear directorio sites-available
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# Configuración principal de nginx
sudo tee /etc/nginx/nginx.conf > /dev/null << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;

    include /etc/nginx/sites-enabled/*;
}
EOF

# Crear configuración específica para ExtractorW
sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # ExtractorW API - proxy a puerto 8080
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
        
        if (\$request_method = 'OPTIONS') {
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

# 7. Habilitar el sitio
echo "🔗 6. Habilitando sitio para $DOMAIN..."
sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/extractorw-$DOMAIN"

# Remover default si existe
sudo rm -f /etc/nginx/sites-enabled/default

# 8. Configurar nginx para usar puerto diferente si es necesario
if [ "$NGINX_HOST_PORT" != "80" ]; then
    echo "🔧 Configurando nginx host en puerto $NGINX_HOST_PORT..."
    sudo sed -i "s/listen 80;/listen $NGINX_HOST_PORT;/g" "$NGINX_CONF"
fi

# 9. Verificar configuración
echo "🔍 7. Verificando configuración de nginx..."
if sudo nginx -t; then
    echo "✅ Configuración válida"
else
    echo "❌ Error en configuración"
    sudo nginx -T
    exit 1
fi

# 10. Resolver conflicto de puerto 80
if [ "$DOCKER_NGINX_PORT" = "80" ]; then
    echo "🔧 8. Resolviendo conflicto de puerto 80..."
    echo "💡 Opción 1: Detener nginx Docker temporalmente"
    echo "💡 Opción 2: Usar iptables para redirigir"
    echo "💡 Opción 3: Configurar nginx Docker en puerto diferente"
    
    echo "❓ ¿Quieres que configure iptables para redirigir $DOMAIN al puerto $NGINX_HOST_PORT? (y/n)"
    read -p "Respuesta: " response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🔧 Configurando iptables..."
        # Redirigir server.standatpd.com:80 al puerto 8081
        sudo iptables -t nat -A OUTPUT -p tcp --dport 80 -d $(dig +short $DOMAIN) -j REDIRECT --to-port $NGINX_HOST_PORT
        sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -d $(dig +short $DOMAIN) -j REDIRECT --to-port $NGINX_HOST_PORT
        echo "✅ iptables configurado"
    fi
fi

# 11. Iniciar nginx host
echo "🚀 9. Iniciando nginx host..."
sudo systemctl start nginx
sudo systemctl enable nginx

# 12. Verificar que funciona
echo "🌐 10. Verificando que $DOMAIN funciona..."
sleep 3

TEST_URL="http://$DOMAIN"
if [ "$NGINX_HOST_PORT" != "80" ]; then
    TEST_URL="http://$DOMAIN:$NGINX_HOST_PORT"
fi

if curl -f -s $TEST_URL/health > /dev/null; then
    echo "✅ ¡$DOMAIN funcionando correctamente!"
    echo "   Respuesta: $(curl -s $TEST_URL/health | jq -r .status 2>/dev/null || echo "OK")"
else
    echo "❌ $DOMAIN no responde"
    echo "🔍 Diagnóstico:"
    echo "   - DNS: $(nslookup $DOMAIN 2>/dev/null | grep Address || echo 'No resuelve')"
    echo "   - Nginx test: $(sudo nginx -t 2>&1)"
    echo "   - ExtractorW local: $(curl -s http://localhost:8080/health 2>/dev/null || echo 'No responde')"
    echo "   - Puerto usado: $NGINX_HOST_PORT"
    exit 1
fi

# 13. Configurar SSL
echo ""
echo "🔒 11. Configurando SSL..."

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

if [ "$NGINX_HOST_PORT" = "80" ]; then
    echo "🔐 Generando certificados SSL para $DOMAIN..."
    echo "⚠️  Esto NO afectará tu scraper Docker"
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
else
    echo "⚠️  SSL requiere puerto 80. Configura port forwarding primero."
fi

echo ""
echo "🎉 ¡CONFIGURACIÓN COMPLETA!"
echo "================================"
echo "✅ ExtractorT (scraper): Docker nginx sin cambios"
echo "✅ ExtractorW: Nginx host para $DOMAIN"
echo ""
echo "🎯 URLs de ExtractorW:"
if [ "$NGINX_HOST_PORT" = "80" ]; then
    echo "   - HTTP:  http://$DOMAIN/health"
    echo "   - HTTPS: https://$DOMAIN/health"
    echo "   - API:   https://$DOMAIN/api/processTrends"
else
    echo "   - HTTP:  http://$DOMAIN:$NGINX_HOST_PORT/health"
    echo "   - API:   http://$DOMAIN:$NGINX_HOST_PORT/api/processTrends"
    echo "   ⚠️  SSL requiere configuración adicional de puerto 80"
fi
echo ""
echo "🔧 Configuración actual:"
echo "   - ExtractorT: Docker nginx puerto $DOCKER_NGINX_PORT"
echo "   - ExtractorW: Host nginx puerto $NGINX_HOST_PORT"
echo "   - ExtractorW interno: localhost:8080"
echo ""
echo "💡 Para verificar: curl http://$DOMAIN/health" 