-- ===================================================================
-- MIGRACIÓN: Sistema de Agrupamiento para Codex Items
-- Fecha: 2025-01-22
-- Descripción: Permite agrupar videos/audios relacionados (serie, partes)
-- Para ejecutar en: Dashboard Supabase > SQL Editor
-- ===================================================================

-- 1. Agregar columnas para el sistema de agrupamiento
ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS group_id UUID,
ADD COLUMN IF NOT EXISTS is_group_parent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS group_description TEXT,
ADD COLUMN IF NOT EXISTS part_number INTEGER,
ADD COLUMN IF NOT EXISTS total_parts INTEGER;

-- 2. Crear índices para optimizar consultas de grupos
CREATE INDEX IF NOT EXISTS idx_codex_items_group_id ON public.codex_items(group_id);
CREATE INDEX IF NOT EXISTS idx_codex_items_is_group_parent ON public.codex_items(is_group_parent);
CREATE INDEX IF NOT EXISTS idx_codex_items_user_group ON public.codex_items(user_id, group_id);

-- 3. Agregar comentarios de documentación
COMMENT ON COLUMN public.codex_items.group_id IS 'UUID que identifica el grupo al que pertenece este item';
COMMENT ON COLUMN public.codex_items.is_group_parent IS 'Indica si este item es el contenedor principal del grupo';
COMMENT ON COLUMN public.codex_items.group_name IS 'Nombre descriptivo del grupo (solo para items parent)';
COMMENT ON COLUMN public.codex_items.group_description IS 'Descripción del grupo (solo para items parent)';
COMMENT ON COLUMN public.codex_items.part_number IS 'Número de parte dentro del grupo';
COMMENT ON COLUMN public.codex_items.total_parts IS 'Total de partes en el grupo (solo para items parent)';

-- 4. Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'codex_items' 
AND column_name IN ('group_id', 'is_group_parent', 'group_name', 'group_description', 'part_number', 'total_parts')
ORDER BY column_name;

-- 5. Mensaje de confirmación
SELECT 'Sistema de agrupamiento agregado exitosamente a codex_items' AS status; 