require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Usar las mismas credenciales que sabemos que funcionan
const supabase = createClient(
  'https://qqshdccpmypelhmyqnut.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testDirectExtraction() {
  const projectId = '9d2cd5ed-d46c-4f07-b62b-6907084806d0';
  const codexItemId = '9c10341f-f627-4a94-ac26-3a8610793d04';
  
  console.log('🧪 PRUEBA DIRECTA DE EXTRACCIÓN DE CAPTURADOS\n');
  
  try {
    // 1. Obtener la transcripción directamente
    console.log('1. Obteniendo transcripción...');
    const { data: codexItem, error: codexError } = await supabase
      .from('codex_items')
      .select('audio_transcription')
      .eq('id', codexItemId)
      .single();

    if (codexError) {
      console.error('❌ Error obteniendo codex_item:', codexError);
      return;
    }

    if (!codexItem || !codexItem.audio_transcription) {
      console.error('❌ No se encontró transcripción');
      return;
    }

    console.log(`✅ Transcripción encontrada: ${codexItem.audio_transcription.length} caracteres`);
    console.log(`📄 Primeros 200 chars: ${codexItem.audio_transcription.substring(0, 200)}...`);

    // 2. Probar extracción con Gemini
    console.log('\n2. Probando extracción con Gemini...');
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY no configurada');
      return;
    }

    const prompt = `Eres un sistema experto en análisis de transcripciones de audios de investigaciones sobre contrataciones públicas en Guatemala. Analiza la siguiente transcripción en español y EXTRAERÁS TODA la información sobre hallazgos que implique posible corrupción (llamados "capturados").

1. Devuelve la respuesta **exclusivamente** como un ARRAY JSON. **No** incluyas comentarios, claves adicionales ni formateo Markdown.
2. Cada elemento del array debe tener **exactamente** estas claves (usa null si no se encontró valor):
   - entity (string)
   - amount (number)
   - currency (string)
   - city (string)
   - department (string)
   - discovery (string)
   - source (string)
   - start_date (string, formato YYYY-MM-DD o null)
   - duration_days (number)
   - description (string)
3. La clave **source** debe ser un extracto máximo de 120 caracteres que cite la parte de la transcripción donde se menciona el hallazgo.
4. La clave **description** es un resumen conciso (≤ 150 caracteres).
5. Si no hay capturados, devuelve un array vacío [].

TRANSCRIPCIÓN A ANALIZAR:
"""
${codexItem.audio_transcription}
"""`;

    const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    console.log('🤖 Respuesta cruda de Gemini:');
    console.log(text);

    // Limpiar respuesta
    text = text.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        console.log(`\n✅ Cards extraídas: ${parsed.length}`);
        console.log('📋 Cards:', JSON.stringify(parsed, null, 2));

        if (parsed.length > 0) {
          // 3. Intentar insertar en la base de datos
          console.log('\n3. Insertando en base de datos...');
          
          const insertData = parsed.map(card => ({
            ...card,
            project_id: projectId,
            codex_item_id: codexItemId
          }));

          const { data: inserted, error: insertError } = await supabase
            .from('capturado_cards')
            .insert(insertData)
            .select();

          if (insertError) {
            console.error('❌ Error insertando:', insertError);
          } else {
            console.log(`✅ Insertadas ${inserted.length} cards exitosamente`);
          }
        }
      } else {
        console.error('❌ La respuesta no es un array');
      }
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError);
      console.log('📄 Texto a parsear:', text);
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

testDirectExtraction().then(() => {
  console.log('\n✅ Prueba completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 