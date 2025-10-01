# 🔍 Sistema de Diagnóstico de Agentes - Fase 1 Completada

## 🎨 Última Actualización: UI Simplificado + IA Inteligente (Oct 2025)

### **Problema Resuelto**: Botones Redundantes + IA que ignoraba anti-bot

#### ✅ **1. Simplificación de Botones**
**Antes**: 6+ botones confusos (Probar, Ejecutar, Generar IA, Mejorar, Forzar Recarga, etc.)
**Ahora**: Solo 3 botones principales:
- 🔄 **Cargar Código**: Unificado (carga del agente o código generado)
- 🧠 **Mejorar con IA**: Inteligente según contexto (detecta anti-bot)
- ▶️ **Ejecutar**: Dinámico (Probar Agente si existe, Ejecutar Script si es manual)

#### ✅ **2. IA Inteligente con Diagnóstico**
**Problema**: El botón "Mejorar" generaba código de scraping inútil cuando había anti-bot
**Solución**: 
- ✅ Detecta anti-bot ANTES de generar código
- ✅ Si hay anti-bot → **Backend genera placeholder directamente** (sin pasar por IA)
- ✅ Si es scrapeable → Optimiza selectores y código con IA
- ✅ Prompt del backend mejorado con instrucciones CRÍTICAS obligatorias
- ✅ Alerta visual al usuario cuando el código se actualiza exitosamente

**Ejemplo de código generado con anti-bot**:
```javascript
// ⚠️ SITIO BLOQUEADO POR ANTI-BOT PROTECTION
// Servicio detectado: Incapsula
// Tamaño de HTML: 212 bytes (página vacía/bloqueada)
//
// ❌ PROBLEMA: El scraping directo NO funciona
// ✅ SOLUCIÓN: Usar WebAgent o modo Browser (Puppeteer)

const errorInfo = {
  error: 'antibot_detected',
  service: 'Incapsula',
  message: 'Sitio protegido - requiere WebAgent',
  solution: 'Usar WebAgent o modo Browser (Puppeteer)'
};

console.log('🔒 Anti-bot detectado:', errorInfo);
return [errorInfo];
```

#### ✅ **3. Alerta Visual Anti-bot**
- 🔴 Banner rojo visible cuando se detecta protección anti-bot
- Muestra: tamaño de HTML, servicio detectado, solución sugerida
- Aparece antes del editor de código para claridad máxima

#### ✅ **4. Flujo de Ejecución Mejorado**
**Problema**: Después de mejorar el código, "Ejecutar" fallaba con error 400
**Causa**: El botón intentaba ejecutar el agente guardado (con código viejo) en vez del código mejorado
**Solución**:
- ✅ "Ejecutar" ahora prioriza el código del editor si existe
- ✅ El código mejorado se marca como "manual" para prevenir auto-reload
- ✅ Sin pop-ups molestos, solo logs en consola
- ✅ El usuario puede probar el código inmediatamente después de mejorarlo

#### ✅ **5. Detección Inteligente de Placeholder (NUEVO)**
**Problema**: Después de generar placeholder de anti-bot, el usuario podía hacer "Mejorar" de nuevo y la IA respondía "no puedo mejorar"
**Causa**: El placeholder ejecutaba OK (retorna errorInfo), entonces `success: true` → IA pensaba que no había anti-bot
**Solución**:
- ✅ **Backend detecta errorInfo** en resultados (`error: 'antibot_detected'`) → Marca como `success: false`
- ✅ **Frontend previene mejora** de placeholder → Muestra mensaje claro
- ✅ **Banner con botón WebAgent** → Guía al usuario a la solución correcta
- ✅ **Diagnóstico persistente** → El anti-bot se detecta siempre, incluso después de ejecutar placeholder

**Flujo Mejorado**:
```
1. Ejecuta agente con código normal → ❌ Falla (anti-bot detectado)
   → Diagnóstico persistente: Incapsula detectado
   → 🔴 Banner visible
   
2. Click "Mejorar" → Frontend permite (código NO es placeholder)
   → Backend detecta has_antibot: true
   → Backend genera placeholder directamente (sin IA)
   → ✅ Código actualizado con placeholder
   → Diagnóstico se mantiene (NO se borra)
   
3. Ejecuta placeholder → ❌ Falla (detecta errorInfo en resultados)
   → Backend marca success: false
   → 🔴 Banner: "🌐 Usar WebAgent"
   → Diagnóstico SIGUE ahí
   
4. Click "Mejorar" de nuevo → 🚫 Bloqueado
   → Frontend detecta que el código YA es placeholder
   → Mensaje: "No se puede mejorar un placeholder"
   → NO llama al backend innecesariamente
   
5. Cambias URL → Diagnóstico se limpia (nuevo contexto)
```

**Lógica de "Mejorar" - SIEMPRE Genera Código Ejecutable**:
El botón "Mejorar" SIEMPRE genera código JavaScript ejecutable. NO placeholders.

| Situación | Acción de "Mejorar" |
|-----------|---------------------|
| **Anti-bot detectado** | Genera código REAL de Puppeteer/WebAgent |
| **SPA/Contenido dinámico** | Genera código con await y esperas |
| **Selectores incorrectos** | Optimiza selectores CSS |
| **Código ya bueno** | Propone micro-mejoras o confirma |

**Filosofía**: El sistema SIEMPRE genera código EJECUTABLE para el sandbox actual.

**IMPORTANTE - Contexto Técnico**:
- El código se ejecuta en un sandbox con cheerio/jsdom
- Tiene acceso a: `document`, `querySelector`, `querySelectorAll`, `console`, `$`
- NO tiene acceso a: `require`, `import`, `puppeteer`, `fetch`, `async/await`

**Qué Genera**:
- ✅ Anti-bot → **Código template directo** (sin IA) con selectores genéricos + nota WebAgent
- ✅ SPA → Código IA con selectores robustos + nota sobre contenido dinámico  
- ✅ Normal → Código IA con selectores optimizados
- ✅ Errores de sintaxis → Los corrige con IA
- ❌ NO genera código Node.js standalone
- ❌ NO genera require('puppeteer')
- ❌ NO genera mensajes sin código

**Importante**: Cuando hay anti-bot:
1. El sistema NO usa IA (genera template directo)
2. El código incluye instrucciones para configurar WebAgent
3. **ACCIÓN REQUERIDA**: El agente debe configurarse con modo "browser" para usar WebAgent
4. WebAgent usa Playwright con navegador real → bypasea anti-bot

**Cómo funciona el fallback a WebAgent**:
```javascript
// ✅ AUTOMÁTICO: El ejecutor detecta anti-bot y usa WebAgent automáticamente
// Flujo:
// 1. Sandbox ejecuta código → detecta anti-bot → 0 items
// 2. Ejecutor detecta diagnostic.issues[type='antibot']
// 3. Ejecutor llama automáticamente a WebAgent con Playwright
// 4. WebAgent bypasea anti-bot usando navegador real
// 5. Retorna datos extraídos exitosamente

// El usuario NO necesita hacer nada - es automático.
// Si WebAgent también falla, retorna el diagnóstico original.
```

**Opción manual: Llamar WebAgent directamente**:
```javascript
// Para debugging o uso directo
const response = await fetch('/api/webagent/extract', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://congreso.gob.gt/iniciativas',
    extraction_target: 'Extraer todas las iniciativas legislativas',
    maxSteps: 5
  })
});
```

#### ✅ **6. Diagnóstico Persistente**
**Problema**: El diagnóstico se borraba al mejorar código → IA no sabía que había anti-bot
**Solución**:
- ✅ **Diagnóstico NO se borra** después de mejorar código

---

#### ✅ **7. Fallback Automático a WebAgent (NUEVO)**
**Problema**: Sitios con anti-bot no se pueden scrapear con fetch() + cheerio
**Solución Implementada**:
1. ✅ El ejecutor detecta automáticamente cuando hay anti-bot
2. ✅ Si detecta `diagnostic.issues[type='antibot']` y `items_extracted = 0`
3. ✅ Automáticamente llama a WebAgent con Playwright (navegador real)
4. ✅ WebAgent bypasea la protección anti-bot
5. ✅ Retorna datos extraídos exitosamente

**Código en `agentExecutor.js`**:
```javascript
// Después de ejecutar sandbox
if (!actualSuccess && result.diagnostic?.issues?.some(i => i.type === 'antibot')) {
  console.log('🔒 Anti-bot detectado - usando WebAgent automáticamente...');
  const webAgentResult = await this.fallbackToWebAgent({
    url,
    extraction_target: config?.extraction_target || agentName,
    site_structure,
    maxItems
  });
  
  if (webAgentResult.success && webAgentResult.items_extracted > 0) {
    return { ...webAgentResult, fallback_used: 'webagent' };
  }
}
```

**Endpoints de WebAgent que intenta (en orden)**:
1. `${WEBAGENT_URL}/scrape/agent` - Scraping completo
2. `${WEBAGENT_URL}/explore/summarize` - Exploración con resumen

**Parsing de Resultados**:
- WebAgent retorna en múltiples formatos → `parseWebAgentResult()` unifica
- Extrae: `content.links`, `content.navElements`, `data[]`, `steps[]`
- Transforma todo a formato estándar: `{ index, titulo, enlace, tipo, source: 'webagent' }`

**Log Esperado**:
```
🔒 Anti-bot detectado - intentando con WebAgent automáticamente...
🌐 Calling WebAgent for anti-bot bypass...
🔄 Intentando WebAgent endpoint: http://webagent:8787/scrape/agent
✅ WebAgent respondió exitosamente
📊 Parseados 15 items de resultado de WebAgent
✅ WebAgent extrajo exitosamente: 15 items
```
- ✅ **Diagnóstico solo se limpia** cuando cambias de URL (nuevo sitio)
- ✅ **Validación doble**: Checa placeholder en código Y diagnóstico persistente
- ✅ **Banner siempre visible**: Mientras haya anti-bot detectado

---

---

#### ✅ **8. Detección Automática de Modo de Ejecución (NUEVO)**
**Problema**: El usuario creaba agentes que fallaban si el sitio tenía anti-bot
**Solución Implementada**:
1. ✅ **Al generar agente** → Diagnostic automático de la página
2. ✅ **Detecta anti-bot/SPA** → Configura `execution_mode: 'webagent'`
3. ✅ **NO genera código JS** → Solo guarda `extraction_target` del usuario
4. ✅ **Al ejecutar** → Usa WebAgent directamente con el objetivo del usuario

**Código en `/api/agents/generate-agent-code`**:
```javascript
// Stage 0: Diagnose page first
const diagnostic = await diagnosePage(siteMap.base_url);

if (diagnostic.execution_mode_recommended === 'webagent') {
  // NO generar JS
  return {
    extractionLogic: null,
    execution_mode: 'webagent',
    requires_browser: true,
    reasoning: `Requiere WebAgent debido a: ${diagnostic.reason}`
  };
}

// Si no hay anti-bot, generar JS normalmente
return {
  extractionLogic: codeFromAI,
  execution_mode: 'sandbox',
  requires_browser: false
};
```

**En `agentExecutor.executeUnified()`**:
```javascript
// Verificar modo de ejecución
const executionMode = config?.mode || config?.execution_config?.mode || 'sandbox';

if (executionMode === 'webagent' || executionMode === 'browser') {
  // Usar WebAgent directamente (no fallback)
  return await this.executeWithWebAgent({
    url,
    extraction_target: config?.extraction_target, // ✅ Objetivo del usuario
    site_structure,
    maxItems
  });
}

// Continuar con sandbox para sitios normales
```

**Flujo Completo**:
```
Usuario: "Extraer iniciativas: número, título, fecha"
   ↓
Sistema diagnóstica: https://congreso.gob.gt
   ↓
Detecta: Anti-bot (Incapsula)
   ↓
Crea agente con:
   - extraction_mode: 'webagent'
   - extraction_target: "iniciativas: número, título, fecha"
   - extractionLogic: null (no JS)
   ↓
Usuario ejecuta agente
   ↓
AgentExecutor detecta mode='webagent'
   ↓
Llama a WebAgent con extraction_target
   ↓
WebAgent navega con Playwright
   ↓
Espera 10s para anti-bot
   ↓
Extrae según objetivo del usuario
   ↓
Retorna datos reales
```

**Log Esperado**:
```
🔍 Diagnosticando página antes de generar código...
📊 Diagnostic results: { has_antibot: true, execution_mode_recommended: 'webagent' }
🌐 Sitio requiere WebAgent - no se generará código JS
✅ Agente creado con modo: webagent
---
🚀 Starting unified execution
🔧 Execution mode: webagent
🌐 Agente configurado para usar WebAgent directamente
🌐 Executing with WebAgent (configured mode)
🔒 Anti-bot detectado - esperando 10 segundos adicionales...
✅ WebAgent extrajo exitosamente: 20 items
```

---

## ✅ Implementación Completada

### Backend (`agentExecutor.js`)

#### 1. **Detección Correcta de Éxito/Fallo**
- **Antes**: `success: true` siempre, incluso con 0 items
- **Ahora**: `success: extractedItems.length > 0` ✅
- **Ubicación**: Línea 391 en `agentExecutor.js`

#### 2. **Análisis Automático de Página**
Método `analyzePage()` que analiza:
- ✅ Estructura HTML (headings, links, paragraphs, tables, lists)
- ✅ Frameworks JS detectados (React, Vue, Angular, Next.js, Gatsby)
- ✅ Anti-bot protection (Incapsula, Cloudflare, DataDome, PerimeterX, etc.)
- ✅ Ratio script/content (detecta SPAs)
- ✅ Páginas sospechosamente pequeñas

#### 3. **Detección de Problemas Comunes**
Método `detectIssues()` que identifica:
- 🔒 **Anti-bot Protection**: Incapsula, Cloudflare, etc.
- 📄 **Página vacía**: < 1000 bytes
- ⚡ **SPA/Contenido dinámico**: React, Vue, Angular
- 🏗️ **Estructura mínima**: Poco contenido visible
- 🚫 **HTTP 403**: Acceso prohibido
- ⏱️ **HTTP 429**: Rate limiting
- 🔍 **Estructura inusual**: Pocos patrones comunes

#### 4. **Respuesta Enriquecida**
Cada ejecución ahora retorna:
```javascript
{
  success: true/false,          // ✅ Basado en items encontrados
  items_extracted: number,
  data: { items: [...] },
  logs: [...],
  
  // ✅ NUEVO: Información de página
  page_info: {
    title: "Título de la página",
    url: "...",
    size_bytes: 12345,
    size_text: 8901,
    has_content: true/false
  },
  
  // ✅ NUEVO: Diagnóstico de problemas
  diagnostic: {
    issues: [
      {
        type: "antibot",
        severity: "high",
        title: "🔒 Anti-bot Protection: Incapsula",
        description: "...",
        evidence: "...",
        suggestions: [
          "Usa WebAgent (navegador real)",
          "Prueba con modo Browser (Puppeteer)",
          ...
        ]
      },
      ...
    ],
    page_analysis: { ... }
  }
}
```

---

### Frontend (`AgentEditor.tsx`)

#### 1. **Estados de Diagnóstico**
```typescript
const [pageInfo, setPageInfo] = useState<any>(null);
const [diagnosticIssues, setDiagnosticIssues] = useState<any[]>([]);
```

#### 2. **Captura Automática**
Las funciones `quickTestAgent()` y `runDebugScript()` ahora capturan:
```typescript
if (result.page_info) {
  setPageInfo(result.page_info);
}
if (result.diagnostic?.issues) {
  setDiagnosticIssues(result.diagnostic.issues);
}
```

#### 3. **Panel de Información de Página**
Muestra en UI:
- 📄 Título de la página
- 📊 Tamaño HTML (KB)
- 📝 Tamaño de texto (KB)
- ✅ Estado (con/sin contenido)

#### 4. **Panel de Problemas Detectados**
Para cada problema muestra:
- 🎯 Título con emoji descriptivo
- 🏷️ Badge de severidad (critical/high/medium/low)
- 📝 Descripción clara
- 🔍 Evidencia (expandible)
- 💡 **Sugerencias específicas** para resolverlo

---

## 🎨 UI/UX Mejorado

### Antes:
```
Ejecución completada ✅
0 items extraídos
```
❌ Marcado como exitoso aunque no extrajo nada

### Ahora:
```
⚠️ Problema Detectado: Anti-bot Protection: Incapsula

El sitio usa protección anti-bot que bloquea scraping básico

💡 Sugerencias:
• Usa WebAgent (navegador real) en lugar de scraping directo
• Prueba con modo Browser (Puppeteer) si WebAgent no funciona
• Considera usar proxies o rate limiting
```
✅ Indica claramente el problema y cómo resolverlo

---

## 🧪 Cómo Probar

### 1. Crear un agente nuevo
```
1. Ir a Knowledge → Monitoreos
2. Explorar un sitio (ej: https://www.congreso.gob.gt/...)
3. Crear agente desde el mapa
4. Ir a pestaña "Debug"
5. Ejecutar script
```

### 2. Ver diagnóstico en acción
Si el sitio tiene Incapsula (como congreso.gob.gt):
- ✅ Verás panel "Información de Página" con tamaño pequeño
- ✅ Verás panel "Problemas Detectados" con:
  - 🔒 Anti-bot Protection: Incapsula
  - Sugerencias específicas

### 3. Con sitio normal
Si el sitio carga bien pero no hay items:
- ✅ Verás análisis de estructura HTML
- ✅ Detectará si es SPA (React/Vue)
- ✅ Sugerirá usar WebAgent para contenido dinámico

---

## 📊 Problemas Detectados Automáticamente

| Problema | Detección | Sugerencias |
|----------|-----------|-------------|
| 🔒 **Anti-bot** | Incapsula, Cloudflare, etc. | WebAgent, Browser mode |
| 📄 **Página vacía** | < 1KB HTML | Verificar URL, autenticación |
| ⚡ **SPA** | React/Vue + poco HTML | WebAgent para JS rendering |
| 🏗️ **Sin estructura** | < 50 elementos | Usar WebAgent, revisar selectores |
| 🚫 **HTTP 403** | En logs | Headers, autenticación |
| ⏱️ **Rate limit** | En logs | Delays, proxies |

---

## 🔄 Próximos Pasos (Fase 2)

1. **Botones de acción automática**
   - "Intentar con WebAgent" → Click y ejecuta automáticamente
   - "Probar en Browser Mode" → Cambia a Puppeteer

2. **Sugerencias de código**
   - Mostrar código alternativo para probar
   - Selectores sugeridos basados en análisis

3. **Historial de diagnósticos**
   - Guardar problemas encontrados
   - Comparar ejecuciones

---

## 🐛 Debug

### Ver logs completos:
```bash
# En Docker
docker logs extractorw-api

# Buscar líneas con:
# - "📊 Script execution completed"
# - "⚠️ No items found"
# - "🔒 Anti-bot Protection"
```

### Verificar response:
```javascript
// En DevTools Console del frontend
console.log(debugResults);
// Debe tener: page_info, diagnostic
```

---

## 📝 Archivos Modificados

### Backend
- ✅ `/ExtractorW/server/services/agentExecutor.js`
  - `analyzePage()` - Línea 206
  - `detectAntiBot()` - Línea 258
  - `detectIssues()` - Línea 297
  - Cambio en return - Línea 390-411

### Frontend
- ✅ `/ThePulse/src/components/ui/AgentEditor.tsx`
  - Estados de diagnóstico - Línea 127-128
  - Captura en handlers - Líneas 1071-1076, 1147-1152
  - Panel Page Info - Línea 2552-2590
  - Panel Diagnostic Issues - Línea 2592-2673

---

## ✅ Testing Checklist

- [ ] Probar con sitio con Incapsula (congreso.gob.gt)
- [ ] Probar con sitio normal que funciona
- [ ] Probar con sitio SPA (React/Vue)
- [ ] Probar con URL inválida
- [ ] Verificar que success = false cuando 0 items
- [ ] Verificar que success = true cuando hay items
- [ ] Ver paneles de diagnóstico en UI
- [ ] Verificar sugerencias específicas por tipo de problema

---

**Fecha de implementación**: Enero 2025
**Versión**: 1.0 - Fase 1 Completada
**Estado**: ✅ Listo para pruebas

