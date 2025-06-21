-- Migración para agregar métricas de transcripción a usage_logs
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas para métricas de tokens y costos
DO $$ 
BEGIN
    -- Agregar tokens_consumed si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usage_logs' 
        AND column_name = 'tokens_consumed'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.usage_logs ADD COLUMN tokens_consumed INTEGER DEFAULT NULL;
        RAISE NOTICE 'Columna tokens_consumed agregada a usage_logs';
    ELSE
        RAISE NOTICE 'Columna tokens_consumed ya existe en usage_logs';
    END IF;

    -- Agregar dollars_consumed si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usage_logs' 
        AND column_name = 'dollars_consumed'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.usage_logs ADD COLUMN dollars_consumed DECIMAL(10,6) DEFAULT NULL;
        RAISE NOTICE 'Columna dollars_consumed agregada a usage_logs';
    ELSE
        RAISE NOTICE 'Columna dollars_consumed ya existe en usage_logs';
    END IF;

    -- Agregar current_credits si no existe (para tracking de créditos)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usage_logs' 
        AND column_name = 'current_credits'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.usage_logs ADD COLUMN current_credits INTEGER DEFAULT NULL;
        RAISE NOTICE 'Columna current_credits agregada a usage_logs';
    ELSE
        RAISE NOTICE 'Columna current_credits ya existe en usage_logs';
    END IF;
END $$;

-- 2. Agregar índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_usage_logs_tokens_consumed ON public.usage_logs(tokens_consumed) WHERE tokens_consumed IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_logs_dollars_consumed ON public.usage_logs(dollars_consumed) WHERE dollars_consumed IS NOT NULL;

-- 3. Agregar comentarios para documentación
COMMENT ON COLUMN public.usage_logs.tokens_consumed IS 'Tokens consumidos en operaciones de IA (transcripción, etc.)';
COMMENT ON COLUMN public.usage_logs.dollars_consumed IS 'Costo en dólares de la operación (para operaciones de IA)';
COMMENT ON COLUMN public.usage_logs.current_credits IS 'Créditos disponibles del usuario al momento de la operación';

-- 4. Verificar la estructura actualizada
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'usage_logs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Mostrar estadísticas de la tabla
SELECT 
    COUNT(*) as total_logs,
    COUNT(tokens_consumed) as logs_with_tokens,
    COUNT(dollars_consumed) as logs_with_dollars,
    SUM(tokens_consumed) as total_tokens,
    SUM(dollars_consumed) as total_dollars_spent
FROM public.usage_logs;

-- 6. Verificar logs de transcripción recientes
SELECT 
    operation,
    user_email,
    credits_consumed,
    tokens_consumed,
    dollars_consumed,
    timestamp
FROM public.usage_logs 
WHERE operation ILIKE '%transcription%' 
   OR operation ILIKE '%upload%' 
   OR operation ILIKE '%from-codex%'
ORDER BY timestamp DESC 
LIMIT 10; 