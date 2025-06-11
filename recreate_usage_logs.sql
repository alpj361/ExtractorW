-- Primero eliminamos la tabla existente si existe
DROP TABLE IF EXISTS public.usage_logs CASCADE;

-- Recreamos la tabla con la estructura correcta
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    credits_consumed INTEGER NOT NULL DEFAULT 0,
    ip_address VARCHAR(50), -- Cambiado de INET a VARCHAR para mayor compatibilidad
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_params JSONB, -- Asegurando que sea JSONB y no TEXT
    response_time INTEGER, -- en milisegundos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON public.usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_logs_operation ON public.usage_logs(operation);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_email ON public.usage_logs(user_email);

-- Desactivar RLS temporalmente para pruebas iniciales
ALTER TABLE public.usage_logs DISABLE ROW LEVEL SECURITY;

-- Pero también crear políticas para cuando se active RLS en el futuro
DROP POLICY IF EXISTS "Users can view own usage logs" ON public.usage_logs;
DROP POLICY IF EXISTS "System can insert usage logs" ON public.usage_logs;
DROP POLICY IF EXISTS "Admins can view all usage logs" ON public.usage_logs;

-- Política para que los usuarios puedan ver sus propios logs
CREATE POLICY "Users can view own usage logs" ON public.usage_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Política para que el sistema pueda insertar logs (más permisiva)
CREATE POLICY "System can insert usage logs" ON public.usage_logs
    FOR INSERT WITH CHECK (true);

-- Política para que los admins puedan ver todos los logs (MÁS PERMISIVA)
CREATE POLICY "Admins can view all usage logs" ON public.usage_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Insertar algunos datos de prueba
INSERT INTO public.usage_logs (user_id, user_email, operation, credits_consumed, ip_address, user_agent, timestamp, request_params, response_time)
VALUES 
    ((SELECT id FROM auth.users WHERE email = 'pablojosea361@gmail.com' LIMIT 1), 
     'pablojosea361@gmail.com', 
     'api/processTrends', 
     3, 
     '127.0.0.1', 
     'TestAgent', 
     NOW(), 
     '{"method": "POST", "params": {}, "query": {}, "body_keys": ["test"], "user_role": "admin", "success": true}'::jsonb, 
     150);

-- Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usage_logs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'usage_logs';

-- Verificar registros
SELECT * FROM public.usage_logs LIMIT 10; 