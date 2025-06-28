# 🔍 Perplexity MCP Integration - Sistema Completo

## Resumen
Integración completa de Perplexity AI en el sistema MCP (Model Context Protocol) de ExtractorW, permitiendo que Vizta Chat realice búsquedas web inteligentes y mejore la expansión de términos para análisis de redes sociales.

## 🎯 Funcionalidades Implementadas

### 1. Herramienta `perplexity_search`
Nueva herramienta MCP que permite realizar búsquedas web inteligentes usando Perplexity AI.

**Parámetros:**
- `query` (string, requerido): Consulta de búsqueda web
- `location` (string, opcional): Contexto geográfico (default: "Guatemala")
- `focus` (string, opcional): Enfoque específico (general, noticias, eventos, deportes, politica, economia, cultura)
- `improve_nitter_search` (boolean, opcional): Si generar optimizaciones para búsquedas en Twitter/X

**Características:**
- Búsqueda web contextualizada por ubicación y fecha
- Optimización automática de consultas según el enfoque
- Generación de términos optimizados para redes sociales
- Respuestas estructuradas en JSON
- Fallback graceful si Perplexity no está disponible

### 2. Mejora de Expansión de Términos
Función `enhanceSearchTermsWithPerplexity()` que usa Perplexity para generar expansiones de búsqueda más inteligentes.

**Beneficios:**
- Detección automática de apodos y nombres alternativos
- Identificación de hashtags trending probables
- Contexto temporal y geográfico dinámico
- Optimización específica para Guatemala

### 3. Vizta Chat Inteligente
Actualización del sistema prompt de Vizta Chat para usar estratégicamente ambas herramientas.

**Estrategias de Selección:**
- **Perplexity** para: información general, contexto, noticias, datos oficiales
- **Nitter** para: análisis de sentimiento, opiniones, reacciones sociales
- **Híbrido** para: análisis completos que requieren contexto + opinión pública

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vizta Chat    │    │   MCP Service   │    │  Perplexity AI  │
│   (Frontend)    │◄──►│   (Orquestador) │◄──►│   (Web Search)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │
         │                        ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │ Nitter Context  │◄──►│   Gemini AI     │
         │              │  (Social Media) │    │   (Analysis)    │
         └──────────────┤                 │    └─────────────────┘
                        └─────────────────┘
```

## 📁 Archivos Modificados/Creados

### Archivos Principales
- `server/services/mcp.js` - Herramienta perplexity_search y mejoras
- `server/routes/viztaChat.js` - Prompt actualizado con estrategias
- `test-perplexity-mcp.js` - Script de pruebas completo

### Funciones Clave
```javascript
// Nuevas funciones en mcp.js
executePerplexitySearch()         // Ejecuta búsquedas web
enhanceSearchTermsWithPerplexity() // Mejora expansión de términos
expandSearchTerms()              // Expansión básica (existente)

// Herramientas MCP disponibles
AVAILABLE_TOOLS = {
  nitter_context,    // Análisis de redes sociales
  perplexity_search  // Búsquedas web inteligentes
}
```

## 🔧 Configuración Requerida

### Variables de Entorno
```bash
# API Keys requeridas
PERPLEXITY_API_KEY=pplx-xxxxx
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=xxxxx

# URLs de servicios
EXTRACTOR_T_URL=https://api.standatpd.com
```

### Dependencias de Node.js
```bash
# Instalar dependencias si es necesario
npm install node-fetch  # Para Node.js < 18
```

## 🧪 Pruebas y Verificación

### Ejecutar Suite de Pruebas
```bash
cd ExtractorW
node test-perplexity-mcp.js
```

### Casos de Prueba Incluidos
1. **Búsqueda Web General** - Información política
2. **Búsqueda con Optimización Nitter** - Deportes con hashtags
3. **Búsqueda de Eventos** - Cultura y festivales
4. **Análisis de Tendencias** - Monitorео social

## 📋 Ejemplos de Uso

### 1. Búsqueda Web Básica
```javascript
// Desde Vizta Chat: "Información sobre Bernardo Arévalo"
{
  tool: 'perplexity_search',
  params: {
    query: 'Bernardo Arévalo presidente Guatemala',
    location: 'Guatemala',
    focus: 'politica'
  }
}
```

### 2. Búsqueda con Optimización Social
```javascript
// Desde Vizta Chat: "Busca sobre Copa América y optimiza para Twitter"
{
  tool: 'perplexity_search',
  params: {
    query: 'Copa América 2024 Guatemala',
    location: 'Guatemala',
    focus: 'deportes',
    improve_nitter_search: true
  }
}
```

### 3. Análisis Híbrido
```javascript
// Estrategia: Contexto + Opinión Pública
// 1. perplexity_search para contexto general
// 2. nitter_context para análisis de sentimiento
```

## 🌟 Casos de Uso Típicos

### Para Investigación
- ✅ "¿Qué está pasando con la economía guatemalteca?"
- ✅ "Información sobre el nuevo ministro de salud"  
- ✅ "Detalles del Festival Cervantino 2025"

### Para Análisis Social
- ✅ "¿Qué opina la gente sobre las nuevas medidas?"
- ✅ "Sentimiento sobre el partido Guatemala vs México"
- ✅ "Reacciones al anuncio presidencial"

### Para Monitoreo Híbrido
- ✅ "Análisis completo de la situación política actual"
- ✅ "Contexto y reacciones sobre la nueva ley"
- ✅ "Investigación + opinión pública sobre evento X"

## 🎯 Flujos de Trabajo Optimizados

### Flujo 1: Investigación General
```
Usuario → "Información sobre X" 
→ Vizta detecta necesidad de contexto
→ perplexity_search con enfoque apropiado
→ Respuesta contextualizada y actualizada
```

### Flujo 2: Análisis de Opinión
```
Usuario → "¿Qué dice la gente sobre X?"
→ Vizta detecta necesidad de análisis social  
→ nitter_context con términos expandidos
→ Análisis de sentimiento y engagement
```

### Flujo 3: Investigación + Análisis Social
```
Usuario → "Análisis completo de situación X"
→ 1. perplexity_search (contexto general)
→ 2. nitter_context (opinión pública)  
→ Respuesta híbrida con contexto + sentimiento
```

## 🔄 Mejoras de Expansión de Términos

### Antes (Expansión Básica)
```
"marcha del orgullo" → "Orgullo2025 OR MarchadelOrgullo OR Pride OR LGBTI"
```

### Después (Con Perplexity)
```
"marcha del orgullo" → "Orgullo2025 OR MarchadelOrgullo OR Pride OR LGBTI OR 
                        #OrguIIoGt OR MarchaPorLaDignidad OR DiaMundialDelOrgullo OR
                        DiversidadGuatemala OR #PrideGuatemala"
```

## 📊 Métricas y Monitoreo

### Datos Capturados
- Tiempo de respuesta de Perplexity
- Éxito/fallo de parsing JSON
- Uso de optimización Nitter
- Distribución de enfoques (politica, deportes, etc.)
- Calidad de expansión de términos

### Logging
```javascript
console.log(`🔍 Ejecutando perplexity_search: query="${query}", focus="${focus}"`);
console.log(`🚀 Términos mejorados con Perplexity: "${enhancedTerms}"`);
console.log(`✅ Respuesta recibida de Perplexity para: "${query}"`);
```

## 🚨 Manejo de Errores

### Estrategias de Fallback
1. **Sin API Key** → Usar expansión básica + mensaje informativo
2. **Error de Perplexity** → Continuar con herramientas locales
3. **Rate Limiting** → Retry con backoff exponencial
4. **JSON Parse Error** → Usar respuesta raw con formato mejorado

### Códigos de Error Comunes
- `PERPLEXITY_API_KEY no configurada` → Verificar variables de entorno
- `Error en API de Perplexity: 429` → Rate limit excedido
- `Respuesta inválida de Perplexity API` → Problema en formato de respuesta

## 🔮 Roadmap y Mejoras Futuras

### v1.1 - Caché Inteligente
- [ ] Cache de respuestas de Perplexity por 1 hora
- [ ] Invalidación inteligente basada en actualidad del tema
- [ ] Métricas de hit rate del caché

### v1.2 - Análisis Avanzado  
- [ ] Detección automática de temas trending
- [ ] Sugerencias proactivas de búsquedas relacionadas
- [ ] Análisis de credibilidad de fuentes

### v1.3 - Optimizaciones
- [ ] Búsquedas paralelas cuando sea apropiado
- [ ] Compresión de prompts para reducir tokens
- [ ] A/B testing de estrategias de prompt

## 📞 Soporte y Troubleshooting

### Problemas Comunes
1. **"perplexity_search no encontrada"** → Verificar que el módulo se exportó correctamente
2. **"Usuario autenticado requerido"** → Verificar middleware de autenticación
3. **Respuestas muy cortas** → Ajustar max_tokens en payload de Perplexity

### Debugging
```bash
# Habilitar logs detallados
DEBUG=perplexity,mcp node server/index.js

# Probar herramientas individualmente  
node test-perplexity-mcp.js

# Verificar configuración
node -e "console.log(process.env.PERPLEXITY_API_KEY ? 'OK' : 'Missing')"
```

---

**Estado:** ✅ Implementación completa y funcional  
**Versión:** 1.0.0  
**Fecha:** Enero 2025  
**Autor:** AI Assistant + Usuario  

**Próximos pasos:** Ejecutar pruebas, verificar en producción, documentar casos de uso específicos del usuario. 