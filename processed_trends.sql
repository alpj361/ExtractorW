-- Tabla para almacenar tendencias procesadas
CREATE TABLE IF NOT EXISTS public.processed_trends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    processing_id VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL DEFAULT 'Guatemala',
    trends JSONB NOT NULL DEFAULT '[]'::jsonb,
    statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
    processing_time NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_processed_trends_user_id ON public.processed_trends(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_trends_created_at ON public.processed_trends(created_at);
CREATE INDEX IF NOT EXISTS idx_processed_trends_location ON public.processed_trends(location);

-- Enable RLS
ALTER TABLE public.processed_trends ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver sus propios resultados
CREATE POLICY "Users can view own processed trends" ON public.processed_trends
    FOR SELECT USING (auth.uid() = user_id);

-- Política para que el sistema pueda insertar resultados
CREATE POLICY "System can insert processed trends" ON public.processed_trends
    FOR INSERT WITH CHECK (true);

-- Política para que los admins puedan ver todos los resultados
CREATE POLICY "Admins can view all processed trends" ON public.processed_trends
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Función para eliminar resultados antiguos
CREATE OR REPLACE FUNCTION cleanup_old_processed_trends()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar resultados más antiguos de 30 días
    DELETE FROM public.processed_trends 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE public.processed_trends IS 'Almacena resultados de procesamiento de tendencias';
COMMENT ON COLUMN public.processed_trends.processing_id IS 'ID único del procesamiento';
COMMENT ON COLUMN public.processed_trends.trends IS 'Array JSON de tendencias procesadas';
COMMENT ON COLUMN public.processed_trends.statistics IS 'Estadísticas generadas del procesamiento';
COMMENT ON COLUMN public.processed_trends.processing_time IS 'Tiempo de procesamiento en segundos'; 