#!/bin/bash

# Script para instalar dependencias de email en ExtractorW
echo "📧 Instalando dependencias de email para ExtractorW..."

# Verificar si estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json en el directorio actual"
    echo "   Asegúrate de ejecutar este script desde el directorio ExtractorW"
    exit 1
fi

# Verificar si package.json contiene nodemailer
if grep -q "nodemailer" package.json; then
    echo "✅ nodemailer ya está en package.json"
else
    echo "⚠️  nodemailer no está en package.json, agregándolo..."
    # Agregar nodemailer al package.json si no está
    sed -i.bak 's/"node-fetch": "^2.7.0"/"node-fetch": "^2.7.0",\n    "nodemailer": "^6.9.14"/' package.json
    echo "✅ nodemailer agregado a package.json"
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencias instaladas exitosamente"
    echo ""
    echo "📧 Los siguientes endpoints de email están ahora disponibles:"
    echo "   - POST /api/send-email"
    echo "   - POST /api/test-email"
    echo ""
    echo "🔧 Funcionalidades incluidas:"
    echo "   - Detección automática de frontend vs CURL"
    echo "   - Corrección automática de caracteres especiales"
    echo "   - Soporte completo para Gmail con App Password"
    echo "   - Configuración SMTP dinámica"
    echo ""
    echo "🚀 Para probar, puedes usar:"
    echo "   curl -X POST http://localhost:8080/health"
    echo ""
else
    echo "❌ Error instalando dependencias"
    exit 1
fi 