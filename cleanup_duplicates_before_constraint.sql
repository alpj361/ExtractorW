-- ===================================================================
-- SCRIPT DE LIMPIEZA: Eliminar duplicados antes de restaurar constraint
-- Debe ejecutarse ANTES de fix_coverage_constraint.sql
-- ===================================================================

BEGIN;

-- 1. Identificar y reportar duplicados existentes
CREATE TEMP TABLE duplicate_coverages AS
SELECT 
    project_id, 
    coverage_type, 
    name, 
    COALESCE(parent_name, 'NULL') as parent_name,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY created_at DESC) as coverage_ids
FROM public.project_coverages 
GROUP BY project_id, coverage_type, name, COALESCE(parent_name, 'NULL')
HAVING COUNT(*) > 1;

-- 2. Mostrar estadísticas de duplicados
DO $$
DECLARE
    duplicate_count INTEGER;
    total_duplicates INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count FROM duplicate_coverages;
    SELECT SUM(duplicate_count - 1) INTO total_duplicates FROM duplicate_coverages;
    
    RAISE NOTICE 'Grupos de duplicados encontrados: %', duplicate_count;
    RAISE NOTICE 'Total de registros duplicados a eliminar: %', total_duplicates;
END $$;

-- 3. Eliminar duplicados manteniendo el más reciente
DELETE FROM public.project_coverages 
WHERE id IN (
    SELECT UNNEST(coverage_ids[2:]) -- Mantener solo el primero (más reciente)
    FROM duplicate_coverages
);

-- 4. Verificar limpieza
DO $$
DECLARE
    remaining_duplicates INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_duplicates
    FROM (
        SELECT project_id, coverage_type, name, COALESCE(parent_name, 'NULL')
        FROM public.project_coverages 
        GROUP BY project_id, coverage_type, name, COALESCE(parent_name, 'NULL')
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Duplicados restantes después de limpieza: %', remaining_duplicates;
    
    IF remaining_duplicates > 0 THEN
        RAISE EXCEPTION 'Aún existen duplicados después de la limpieza. Revisar manualmente.';
    END IF;
END $$;

-- 5. Limpiar tabla temporal
DROP TABLE duplicate_coverages;

COMMIT;

RAISE NOTICE 'Limpieza de duplicados completada exitosamente. Ahora puede ejecutar fix_coverage_constraint.sql'; 