require('dotenv').config();
const { geminiChat } = require('./server/services/geminiHelper');

/**
 * Test específico para verificar la optimización de query de deportes guatemaltecos
 */
async function testDeportesQueryOptimization() {
  console.log('🏈 Prueba de optimización de query deportiva\n');

  // Verificar que la API key esté configurada
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY no está configurada en .env');
    return;
  }

  try {
    // Simular el prompt exacto que Laura usará
    const sysPrompt = `
Eres Laura, experta en redes sociales guatemaltecas y análisis de tendencias digitales.

Dispones de herramientas:
- nitter_context(q, location, limit): Análisis de conversaciones y tendencias en redes sociales
- nitter_profile(username, limit): Monitoreo de usuarios específicos importantes  
- perplexity_search(query): Búsqueda web y noticias actualizadas

Tu objetivo es producir un JSON con el plan de acción y seguimiento necesario.

INSTRUCCIONES CRÍTICAS:
1. RESPONDE **solo** con JSON válido, sin explicaciones extra.
2. NO agregues texto antes o después del JSON.
3. Asegúrate de que el JSON sea válido y parseable.

Formato de respuesta:
{
  "plan": {
    "action": "direct_execution|needs_clarification",
    "tool": "nitter_context|nitter_profile|perplexity_search",
    "args": {...},
    "reasoning": "Por qué elegiste esta herramienta y parámetros"
  },
  "follow_up": "pregunta_para_el_usuario_si_necesitas_aclaración_o_null",
  "thought": "análisis_interno_del_contexto_y_estrategia"
}

EJEMPLOS ESPECÍFICOS:

Input: "reaccion sobre deportes guatemaltecos"
Output: {
  "plan": {
    "action": "direct_execution",
    "tool": "nitter_context",
    "args": {"q": "deportes Guatemala futbol selección nacional", "location": "guatemala", "limit": 20},
    "reasoning": "Optimizo la query de 'reaccion sobre deportes guatemaltecos' a términos más efectivos para redes sociales: deportes + Guatemala + futbol + selección, que son más probables de encontrar en tweets"
  },
  "follow_up": null,
  "thought": "Usuario busca reacciones sobre deportes guatemaltecos, optimizo query para capturar más conversaciones relevantes usando términos populares en redes sociales"
}
`;

    const userBlock = `Intent: reaccion sobre deportes guatemaltecos`;

    const messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userBlock }
    ];

    console.log('📋 Enviando query: "reaccion sobre deportes guatemaltecos"');
    console.log('⏱️  Esperando respuesta de Gemini...\n');

    const startTime = Date.now();
    const response = await geminiChat(messages, { 
      temperature: 0.2,
      maxTokens: 1024 
    });
    const endTime = Date.now();

    console.log('✅ Respuesta recibida:');
    console.log(response);
    console.log(`\n⏱️  Latencia: ${endTime - startTime}ms`);

    // Limpiar respuesta y parsear como JSON
    try {
      // Limpiar la respuesta de posibles formato markdown
      let cleanedResponse = response.trim();
      
      // Remover bloques de código markdown si existen
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('\n🧹 Respuesta limpia:');
      console.log(cleanedResponse);
      
      const parsed = JSON.parse(cleanedResponse);
      console.log('\n🧠 Plan parseado:');
      console.log(JSON.stringify(parsed, null, 2));

      // Verificar que optimizó la query
      if (parsed.plan && parsed.plan.args && parsed.plan.args.q) {
        const originalQuery = 'reaccion sobre deportes guatemaltecos';
        const optimizedQuery = parsed.plan.args.q;
        
        console.log('\n🔍 Análisis de optimización:');
        console.log(`   Original: "${originalQuery}"`);
        console.log(`   Optimizada: "${optimizedQuery}"`);
        
        // Verificar que la query optimizada es diferente y más efectiva
        if (optimizedQuery !== originalQuery) {
          console.log('✅ Laura optimizó correctamente la query');
          
          // Verificar que contiene términos más efectivos
          const effectiveTerms = ['deportes', 'futbol', 'selección', 'Guatemala'];
          const containsEffectiveTerms = effectiveTerms.some(term => 
            optimizedQuery.toLowerCase().includes(term.toLowerCase())
          );
          
          if (containsEffectiveTerms) {
            console.log('✅ La query optimizada contiene términos más efectivos');
          } else {
            console.log('⚠️  La query optimizada podría ser más efectiva');
          }
        } else {
          console.log('⚠️  Laura no optimizó la query (mismo texto)');
        }
        
        // Verificar razonamiento
        if (parsed.plan.reasoning) {
          console.log('\n💭 Razonamiento de Laura:');
          console.log(`   "${parsed.plan.reasoning}"`);
        }
        
        // Verificar pensamiento interno
        if (parsed.thought) {
          console.log('\n🧠 Pensamiento interno:');
          console.log(`   "${parsed.thought}"`);
        }
        
      } else {
        console.log('❌ No se encontró query optimizada en la respuesta');
      }

    } catch (parseError) {
      console.log('❌ Error al parsear JSON:', parseError.message);
      console.log('📄 Respuesta raw:', response);
    }

    console.log('\n🎉 Prueba completada');

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testDeportesQueryOptimization()
    .then(() => {
      console.log('\n✅ Prueba finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { testDeportesQueryOptimization };