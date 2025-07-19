# Laura Memory

Sistema de memoria pública para Laura usando Zep Cloud como backend de knowledge graph.

## Descripción

Laura Memory proporciona un sistema de memoria global que permite a Laura:
- Guardar información relevante descubierta durante sus análisis
- Buscar información previa para mejorar sus respuestas
- Aprender automáticamente sobre usuarios, términos y hechos relevantes
- Mantener un knowledge graph persistente en Zep Cloud

## Instalación

### Dependencias Python

```bash
pip install -r requirements.txt
```

### Variables de Entorno

Crear un archivo `.env` con:

```env
ZEP_API_KEY=tu_api_key_de_zep
ZEP_URL=https://api.getzep.com
LAURA_SESSION_ID=public/global
LAURA_MEMORY_ENABLED=true
LAURA_MEMORY_URL=http://localhost:5001
```

### Ejecutar Servidor

```bash
python server.py
```

## Uso

### Flujo Básico

1. **Guardar información**: Laura automáticamente detecta y guarda información relevante
2. **Buscar información**: Las queries se mejoran con contexto de memoria
3. **Aprender usuarios**: Los usuarios descubiertos se guardan automáticamente

### Ejemplo de Flujo

```javascript
// 1. Laura recibe una query
const query = "¿Qué pasó con el congreso?";

// 2. Se mejora con información de memoria
const enhanced = await lauraMemoryClient.enhanceQueryWithMemory(query);

// 3. Laura ejecuta herramientas (nitter_context, etc.)
const result = await tool.execute();

// 4. Se guarda información relevante automáticamente
await lauraMemoryClient.processToolResult('nitter_context', result, query);
```

## API

### Funciones Principales

#### `add_public_memory(content, metadata)`

Añade contenido a la memoria pública.

**Parámetros:**
- `content` (str): Contenido a guardar
- `metadata` (dict, opcional): Metadatos adicionales

**Ejemplo:**
```python
add_public_memory(
    "El Congreso aprobó la Ley X",
    {
        "source": "nitter_context",
        "tags": ["politica", "congreso"],
        "ts": "2023-12-01T10:00:00Z"
    }
)
```

#### `search_public_memory(query, limit)`

Busca en la memoria pública.

**Parámetros:**
- `query` (str): Consulta de búsqueda
- `limit` (int): Número máximo de resultados

**Retorna:**
- `List[str]`: Lista de facts relevantes

**Ejemplo:**
```python
results = search_public_memory("Ley X", 5)
# ['El Congreso aprobó la Ley X', 'La Ley X fue controversial', ...]
```

### Endpoints HTTP

#### `POST /api/laura-memory/process-tool-result`

Procesa el resultado de una herramienta.

**Body:**
```json
{
    "tool_name": "nitter_profile",
    "tool_result": {...},
    "user_query": "busca a Juan Pérez"
}
```

**Respuesta:**
```json
{
    "saved": true,
    "content": "Usuario descubierto: Juan Pérez...",
    "metadata": {...},
    "reasons": {...}
}
```

#### `POST /api/laura-memory/enhance-query`

Mejora una query con información de memoria.

**Body:**
```json
{
    "query": "¿Qué pasó con el congreso?",
    "limit": 3
}
```

**Respuesta:**
```json
{
    "enhanced_query": "¿Qué pasó con el congreso?\n\nCONTEXTO DE MEMORIA:\n1. El congreso aprobó...",
    "memory_context": "...",
    "memory_results": [...]
}
```

#### `POST /api/laura-memory/save-user-discovery`

Guarda información de un usuario descubierto.

**Body:**
```json
{
    "user_name": "Juan Pérez",
    "twitter_username": "juanperez_gt",
    "description": "Diputado del Congreso",
    "category": "politico"
}
```

#### `POST /api/laura-memory/search`

Busca en la memoria pública.

**Body:**
```json
{
    "query": "congreso",
    "limit": 5
}
```

#### `GET /api/laura-memory/stats`

Obtiene estadísticas de la memoria.

**Respuesta:**
```json
{
    "session_id": "public/global",
    "message_count": 150,
    "created_at": "2023-12-01T00:00:00Z",
    "updated_at": "2023-12-01T10:00:00Z"
}
```

## Detectores Heurísticos

### `is_new_user(content, metadata)`

Detecta si el contenido menciona un usuario nuevo.

**Criterios:**
- Patrones como "nuevo usuario", "descubrí", "ML Discovery"
- Metadata con `source: 'ml_discovery'`
- Menciones de usuarios con @

### `is_new_term(content, metadata)`

Detecta términos nuevos relevantes.

**Criterios:**
- Términos legales: "ley", "decreto", "acuerdo"
- Términos políticos: "congreso", "diputado", "ministro"
- Hashtags y menciones
- Contenido con longitud mínima

### `is_relevant_fact(content, metadata)`

Detecta hechos relevantes.

**Criterios:**
- Verbos de acción: "aprobó", "anunció", "decidió"
- Fuentes confiables: nitter_context, nitter_profile, perplexity_search
- Tags relevantes: política, gobierno, importante

### `should_save_to_memory(content, metadata)`

Determina si el contenido debe guardarse en memoria.

**Retorna:**
```python
{
    "should_save": bool,
    "metadata": dict,  # Metadatos sugeridos
    "reasons": dict    # Razones para guardar
}
```

## Integración con JavaScript

### Cliente Laura Memory

```javascript
const lauraMemoryClient = require('./lauraMemoryClient');

// Verificar disponibilidad
const available = await lauraMemoryClient.isAvailable();

// Procesar resultado de herramienta
const result = await lauraMemoryClient.processToolResult(
    'nitter_profile',
    toolResult,
    'busca a Juan Pérez'
);

// Mejorar query con memoria
const enhanced = await lauraMemoryClient.enhanceQueryWithMemory(
    '¿Qué pasó con el congreso?'
);

// Guardar usuario descubierto
await lauraMemoryClient.saveUserDiscovery(
    'Juan Pérez',
    'juanperez_gt',
    'Diputado del Congreso',
    'politico'
);
```

### Hook en Laura Agent

El sistema se integra automáticamente con Laura:

1. **Pre-procesamiento**: Se mejoran las queries con información de memoria
2. **ML Discovery**: Los usuarios descubiertos se guardan automáticamente
3. **Post-procesamiento**: Los resultados de herramientas se analizan y guardan

## Tests

### Ejecutar Tests

```bash
pytest test_memory.py -v --cov=laura_memory --cov-report=html
```

### Estructura de Tests

- `TestMemoryCore`: Tests para funciones principales de memoria
- `TestDetectors`: Tests para detectores heurísticos
- `TestIntegration`: Tests para integración con Laura

### VCR.py

Se usa VCR.py para grabar/reproducir requests HTTP a Zep Cloud:

```python
@my_vcr.use_cassette('test_add_memory.json')
def test_add_memory_with_zep():
    # Test que graba requests reales
    pass
```

## Monitoreo

### Logs

El sistema genera logs detallados:

```
[LauraMemory] 📚 Información guardada en memoria: El congreso aprobó...
[LauraMemory] 🔍 Búsqueda 'congreso' → 3 resultados
[LauraMemory] 🧠 Query mejorada con 2 resultados de memoria
[LauraMemory] ✅ Usuario guardado: Juan Pérez (@juanperez_gt)
```

### Métricas

- Mensajes guardados en memoria
- Búsquedas realizadas
- Usuarios descubiertos
- Queries mejoradas

## Configuración

### Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `ZEP_API_KEY` | API key de Zep Cloud | Requerido |
| `ZEP_URL` | URL de Zep Cloud | `https://api.getzep.com` |
| `LAURA_SESSION_ID` | ID de sesión global | `public/global` |
| `LAURA_MEMORY_ENABLED` | Habilitar memoria | `true` |
| `LAURA_MEMORY_URL` | URL del servidor Python | `http://localhost:5001` |

### Configuración de Zep

1. Crear cuenta en [Zep Cloud](https://getzep.com)
2. Obtener API key
3. Configurar session global
4. Habilitar knowledge graph

## Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Laura Agent   │───▶│  Laura Memory   │───▶│   Zep Cloud     │
│   (JavaScript)  │    │   (Python)      │    │ (Knowledge Graph│
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │
        │                        ▼
        │              ┌─────────────────┐
        │              │   Detectores    │
        │              │  Heurísticos    │
        │              └─────────────────┘
        ▼
┌─────────────────┐
│  Herramientas   │
│ (nitter, etc.)  │
└─────────────────┘
```

## Desarrollo

### Estructura del Proyecto

```
laura_memory/
├── __init__.py          # Exports principales
├── memory.py            # Funciones de memoria
├── detectors.py         # Detectores heurísticos
├── integration.py       # Integración con Laura
├── server.py           # Servidor HTTP
├── settings.py         # Configuración
├── test_memory.py      # Tests unitarios
├── requirements.txt    # Dependencias
└── README.md          # Documentación
```

### Contribuir

1. Fork del repositorio
2. Crear branch para feature
3. Escribir tests
4. Asegurar cobertura > 90%
5. Ejecutar linting (ruff, mypy)
6. Crear PR

### Linting

```bash
ruff check laura_memory/
mypy laura_memory/
```

## Licencia

MIT License - Ver archivo LICENSE para detalles.