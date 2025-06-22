-- ===================================================================
-- MIGRACIÓN: Crear tabla project_coverages para gestión de coberturas geográficas
-- Almacena zonas, ciudades, departamentos y países cubiertos por cada proyecto
-- Fecha: Junio 2025
-- ===================================================================

BEGIN;

-- 1. Crear tabla principal de coberturas
CREATE TABLE IF NOT EXISTS public.project_coverages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    
    -- Información geográfica
    coverage_type VARCHAR(50) NOT NULL CHECK (coverage_type IN ('pais', 'departamento', 'ciudad', 'zona', 'region')),
    name TEXT NOT NULL, -- Nombre del lugar (ej: "Guatemala", "Quetzaltenango", "Zona 1")
    parent_name TEXT, -- Nombre del nivel superior (ej: para ciudad -> departamento)
    coordinates JSONB, -- {"lat": 14.6349, "lng": -90.5069} para ubicación exacta
    
    -- Metadatos de detección
    detection_source VARCHAR(50) DEFAULT 'manual' CHECK (detection_source IN ('manual', 'ai_detection', 'transcription', 'document_analysis')),
    confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    source_item_id UUID REFERENCES public.codex_items(id) ON DELETE SET NULL, -- De qué item se detectó
    source_card_id UUID REFERENCES public.capturado_cards(id) ON DELETE SET NULL, -- De qué card se agregó
    
    -- Información adicional
    description TEXT, -- Descripción del contexto de cobertura
    relevance VARCHAR(20) DEFAULT 'medium' CHECK (relevance IN ('low', 'medium', 'high', 'critical')),
    coverage_status VARCHAR(20) DEFAULT 'active' CHECK (coverage_status IN ('active', 'planned', 'completed', 'excluded')),
    
    -- Metadatos del hallazgo
    discovery_context TEXT, -- Contexto en el que se encontró esta cobertura
    tags TEXT[], -- Etiquetas adicionales
    extra_data JSONB DEFAULT '{}'::jsonb, -- Datos adicionales flexibles
    
    -- Control de duplicados
    UNIQUE(project_id, coverage_type, name, parent_name),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_project_coverages_project ON public.project_coverages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_coverages_type ON public.project_coverages(coverage_type);
CREATE INDEX IF NOT EXISTS idx_project_coverages_name ON public.project_coverages(name);
CREATE INDEX IF NOT EXISTS idx_project_coverages_parent ON public.project_coverages(parent_name);
CREATE INDEX IF NOT EXISTS idx_project_coverages_source ON public.project_coverages(detection_source);
CREATE INDEX IF NOT EXISTS idx_project_coverages_status ON public.project_coverages(coverage_status);
CREATE INDEX IF NOT EXISTS idx_project_coverages_relevance ON public.project_coverages(relevance);
CREATE INDEX IF NOT EXISTS idx_project_coverages_source_item ON public.project_coverages(source_item_id);
CREATE INDEX IF NOT EXISTS idx_project_coverages_source_card ON public.project_coverages(source_card_id);
CREATE INDEX IF NOT EXISTS idx_project_coverages_tags ON public.project_coverages USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_project_coverages_coordinates ON public.project_coverages USING GIN(coordinates);

-- 3. Habilitar RLS y crear políticas de seguridad
ALTER TABLE public.project_coverages ENABLE ROW LEVEL SECURITY;

-- Política para service role (bypass completo)
CREATE POLICY "Service role bypass" ON public.project_coverages
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Políticas para usuarios normales
CREATE POLICY "Users can view coverages of own projects" ON public.project_coverages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_id 
            AND (
                projects.user_id = auth.uid() OR 
                auth.uid() = ANY(projects.collaborators) OR
                projects.visibility = 'public'
            )
        )
    );

CREATE POLICY "Users can insert coverages to own projects" ON public.project_coverages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_id 
            AND (
                projects.user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.project_collaborators 
                    WHERE project_id = projects.id 
                    AND user_id = auth.uid() 
                    AND role IN ('owner', 'admin', 'editor')
                )
            )
        )
    );

CREATE POLICY "Users can update coverages of own projects" ON public.project_coverages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_id 
            AND (
                projects.user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.project_collaborators 
                    WHERE project_id = projects.id 
                    AND user_id = auth.uid() 
                    AND role IN ('owner', 'admin', 'editor')
                )
            )
        )
    );

CREATE POLICY "Users can delete coverages of own projects" ON public.project_coverages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_id 
            AND (
                projects.user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.project_collaborators 
                    WHERE project_id = projects.id 
                    AND user_id = auth.uid() 
                    AND role IN ('owner', 'admin', 'editor')
                )
            )
        )
    );

-- 4. Crear función para trigger de updated_at
CREATE OR REPLACE FUNCTION handle_updated_at_project_coverages()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear trigger para updated_at automático
DROP TRIGGER IF EXISTS set_updated_at_project_coverages ON public.project_coverages;
CREATE TRIGGER set_updated_at_project_coverages
    BEFORE UPDATE ON public.project_coverages
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at_project_coverages();

-- 6. Crear función para detectar coberturas automáticamente desde texto
CREATE OR REPLACE FUNCTION detect_coverage_from_text(
    input_text TEXT,
    project_uuid UUID,
    source_type VARCHAR(50) DEFAULT 'ai_detection',
    source_item_uuid UUID DEFAULT NULL,
    source_card_uuid UUID DEFAULT NULL
)
RETURNS TABLE(
    detected_count INTEGER,
    coverage_types TEXT[]
) AS $$
DECLARE
    guatemala_cities TEXT[] := ARRAY[
        'Guatemala', 'Mixco', 'Villa Nueva', 'Petapa', 'San Juan Sacatepéquez',
        'Quetzaltenango', 'Escuintla', 'Chinautla', 'Chimaltenango', 'Huehuetenango',
        'Amatitlán', 'Totonicapán', 'Santa Catarina Pinula', 'Santa Lucía Cotzumalguapa',
        'Puerto Barrios', 'San Marcos', 'Coatepeque', 'Jalapa', 'Cobán',
        'Chichicastenango', 'Antigua Guatemala', 'Retalhuleu', 'Mazatenango'
    ];
    guatemala_departments TEXT[] := ARRAY[
        'Guatemala', 'El Progreso', 'Sacatepéquez', 'Chimaltenango', 'Escuintla',
        'Santa Rosa', 'Sololá', 'Totonicapán', 'Quetzaltenango', 'Suchitepéquez',
        'Retalhuleu', 'San Marcos', 'Huehuetenango', 'Quiché', 'Baja Verapaz',
        'Alta Verapaz', 'Petén', 'Izabal', 'Zacapa', 'Chiquimula', 'Jalapa', 'Jutiapa'
    ];
    guatemala_zones TEXT[] := ARRAY[
        'Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Zona 5', 'Zona 6', 'Zona 7',
        'Zona 8', 'Zona 9', 'Zona 10', 'Zona 11', 'Zona 12', 'Zona 13', 'Zona 14',
        'Zona 15', 'Zona 16', 'Zona 17', 'Zona 18', 'Zona 19', 'Zona 20', 'Zona 21'
    ];
    
    detected_items TEXT[] := ARRAY[]::TEXT[];
    item TEXT;
    coverage_count INTEGER := 0;
    normalized_text TEXT;
BEGIN
    -- Normalizar texto para búsqueda
    normalized_text := UPPER(TRIM(input_text));
    
    -- Detectar países (Guatemala específicamente)
    IF normalized_text ~* '\b(GUATEMALA|REPÚBLICA DE GUATEMALA)\b' THEN
        INSERT INTO public.project_coverages (
            project_id, coverage_type, name, detection_source, confidence_score,
            source_item_id, source_card_id, discovery_context
        ) VALUES (
            project_uuid, 'pais', 'Guatemala', source_type, 0.95,
            source_item_uuid, source_card_uuid, 'Detectado automáticamente en texto'
        ) ON CONFLICT (project_id, coverage_type, name, parent_name) DO NOTHING;
        
        detected_items := array_append(detected_items, 'pais:Guatemala');
        coverage_count := coverage_count + 1;
    END IF;
    
    -- Detectar departamentos
    FOREACH item IN ARRAY guatemala_departments LOOP
        IF normalized_text ~* ('\b' || UPPER(item) || '\b') THEN
            INSERT INTO public.project_coverages (
                project_id, coverage_type, name, parent_name, detection_source, confidence_score,
                source_item_id, source_card_id, discovery_context
            ) VALUES (
                project_uuid, 'departamento', item, 'Guatemala', source_type, 0.85,
                source_item_uuid, source_card_uuid, 'Detectado automáticamente en texto'
            ) ON CONFLICT (project_id, coverage_type, name, parent_name) DO NOTHING;
            
            detected_items := array_append(detected_items, 'departamento:' || item);
            coverage_count := coverage_count + 1;
        END IF;
    END LOOP;
    
    -- Detectar ciudades
    FOREACH item IN ARRAY guatemala_cities LOOP
        IF normalized_text ~* ('\b' || UPPER(item) || '\b') THEN
            INSERT INTO public.project_coverages (
                project_id, coverage_type, name, detection_source, confidence_score,
                source_item_id, source_card_id, discovery_context
            ) VALUES (
                project_uuid, 'ciudad', item, source_type, 0.80,
                source_item_uuid, source_card_uuid, 'Detectado automáticamente en texto'
            ) ON CONFLICT (project_id, coverage_type, name, parent_name) DO NOTHING;
            
            detected_items := array_append(detected_items, 'ciudad:' || item);
            coverage_count := coverage_count + 1;
        END IF;
    END LOOP;
    
    -- Detectar zonas de Guatemala
    FOREACH item IN ARRAY guatemala_zones LOOP
        IF normalized_text ~* ('\b' || UPPER(item) || '\b') THEN
            INSERT INTO public.project_coverages (
                project_id, coverage_type, name, parent_name, detection_source, confidence_score,
                source_item_id, source_card_id, discovery_context
            ) VALUES (
                project_uuid, 'zona', item, 'Guatemala', source_type, 0.90,
                source_item_uuid, source_card_uuid, 'Detectado automáticamente en texto'
            ) ON CONFLICT (project_id, coverage_type, name, parent_name) DO NOTHING;
            
            detected_items := array_append(detected_items, 'zona:' || item);
            coverage_count := coverage_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT coverage_count, detected_items;
END;
$$ LANGUAGE plpgsql;

-- 7. Agregar comentarios de documentación
COMMENT ON TABLE public.project_coverages IS 'Almacena las coberturas geográficas (países, departamentos, ciudades, zonas) de cada proyecto';
COMMENT ON COLUMN public.project_coverages.coverage_type IS 'Tipo de cobertura: pais, departamento, ciudad, zona, region';
COMMENT ON COLUMN public.project_coverages.name IS 'Nombre del lugar geográfico';
COMMENT ON COLUMN public.project_coverages.parent_name IS 'Nombre del nivel geográfico superior (departamento para ciudad, país para departamento)';
COMMENT ON COLUMN public.project_coverages.coordinates IS 'Coordenadas GPS en formato JSON: {"lat": 14.6349, "lng": -90.5069}';
COMMENT ON COLUMN public.project_coverages.detection_source IS 'Origen de la detección: manual, ai_detection, transcription, document_analysis';
COMMENT ON COLUMN public.project_coverages.confidence_score IS 'Puntuación de confianza de la detección automática (0.0-1.0)';
COMMENT ON COLUMN public.project_coverages.source_item_id IS 'ID del item de codex del cual se detectó esta cobertura';
COMMENT ON COLUMN public.project_coverages.source_card_id IS 'ID de la card capturada desde la cual se agregó esta cobertura';
COMMENT ON COLUMN public.project_coverages.discovery_context IS 'Contexto en el que se descubrió esta cobertura geográfica';

COMMIT;

-- ===================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN
-- ===================================================================

-- Verificar que la tabla se creó correctamente
DO $$
DECLARE
    table_exists BOOLEAN;
    columns_count INTEGER;
BEGIN
    -- Verificar existencia de tabla
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_coverages'
    ) INTO table_exists;
    
    -- Contar columnas
    SELECT COUNT(*) INTO columns_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'project_coverages';
    
    IF table_exists AND columns_count >= 18 THEN
        RAISE NOTICE '✅ Migración exitosa: tabla project_coverages creada con % columnas', columns_count;
        RAISE NOTICE '✅ Función detect_coverage_from_text() creada para detección automática';
        RAISE NOTICE '✅ Políticas RLS configuradas para seguridad';
        RAISE NOTICE '✅ Índices creados para optimización de consultas';
    ELSE
        RAISE WARNING '⚠️ Migración incompleta: tabla_existe=%, columnas=%', table_exists, columns_count;
    END IF;
END $$;

-- Mostrar estructura de la tabla para verificación
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'project_coverages'
ORDER BY ordinal_position;

-- Ejemplo de inserción de datos de prueba (comentado)
/*
-- Insertar algunas coberturas de ejemplo
INSERT INTO public.project_coverages (
    project_id, coverage_type, name, parent_name, detection_source, 
    confidence_score, description, relevance
) VALUES 
(
    '00000000-0000-0000-0000-000000000000', -- Reemplazar con project_id real
    'pais', 'Guatemala', NULL, 'manual', 1.0,
    'Cobertura nacional del proyecto', 'high'
),
(
    '00000000-0000-0000-0000-000000000000', -- Reemplazar con project_id real
    'departamento', 'Guatemala', 'Guatemala', 'manual', 1.0,
    'Cobertura departamental', 'high'
),
(
    '00000000-0000-0000-0000-000000000000', -- Reemplazar con project_id real
    'ciudad', 'Guatemala', 'Guatemala', 'manual', 1.0,
    'Cobertura de la capital', 'high'
);
*/

SELECT 'Migración de project_coverages completada exitosamente' AS status; 