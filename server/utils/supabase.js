const { createClient } = require('@supabase/supabase-js');

// Obtener configuración de Supabase desde variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Crear cliente de Supabase si se proporcionaron las credenciales
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Cliente Supabase inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando cliente Supabase:', error);
  }
} else {
  console.warn('⚠️ Variables de entorno de Supabase no configuradas');
}

module.exports = supabase; 