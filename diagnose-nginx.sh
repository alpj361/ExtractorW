#!/bin/bash

# Script para diagnosticar y solucionar problemas de Nginx
# Uso: ./diagnose-nginx.sh

echo "🔍 DIAGNÓSTICO DE NGINX"
echo "=================================="

# 1. Ver el error específico
echo "📋 1. Error específico de nginx:"
sudo systemctl status nginx.service --no-pager -l
echo ""

echo "📋 Logs detallados:"
sudo journalctl -xeu nginx.service --no-pager -l | tail -20
echo ""

# 2. Verificar si el puerto 80 está ocupado
echo "🔍 2. Verificando puerto 80:"
if sudo lsof -i :80; then
    echo "⚠️  Puerto 80 está ocupado por otro proceso"
    echo "💡 Procesos que usan puerto 80:"
    sudo lsof -i :80
else
    echo "✅ Puerto 80 está libre"
fi
echo ""

# 3. Verificar configuración de nginx
echo "🔍 3. Verificando configuración de nginx:"
if sudo nginx -t; then
    echo "✅ Configuración de nginx es válida"
else
    echo "❌ Error en configuración de nginx"
    echo "📋 Probando configuración por defecto:"
    
    # Backup y restaurar configuración por defecto
    sudo mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup 2>/dev/null || true
    sudo apt install --reinstall nginx-core nginx-common
    
    if sudo nginx -t; then
        echo "✅ Configuración por defecto funciona"
    else
        echo "❌ Problema más profundo con nginx"
    fi
fi
echo ""

# 4. Verificar otros servicios web
echo "🔍 4. Verificando otros servicios web:"
if systemctl is-active --quiet apache2; then
    echo "⚠️  Apache2 está corriendo - puede causar conflicto"
    echo "💡 Deteniendo Apache2..."
    sudo systemctl stop apache2
    sudo systemctl disable apache2
    echo "✅ Apache2 detenido"
else
    echo "✅ Apache2 no está corriendo"
fi

if systemctl is-active --quiet lighttpd; then
    echo "⚠️  Lighttpd está corriendo - puede causar conflicto"
    sudo systemctl stop lighttpd
    sudo systemctl disable lighttpd
    echo "✅ Lighttpd detenido"
else
    echo "✅ Lighttpd no está corriendo"
fi
echo ""

# 5. Intentar iniciar nginx de nuevo
echo "🚀 5. Intentando iniciar nginx..."
if sudo systemctl start nginx; then
    echo "✅ ¡Nginx iniciado exitosamente!"
    sudo systemctl enable nginx
    echo "✅ Nginx habilitado para inicio automático"
    
    # Verificar estado
    echo "📊 Estado actual:"
    sudo systemctl status nginx --no-pager -l
    
else
    echo "❌ Nginx sigue sin poder iniciarse"
    echo ""
    echo "🔧 SOLUCIONES ADICIONALES:"
    echo "=================================="
    
    # Solución 1: Reinstalar nginx
    echo "💡 Solución 1: Reinstalar nginx completamente"
    echo "sudo apt remove --purge nginx nginx-common nginx-core -y"
    echo "sudo apt autoremove -y"
    echo "sudo apt update"
    echo "sudo apt install nginx -y"
    echo ""
    
    # Solución 2: Verificar permisos
    echo "💡 Solución 2: Verificar permisos"
    echo "sudo chown -R www-data:www-data /var/log/nginx/"
    echo "sudo chmod -R 755 /var/log/nginx/"
    echo "sudo mkdir -p /var/lib/nginx/body"
    echo "sudo chown -R www-data:www-data /var/lib/nginx/"
    echo ""
    
    # Solución 3: Configuración mínima
    echo "💡 Solución 3: Usar configuración mínima"
    echo "Crear /etc/nginx/sites-available/test con configuración básica"
    echo ""
    
    echo "❓ ¿Quieres que ejecute la reinstalación automática? (y/n)"
    read -p "Respuesta: " response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🔄 Reinstalando nginx..."
        sudo systemctl stop nginx 2>/dev/null || true
        sudo apt remove --purge nginx nginx-common nginx-core -y
        sudo apt autoremove -y
        sudo rm -rf /etc/nginx/
        sudo apt update
        sudo apt install nginx -y
        
        if sudo systemctl start nginx; then
            echo "✅ ¡Nginx reinstalado y funcionando!"
            sudo systemctl enable nginx
        else
            echo "❌ Problema persiste después de reinstalación"
            echo "📞 Necesitas revisar logs del sistema más profundamente"
        fi
    fi
fi

echo ""
echo "🔍 VERIFICACIÓN FINAL:"
echo "=================================="
echo "📊 Estado de nginx:"
sudo systemctl status nginx --no-pager || true
echo ""
echo "🌐 Prueba de puerto 80:"
curl -I http://localhost 2>/dev/null || echo "❌ No responde en puerto 80"
echo ""
echo "💡 Si nginx está funcionando, puedes continuar con:"
echo "   ./fix-ssl.sh" 