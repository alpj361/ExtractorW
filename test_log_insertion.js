require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Usar service key para saltarse RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY no configuradas');
  process.exit(1);
}

console.log('🔑 Conectando a Supabase con service key...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('🔍 Verificando conexión...');
    
    // 1. Verificar usuario admin
    console.log('👤 Verificando usuario admin...');
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', 'pablojosea361@gmail.com')
      .single();
      
    if (userError) {
      console.error('❌ Error consultando usuario:', userError);
    } else {
      console.log('✅ Usuario encontrado:', {
        id: user.id,
        email: user.email,
        role: user.role
      });
    }
    
    // 2. Verificar tabla usage_logs
    console.log('📋 Verificando tabla usage_logs...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'usage_logs' });
      
    if (columnsError) {
      console.error('❌ Error consultando estructura de tabla:', columnsError);
      
      // Intento alternativo
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'usage_logs');
        
      if (tableError) {
        console.error('❌ Error consultando información de schema:', tableError);
      } else {
        console.log('✅ Estructura de tabla:', tableInfo);
      }
    } else {
      console.log('✅ Columnas de tabla:', columns);
    }
    
    // 3. Contar registros actuales
    console.log('🔢 Contando registros actuales...');
    const { count, error: countError } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error contando registros:', countError);
    } else {
      console.log(`✅ Total registros encontrados: ${count || 0}`);
    }
    
    // 4. Insertar registro de prueba
    console.log('📝 Insertando registro de prueba...');
    
    // Usar el ID del usuario si lo encontramos, o un UUID genérico si no
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    
    const testLog = {
      user_id: userId,
      user_email: 'pablojosea361@gmail.com',
      operation: 'test_log_insertion',
      credits_consumed: 0,
      ip_address: '127.0.0.1',
      user_agent: 'TestScript/1.0',
      timestamp: new Date().toISOString(),
      request_params: {
        method: 'TEST',
        params: {},
        query: {},
        body_keys: ['test'],
        user_role: 'admin',
        success: true
      },
      response_time: 100
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('usage_logs')
      .insert([testLog]);
      
    if (insertError) {
      console.error('❌ Error insertando registro de prueba:', insertError);
      
      // Intentar con request_params como string JSON en lugar de objeto
      console.log('🔄 Reintentando con request_params como string...');
      testLog.request_params = JSON.stringify(testLog.request_params);
      
      const { data: retryResult, error: retryError } = await supabase
        .from('usage_logs')
        .insert([testLog]);
        
      if (retryError) {
        console.error('❌ Error en segundo intento:', retryError);
      } else {
        console.log('✅ Registro insertado en segundo intento!');
      }
    } else {
      console.log('✅ Registro insertado exitosamente!');
    }
    
    // 5. Verificar que se insertó
    console.log('🔍 Verificando inserción...');
    const { data: logs, error: logsError } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('operation', 'test_log_insertion')
      .order('timestamp', { ascending: false })
      .limit(5);
      
    if (logsError) {
      console.error('❌ Error verificando logs:', logsError);
    } else {
      console.log(`✅ Se encontraron ${logs.length} registros de prueba:`);
      console.log(JSON.stringify(logs, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

main()
  .then(() => console.log('✅ Prueba completada'))
  .catch(err => console.error('❌ Error en prueba:', err))
  .finally(() => process.exit(0)); 