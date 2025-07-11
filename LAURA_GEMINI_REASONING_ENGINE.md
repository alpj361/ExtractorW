# Laura - Motor de Razonamiento Gemini 2.5 Flash

## Descripción

Laura ahora utiliza **Gemini 2.5 Flash** como motor de razonamiento para planificar y ejecutar tareas de monitoreo de redes sociales con mayor precisión y contexto.

## Características

### 🧠 Motor de Razonamiento Inteligente
- **Modelo**: Gemini 1.5 Flash (alias estable)
- **Temperatura**: 0.2 (precisión optimizada)
- **Tokens máximos**: 1024
- **Latencia esperada**: 300-600ms

### 🎯 Planificación Inteligente
Laura puede ahora:
1. **Analizar intenciones** del usuario
2. **Elegir herramientas** apropiadas automáticamente
3. **Solicitar aclaraciones** cuando sea necesario
4. **Generar planes** detallados con razonamiento

### 📊 Métricas y Monitoreo
- Latencia de respuesta en tiempo real
- Conteo de tokens utilizados
- Timestamps de ejecución
- Logging detallado opcional

## Configuración

### Variables de Entorno
```bash
# Requerida
GEMINI_API_KEY=tu_api_key_aqui

# Opcional - Habilitar modo verbose
LAURA_VERBOSE_MODE=true
```

### Obtener API Key
1. Visita [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crea un nuevo proyecto
3. Genera una API key
4. Agrega la key a tu archivo `.env`

## Uso

### Automático
El motor de razonamiento se activa automáticamente en las siguientes situaciones:
- Consultas de monitoreo social
- Análisis de perfiles
- Búsquedas web
- Monitoreo general de tendencias

### Casos de Uso

#### 1. Intención Clara → Ejecución Directa
```
Usuario: "¿Qué dicen sobre la ley de protección animal?"
Laura: Analiza contexto → Planifica búsqueda → Ejecuta nitter_context
```

#### 2. Intención Ambigua → Solicitud de Aclaración
```
Usuario: "¿Qué está pasando?"
Laura: Detecta ambigüedad → Solicita especificación → Espera respuesta
```

#### 3. Análisis de Perfil Específico
```
Usuario: "Analiza @CongresoGt"
Laura: Identifica perfil → Planifica monitoreo → Ejecuta nitter_profile
```

## Herramientas Disponibles

### `nitter_context(q, location, limit)`
- **Propósito**: Análisis de conversaciones y tendencias
- **Parámetros**: 
  - `q`: Query de búsqueda
  - `location`: Ubicación geográfica
  - `limit`: Número máximo de resultados

### `nitter_profile(username, limit)`
- **Propósito**: Monitoreo de usuarios específicos
- **Parámetros**:
  - `username`: Nombre de usuario (sin @)
  - `limit`: Número máximo de tweets

### `perplexity_search(query)`
- **Propósito**: Búsqueda web y noticias actualizadas
- **Parámetros**:
  - `query`: Consulta de búsqueda

## Estructura de Respuesta

### Plan de Ejecución
```json
{
  "plan": {
    "action": "direct_execution|needs_clarification",
    "tool": "nitter_context|nitter_profile|perplexity_search",
    "args": {...},
    "reasoning": "Explicación del razonamiento"
  },
  "follow_up": "Pregunta de aclaración o null",
  "thought": "Análisis interno del contexto",
  "_metrics": {
    "latency_ms": 450,
    "timestamp": "2025-01-10T...",
    "model": "gemini-1.5-flash",
    "tokens_used": 156
  }
}
```

## Modo Verbose

### Activación
```bash
# Variable de entorno
export LAURA_VERBOSE_MODE=true

# O en código
const plan = await laura.buildLLMPlan(intent, extra, { verbose: true });
```

### Información Adicional
- Input completo del usuario
- Mensajes enviados al LLM
- Respuesta raw del modelo
- Plan parseado detallado
- Razonamiento interno
- Métricas de performance

## Pruebas

### Ejecutar Pruebas End-to-End
```bash
node test-laura-gemini-reasoning.js
```

### Casos de Prueba
1. **Intención clara**: Ley de protección animal
2. **Intención ambigua**: "¿Qué está pasando?"
3. **Análisis de perfil**: @CongresoGt
4. **Prueba directa**: buildLLMPlan
5. **Verificación de métricas**: Latencia y tokens

## Fallback y Manejo de Errores

### Estrategia de Fallback
Si el motor de razonamiento falla:
1. **Log del error** detallado
2. **Plan básico** automático
3. **Continuación** de la ejecución
4. **Métricas de error** registradas

### Plan de Fallback
```json
{
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_context",
    "args": {"q": "intent", "location": "guatemala", "limit": 10},
    "reasoning": "Plan de fallback debido a error en LLM"
  },
  "follow_up": null,
  "thought": "Error en generación de plan, usando estrategia básica"
}
```

## Optimización

### Prompt Engineering
- **Instrucciones explícitas** para formato JSON
- **Ejemplos few-shot** específicos
- **Contexto guatemalteco** optimizado
- **Validación** de estructura

### Performance
- **Temperatura baja** (0.2) para precisión
- **Tokens limitados** (1024) para eficiencia
- **Timeout** implícito del modelo
- **Retry** automático en caso de error

## Monitoreo y Logs

### Métricas Registradas
```
[LAURA] 🧠 Gemini 2.5 Flash - Latencia: 450ms
[LAURA] 🧠 Tokens estimados: 156 tokens
[LAURA] 🧠 Prompt tokens: 892 tokens
```

### Modo Verbose
```
[LAURA] 🧠 Verbose Mode - Input Intent: "¿Qué dicen sobre sismos?"
[LAURA] 🧠 Verbose Mode - Thought: "Consulta específica sobre sismos..."
[LAURA] 🧠 Verbose Mode - Reasoning: "Uso nitter_context con términos específicos..."
```

## Arquitectura

### Flujo de Ejecución
```
Usuario → AgentesService → LauraAgent → buildLLMPlan → geminiChat → executeTask → Resultado
```

### Integración
- **Activación automática** en tareas habilitadas
- **Compatibilidad** con sistema existente
- **Preservación** de funcionalidad clásica
- **Métricas** transparentes

## Consideraciones

### Costos
- Gemini 1.5 Flash es **gratuito** hasta cierto límite
- Monitoreo de tokens para **control de costos**
- Fallback automático para **continuidad**

### Seguridad
- API key en **variables de entorno**
- **No logging** de información sensible
- Validación de **estructura** de respuesta

### Rendimiento
- Latencia optimizada (~300-600ms)
- **Paralelización** con otras tareas
- **Timeout** automático del modelo
- **Caching** a nivel de modelo

## Ejemplo Completo

```javascript
// Consulta del usuario
const userQuery = "¿Qué dicen sobre la ley de protección animal en Guatemala?";

// Ejecución automática
const result = await agentesService.orchestrateQuery(userQuery, user);

// Respuesta con razonamiento
{
  "laura_findings": [{
    "agent": "Laura",
    "execution_strategy": ["gemini_reasoned_execution"],
    "llm_reasoning": "Uso nitter_context con términos específicos...",
    "llm_thought": "Consulta clara sobre tema legislativo...",
    "findings": {
      "trend": "ley protección animal Guatemala",
      "mentions": 45,
      "sentiment": 0.6,
      "top_posts": [...]
    }
  }]
}
```

## Próximos Pasos

1. **Refinamiento** de prompts basado en uso real
2. **Métricas avanzadas** de calidad de respuesta
3. **Integración** con sistema de memoria
4. **Optimización** de costos y performance
5. **Expansión** a otros agentes (Robert)

---

**Nota**: Este motor de razonamiento mantiene total compatibilidad con el sistema existente y proporciona capacidades avanzadas de planificación y ejecución para Laura.