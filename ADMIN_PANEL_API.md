# API del Panel de Administración - PulseJournal

## 📋 Endpoints Disponibles

Los siguientes endpoints están disponibles **exclusivamente para administradores** y proporcionan acceso completo a los datos del sistema para visualización en paneles de control.

## 🔐 Autenticación Requerida

Todos los endpoints requieren:
- Token de autorización válido
- Rol de administrador en el perfil del usuario

```bash
Authorization: Bearer <admin_token>
```

---

## 📊 1. Dashboard General

### `GET /api/admin/dashboard`

Obtiene estadísticas completas del sistema para el dashboard principal.

#### Ejemplo de Uso:
```bash
curl -X GET http://localhost:8080/api/admin/dashboard \
  -H "Authorization: Bearer <admin_token>"
```

#### Respuesta Completa:
```json
{
  "general_stats": {
    "total_users": 45,
    "total_credits_in_system": 2840,
    "average_credits_per_user": 63,
    "total_operations_30d": 156,
    "total_credits_consumed_30d": 420,
    "low_credit_users_count": 3
  },
  "operation_stats": [
    {
      "operation": "/api/processTrends",
      "count": 52,
      "credits_consumed": 156,
      "avg_credits_per_operation": 3
    },
    {
      "operation": "/api/sondeo",
      "count": 89,
      "credits_consumed": 89,
      "avg_credits_per_operation": 1
    },
    {
      "operation": "/api/create-document",
      "count": 15,
      "credits_consumed": 45,
      "avg_credits_per_operation": 3
    }
  ],
  "users": [
    {
      "id": "uuid-123",
      "email": "usuario1@ejemplo.com",
      "user_type": "Beta",
      "role": "user",
      "credits": 85,
      "credits_numeric": 85,
      "created_at": "2025-01-15T10:30:00Z",
      "is_low_credits": false
    },
    {
      "id": "uuid-456",
      "email": "admin@ejemplo.com",
      "user_type": "Admin",
      "role": "admin",
      "credits": "ilimitado",
      "credits_numeric": null,
      "created_at": "2025-01-10T08:00:00Z",
      "is_low_credits": false
    }
  ],
  "low_credit_users": [
    {
      "email": "usuario_bajo@ejemplo.com",
      "credits": 5,
      "user_type": "Beta"
    }
  ],
  "recent_logs": [
    {
      "user_email": "usuario1@ejemplo.com",
      "operation": "/api/processTrends",
      "credits_consumed": 3,
      "timestamp": "2025-01-16T15:45:00Z",
      "ip_address": "192.168.1.100",
      "response_time": 2340
    }
  ],
  "daily_metrics": [
    {
      "date": "2025-01-16",
      "operations": 12,
      "credits_consumed": 28
    },
    {
      "date": "2025-01-15",
      "operations": 8,
      "credits_consumed": 19
    }
  ],
  "top_users_by_consumption": [
    {
      "email": "power_user@ejemplo.com",
      "operations": 25,
      "credits": 75
    }
  ],
  "user_type_distribution": [
    {
      "user_type": "Beta",
      "count": 35
    },
    {
      "user_type": "Alpha",
      "count": 8
    },
    {
      "user_type": "Admin",
      "count": 2
    }
  ],
  "metadata": {
    "timestamp": "2025-01-16T16:00:00Z",
    "admin_user": "admin@ejemplo.com",
    "data_period": "30 días",
    "total_endpoints_with_credits": 3
  }
}
```

---

## 👥 2. Gestión de Usuarios

### `GET /api/admin/users`

Obtiene lista de usuarios con filtros avanzados y paginación.

#### Parámetros de Query:
| Parámetro | Tipo | Descripción | Valor por defecto |
|-----------|------|-------------|-------------------|
| `user_type` | string | Filtrar por tipo de usuario | - |
| `role` | string | Filtrar por rol | - |
| `low_credits` | boolean | Solo usuarios con ≤10 créditos | false |
| `limit` | integer | Número de resultados por página | 50 |
| `offset` | integer | Número de resultados a omitir | 0 |
| `order_by` | string | Campo para ordenar | created_at |
| `order_direction` | string | Dirección del orden (asc/desc) | desc |

#### Ejemplos de Uso:

**Obtener usuarios con créditos bajos:**
```bash
curl -X GET "http://localhost:8080/api/admin/users?low_credits=true&limit=20" \
  -H "Authorization: Bearer <admin_token>"
```

**Filtrar por tipo de usuario Beta:**
```bash
curl -X GET "http://localhost:8080/api/admin/users?user_type=Beta&order_by=credits&order_direction=asc" \
  -H "Authorization: Bearer <admin_token>"
```

**Paginación (página 2, 25 por página):**
```bash
curl -X GET "http://localhost:8080/api/admin/users?limit=25&offset=25" \
  -H "Authorization: Bearer <admin_token>"
```

#### Respuesta:
```json
{
  "users": [
    {
      "id": "uuid-123",
      "email": "usuario@ejemplo.com",
      "user_type": "Beta",
      "role": "user",
      "credits": 45,
      "credits_numeric": 45,
      "is_low_credits": false,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-16T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 25,
    "offset": 0,
    "has_more": true
  },
  "filters_applied": {
    "user_type": null,
    "role": null,
    "low_credits": false,
    "order_by": "created_at",
    "order_direction": "desc"
  },
  "timestamp": "2025-01-16T16:00:00Z"
}
```

---

## 📈 3. Logs de Actividad

### `GET /api/admin/logs`

Obtiene logs de uso con filtros avanzados.

#### Parámetros de Query:
| Parámetro | Tipo | Descripción | Valor por defecto |
|-----------|------|-------------|-------------------|
| `user_email` | string | Filtrar por email (búsqueda parcial) | - |
| `operation` | string | Filtrar por operación específica | - |
| `days` | integer | Días hacia atrás para buscar | 7 |
| `limit` | integer | Número de logs por página | 100 |
| `offset` | integer | Número de logs a omitir | 0 |

#### Ejemplos de Uso:

**Logs de un usuario específico:**
```bash
curl -X GET "http://localhost:8080/api/admin/logs?user_email=usuario@ejemplo.com&days=30" \
  -H "Authorization: Bearer <admin_token>"
```

**Logs de una operación específica:**
```bash
curl -X GET "http://localhost:8080/api/admin/logs?operation=/api/processTrends&days=14" \
  -H "Authorization: Bearer <admin_token>"
```

**Logs de la última semana:**
```bash
curl -X GET "http://localhost:8080/api/admin/logs?days=7&limit=50" \
  -H "Authorization: Bearer <admin_token>"
```

#### Respuesta:
```json
{
  "logs": [
    {
      "id": "log-uuid-123",
      "user_id": "user-uuid-456",
      "user_email": "usuario@ejemplo.com",
      "operation": "/api/processTrends",
      "credits_consumed": 3,
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2025-01-16T15:30:00Z",
      "request_params": {
        "method": "POST",
        "params": {},
        "query": {},
        "body_keys": ["rawData"]
      },
      "response_time": 2340,
      "created_at": "2025-01-16T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 100,
    "offset": 0,
    "has_more": true
  },
  "filters_applied": {
    "user_email": null,
    "operation": null,
    "days": 7
  },
  "timestamp": "2025-01-16T16:00:00Z"
}
```

---

## 🔧 4. Gestión de Créditos (Ya Implementado)

### `POST /api/credits/add`
Agregar créditos a usuarios (solo admins).

### `GET /api/credits/status`
Estado de créditos de cualquier usuario.

### `GET /api/credits/history`
Historial de uso de cualquier usuario.

---

## 📊 Casos de Uso del Panel de Admin

### 1. **Dashboard Principal**
```javascript
// Obtener datos para dashboard principal
const dashboardData = await fetch('/api/admin/dashboard', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
}).then(res => res.json());

// Mostrar estadísticas generales
console.log(`Total usuarios: ${dashboardData.general_stats.total_users}`);
console.log(`Usuarios con pocos créditos: ${dashboardData.general_stats.low_credit_users_count}`);

// Gráfico de operaciones por día
dashboardData.daily_metrics.forEach(day => {
  console.log(`${day.date}: ${day.operations} operaciones, ${day.credits_consumed} créditos`);
});
```

### 2. **Gestión de Usuarios**
```javascript
// Listar usuarios con pocos créditos
const lowCreditUsers = await fetch('/api/admin/users?low_credits=true', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
}).then(res => res.json());

// Agregar créditos masivamente
for (const user of lowCreditUsers.users) {
  if (user.credits_numeric < 5) {
    await fetch('/api/credits/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_email: user.email,
        credits_to_add: 50
      })
    });
  }
}
```

### 3. **Monitoreo de Actividad**
```javascript
// Monitorear actividad de las últimas 24 horas
const recentActivity = await fetch('/api/admin/logs?days=1&limit=200', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
}).then(res => res.json());

// Detectar patrones inusuales
const operationCounts = {};
recentActivity.logs.forEach(log => {
  operationCounts[log.operation] = (operationCounts[log.operation] || 0) + 1;
});

console.log('Actividad por operación (24h):', operationCounts);
```

### 4. **Alertas Automáticas**
```javascript
// Verificar usuarios que necesitan atención
const dashboard = await fetch('/api/admin/dashboard', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
}).then(res => res.json());

// Alerta: usuarios con pocos créditos
if (dashboard.general_stats.low_credit_users_count > 0) {
  console.log(`⚠️ ALERTA: ${dashboard.general_stats.low_credit_users_count} usuarios con créditos bajos`);
  dashboard.low_credit_users.forEach(user => {
    console.log(`- ${user.email}: ${user.credits} créditos`);
  });
}

// Alerta: consumo alto de créditos
const dailyConsumption = dashboard.daily_metrics.reduce((sum, day) => sum + day.credits_consumed, 0);
if (dailyConsumption > 200) {
  console.log(`⚠️ ALERTA: Alto consumo de créditos en los últimos 7 días: ${dailyConsumption}`);
}
```

---

## 🛡️ Seguridad

- **Verificación de rol admin** en cada endpoint
- **Row Level Security** en consultas a la base de datos
- **Logging de acceso** a endpoints administrativos
- **Validación de parámetros** para prevenir inyecciones

---

## 📈 Métricas Disponibles

### Estadísticas Generales:
- Total de usuarios registrados
- Créditos totales en el sistema
- Promedio de créditos por usuario
- Operaciones realizadas (30 días)
- Créditos consumidos (30 días)
- Usuarios con créditos bajos

### Análisis por Operación:
- Número de ejecuciones por endpoint
- Créditos consumidos por endpoint
- Promedio de créditos por operación
- Tiempo de respuesta promedio

### Métricas Temporales:
- Actividad diaria (últimos 7 días)
- Top usuarios por consumo (30 días)
- Distribución por tipo de usuario
- Logs de actividad con timestamps

---

## 🚀 Próximas Mejoras

- **Exportación de datos** (CSV, Excel)
- **Alertas por email** automáticas
- **Gráficos interactivos** en tiempo real
- **Reportes programados** semanales/mensuales
- **API de webhooks** para integraciones externas 