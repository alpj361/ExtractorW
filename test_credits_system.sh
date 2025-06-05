#!/bin/bash

# Script de prueba para sistema de créditos - PulseJournal
# Uso: ./test_credits_system.sh YOUR_ADMIN_TOKEN

if [ -z "$1" ]; then
    echo "❌ Uso: $0 <ADMIN_TOKEN>"
    echo "Ejemplo: $0 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    exit 1
fi

TOKEN="$1"
BASE_URL="http://localhost:8080"

echo "🚀 INICIANDO PRUEBAS DEL SISTEMA DE CRÉDITOS"
echo "=============================================="
echo ""

# Función para hacer requests con token
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    echo "📡 $method $endpoint"
    
    if [ -n "$data" ]; then
        curl -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            --silent | jq '.' 2>/dev/null || echo "❌ Error en respuesta"
    else
        curl -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            --silent | jq '.' 2>/dev/null || echo "❌ Error en respuesta"
    fi
    echo ""
}

# 1. Verificar estado de créditos
echo "1️⃣ VERIFICANDO ESTADO DE CRÉDITOS"
echo "--------------------------------"
api_call "GET" "/api/credits/status"

# 2. Dashboard de admin
echo "2️⃣ DASHBOARD DE ADMINISTRACIÓN"
echo "------------------------------"
api_call "GET" "/api/admin/dashboard"

# 3. Lista de usuarios
echo "3️⃣ LISTA DE USUARIOS"
echo "-------------------"
api_call "GET" "/api/admin/users?limit=5"

# 4. Agregar créditos (si hay usuarios de prueba)
echo "4️⃣ AGREGANDO CRÉDITOS A USUARIO DE PRUEBA"
echo "----------------------------------------"
api_call "POST" "/api/credits/add" '{
    "user_email": "usuario1@prueba.com",
    "credits_to_add": 50
}'

# 5. Probar operación que consume créditos
echo "5️⃣ PROBANDO SONDEO (1 crédito)"
echo "-----------------------------"
api_call "POST" "/api/sondeo" '{
    "contexto": "Prueba del sistema",
    "pregunta": "¿Cómo funciona el sistema de créditos?"
}'

# 6. Probar crear documento
echo "6️⃣ PROBANDO CREAR DOCUMENTO (2-5 créditos)"
echo "------------------------------------------"
api_call "POST" "/api/create-document" '{
    "type": "resumen",
    "content": "Esta es una prueba del sistema de generación de documentos con IA",
    "length": "corto"
}'

# 7. Ver historial de uso
echo "7️⃣ HISTORIAL DE USO"
echo "------------------"
api_call "GET" "/api/credits/history?limit=5"

# 8. Ver logs administrativos
echo "8️⃣ LOGS ADMINISTRATIVOS"
echo "----------------------"
api_call "GET" "/api/admin/logs?limit=5"

# 9. Usuarios con créditos bajos
echo "9️⃣ USUARIOS CON CRÉDITOS BAJOS"
echo "-----------------------------"
api_call "GET" "/api/admin/users?low_credits=true"

# 10. Verificar estado final
echo "🔟 ESTADO FINAL DE CRÉDITOS"
echo "--------------------------"
api_call "GET" "/api/credits/status"

echo ""
echo "✅ PRUEBAS COMPLETADAS"
echo "====================="
echo ""
echo "💡 Consejos:"
echo "- Revisa la tabla 'usage_logs' en Supabase para ver los registros"
echo "- Verifica que los créditos se hayan debitado correctamente"
echo "- Prueba con diferentes usuarios (admin vs user regular)"
echo ""
echo "🔗 Endpoints importantes:"
echo "- Dashboard: $BASE_URL/api/admin/dashboard"
echo "- Usuarios: $BASE_URL/api/admin/users"
echo "- Logs: $BASE_URL/api/admin/logs"
echo "- Créditos: $BASE_URL/api/credits/status" 