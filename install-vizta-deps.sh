#!/bin/bash

# ===================================================================
# SCRIPT DE INSTALACIÓN DE DEPENDENCIAS PARA VIZTA CHAT
# ===================================================================

echo "🚀 Instalando dependencias de Vizta Chat..."

# Cambiar al directorio de ExtractorW
cd "$(dirname "$0")"

echo "📍 Directorio actual: $(pwd)"

# Verificar que package.json existe
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json no encontrado en $(pwd)"
    exit 1
fi

echo "📦 Instalando openai y uuid..."

# Instalar dependencias específicas
npm install openai@^4.67.3 uuid@^9.0.1

# Verificar instalación
if [ $? -eq 0 ]; then
    echo "✅ Dependencias instaladas exitosamente"
    echo "🔧 Verificando instalación..."
    
    # Verificar que los módulos estén disponibles
    node -e "
        try {
            const OpenAI = require('openai');
            const { v4: uuidv4 } = require('uuid');
            console.log('✅ OpenAI:', typeof OpenAI);
            console.log('✅ UUID:', typeof uuidv4);
            console.log('🎉 Todas las dependencias están disponibles');
        } catch (error) {
            console.error('❌ Error verificando dependencias:', error.message);
            process.exit(1);
        }
    "
    
    if [ $? -eq 0 ]; then
        echo "🎯 ¡Vizta Chat está listo para usar!"
        echo "🔄 Reinicia el servidor ExtractorW para aplicar los cambios"
    else
        echo "❌ Error en la verificación de dependencias"
        exit 1
    fi
else
    echo "❌ Error instalando dependencias"
    exit 1
fi 