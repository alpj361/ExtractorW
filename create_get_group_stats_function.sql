-- ===================================================================
-- FUNCIÓN RPC: get_group_stats
-- Descripción: Calcula estadísticas de un grupo de items del Codex
-- Parámetros: group_uuid (UUID del grupo)
-- Retorna: JSON con item_count y total_size
-- ===================================================================

CREATE OR REPLACE FUNCTION public.get_group_stats(group_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    item_count INTEGER;
    total_size BIGINT;
    type_stats JSON;
BEGIN
    -- Calcular estadísticas del grupo
    SELECT 
        COUNT(*) as count,
        COALESCE(SUM(tamano), 0) as size
    INTO item_count, total_size
    FROM public.codex_items 
    WHERE group_id = group_uuid;
    
    -- Si no hay items en el grupo, retornar valores por defecto
    IF item_count = 0 THEN
        result := json_build_object(
            'item_count', 0,
            'total_size', 0,
            'type_breakdown', json_build_object()
        );
        RETURN result;
    END IF;
    
    -- Calcular breakdown por tipo
    SELECT json_object_agg(tipo, count)
    INTO type_stats
    FROM (
        SELECT tipo, COUNT(*) as count
        FROM public.codex_items 
        WHERE group_id = group_uuid
        GROUP BY tipo
    ) type_counts;
    
    -- Construir resultado final
    result := json_build_object(
        'item_count', item_count,
        'total_size', total_size,
        'type_breakdown', COALESCE(type_stats, json_build_object())
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar valores por defecto
        RETURN json_build_object(
            'item_count', 0,
            'total_size', 0,
            'type_breakdown', json_build_object(),
            'error', SQLERRM
        );
END;
$$;

-- Comentario de documentación
COMMENT ON FUNCTION public.get_group_stats(UUID) IS 'Calcula estadísticas de un grupo de items del Codex: count, size, breakdown por tipo';

-- Ejemplo de uso:
-- SELECT get_group_stats('01234567-89ab-cdef-0123-456789abcdef'::UUID);

-- Verificar que la función se creó correctamente
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_group_stats' 
AND routine_schema = 'public';

SELECT '✅ Función get_group_stats creada exitosamente' AS status; 