#!/bin/bash

# Script para configurar y probar Laura Memory

echo "🚀 CONFIGURANDO LAURA MEMORY PARA PRUEBAS"
echo "=========================================="

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_color() {
    echo -e "${1}${2}${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    print_color $RED "❌ Error: Debes ejecutar este script desde el directorio raíz del proyecto"
    exit 1
fi

print_color $BLUE "📁 Directorio actual: $(pwd)"

# Paso 1: Crear directorio de tests si no existe
print_color $YELLOW "📋 Paso 1: Configurando estructura de archivos..."
mkdir -p server/services/laura_memory/tests/cassettes

# Paso 2: Configurar variables de entorno básicas
print_color $YELLOW "📋 Paso 2: Configurando variables de entorno..."

# Verificar si .env existe
if [ ! -f ".env" ]; then
    print_color $YELLOW "⚠️  Archivo .env no encontrado, creando uno básico..."
    touch .env
fi

# Agregar variables si no existen
if ! grep -q "LAURA_MEMORY_ENABLED" .env; then
    echo "LAURA_MEMORY_ENABLED=true" >> .env
    print_color $GREEN "✅ LAURA_MEMORY_ENABLED agregado"
fi

if ! grep -q "LAURA_MEMORY_URL" .env; then
    echo "LAURA_MEMORY_URL=http://localhost:5001" >> .env
    print_color $GREEN "✅ LAURA_MEMORY_URL agregado"
fi

# Paso 3: Verificar dependencias Node.js
print_color $YELLOW "📋 Paso 3: Verificando dependencias Node.js..."

if [ ! -d "node_modules" ]; then
    print_color $YELLOW "⚠️  node_modules no encontrado, instalando..."
    npm install
fi

# Verificar que node-fetch esté instalado
if ! npm list node-fetch > /dev/null 2>&1; then
    print_color $YELLOW "⚠️  Instalando node-fetch..."
    npm install node-fetch
fi

print_color $GREEN "✅ Dependencias Node.js verificadas"

# Paso 4: Crear archivo .env para Laura Memory
print_color $YELLOW "📋 Paso 4: Configurando Laura Memory..."

cat > server/services/laura_memory/.env << EOF
# Laura Memory Configuration
ZEP_API_KEY=test_key_for_development
ZEP_URL=https://api.getzep.com
LAURA_SESSION_ID=test/session
LAURA_MEMORY_ENABLED=true
LAURA_MEMORY_URL=http://localhost:5001
EOF

print_color $GREEN "✅ Archivo .env creado para Laura Memory"

# Paso 5: Hacer ejecutables los scripts de test
print_color $YELLOW "📋 Paso 5: Configurando permisos..."
chmod +x test-laura-memory-basic.js
chmod +x test-laura-memory-integration.js

print_color $GREEN "✅ Permisos configurados"

# Paso 6: Ejecutar test básico
print_color $YELLOW "📋 Paso 6: Ejecutando test básico..."
print_color $BLUE "================================================"

node test-laura-memory-basic.js

if [ $? -eq 0 ]; then
    print_color $GREEN "✅ Test básico completado exitosamente"
else
    print_color $RED "❌ Test básico falló"
    exit 1
fi

# Paso 7: Mostrar opciones siguientes
print_color $BLUE "================================================"
print_color $GREEN "🎉 CONFIGURACIÓN COMPLETADA"
print_color $BLUE "================================================"

print_color $YELLOW "📋 OPCIONES DISPONIBLES:"
echo ""
print_color $BLUE "1. Test básico (ya ejecutado):"
echo "   node test-laura-memory-basic.js"
echo ""
print_color $BLUE "2. Test de integración completa:"
echo "   node test-laura-memory-integration.js"
echo ""
print_color $BLUE "3. Iniciar servidor Python (en otra terminal):"
echo "   cd server/services/laura_memory"
echo "   python server.py"
echo ""
print_color $BLUE "4. Iniciar servidor principal (en otra terminal):"
echo "   npm start"
echo ""
print_color $BLUE "5. Test con frontend:"
echo "   # Acceder a http://localhost:3000"
echo "   # Probar query: 'busca a Roberto Molina'"
echo ""

print_color $YELLOW "📋 NOTAS IMPORTANTES:"
print_color $YELLOW "• El sistema funciona sin Zep Cloud (modo fallback)"
print_color $YELLOW "• Para memoria persistente, configurar ZEP_API_KEY real"
print_color $YELLOW "• ML Discovery requiere OPENAI_API_KEY y GEMINI_API_KEY"
print_color $YELLOW "• Todos los tests básicos deberían pasar sin APIs externas"

print_color $GREEN "✅ Setup completado exitosamente"