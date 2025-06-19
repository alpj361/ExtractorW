#!/bin/bash

# Script para probar transcripción con un token fresco
# Uso: ./test-with-token.sh "tu_token_aqui"

if [ -z "$1" ]; then
    echo "❌ Error: Debes proporcionar un token"
    echo
    echo "📋 CÓMO OBTENER UN TOKEN FRESCO:"
    echo "1. Ve a PulseJ en tu navegador"
    echo "2. Abre DevTools (F12) → Console"
    echo "3. Ejecuta uno de estos comandos:"
    echo "   • localStorage.getItem('sb-qqshdccpmypelhmyqnut-auth-token')"
    echo "   • JSON.parse(localStorage.getItem('sb-qqshdccpmypelhmyqnut-auth-token')).access_token"
    echo "4. Copia el token (sin comillas)"
    echo "5. Ejecuta: ./test-with-token.sh \"tu_token_aqui\""
    echo
    echo "🔄 Alternativamente:"
    echo "   TEST_TOKEN=\"tu_token\" node test-transcription-rls.js"
    exit 1
fi

echo "🧪 PROBANDO TRANSCRIPCIÓN CON TOKEN FRESCO"
echo "========================================="
echo "🔑 Token: ${1:0:30}..."
echo

# Ejecutar prueba con el token proporcionado
TEST_TOKEN="$1" node test-transcription-rls.js 