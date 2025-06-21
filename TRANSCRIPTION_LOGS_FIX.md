# Fix para Logs de Transcripción de Audio

## 🚨 Problema Identificado

El sistema de transcripción de audio está intentando registrar métricas de `tokens_consumed` y `dollars_consumed` en la tabla `usage_logs`, pero estas columnas **NO EXISTEN** en la estructura actual de la tabla en Supabase.

### Error Específico
```
Column 'dollars_consumed' does not exist in table 'usage_logs'
```

## 🔍 Análisis del Código

El código está configurado para registrar estas métricas en:

1. **`server/routes/transcription.js`** (líneas 124-125, 298-299):
   ```javascript
   req.tokens_consumed = tokensConsumed;
   req.dollars_consumed = dollarsConsumed;
   ```

2. **`server/services/logs.js`** (líneas 55-59):
   ```javascript
   if (req.tokens_consumed !== undefined) {
     logEntry.tokens_consumed = req.tokens_consumed;
   }
   if (req.dollars_consumed !== undefined) {
     logEntry.dollars_consumed = req.dollars_consumed;
   }
   ```

## 🛠️ Solución

### Paso 1: Ejecutar Migración en Supabase

1. Abre **Supabase SQL Editor**
2. Copia y pega el contenido de `add_transcription_metrics_to_usage_logs.sql`
3. Ejecuta la migración

### Paso 2: Verificar Migración

Ejecuta el script de verificación:
```bash
node verify-usage-logs-migration.js
```

## 📊 Columnas que se Agregarán

- **`tokens_consumed`** (INTEGER): Tokens de IA consumidos en la transcripción
- **`dollars_consumed`** (DECIMAL(10,6)): Costo en dólares de la operación
- **`current_credits`** (INTEGER): Créditos disponibles del usuario al momento

## 🎯 Beneficios Después de la Migración

1. **Tracking de Costos**: Monitoreo preciso de gastos de IA
2. **Análisis de Uso**: Estadísticas de consumo de tokens por usuario
3. **Auditoría Completa**: Logs detallados de todas las operaciones de transcripción
4. **Dashboards Admin**: Métricas para el panel administrativo

## 📈 Métricas que se Registrarán

### Para Transcripciones de Audio/Video:
- **Tokens**: ~4 caracteres = 1 token (aprox)
- **Costo**: $0.000015 por token (Gemini AI)
- **Créditos**: 0 (transcripción es gratuita)

### Ejemplo de Log:
```json
{
  "operation": "/api/transcription/upload",
  "user_email": "usuario@example.com",
  "credits_consumed": 0,
  "tokens_consumed": 2500,
  "dollars_consumed": 0.0375,
  "current_credits": 150
}
```

## ⚠️ Estado Actual

- ❌ **Logs fallando**: Las transcripciones no se están registrando correctamente
- ❌ **Métricas perdidas**: No hay tracking de costos de IA
- ❌ **Admin dashboard incompleto**: Faltan estadísticas de transcripción

## ✅ Estado Después de la Migración

- ✅ **Logs funcionando**: Todas las transcripciones se registran correctamente
- ✅ **Tracking completo**: Costos y tokens monitoreados
- ✅ **Dashboard completo**: Estadísticas detalladas disponibles
- ✅ **Auditoría completa**: Historial completo de uso de transcripción

## 🧪 Pruebas Post-Migración

1. Ejecutar una transcripción de prueba
2. Verificar que aparezca en `usage_logs` con todas las métricas
3. Confirmar que el dashboard admin muestre las estadísticas
4. Validar que no hay errores en los logs del servidor 