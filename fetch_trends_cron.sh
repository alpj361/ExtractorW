#!/bin/bash

# Script para ejecutar procesamiento de tendencias diariamente
# Ejecutar: crontab -e
# Agregar: 0 14 * * * /ruta/al/script/fetch_trends_cron.sh

# Configuración
SERVER_URL="https://server.standatpd.com"
ENDPOINT="/api/processTrends"
LOG_FILE="/var/log/trends_cron.log"

# ⚠️ IMPORTANTE: Reemplaza este token por tu token de admin válido
# Puedes obtenerlo desde el navegador (F12 > Application > Local Storage > access_token)
# O desde la consola del frontend: localStorage.getItem('access_token')
AUTH_TOKEN="TU_TOKEN_DE_ADMIN_AQUI"

# Fecha y hora para logs
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Iniciando procesamiento de tendencias..." >> $LOG_FILE

# Hacer la petición POST con CURL
response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "User-Agent: cron-job-trends" \
    -d '{"rawData": null}' \
    "$SERVER_URL$ENDPOINT")

# Extraer código de estado HTTP
http_code=$(echo $response | grep -o 'HTTPSTATUS:[0-9]*' | cut -d: -f2)
response_body=$(echo $response | sed -E 's/HTTPSTATUS:[0-9]*$//')

# Log del resultado
if [ "$http_code" = "200" ]; then
    echo "[$TIMESTAMP] ✅ Tendencias procesadas exitosamente - HTTP $http_code" >> $LOG_FILE
    echo "[$TIMESTAMP] Respuesta: $(echo $response_body | head -c 200)..." >> $LOG_FILE
else
    echo "[$TIMESTAMP] ❌ Error procesando tendencias - HTTP $http_code" >> $LOG_FILE
    echo "[$TIMESTAMP] Error: $response_body" >> $LOG_FILE
fi

echo "[$TIMESTAMP] Procesamiento completado" >> $LOG_FILE
echo "----------------------------------------" >> $LOG_FILE 