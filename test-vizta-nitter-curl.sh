#!/bin/bash

# ===================================================================
# SCRIPT DE PRUEBAS CURL: VIZTA + NITTER PROFILE
# ===================================================================

echo "🚀 PROBANDO INTEGRACIÓN VIZTA + NITTER PROFILE"
echo "============================================="

# Configuración
EXTRACTORW_URL="http://localhost:8080"
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MzgwMTE0MjAsImV4cCI6MTczODAxNTAyMCwianRpIjoiZDNkMzQ2NzktZjE4NS00NzIzLTlkZWEtNzA2OGJkNWEzMGQxIiwiaXNzIjoiVml6dGEiLCJhdWQiOiJWaXp0YSJ9.test"

# Función para hacer peticiones con formato
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local description="$4"
    
    echo ""
    echo "📡 $description"
    echo "─────────────────────────────────────────"
    echo "🔗 $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        curl -s -X GET "$EXTRACTORW_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            | jq '.' 2>/dev/null || echo "❌ Error en la respuesta"
    else
        echo "📤 Datos: $data"
        curl -s -X "$method" "$EXTRACTORW_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            | jq '.' 2>/dev/null || echo "❌ Error en la respuesta"
    fi
    
    echo ""
    echo "⏳ Esperando 2 segundos..."
    sleep 2
}

# 1. Probar capacidades MCP
make_request "GET" "/api/mcp/capabilities" "" "Probando capacidades MCP"

# 2. Probar endpoint nitter_profile directo
make_request "POST" "/api/mcp/nitter_profile" '{
    "username": "GuatemalaGob",
    "limit": 5,
    "include_retweets": false,
    "include_replies": false
}' "Probando endpoint nitter_profile directo"

# 3. Probar Vizta Chat con consulta automática
make_request "POST" "/api/vizta-chat/query" '{
    "message": "Busca los últimos tweets de @GuatemalaGob",
    "sessionId": "test-session-'$(date +%s)'"
}' "Probando Vizta Chat con detección automática"

# 4. Probar otra consulta de usuario específico
make_request "POST" "/api/vizta-chat/query" '{
    "message": "¿Qué dice @CashLuna últimamente?",
    "sessionId": "test-session-'$(date +%s)'"
}' "Probando otra consulta de usuario específico"

# 5. Probar herramientas disponibles
make_request "GET" "/api/vizta-chat/tools" "" "Probando herramientas disponibles en Vizta"

echo ""
echo "🎯 PRUEBAS COMPLETADAS"
echo "====================="
echo ""
echo "✅ Si ves respuestas JSON estructuradas, la integración funciona correctamente"
echo "❌ Si ves errores de autenticación, actualiza el TOKEN en el script"
echo ""
echo "🔧 Para usar con tu propio token:"
echo "   export TOKEN='tu_token_jwt_aqui'"
echo "   ./test-vizta-nitter-curl.sh"
echo ""
echo "📖 Consulta la documentación completa en:"
echo "   ExtractorW/VIZTA_NITTER_PROFILE_INTEGRATION.md" 