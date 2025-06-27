-- ===================================================================
-- MIGRACIÓN: Sistema de Cobertura para Capturado Cards
-- Agrega coverage_id a capturado_cards y sistema de contadores automáticos
-- Fecha: Enero 2025
-- ===================================================================

BEGIN;

-- 1. Agregar coverage_id a capturado_cards
ALTER TABLE public.capturado_cards 
ADD COLUMN IF NOT EXISTS coverage_id UUID REFERENCES public.project_coverages(id) ON DELETE SET NULL;

-- 2. Agregar capturados_count a project_coverages
ALTER TABLE public.project_coverages 
ADD COLUMN IF NOT EXISTS capturados_count INTEGER DEFAULT 0;

-- 3. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_capturado_cards_coverage_id ON public.capturado_cards(coverage_id);
CREATE INDEX IF NOT EXISTS idx_project_coverages_capturados_count ON public.project_coverages(capturados_count);

-- 4. Función para actualizar contadores automáticamente
CREATE OR REPLACE FUNCTION update_coverage_capturados_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se inserta una nueva card con coverage_id
    IF TG_OP = 'INSERT' AND NEW.coverage_id IS NOT NULL THEN
        UPDATE public.project_coverages 
        SET capturados_count = capturados_count + 1
        WHERE id = NEW.coverage_id;
        RETURN NEW;
    END IF;
    
    -- Si se actualiza coverage_id
    IF TG_OP = 'UPDATE' THEN
        -- Si se quita coverage_id (de no-null a null)
        IF OLD.coverage_id IS NOT NULL AND NEW.coverage_id IS NULL THEN
            UPDATE public.project_coverages 
            SET capturados_count = GREATEST(capturados_count - 1, 0)
            WHERE id = OLD.coverage_id;
        -- Si se cambia coverage_id (de un id a otro id)
        ELSIF OLD.coverage_id IS NOT NULL AND NEW.coverage_id IS NOT NULL AND OLD.coverage_id != NEW.coverage_id THEN
            -- Decrementar el anterior
            UPDATE public.project_coverages 
            SET capturados_count = GREATEST(capturados_count - 1, 0)
            WHERE id = OLD.coverage_id;
            -- Incrementar el nuevo
            UPDATE public.project_coverages 
            SET capturados_count = capturados_count + 1
            WHERE id = NEW.coverage_id;
        -- Si se agrega coverage_id (de null a no-null)
        ELSIF OLD.coverage_id IS NULL AND NEW.coverage_id IS NOT NULL THEN
            UPDATE public.project_coverages 
            SET capturados_count = capturados_count + 1
            WHERE id = NEW.coverage_id;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Si se elimina una card con coverage_id
    IF TG_OP = 'DELETE' AND OLD.coverage_id IS NOT NULL THEN
        UPDATE public.project_coverages 
        SET capturados_count = GREATEST(capturados_count - 1, 0)
        WHERE id = OLD.coverage_id;
        RETURN OLD;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 5. Crear trigger para actualizar contadores automáticamente
DROP TRIGGER IF EXISTS trigger_update_coverage_capturados_count ON public.capturado_cards;
CREATE TRIGGER trigger_update_coverage_capturados_count
    AFTER INSERT OR UPDATE OR DELETE ON public.capturado_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_coverage_capturados_count();

-- 6. Función para recalcular contadores existentes
CREATE OR REPLACE FUNCTION recalculate_capturados_count()
RETURNS TABLE(coverage_id UUID, old_count INTEGER, new_count INTEGER) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.project_coverages 
    SET capturados_count = (
        SELECT COUNT(*)
        FROM public.capturado_cards 
        WHERE capturado_cards.coverage_id = project_coverages.id
    )
    FROM (
        SELECT 
            pc.id,
            pc.capturados_count as old_count,
            COUNT(cc.id) as new_count
        FROM public.project_coverages pc
        LEFT JOIN public.capturado_cards cc ON cc.coverage_id = pc.id
        GROUP BY pc.id, pc.capturados_count
    ) as counts
    WHERE project_coverages.id = counts.id
    RETURNING counts.id, counts.old_count, counts.new_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Agregar comentarios de documentación
COMMENT ON COLUMN public.capturado_cards.coverage_id IS 'ID de la cobertura geográfica asociada a este hallazgo';
COMMENT ON COLUMN public.project_coverages.capturados_count IS 'Número de hallazgos (capturado_cards) asociados a esta cobertura';
COMMENT ON FUNCTION update_coverage_capturados_count() IS 'Función trigger que actualiza automáticamente los contadores de capturados en project_coverages';
COMMENT ON FUNCTION recalculate_capturados_count() IS 'Función para recalcular todos los contadores de capturados existentes';

COMMIT;

-- ===================================================================
-- VERIFICACIÓN Y RECÁLCULO INICIAL
-- ===================================================================

DO $$
DECLARE
    coverage_count INTEGER;
    cards_count INTEGER;
    recalc_result RECORD;
    total_recalculated INTEGER := 0;
BEGIN
    -- Verificar que las columnas existen
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'capturado_cards' AND column_name = 'coverage_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_coverages' AND column_name = 'capturados_count'
    ) THEN
        RAISE NOTICE '✅ Columnas coverage_id y capturados_count agregadas exitosamente';
        
        -- Contar registros
        SELECT COUNT(*) INTO coverage_count FROM public.project_coverages;
        SELECT COUNT(*) INTO cards_count FROM public.capturado_cards;
        
        RAISE NOTICE '📊 Estadísticas: % coberturas, % tarjetas capturadas', coverage_count, cards_count;
        
        -- Recalcular contadores para datos existentes
        RAISE NOTICE '🔄 Recalculando contadores existentes...';
        FOR recalc_result IN 
            SELECT * FROM recalculate_capturados_count()
        LOOP
            total_recalculated := total_recalculated + 1;
            IF recalc_result.old_count != recalc_result.new_count THEN
                RAISE NOTICE '   • Cobertura %: % → %', 
                    recalc_result.coverage_id, 
                    recalc_result.old_count, 
                    recalc_result.new_count;
            END IF;
        END LOOP;
        
        RAISE NOTICE '✅ Migración completada: % coberturas recalculadas', total_recalculated;
        
    ELSE
        RAISE EXCEPTION '❌ Error: No se pudieron agregar las columnas necesarias';
    END IF;
END $$;

-- Mostrar estructura final para verificación
SELECT 
    'capturado_cards' as tabla,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'capturado_cards' 
AND column_name IN ('coverage_id')
UNION ALL
SELECT 
    'project_coverages' as tabla,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'project_coverages' 
AND column_name IN ('capturados_count')
ORDER BY tabla, column_name;

SELECT 'Sistema de cobertura agregado exitosamente a capturado_cards' AS status; 