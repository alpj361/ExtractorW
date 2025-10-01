const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const vm = require('vm');
const cheerio = require('cheerio');

/**
 * AgentExecutor - Custom JavaScript Agent Execution Engine
 *
 * Executes AI-generated JavaScript agents following the NewsCron pattern:
 * - Self-contained execution with SystemLogger tracking
 * - Supabase integration for data persistence
 * - Robust error handling and timeouts
 * - Sandboxed execution environment
 */
class AgentExecutor {
  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Execution configuration
    this.config = {
      timeout: parseInt(process.env.AGENT_TIMEOUT_MS || '60000', 10), // 60 seconds default
      maxMemory: parseInt(process.env.AGENT_MAX_MEMORY_MB || '256', 10), // 256MB default
      maxItems: parseInt(process.env.AGENT_MAX_ITEMS || '100', 10), // 100 items default
      retries: parseInt(process.env.AGENT_MAX_RETRIES || '2', 10) // 2 retries default
    };

    console.log('🤖 AgentExecutor initialized with config:', this.config);
  }

  /**
   * Unified execution method - handles both debug scripts and agent configurations
   * This is the core execution engine that consolidates all execution paths
   */
  async executeUnified({
    url,
    script = null,
    config = null,
    site_structure = null,
    maxItems = 20,
    user = null,
    executionType = 'debug', // 'debug' | 'agent' | 'test'
    agentName = 'UnifiedExecution',
    timeout = 30000
  }) {
    const executionId = `${executionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log(`🚀 Starting unified execution - ID: ${executionId}`);
    console.log(`📝 Type: ${executionType}`);
    console.log(`🎯 URL: ${url}`);
    console.log(`⏱️ Timeout: ${timeout}ms`);
    
    // ✅ Verificar si el agente requiere WebAgent desde el inicio
    const executionMode = config?.mode || config?.execution_config?.mode || 'sandbox';
    console.log(`🔧 Execution mode: ${executionMode}`);
    
    if (executionMode === 'webagent' || executionMode === 'browser') {
      console.log('🌐 Agente configurado para usar WebAgent directamente');
      return await this.executeWithWebAgent({
        url,
        extraction_target: config?.extraction_target || agentName,
        site_structure,
        maxItems,
        executionId,
        executionType,
        startTime
      });
    }

    try {
      // Determine what script to execute
      let executeScript = script;

      if (!executeScript && config?.extractionLogic) {
        // Use agent's extraction logic
        executeScript = config.extractionLogic;
        console.log('📜 Using agent extraction logic as script');
      } else if (!executeScript && config?.generated && config?.selectors) {
        // Generate script from AI selectors (legacy compatibility)
        executeScript = this.generateScriptFromSelectors(config.selectors, maxItems);
        console.log('🤖 Generated script from AI selectors');
      } else if (!executeScript) {
        throw new Error('No script or configuration provided for execution');
      }

      // Execute the script using the same sandboxed environment
      const result = await this.executeScriptInSandbox({
        script: executeScript,
        url,
        maxItems,
        timeout,
        executionId,
        executionType
      });

      console.log(`✅ Unified execution completed: ${executionId}`);
      console.log(`📊 Items extracted: ${result.data?.items?.length || 0}`);

      // ✅ Propagar el success real del resultado
      const actualSuccess = result.success !== undefined ? result.success : (result.data?.items?.length || 0) > 0;

      // 🔒 Si detecta anti-bot y no extrajo nada, usar WebAgent automáticamente
      if (!actualSuccess && result.diagnostic?.issues?.some(i => i.type === 'antibot')) {
        console.log('🔒 Anti-bot detectado - intentando con WebAgent automáticamente...');
        try {
          const webAgentResult = await this.fallbackToWebAgent({
            url,
            extraction_target: config?.extraction_target || agentName,
            site_structure,
            maxItems
          });
          
          if (webAgentResult.success && webAgentResult.items_extracted > 0) {
            console.log(`✅ WebAgent extrajo exitosamente: ${webAgentResult.items_extracted} items`);
            return {
              ...webAgentResult,
              executionId,
              executionType,
              execution_time_ms: Date.now() - startTime,
              fallback_used: 'webagent',
              original_diagnostic: result.diagnostic
            };
          } else {
            console.log('⚠️ WebAgent tampoco pudo extraer - retornando resultado original con diagnóstico');
          }
        } catch (webAgentError) {
          console.error('❌ WebAgent fallback falló:', webAgentError.message);
        }
      }

      return {
        success: actualSuccess,  // ✅ Usar success del resultado
        executionId,
        executionType,
        url,
        items_extracted: result.items_extracted || result.data?.items?.length || 0,
        data: result.data || { items: [] },
        logs: result.logs || [],
        execution_time_ms: Date.now() - startTime,
        
        // ✅ Incluir información de diagnóstico si existe
        page_info: result.page_info,
        diagnostic: result.diagnostic,
        
        metadata: {
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          agent_name: agentName,
          user_id: user?.id
        },
        
        // ✅ Indicador visual de éxito/fallo
        status: actualSuccess ? 'completed' : 'completed_with_issues'
      };

    } catch (error) {
      console.error(`❌ Unified execution failed: ${executionId}`, error);

      // Enhanced error categorization
      let errorCategory = 'unknown';
      let userFriendlyMessage = error.message || 'Error desconocido durante la ejecución';

      if (error.message?.includes('fetch')) {
        errorCategory = 'network';
        userFriendlyMessage = 'Error de conexión: No se pudo cargar la página web. Verifica la URL y tu conexión a internet.';
      } else if (error.message?.includes('timeout')) {
        errorCategory = 'timeout';
        userFriendlyMessage = 'Tiempo de espera agotado: La página tardó demasiado en responder o el script tardó demasiado en ejecutarse.';
      } else if (error.message?.includes('querySelector') || error.message?.includes('querySelectorAll')) {
        errorCategory = 'selector';
        userFriendlyMessage = 'Error en selector CSS: Verifica que los selectores sean válidos y que los elementos existan en la página.';
      } else if (error.message?.includes('ReferenceError') || error.message?.includes('not defined')) {
        errorCategory = 'script';
        userFriendlyMessage = 'Error en el script: Variable o función no definida. Revisa la sintaxis del código JavaScript.';
      } else if (error.message?.includes('SyntaxError')) {
        errorCategory = 'syntax';
        userFriendlyMessage = 'Error de sintaxis: El código JavaScript contiene errores de sintaxis. Verifica paréntesis, llaves y puntos y comas.';
      } else if (error.message?.includes('HTTP')) {
        errorCategory = 'http';
        userFriendlyMessage = `Error HTTP: ${error.message}. La página web no está disponible o requiere autenticación.`;
      }

      return {
        success: false,
        executionId,
        executionType,
        url,
        error: userFriendlyMessage,
        error_details: {
          category: errorCategory,
          original_message: error.message,
          stack: error.stack
        },
        execution_time_ms: Date.now() - startTime,
        data: { items: [] },
        logs: [],
        troubleshooting: {
          [errorCategory]: this.getTroubleshootingTips(errorCategory)
        }
      };
    }
  }

  /**
   * Get troubleshooting tips based on error category
   */
  getTroubleshootingTips(category) {
    const tips = {
      network: [
        'Verifica que la URL sea correcta y esté disponible',
        'Comprueba tu conexión a internet',
        'Algunos sitios pueden bloquear solicitudes automatizadas',
        'Intenta con una URL diferente para probar'
      ],
      timeout: [
        'Reduce el número de elementos a extraer',
        'Simplifica el script para que sea más eficiente',
        'Algunos sitios cargan lentamente',
        'Intenta con una página más simple primero'
      ],
      selector: [
        'Inspecciona la página para verificar los selectores CSS',
        'Los selectores deben coincidir exactamente con la estructura HTML',
        'Usa selectores más específicos o más generales según sea necesario',
        'Prueba selectores simples primero (como "h1", "p", "a")'
      ],
      script: [
        'Revisa la sintaxis de JavaScript',
        'Asegúrate de que todas las variables estén definidas',
        'Verifica que los nombres de funciones sean correctos',
        'Usa console.log() para depurar el script'
      ],
      syntax: [
        'Verifica que todos los paréntesis estén balanceados',
        'Asegúrate de que las llaves {} estén cerradas correctamente',
        'Revisa que los puntos y comas estén en su lugar',
        'Usa un editor de código para detectar errores de sintaxis'
      ],
      http: [
        'Verifica que la página web esté disponible públicamente',
        'Algunos sitios requieren autenticación',
        'Intenta acceder a la URL en tu navegador primero',
        'El sitio podría estar bloqueando solicitudes automatizadas'
      ],
      unknown: [
        'Revisa los logs para más detalles',
        'Intenta con un script más simple',
        'Verifica que la URL sea accesible',
        'Contacta soporte si el problema persiste'
      ]
    };

    return tips[category] || tips.unknown;
  }

  /**
   * Analyze page structure and content to help diagnose issues
   */
  analyzePage(html, $, url) {
    try {
      // Analizar estructura básica
      const bodyElements = $('body *').length;
      const headings = $('h1, h2, h3, h4, h5, h6').length;
      const links = $('a[href]').length;
      const images = $('img').length;
      const paragraphs = $('p').length;
      const tables = $('table').length;
      const lists = $('ul, ol').length;
      
      // Detectar frameworks/librerías
      const frameworks = [];
      if (html.includes('react') || html.includes('React')) frameworks.push('React');
      if (html.includes('vue') || html.includes('Vue')) frameworks.push('Vue.js');
      if (html.includes('ng-app') || html.includes('angular')) frameworks.push('Angular');
      if (html.includes('__NEXT_DATA__')) frameworks.push('Next.js');
      if (html.includes('gatsby')) frameworks.push('Gatsby');
      
      // Detectar anti-bot protection
      const antibot = this.detectAntiBot(html);
      
      // Analizar ratio script/content
      const scriptTags = (html.match(/<script/g) || []).length;
      const styleSheets = (html.match(/<link[^>]*stylesheet/g) || []).length;
      
      return {
        structure: {
          total_elements: bodyElements,
          headings,
          links,
          images,
          paragraphs,
          tables,
          lists,
          scripts: scriptTags,
          stylesheets: styleSheets
        },
        frameworks,
        antibot,
        is_spa: frameworks.length > 0 && paragraphs < 10 && scriptTags > 5,
        content_ratio: bodyElements > 0 ? paragraphs / bodyElements : 0
      };
    } catch (error) {
      console.error('Error analyzing page:', error);
      return { error: error.message };
    }
  }

  /**
   * Detect anti-bot protection services
   */
  detectAntiBot(html) {
    const antibotSignatures = [
      { service: 'Incapsula', pattern: /_Incapsula_Resource/i, severity: 'high' },
      { service: 'Cloudflare', pattern: /cf-ray|cloudflare-static\/rocket-loader/i, severity: 'high' },
      { service: 'DataDome', pattern: /datadome/i, severity: 'high' },
      { service: 'PerimeterX', pattern: /_px|perimeterx/i, severity: 'high' },
      { service: 'reCAPTCHA', pattern: /recaptcha|google\.com\/recaptcha/i, severity: 'medium' },
      { service: 'hCaptcha', pattern: /hcaptcha/i, severity: 'medium' },
      { service: 'Akamai', pattern: /akamai/i, severity: 'high' }
    ];
    
    for (const sig of antibotSignatures) {
      if (sig.pattern.test(html)) {
        const match = html.match(sig.pattern);
        return {
          detected: true,
          service: sig.service,
          severity: sig.severity,
          evidence: match ? match[0].substring(0, 100) : 'Pattern matched'
        };
      }
    }
    
    // Detectar páginas sospechosamente pequeñas
    if (html.length < 500) {
      return {
        detected: true,
        service: 'Unknown (suspicious small page)',
        severity: 'medium',
        evidence: `Page size: ${html.length} bytes`
      };
    }
    
    return { detected: false };
  }

  /**
   * Detect common issues when extraction fails
   */
  detectIssues(html, pageAnalysis, logs) {
    const issues = [];
    const logString = logs.join(' ');
    
    // Issue 1: Anti-bot protection
    if (pageAnalysis.antibot?.detected) {
      issues.push({
        type: 'antibot',
        severity: pageAnalysis.antibot.severity,
        title: `🔒 Anti-bot Protection: ${pageAnalysis.antibot.service}`,
        description: 'El sitio usa protección anti-bot que bloquea scraping básico',
        evidence: pageAnalysis.antibot.evidence,
        suggestions: [
          'Usa WebAgent (navegador real) en lugar de scraping directo',
          'Prueba con modo Browser (Puppeteer) si WebAgent no funciona',
          'Considera usar proxies o rate limiting'
        ]
      });
    }
    
    // Issue 2: Empty or very small page
    if (html.length < 1000 && !pageAnalysis.antibot?.detected) {
      issues.push({
        type: 'empty_page',
        severity: 'critical',
        title: '📄 Página Vacía o Muy Pequeña',
        description: `La página solo tiene ${html.length} bytes. Posible error o redirección`,
        evidence: html.substring(0, 300),
        suggestions: [
          'Verifica la URL en tu navegador',
          'Comprueba si requiere autenticación',
          'Revisa si hay redirecciones (301/302)'
        ]
      });
    }
    
    // Issue 3: Single Page Application (SPA) - content loaded with JS
    if (pageAnalysis.is_spa) {
      issues.push({
        type: 'spa_dynamic_content',
        severity: 'high',
        title: '⚡ Contenido Dinámico (SPA)',
        description: `Detectado: ${pageAnalysis.frameworks.join(', ')}. El contenido se carga con JavaScript`,
        evidence: `Frameworks: ${pageAnalysis.frameworks.join(', ')}`,
        suggestions: [
          'Usa WebAgent que ejecuta JavaScript',
          'Usa modo Browser (Puppeteer) con waitForSelector',
          'El scraping con fetch() simple no funciona en SPAs'
        ]
      });
    }
    
    // Issue 4: No content structure
    if (pageAnalysis.structure?.total_elements < 50 && html.length > 1000) {
      issues.push({
        type: 'no_structure',
        severity: 'medium',
        title: '🏗️ Estructura HTML Mínima',
        description: 'La página tiene poco contenido visible, probablemente carga con JS',
        evidence: `Solo ${pageAnalysis.structure.total_elements} elementos en body`,
        suggestions: [
          'La página podría cargar contenido dinámicamente',
          'Usa herramientas que ejecuten JavaScript (WebAgent)',
          'Inspecciona la página en DevTools para ver cómo carga'
        ]
      });
    }
    
    // Issue 5: HTTP errors in logs
    if (logString.includes('403') || logString.includes('Forbidden')) {
      issues.push({
        type: 'http_403',
        severity: 'high',
        title: '🚫 Acceso Prohibido (403)',
        description: 'El servidor rechazó la solicitud',
        evidence: 'HTTP 403 Forbidden',
        suggestions: [
          'El sitio podría requerir headers específicos',
          'Intenta con WebAgent que usa headers de navegador real',
          'Verifica si necesitas autenticación o cookies'
        ]
      });
    }
    
    if (logString.includes('429') || logString.includes('Too Many Requests')) {
      issues.push({
        type: 'http_429',
        severity: 'medium',
        title: '⏱️ Rate Limit (429)',
        description: 'Demasiadas solicitudes, el servidor está limitando el acceso',
        evidence: 'HTTP 429 Too Many Requests',
        suggestions: [
          'Agrega delays entre requests',
          'Usa proxies rotativos',
          'Reduce la frecuencia de ejecución del agente'
        ]
      });
    }
    
    // Issue 6: No common patterns found
    if (!pageAnalysis.antibot?.detected && 
        pageAnalysis.structure?.total_elements > 50 && 
        pageAnalysis.structure?.links < 5 &&
        pageAnalysis.structure?.paragraphs < 5) {
      issues.push({
        type: 'unusual_structure',
        severity: 'low',
        title: '🔍 Estructura Inusual',
        description: 'La página tiene elementos pero pocos links/párrafos',
        evidence: `${pageAnalysis.structure.links} links, ${pageAnalysis.structure.paragraphs} párrafos`,
        suggestions: [
          'Los selectores podrían necesitar ajustes',
          'Inspecciona la página para encontrar selectores correctos',
          'Prueba selectores más generales primero (div, span, etc.)'
        ]
      });
    }
    
    return issues;
  }

  /**
   * Core script execution in sandboxed environment
   * Used by both debug and agent execution
   */
  async executeScriptInSandbox({ script, url, maxItems, timeout, executionId, executionType }) {
    const capturedLogs = [];
    const startTime = Date.now();

    try {
      // Fetch the page
      console.log(`🌐 Fetching URL: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: Math.min(timeout, 30000) // Max 30 second fetch timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      // Extract basic document info for better simulation
      const pageTitle = $('title').text() || '';
      const bodyText = $('body').text() || '';
      const bodyHtml = $('body').html() || '';

      console.log(`📄 Page loaded: "${pageTitle}" (${html.length} chars, ${bodyText.length} text chars)`);

      // Create execution sandbox
      const sandbox = {
        // Enhanced DOM access
        document: {
          querySelector: (selector) => {
            try {
              const elem = $(selector).first();
              if (elem.length === 0) return null;
              return {
                textContent: elem.text(),
                innerHTML: elem.html(),
                getAttribute: (attr) => elem.attr(attr),
                href: elem.attr('href'),
                tagName: elem.prop('tagName'),
                className: elem.attr('class') || '',
                id: elem.attr('id') || '',
                innerText: elem.text(), // Alias for textContent
                // Add more common properties
                value: elem.val(),
                src: elem.attr('src'),
                alt: elem.attr('alt'),
                title: elem.attr('title')
              };
            } catch (error) {
              console.error(`querySelector error for "${selector}":`, error.message);
              return null;
            }
          },
          querySelectorAll: (selector) => {
            try {
              const elements = $(selector);
              const nodeList = Array.from({ length: elements.length }, (_, i) => {
                const elem = elements.eq(i);
                return {
                  textContent: elem.text(),
                  innerHTML: elem.html(),
                  getAttribute: (attr) => elem.attr(attr),
                  href: elem.attr('href'),
                  tagName: elem.prop('tagName'),
                  className: elem.attr('class') || '',
                  id: elem.attr('id') || '',
                  innerText: elem.text(), // Alias for textContent
                  // Add more common properties
                  value: elem.val(),
                  src: elem.attr('src'),
                  alt: elem.attr('alt'),
                  title: elem.attr('title')
                };
              });

              // Make it behave more like a real NodeList
              nodeList.forEach = Array.prototype.forEach;
              nodeList.length = elements.length;

              console.log(`querySelectorAll("${selector}") found ${nodeList.length} elements`);
              return nodeList;
            } catch (error) {
              console.error(`querySelectorAll error for "${selector}":`, error.message);
              return [];
            }
          },
          // Add common document properties
          title: pageTitle,
          URL: url,
          body: {
            textContent: bodyText,
            innerHTML: bodyHtml
          }
        },
        // Global variables
        url,
        maxItems,
        // Enhanced console for logging
        console: {
          log: (...args) => {
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            capturedLogs.push(`[LOG] ${message}`);
            console.log(`[${executionType.toUpperCase()}-${executionId}]`, ...args);
          },
          error: (...args) => {
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            capturedLogs.push(`[ERROR] ${message}`);
            console.error(`[${executionType.toUpperCase()}-${executionId}]`, ...args);
          },
          warn: (...args) => {
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            capturedLogs.push(`[WARN] ${message}`);
            console.warn(`[${executionType.toUpperCase()}-${executionId}]`, ...args);
          }
        },
        // Standard JavaScript objects
        Date, Math, JSON, Array, Object, String, Number, Boolean,
        parseInt, parseFloat, isNaN,
        // Results container
        items: []
      };

      // Execute the script in the sandbox
      const context = vm.createContext(sandbox);
      const scriptToExecute = `
        (function() {
          try {
            ${script}
          } catch (error) {
            console.error('Script execution error:', error.message);
            throw error;
          }
        })()
      `;

      console.log(`🔧 Executing script in sandbox (${script.length} chars)`);
      const result = vm.runInContext(scriptToExecute, context, {
        timeout: Math.min(timeout, 45000), // Max 45 second script timeout
        displayErrors: true
      });

      // Extract results with improved logic
      let extractedItems = [];

      // Priority 1: Check if script returned an array directly
      if (Array.isArray(result)) {
        extractedItems = result;
        console.log(`📦 Using returned array: ${extractedItems.length} items`);
      }
      // Priority 2: Check if sandbox.items was populated
      else if (Array.isArray(sandbox.items) && sandbox.items.length > 0) {
        extractedItems = sandbox.items;
        console.log(`📦 Using sandbox.items: ${extractedItems.length} items`);
      }
      // Priority 3: Check if result has items property
      else if (result && Array.isArray(result.items)) {
        extractedItems = result.items;
        console.log(`📦 Using result.items: ${extractedItems.length} items`);
      }
      // Priority 4: No items found
      else {
        extractedItems = [];
        console.log(`⚠️ No items found. Result type: ${typeof result}, sandbox.items: ${sandbox.items?.length || 0}`);
      }

      console.log(`📊 Script execution completed. Items: ${extractedItems.length}`);

      // ✅ Analizar página para diagnóstico
      const pageAnalysis = this.analyzePage(html, $, url);
      
      // ✅ Detectar si los items son placeholder de anti-bot (errorInfo)
      const isAntibotPlaceholder = extractedItems.length > 0 && 
        extractedItems.some(item => 
          item && 
          (item.error === 'antibot_detected' || 
           item.error === 'spa_requires_js' ||
           item.message?.includes('Anti-bot') ||
           item.message?.includes('protegido'))
        );
      
      if (isAntibotPlaceholder) {
        console.log('🔒 Detectado placeholder de anti-bot en resultados - marcando como fallo');
        const antibotItem = extractedItems.find(item => item.error === 'antibot_detected' || item.message?.includes('Anti-bot'));
        
        // Reconstruir el issue de anti-bot desde el errorInfo
        const antibotIssue = {
          type: 'antibot',
          severity: 'critical',
          title: antibotItem?.service || '🔒 Anti-bot Protection Detected',
          description: antibotItem?.message || 'El sitio está protegido por anti-bot',
          evidence: `Servicio: ${antibotItem?.service || 'Unknown'}, Tamaño: ${antibotItem?.page_size || 0} bytes`,
          suggestions: [
            '🔧 Configura WebAgent para este sitio',
            '🌐 Usa modo Browser (Puppeteer) en lugar de fetch directo',
            '❌ El scraping directo es imposible en este sitio'
          ]
        };
        
        return {
          success: false,  // ❌ Marcar como fallo aunque ejecutó
          items_extracted: 0, // ❌ 0 items reales
          data: { items: extractedItems }, // Mantener errorInfo para referencia
          logs: capturedLogs,
          execution_time_ms: Date.now() - startTime,
          
          // ✅ Información de diagnóstico con anti-bot detectado
          page_info: {
            title: pageTitle || 'Sin título',
            url: url,
            size_bytes: antibotItem?.page_size || html.length,
            size_text: bodyText.length,
            has_content: false // ❌ No hay contenido real
          },
          
          diagnostic: {
            issues: [antibotIssue],
            page_analysis: pageAnalysis
          }
        };
      }
      
      // ✅ Detectar problemas si no se encontraron items
      const issues = extractedItems.length === 0 ? this.detectIssues(html, pageAnalysis, capturedLogs) : [];

      return {
        success: extractedItems.length > 0,  // ✅ TRUE solo si hay items REALES
        items_extracted: extractedItems.length,
        data: { items: extractedItems },
        logs: capturedLogs,
        execution_time_ms: Date.now() - startTime,
        
        // ✅ Información de diagnóstico
        page_info: {
          title: pageTitle || 'Sin título',
          url: url,
          size_bytes: html.length,
          size_text: bodyText.length,
          has_content: bodyText.length > 100
        },
        
        // ✅ Análisis de problemas
        diagnostic: issues.length > 0 ? {
          issues: issues,
          page_analysis: pageAnalysis
        } : null
      };

    } catch (error) {
      console.error(`❌ Script execution failed: ${error.message}`);
      capturedLogs.push(`[ERROR] Script execution failed: ${error.message}`);

      // Enhanced error categorization for script execution
      let errorCategory = 'script';
      let userFriendlyMessage = error.message;

      if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        errorCategory = 'timeout';
        userFriendlyMessage = 'El script tardó demasiado en ejecutarse. Simplifica el código o reduce el número de elementos a procesar.';
      } else if (error.message?.includes('ReferenceError')) {
        errorCategory = 'script';
        userFriendlyMessage = 'Variable no definida en el script. Verifica que todas las variables estén declaradas correctamente.';
      } else if (error.message?.includes('SyntaxError')) {
        errorCategory = 'syntax';
        userFriendlyMessage = 'Error de sintaxis en el JavaScript. Verifica paréntesis, llaves y puntos y comas.';
      } else if (error.message?.includes('TypeError')) {
        errorCategory = 'script';
        userFriendlyMessage = 'Error de tipo en el script. Verifica que estés usando los métodos correctos en los objetos.';
      }

      return {
        success: false,
        error: userFriendlyMessage,
        error_details: {
          category: errorCategory,
          original_message: error.message,
          code: error.code
        },
        data: { items: [] },
        logs: capturedLogs,
        execution_time_ms: Date.now() - startTime,
        troubleshooting: this.getTroubleshootingTips(errorCategory)
      };
    }
  }

  /**
   * Generate a simple script from AI selectors (legacy compatibility)
   */
  generateScriptFromSelectors(selectors, maxItems) {
    return `
const items = [];
const maxItems = ${maxItems};

try {
  console.log('🔍 Starting extraction with ${selectors.length} selectors...');

  const selectors = ${JSON.stringify(selectors)};

  for (let i = 0; i < selectors.length && items.length < maxItems; i++) {
    const selector = selectors[i];

    try {
      const elements = document.querySelectorAll(selector);
      console.log(\`Selector "\${selector}" found \${elements.length} elements\`);

      elements.forEach((element, index) => {
        if (items.length >= maxItems) return;

        const text = element.textContent?.trim();
        const href = element.getAttribute('href');

        if (text) {
          items.push({
            text: text,
            link: href,
            selector: selector,
            index: index,
            extracted_at: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.error(\`Error with selector "\${selector}": \`, error.message);
    }
  }

  console.log(\`✅ Extraction completed. Total items: \${items.length}\`);
} catch (error) {
  console.error('Script execution error:', error);
}

return items;`;
  }

  /**
   * Execute an AI-generated agent with custom JavaScript
   */
  async executeAgent({ url, config, site_structure, maxItems, user, agentName = 'CustomAgent', databaseConfig = null }) {
    const executionId = `agent_${agentName}_${Date.now()}`;

    console.log(`🚀 Starting agent execution: ${executionId}`);
    console.log(`🎯 Target URL: ${url}`);
    console.log(`📊 Config: AI-generated=${!!config.generated}, Selectors=${config.selectors?.length || 0}`);
    console.log(`🗃️ Database: ${databaseConfig?.enabled ? 'Enabled' : 'Disabled'}`);

    // Create execution context with SystemLogger pattern
    const executionContext = {
      executionId,
      startTime: new Date(),
      url,
      agentName,
      config,
      user,
      databaseConfig,
      metrics: {
        items_found: 0,
        items_processed: 0,
        items_saved: 0,
        items_failed: 0,
        execution_time_ms: 0,
        memory_used_mb: 0,
        errors: [],
        warnings: [],
        table_created: false
      }
    };

    try {
      // Generate JavaScript code based on configuration
      const agentCode = this.generateAgentScript({
        url,
        config,
        site_structure,
        maxItems: maxItems || this.config.maxItems,
        executionId,
        databaseConfig
      });

      console.log(`📝 Generated agent script (${agentCode.length} chars)`);

      // Execute the generated script in sandboxed environment
      const result = await this.executeInSandbox(agentCode, executionContext);

      // Finalize execution metrics
      executionContext.metrics.execution_time_ms = Date.now() - executionContext.startTime;

      console.log(`✅ Agent execution completed: ${executionId}`);
      console.log(`📊 Results: ${result.data?.length || 0} items extracted`);

      // Log execution to system logs table (similar to NewsCron)
      await this.logExecution(executionContext, 'completed', result);

      return {
        success: true,
        executionId,
        url,
        extraction_type: 'custom_javascript_agent',
        items_extracted: result.data?.length || 0,
        confidence: config.confidence || 0.8,
        data: result.data || [],
        metadata: {
          ai_generated: !!config.generated,
          execution_time_ms: executionContext.metrics.execution_time_ms,
          memory_used_mb: executionContext.metrics.memory_used_mb,
          agent_name: agentName,
          execution_date: new Date().toISOString(),
          metrics: executionContext.metrics
        }
      };

    } catch (error) {
      executionContext.metrics.execution_time_ms = Date.now() - executionContext.startTime;
      executionContext.metrics.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      });

      console.error(`❌ Agent execution failed: ${executionId}`, error);

      // Log failed execution
      await this.logExecution(executionContext, 'failed', { error: error.message });

      throw error;
    }
  }

  /**
   * Generate executable JavaScript code based on agent configuration
   */
  generateAgentScript({ url, config, site_structure, maxItems, executionId, databaseConfig }) {
    // Choose template based on configuration type
    if (config.generated && config.selectors) {
      return this.generateAIAgentScript({ url, config, maxItems, executionId, databaseConfig });
    } else {
      return this.generateBasicAgentScript({ url, config, maxItems, executionId, databaseConfig });
    }
  }

  /**
   * Generate AI-powered agent script with specific selectors
   */
  generateAIAgentScript({ url, config, maxItems, executionId, databaseConfig }) {
    const selectorsArray = Array.isArray(config.selectors) ? config.selectors : [];
    const workflowArray = Array.isArray(config.workflow) ? config.workflow : [];
    const dbEnabled = databaseConfig?.enabled || false;
    const usePublicDb = databaseConfig?.use_public_database || false;

    return `
// AI-Generated Agent Script - Execution ID: ${executionId}
// Generated at: ${new Date().toISOString()}
// Target URL: ${url}
// Database Enabled: ${dbEnabled}
// Public Database: ${usePublicDb}

const fetch = require('node-fetch');
const cheerio = require('cheerio');
${dbEnabled ? `const { createClient } = require('@supabase/supabase-js');` : ''}

async function executeAIAgent() {
  const results = [];
  const startTime = Date.now();
  let supabaseClient = null;
  let tableCreated = false;

  try {
    ${dbEnabled ? `
    // Initialize PulseJournal's Supabase client
    console.log('🗃️ Initializing PulseJournal database client...');
    supabaseClient = createClient(
      '${process.env.SUPABASE_URL}',
      '${process.env.SUPABASE_SERVICE_ROLE_KEY}'
    );

    // Check if table exists, create if it doesn't
    const tableName = 'agent_${databaseConfig.table_name}';
    console.log(\`🔍 Checking if public table '\${tableName}' exists...\`);

    try {
      // Try to query the table to see if it exists
      const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        // Table doesn't exist, create it
        console.log(\`📝 Creating table '\${tableName}'...\`);

        const createTableQuery = \`
          CREATE TABLE IF NOT EXISTS "\${tableName}" (
            id BIGSERIAL PRIMARY KEY,
            text TEXT,
            href TEXT,
            src TEXT,
            selector TEXT,
            tag_name TEXT,
            position INTEGER,
            agent_name TEXT,
            user_id TEXT,
            extraction_timestamp TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            metadata JSONB
          );

          -- Enable RLS for security
          ALTER TABLE "\${tableName}" ENABLE ROW LEVEL SECURITY;

          -- Create policy for public read access
          CREATE POLICY "Enable read access for all users" ON "\${tableName}"
            FOR SELECT USING (true);

          -- Create policy for insert access (agents can insert data)
          CREATE POLICY "Enable insert for authenticated users" ON "\${tableName}"
            FOR INSERT WITH CHECK (true);
        \`;

        const { error: createError } = await supabaseClient.rpc('exec_sql', {
          sql: createTableQuery
        });

        if (createError) {
          console.log('⚠️ Table creation via RPC failed, trying direct creation...');

          // Fallback: create simpler table structure
          const { error: insertError } = await supabaseClient
            .from(tableName)
            .insert({
              text: 'table_creation_test',
              selector: 'test',
              tag_name: 'test',
              position: 0,
              agent_name: '${config.suggestedName || 'AI_Agent'}',
              user_id: 'system',
              metadata: { table_creation: true }
            });

          if (insertError && insertError.code === 'PGRST116') {
            throw new Error(\`Cannot create table '\${tableName}'. Please create it manually or check permissions.\`);
          }

          // Remove test record
          await supabaseClient
            .from(tableName)
            .delete()
            .eq('text', 'table_creation_test');
        }

        tableCreated = true;
        console.log(\`✅ Table '\${tableName}' created successfully\`);
      } else {
        console.log(\`✅ Table '\${tableName}' already exists\`);
      }
    } catch (tableError) {
      console.warn('⚠️ Table check/creation error:', tableError.message);
      console.log('📄 Continuing with extraction, will attempt to save data anyway...');
    }
    ` : ''}

    console.log('🌐 Fetching URL: ${url}');

    // Step 1: Fetch the page with enhanced headers and better error handling
    const response = await fetch('${url}', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 30000,
      redirect: 'follow'
    });

    console.log(\`📡 Response status: \${response.status} \${response.statusText}\`);
    console.log(\`📡 Content-Type: \${response.headers.get('content-type') || 'not specified'}\`);

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    const html = await response.text();
    console.log('📄 Page loaded, HTML length:', html.length);

    // Validate page content
    if (html.length < 1000) {
      console.log('⚠️ Page content is very small (< 1000 chars), might be an error page or blocked');
      console.log('📝 Page preview (first 300 chars):', html.substring(0, 300));
    }

    // Check for common blocking patterns
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('access denied') || lowerHtml.includes('forbidden') ||
        lowerHtml.includes('blocked') || lowerHtml.includes('cloudflare') ||
        lowerHtml.includes('captcha') || lowerHtml.includes('bot detection')) {
      console.log('🚫 Page appears to be blocked or showing anti-bot protection');
    }

    const $ = cheerio.load(html);

    console.log('📄 Page loaded, HTML length:', html.length);

    // Step 2: Apply AI-generated selectors with fallbacks
    const selectors = ${JSON.stringify(selectorsArray)};
    const maxItems = ${maxItems};

    console.log('🎯 Processing selectors:', selectors.slice(0, 3));
    console.log('📄 Page title:', $('title').text() || 'No title found');
    console.log('📊 Total page elements:', $('*').length);
    console.log('🌐 Page URL:', url);
    console.log('📏 Page content size:', html?.length || 0, 'characters');

    // Debug page structure
    const bodyElements = $('body *').length;
    const headings = $('h1, h2, h3, h4, h5, h6').length;
    const links = $('a[href]').length;
    const paragraphs = $('p').length;
    const lists = $('ul, ol').length;

    console.log('📋 Page structure analysis:');
    console.log('  - Body elements:', bodyElements);
    console.log('  - Headings (h1-h6):', headings);
    console.log('  - Links with href:', links);
    console.log('  - Paragraphs:', paragraphs);
    console.log('  - Lists (ul/ol):', lists);

    // Sample some page content for debugging
    const sampleText = $('body').text().trim().substring(0, 200);
    console.log('📝 Sample page content:', sampleText + (sampleText.length === 200 ? '...' : ''));

    // Enhanced fallback selectors with intelligent patterns
    const fallbackSelectors = [
      // Priority 1: Semantic content elements
      'article h1, article h2, article h3',
      'main h1, main h2, main h3',
      '.content h1, .content h2, .content h3',

      // Priority 2: Structured content
      'article p, .article p, .content p',
      'main p, section p',
      '.post p, .news p, .item p',

      // Priority 3: Navigation and links
      'nav a[href], .navigation a[href]',
      '.menu a[href], .nav a[href]',
      'a[href*="pdf"], a[href*="doc"]',        // Document links
      'a[href*="http"], a[href*="www"]',       // External links

      // Priority 4: Lists and structured data
      'ul li a, ol li a',                      // List links
      '.list li, .items li',                   // List items
      'table td, table th',                    // Table data

      // Priority 5: Common class patterns
      '.title, .heading, .header',
      '.description, .summary, .excerpt',
      '.price, .cost, .amount',
      '.date, .time, .timestamp',
      '.author, .by, .contact',

      // Priority 6: Generic but useful
      '[class*="title"], [class*="heading"]',
      '[class*="content"], [class*="text"]',
      '[class*="item"], [class*="product"]',
      '[class*="card"], [class*="post"]',

      // Priority 7: Last resort
      'h1, h2, h3, h4, h5, h6',
      'p:not(:empty)',
      'a[href]:not(:empty)',
      'span:not(:empty), div:not(:empty)'      // Non-empty elements only
    ];

    // Extract data using AI-generated selectors first
    for (let i = 0; i < selectors.length && results.length < maxItems; i++) {
      const selector = selectors[i];

      try {
        // Clean selector (remove description if present)
        const cleanSelector = selector.split(':')[1] || selector.split('-')[1] || selector;
        const trimmedSelector = cleanSelector.trim();

        if (!trimmedSelector) continue;

        const elements = $(trimmedSelector);
        console.log(\`🔍 Selector "\${trimmedSelector}" found \${elements.length} elements\`);

        if (elements.length === 0) {
          console.log(\`   ❌ No elements found for: \${trimmedSelector}\`);
        } else {
          console.log(\`   ✅ Found \${elements.length} elements, processing...\`);
        }

        elements.each((index, element) => {
          if (results.length >= maxItems) return false;

          const $el = $(element);
          const text = $el.text().trim();
          const href = $el.attr('href');
          const src = $el.attr('src');

          // Only add elements with meaningful content
          if ((text && text.length > 3) || href || src) {
            const item = {
              selector: trimmedSelector,
              text: text || '',
              href: href ? (href.startsWith('http') ? href : new URL(href, '${url}').href) : null,
              src: src ? (src.startsWith('http') ? src : new URL(src, '${url}').href) : null,
              tagName: element.tagName,
              position: index,
              timestamp: new Date().toISOString()
            };
            results.push(item);
            console.log(\`   📝 Added item \${results.length}: "\${text.substring(0, 50)}..." (\${element.tagName})\`);
          } else {
            console.log(\`   ⚠️ Skipped element \${index}: insufficient content (text: "\${text.substring(0, 20)}...", href: \${!!href}, src: \${!!src})\`);
          }
        });

      } catch (selectorError) {
        console.warn(\`⚠️ Selector error: \${selector} - \${selectorError.message}\`);
        continue;
      }
    }

    // If AI selectors didn't find enough content, try fallback selectors
    if (results.length < 5) {
      console.log('🔄 AI selectors found limited content, trying fallback selectors...');

      for (const fallbackSelector of fallbackSelectors) {
        if (results.length >= maxItems) break;

        try {
          const elements = $(fallbackSelector);
          console.log(\`🔄 Fallback selector "\${fallbackSelector}" found \${elements.length} elements\`);

          elements.each((index, element) => {
            if (results.length >= maxItems) return false;

            const $el = $(element);
            const text = $el.text().trim();
            const href = $el.attr('href');
            const src = $el.attr('src');

            // Only add elements with meaningful content and avoid duplicates
            if ((text && text.length > 10) || href || src) {
              // Check for duplicates
              const duplicate = results.find(r => r.text === text && r.href === href);
              if (!duplicate) {
                results.push({
                  selector: fallbackSelector,
                  text: text || '',
                  href: href ? (href.startsWith('http') ? href : new URL(href, '${url}').href) : null,
                  src: src ? (src.startsWith('http') ? src : new URL(src, '${url}').href) : null,
                  tagName: element.tagName,
                  position: index,
                  timestamp: new Date().toISOString(),
                  fallback: true
                });
              }
            }
          });

          // Stop if we found enough content
          if (results.length >= 10) break;

        } catch (fallbackError) {
          console.warn(\`⚠️ Fallback selector error: \${fallbackSelector} - \${fallbackError.message}\`);
          continue;
        }
      }
    }

    // Step 3: Process workflow if defined
    const workflow = ${JSON.stringify(workflowArray)};
    if (workflow.length > 0) {
      console.log('📋 Executing workflow steps:', workflow.length);

      // Additional processing based on workflow
      for (const step of workflow) {
        console.log(\`🔄 Workflow step: \${step}\`);

        // Basic workflow step processing
        if (step.includes('extract') && step.includes('title')) {
          const titles = $('h1, h2, h3, .title, [class*="title"]').map((i, el) => ({
            text: $(el).text().trim(),
            selector: 'workflow_title',
            tagName: el.tagName,
            timestamp: new Date().toISOString()
          })).get();

          results.push(...titles.slice(0, Math.max(0, maxItems - results.length)));
        }

        if (step.includes('extract') && step.includes('link')) {
          const links = $('a[href]').map((i, el) => ({
            text: $(el).text().trim(),
            href: $(el).attr('href'),
            selector: 'workflow_link',
            tagName: 'a',
            timestamp: new Date().toISOString()
          })).get().filter(link => link.text && link.href);

          results.push(...links.slice(0, Math.max(0, maxItems - results.length)));
        }
      }
    }

    // Final extraction summary
    console.log(\`✅ Extraction completed: \${results.length} items found\`);
    console.log('📊 Extraction summary:');
    console.log(\`  - Total items extracted: \${results.length}\`);
    console.log(\`  - Items from AI selectors: \${results.filter(r => !r.selector.includes('fallback') && !r.selector.includes('workflow')).length}\`);
    console.log(\`  - Items from fallback selectors: \${results.filter(r => r.selector.includes('fallback')).length}\`);
    console.log(\`  - Items from workflow: \${results.filter(r => r.selector.includes('workflow')).length}\`);

    if (results.length > 0) {
      console.log('📝 Sample extracted items:');
      results.slice(0, 3).forEach((item, index) => {
        console.log(\`  \${index + 1}. "\${item.text.substring(0, 60)}..." (\${item.tagName}, \${item.selector})\`);
      });
    } else {
      console.log('❌ No items were extracted. Possible issues:');
      console.log('  - Selectors may not match page structure');
      console.log('  - Page content may be dynamically loaded');
      console.log('  - Content filtering may be too strict');
      console.log('  - Page may require authentication or special headers');
    }

    ${dbEnabled ? `
    // Step 4: Save results to user's database if enabled
    if (supabaseClient && results.length > 0) {
      console.log(\`💾 Saving \${results.length} items to database table '\${tableName}'...\`);

      try {
        // Prepare data for database insertion
        const dbRows = results.map((result, index) => ({
          text: result.text || '',
          href: result.href || null,
          src: result.src || null,
          selector: result.selector || '',
          tag_name: result.tagName || result.type || '',
          position: result.position !== undefined ? result.position : index,
          agent_name: '${config.suggestedName || 'AI_Agent'}',
          user_id: 'user_${executionId.split('_')[1]}', // Extract user identifier
          extraction_timestamp: new Date().toISOString(),
          metadata: {
            url: '${url}',
            execution_id: '${executionId}',
            agent_name: '${config.suggestedName || 'AI_Agent'}',
            selector_used: result.selector,
            original_data: result,
            data_description: '${databaseConfig.data_description || 'Extracted data'}'
          }
        }));

        // Insert data in batches (Supabase limit is 1000 rows per request)
        const batchSize = 100;
        let savedCount = 0;

        for (let i = 0; i < dbRows.length; i += batchSize) {
          const batch = dbRows.slice(i, i + batchSize);

          const { error: insertError } = await supabaseClient
            .from(tableName)
            .insert(batch);

          if (insertError) {
            console.error(\`❌ Database insertion error for batch \${Math.floor(i/batchSize) + 1}:\`, insertError);
            console.warn('⚠️ Continuing with next batch...');
          } else {
            savedCount += batch.length;
            console.log(\`✅ Saved batch \${Math.floor(i/batchSize) + 1}: \${batch.length} items\`);
          }
        }

        console.log(\`🗃️ Database save completed: \${savedCount}/\${results.length} items saved\`);

      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
        console.log('📄 Data extraction successful, but database save failed');
      }
    }
    ` : ''}

    return {
      success: true,
      data: results,
      metadata: {
        url: '${url}',
        execution_time_ms: Date.now() - startTime,
        selectors_used: selectors.length,
        workflow_steps: workflow.length,
        html_length: html.length,
        ${dbEnabled ? `
        database_enabled: true,
        database_table: tableName,
        table_created: tableCreated,
        public_database: true,
        database_type: 'pulsejounal_public'
        ` : 'database_enabled: false'}
      }
    };

  } catch (error) {
    console.error('❌ Agent execution error:', error);
    throw error;
  }
}

// Execute and return result
module.exports = executeAIAgent();
`;
  }

  /**
   * Generate basic agent script for fallback scenarios
   */
  generateBasicAgentScript({ url, config, maxItems, executionId, databaseConfig }) {
    const dbEnabled = databaseConfig?.enabled || false;
    const usePublicDb = databaseConfig?.use_public_database || false;

    return `
// Basic Agent Script - Execution ID: ${executionId}
// Generated at: ${new Date().toISOString()}
// Target URL: ${url}
// Database Enabled: ${dbEnabled}
// Public Database: ${usePublicDb}

const fetch = require('node-fetch');
const cheerio = require('cheerio');
${dbEnabled ? `const { createClient } = require('@supabase/supabase-js');` : ''}

async function executeBasicAgent() {
  const results = [];
  const startTime = Date.now();

  try {
    console.log('🌐 Fetching URL (basic mode): ${url}');

    const response = await fetch('${url}', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    console.log('📄 Page loaded (basic mode), HTML length:', html.length);
    console.log('📄 Page title:', $('title').text() || 'No title found');
    console.log('📊 Total page elements:', $('*').length);

    // Enhanced basic content extraction
    const maxItems = ${maxItems};

    // Extract titles with better filtering
    $('h1, h2, h3, h4, h5, h6').each((index, element) => {
      if (results.length >= maxItems) return false;

      const text = $(element).text().trim();
      if (text && text.length > 3) {
        results.push({
          type: 'title',
          text: text,
          selector: element.tagName.toLowerCase(),
          position: index,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Extract articles and main content areas
    $('article, main, .content, .main-content, .post, .entry').each((index, element) => {
      if (results.length >= maxItems) return false;

      const text = $(element).text().trim();
      if (text.length > 50) {
        results.push({
          type: 'article',
          text: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
          selector: element.tagName.toLowerCase() + ($(element).attr('class') ? '.' + $(element).attr('class').split(' ')[0] : ''),
          position: index,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Extract paragraphs with substantial content
    $('p').each((index, element) => {
      if (results.length >= maxItems) return false;

      const text = $(element).text().trim();
      if (text.length > 30) {
        results.push({
          type: 'content',
          text: text.substring(0, 300) + (text.length > 300 ? '...' : ''),
          selector: 'p',
          position: index,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Extract meaningful links
    $('a[href]').each((index, element) => {
      if (results.length >= maxItems) return false;

      const text = $(element).text().trim();
      const href = $(element).attr('href');

      if (text && href && text.length > 2 && !href.startsWith('#')) {
        try {
          const fullHref = href.startsWith('http') ? href : new URL(href, '${url}').href;
          results.push({
            type: 'link',
            text: text,
            href: fullHref,
            selector: 'a',
            position: index,
            timestamp: new Date().toISOString()
          });
        } catch (urlError) {
          // Skip invalid URLs
          console.warn(\`⚠️ Invalid URL: \${href}\`);
        }
      }
    });

    // Extract list items if we don't have enough content
    if (results.length < 10) {
      $('li').each((index, element) => {
        if (results.length >= maxItems) return false;

        const text = $(element).text().trim();
        if (text && text.length > 5) {
          results.push({
            type: 'list_item',
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            selector: 'li',
            position: index,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // Extract images if we need more content
    if (results.length < 15) {
      $('img[src]').each((index, element) => {
        if (results.length >= maxItems) return false;

        const src = $(element).attr('src');
        const alt = $(element).attr('alt') || '';
        const title = $(element).attr('title') || '';

        if (src && !src.includes('data:')) {
          try {
            const fullSrc = src.startsWith('http') ? src : new URL(src, '${url}').href;
            results.push({
              type: 'image',
              text: alt || title || 'Image',
              src: fullSrc,
              selector: 'img',
              position: index,
              timestamp: new Date().toISOString()
            });
          } catch (urlError) {
            // Skip invalid URLs
          }
        }
      });
    }

    console.log(\`✅ Basic extraction completed: \${results.length} items found\`);

    ${dbEnabled ? `
    // Save to database if enabled
    if (results.length > 0) {
      try {
        console.log('💾 Saving to PulseJournal database...');

        const supabaseClient = createClient(
          '${process.env.SUPABASE_URL}',
          '${process.env.SUPABASE_SERVICE_ROLE_KEY}'
        );

        const tableName = 'agent_${databaseConfig.table_name}';
        const dbRows = results.map((result, index) => ({
          text: result.text || '',
          href: result.href || null,
          src: result.src || null,
          selector: 'basic_extraction',
          tag_name: result.type || 'content',
          position: index,
          agent_name: 'Basic_Agent',
          user_id: 'user_${executionId.split('_')[1]}',
          extraction_timestamp: new Date().toISOString(),
          metadata: {
            url: '${url}',
            execution_id: '${executionId}',
            extraction_type: 'basic',
            original_data: result
          }
        }));

        const { error } = await supabaseClient
          .from(tableName)
          .insert(dbRows);

        if (error) {
          console.error('❌ Database save error:', error);
        } else {
          console.log(\`✅ Saved \${dbRows.length} items to database\`);
        }
      } catch (dbError) {
        console.error('❌ Database operation failed:', dbError);
      }
    }
    ` : ''}

    return {
      success: true,
      data: results,
      metadata: {
        url: '${url}',
        execution_time_ms: Date.now() - startTime,
        extraction_type: 'basic',
        html_length: html.length,
        ${dbEnabled ? `
        database_enabled: true,
        public_database: true,
        database_type: 'pulsejournal_public'
        ` : 'database_enabled: false'}
      }
    };

  } catch (error) {
    console.error('❌ Basic agent execution error:', error);
    throw error;
  }
}

// Execute and return result
module.exports = executeBasicAgent();
`;
  }

  /**
   * Execute JavaScript code in a sandboxed environment
   */
  async executeInSandbox(code, executionContext) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent execution timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      try {
        // Create sandbox context with required modules
        const sandbox = {
          require: (moduleName) => {
            // Whitelist allowed modules
            const allowedModules = {
              'node-fetch': fetch,
              'cheerio': cheerio,
              'console': console,
              '@supabase/supabase-js': { createClient }
            };

            if (allowedModules[moduleName]) {
              return allowedModules[moduleName];
            }

            throw new Error(`Module '${moduleName}' is not allowed in agent sandbox`);
          },
          console: {
            log: (...args) => console.log(`[${executionContext.executionId}]`, ...args),
            warn: (...args) => console.warn(`[${executionContext.executionId}]`, ...args),
            error: (...args) => console.error(`[${executionContext.executionId}]`, ...args)
          },
          module: { exports: {} },
          URL: URL,
          Date: Date,
          JSON: JSON,
          setTimeout: setTimeout,
          clearTimeout: clearTimeout,
          // Add execution context variables that the generated script needs
          url: executionContext.url,
          executionId: executionContext.executionId,
          databaseConfig: executionContext.databaseConfig || {},
          maxItems: executionContext.maxItems || 50,
          process: {
            env: {
              SUPABASE_URL: process.env.SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
            }
          }
        };

        // Create VM context
        const context = vm.createContext(sandbox);

        // Execute the code
        vm.runInContext(code, context, {
          timeout: this.config.timeout,
          displayErrors: true
        });

        // Get the result (the code should set module.exports to a Promise)
        const resultPromise = sandbox.module.exports;

        if (resultPromise && typeof resultPromise.then === 'function') {
          resultPromise
            .then(result => {
              clearTimeout(timeout);
              resolve(result);
            })
            .catch(error => {
              clearTimeout(timeout);
              reject(error);
            });
        } else {
          clearTimeout(timeout);
          resolve(resultPromise);
        }

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Log execution to database (following NewsCron SystemLogger pattern)
   */
  async logExecution(executionContext, status, result) {
    try {
      // Use minimal SystemLogger-compatible approach
      const logData = {
        script_name: `agent_${executionContext.agentName}`,
        status: status,
        started_at: executionContext.startTime.toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: Math.floor(executionContext.metrics.execution_time_ms / 1000),
        // Store all agent-specific data in metadata to avoid schema conflicts
        metadata: {
          execution_id: executionContext.executionId,
          url: executionContext.url,
          user_id: executionContext.user?.id,
          agent_config: executionContext.config,
          execution_metrics: executionContext.metrics,
          result_summary: result ? {
            items_extracted: result.data?.length || 0,
            success: result.success,
            error: result.error || null
          } : null
        }
      };

      const { error } = await this.supabase
        .from('system_execution_logs')
        .insert(logData);

      if (error) {
        console.error('❌ Error logging execution:', error);
      } else {
        console.log(`📊 Execution logged: ${executionContext.executionId} (${status})`);
      }

    } catch (error) {
      console.error('❌ Error in logExecution:', error);
    }
  }

  /**
   * Get execution statistics and health check
   */
  getHealth() {
    return {
      service: 'AgentExecutor',
      status: 'healthy',
      config: this.config,
      timestamp: new Date().toISOString(),
      capabilities: [
        'AI-generated JavaScript execution',
        'Sandboxed execution environment',
        'SystemLogger integration',
        'Supabase data persistence',
        'Configurable timeouts and limits'
      ]
    };
  }

  /**
   * Execute a debug script directly for testing purposes
   * @param {Object} debugConfig - Debug configuration
   * @param {Object} user - User object
   */
  async executeDebugScript(debugConfig, user) {
    const executionId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log(`🐛 Starting debug script execution - ID: ${executionId}`);
    console.log(`🎯 URL: ${debugConfig.url}`);

    // Initialize logs array to capture console output
    const capturedLogs = [];

    try {
      // Create VM sandbox with debug-specific context
      const sandbox = {
        url: debugConfig.url,
        executionId,
        maxItems: debugConfig.maxItems || 10,
        process: {
          env: {
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
          }
        },
        // Enhanced console for debug mode
        console: {
          log: (...args) => {
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            capturedLogs.push(`[LOG] ${message}`);
            console.log(`[DEBUG-${executionId}]`, ...args);
          },
          error: (...args) => {
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            capturedLogs.push(`[ERROR] ${message}`);
            console.error(`[DEBUG-${executionId}]`, ...args);
          },
          warn: (...args) => {
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            capturedLogs.push(`[WARN] ${message}`);
            console.warn(`[DEBUG-${executionId}]`, ...args);
          }
        },
        Date,
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        parseInt,
        parseFloat,
        isNaN,
        setTimeout: (fn, delay) => {
          capturedLogs.push(`[INFO] setTimeout called with delay: ${delay}ms`);
          return setTimeout(fn, Math.min(delay, 5000)); // Max 5 second timeout
        },
        document: null, // Will be set when page loads
        window: null    // Will be set when page loads
      };

      // Launch browser and navigate to page
      const { browser, page } = await this.launchBrowser();

      try {
        capturedLogs.push(`[INFO] Navigating to: ${debugConfig.url}`);

        // Enhanced navigation with better error handling
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setExtraHTTPHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        });

        const response = await page.goto(debugConfig.url, {
          waitUntil: 'domcontentloaded',
          timeout: debugConfig.timeout || 30000
        });

        if (!response.ok()) {
          throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
        }

        // Check for bot protection
        const content = await page.content();
        if (content.length < 500) {
          capturedLogs.push(`[WARN] Page content very short (${content.length} chars) - possible bot protection`);
        }

        if (content.includes('incapsula') || content.includes('imperva') || content.includes('Access denied')) {
          capturedLogs.push(`[ERROR] Bot protection detected`);
          throw new Error('Bot protection detected - try a different approach or URL');
        }

        capturedLogs.push(`[INFO] Page loaded successfully (${content.length} chars)`);

        // Wait for page to fully load
        await page.waitForTimeout(2000);

        // Inject our custom script execution function
        const scriptResult = await page.evaluate((script, logs) => {
          try {
            // Create a safe evaluation environment
            const safeEval = new Function('console', 'document', 'window', script);

            // Enhanced console for capturing output
            const debugConsole = {
              log: (...args) => {
                const message = args.map(arg =>
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                logs.push(`[SCRIPT-LOG] ${message}`);
                return message;
              },
              error: (...args) => {
                const message = args.map(arg =>
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                logs.push(`[SCRIPT-ERROR] ${message}`);
                return message;
              },
              warn: (...args) => {
                const message = args.map(arg =>
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                logs.push(`[SCRIPT-WARN] ${message}`);
                return message;
              }
            };

            // Execute the user script
            const result = safeEval(debugConsole, document, window);

            logs.push(`[INFO] Script executed successfully`);
            logs.push(`[INFO] Result type: ${typeof result}`);

            if (Array.isArray(result)) {
              logs.push(`[INFO] Returned array with ${result.length} items`);
            } else if (result === null || result === undefined) {
              logs.push(`[WARN] Script returned ${result}`);
            }

            return {
              success: true,
              data: result,
              type: typeof result,
              isArray: Array.isArray(result),
              length: Array.isArray(result) ? result.length : undefined
            };

          } catch (error) {
            logs.push(`[ERROR] Script execution failed: ${error.message}`);
            logs.push(`[ERROR] Stack: ${error.stack}`);
            return {
              success: false,
              error: error.message,
              stack: error.stack
            };
          }
        }, debugConfig.script, capturedLogs);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        capturedLogs.push(`[INFO] Debug execution completed in ${executionTime}ms`);

        if (scriptResult.success) {
          return {
            success: true,
            data: {
              items: Array.isArray(scriptResult.data) ? scriptResult.data : [scriptResult.data],
              extractionLogic: debugConfig.script,
              raw_result: scriptResult.data
            },
            logs: capturedLogs,
            metrics: {
              execution_time_ms: executionTime,
              items_extracted: Array.isArray(scriptResult.data) ? scriptResult.data.length : 1,
              script_length: debugConfig.script.length,
              url_length: debugConfig.url.length
            },
            status: 'completed'
          };
        } else {
          return {
            success: false,
            error: scriptResult.error || 'Script execution failed',
            details: scriptResult.stack,
            logs: capturedLogs,
            metrics: {
              execution_time_ms: executionTime,
              items_extracted: 0
            },
            status: 'failed'
          };
        }

      } finally {
        if (browser) {
          await browser.close();
          capturedLogs.push(`[INFO] Browser closed`);
        }
      }

    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      capturedLogs.push(`[ERROR] Debug execution failed: ${error.message}`);
      console.error(`❌ Debug script execution failed for ${debugConfig.url}:`, error);

      return {
        success: false,
        error: error.message,
        details: error.stack,
        logs: capturedLogs,
        metrics: {
          execution_time_ms: executionTime,
          items_extracted: 0
        },
        status: 'error'
      };
    }
  }

  /**
   * Execute agent using WebAgent (configured mode, not fallback)
   */
  async executeWithWebAgent({ url, extraction_target, site_structure, maxItems, executionId, executionType, startTime }) {
    console.log('🌐 Executing with WebAgent (configured mode)');
    
    const webAgentResult = await this.fallbackToWebAgent({
      url,
      extraction_target,
      site_structure,
      maxItems
    });
    
    return {
      ...webAgentResult,
      executionId,
      executionType,
      execution_time_ms: Date.now() - startTime,
      execution_mode: 'webagent',
      configured_mode: true, // No es fallback, fue configurado así
      metadata: {
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agent_name: extraction_target,
        mode: 'webagent'
      },
      status: webAgentResult.success ? 'completed' : 'completed_with_issues'
    };
  }

  /**
   * Fallback to WebAgent when anti-bot is detected
   */
  async fallbackToWebAgent({ url, extraction_target, site_structure, maxItems }) {
    console.log('🌐 Calling WebAgent for anti-bot bypass...');
    
    // Determinar URL de WebAgent
    const WEBAGENT_URL = process.env.WEBAGENT_URL || 
      (process.env.DOCKER_ENV === 'true' ? 'http://webagent:8787' : 'http://127.0.0.1:8787');
    
    console.log(`🔗 WebAgent URL configurada: ${WEBAGENT_URL}`);
    
    // Verificar que WebAgent esté disponible
    try {
      const healthCheck = await fetch(`${WEBAGENT_URL}/health`, { timeout: 3000 });
      if (!healthCheck.ok) {
        throw new Error(`WebAgent health check falló: ${healthCheck.status}`);
      }
      console.log('✅ WebAgent está disponible');
    } catch (healthError) {
      console.error('❌ WebAgent NO está disponible:', healthError.message);
      return {
        success: false,
        items_extracted: 0,
        data: { items: [] },
        logs: [`WebAgent no está disponible: ${healthError.message}. Asegúrate de que esté corriendo en ${WEBAGENT_URL}`],
        error: `WebAgent no disponible en ${WEBAGENT_URL}`
      };
    }
    
    try {
      // Intentar endpoint de scraping de WebAgent
      const endpoints = [
        `${WEBAGENT_URL}/scrape/agent`,
        `${WEBAGENT_URL}/explore/summarize`
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Intentando WebAgent endpoint: ${endpoint}`);
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url,
              goal: extraction_target,
              maxSteps: 10, // Más pasos para permitir esperas
              screenshot: false,
              site_structure: site_structure || null,
              // Configuración anti-bot mejorada
              waitForNavigation: true,
              waitTimeout: 15000, // 15 segundos de espera
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }),
            timeout: 90000 // 90 segundos para dar tiempo a Incapsula
          });

          if (!response.ok) {
            console.log(`⚠️ WebAgent endpoint ${endpoint} falló con status ${response.status}`);
            continue;
          }

          const result = await response.json();
          console.log('✅ WebAgent respondió exitosamente');
          console.log('📄 Respuesta de WebAgent:', JSON.stringify(result).slice(0, 500));
          
          // Transformar resultado de WebAgent al formato esperado
          const extractedItems = this.parseWebAgentResult(result, maxItems);
          console.log(`📊 Items extraídos por parseWebAgentResult: ${extractedItems.length}`);
          
          return {
            success: extractedItems.length > 0,
            items_extracted: extractedItems.length,
            data: { items: extractedItems },
            logs: [`WebAgent extrajo ${extractedItems.length} items usando navegador real`],
            page_info: {
              title: 'Extraído con WebAgent (navegador real)',
              url: url,
              size_bytes: JSON.stringify(result).length
            },
            diagnostic: {
              antibot_bypassed: true,
              method: 'webagent_playwright'
            }
          };

        } catch (endpointError) {
          console.log(`⚠️ Error con endpoint ${endpoint}:`, endpointError.message);
          continue;
        }
      }

      throw new Error('Todos los endpoints de WebAgent fallaron');

    } catch (error) {
      console.error('❌ WebAgent fallback error:', error.message);
      return {
        success: false,
        items_extracted: 0,
        data: { items: [] },
        logs: [`WebAgent falló: ${error.message}`],
        error: `No se pudo usar WebAgent: ${error.message}`
      };
    }
  }

  /**
   * Parse WebAgent result and extract structured data
   */
  parseWebAgentResult(webAgentResult, maxItems = 20) {
    const items = [];
    
    try {
      // WebAgent puede retornar en diferentes formatos
      if (webAgentResult.content) {
        // Formato: { content: { text, links, ... } }
        const content = webAgentResult.content;
        
        // Extraer links como items
        if (content.links && Array.isArray(content.links)) {
          content.links.slice(0, maxItems).forEach((link, index) => {
            items.push({
              index: index + 1,
              titulo: link.text || 'Sin título',
              enlace: link.href,
              tipo: 'enlace',
              source: 'webagent'
            });
          });
        }
        
        // Extraer elementos de navegación
        if (content.navElements && Array.isArray(content.navElements)) {
          content.navElements.slice(0, Math.max(0, maxItems - items.length)).forEach((nav, index) => {
            items.push({
              index: items.length + 1,
              titulo: nav.text || 'Sin título',
              enlace: nav.href,
              tipo: 'navegación',
              source: 'webagent'
            });
          });
        }
      } else if (webAgentResult.data && Array.isArray(webAgentResult.data)) {
        // Formato: { data: [...] }
        webAgentResult.data.slice(0, maxItems).forEach((item, index) => {
          items.push({
            ...item,
            index: index + 1,
            source: 'webagent'
          });
        });
      } else if (webAgentResult.steps && Array.isArray(webAgentResult.steps)) {
        // Formato con steps de navegación
        webAgentResult.steps.forEach((step, index) => {
          if (step.result) {
            items.push({
              index: index + 1,
              descripcion: step.action,
              resultado: JSON.stringify(step.result).slice(0, 200),
              source: 'webagent'
            });
          }
        });
      }
      
      console.log(`📊 Parseados ${items.length} items de resultado de WebAgent`);
      
    } catch (parseError) {
      console.error('❌ Error parseando resultado de WebAgent:', parseError.message);
    }
    
    return items;
  }
}

module.exports = { AgentExecutor };