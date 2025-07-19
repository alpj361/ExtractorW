// Test directo de nitter_profile para verificar si el problema está en nuestro wrapper
const mcpService = require('./server/services/mcp');

async function testNitterProfileDirect() {
  console.log('🧪 Probando nitter_profile directamente con @PiaLaPeriodista...\n');
  
  const testUser = { id: 'test_user_direct' };
  
  try {
    console.log('📊 Ejecutando nitter_profile...');
    const result = await mcpService.executeTool('nitter_profile', {
      username: 'PiaLaPeriodista',
      limit: 20, // Parámetro correcto según MCP
      include_retweets: false, // Parámetro correcto según MCP  
      include_replies: false // Parámetro correcto según MCP
    }, testUser);
    
    console.log('\n✅ Resultado:');
    console.log(`Success: ${result.success}`);
    console.log(`Tweets obtenidos: ${result.tweets?.length || 0}`);
    console.log(`Profile data:`, result.profile ? 'Yes' : 'No');
    
    if (result.tweets && result.tweets.length > 0) {
      console.log('\n📝 Primeros 3 tweets:');
      result.tweets.slice(0, 3).forEach((tweet, index) => {
        console.log(`${index + 1}. [${tweet.date}] ${tweet.text?.substring(0, 100)}...`);
      });
    }
    
    if (result.profile) {
      console.log('\n👤 Perfil:');
      console.log(`Username: ${result.profile.username}`);
      console.log(`Display name: ${result.profile.displayname}`);
      console.log(`Followers: ${result.profile.followers_count}`);
      console.log(`Following: ${result.profile.following_count}`);
      console.log(`Bio: ${result.profile.description?.substring(0, 100)}...`);
    }
    
    if (!result.success) {
      console.log('\n❌ Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando test:', error);
  }
}

// Ejecutar el test
testNitterProfileDirect().catch(console.error);