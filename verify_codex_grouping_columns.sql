-- ===================================================================
-- VERIFICACIÓN Y MIGRACIÓN: Columnas de Agrupamiento para Codex Items
-- Fecha: 2025-01-25
-- Descripción: Verifica y agrega columnas necesarias para agrupación de items
-- ===================================================================

DO $$ 
BEGIN
    -- Verificar y agregar group_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' 
        AND column_name = 'group_id'
    ) THEN
        ALTER TABLE public.codex_items ADD COLUMN group_id UUID;
        RAISE NOTICE '✅ Columna group_id agregada';
    ELSE
        RAISE NOTICE 'ℹ️ Columna group_id ya existe';
    END IF;

    -- Verificar y agregar is_group_parent
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' 
        AND column_name = 'is_group_parent'
    ) THEN
        ALTER TABLE public.codex_items ADD COLUMN is_group_parent BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Columna is_group_parent agregada';
    ELSE
        RAISE NOTICE 'ℹ️ Columna is_group_parent ya existe';
    END IF;

    -- Verificar y agregar group_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' 
        AND column_name = 'group_name'
    ) THEN
        ALTER TABLE public.codex_items ADD COLUMN group_name TEXT;
        RAISE NOTICE '✅ Columna group_name agregada';
    ELSE
        RAISE NOTICE 'ℹ️ Columna group_name ya existe';
    END IF;

    -- Verificar y agregar group_description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' 
        AND column_name = 'group_description'
    ) THEN
        ALTER TABLE public.codex_items ADD COLUMN group_description TEXT;
        RAISE NOTICE '✅ Columna group_description agregada';
    ELSE
        RAISE NOTICE 'ℹ️ Columna group_description ya existe';
    END IF;

    -- Verificar y agregar part_number
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' 
        AND column_name = 'part_number'
    ) THEN
        ALTER TABLE public.codex_items ADD COLUMN part_number INTEGER;
        RAISE NOTICE '✅ Columna part_number agregada';
    ELSE
        RAISE NOTICE 'ℹ️ Columna part_number ya existe';
    END IF;

    -- Verificar y agregar total_parts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' 
        AND column_name = 'total_parts'
    ) THEN
        ALTER TABLE public.codex_items ADD COLUMN total_parts INTEGER;
        RAISE NOTICE '✅ Columna total_parts agregada';
    ELSE
        RAISE NOTICE 'ℹ️ Columna total_parts ya existe';
    END IF;

END $$;

-- Crear índices para optimizar consultas de grupos (si no existen)
CREATE INDEX IF NOT EXISTS idx_codex_items_group_id ON public.codex_items(group_id);
CREATE INDEX IF NOT EXISTS idx_codex_items_is_group_parent ON public.codex_items(is_group_parent);
CREATE INDEX IF NOT EXISTS idx_codex_items_user_group ON public.codex_items(user_id, group_id);

-- Agregar comentarios de documentación
COMMENT ON COLUMN public.codex_items.group_id IS 'UUID que identifica el grupo al que pertenece este item';
COMMENT ON COLUMN public.codex_items.is_group_parent IS 'Indica si este item es el contenedor principal del grupo';
COMMENT ON COLUMN public.codex_items.group_name IS 'Nombre descriptivo del grupo (solo para items parent)';
COMMENT ON COLUMN public.codex_items.group_description IS 'Descripción del grupo (solo para items parent)';
COMMENT ON COLUMN public.codex_items.part_number IS 'Número de parte dentro del grupo';
COMMENT ON COLUMN public.codex_items.total_parts IS 'Total de partes en el grupo (solo para items parent)';

-- Verificar que las columnas se agregaron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'codex_items' 
AND column_name IN ('group_id', 'is_group_parent', 'group_name', 'group_description', 'part_number', 'total_parts')
ORDER BY column_name;

-- Verificar índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'codex_items' 
AND indexname LIKE '%group%'
ORDER BY indexname;

-- Mensaje de confirmación
SELECT '✅ Verificación de columnas de agrupamiento completada para codex_items' AS status; 