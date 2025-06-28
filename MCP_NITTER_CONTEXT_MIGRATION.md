# MIGRACIÓN: Integración de Nitter Context Completo en MCP Server

## 🎯 Resumen de Cambios

Se ha integrado exitosamente la nueva implementación de `nitter_context` en el MCP Server de ExtractorW, reemplazando la versión básica anterior con una versión completa que incluye análisis con Gemini AI y guardado en base de datos.

## 📋 Cambios Realizados

### 1. Servicio MCP Actualizado (`server/services/mcp.js`)

#### Importaciones
```javascript
// NUEVO: Importación del servicio completo
const { processNitterContext } = require('./nitterContext');
```

#### Configuración de Herramienta Actualizada
```javascript
// ANTES
{
  name: 'nitter_context',
  description: 'Obtiene contexto social de Twitter/X usando Nitter para un término específico',
  category: 'social_media',
  usage_credits: 3
}

// DESPUÉS
{
  name: 'nitter_context',
  description: 'Obtiene tweets usando Nitter, los analiza con Gemini AI (sentimiento, intención, entidades) y los guarda en la base de datos',
  category: 'social_media_analysis',
  usage_credits: 5,
  features: [
    'Extracción de tweets con Nitter',
    'Análisis de sentimiento con Gemini AI',
    'Detección de intención comunicativa',
    'Extracción de entidades mencionadas',
    'Guardado individual en base de datos',
    'Categorización automática'
  ]
}
```

#### Función `executeNitterContext` Reemplazada
- **ANTES**: Llamada simple a ExtractorT, respuesta básica con tweets formateados
- **DESPUÉS**: Uso del servicio `processNitterContext` completo con análisis AI y guardado en BD

### 2. Rutas MCP Actualizadas (`server/routes/mcp.js`)

#### Autenticación Agregada
```javascript
// NUEVO: Importación de requireAuth
const { verifyUserAccess, requireAuth } = require('../middlewares/auth');

// Endpoints que ahora requieren autenticación:
router.post('/execute', requireAuth, async (req, res) => { ... });
router.post('/nitter_context', requireAuth, async (req, res) => { ... });
```

#### Parámetros Ampliados
```javascript
// NUEVO: session_id agregado a todos los endpoints
{
  q: string (requerido),
  location: string (opcional),
  limit: number (opcional),
  session_id: string (opcional)  // NUEVO
}
```

#### Validación Mejorada
```javascript
// NUEVO: Validación de límites
if (limit && (typeof limit !== 'number' || limit < 5 || limit > 50)) {
  return res.status(400).json({
    success: false,
    message: 'El parámetro limit debe ser un número entre 5 y 50'
  });
}
```

### 3. Capacidades MCP Actualizadas

#### Descripción Mejorada
```javascript
// NUEVO: Descripción completa en /capabilities
{
  "name": "nitter_context",
  "description": "Obtiene tweets usando Nitter, los analiza con Gemini AI (sentimiento, intención, entidades) y los guarda en la base de datos",
  "features": [
    "Extracción de tweets con Nitter",
    "Análisis de sentimiento con Gemini AI",
    "Detección de intención comunicativa",
    "Extracción de entidades mencionadas",
    "Guardado individual en base de datos",
    "Categorización automática"
  ]
}
```

## 🔧 Configuración Requerida

### Variables de Entorno Nuevas
```bash
# REQUERIDAS para la nueva funcionalidad
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# EXISTENTES
EXTRACTOR_T_URL=http://localhost:8001
```

### Autenticación JWT
Los endpoints de ejecución ahora requieren token JWT:
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📊 Formato de Respuesta Actualizado

### ANTES (Respuesta Básica)
```json
{
  "success": true,
  "content": "Análisis de 5 tweets sobre 'guatemala':\n\n@user1: tweet text...",
  "query": "guatemala",
  "location": "guatemala",
  "tweet_count": 5,
  "tweets": [...],
  "message": "5 tweets found"
}
```

### DESPUÉS (Respuesta Completa)
```json
{
  "success": true,
  "content": "Análisis completo de 5 tweets sobre 'guatemala':\n\n📊 Categoría: Social\n💬 Engagement total: 245\n📈 Engagement promedio: 49\n⏱️ Tiempo de procesamiento: 8500ms\n\n🐦 Tweets analizados:\n...",
  "query": "guatemala",
  "location": "guatemala",
  "session_id": "mcp_session_1234567890_abc123",
  "categoria": "Social",
  "tweet_count": 5,
  "tweets_saved": 5,
  "total_engagement": 245,
  "avg_engagement": 49,
  "execution_time": 8500,
  "tweets": [
    {
      "tweet_id": "...",
      "usuario": "user1",
      "texto": "...",
      "sentimiento": "positive",
      "score_sentimiento": 0.8,
      "intencion_comunicativa": "informative",
      "entidades_mencionadas": [...],
      "likes": 10,
      "retweets": 5,
      "replies": 2
    }
  ],
  "summary": "Análisis de sentimiento completado...",
  "message": "5 tweets analizados y guardados con Gemini AI"
}
```

## 🧪 Pruebas

### Script de Prueba Actualizado
```bash
# Ejecutar pruebas completas
node test-mcp-server-updated.js

# Configurar token de prueba
export TEST_JWT_TOKEN="your_jwt_token_here"
```

### Pruebas Incluidas
1. ✅ Estado del MCP Server
2. ✅ Listado de herramientas
3. ✅ Información de herramienta específica
4. ✅ Capacidades MCP (para N8N)
5. 🔐 Ejecución de nitter_context completo (requiere auth)
6. 🔐 Ejecutor universal MCP (requiere auth)

## 🔄 Compatibilidad

### Endpoints Públicos (Sin Cambios)
- `GET /api/mcp/status`
- `GET /api/mcp/tools`
- `GET /api/mcp/tools/:tool_name`
- `GET /api/mcp/capabilities`

### Endpoints Autenticados (Nuevos Requisitos)
- `POST /api/mcp/execute` - Ahora requiere JWT
- `POST /api/mcp/nitter_context` - Ahora requiere JWT

### N8N Integration
- Endpoints de discovery siguen siendo públicos
- Ejecución de herramientas ahora requiere autenticación
- Endpoint `/call` devuelve error 401 para nitter_context

## 📈 Beneficios de la Migración

### Funcionalidad Ampliada
- ✅ Análisis de sentimiento con IA
- ✅ Detección de intención comunicativa
- ✅ Extracción de entidades mencionadas
- ✅ Guardado individual en base de datos
- ✅ Categorización automática
- ✅ Métricas de engagement

### Mejor Integración
- ✅ Datos disponibles en PulseJ automáticamente
- ✅ Historial de análisis persistente
- ✅ Trazabilidad por usuario y sesión
- ✅ Métricas de rendimiento

### Seguridad Mejorada
- ✅ Autenticación obligatoria para ejecución
- ✅ Trazabilidad por usuario
- ✅ Validación de parámetros robusta

## 🚀 Próximos Pasos

1. **Configurar Variables de Entorno** en producción
2. **Actualizar N8N Workflows** para usar autenticación JWT
3. **Monitorear Performance** del análisis con Gemini AI
4. **Documentar Casos de Uso** específicos para el chat
5. **Implementar Rate Limiting** si es necesario

## ⚠️ Consideraciones Importantes

### Créditos
- El costo por uso aumentó de **3 a 5 créditos** debido al análisis AI
- Considerar ajustar límites según el uso real

### Performance
- El tiempo de procesamiento es mayor debido al análisis AI
- Implementar timeouts apropiados en clientes

### Dependencias
- La herramienta ahora depende de Gemini AI y Supabase
- Verificar conectividad antes de ejecutar

---

**Estado de Migración**: ✅ **COMPLETADA**  
**Fecha**: Enero 2025  
**Responsable**: Sistema MCP ExtractorW  
**Versión**: 2.0.0 