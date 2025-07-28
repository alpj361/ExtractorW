-- ===================================================================
-- SCRIPT DE CORRECCIÓN: Restaurar constraint único original
-- Arregla el problema de duplicados en auto-detect de coberturas
-- ===================================================================

BEGIN;

-- 1. Eliminar constraint híbrido problemático
ALTER TABLE public.project_coverages 
DROP CONSTRAINT IF EXISTS unique_project_location_coverage;

-- 2. Restaurar constraint único original que funciona con el UPSERT
ALTER TABLE public.project_coverages 
ADD CONSTRAINT project_coverages_project_id_coverage_type_name_parent_name_key 
UNIQUE(project_id, coverage_type, name, parent_name);

-- 3. Verificar que no hay duplicados existentes antes de aplicar el constraint
-- (Si hay duplicados, este script fallará y necesitaremos limpiarlos primero)

-- 4. Crear índice para optimizar el constraint
CREATE INDEX IF NOT EXISTS idx_project_coverages_unique_combo 
ON public.project_coverages(project_id, coverage_type, name, parent_name);

COMMIT;

-- ===================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ===================================================================

-- Verificar constraint activo
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_coverages'::regclass 
    AND contype = 'u'  -- unique constraints
ORDER BY conname;

-- Contar registros para verificar integridad
SELECT 
    COUNT(*) as total_coverages,
    COUNT(DISTINCT (project_id, coverage_type, name, parent_name)) as unique_combinations
FROM public.project_coverages; 