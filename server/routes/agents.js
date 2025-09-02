const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Configurar OpenAI (GPT-5)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generar código de extracción usando GPT-5
 * POST /webagent/generate-agent-code
 */
router.post('/generate-agent-code', async (req, res) => {
  try {
    const { instructions, siteMap, existingAgent } = req.body;

    if (!instructions || !siteMap) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren instrucciones y mapa del sitio'
      });
    }

    // Construir el prompt para GPT-5
    const systemPrompt = `Eres un experto en web scraping y automatización. Tu tarea es generar código de extracción basado en las instrucciones del usuario y el mapa del sitio web.

Debes analizar:
1. Las instrucciones del usuario sobre qué extraer
2. La estructura del sitio web
3. El objetivo de extracción

Genera:
1. Lógica de extracción clara y específica
2. Selectores CSS/XPath apropiados
3. Flujo de trabajo paso a paso
4. Sugerencias para nombre y descripción del agente

Formato de respuesta JSON:
{
  "extractionLogic": "Descripción clara de la lógica de extracción",
  "selectors": ["selector1", "selector2"],
  "workflow": ["paso1", "paso2"],
  "confidence": 0.95,
  "reasoning": "Explicación de por qué se eligió este enfoque",
  "suggestedName": "Nombre sugerido para el agente",
  "suggestedTarget": "Objetivo de extracción optimizado",
  "suggestedDescription": "Descripción clara de los datos a extraer"
}`;

    const userPrompt = `Instrucciones del usuario: ${instructions}

Mapa del sitio:
- Nombre: ${siteMap.site_name}
- URL: ${siteMap.base_url}
- Estructura: ${JSON.stringify(siteMap.structure, null, 2)}
- Resumen de navegación: ${siteMap.navigation_summary}

${existingAgent ? `Agente existente:
- Nombre: ${existingAgent.name}
- Objetivo actual: ${existingAgent.target}
- Configuración: ${JSON.stringify(existingAgent.config, null, 2)}

Por favor, mejora o refina el agente existente basándote en las nuevas instrucciones.` : 'Este es un nuevo agente.'}

Genera el código de extracción más apropiado para estas instrucciones.`;

    // Llamar a GPT-5
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Usar GPT-4o como fallback si GPT-5 no está disponible
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const response = completion.choices[0].message.content;
    
    // Intentar parsear la respuesta JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      // Si no es JSON válido, crear una respuesta estructurada
      parsedResponse = {
        extractionLogic: response,
        selectors: [],
        workflow: ["Analizar instrucciones", "Identificar elementos", "Extraer datos"],
        confidence: 0.8,
        reasoning: "Respuesta generada por IA, requiere revisión manual",
        suggestedName: `Agente de ${siteMap.site_name}`,
        suggestedTarget: instructions.substring(0, 100) + "...",
        suggestedDescription: `Extracción automática basada en: ${instructions.substring(0, 150)}...`
      };
    }

    // Validar y completar la respuesta
    const finalResponse = {
      extractionLogic: parsedResponse.extractionLogic || instructions,
      selectors: parsedResponse.selectors || [],
      workflow: parsedResponse.workflow || ["Paso 1: Analizar sitio", "Paso 2: Extraer datos"],
      confidence: Math.min(Math.max(parsedResponse.confidence || 0.8, 0.1), 1.0),
      reasoning: parsedResponse.reasoning || "Lógica generada automáticamente por IA",
      suggestedName: parsedResponse.suggestedName || `Agente de ${siteMap.site_name}`,
      suggestedTarget: parsedResponse.suggestedTarget || instructions,
      suggestedDescription: parsedResponse.suggestedDescription || `Extracción de ${siteMap.site_name}`
    };

    res.json({
      success: true,
      data: finalResponse
    });

  } catch (error) {
    console.error('Error generating agent code:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor',
      fallback: {
        extractionLogic: "Extracción manual requerida debido a error en generación automática",
        selectors: [],
        workflow: ["Revisar instrucciones manualmente", "Configurar selectores", "Probar extracción"],
        confidence: 0.5,
        reasoning: "Error en generación automática, se requiere configuración manual",
        suggestedName: "Agente Manual",
        suggestedTarget: "Configurar manualmente",
        suggestedDescription: "Agente que requiere configuración manual"
      }
    });
  }
});

module.exports = router;

/**
 * Ejecutar extracción basada en configuración generada
 * POST /api/agents/execute
 * body: { url: string, config: { selectors: string[], workflow?: string[], fields?: Record<string,string> }, maxItems?: number }
 */
router.post('/execute', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { url, config, maxItems = 30 } = req.body || {};
    if (!url || !config || !Array.isArray(config.selectors)) {
      return res.status(400).json({ success: false, error: 'missing_parameters', message: 'Se requieren url y config.selectors' });
    }

    // Helpers
    const toAbsolute = (base, href) => {
      try {
        return new URL(href, base).toString();
      } catch { return href; }
    };

    const parseAttrSelector = (s) => {
      if (!s || typeof s !== 'string') return { sel: s, attr: null };
      const parts = s.split(/\s*(\||->)\s*/);
      if (parts.length >= 3) return { sel: parts[0], attr: parts[2] };
      return { sel: s, attr: null };
    };

    const getText = ($ctx, sel) => {
      if (!sel) return '';
      const { sel: css, attr } = parseAttrSelector(sel);
      const el = css ? $ctx.find(css).first() : $ctx;
      if (attr) return (el.attr(attr) || '').toString().trim();
      return (el.text() || '').replace(/\s+/g, ' ').trim();
    };

    // Descarga con User-Agent básico
    const fetchHtml = async (targetUrl) => {
      const resp = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ViztaAgent/1.0)'
        }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    };

    // Paso 1: cargar página raíz
    const rootHtml = await fetchHtml(url);
    const $ = cheerio.load(rootHtml);

    // Intentar detectar enlaces "ver más" si existen en selectors
    const [detailLinkFromConfig, detailContainerFromConfig, pdfFromConfig] = config.selectors || [];
    const seeMoreSelector = detailLinkFromConfig || (config.selectors || []).find(s => /ver\s*m[aá]s|btn|detail|ver\s*detalle|iniciativa/i.test(s)) || 'a';
    let detailLinks = [];
    try {
      $(seeMoreSelector).each((_, el) => {
        let href = $(el).attr('href');
        if (!href) {
          const onclick = ($(el).attr('onclick') || '').toString();
          // patrones comunes: window.open('...') o location.href='...'
          const m = onclick.match(/["'](https?:[^"']+|\/[\w\-\/_?.=&#%]+)["']/);
          if (m) href = m[1];
        }
        if (href) detailLinks.push(toAbsolute(url, href));
      });
    } catch {}

    // Si no se detectaron enlaces de detalle, intentar extraer en la misma página
    const detailSelector = detailContainerFromConfig || (config.selectors || []).find(s => /detalle|detail|iniciativa|item|card|resultado|row|col/i.test(s)) || null;

    const items = [];

    if (detailLinks.length > 0) {
      const limited = detailLinks.slice(0, Math.min(maxItems, detailLinks.length));
      for (const link of limited) {
        try {
          const html = await fetchHtml(link);
          const $$ = cheerio.load(html);
          const containerSel = detailSelector || 'body';
          const container = $$(containerSel).first();

          // Extraer campos básicos
          const text = container.text().replace(/\s+/g, ' ').trim();
          const pdfSel = pdfFromConfig || "a[href$='.pdf']";
          const pdfCandidate = getText(container, `${pdfSel}|href`) || container.find("a[href$='.pdf']").first().attr('href');
          const pdf = pdfHref ? toAbsolute(link, pdfHref) : null;

          // Campos mapeados si vienen en config.fields (ej: { titulo: 'h1.title', fecha: '.date' })
          const record = { url: link, text };
          if (config.fields && typeof config.fields === 'object') {
            for (const [key, sel] of Object.entries(config.fields)) {
              try {
                const val = getText($$, sel);
                record[key] = val;
              } catch {}
            }
          }
          if (pdfCandidate) record.pdf = toAbsolute(link, pdfCandidate);
          items.push(record);
        } catch (err) {
          items.push({ url: link, error: err.message });
        }
      }
    } else {
      // Modo single-page: extraer de la página raíz
      const containerSel = (config.list && config.list.item) || detailSelector || 'body';
      $(containerSel).each((idx, el) => {
        if (items.length >= maxItems) return;
        const section = $(el);
        const text = section.text().replace(/\s+/g, ' ').trim();
        const pdfSel = pdfFromConfig || "a[href$='.pdf']";
        const pdfCandidate = getText(section, `${pdfSel}|href`) || section.find("a[href$='.pdf']").first().attr('href');
        const record = { url, text };
        if (config.fields && typeof config.fields === 'object') {
          for (const [key, sel] of Object.entries(config.fields)) {
            try {
              record[key] = getText(section, sel);
            } catch {}
          }
        }
        if (pdfCandidate) record.pdf = toAbsolute(url, pdfCandidate);
        items.push(record);
      });
    }

    return res.json({
      success: true,
      data: items,
      summary: `Extraídos ${items.length} elemento(s)` + (detailLinks.length ? ` desde ${detailLinks.length} enlaces de detalle` : ' en página de listado'),
      executed_at: new Date().toISOString(),
      execution_ms: Date.now() - startedAt
    });
  } catch (error) {
    console.error('Error executing agent plan:', error);
    return res.status(500).json({ success: false, error: error.message || 'internal_error' });
  }
});
