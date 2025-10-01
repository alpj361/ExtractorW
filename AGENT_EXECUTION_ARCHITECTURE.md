# 🏗️ Arquitectura de Ejecución de Agentes

## 📊 Resumen Ejecutivo

Sistema inteligente que **detecta automáticamente** si un sitio requiere navegador real (WebAgent) o puede scrapearse con fetch + cheerio (sandbox), y configura el agente en consecuencia.

---

## 🔄 Flujo Completo del Sistema

### **1. Creación del Agente**

```mermaid
Usuario ingresa objetivo
   ↓
"Extraer iniciativas legislativas: número, título, fecha, estado"
   ↓
POST /api/agents/generate-agent-code
   ↓
╔══════════════════════════════════════════╗
║  Stage 0: Diagnóstico Automático       ║
╚══════════════════════════════════════════╝
   ↓
diagnosePage(url)
   - Fetch simple de la página
   - Analizar HTML con cheerio
   - Detectar: anti-bot, SPA, página vacía
   ↓
┌─────────────────────────────────────────┐
│ ¿Tiene anti-bot/SPA/bloqueado?         │
└─────────────────────────────────────────┘
         SÍ  ↓              ↓  NO
    ┌──────────────┐   ┌──────────────┐
    │ Modo WebAgent│   │ Modo Sandbox │
    └──────────────┘   └──────────────┘
            ↓                   ↓
    extractionLogic: null   Generar JS con IA
    execution_mode: 'webagent'   (Gemini + GPT-4)
    requires_browser: true        ↓
    extraction_target: <objetivo>  extractionLogic: <JS>
            ↓                   execution_mode: 'sandbox'
    ┌──────────────────────────────────┐
    │ Guardar agente en Supabase       │
    │ - extraction_config.mode         │
    │ - extraction_target              │
    │ - extractionLogic (o null)       │
    └──────────────────────────────────┘
```

### **2. Ejecución del Agente**

```mermaid
Usuario ejecuta agente
   ↓
agentExecutor.executeUnified(config)
   ↓
Leer: config.mode o config.extraction_config.mode
   ↓
┌─────────────────────────────────────────┐
│ ¿Qué modo tiene el agente?             │
└─────────────────────────────────────────┘
    'webagent'  ↓       ↓ 'sandbox'
    ┌──────────────────┐  ┌──────────────────┐
    │ executeWithWebAgent│ │ executeScriptInSandbox│
    └──────────────────┘  └──────────────────┘
            ↓                      ↓
    Llamar a WebAgent          Ejecutar JS con cheerio
    con extraction_target             ↓
            ↓              ¿Detecta anti-bot? (0 items)
    WebAgent usa Playwright            ↓ SÍ
    - Espera 10s anti-bot      Fallback a WebAgent
    - Reload si vacío                  ↓
    - Navega e interactúa      Mismo flujo WebAgent
            ↓                          ↓
    Extrae datos según objetivo    Extrae datos
            ↓                          ↓
    ┌──────────────────────────────────────┐
    │ Retornar resultado unificado        │
    │ - success: boolean                   │
    │ - items_extracted: number            │
    │ - data: {items: [...]}               │
    │ - execution_mode: 'webagent'|'sandbox'│
    │ - fallback_used: 'webagent'? (si fue fallback)│
    └──────────────────────────────────────┘
```

---

## 🔧 Componentes Implementados

### **Backend (`agents.js`)**

#### **1. `diagnosePage(url)`**
- Hace fetch de la página
- Analiza con `agentExecutor.analyzePage()`
- Detecta: anti-bot, SPA, HTML vacío
- Retorna: `execution_mode_recommended` ('webagent' | 'sandbox')

**Código**:
```javascript
async function diagnosePage(url) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const pageAnalysis = agentExecutor.analyzePage(html, $, url);
  const issues = agentExecutor.detectIssues(html, pageAnalysis, []);
  
  const hasAntibot = issues.some(i => i.type === 'antibot');
  const hasSPA = issues.some(i => i.type === 'spa_dynamic_content');
  
  if (hasAntibot || hasSPA) {
    return {
      execution_mode_recommended: 'webagent',
      reason: hasAntibot ? `Anti-bot (${pageAnalysis.antibot_detected})` : 'SPA dinámico'
    };
  }
  
  return { execution_mode_recommended: 'sandbox' };
}
```

#### **2. `generateExtractionCode()` - Modificado**
```javascript
async function generateExtractionCode(instructions, siteMap, ...) {
  // ✅ Stage 0: Diagnose first
  const diagnostic = await diagnosePage(siteMap.base_url);
  
  if (diagnostic.execution_mode_recommended === 'webagent') {
    // ❌ NO generar código JS
    return {
      extractionLogic: null,
      execution_mode: 'webagent',
      requires_browser: true,
      reasoning: `Requiere WebAgent: ${diagnostic.reason}`,
      suggestedTarget: instructions // Guardar objetivo del usuario
    };
  }
  
  // ✅ Generar JS con IA (Gemini + GPT-4)
  const codeResult = await generateCodeWithGPT4(...);
  return {
    extractionLogic: codeResult.extractionLogic,
    execution_mode: 'sandbox',
    requires_browser: false
  };
}
```

### **Backend (`agentExecutor.js`)**

#### **1. `executeUnified()` - Modificado**
```javascript
async executeUnified({ url, config, ... }) {
  // ✅ Verificar modo configurado
  const executionMode = config?.mode || config?.extraction_config?.mode || 'sandbox';
  
  if (executionMode === 'webagent' || executionMode === 'browser') {
    // Usar WebAgent directamente (configurado, no fallback)
    return await this.executeWithWebAgent({
      url,
      extraction_target: config?.extraction_target, // ✅ Objetivo del usuario
      site_structure,
      maxItems
    });
  }
  
  // Sandbox normal
  const result = await this.executeScriptInSandbox({ script, url, ... });
  
  // Fallback a WebAgent si detecta anti-bot
  if (!result.success && result.diagnostic?.issues?.some(i => i.type === 'antibot')) {
    return await this.fallbackToWebAgent({
      url,
      extraction_target: config?.extraction_target || agentName,
      site_structure,
      maxItems
    });
  }
  
  return result;
}
```

#### **2. `executeWithWebAgent()` - NUEVO**
```javascript
async executeWithWebAgent({ url, extraction_target, site_structure, maxItems, executionId, executionType, startTime }) {
  console.log('🌐 Executing with WebAgent (configured mode)');
  
  const webAgentResult = await this.fallbackToWebAgent({
    url,
    extraction_target, // ✅ Objetivo del usuario pasa directo a WebAgent
    site_structure,
    maxItems
  });
  
  return {
    ...webAgentResult,
    execution_mode: 'webagent',
    configured_mode: true // No es fallback, fue configurado así
  };
}
```

#### **3. `fallbackToWebAgent()` - Mejorado**
```javascript
async fallbackToWebAgent({ url, extraction_target, site_structure, maxItems }) {
  const WEBAGENT_URL = process.env.WEBAGENT_URL || 'http://webagent:8787';
  
  // Health check de WebAgent
  await fetch(`${WEBAGENT_URL}/health`);
  
  // Llamar a WebAgent
  const response = await fetch(`${WEBAGENT_URL}/scrape/agent`, {
    method: 'POST',
    body: JSON.stringify({
      url,
      goal: extraction_target, // ✅ Objetivo del usuario
      maxSteps: 10,
      screenshot: false
    }),
    timeout: 90000
  });
  
  const result = await response.json();
  const extractedItems = this.parseWebAgentResult(result, maxItems);
  
  return {
    success: extractedItems.length > 0,
    items_extracted: extractedItems.length,
    data: { items: extractedItems },
    diagnostic: { antibot_bypassed: true, method: 'webagent_playwright' }
  };
}
```

#### **4. `parseWebAgentResult()` - NUEVO**
```javascript
parseWebAgentResult(webAgentResult, maxItems = 20) {
  const items = [];
  
  // Formato: { content: { links: [...], navElements: [...] } }
  if (webAgentResult.content) {
    if (webAgentResult.content.links) {
      webAgentResult.content.links.slice(0, maxItems).forEach((link, index) => {
        items.push({
          index: index + 1,
          titulo: link.text || 'Sin título',
          enlace: link.href,
          tipo: 'enlace',
          source: 'webagent'
        });
      });
    }
    
    if (webAgentResult.content.navElements) {
      webAgentResult.content.navElements.forEach((nav, index) => {
        items.push({
          index: items.length + 1,
          titulo: nav.text || 'Sin título',
          enlace: nav.href,
          tipo: 'navegación',
          source: 'webagent'
        });
      });
    }
  }
  
  return items;
}
```

### **WebAgent (`server.ts`) - Mejorado**

```typescript
async function runAgent(params: AgentRequest) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // ✅ Headers realistas
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
    'Accept-Language': 'en-US,en;q=0.9'
  });
  
  await page.goto(params.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // ✅ Detectar anti-bot y esperar
  const bodyText = (await page.textContent('body')) || '';
  if (bodyText.length < 200 || bodyText.includes('incapsula')) {
    console.log('🔒 Anti-bot detectado - esperando 10 segundos adicionales...');
    await page.waitForTimeout(10000);
    
    const bodyText2 = (await page.textContent('body')) || '';
    if (bodyText2.length < 200) {
      console.log('🔄 Página aún vacía - recargando...');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
    }
  }
  
  // Continuar con scraping...
  const scan = await page.evaluate(() => {
    // Extraer links, navegación, etc.
  });
  
  return { content, scan, steps };
}
```

---

## 📊 Casos de Uso

### **Caso 1: Sitio Normal (sin anti-bot)**

**Sitio**: `https://example.com/blog`

```
1. Usuario crea agente: "Extraer títulos y fechas de artículos"
2. diagnosePage() → No anti-bot → execution_mode: 'sandbox'
3. IA genera JS con selectores: `.article h2`, `.date`
4. Guardar agente con extractionLogic y mode='sandbox'
5. Usuario ejecuta agente
6. executeScriptInSandbox() con cheerio
7. Extrae 50 artículos exitosamente
```

### **Caso 2: Sitio con Anti-bot (Incapsula)**

**Sitio**: `https://congreso.gob.gt/iniciativas`

```
1. Usuario crea agente: "Extraer iniciativas: número, título, fecha"
2. diagnosePage() → Detecta Incapsula → execution_mode: 'webagent'
3. NO genera JS → extractionLogic: null
4. Guardar agente con mode='webagent' y extraction_target
5. Usuario ejecuta agente
6. executeWithWebAgent() llama a WebAgent
7. WebAgent:
   - Espera 10s para anti-bot
   - Reload si vacío
   - Navega con Playwright
   - Extrae según extraction_target
8. Retorna 20 items de enlaces/navegación
```

### **Caso 3: Sitio con SPA (React/Vue)**

**Sitio**: `https://modern-spa.com/data`

```
1. Usuario crea agente: "Extraer productos de catálogo"
2. diagnosePage() → HTML < 200 chars → execution_mode: 'webagent'
3. NO genera JS (contenido dinámico)
4. Guardar agente con mode='webagent'
5. Usuario ejecuta agente
6. WebAgent espera a que JS cargue contenido
7. Extrae productos con Playwright
```

---

## ✅ Ventajas de Esta Arquitectura

1. **✅ Detección Automática**: Usuario no necesita saber qué modo usar
2. **✅ Un Solo Flujo**: `executeUnified()` maneja todo
3. **✅ Fallback Inteligente**: Si sandbox falla, automático a WebAgent
4. **✅ Configuración Persistente**: Agente guarda su modo en DB
5. **✅ Objetivo del Usuario**: `extraction_target` pasa directo a WebAgent
6. **✅ Sin Código Inútil**: No genera JS para sitios con anti-bot
7. **✅ Transparente**: Logs claros de qué modo usa

---

## ⏳ Pendiente (Frontend)

### **1. Mostrar Modo de Ejecución en UI**

Cuando usuario crea agente y recibe `execution_mode: 'webagent'`:

```tsx
{codeGeneration.execution_mode === 'webagent' && (
  <Alert variant="warning">
    🌐 Este agente usará WebAgent (navegador real) debido a:
    {codeGeneration.metadata.reason}
  </Alert>
)}
```

### **2. Guardar Agente con Configuración Correcta**

```typescript
await supabase.from('site_agents').insert({
  agent_name: codeGeneration.suggestedName,
  extraction_target: codeGeneration.suggestedTarget,
  extraction_config: {
    mode: codeGeneration.execution_mode, // ✅ 'webagent' o 'sandbox'
    requires_browser: codeGeneration.requires_browser,
    selectors: codeGeneration.selectors,
    generated: true
  },
  extractionLogic: codeGeneration.extractionLogic // null si webagent
})
```

### **3. Indicador Visual en Lista de Agentes**

```tsx
{agent.extraction_config.mode === 'webagent' && (
  <Badge variant="info">🌐 WebAgent</Badge>
)}
```

---

## 📈 Métricas y Observabilidad

**Logs Esperados**:

```
🔍 Diagnosticando página antes de generar código...
📊 Diagnostic results: { has_antibot: true, has_spa: false, execution_mode_recommended: 'webagent' }
🌐 Sitio requiere WebAgent - no se generará código JS
✅ Agente creado con modo: webagent
---
🚀 Starting unified execution - ID: agent_1759313817_xxx
🔧 Execution mode: webagent
🌐 Agente configurado para usar WebAgent directamente
🌐 Executing with WebAgent (configured mode)
🔗 WebAgent URL configurada: http://webagent:8787
✅ WebAgent está disponible
🔄 Intentando WebAgent endpoint: http://webagent:8787/scrape/agent
🔒 Anti-bot detectado - esperando 10 segundos adicionales...
🔄 Página aún vacía - recargando...
✅ WebAgent respondió exitosamente
📊 Parseados 20 items de resultado de WebAgent
✅ WebAgent extrajo exitosamente: 20 items
```

---

## 🎯 Resultado Final

- **✅ Sistema completamente automático**
- **✅ Usuario NO necesita entender técnicamente**
- **✅ Agente adapta su ejecución según el sitio**
- **✅ WebAgent integrado transparentemente**
- **✅ Fallback robusto si algo falla**
- **✅ Objetivo del usuario siempre respetado**

**El usuario solo dice: "Quiero extraer X de Y"**
**El sistema decide cómo hacerlo** 🚀

