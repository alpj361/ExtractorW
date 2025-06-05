-- Tabla de logs de uso para el sistema de créditos
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    credits_consumed INTEGER NOT NULL DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_params JSONB,
    response_time INTEGER, -- en milisegundos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON public.usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_logs_operation ON public.usage_logs(operation);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_email ON public.usage_logs(user_email);

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver sus propios logs
CREATE POLICY "Users can view own usage logs" ON public.usage_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Política para que el sistema pueda insertar logs
CREATE POLICY "System can insert usage logs" ON public.usage_logs
    FOR INSERT WITH CHECK (true);

-- Política para que los admins puedan ver todos los logs
CREATE POLICY "Admins can view all usage logs" ON public.usage_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Función para limpiar logs antiguos (ejecutar mensualmente)
CREATE OR REPLACE FUNCTION cleanup_old_usage_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar logs más antiguos de 90 días
    DELETE FROM public.usage_logs 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE public.usage_logs IS 'Registro de uso de operaciones del sistema de créditos';
COMMENT ON COLUMN public.usage_logs.user_id IS 'ID del usuario que realizó la operación';
COMMENT ON COLUMN public.usage_logs.operation IS 'Endpoint/operación ejecutada';
COMMENT ON COLUMN public.usage_logs.credits_consumed IS 'Créditos consumidos en la operación';
COMMENT ON COLUMN public.usage_logs.response_time IS 'Tiempo de respuesta en milisegundos';
COMMENT ON COLUMN public.usage_logs.request_params IS 'Parámetros de la request (JSON)';

-- Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usage_logs' AND table_schema = 'public'
ORDER BY ordinal_position; 