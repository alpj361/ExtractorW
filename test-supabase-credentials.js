require('dotenv').config();

console.log('🔍 VERIFICANDO CREDENCIALES DE SUPABASE\n');

console.log('Variables de entorno disponibles:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurada' : '❌ No encontrada');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ No encontrada');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ No encontrada');

if (process.env.SUPABASE_URL) {
  console.log('\nURL de Supabase:', process.env.SUPABASE_URL);
}

if (process.env.SUPABASE_ANON_KEY) {
  console.log('\nAnon Key (primeros 20 chars):', process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...');
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\nService Role Key (primeros 20 chars):', process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...');
} else {
  console.log('\n❌ PROBLEMA IDENTIFICADO: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  console.log('Esta clave es necesaria para omitir las restricciones de RLS y acceder a todos los datos.');
}

console.log('\n📋 SOLUCIÓN:');
console.log('1. Agrega SUPABASE_SERVICE_ROLE_KEY a tu archivo .env');
console.log('2. Puedes obtenerla desde el panel de Supabase -> Settings -> API');
console.log('3. Busca "service_role" key (NO la anon key)'); 