-- Script para arreglar la tabla usage_logs agregando la columna current_credits
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar la columna current_credits si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usage_logs' 
        AND column_name = 'current_credits'
    ) THEN
        ALTER TABLE usage_logs ADD COLUMN current_credits INTEGER DEFAULT 0;
        RAISE NOTICE 'Columna current_credits agregada a usage_logs';
    ELSE
        RAISE NOTICE 'Columna current_credits ya existe en usage_logs';
    END IF;
END $$;

-- 2. Verificar la estructura de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'usage_logs'
ORDER BY ordinal_position;

-- 3. Mostrar algunos registros recientes para verificar
SELECT 
    id,
    user_email,
    operation,
    credits_consumed,
    current_credits,
    timestamp,
    created_at
FROM usage_logs
ORDER BY created_at DESC
LIMIT 5; 