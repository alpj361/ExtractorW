-- ===================================================================
-- SCRIPT MAESTRO: Corrección completa del problema de duplicados
-- Ejecuta limpieza de duplicados + restauración de constraint único
-- ===================================================================

\echo '=== INICIANDO CORRECCIÓN DE DUPLICADOS EN COBERTURAS ==='

-- ===================================================================
-- PASO 1: VERIFICAR ESTADO ACTUAL
-- ===================================================================

\echo '--- Verificando estado actual de constraints ---'

SELECT 
    'CONSTRAINT ACTIVO:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_coverages'::regclass 
    AND contype = 'u'  -- unique constraints
ORDER BY conname;

\echo '--- Contando duplicados existentes ---'

SELECT 
    'DUPLICADOS EXISTENTES:' as info,
    COUNT(*) as grupos_duplicados,
    SUM(duplicate_count - 1) as registros_a_eliminar
FROM (
    SELECT 
        project_id, coverage_type, name, COALESCE(parent_name, 'NULL') as parent_name,
        COUNT(*) as duplicate_count
    FROM public.project_coverages 
    GROUP BY project_id, coverage_type, name, COALESCE(parent_name, 'NULL')
    HAVING COUNT(*) > 1
) duplicates;

-- ===================================================================
-- PASO 2: LIMPIEZA DE DUPLICADOS
-- ===================================================================

\echo '--- Iniciando limpieza de duplicados ---'

BEGIN;

-- Identificar duplicados
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

-- Eliminar duplicados manteniendo el más reciente
DELETE FROM public.project_coverages 
WHERE id IN (
    SELECT UNNEST(coverage_ids[2:])
    FROM duplicate_coverages
);

-- Verificar limpieza
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
    
    IF remaining_duplicates > 0 THEN
        RAISE EXCEPTION 'Aún existen % duplicados después de la limpieza', remaining_duplicates;
    ELSE
        RAISE NOTICE 'Limpieza completada: 0 duplicados restantes';
    END IF;
END $$;

COMMIT;

\echo '✅ Limpieza de duplicados completada'

-- ===================================================================
-- PASO 3: RESTAURAR CONSTRAINT ÚNICO ORIGINAL
-- ===================================================================

\echo '--- Restaurando constraint único original ---'

BEGIN;

-- Eliminar constraint híbrido problemático
ALTER TABLE public.project_coverages 
DROP CONSTRAINT IF EXISTS unique_project_location_coverage;

-- Restaurar constraint único original
ALTER TABLE public.project_coverages 
DROP CONSTRAINT IF EXISTS project_coverages_project_id_coverage_type_name_parent_name_key;

ALTER TABLE public.project_coverages 
ADD CONSTRAINT project_coverages_project_id_coverage_type_name_parent_name_key 
UNIQUE(project_id, coverage_type, name, parent_name);

-- Crear índice optimizado
CREATE INDEX IF NOT EXISTS idx_project_coverages_unique_combo 
ON public.project_coverages(project_id, coverage_type, name, parent_name);

COMMIT;

\echo '✅ Constraint único restaurado'

-- ===================================================================
-- PASO 4: VERIFICACIÓN FINAL
-- ===================================================================

\echo '--- Verificación final ---'

SELECT 
    'CONSTRAINT FINAL:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_coverages'::regclass 
    AND contype = 'u'
ORDER BY conname;

SELECT 
    'INTEGRIDAD FINAL:' as info,
    COUNT(*) as total_coverages,
    COUNT(DISTINCT (project_id, coverage_type, name, parent_name)) as unique_combinations,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT (project_id, coverage_type, name, parent_name)) 
        THEN '✅ SIN DUPLICADOS' 
        ELSE '❌ AÚN HAY DUPLICADOS' 
    END as status
FROM public.project_coverages;

\echo '=== CORRECCIÓN COMPLETADA ==='
\echo ''
\echo '🎉 El sistema de auto-detect de coberturas ahora debería funcionar sin generar duplicados'
\echo '📝 Próximos pasos:'
\echo '   1. Reiniciar el servidor ExtractorW'
\echo '   2. Probar el botón de auto-detect múltiples veces'
\echo '   3. Verificar que muestra "Cobertura actualizada" en lugar de "Nueva cobertura creada"' 