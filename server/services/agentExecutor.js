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
        database_operations: 0,
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

    // Step 1: Fetch the page with enhanced headers
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

    console.log('📄 Page loaded, HTML length:', html.length);

    // Step 2: Apply AI-generated selectors with fallbacks
    const selectors = ${JSON.stringify(selectorsArray)};
    const maxItems = ${maxItems};

    console.log('🎯 Processing selectors:', selectors.slice(0, 3));
    console.log('📄 Page title:', $('title').text() || 'No title found');
    console.log('📊 Total page elements:', $('*').length);

    // If no AI selectors work, use these fallback selectors
    const fallbackSelectors = [
      'h1, h2, h3, h4, h5, h6',           // Headlines
      'p',                                // Paragraphs
      'a[href]',                         // Links
      'img[src]',                        // Images
      'article',                         // Article elements
      '.content, .main, .article',       // Common content classes
      'li',                              // List items
      '[data-testid*="content"]',        // Test IDs
      'span, div'                        // Generic elements (last resort)
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

        elements.each((index, element) => {
          if (results.length >= maxItems) return false;

          const $el = $(element);
          const text = $el.text().trim();
          const href = $el.attr('href');
          const src = $el.attr('src');

          // Only add elements with meaningful content
          if ((text && text.length > 3) || href || src) {
            results.push({
              selector: trimmedSelector,
              text: text || '',
              href: href ? (href.startsWith('http') ? href : new URL(href, '${url}').href) : null,
              src: src ? (src.startsWith('http') ? src : new URL(src, '${url}').href) : null,
              tagName: element.tagName,
              position: index,
              timestamp: new Date().toISOString()
            });
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

    console.log(\`✅ Extraction completed: \${results.length} items found\`);

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
              'console': console
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
          clearTimeout: clearTimeout
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
      const logData = {
        script_name: `agent_${executionContext.agentName}`,
        execution_id: executionContext.executionId,
        status: status,
        started_at: executionContext.startTime.toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: Math.floor(executionContext.metrics.execution_time_ms / 1000),
        metadata: {
          url: executionContext.url,
          user_id: executionContext.user?.id,
          agent_config: executionContext.config,
          execution_metrics: executionContext.metrics,
          result_summary: result ? {
            items_extracted: result.data?.length || 0,
            success: result.success,
            error: result.error || null
          } : null
        },
        ...executionContext.metrics
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
}

module.exports = { AgentExecutor };