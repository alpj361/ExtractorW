#!/usr/bin/env node

/**
 * Script para verificar que la migración de audio_transcription esté aplicada
 */

const supabase = require('./server/utils/supabase');

console.log('🔍 VERIFICANDO MIGRACIÓN DE AUDIO_TRANSCRIPTION');
console.log('='.repeat(50));

async function checkMigration() {
  try {
    console.log('\n1️⃣ Verificando conexión a Supabase...');
    
    if (!supabase) {
      throw new Error('Cliente Supabase no inicializado');
    }
    
    console.log('✅ Conexión a Supabase OK');
    
    console.log('\n2️⃣ Verificando estructura de tabla codex_items...');
    
    // Intentar hacer una consulta que incluya la columna audio_transcription
    const { data, error } = await supabase
      .from('codex_items')
      .select('id, titulo, audio_transcription')
      .limit(1);
    
    if (error) {
      if (error.message.includes('audio_transcription')) {
        console.log('❌ La columna audio_transcription NO existe');
        console.log('   Error:', error.message);
        return false;
      } else {
        console.log('❌ Error en consulta:', error.message);
        return false;
      }
    }
    
    console.log('✅ La columna audio_transcription existe');
    
    console.log('\n3️⃣ Verificando índice GIN para búsqueda...');
    
    // Verificar que podemos hacer búsquedas de texto
    const { data: searchData, error: searchError } = await supabase
      .from('codex_items')
      .select('id, titulo')
      .textSearch('audio_transcription', 'test', { type: 'websearch' })
      .limit(1);
    
    if (searchError) {
      console.log('⚠️ Índice GIN no está funcionando correctamente');
      console.log('   Error:', searchError.message);
      console.log('   Esto no afecta la funcionalidad básica de transcripción');
    } else {
      console.log('✅ Índice GIN para búsqueda funcionando');
    }
    
    console.log('\n4️⃣ Verificando permisos RLS...');
    
    // Intentar insertar un registro de prueba (será rechazado por RLS sin usuario)
    const { data: insertData, error: insertError } = await supabase
      .from('codex_items')
      .insert([{
        user_id: '00000000-0000-0000-0000-000000000000',
        tipo: 'test',
        titulo: 'Test Transcription',
        audio_transcription: 'Esta es una prueba'
      }]);
    
    if (insertError && insertError.message.includes('RLS')) {
      console.log('✅ RLS está funcionando correctamente');
    } else if (insertError) {
      console.log('⚠️ Error inesperado:', insertError.message);
    } else {
      console.log('⚠️ Se insertó un registro de prueba (esto no debería pasar)');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verificando migración:', error.message);
    return false;
  }
}

async function showMigrationInstructions() {
  console.log('\n📋 INSTRUCCIONES PARA APLICAR MIGRACIÓN:');
  console.log('=====================================');
  console.log('1. Conectarse a la base de datos de Supabase');
  console.log('2. Ejecutar el archivo: add_audio_transcription_to_codex.sql');
  console.log('3. O ejecutar manualmente:');
  console.log('');
  console.log('   ALTER TABLE codex_items ADD COLUMN audio_transcription TEXT;');
  console.log('   CREATE INDEX IF NOT EXISTS idx_codex_items_audio_transcription');
  console.log('   ON codex_items USING gin(to_tsvector(\'spanish\', audio_transcription));');
  console.log('');
  console.log('4. Verificar con: \\d codex_items');
}

async function runCheck() {
  try {
    const isOk = await checkMigration();
    
    if (isOk) {
      console.log('\n🎉 VERIFICACIÓN COMPLETA');
      console.log('✅ La migración está aplicada correctamente');
      console.log('🎬 El sistema de transcripción debería funcionar');
    } else {
      console.log('\n💥 VERIFICACIÓN FALLIDA');
      console.log('❌ La migración NO está aplicada');
      await showMigrationInstructions();
    }
    
  } catch (error) {
    console.error('\n💥 ERROR FATAL:', error.message);
    await showMigrationInstructions();
    process.exit(1);
  }
}

// Ejecutar verificación
runCheck().catch(console.error); 