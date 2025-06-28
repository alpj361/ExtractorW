# MCP SERVER - Micro Command Processor

El MCP Server es un **orquestador de herramientas para agentes IA** integrado en ExtractorW que centraliza y administra el acceso a múltiples servicios especializados.

## 🎯 Concepto

El MCP Server actúa como una **capa de abstracción** que permite a agentes IA acceder de manera unificada a diferentes herramientas de extracción, análisis y procesamiento de datos, sin necesidad de conocer los detalles de implementación de cada servicio.

## 📋 Herramientas Disponibles

### 1. nitter_context
- **Descripción**: Obtiene tweets usando Nitter, los analiza con Gemini AI (sentimiento, intención, entidades) y los guarda en la base de datos
- **Categoría**: social_media_analysis
- **Créditos**: 5 por uso
- **Características**:
  - Extracción de tweets con Nitter
  - Análisis de sentimiento con Gemini AI
  - Detección de intención comunicativa
  - Extracción de entidades mencionadas
  - Guardado individual en base de datos
  - Categorización automática
- **Parámetros**:
  - `q` (string, requerido): Término de búsqueda
  - `location` (string, opcional): Ubicación (default: "guatemala")
  - `limit` (integer, opcional): Límite de tweets (5-50, default: 10)
  - `session_id` (string, opcional): ID de sesión del chat (se genera automáticamente)

## 🚀 Endpoints Disponibles

### Estado y Configuración

#### `GET /api/mcp/status`
Obtiene el estado general del MCP Server y conectividad con servicios externos.

**Respuesta:**
```json
{
  "success": true,
  "message": "Estado del MCP Server",
  "server_status": {
    "server_name": "ExtractorW MCP Server",
    "version": "1.0.0",
    "status": "running",
    "available_tools": 1,
    "tools_list": ["nitter_context"],
    "external_services": {
      "extractor_t": {
        "url": "http://localhost:8001",
        "status": "connected",
        "response_time": "unknown"
      }
    }
  }
}
```

#### `GET /api/mcp/tools`
Lista todas las herramientas disponibles con su información.

**Respuesta:**
```json
{
  "success": true,
  "message": "Herramientas MCP disponibles",
  "tools": [
    {
      "name": "nitter_context",
      "description": "Obtiene contexto social de Twitter/X usando Nitter para un término específico",
      "category": "social_media",
      "parameters": { ... },
      "usage_credits": 3
    }
  ],
  "total_tools": 1
}
```

### Ejecución de Herramientas

#### `POST /api/mcp/execute`
Ejecuta cualquier herramienta de manera genérica.

**Request Body:**
```json
{
  "tool_name": "nitter_context",
  "parameters": {
    "q": "elecciones guatemala",
    "location": "guatemala",
    "limit": 10
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Herramienta nitter_context ejecutada exitosamente",
  "tool_name": "nitter_context",
  "result": {
    "success": true,
    "query": "elecciones guatemala",
    "location": "guatemala",
    "tweet_count": 8,
    "tweets": [ ... ],
    "message": "8 tweets found"
  }
}
```

#### `POST /api/mcp/nitter_context` 🔐
Endpoint específico para nitter_context con análisis completo (requiere autenticación).

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "q": "elecciones guatemala",
  "location": "guatemala", 
  "limit": 10,
  "session_id": "chat_session_123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Análisis de tweets completado exitosamente",
  "query": "elecciones guatemala",
  "location": "guatemala",
  "limit": 10,
  "session_id": "chat_session_123",
  "result": {
    "success": true,
    "content": "Análisis completo de 8 tweets sobre...",
    "categoria": "Política",
    "tweet_count": 8,
    "tweets_saved": 8,
    "total_engagement": 245,
    "avg_engagement": 31,
    "execution_time": 12500,
    "tweets": [...],
    "summary": "Análisis de sentimiento completado..."
  }
}
```

#### `GET /api/mcp/stream` ⭐ **(Para N8N SSE Trigger)**
Endpoint de Server-Sent Events para integración con N8N SSE Trigger.

**Headers de Respuesta:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

**Eventos Emitidos:**
- `connected`: Confirmación de conexión inicial
- `heartbeat`: Señal de vida cada 30 segundos
- `status`: Estado del servidor cada 60 segundos
- `tool_available`: Notificación de herramientas disponibles
- `error`: Errores del servidor

**Ejemplo de evento SSE:**
```
event: heartbeat
data: {"message":"MCP Server activo","timestamp":"2024-01-15T10:30:00.000Z","uptime":3600}

event: status
data: {"message":"Estado del MCP Server","status":{"server_name":"ExtractorW MCP Server","available_tools":1},"timestamp":"2024-01-15T10:31:00.000Z"}

```

### Información de Herramientas

#### `GET /api/mcp/tools/:tool_name`
Obtiene información detallada de una herramienta específica.

## 🔧 Configuración

### Variables de Entorno

```bash
# URL del servicio ExtractorT
EXTRACTOR_T_URL=http://localhost:8001

# API de Gemini AI para análisis de sentimiento
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase para almacenamiento
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Autenticación

Las rutas de ejecución de herramientas (`/execute`, `/nitter_context`) requieren autenticación mediante el middleware `requireAuth` de ExtractorW.

Las rutas de información (`/tools`, `/status`, `/capabilities`) son públicas para permitir discovery desde N8N.

**Token JWT requerido en headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🧪 Pruebas

### Ejecutar Pruebas
```bash
cd ExtractorW
node test-mcp-server.js
```

### Con Token de Autenticación
```bash
TEST_TOKEN=tu_token_jwt node test-mcp-server.js
```

### Pruebas Incluidas
1. **Estado del MCP Server**: Verifica conectividad y estado
2. **Listar herramientas**: Obtiene catálogo completo
3. **Info herramienta específica**: Detalles de nitter_context
4. **Nitter Context (directo)**: Endpoint específico
5. **Ejecutar herramienta (genérico)**: Endpoint universal
6. **Validación de parámetros**: Manejo de errores

## 📁 Estructura de Archivos

```
ExtractorW/
├── server/
│   ├── routes/
│   │   └── mcp.js              # Rutas del MCP Server
│   │   └── mcp.js              # Lógica de orquestación
│   └── routes/
│       └── index.js            # Registro de rutas
├── test-mcp-server.js          # Script de pruebas
└── MCP_SERVER_README.md        # Esta documentación
```

## 🔄 Flujo de Ejecución

1. **Cliente envía request** → `/api/mcp/execute` o endpoint específico
2. **Autenticación** → Middleware `requireAuth` valida usuario
3. **Validación** → Se verifican parámetros según configuración de herramienta
4. **Orquestación** → MCP Service ejecuta herramienta específica
5. **Comunicación** → Se conecta con servicio externo (ExtractorT)
6. **Respuesta** → Se devuelve resultado unificado al cliente

## 🚀 Agregar Nuevas Herramientas

Para agregar una nueva herramienta al MCP Server:

### 1. Actualizar Configuración
En `server/services/mcp.js`, agregar a `AVAILABLE_TOOLS`:

```javascript
nueva_herramienta: {
  name: 'nueva_herramienta',
  description: 'Descripción de la herramienta',
  parameters: {
    param1: {
      type: 'string',
      required: true,
      description: 'Descripción del parámetro'
    }
  },
  service_endpoint: '/endpoint',
  service_url: 'http://servicio:puerto',
  category: 'categoria',
  usage_credits: 5
}
```

### 2. Implementar Ejecutor
Agregar case en función `executeTool()`:

```javascript
case 'nueva_herramienta':
  result = await executeNuevaHerramienta(
    parameters.param1,
    user
  );
  break;
```

### 3. Crear Función de Ejecución
```javascript
async function executeNuevaHerramienta(param1, user = null) {
  // Lógica de comunicación con servicio externo
}
```

### 4. Agregar Ruta Específica (Opcional)
En `server/routes/mcp.js`:

```javascript
router.post('/tools/nueva_herramienta', requireAuth, async (req, res) => {
  // Endpoint específico para la herramienta
});
```

## 🛡️ Seguridad

- ✅ **Autenticación requerida** en todos los endpoints
- ✅ **Validación de parámetros** antes de ejecución
- ✅ **Timeout configurado** en comunicaciones externas
- ✅ **Manejo de errores** robusto
- ✅ **Logging completo** de operaciones

## 📊 Monitoreo

El MCP Server registra automáticamente:
- ✅ Ejecución de herramientas con usuario y timestamp
- ✅ Errores y excepciones con contexto
- ✅ Tiempo de respuesta de servicios externos
- ✅ Estado de conectividad con servicios

## 🔗 Integración con Agentes IA

El MCP Server está diseñado para ser consumido por agentes IA que necesitan:
- **Contexto social** (nitter_context)
- **Análisis de tendencias** (próximamente)
- **Extracción de datos** (próximamente)
- **Procesamiento de documentos** (próximamente)

Los agentes pueden descubrir herramientas dinámicamente usando `/api/mcp/tools` y ejecutarlas según sus necesidades específicas.

---

**Versión**: 1.0.0  
**Última actualización**: 2024  
**Mantenedor**: Equipo ExtractorW 