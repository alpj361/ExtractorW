const dotenv = require('dotenv');
dotenv.config();

async function testGPT4WebSearch() {
  console.log('🧪 PRUEBA: GPT-4 Web Search Fix');
  console.log('================================');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY no configurada');
    return;
  }
  
  const name = 'Diego España';
  
  console.log(`🔍 Probando GPT-4 Web Search para: ${name}`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        messages: [
          {
            role: 'user',
            content: `Encuentra el handle de Twitter/X de ${name}. Busca en Google usando términos como: "${name}" site:twitter.com, "${name}" @, "${name}" periodista Twitter, menciones de ${name} en Twitter. DEBES encontrar su handle @username. Si no lo encuentras en la primera búsqueda, intenta con variaciones del nombre. Devuelve solo el @handle sin explicaciones.`
          }
        ],
        web_search_options: {
          user_location: {
            type: "approximate",
            approximate: {
              country: "GT",
              city: "Guatemala City"
            }
          }
        }
      })
    });

    console.log(`📊 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Respuesta exitosa:`);
      console.log(`📄 Content:`, data.choices[0].message.content);
      console.log(`🔍 Model:`, data.model);
      console.log(`💰 Usage:`, data.usage);
    } else {
      const errorText = await response.text();
      console.log(`❌ Error:`, errorText);
    }
    
  } catch (error) {
    console.log(`❌ Exception:`, error.message);
  }
}

if (require.main === module) {
  testGPT4WebSearch()
    .then(() => {
      console.log('\n✅ Prueba completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error en prueba:', error);
      process.exit(1);
    });
} 