-- Migración para agregar columnas faltantes en usage_logs
-- Fecha: 2025-01-05
-- Propósito: Corregir error PGRST204 - columnas faltantes

-- Agregar columnas faltantes que el código está intentando usar
ALTER TABLE public.usage_logs 
ADD COLUMN IF NOT EXISTS processing_details JSONB,
ADD COLUMN IF NOT EXISTS current_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_consumed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dollars_consumed DECIMAL(10,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS response_metrics JSONB;

-- Crear índices para las nuevas columnas importantes
CREATE INDEX IF NOT EXISTS idx_usage_logs_current_credits ON public.usage_logs(current_credits);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tokens_consumed ON public.usage_logs(tokens_consumed);

-- Comentarios para documentación
COMMENT ON COLUMN public.usage_logs.processing_details IS 'Detalles del procesamiento de la operación (JSON)';
COMMENT ON COLUMN public.usage_logs.current_credits IS 'Créditos actuales del usuario después de la operación';
COMMENT ON COLUMN public.usage_logs.tokens_consumed IS 'Tokens de IA consumidos en la operación';
COMMENT ON COLUMN public.usage_logs.dollars_consumed IS 'Costo en dólares de la operación';
COMMENT ON COLUMN public.usage_logs.response_metrics IS 'Métricas de respuesta de la operación (JSON)';

-- Verificar las nuevas columnas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usage_logs' AND table_schema = 'public'
AND column_name IN ('processing_details', 'current_credits', 'tokens_consumed', 'dollars_consumed', 'response_metrics')
ORDER BY ordinal_position;

-- Mostrar mensaje de confirmación
SELECT 'Migración completada: columnas agregadas a usage_logs' as status; 