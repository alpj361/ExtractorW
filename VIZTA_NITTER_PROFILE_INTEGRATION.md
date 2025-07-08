# Integración Vizta + Nitter Profile

## Descripción General

Esta integración permite que **Vizta**, el asistente de investigación de ExtractorW, utilice automáticamente el módulo **Nitter Profile** para buscar tweets de usuarios específicos cuando el usuario lo solicite.

## Funcionalidad Implementada

### 🤖 Detección Automática de Usuarios

Vizta ahora detecta automáticamente cuando el usuario quiere buscar tweets de un usuario específico. Ejemplos de consultas que activan el módulo:

```
✅ "Busca los últimos tweets de @GuatemalaGob"
✅ "¿Qué dice @CashLuna últimamente?"
✅ "Analiza la actividad de @MPguatemala"
✅ "Tweets recientes de @elonmusk"
✅ "Qué ha dicho @usuario últimamente"
✅ "Revisa el perfil de @influencer"
```

### 🔧 Herramienta MCP Integrada

Se agregó la herramienta `nitter_profile` al sistema MCP de Vizta con las siguientes características:

- **Nombre**: `nitter_profile`
- **Descripción**: Obtiene tweets recientes de un usuario específico usando Nitter
- **Uso**: Ideal para analizar actividad de cuentas institucionales, políticos e influencers
- **Parámetros**:
  - `username` (requerido): Nombre de usuario sin el @
  - `limit` (opcional): Número máximo de tweets (5-20, default: 10)
  - `include_retweets` (opcional): Incluir retweets (default: false)
  - `include_replies` (opcional): Incluir replies (default: false)

### 📊 Capacidades

La herramienta ofrece las siguientes capacidades:

- ✅ **Extracción de tweets de usuario específico**
- ✅ **Información completa del perfil** (seguidores, siguiendo, verificación)
- ✅ **Ordenamiento cronológico** (más reciente primero)
- ✅ **Filtrado inteligente de contenido**
- ✅ **Métricas de engagement** por tweet (likes, retweets, replies)
- ✅ **Múltiples instancias Nitter** como fallback

## Arquitectura de Integración

### 1. Servicio MCP (mcp.js)
```javascript
// Función principal para ejecutar nitter_profile
async function executeNitterProfile(args, user) {
  // Implementación completa con validación y caching
}

// Herramienta registrada en AVAILABLE_TOOLS
nitter_profile: {
  name: 'nitter_profile',
  description: 'Obtiene tweets recientes de un usuario específico...',
  // Configuración completa de parámetros
}
```

### 2. Prompt de Vizta (viztaChat.js)
```javascript
// Detección automática en el prompt del sistema
"Si la consulta contiene @usuario, nombre de usuario, o frases como 
'tweets de [nombre]', 'qué dice [usuario]', 'actividad de [cuenta]', 
USA AUTOMÁTICAMENTE nitter_profile en lugar de nitter_context."
```

### 3. Endpoints MCP (mcp.js)
```javascript
// Endpoint directo para N8N y herramientas externas
POST /api/mcp/nitter_profile
{
  "username": "GuatemalaGob",
  "limit": 10,
  "include_retweets": false,
  "include_replies": false
}
```

## Ejemplos de Uso

### Consulta Básica
```
Usuario: "Busca los últimos tweets de @GuatemalaGob"

Vizta responde:
- Detecta automáticamente que es una consulta de usuario específico
- Usa nitter_profile con username="GuatemalaGob"
- Obtiene 10 tweets más recientes
- Presenta análisis con métricas de engagement
```

### Consulta con Análisis
```
Usuario: "¿Qué dice @CashLuna sobre política últimamente?"

Vizta responde:
- Usa nitter_profile para obtener tweets de @CashLuna
- Filtra tweets relacionados con política
- Proporciona análisis contextual
- Incluye métricas de engagement
```

### Consulta Institucional
```
Usuario: "Analiza la actividad de @MPguatemala"

Vizta responde:
- Obtiene tweets recientes del Ministerio Público
- Analiza temas y tendencias
- Proporciona estadísticas de engagement
- Contextualiza con eventos recientes
```

## Endpoints Disponibles

### 1. Endpoint MCP Directo
```http
POST /api/mcp/nitter_profile
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "username": "GuatemalaGob",
  "limit": 10,
  "include_retweets": false,
  "include_replies": false
}
```

### 2. Endpoint Vizta Chat
```http
POST /api/vizta-chat/query
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "message": "Busca los últimos tweets de @GuatemalaGob",
  "sessionId": "unique_session_id"
}
```

### 3. Endpoint de Capacidades
```http
GET /api/mcp/capabilities
```

## Respuesta Típica

### Estructura de Respuesta
```json
{
  "success": true,
  "message": "Tweets de usuario @GuatemalaGob obtenidos exitosamente",
  "username": "GuatemalaGob",
  "limit": 10,
  "result": {
    "tweets_count": 8,
    "execution_time": 4.2,
    "profile_info": {
      "username": "GuatemalaGob",
      "display_name": "Gobierno de Guatemala",
      "verified": true,
      "followers_count": "1.2M",
      "following_count": "1,234",
      "description": "Cuenta oficial del Gobierno de Guatemala"
    },
    "tweets": [
      {
        "id": "1234567890",
        "text": "Conoce las acciones para el cambio y oportunidades...",
        "timestamp": "3h",
        "metrics": {
          "likes": 45,
          "retweets": 12,
          "replies": 8
        },
        "link": "https://twitter.com/GuatemalaGob/status/1234567890"
      }
    ]
  }
}
```

## Casos de Uso Ideales

### 1. Monitoreo Institucional
- Gobierno de Guatemala (@GuatemalaGob)
- Ministerio Público (@MPguatemala)
- Congreso de Guatemala (@CongresoGuate)
- Procuraduría de Derechos Humanos (@PDHgt)

### 2. Análisis Político
- Presidencia (@ViceGuatemala)
- Funcionarios públicos
- Líderes políticos
- Candidatos electorales

### 3. Influencers y Medios
- Periodistas guatemaltecos
- Influencers (@influencersGUA)
- Personalidades públicas (@CashLuna)
- Creadores de contenido (@kattyrodas)

### 4. Análisis de Crisis
- Respuestas oficiales a eventos
- Comunicación institucional
- Reacciones de líderes
- Análisis de sentiment

## Pruebas y Validación

### Script de Pruebas
```bash
# Ejecutar pruebas de integración
node ExtractorW/test-vizta-nitter-profile.js
```

### Pruebas Manuales
```bash
# 1. Probar capacidades MCP
curl -X GET http://localhost:8080/api/mcp/capabilities

# 2. Probar endpoint directo
curl -X POST http://localhost:8080/api/mcp/nitter_profile \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"username": "GuatemalaGob", "limit": 5}'

# 3. Probar Vizta Chat
curl -X POST http://localhost:8080/api/vizta-chat/query \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Busca los últimos tweets de @GuatemalaGob"}'
```

## Configuración del Sistema

### Variables de Entorno
```env
# ExtractorT debe estar corriendo para acceder a nitter_profile
EXTRACTORT_BASE_URL=http://localhost:8000

# Configuración de Nitter instances
NITTER_INSTANCES=nitter.poast.org,lightbrd.com,nitter.net
```

### Dependencias
- ExtractorT corriendo en puerto 8000
- Módulo nitter_profile implementado
- Sistema MCP de ExtractorW
- Autenticación JWT configurada

## Troubleshooting

### Problemas Comunes

1. **Error: "Herramienta no encontrada"**
   - Verificar que ExtractorT esté corriendo
   - Confirmar que el módulo nitter_profile esté implementado

2. **Error: "Requiere autenticación"**
   - Verificar token JWT válido
   - Confirmar headers de autorización

3. **Error: "No se pudieron obtener tweets"**
   - Verificar conectividad a instancias Nitter
   - Confirmar que el usuario existe en Twitter

4. **Vizta no detecta consultas de usuario**
   - Verificar que el prompt incluya detección automática
   - Usar frases específicas como "tweets de @usuario"

### Logs de Debugging
```javascript
// Activar logs detallados
console.log('🔧 MCP nitter_profile solicitado por usuario:', user.email);
console.log('📊 Parámetros:', { username, limit, include_retweets });
console.log('✅ Resultado:', result);
```

## Próximos Pasos

1. **Análisis Avanzado**: Integrar análisis de sentimiento con Gemini AI
2. **Caching Inteligente**: Implementar cache por usuario para mejor performance
3. **Métricas Históricas**: Rastrear cambios en métricas de engagement
4. **Alertas Automáticas**: Notificar sobre cambios significativos en usuarios
5. **Integración N8N**: Workflows automáticos de monitoreo

---

## Autor
**Integración implementada por:** AI Assistant  
**Fecha:** Enero 2025  
**Versión:** 1.0  
**Compatibilidad:** ExtractorW v2.0, ExtractorT v2.0 