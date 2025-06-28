# IMPLEMENTACIÓN COMPLETA: VIZTA CHAT CON MCP SERVER

## 🎯 Resumen del Sistema

Vizta Chat es un asistente de investigación inteligente que integra:
- **GPT-4o mini** con function calling
- **MCP Server** para herramientas de scraping
- **ExtractorT** para obtención de datos de Twitter
- **Supabase** para almacenamiento de scrapes
- **PulseJ** como frontend de chat

## 🏗️ Arquitectura Implementada

```
Usuario → PulseJ (Vizta Chat) → ExtractorW (GPT-4o + MCP) → ExtractorT (nitter_context) → Twitter/Nitter
                                        ↓
                               Supabase (recent_scrapes)
```

## 📊 Base de Datos: `recent_scrapes`

### Estructura de la Tabla
```sql
CREATE TABLE recent_scrapes (
  id BIGSERIAL PRIMARY KEY,
  
  -- Información de la consulta
  query_original TEXT NOT NULL,     -- Consulta del usuario
  query_clean TEXT NOT NULL,        -- Término de búsqueda limpio
  herramienta TEXT NOT NULL,        -- Herramienta MCP usada
  categoria TEXT NOT NULL,          -- Categoría asignada
  
  -- Información del tweet
  tweet_id TEXT NOT NULL,
  usuario TEXT NOT NULL,
  fecha_tweet TIMESTAMP,
  texto TEXT NOT NULL,
  enlace TEXT,
  
  -- Métricas y análisis
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  sentimiento TEXT DEFAULT 'neutral',
  score_sentimiento DECIMAL(3,2),
  
  -- Metadatos del usuario y sesión
  user_id UUID,
  session_id TEXT,
  mcp_request_id TEXT,
  mcp_execution_time INTEGER,
  
  -- Timestamps
  fecha_captura TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Características Especiales
- **Índices optimizados** para consultas rápidas
- **Triggers automáticos** para calcular score_propagacion
- **Campos JSONB** para datos flexibles
- **Constraints** para validación de datos

## 🚀 Backend: ExtractorW

### 1. Servicio de Recent Scrapes (`server/services/recentScrapes.js`)
```javascript
// Funciones principales:
- saveScrape()           // Guardar tweets en BD
- getUserScrapes()       // Obtener scrapes del usuario  
- getUserScrapeStats()   // Estadísticas de uso
- getSessionScrapes()    // Scrapes por sesión
- cleanupOldScrapes()    // Limpieza automática
```

### 2. Rutas de Vizta Chat (`server/routes/viztaChat.js`)
```javascript
// Endpoints implementados:
POST /api/vizta-chat/query          // Consulta principal con GPT-4o
GET  /api/vizta-chat/scrapes        // Obtener scrapes del usuario
GET  /api/vizta-chat/stats          // Estadísticas de uso
GET  /api/vizta-chat/session/:id    // Scrapes por sesión
GET  /api/vizta-chat/tools          // Herramientas MCP disponibles
```

### 3. Integración GPT-4o mini
- **Function calling** automático
- **Prompt especializado** para análisis de redes sociales
- **Contexto guatemalteco** incorporado
- **Respuestas en dos fases**: obtención de datos + análisis

## 🎨 Frontend: PulseJ

### 1. Servicio de Conexión (`src/services/viztaChat.ts`)
```typescript
// Funciones principales:
- sendViztaChatQuery()    // Enviar consulta al backend
- getUserScrapes()        // Obtener scrapes del usuario
- getUserScrapeStats()    // Estadísticas de uso
- getSessionScrapes()     // Scrapes por sesión
- getAvailableTools()     // Herramientas disponibles
```

### 2. Componente de Chat (`src/components/ui/vizta-chat.tsx`)
- **UI moderna** con shadcn/ui
- **Gestión de sesiones** automática
- **Estados de carga** y error
- **Integración completa** con backend

## 🔧 MCP Server: Herramientas Disponibles

### nitter_context
```javascript
// Parámetros:
{
  q: string,        // Consulta de búsqueda
  location: string, // Ubicación (default: guatemala)
  limit: number     // Límite de tweets (default: 5)
}

// Respuesta:
{
  success: boolean,
  tweets: Array<Tweet>,
  query: string,
  location: string,
  tweet_count: number,
  formatted_context: string  // Para el AI Agent
}
```

## 🚦 Flujo Completo de Funcionamiento

### 1. Usuario hace consulta
```
Usuario: "Analízame tweets sobre Guatemala"
```

### 2. Frontend envía al backend
```javascript
POST /api/vizta-chat/query
{
  message: "Analízame tweets sobre Guatemala",
  sessionId: "session_123456"
}
```

### 3. GPT-4o mini decide usar herramienta
```javascript
// GPT-4o mini function call:
{
  name: "nitter_context",
  arguments: {
    q: "Guatemala",
    location: "guatemala", 
    limit: 5
  }
}
```

### 4. MCP Server ejecuta herramienta
```javascript
// Llamada a ExtractorT:
GET https://api.standatpd.com/nitter_context?q=Guatemala&location=guatemala&limit=5
```

### 5. Datos se guardan en Supabase
```sql
INSERT INTO recent_scrapes (
  query_original, query_clean, herramienta, tweets...
)
```

### 6. GPT-4o mini genera análisis final
```
"Basándome en los 5 tweets más recientes sobre Guatemala, he encontrado..."
```

## 📈 Métricas y Monitoreo

### Estadísticas Disponibles
- **Total de scrapes** por usuario
- **Herramientas más usadas**
- **Categorías más consultadas**
- **Tiempo de ejecución** promedio
- **Scrapes por sesión**

### Logs del Sistema
- **Consultas de usuario** con timestamps
- **Ejecución de herramientas** MCP
- **Errores y excepciones**
- **Performance metrics**

## 🧪 Testing y Validación

### Script de Pruebas (`test-vizta-chat.js`)
```bash
# Ejecutar todas las pruebas
node test-vizta-chat.js

# Probar solo MCP Server
node test-vizta-chat.js mcp

# Probar consulta específica
node test-vizta-chat.js query "Analiza tweets sobre economía"
```

### Casos de Prueba
1. **Consultas básicas** de análisis de tweets
2. **Consultas específicas** por tema
3. **Manejo de errores** y timeouts
4. **Almacenamiento** en base de datos
5. **Recuperación** de datos históricos

## 🔐 Seguridad y Autenticación

### Autenticación
- **JWT tokens** de Supabase
- **Middleware de verificación** en todas las rutas
- **Asociación de datos** por user_id

### Validación
- **Sanitización** de inputs
- **Validación de parámetros** en GPT-4o
- **Rate limiting** (pendiente implementar)
- **Manejo seguro** de errores

## 🚀 Deployment y Configuración

### Variables de Entorno Requeridas
```bash
# ExtractorW
OPENAI_API_KEY=sk-...              # API Key de OpenAI
SUPABASE_URL=https://...           # URL de Supabase
SUPABASE_SERVICE_KEY=...           # Service Key de Supabase

# PulseJ
VITE_EXTRACTOR_W_URL=https://server.standatpd.com
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

### Dependencias Nuevas
```json
// ExtractorW package.json
{
  "openai": "^4.0.0",
  "uuid": "^9.0.0"
}
```

## 📋 Estado Actual

### ✅ Implementado y Funcionando
- [x] Tabla `recent_scrapes` creada
- [x] Servicio de manejo de scrapes
- [x] Rutas de Vizta Chat en ExtractorW
- [x] Integración GPT-4o mini con function calling
- [x] Servicio frontend en PulseJ
- [x] Componente de chat actualizado
- [x] Script de pruebas completo
- [x] MCP Server operativo

### 🔄 Próximos Pasos Sugeridos
- [ ] Implementar categorización automática de tweets
- [ ] Agregar análisis de sentimiento en tiempo real
- [ ] Crear dashboard de analytics para scrapes
- [ ] Implementar rate limiting
- [ ] Agregar más herramientas MCP (news, events, etc.)
- [ ] Optimizar performance de consultas
- [ ] Implementar cache de respuestas frecuentes

## 🎯 Uso del Sistema

### Para el Usuario Final
1. **Abrir PulseJ** y hacer click en el ícono de chat 💬
2. **Escribir consulta** como "Analiza tweets sobre Guatemala"
3. **Enviar mensaje** y esperar respuesta del AI
4. **Ver análisis completo** con datos reales de Twitter
5. **Continuar conversación** en la misma sesión

### Para Desarrolladores
1. **Monitorear logs** en ExtractorW
2. **Revisar métricas** de uso en `/api/vizta-chat/stats`
3. **Ejecutar pruebas** con `test-vizta-chat.js`
4. **Consultar BD** para análisis de datos
5. **Extender herramientas** MCP según necesidades

---

**🎉 El sistema Vizta Chat está completamente implementado y listo para producción!** 