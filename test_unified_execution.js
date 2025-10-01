#!/usr/bin/env node

/**
 * Test script for the unified agent execution system
 *
 * This script tests:
 * 1. Debug script execution
 * 2. Agent configuration execution
 * 3. Error handling
 * 4. Different execution types
 */

const { AgentExecutor } = require('./server/services/agentExecutor');

// Initialize executor
const executor = new AgentExecutor();

async function testUnifiedExecution() {
  console.log('🧪 Starting Unified Execution Tests...\n');

  // Test 1: Debug script execution
  console.log('📝 Test 1: Debug Script Execution');
  try {
    const debugResult = await executor.executeUnified({
      url: 'https://example.com',
      script: `
        const items = [];
        const title = document.querySelector('h1')?.textContent;
        if (title) {
          items.push({
            title: title,
            url: url,
            extracted_at: new Date().toISOString()
          });
        }
        console.log('Found title:', title);
        return items;
      `,
      maxItems: 10,
      executionType: 'debug',
      agentName: 'Test Debug Agent',
      timeout: 15000
    });

    console.log('✅ Debug Result:', {
      success: debugResult.success,
      items: debugResult.data?.items?.length || 0,
      execution_time: debugResult.execution_time_ms + 'ms'
    });

    if (!debugResult.success) {
      console.log('❌ Debug Error:', debugResult.error);
      console.log('🔧 Troubleshooting:', debugResult.troubleshooting);
    }

  } catch (error) {
    console.log('❌ Debug Test Failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Agent configuration execution
  console.log('🤖 Test 2: Agent Configuration Execution');
  try {
    const agentResult = await executor.executeUnified({
      url: 'https://example.com',
      config: {
        extractionLogic: `
          const items = [];
          const headings = document.querySelectorAll('h1, h2, h3');
          headings.forEach((heading, index) => {
            items.push({
              text: heading.textContent,
              type: heading.tagName.toLowerCase(),
              index: index,
              extracted_at: new Date().toISOString()
            });
          });
          console.log('Found headings:', headings.length);
          return items;
        `,
        generated: false
      },
      maxItems: 20,
      executionType: 'agent',
      agentName: 'Test Config Agent',
      timeout: 15000
    });

    console.log('✅ Agent Result:', {
      success: agentResult.success,
      items: agentResult.data?.items?.length || 0,
      execution_time: agentResult.execution_time_ms + 'ms'
    });

    if (!agentResult.success) {
      console.log('❌ Agent Error:', agentResult.error);
      console.log('🔧 Troubleshooting:', agentResult.troubleshooting);
    }

  } catch (error) {
    console.log('❌ Agent Test Failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Error handling with invalid script
  console.log('💥 Test 3: Error Handling');
  try {
    const errorResult = await executor.executeUnified({
      url: 'https://example.com',
      script: `
        // This script has intentional errors
        const items = [];
        undefinedVariable.doSomething(); // This will cause ReferenceError
        return items;
      `,
      maxItems: 10,
      executionType: 'debug',
      agentName: 'Test Error Agent',
      timeout: 15000
    });

    console.log('📊 Error Test Result:', {
      success: errorResult.success,
      error: errorResult.error,
      category: errorResult.error_details?.category
    });

    if (errorResult.troubleshooting) {
      console.log('🔧 Troubleshooting Tips:');
      Object.entries(errorResult.troubleshooting).forEach(([category, tips]) => {
        console.log(`  ${category}:`);
        tips.forEach(tip => console.log(`    - ${tip}`));
      });
    }

  } catch (error) {
    console.log('❌ Error Test Failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Invalid URL handling
  console.log('🌐 Test 4: Invalid URL Handling');
  try {
    const invalidUrlResult = await executor.executeUnified({
      url: 'https://this-url-does-not-exist-12345.com',
      script: `
        const items = [];
        items.push({ test: 'This should not execute' });
        return items;
      `,
      maxItems: 10,
      executionType: 'debug',
      agentName: 'Test Invalid URL',
      timeout: 10000
    });

    console.log('📊 Invalid URL Result:', {
      success: invalidUrlResult.success,
      error: invalidUrlResult.error,
      category: invalidUrlResult.error_details?.category
    });

  } catch (error) {
    console.log('❌ Invalid URL Test Failed:', error.message);
  }

  console.log('\n🎉 Unified Execution Tests Completed!\n');
}

// Run tests
if (require.main === module) {
  testUnifiedExecution().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testUnifiedExecution };