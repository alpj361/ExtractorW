const { createClient } = require('@supabase/supabase-js');

// Obtener configuración de Supabase desde variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;

// Usar la Service Role key si está disponible para ejecutar consultas de servidor con privilegios
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_SECRET;

// Clave pública (anon) como fallback
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Determinar qué clave utilizar
const SUPABASE_KEY_TO_USE = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

// Crear cliente de Supabase si se proporcionaron las credenciales
let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY_TO_USE) {
  try {
    // Asegurarse de que la URL tenga el formato correcto
    const formattedUrl = SUPABASE_URL.endsWith('/') ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
    
    // Crear el cliente con opciones adicionales
    supabase = createClient(formattedUrl, SUPABASE_KEY_TO_USE, {
      auth: {
        persistSession: false // No persistir la sesión en el servidor
      },
      db: {
        schema: 'public' // Especificar el schema explícitamente
      }
    });
    
    console.log('✅ Cliente Supabase inicializado correctamente');
    console.log(`   📍 URL: ${formattedUrl}`);
    console.log(`   🔑 Tipo de clave: ${SUPABASE_SERVICE_KEY ? 'SERVICE_ROLE' : 'ANON'}`);
  } catch (error) {
    console.error('❌ Error inicializando cliente Supabase:', error);
  }
} else {
  console.warn('⚠️ Variables de entorno de Supabase no configuradas');
}

module.exports = supabase; 