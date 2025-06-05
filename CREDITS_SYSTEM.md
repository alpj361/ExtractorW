# Sistema de Gestión de Créditos - PulseJournal

## 📋 Resumen del Sistema

El sistema de gestión de créditos controla el acceso a las operaciones de IA del backend, implementando un modelo de consumo por operación con logging detallado y gestión de usuarios.

## 💳 Costos por Operación

| Endpoint | Costo (créditos) | Descripción |
|----------|------------------|-------------|
| `/api/processTrends` | 3 | Análisis completo de tendencias con IA |
| `/api/sondeo` | 1 | Consulta/búsqueda tipo Perplexity |
| `/api/create-document` | 2-5 | Generación de documentos (variable según longitud) |
| `/api/send-email` | 0 | Envío de emails (gratuito) |
| `/api/trending-tweets` | 0 | Consulta de tweets (gratuito) |
| `/api/test-email` | 0 | Pruebas SMTP (gratuito) |

### Cálculo de Créditos para Documentos
- **2 créditos**: Documentos cortos (< 500 caracteres)
- **3 créditos**: Documentos medianos (500-1500 caracteres)
- **4 créditos**: Documentos largos (1500-3000 caracteres)
- **5 créditos**: Documentos muy largos (> 3000 caracteres)

## 🔐 Autenticación y Autorización

### Headers Requeridos
Todas las operaciones que consumen créditos requieren autenticación:

```bash
Authorization: Bearer <supabase_access_token>
```

### Roles de Usuario
- **Usuario regular**: Consume créditos según la tabla de costos
- **Admin**: Acceso ilimitado (no consume créditos)

## 📊 Endpoints del Sistema de Créditos

### 1. Consultar Estado de Créditos
```bash
GET /api/credits/status
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "credits": 45,
  "user_type": "Beta",
  "role": "user",
  "is_admin": false,
  "low_credits_alert": false,
  "operation_costs": { ... },
  "timestamp": "2025-01-XX..."
}
```

### 2. Historial de Uso
```bash
GET /api/credits/history?limit=10
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "recent_operations": [
    {
      "operation": "/api/processTrends",
      "credits_consumed": 3,
      "timestamp": "2025-01-XX...",
      "ip_address": "192.168.1.1",
      "response_time": 2500
    }
  ],
  "total_shown": 1,
  "timestamp": "2025-01-XX..."
}
```

### 3. Agregar Créditos (Solo Admins)
```bash
POST /api/credits/add
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "user_email": "usuario@ejemplo.com",
  "credits_to_add": 50
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Se agregaron 50 créditos a usuario@ejemplo.com",
  "previous_balance": 20,
  "new_balance": 70,
  "credits_added": 50,
  "timestamp": "2025-01-XX..."
}
```

## 🔧 Ejemplos de Uso

### 1. Análisis de Tendencias (3 créditos)
```bash
curl -X POST http://localhost:8080/api/processTrends \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rawData": {
      "trends": [...]
    }
  }'
```

### 2. Sondeo/Consulta (1 crédito)
```bash
curl -X POST http://localhost:8080/api/sondeo \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "contexto": "...",
    "pregunta": "¿Cuál es el sentimiento sobre...?"
  }'
```

### 3. Crear Documento (2-5 créditos)
```bash
curl -X POST http://localhost:8080/api/create-document \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "resumen",
    "content": "Contenido a procesar...",
    "length": "medio"
  }'
```

## ⚠️ Manejo de Errores

### Créditos Insuficientes (HTTP 402)
```json
{
  "error": "Créditos insuficientes",
  "message": "No tienes suficientes créditos para esta operación. Necesitas 3 créditos, tienes 1.",
  "credits_required": 3,
  "credits_available": 1,
  "low_credits_alert": true
}
```

### Token Inválido (HTTP 401)
```json
{
  "error": "Token inválido o expirado",
  "message": "El token de autorización no es válido"
}
```

### Usuario No Encontrado (HTTP 404)
```json
{
  "error": "Perfil de usuario no encontrado",
  "message": "No se pudo obtener la información del usuario"
}
```

## 📈 Sistema de Logging

### Información Registrada
- **Usuario**: ID, email
- **Operación**: Endpoint ejecutado
- **Créditos**: Cantidad consumida
- **Timestamp**: Fecha y hora
- **IP**: Dirección IP del cliente
- **User Agent**: Navegador/cliente usado
- **Parámetros**: Método, parámetros de entrada
- **Tiempo de Respuesta**: Duración en milisegundos

### Estructura de la Base de Datos
```sql
CREATE TABLE public.usage_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    user_email VARCHAR(255),
    operation VARCHAR(100),
    credits_consumed INTEGER,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    request_params JSONB,
    response_time INTEGER
);
```

## 🛡️ Seguridad y Políticas

### Row Level Security (RLS)
- Los usuarios solo pueden ver sus propios logs
- Los admins pueden ver todos los logs
- El sistema puede insertar logs automáticamente

### Limpieza Automática
- Los logs se eliminan automáticamente después de 90 días
- Función disponible: `cleanup_old_usage_logs()`

## 🚨 Alertas y Notificaciones

### Alerta de Créditos Bajos
- Se activa cuando el usuario tiene ≤ 10 créditos
- Incluida en respuestas de error y estado
- Permite planificar recarga antes del bloqueo

### Monitoreo de Uso
- Logs detallados para análisis de patrones
- Métricas de tiempo de respuesta
- Seguimiento por usuario y operación

## 🔧 Configuración de Administrador

### Asignar Créditos Manualmente
Durante la fase de pruebas, los créditos se asignan manualmente:

```sql
-- Agregar créditos a un usuario
UPDATE public.profiles 
SET credits = credits + 100 
WHERE email = 'usuario@ejemplo.com';

-- Convertir usuario en admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@ejemplo.com';
```

### Consultar Estado de Usuarios
```sql
-- Ver todos los usuarios y sus créditos
SELECT email, user_type, role, credits, created_at 
FROM public.profiles 
ORDER BY credits DESC;

-- Ver usuarios con pocos créditos
SELECT email, credits 
FROM public.profiles 
WHERE credits <= 10 AND role != 'admin';
```

## 📋 Tareas de Mantenimiento

### Limpiar Logs Antiguos
```sql
-- Ejecutar mensualmente
SELECT cleanup_old_usage_logs();
```

### Monitorear Uso Excesivo
```sql
-- Usuarios con mayor consumo en últimos 7 días
SELECT user_email, SUM(credits_consumed) as total_credits
FROM public.usage_logs 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_email
ORDER BY total_credits DESC;
```

## 🔮 Próximas Funcionalidades

- **Planes de suscripción**: Free, Pro, Business
- **Límites por tiempo**: Rate limiting por minuto/hora
- **Recarga automática**: Integración con pasarelas de pago
- **Dashboard avanzado**: Estadísticas semanales y proyecciones
- **API de webhooks**: Notificaciones automáticas de eventos 