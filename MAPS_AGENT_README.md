# 🗺️ Agente Maps - Experto en Geografía Guatemalteca

## Descripción
El **Agente Maps** es un sistema experto en geografía guatemalteca que proporciona normalización, detección y mapeo avanzado de ubicaciones. Está diseñado para resolver problemas comunes de duplicados, reconocimiento de minúsculas, detección de ubicaciones y búsqueda inteligente de lugares en Guatemala.

## Características Principales

### 🎯 Funcionalidades
- **Normalización de países**: Convierte variaciones como "guatemala", "guate" → "Guatemala"
- **Detección de departamentos**: Identifica automáticamente departamentos para ciudades
- **Mapeo cultural**: Reconoce aliases locales como "Xela" → "Quetzaltenango"
- **Detección de tipos**: Identifica si una ubicación es ciudad, departamento, país o zona
- **Búsqueda inteligente**: Encuentra ubicaciones similares con porcentajes de similitud
- **Procesamiento en lote**: Normaliza múltiples ubicaciones simultáneamente
- **Integración con IA**: Usa Gemini AI para casos complejos no cubiertos por el mapeo

### 🗺️ Mapeo Completo de Guatemala
- **22 departamentos** con todos sus municipios
- **340+ municipios** completamente mapeados
- **100+ aliases culturales** (Xela, Guate, Antigua, etc.)
- **Zonas de Guatemala Ciudad** (Zona Viva, Centro Histórico, etc.)
- **Países de la región** con aliases y códigos ISO

## Instalación y Configuración

### 1. Dependencias Requeridas
```bash
npm install express
npm install @google/generative-ai  # Para funcionalidad de IA
```

### 2. Estructura de Archivos
```
ExtractorW/
├── server/
│   ├── services/
│   │   └── mapsAgent.js          # Servicio principal
│   ├── routes/
│   │   └── maps.js               # Endpoints HTTP
│   └── utils/
│       └── geminiClient.js       # Cliente de IA (requerido)
├── test-maps-agent.js            # Script de pruebas
└── MAPS_AGENT_README.md          # Esta documentación
```

### 3. Configuración en Rutas
Agregar en `server/routes/index.js`:
```javascript
const mapsRoutes = require('./maps');
app.use('/api/maps', mapsRoutes);
```

## Uso del API

### Endpoints Disponibles

#### 1. Normalizar País
```bash
POST /api/maps/normalize-country
```
```json
{
  "country": "guatemala"
}
```
**Respuesta:**
```json
{
  "success": true,
  "input": "guatemala",
  "output": "Guatemala",
  "is_guatemalan": true
}
```

#### 2. Normalizar Información Geográfica
```bash
POST /api/maps/normalize
```
```json
{
  "location": {
    "city": "xela",
    "department": null,
    "pais": null
  }
}
```
**Respuesta:**
```json
{
  "success": true,
  "input": { "city": "xela", "department": null, "pais": null },
  "output": {
    "city": "Quetzaltenango",
    "department": "Quetzaltenango",
    "pais": "Guatemala",
    "country": "Guatemala"
  },
  "is_guatemalan": true,
  "detection_method": "manual_mapping"
}
```

#### 3. Detectar Departamento
```bash
POST /api/maps/detect-department
```
```json
{
  "city": "Cobán"
}
```
**Respuesta:**
```json
{
  "success": true,
  "input": "Cobán",
  "output": "Alta Verapaz",
  "found": true
}
```

#### 4. Normalización en Lote
```bash
POST /api/maps/normalize-batch
```
```json
{
  "locations": [
    { "city": "Guatemala" },
    { "city": "Xela" },
    { "city": "Cobán" }
  ]
}
```
**Respuesta:**
```json
{
  "success": true,
  "input_count": 3,
  "output_count": 3,
  "results": [
    {
      "city": "Guatemala",
      "department": "Guatemala",
      "pais": "Guatemala",
      "country": "Guatemala",
      "detection_method": "manual",
      "confidence": "high"
    }
  ],
  "statistics": {
    "manual_detections": 2,
    "ai_detections": 1,
    "error_count": 0
  }
}
```

#### 5. Buscar Ubicaciones Similares
```bash
POST /api/maps/find-similar
```
```json
{
  "location": "Guat",
  "maxResults": 5
}
```
**Respuesta:**
```json
{
  "success": true,
  "input": "Guat",
  "output": [
    {
      "name": "Guatemala",
      "type": "city",
      "department": "Guatemala",
      "similarity": 0.85
    },
    {
      "name": "Guastatoya",
      "type": "city",
      "department": "El Progreso",
      "similarity": 0.65
    }
  ]
}
```

#### 6. Detección con IA
```bash
POST /api/maps/detect-with-ai
```
```json
{
  "location": "El Puerto",
  "context": "Costa atlántica de Guatemala"
}
```
**Respuesta:**
```json
{
  "success": true,
  "input": "El Puerto",
  "context": "Costa atlántica de Guatemala",
  "output": {
    "city": "Puerto Barrios",
    "department": "Izabal",
    "country": "Guatemala",
    "type": "city",
    "confidence": "high",
    "reasoning": "Alias cultural común para Puerto Barrios"
  }
}
```

## Integración con Frontend

### Servicio TypeScript
```typescript
// services/mapsService.ts
import { normalizeCountryName } from './mapsService';

// Uso en componentes
const normalizedCountry = await normalizeCountryName('guatemala');
// Resultado: "Guatemala"
```

### Integración en Coverages
```typescript
// services/coverages.ts
import { normalizeCountryName as normalizeCountryNameMaps } from './mapsService';

// Reemplaza la función faltante
const normalized = await normalizeCountryNameMaps(card.pais);
```

## Casos de Uso Comunes

### 1. Normalización de Países
```javascript
// Input: "guatemala", "guate", "república de guatemala"
// Output: "Guatemala"
```

### 2. Detección de Departamentos
```javascript
// Input: "Cobán" → Output: "Alta Verapaz"
// Input: "Xela" → Output: "Quetzaltenango"
// Input: "Antigua" → Output: "Sacatepéquez"
```

### 3. Aliases Culturales
```javascript
// "Xela" → "Quetzaltenango"
// "Guate" → "Guatemala"
// "El Puerto" → "Puerto Barrios"
// "Zona Viva" → "Zona 10"
// "Las Verapaces" → "Alta Verapaz"
```

### 4. Detección de Tipos
```javascript
// "Guatemala" → "city"
// "Quetzaltenango" → "department"
// "Zona Viva" → "zone"
// "México" → "country"
```

## Mapeo de Datos

### Departamentos Incluidos
```
Alta Verapaz, Baja Verapaz, Chimaltenango, Chiquimula, El Progreso,
Escuintla, Guatemala, Huehuetenango, Izabal, Jalapa, Jutiapa,
Petén, Quetzaltenango, Quiché, Retalhuleu, Sacatepéquez,
San Marcos, Santa Rosa, Sololá, Suchitepéquez, Totonicapán, Zacapa
```

### Aliases Culturales Principales
```
xela → Quetzaltenango
guate → Guatemala
antigua → Antigua Guatemala
el puerto → Puerto Barrios
zona viva → Zona 10
centro histórico → Zona 1
huehue → Huehuetenango
las verapaces → Alta Verapaz
el norte → Petén
```

### Países Soportados
```
Guatemala, México, El Salvador, Honduras, Nicaragua, Costa Rica,
Panamá, Estados Unidos, Canadá, España, Colombia, Venezuela,
Brasil, Argentina, Chile, Perú, Ecuador, Bolivia, Paraguay, Uruguay
```

## Pruebas

### Ejecutar Pruebas Completas
```bash
cd ExtractorW
node test-maps-agent.js
```

### Tipos de Pruebas
1. **Normalización de países** - 7 casos
2. **Detección de departamentos** - 7 casos
3. **Detección de tipos** - 6 casos
4. **Normalización geográfica** - 5 casos
5. **Búsqueda de similares** - 4 casos
6. **Normalización en lote** - 5 ubicaciones
7. **Validación guatemalteca** - 6 casos
8. **Información del mapeo** - 4 métricas

### Resultado Esperado
```
🎯 RESUMEN FINAL: 8/8 PRUEBAS EXITOSAS
🎉 ¡TODAS LAS PRUEBAS PASARON! El agente Maps está funcionando correctamente.
```

## Mantenimiento

### Agregar Nuevos Municipios
Editar `GUATEMALA_MAPPING.departments[departamento].municipalities`:
```javascript
'Quetzaltenango': {
  municipalities: [
    'Quetzaltenango',
    'Salcajá',
    // ... agregar nuevo municipio aquí
  ]
}
```

### Agregar Nuevos Aliases
Editar `GUATEMALA_MAPPING.cultural_aliases`:
```javascript
cultural_aliases: {
  'nuevo_alias': { 
    name: 'Nombre Oficial', 
    type: 'city', 
    department: 'Departamento' 
  }
}
```

### Agregar Nuevos Países
Editar `GUATEMALA_MAPPING.countries`:
```javascript
countries: {
  'nuevo_pais': { 
    name: 'Nombre Oficial', 
    code: 'ISO', 
    aliases: ['alias1', 'alias2'] 
  }
}
```

## Rendimiento

### Métricas de Referencia
- **Normalización simple**: <10ms
- **Detección con IA**: 1-3 segundos
- **Procesamiento en lote**: 50-200ms por ubicación
- **Búsqueda de similares**: <50ms

### Optimizaciones
- Mapeo interno para respuestas instantáneas
- IA solo para casos no cubiertos
- Caché de resultados de IA
- Procesamiento en paralelo para lotes

## Integración con Coverages

### Problema Resuelto
```javascript
// ANTES: Error
const normalized = normalizeCountryName(card.pais);
// ReferenceError: normalizeCountryName is not defined

// DESPUÉS: Funciona
import { normalizeCountryName } from './mapsService';
const normalized = await normalizeCountryName(card.pais);
```

### Beneficios
- ✅ Elimina duplicados geográficos
- ✅ Reconoce aliases culturales
- ✅ Detecta departamentos automáticamente
- ✅ Maneja mayúsculas/minúsculas
- ✅ Integración con IA para casos complejos
- ✅ Procesamiento en lote eficiente

## Resolución de Problemas

### Error: "Cannot find module"
```bash
# Verificar que el servicio esté en la ruta correcta
ls ExtractorW/server/services/mapsAgent.js

# Verificar importación en routes/index.js
grep "mapsRoutes" ExtractorW/server/routes/index.js
```

### Error: "Gemini API"
```bash
# Verificar configuración de API key
echo $GEMINI_API_KEY

# Verificar cliente Gemini
ls ExtractorW/server/utils/geminiClient.js
```

### Error: "Database connection"
```bash
# Verificar autenticación
# El agente Maps requiere middleware de autenticación
```

## Contribuciones

### Agregar Nuevas Funcionalidades
1. Editar `server/services/mapsAgent.js`
2. Agregar endpoint en `server/routes/maps.js`
3. Agregar pruebas en `test-maps-agent.js`
4. Actualizar documentación

### Reportar Problemas
- Ubicaciones no reconocidas
- Aliases faltantes
- Departamentos incorrectos
- Problemas de rendimiento

## Versionado

### v1.0.0 (Actual)
- ✅ Mapeo completo de Guatemala
- ✅ Normalización de países
- ✅ Detección de departamentos
- ✅ Aliases culturales
- ✅ Integración con IA
- ✅ Procesamiento en lote
- ✅ Búsqueda de similares
- ✅ Validación guatemalteca

### Roadmap v1.1.0
- 🔄 Expansión a otros países centroamericanos
- 🔄 Caché de resultados de IA
- 🔄 Métricas de uso
- 🔄 API de autocomplete
- 🔄 Integración con mapas

---

**Desarrollado por:** Equipo VizTA  
**Fecha:** Enero 2025  
**Licencia:** Propietaria 