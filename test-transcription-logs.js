const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTranscriptionLogs() {
  console.log('🔍 Verificando logs de transcripción de audio...\n');
  
  try {
    // 1. Verificar estructura de tabla usage_logs
    console.log('1️⃣ Verificando estructura de tabla usage_logs...');
    
    const { data: sampleData, error: sampleError } = await supabase
      .from('usage_logs')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error accediendo a usage_logs:', sampleError.message);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('✅ Tabla usage_logs accesible');
      console.log('📋 Columnas disponibles:', Object.keys(sampleData[0]));
      
      // Verificar si existen las columnas específicas para transcripción
      const hasTokensConsumed = 'tokens_consumed' in sampleData[0];
      const hasDollarsConsumed = 'dollars_consumed' in sampleData[0];
      
      console.log(`📊 tokens_consumed: ${hasTokensConsumed ? '✅ Existe' : '❌ No existe'}`);
      console.log(`💰 dollars_consumed: ${hasDollarsConsumed ? '✅ Existe' : '❌ No existe'}`);
    }
    
    // 2. Buscar logs específicos de transcripción
    console.log('\n2️⃣ Buscando logs de transcripción...');
    
    const { data: transcriptionLogs, error: transcriptionError } = await supabase
      .from('usage_logs')
      .select('*')
      .or('operation.ilike.%transcription%,operation.ilike.%upload%,operation.ilike.%from-codex%')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (transcriptionError) {
      console.error('❌ Error buscando logs de transcripción:', transcriptionError.message);
    } else {
      console.log(`📝 Logs de transcripción encontrados: ${transcriptionLogs.length}`);
      
      if (transcriptionLogs.length > 0) {
        console.log('\n📋 Últimos logs de transcripción:');
        transcriptionLogs.forEach((log, index) => {
          console.log(`\n${index + 1}. ${log.operation} - ${log.user_email}`);
          console.log(`   Timestamp: ${log.timestamp}`);
          console.log(`   Créditos: ${log.credits_consumed}`);
          if (log.tokens_consumed) console.log(`   Tokens: ${log.tokens_consumed}`);
          if (log.dollars_consumed) console.log(`   Costo: $${log.dollars_consumed}`);
          if (log.request_params) {
            const params = typeof log.request_params === 'string' 
              ? JSON.parse(log.request_params) 
              : log.request_params;
            console.log(`   Path: ${params.path || 'N/A'}`);
            console.log(`   Success: ${params.success || 'N/A'}`);
          }
        });
      } else {
        console.log('⚠️ No se encontraron logs de transcripción');
      }
    }
    
    // 3. Verificar logs recientes (últimas 24 horas)
    console.log('\n3️⃣ Verificando logs recientes (últimas 24 horas)...');
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentLogs, error: recentError } = await supabase
      .from('usage_logs')
      .select('operation, user_email, credits_consumed, tokens_consumed, dollars_consumed, timestamp')
      .gte('timestamp', yesterday)
      .order('timestamp', { ascending: false });
    
    if (recentError) {
      console.error('❌ Error consultando logs recientes:', recentError.message);
    } else {
      console.log(`📊 Total logs últimas 24h: ${recentLogs.length}`);
      
      // Agrupar por operación
      const operationCounts = {};
      recentLogs.forEach(log => {
        operationCounts[log.operation] = (operationCounts[log.operation] || 0) + 1;
      });
      
      console.log('\n📈 Distribución por operación:');
      Object.entries(operationCounts).forEach(([operation, count]) => {
        console.log(`   ${operation}: ${count} logs`);
      });
    }
    
    // 4. Verificar si existen logs con tokens/dollars
    console.log('\n4️⃣ Verificando logs con métricas de tokens/costo...');
    
    const { data: metricsLogs, error: metricsError } = await supabase
      .from('usage_logs')
      .select('*')
      .not('tokens_consumed', 'is', null)
      .limit(5);
    
    if (metricsError) {
      if (metricsError.message.includes('tokens_consumed')) {
        console.log('❌ La columna tokens_consumed NO existe en la tabla usage_logs');
        console.log('💡 Necesitas ejecutar la migración para agregar estas columnas');
      } else {
        console.error('❌ Error consultando métricas:', metricsError.message);
      }
    } else {
      console.log(`📊 Logs con métricas de tokens: ${metricsLogs.length}`);
      if (metricsLogs.length > 0) {
        console.log('\n📋 Ejemplos de logs con métricas:');
        metricsLogs.forEach((log, index) => {
          console.log(`${index + 1}. ${log.operation} - Tokens: ${log.tokens_consumed}, Costo: $${log.dollars_consumed}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

checkTranscriptionLogs(); 