#!/bin/bash

# Test script para User Discovery usando cURL
# Requiere que el servidor esté corriendo en localhost:8080

echo "🧪 === PRUEBAS USER DISCOVERY CON cURL ==="
echo ""

# Configuración
BASE_URL="http://localhost:8080"
AUTH_TOKEN="your_jwt_token_here"  # Reemplazar con token válido

# Función para probar un mensaje
test_message() {
    local message="$1"
    local expected_intent="$2"
    
    echo "📝 Probando: \"$message\""
    echo "   Esperado: $expected_intent"
    
    response=$(curl -s -X POST "$BASE_URL/api/vizta-chat/test-user-discovery" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{\"message\":\"$message\"}" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        intent=$(echo "$response" | grep -o '"intent_detected":"[^"]*"' | cut -d'"' -f4)
        activated=$(echo "$response" | grep -o '"user_discovery_activated":[^,}]*' | cut -d':' -f2)
        
        echo "   Resultado: $intent (user_discovery: $activated)"
        
        if [ "$expected_intent" = "user_discovery" ] && [ "$activated" = "true" ]; then
            echo "   ✅ CORRECTO"
        elif [ "$expected_intent" != "user_discovery" ] && [ "$activated" = "false" ]; then
            echo "   ✅ CORRECTO"
        else
            echo "   ❌ INCORRECTO"
        fi
    else
        echo "   ❌ Error en la petición"
    fi
    
    echo ""
}

# Verificar si el servidor está corriendo
echo "🔍 Verificando servidor..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "❌ Servidor no está corriendo en $BASE_URL"
    echo "   Inicia el servidor con: npm start"
    exit 1
fi
echo "✅ Servidor está corriendo"
echo ""

# Casos que DEBERÍAN activar user_discovery
echo "=== CASOS QUE DEBERÍAN ACTIVAR USER_DISCOVERY ==="
test_message "busca Mario López" "user_discovery"
test_message "quien es Ana García" "user_discovery"
test_message "encuentra Pedro González" "user_discovery"
test_message "información sobre Karin Herrera" "user_discovery"
test_message "@pedrogonzalez" "user_discovery"
test_message "twitter de Sandra Torres" "user_discovery"
test_message "handle de Bernardo Arevalo" "user_discovery"

echo "=== CASOS QUE NO DEBERÍAN ACTIVAR USER_DISCOVERY ==="
test_message "busca información sobre el clima" "other"
test_message "hola como estas" "other"
test_message "analiza sentimientos en twitter" "other"
test_message "tendencias en guatemala" "other"

echo "🏁 Pruebas completadas"
echo ""
echo "💡 Nota: Para usar este script necesitas:"
echo "   1. Servidor corriendo: npm start"
echo "   2. Token JWT válido en AUTH_TOKEN"
echo "   3. Variables de entorno configuradas (OPENAI_API_KEY, etc.)"