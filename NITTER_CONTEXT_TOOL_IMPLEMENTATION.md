# IMPLEMENTACIÓN COMPLETA: Herramienta Nitter Context en ExtractorW

## 🎯 Resumen del Sistema

La herramienta `nitter_context` implementada en ExtractorW permite al chat obtener tweets usando ExtractorT, analizarlos completamente con Gemini AI y guardarlos individualmente en la tabla `recent_scrapes` para futura referencia.

## 🏗️ Arquitectura del Flujo

```
Chat/Usuario → ExtractorW (nitter_context) → ExtractorT (nitter_context API) → Nitter/Twitter
                     ↓                                                               ↓
              Gemini AI (Análisis)                                            Tweets Raw
                     ↓
              Supabase (recent_scrapes)
                     ↓
              PulseJ (Actividad Reciente)
```

## 📁 Archivos Implementados

### 1. Servicio Principal
**📂 `ExtractorW/server/services/nitterContext.js`**
- Función principal: `processNitterContext()`
- Análisis de sentimiento con Gemini 1.5 Flash
- Categorización automática de contenido
- Guardado individual de tweets en `recent_scrapes`

### 2. Rutas de API
**📂 `ExtractorW/server/routes/nitterContext.js`**
- `POST /api/nitter-context` - Endpoint principal
- `GET /api/nitter-context/test` - Endpoint de prueba
- Autenticación y validación de parámetros

### 3. Script de Prueba
**📂 `ExtractorW/test-nitter-context.js`**
- Prueba completa del flujo
- Verificación de configuración
- Métricas de rendimiento

## 🔧 Configuración Requerida

### Variables de Entorno
```env
# API de ExtractorT
EXTRACTOR_T_URL=http://localhost:8001

# Gemini AI para análisis
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase para almacenamiento
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Dependencias
```json
{
  "node-fetch": "^2.6.7",
  "@supabase/supabase-js": "^2.x"
}
```

## 📊 Estructura de Datos

### Input (Request)
```json
{
  "query": "Guatemala política",
  "location": "guatemala",
  "limit": 10,
  "session_id": "optional_session_id"
}
```

### Output (Response)
```json
{
  "success": true,
  "message": "Tweets obtenidos y analizados exitosamente",
  "data": {
    "query": "Guatemala política",
    "categoria": "Política",
    "tweets_found": 8,
    "tweets_saved": 8,
    "total_engagement": 1250,
    "avg_engagement": 156,
    "execution_time_ms": 12500,
    "tweets": [
      {
        "tweet_id": "1234567890",
        "usuario": "usuario_ejemplo",
        "fecha_tweet": "2024-01-15T10:30:00.000Z",
        "texto": "Contenido del tweet...",
        "enlace": "https://nitter.net/usuario_ejemplo/status/1234567890",
        "likes": 25,
        "retweets": 8,
        "replies": 3,
        "verified": false,
        "sentimiento": "neutral",
        "score_sentimiento": 0.15,
        "confianza_sentimiento": 0.85,
        "emociones_detectadas": ["preocupación", "esperanza"],
        "intencion_comunicativa": "informativo",
        "entidades_mencionadas": [
          {
            "nombre": "Congreso",
            "tipo": "organizacion",
            "contexto": "institución política"
          }
        ],
        "analisis_ai_metadata": {
          "modelo": "gemini-1.5-flash",
          "timestamp": "2024-01-15T10:35:00.000Z",
          "contexto_local": "Discusión sobre política guatemalteca",
          "intensidad": "media",
          "categoria": "Política",
          "tokens_usados": 245,
          "costo_estimado": 0.00001837,
          "api_response_time_ms": 1200
        }
      }
    ],
    "summary": "Se encontraron 8 tweets sobre 'Guatemala política' en la categoría Política. 8 tweets guardados exitosamente. Engagement promedio: 156. Los tweets han sido analizados y guardados para futura referencia."
  }
}
```

## 🧠 Análisis con Gemini AI

### Campos Analizados
1. **Sentimiento**: positivo, negativo, neutral
2. **Score de Sentimiento**: -1.0 a 1.0
3. **Confianza**: 0.0 a 1.0
4. **Emociones Detectadas**: Array de emociones
5. **Intención Comunicativa**: 8 tipos diferentes
6. **Entidades Mencionadas**: Personas, organizaciones, lugares, eventos
7. **Contexto Local**: Explicación del contexto guatemalteco

### Tipos de Intención Comunicativa
- `informativo`: Comparte datos/hechos objetivos
- `opinativo`: Expresa opinión personal o juicio
- `humoristico`: Busca entretener o hacer reír
- `alarmista`: Busca alertar o generar preocupación
- `critico`: Critica personas/instituciones/situaciones
- `promocional`: Promociona algo (evento, producto, idea)
- `conversacional`: Busca interacción/diálogo
- `protesta`: Expresión de descontento o resistencia

## 🏷️ Categorización Automática

### Categorías Soportadas
- **Política**: Gobierno, elecciones, partidos, funcionarios
- **Económica**: Finanzas, comercio, empleo, inversión
- **Sociales**: Educación, salud, familia, cultura, derechos
- **Tecnología**: Software, IA, desarrollo, digital
- **Deportes**: Fútbol, competencias, selección
- **General**: Todo lo que no encaja en las anteriores

### Algoritmo de Detección
Utiliza palabras clave específicas del contexto guatemalteco para clasificar automáticamente el contenido.

## 💾 Almacenamiento en Base de Datos

### Tabla: `recent_scrapes`
Cada tweet se guarda como una fila individual con:

#### Campos Principales
- `query_original`: Consulta original del usuario
- `query_clean`: Término de búsqueda limpio
- `herramienta`: 'nitter_context'
- `categoria`: Categoría detectada automáticamente

#### Datos del Tweet
- `tweet_id`: ID único del tweet
- `usuario`: Username del autor
- `fecha_tweet`: Fecha original del tweet
- `texto`: Contenido completo
- `enlace`: URL al tweet en Nitter
- `likes`, `retweets`, `replies`: Métricas de engagement
- `verified`: Estado de verificación

#### Análisis de IA
- `sentimiento`: Clasificación de sentimiento
- `score_sentimiento`: Puntuación numérica
- `confianza_sentimiento`: Nivel de confianza
- `emociones_detectadas`: Array JSONB de emociones
- `intencion_comunicativa`: Tipo de intención
- `entidades_mencionadas`: Array JSONB de entidades
- `analisis_ai_metadata`: Metadatos del análisis

#### Metadatos de Sesión
- `user_id`: ID del usuario que hizo la consulta
- `session_id`: ID de sesión del chat
- `mcp_request_id`: ID único de la request
- `mcp_execution_time`: Tiempo de ejecución en ms
- `location`: Ubicación de búsqueda
- `fecha_captura`: Timestamp de captura
- `raw_data`: Datos originales completos (JSONB)

## 🚀 Uso de la Herramienta

### 1. Desde el Chat (Automático)
El chat puede llamar automáticamente a la herramienta cuando el usuario hace preguntas sobre tweets o tendencias.

### 2. Llamada Directa al API
```bash
curl -X POST http://localhost:8080/api/nitter-context \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "Guatemala economía",
    "location": "guatemala",
    "limit": 5
  }'
```

### 3. Prueba del Sistema
```bash
cd ExtractorW
node test-nitter-context.js
```

## 📈 Métricas y Monitoreo

### Métricas Calculadas
- **Tweets Encontrados**: Cantidad total de tweets obtenidos
- **Tweets Guardados**: Cantidad exitosamente almacenada
- **Engagement Total**: Suma de likes + retweets + replies
- **Engagement Promedio**: Engagement total / número de tweets
- **Tiempo de Ejecución**: Duración total del proceso

### Logging Detallado
- Progreso de cada tweet procesado
- Análisis de sentimiento por tweet
- Errores y warnings específicos
- Estadísticas finales del proceso

## 🔗 Integración con PulseJ

Los tweets guardados aparecen automáticamente en:
- **Actividad Reciente**: Página principal de monitoreo
- **Monitoreo de Tweets**: Sección específica con cards expandibles
- **Estadísticas**: Métricas agregadas por usuario

## ⚡ Optimizaciones Implementadas

### Performance
- Procesamiento paralelo de análisis de sentimiento
- Pausas controladas entre requests para evitar rate limiting
- Guardado individual inmediato (no en lotes)

### Robustez
- Manejo graceful de errores por tweet
- Fallbacks para análisis de IA fallidos
- Validación exhaustiva de datos
- Parsing robusto de JSON malformado

### Escalabilidad
- Configuración flexible de límites
- Sistema de sesiones para agrupar consultas
- Limpieza automática de datos antiguos

## 🧪 Testing

### Script de Prueba Incluido
El script `test-nitter-context.js` verifica:
1. Configuración de variables de entorno
2. Conexión a ExtractorT
3. Análisis con Gemini AI
4. Guardado en Supabase
5. Métricas de rendimiento

### Casos de Prueba
- Queries simples y complejas
- Diferentes categorías de contenido
- Manejo de errores de API
- Validación de datos guardados

## 🔄 Flujo Completo de Datos

1. **Usuario**: Hace pregunta en el chat sobre tweets
2. **Chat**: Identifica necesidad de usar nitter_context
3. **ExtractorW**: Recibe request con autenticación
4. **ExtractorT**: Obtiene tweets de Nitter
5. **Gemini AI**: Analiza cada tweet individualmente
6. **Supabase**: Guarda cada tweet como fila separada
7. **PulseJ**: Muestra tweets en Actividad Reciente
8. **Usuario**: Ve resultados analizados y organizados

## ✅ Estado de Implementación

- ✅ Servicio principal implementado
- ✅ Rutas de API configuradas
- ✅ Análisis de IA completo
- ✅ Guardado en base de datos
- ✅ Script de prueba funcional
- ✅ Documentación completa
- ✅ Integración con PulseJ existente

## 🎯 Próximos Pasos

1. **Testing en Producción**: Probar con datos reales
2. **Optimización de Costos**: Ajustar análisis de IA según necesidad
3. **Filtros Avanzados**: Implementar filtros por sentimiento/intención
4. **Dashboard de Métricas**: Panel de control para administradores
5. **Alertas Automáticas**: Notificaciones por contenido específico

---

**✨ La herramienta está completamente implementada y lista para uso en producción.** 