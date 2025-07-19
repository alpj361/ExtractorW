// Test script para verificar detección LLM vs regex
const { spawn } = require('child_process');

console.log('🧪 Testing LLM User Detection vs Regex...\n');

const testCases = [
  {
    query: "Ministro de Salud",
    expected: "person_role",
    description: "Debería buscar quién es el ministro actual"
  },
  {
    query: "Ministerio de Salud", 
    expected: "institution",
    description: "Debería buscar cuenta oficial del ministerio"
  },
  {
    query: "Congreso",
    expected: "institution", 
    description: "Debería buscar @CongresoGt"
  },
  {
    query: "Presidente",
    expected: "person_role",
    description: "Debería buscar quién es el presidente actual"
  },
  {
    query: "Pia Flores",
    expected: "specific_person",
    description: "Debería buscar @PiaLaPeriodista"
  }
];

async function testQuery(query) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing: "${query}"`);
    console.log(`📋 Expected: ${testCases.find(t => t.query === query)?.expected}`);
    console.log(`📝 Description: ${testCases.find(t => t.query === query)?.description}`);
    
    const curl = spawn('curl', [
      '-X', 'POST',
      'http://localhost:3000/api/agentes/orquestar',
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({
        query: `buscame información sobre ${query}`,
        user: { id: 'test_user' }
      })
    ]);
    
    let output = '';
    let errorOutput = '';
    
    curl.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    curl.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    curl.on('close', (code) => {
      if (code !== 0) {
        console.log(`❌ Error: ${errorOutput}`);
        resolve({ query, success: false, error: errorOutput });
      } else {
        try {
          const response = JSON.parse(output);
          console.log(`✅ Response received`);
          resolve({ query, success: true, response });
        } catch (e) {
          console.log(`❌ Parse error: ${e.message}`);
          resolve({ query, success: false, error: e.message });
        }
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      curl.kill();
      console.log(`⏰ Timeout for query: ${query}`);
      resolve({ query, success: false, error: 'Timeout' });
    }, 30000);
  });
}

async function runTests() {
  console.log('🚀 Starting LLM Detection Tests...\n');
  
  for (const testCase of testCases) {
    const result = await testQuery(testCase.query);
    console.log(`\n📊 Result for "${testCase.query}":`, result.success ? 'SUCCESS' : 'FAILED');
    
    if (result.success) {
      console.log('✅ Test completed successfully');
    } else {
      console.log('❌ Test failed:', result.error);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  console.log('\n🎯 All tests completed!');
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testQuery, runTests };