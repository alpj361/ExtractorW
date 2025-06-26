-- ===================================================================
-- MIGRACIÓN: Agregar campos híbridos a project_coverages
-- Agrega soporte para sistema híbrido con nomenclatura local por país
-- Fecha: Enero 2025
-- ===================================================================

BEGIN;

-- 1. Agregar campos híbridos a project_coverages
ALTER TABLE public.project_coverages 
ADD COLUMN IF NOT EXISTS location_id VARCHAR(100), -- GTM-DEPT-QUETZ, MEX-STATE-CDMX, etc.
ADD COLUMN IF NOT EXISTS hybrid_processed BOOLEAN DEFAULT FALSE, -- Si ya fue procesado por el sistema híbrido
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER, -- 1=país, 2=departamento/estado, 3=ciudad/municipio, 4=zona
ADD COLUMN IF NOT EXISTS country_code VARCHAR(3), -- GTM, MEX, USA, COL, etc.
ADD COLUMN IF NOT EXISTS full_path TEXT, -- Guatemala > Quetzaltenango > Quetzaltenango
ADD COLUMN IF NOT EXISTS findings_count INTEGER DEFAULT 1, -- Número de hallazgos en esta ubicación
ADD COLUMN IF NOT EXISTS nombre_local VARCHAR(100), -- Nomenclatura local: "Municipio", "Departamento", "Estado", etc.
ADD COLUMN IF NOT EXISTS hybrid_metadata JSONB DEFAULT '{}'::jsonb; -- Metadatos adicionales del sistema híbrido

-- 2. Crear índices para los nuevos campos
CREATE INDEX IF NOT EXISTS idx_project_coverages_location_id ON public.project_coverages(location_id);
CREATE INDEX IF NOT EXISTS idx_project_coverages_hybrid_processed ON public.project_coverages(hybrid_processed);
CREATE INDEX IF NOT EXISTS idx_project_coverages_hierarchy_level ON public.project_coverages(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_project_coverages_country_code ON public.project_coverages(country_code);
CREATE INDEX IF NOT EXISTS idx_project_coverages_nombre_local ON public.project_coverages(nombre_local);

-- 3. Crear constraint único actualizado para evitar duplicados híbridos
ALTER TABLE public.project_coverages 
DROP CONSTRAINT IF EXISTS project_coverages_project_id_coverage_type_name_parent_name_key;

-- Nuevo constraint que incluye location_id para mejor control de duplicados
ALTER TABLE public.project_coverages 
ADD CONSTRAINT unique_project_location_coverage 
UNIQUE(project_id, location_id, coverage_type) DEFERRABLE INITIALLY DEFERRED;

-- 4. Crear función para determinar nombre_local basado en país y nivel jerárquico
CREATE OR REPLACE FUNCTION get_nombre_local_by_country_and_level(
    country_code_param VARCHAR(3),
    hierarchy_level_param INTEGER
)
RETURNS VARCHAR(100) AS $$
BEGIN
    -- Guatemala
    IF country_code_param = 'GTM' THEN
        CASE hierarchy_level_param
            WHEN 1 THEN RETURN 'País';
            WHEN 2 THEN RETURN 'Departamento';
            WHEN 3 THEN RETURN 'Municipio';
            WHEN 4 THEN RETURN 'Zona';
            ELSE RETURN 'Ubicación';
        END CASE;
    
    -- México
    ELSIF country_code_param = 'MEX' THEN
        CASE hierarchy_level_param
            WHEN 1 THEN RETURN 'País';
            WHEN 2 THEN RETURN 'Estado';
            WHEN 3 THEN RETURN 'Municipio';
            WHEN 4 THEN RETURN 'Localidad';
            ELSE RETURN 'Ubicación';
        END CASE;
    
    -- Estados Unidos
    ELSIF country_code_param = 'USA' THEN
        CASE hierarchy_level_param
            WHEN 1 THEN RETURN 'Country';
            WHEN 2 THEN RETURN 'State';
            WHEN 3 THEN RETURN 'City';
            WHEN 4 THEN RETURN 'District';
            ELSE RETURN 'Location';
        END CASE;
    
    -- Colombia
    ELSIF country_code_param = 'COL' THEN
        CASE hierarchy_level_param
            WHEN 1 THEN RETURN 'País';
            WHEN 2 THEN RETURN 'Departamento';
            WHEN 3 THEN RETURN 'Municipio';
            WHEN 4 THEN RETURN 'Corregimiento';
            ELSE RETURN 'Ubicación';
        END CASE;
    
    -- Argentina
    ELSIF country_code_param = 'ARG' THEN
        CASE hierarchy_level_param
            WHEN 1 THEN RETURN 'País';
            WHEN 2 THEN RETURN 'Provincia';
            WHEN 3 THEN RETURN 'Partido';
            WHEN 4 THEN RETURN 'Localidad';
            ELSE RETURN 'Ubicación';
        END CASE;
    
    -- España
    ELSIF country_code_param = 'ESP' THEN
        CASE hierarchy_level_param
            WHEN 1 THEN RETURN 'País';
            WHEN 2 THEN RETURN 'Comunidad Autónoma';
            WHEN 3 THEN RETURN 'Provincia';
            WHEN 4 THEN RETURN 'Municipio';
            ELSE RETURN 'Ubicación';
        END CASE;
    
    -- Default para países no especificados
    ELSE
        CASE hierarchy_level_param
            WHEN 1 THEN RETURN 'Country';
            WHEN 2 THEN RETURN 'Region';
            WHEN 3 THEN RETURN 'City';
            WHEN 4 THEN RETURN 'District';
            ELSE RETURN 'Location';
        END CASE;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Crear trigger para actualizar nombre_local automáticamente
CREATE OR REPLACE FUNCTION update_nombre_local_on_coverage()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actualizar si tenemos country_code y hierarchy_level
    IF NEW.country_code IS NOT NULL AND NEW.hierarchy_level IS NOT NULL THEN
        NEW.nombre_local := get_nombre_local_by_country_and_level(NEW.country_code, NEW.hierarchy_level);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta antes de INSERT/UPDATE
DROP TRIGGER IF EXISTS set_nombre_local_on_coverage ON public.project_coverages;
CREATE TRIGGER set_nombre_local_on_coverage
    BEFORE INSERT OR UPDATE ON public.project_coverages
    FOR EACH ROW
    EXECUTE FUNCTION update_nombre_local_on_coverage();

-- 6. Función para migrar datos existentes (opcional, ejecutar si hay datos)
CREATE OR REPLACE FUNCTION migrate_existing_coverages_to_hybrid()
RETURNS TABLE(migrated_count INTEGER, updated_count INTEGER) AS $$
DECLARE
    coverage_record RECORD;
    migrated INTEGER := 0;
    updated INTEGER := 0;
BEGIN
    -- Iterar sobre coberturas existentes sin procesar
    FOR coverage_record IN 
        SELECT id, name, coverage_type, parent_name
        FROM public.project_coverages 
        WHERE hybrid_processed = FALSE OR hybrid_processed IS NULL
    LOOP
        -- Generar location_id básico basado en datos existentes
        IF coverage_record.coverage_type = 'pais' AND coverage_record.name = 'Guatemala' THEN
            UPDATE public.project_coverages 
            SET 
                location_id = 'GTM-COUNTRY',
                country_code = 'GTM',
                hierarchy_level = 1,
                full_path = 'Guatemala',
                hybrid_processed = TRUE
            WHERE id = coverage_record.id;
            updated := updated + 1;
            
        ELSIF coverage_record.coverage_type = 'departamento' AND coverage_record.parent_name = 'Guatemala' THEN
            UPDATE public.project_coverages 
            SET 
                location_id = 'GTM-DEPT-' || UPPER(REPLACE(REPLACE(coverage_record.name, ' ', ''), 'ñ', 'N')),
                country_code = 'GTM',
                hierarchy_level = 2,
                full_path = 'Guatemala > ' || coverage_record.name,
                hybrid_processed = TRUE
            WHERE id = coverage_record.id;
            updated := updated + 1;
            
        ELSIF coverage_record.coverage_type = 'ciudad' THEN
            UPDATE public.project_coverages 
            SET 
                location_id = 'GTM-CITY-' || UPPER(REPLACE(REPLACE(coverage_record.name, ' ', ''), 'ñ', 'N')),
                country_code = 'GTM',
                hierarchy_level = 3,
                full_path = COALESCE(coverage_record.parent_name, 'Guatemala') || ' > ' || coverage_record.name,
                hybrid_processed = TRUE
            WHERE id = coverage_record.id;
            updated := updated + 1;
            
        ELSIF coverage_record.coverage_type = 'zona' THEN
            UPDATE public.project_coverages 
            SET 
                location_id = 'GTM-ZONE-' || UPPER(REPLACE(coverage_record.name, ' ', '')),
                country_code = 'GTM',
                hierarchy_level = 4,
                full_path = 'Guatemala > Guatemala > ' || coverage_record.name,
                hybrid_processed = TRUE
            WHERE id = coverage_record.id;
            updated := updated + 1;
        END IF;
        
        migrated := migrated + 1;
    END LOOP;
    
    RETURN QUERY SELECT migrated, updated;
END;
$$ LANGUAGE plpgsql;

-- 7. Comentarios para documentación
COMMENT ON COLUMN public.project_coverages.location_id IS 'Identificador único de ubicación (GTM-DEPT-QUETZ, MEX-STATE-CDMX)';
COMMENT ON COLUMN public.project_coverages.hybrid_processed IS 'Indica si fue procesado por el sistema híbrido';
COMMENT ON COLUMN public.project_coverages.hierarchy_level IS 'Nivel jerárquico: 1=país, 2=región/estado, 3=ciudad, 4=zona';
COMMENT ON COLUMN public.project_coverages.country_code IS 'Código ISO de país (GTM, MEX, USA, COL, etc.)';
COMMENT ON COLUMN public.project_coverages.full_path IS 'Ruta completa jerárquica (País > Región > Ciudad)';
COMMENT ON COLUMN public.project_coverages.findings_count IS 'Número de hallazgos agrupados en esta ubicación';
COMMENT ON COLUMN public.project_coverages.nombre_local IS 'Nomenclatura local según país (Municipio, Estado, Provincia, etc.)';
COMMENT ON COLUMN public.project_coverages.hybrid_metadata IS 'Metadatos adicionales del procesamiento híbrido';

COMMIT;

-- ===================================================================
-- INSTRUCCIONES POST-MIGRACIÓN:
-- ===================================================================
-- 1. Para migrar datos existentes ejecutar:
--    SELECT * FROM migrate_existing_coverages_to_hybrid();
--
-- 2. Para verificar la migración:
--    SELECT coverage_type, nombre_local, location_id, full_path 
--    FROM project_coverages WHERE hybrid_processed = TRUE;
--
-- 3. El sistema automáticamente asignará nombre_local basado en:
--    Guatemala: País, Departamento, Municipio, Zona
--    México: País, Estado, Municipio, Localidad
--    USA: Country, State, City, District
--    Colombia: País, Departamento, Municipio, Corregimiento
--    Argentina: País, Provincia, Partido, Localidad
--    España: País, Comunidad Autónoma, Provincia, Municipio
-- =================================================================== 