const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Usar la clave anónima primero, luego service role si está disponible
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verificando migración de usage_logs...\n');
  
  try {
    // 1. Verificar que podemos acceder a la tabla
    console.log('1️⃣ Verificando acceso a la tabla...');
    
    const { data: testData, error: testError } = await supabase
      .from('usage_logs')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error accediendo a usage_logs:', testError.message);
      return;
    }
    
    console.log('✅ Acceso a tabla usage_logs confirmado');
    
    // 2. Verificar estructura de la tabla intentando seleccionar las nuevas columnas
    console.log('\n2️⃣ Verificando nuevas columnas...');
    
    const { data: structureData, error: structureError } = await supabase
      .from('usage_logs')
      .select('id, tokens_consumed, dollars_consumed, current_credits')
      .limit(1);
    
    if (structureError) {
      console.error('❌ Error verificando estructura:', structureError.message);
      
      // Verificar qué columnas específicas faltan
      if (structureError.message.includes('tokens_consumed')) {
        console.log('❌ La columna tokens_consumed NO existe');
      }
      if (structureError.message.includes('dollars_consumed')) {
        console.log('❌ La columna dollars_consumed NO existe');
      }
      if (structureError.message.includes('current_credits')) {
        console.log('❌ La columna current_credits NO existe');
      }
      
      console.log('\n💡 Necesitas ejecutar la migración:');
      console.log('   1. Abre Supabase SQL Editor');
      console.log('   2. Copia y pega el contenido de add_transcription_metrics_to_usage_logs.sql');
      console.log('   3. Ejecuta la migración');
      return;
    }
    
    console.log('✅ Todas las nuevas columnas existen');
    
    // 3. Verificar que podemos insertar un registro de prueba
    console.log('\n3️⃣ Probando inserción de registro con nuevas columnas...');
    
    // Primero obtener un usuario válido para la prueba
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .limit(1);
    
    if (profilesError || !profiles || profiles.length === 0) {
      console.log('⚠️ No se pueden hacer pruebas de inserción sin usuarios válidos');
    } else {
      const testUser = profiles[0];
      
      const testLogEntry = {
        user_id: testUser.id,
        user_email: testUser.email,
        operation: 'test_transcription_migration',
        credits_consumed: 0,
        tokens_consumed: 1000,
        dollars_consumed: 0.015,
        current_credits: 100,
        timestamp: new Date().toISOString(),
        request_params: {
          test: true,
          migration_verification: true
        }
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('usage_logs')
        .insert([testLogEntry])
        .select();
      
      if (insertError) {
        console.error('❌ Error insertando registro de prueba:', insertError.message);
      } else {
        console.log('✅ Inserción de registro con nuevas columnas exitosa');
        console.log('📋 Registro creado:', {
          id: insertData[0].id,
          tokens_consumed: insertData[0].tokens_consumed,
          dollars_consumed: insertData[0].dollars_consumed,
          current_credits: insertData[0].current_credits
        });
        
        // Limpiar el registro de prueba
        await supabase
          .from('usage_logs')
          .delete()
          .eq('id', insertData[0].id);
        
        console.log('🗑️ Registro de prueba eliminado');
      }
    }
    
    // 4. Verificar logs de transcripción existentes
    console.log('\n4️⃣ Verificando logs de transcripción existentes...');
    
    const { data: transcriptionLogs, error: transcriptionError } = await supabase
      .from('usage_logs')
      .select('operation, user_email, credits_consumed, tokens_consumed, dollars_consumed, timestamp')
      .or('operation.ilike.%transcription%,operation.ilike.%upload%,operation.ilike.%from-codex%')
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (transcriptionError) {
      console.error('❌ Error consultando logs de transcripción:', transcriptionError.message);
    } else {
      console.log(`📊 Logs de transcripción encontrados: ${transcriptionLogs.length}`);
      
      if (transcriptionLogs.length > 0) {
        console.log('\n📋 Últimos logs de transcripción:');
        transcriptionLogs.forEach((log, index) => {
          console.log(`${index + 1}. ${log.operation} - ${log.user_email}`);
          console.log(`   Créditos: ${log.credits_consumed}, Tokens: ${log.tokens_consumed || 'N/A'}, Costo: $${log.dollars_consumed || 'N/A'}`);
        });
      } else {
        console.log('ℹ️ No se encontraron logs de transcripción previos');
      }
    }
    
    console.log('\n✅ Verificación de migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante verificación:', error.message);
  }
}

verifyMigration(); 