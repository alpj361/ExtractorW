-- ===================================================================
-- MIGRACIÓN: Sistema Geográfico Híbrido con IA
-- Reemplaza project_coverages con un sistema flexible y escalable
-- Incluye soporte para aliases, jerarquías por país y detección por IA
-- ===================================================================

BEGIN;

-- ===================================================================
-- 1. TABLA DE JERARQUÍAS GEOGRÁFICAS POR PAÍS
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.geographic_hierarchies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(3) NOT NULL, -- GTM, MEX, USA, COL, etc.
    country_name VARCHAR(100) NOT NULL,
    level_order INTEGER NOT NULL, -- 1=País, 2=Estado/Departamento, 3=Ciudad, etc.
    level_name VARCHAR(50) NOT NULL, -- "Departamento", "Estado", "Municipio", etc.
    level_code VARCHAR(20) NOT NULL, -- "DEPT", "STATE", "CITY", "ZONE", etc.
    examples JSONB DEFAULT '[]'::jsonb, -- ["Quetzaltenango", "Guatemala"]
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(country_code, level_order),
    UNIQUE(country_code, level_code)
);

-- ===================================================================
-- 2. TABLA DE UBICACIONES GEOGRÁFICAS (reemplaza project_coverages)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.geographic_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id VARCHAR(100) UNIQUE NOT NULL, -- GTM-DEPT-QUETZ, GTM-CITY-GUAT, etc.
    country_code VARCHAR(3) NOT NULL,
    hierarchy_level INTEGER NOT NULL, -- 1, 2, 3, 4...
    level_code VARCHAR(20) NOT NULL, -- COUNTRY, DEPT, CITY, ZONE
    
    -- Nombres y identificación
    name VARCHAR(200) NOT NULL, -- "Quetzaltenango"
    local_name VARCHAR(200), -- Nombre en idioma local si es diferente
    official_name VARCHAR(200), -- Nombre oficial completo
    alternative_names TEXT[], -- Nombres alternativos, abreviaciones
    
    -- Sistema de aliases expandido
    aliases JSONB DEFAULT '{}'::jsonb, -- Estructura completa de apodos y variantes
    
    -- Jerarquía
    parent_location_id VARCHAR(100) REFERENCES public.geographic_locations(location_id),
    full_path TEXT NOT NULL, -- "Guatemala > Quetzaltenango > Coatepeque"
    path_ids TEXT NOT NULL, -- "GTM > GTM-DEPT-QUETZ > GTM-CITY-COAT"
    
    -- Metadatos geográficos
    coordinates JSONB, -- {"lat": 14.6349, "lng": -90.5069, "bounds": {...}}
    area_km2 DECIMAL(10,2),
    population INTEGER,
    timezone VARCHAR(50),
    
    -- Estadísticas de uso
    findings_count INTEGER DEFAULT 0,
    projects_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    
    -- Fuente y confianza
    detection_source VARCHAR(50) DEFAULT 'manual' CHECK (detection_source IN ('manual', 'ai_detection', 'wikipedia', 'osm', 'hybrid_ai')),
    confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    ai_enriched BOOLEAN DEFAULT FALSE,
    
    -- Datos adicionales
    metadata JSONB DEFAULT '{}'::jsonb, -- economía, demografía, etc.
    administrative_data JSONB DEFAULT '{}'::jsonb, -- códigos oficiales, etc.
    
    -- Control
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Key
    FOREIGN KEY (country_code, hierarchy_level) REFERENCES public.geographic_hierarchies(country_code, level_order)
);

-- ===================================================================
-- 3. TABLA DE ASOCIACIONES PROYECTO-UBICACIÓN (reemplaza project_coverages)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.project_geographic_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    location_id VARCHAR(100) REFERENCES public.geographic_locations(location_id) NOT NULL,
    
    -- Contexto del proyecto en esta ubicación
    coverage_type VARCHAR(50) DEFAULT 'detected' CHECK (coverage_type IN ('detected', 'planned', 'excluded', 'confirmed')),
    relevance VARCHAR(20) DEFAULT 'medium' CHECK (relevance IN ('low', 'medium', 'high', 'critical')),
    findings_count INTEGER DEFAULT 0,
    
    -- Fuente de la asociación
    detection_source VARCHAR(50) DEFAULT 'ai_detection' CHECK (detection_source IN ('manual', 'ai_detection', 'transcription', 'document_analysis', 'hybrid_ai')),
    source_card_id UUID REFERENCES public.capturado_cards(id) ON DELETE SET NULL,
    source_item_id UUID REFERENCES public.codex_items(id) ON DELETE SET NULL,
    
    -- Metadatos específicos del proyecto
    project_context JSONB DEFAULT '{}'::jsonb, -- temas, hallazgos específicos, etc.
    tags TEXT[],
    description TEXT, -- Descripción específica para este proyecto
    
    -- Control temporal
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(project_id, location_id)
);

-- ===================================================================
-- 4. ÍNDICES PARA OPTIMIZACIÓN
-- ===================================================================

-- Índices para geographic_hierarchies
CREATE INDEX IF NOT EXISTS idx_geographic_hierarchies_country ON public.geographic_hierarchies(country_code);
CREATE INDEX IF NOT EXISTS idx_geographic_hierarchies_level ON public.geographic_hierarchies(level_order);

-- Índices para geographic_locations
CREATE INDEX IF NOT EXISTS idx_geographic_locations_country ON public.geographic_locations(country_code);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_level ON public.geographic_locations(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_name ON public.geographic_locations(name);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_parent ON public.geographic_locations(parent_location_id);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_source ON public.geographic_locations(detection_source);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_active ON public.geographic_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_findings ON public.geographic_locations(findings_count);

-- Índices especiales para búsqueda de aliases
CREATE INDEX IF NOT EXISTS idx_geographic_locations_aliases ON public.geographic_locations USING GIN(aliases);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_alt_names ON public.geographic_locations USING GIN(alternative_names);
CREATE INDEX IF NOT EXISTS idx_geographic_locations_search ON public.geographic_locations USING GIN(to_tsvector('spanish', name || ' ' || coalesce(local_name, '') || ' ' || coalesce(official_name, '')));

-- Índices para project_geographic_coverage
CREATE INDEX IF NOT EXISTS idx_project_geographic_coverage_project ON public.project_geographic_coverage(project_id);
CREATE INDEX IF NOT EXISTS idx_project_geographic_coverage_location ON public.project_geographic_coverage(location_id);
CREATE INDEX IF NOT EXISTS idx_project_geographic_coverage_type ON public.project_geographic_coverage(coverage_type);
CREATE INDEX IF NOT EXISTS idx_project_geographic_coverage_source ON public.project_geographic_coverage(detection_source);
CREATE INDEX IF NOT EXISTS idx_project_geographic_coverage_relevance ON public.project_geographic_coverage(relevance);
CREATE INDEX IF NOT EXISTS idx_project_geographic_coverage_tags ON public.project_geographic_coverage USING GIN(tags);

-- ===================================================================
-- 5. FUNCIONES AUXILIARES
-- ===================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_geographic()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_geographic_hierarchies_updated_at ON public.geographic_hierarchies;
CREATE TRIGGER update_geographic_hierarchies_updated_at
    BEFORE UPDATE ON public.geographic_hierarchies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_geographic();

DROP TRIGGER IF EXISTS update_geographic_locations_updated_at ON public.geographic_locations;
CREATE TRIGGER update_geographic_locations_updated_at
    BEFORE UPDATE ON public.geographic_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_geographic();

DROP TRIGGER IF EXISTS update_project_geographic_coverage_updated_at ON public.project_geographic_coverage;
CREATE TRIGGER update_project_geographic_coverage_updated_at
    BEFORE UPDATE ON public.project_geographic_coverage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_geographic();

-- Función para generar location_id automáticamente
CREATE OR REPLACE FUNCTION generate_location_id(
    p_country_code TEXT,
    p_level_code TEXT,
    p_name TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN UPPER(p_country_code || '-' || p_level_code || '-' || 
                 REGEXP_REPLACE(
                     REGEXP_REPLACE(UPPER(p_name), '[^A-Z0-9]', '', 'g'),
                     '(.{20}).*', '\1' -- Limitar a 20 caracteres
                 ));
END;
$$ LANGUAGE plpgsql;

-- Función de búsqueda inteligente por aliases
CREATE OR REPLACE FUNCTION search_locations_by_alias(
    p_query TEXT,
    p_country_code TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
) RETURNS TABLE(
    location_id VARCHAR(100),
    name VARCHAR(200),
    full_path TEXT,
    confidence_score DECIMAL(3,2),
    matched_alias TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gl.location_id,
        gl.name,
        gl.full_path,
        gl.confidence_score,
        p_query as matched_alias
    FROM geographic_locations gl
    WHERE 
        (p_country_code IS NULL OR gl.country_code = p_country_code)
        AND gl.is_active = true
        AND (
            gl.name ILIKE '%' || p_query || '%'
            OR gl.local_name ILIKE '%' || p_query || '%'
            OR gl.official_name ILIKE '%' || p_query || '%'
            OR p_query = ANY(gl.alternative_names)
            OR gl.aliases::text ILIKE '%' || p_query || '%'
        )
    ORDER BY 
        CASE 
            WHEN gl.name ILIKE p_query THEN 1
            WHEN gl.name ILIKE p_query || '%' THEN 2
            WHEN p_query = ANY(gl.alternative_names) THEN 3
            ELSE 4
        END,
        gl.confidence_score DESC,
        gl.findings_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 6. DATOS INICIALES: GUATEMALA
-- ===================================================================

-- Insertar jerarquía de Guatemala
INSERT INTO public.geographic_hierarchies (country_code, country_name, level_order, level_name, level_code, examples) VALUES
('GTM', 'Guatemala', 1, 'País', 'COUNTRY', '["Guatemala"]'),
('GTM', 'Guatemala', 2, 'Departamento', 'DEPARTMENT', '["Guatemala", "Quetzaltenango", "Petén"]'),
('GTM', 'Guatemala', 3, 'Municipio', 'MUNICIPALITY', '["Guatemala", "Quetzaltenango", "Flores"]'),
('GTM', 'Guatemala', 4, 'Zona/Aldea', 'ZONE', '["Zona 1", "Zona 10", "Aldea El Naranjo"]')
ON CONFLICT (country_code, level_order) DO NOTHING;

-- Insertar ubicación principal: Guatemala (país)
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, official_name, full_path, path_ids,
    coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM',
    'GTM', 1, 'COUNTRY',
    'Guatemala', 'República de Guatemala',
    'Guatemala', 'GTM',
    '{"lat": 15.783471, "lng": -90.230759, "bounds": {"north": 17.8193, "south": 13.7378, "east": -88.2251, "west": -92.2714}}',
    'manual', 1.0,
    '{"common_names": ["Guate", "GT"], "formal_variants": ["República de Guatemala"], "abbreviations": ["GT", "GUA"]}',
    ARRAY['Guate', 'GT', 'GUA', 'República de Guatemala']
) ON CONFLICT (location_id) DO NOTHING;

-- ===================================================================
-- 7. POLÍTICAS RLS (Row Level Security)
-- ===================================================================

-- Habilitar RLS
ALTER TABLE public.geographic_hierarchies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geographic_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_geographic_coverage ENABLE ROW LEVEL SECURITY;

-- Políticas para service role (bypass completo)
CREATE POLICY "Service role bypass geographic_hierarchies" ON public.geographic_hierarchies
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role bypass geographic_locations" ON public.geographic_locations
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role bypass project_geographic_coverage" ON public.project_geographic_coverage
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Políticas para usuarios normales (lectura pública de ubicaciones)
CREATE POLICY "Users can read geographic hierarchies" ON public.geographic_hierarchies
    FOR SELECT USING (true);

CREATE POLICY "Users can read active geographic locations" ON public.geographic_locations
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view project coverage of own projects" ON public.project_geographic_coverage
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

-- Políticas de escritura (solo para proyectos propios)
CREATE POLICY "Users can insert project coverage to own projects" ON public.project_geographic_coverage
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_id 
            AND (
                projects.user_id = auth.uid() OR 
                auth.uid() = ANY(projects.collaborators)
            )
        )
    );

CREATE POLICY "Users can update project coverage of own projects" ON public.project_geographic_coverage
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_id 
            AND (
                projects.user_id = auth.uid() OR 
                auth.uid() = ANY(projects.collaborators)
            )
        )
    );

-- ===================================================================
-- 8. COMENTARIOS DE DOCUMENTACIÓN
-- ===================================================================

COMMENT ON TABLE public.geographic_hierarchies IS 'Define la estructura jerárquica geográfica por país (ej: País > Departamento > Municipio para Guatemala)';
COMMENT ON TABLE public.geographic_locations IS 'Almacena todas las ubicaciones geográficas con soporte para aliases y detección por IA';
COMMENT ON TABLE public.project_geographic_coverage IS 'Asocia proyectos con ubicaciones geográficas específicas';

COMMENT ON COLUMN public.geographic_locations.aliases IS 'Estructura JSONB con apodos y nombres alternativos: {"common_names": ["Xela"], "local_slang": ["La Ciudad"]}';
COMMENT ON COLUMN public.geographic_locations.location_id IS 'ID único generado: GTM-DEPT-QUETZ, GTM-CITY-GUAT, etc.';
COMMENT ON COLUMN public.geographic_locations.full_path IS 'Ruta jerárquica completa: "Guatemala > Quetzaltenango > Coatepeque"';

COMMIT;

-- ===================================================================
-- 9. VERIFICACIÓN DE LA MIGRACIÓN
-- ===================================================================

DO $$
DECLARE
    table_count INTEGER;
    hierarchy_count INTEGER;
    location_count INTEGER;
BEGIN
    -- Verificar tablas creadas
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('geographic_hierarchies', 'geographic_locations', 'project_geographic_coverage');
    
    -- Verificar datos iniciales
    SELECT COUNT(*) INTO hierarchy_count FROM public.geographic_hierarchies WHERE country_code = 'GTM';
    SELECT COUNT(*) INTO location_count FROM public.geographic_locations WHERE country_code = 'GTM';
    
    IF table_count = 3 AND hierarchy_count >= 4 AND location_count >= 1 THEN
        RAISE NOTICE '✅ Migración completada exitosamente:';
        RAISE NOTICE '   📊 % tablas creadas', table_count;
        RAISE NOTICE '   🇬🇹 % niveles jerárquicos de Guatemala', hierarchy_count; 
        RAISE NOTICE '   📍 % ubicaciones iniciales', location_count;
        RAISE NOTICE '   🔍 Sistema de aliases configurado';
        RAISE NOTICE '   🤖 Listo para detección híbrida con IA';
    ELSE
        RAISE WARNING '⚠️ Migración incompleta: tablas=%, jerarquías=%, ubicaciones=%', table_count, hierarchy_count, location_count;
    END IF;
END $$; 