const { createClient } = require('@supabase/supabase-js');

// Obtener configuración de Supabase desde variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Crear cliente de Supabase si se proporcionaron las credenciales
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    // Asegurarse de que la URL tenga el formato correcto
    const formattedUrl = SUPABASE_URL.endsWith('/') ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
    
    // Crear el cliente con opciones adicionales
    supabase = createClient(formattedUrl, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false // No persistir la sesión en el servidor
      },
      db: {
        schema: 'public' // Especificar el schema explícitamente
      }
    });
    
    console.log('✅ Cliente Supabase inicializado correctamente');
    console.log(`   📍 URL: ${formattedUrl}`);
  } catch (error) {
    console.error('❌ Error inicializando cliente Supabase:', error);
  }
} else {
  console.warn('⚠️ Variables de entorno de Supabase no configuradas');
}

module.exports = supabase; 