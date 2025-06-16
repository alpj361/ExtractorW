-- ===================================================================
-- MIGRACIÓN: SISTEMA DE DECISIONES EN CAPAS
-- Actualizar tabla project_decisions para soporte de campos específicos
-- Fecha: Enero 2025
-- ===================================================================

BEGIN;

-- 1. AGREGAR NUEVOS CAMPOS GENERALES PARA EL SISTEMA DE CAPAS
ALTER TABLE public.project_decisions 
ADD COLUMN IF NOT EXISTS change_description TEXT,
ADD COLUMN IF NOT EXISTS objective TEXT,
ADD COLUMN IF NOT EXISTS next_steps TEXT,
ADD COLUMN IF NOT EXISTS deadline DATE;

-- 2. AGREGAR CAMPOS ESPECÍFICOS PARA ENFOQUE
ALTER TABLE public.project_decisions 
ADD COLUMN IF NOT EXISTS focus_area TEXT,
ADD COLUMN IF NOT EXISTS focus_context TEXT;

-- 3. AGREGAR CAMPOS ESPECÍFICOS PARA ALCANCE
ALTER TABLE public.project_decisions 
ADD COLUMN IF NOT EXISTS geographic_scope TEXT,
ADD COLUMN IF NOT EXISTS monetary_scope TEXT,
ADD COLUMN IF NOT EXISTS time_period_start DATE,
ADD COLUMN IF NOT EXISTS time_period_end DATE,
ADD COLUMN IF NOT EXISTS target_entities TEXT,
ADD COLUMN IF NOT EXISTS scope_limitations TEXT;

-- 4. AGREGAR CAMPOS ESPECÍFICOS PARA CONFIGURACIÓN
ALTER TABLE public.project_decisions 
ADD COLUMN IF NOT EXISTS output_format TEXT[],
ADD COLUMN IF NOT EXISTS methodology TEXT,
ADD COLUMN IF NOT EXISTS data_sources TEXT,
ADD COLUMN IF NOT EXISTS search_locations TEXT,
ADD COLUMN IF NOT EXISTS tools_required TEXT,
ADD COLUMN IF NOT EXISTS references TEXT[];

-- 5. ACTUALIZAR CONSTRAINT DE DECISION_TYPE
-- Primero eliminar el constraint existente
ALTER TABLE public.project_decisions 
DROP CONSTRAINT IF EXISTS project_decisions_decision_type_check;

-- Agregar nuevo constraint con tipos actualizados
ALTER TABLE public.project_decisions 
ADD CONSTRAINT project_decisions_decision_type_check 
CHECK (decision_type IN ('enfoque', 'alcance', 'configuracion'));

-- 6. ACTUALIZAR VALOR POR DEFECTO
ALTER TABLE public.project_decisions 
ALTER COLUMN decision_type SET DEFAULT 'enfoque';

-- 7. MIGRAR DATOS EXISTENTES (si los hay)
-- strategic -> enfoque, tactical -> alcance, operational -> configuracion
UPDATE public.project_decisions 
SET decision_type = CASE 
  WHEN decision_type = 'strategic' THEN 'enfoque'
  WHEN decision_type = 'tactical' THEN 'alcance'
  WHEN decision_type = 'operational' THEN 'configuracion'
  WHEN decision_type = 'research' THEN 'enfoque'
  WHEN decision_type = 'analytical' THEN 'configuracion'
  ELSE 'enfoque'
END
WHERE decision_type NOT IN ('enfoque', 'alcance', 'configuracion');

-- 8. CREAR ÍNDICES PARA LOS NUEVOS CAMPOS
CREATE INDEX IF NOT EXISTS idx_project_decisions_focus_area 
ON public.project_decisions(focus_area);

CREATE INDEX IF NOT EXISTS idx_project_decisions_geographic_scope 
ON public.project_decisions(geographic_scope);

CREATE INDEX IF NOT EXISTS idx_project_decisions_deadline 
ON public.project_decisions(deadline);

CREATE INDEX IF NOT EXISTS idx_project_decisions_output_format 
ON public.project_decisions USING GIN(output_format);

CREATE INDEX IF NOT EXISTS idx_project_decisions_references 
ON public.project_decisions USING GIN(references);

-- 9. ACTUALIZAR COMENTARIOS EN LA TABLA
COMMENT ON COLUMN public.project_decisions.decision_type IS 'Tipo de decisión: enfoque (qué), alcance (cuánto/dónde), configuracion (cómo)';
COMMENT ON COLUMN public.project_decisions.change_description IS 'Descripción del cambio que representa esta decisión';
COMMENT ON COLUMN public.project_decisions.objective IS 'Objetivo específico de esta decisión';
COMMENT ON COLUMN public.project_decisions.next_steps IS 'Siguientes pasos tras tomar esta decisión';
COMMENT ON COLUMN public.project_decisions.deadline IS 'Fecha límite opcional para implementar la decisión';

-- Comentarios para campos de ENFOQUE
COMMENT ON COLUMN public.project_decisions.focus_area IS 'Área de enfoque principal (tipo: enfoque)';
COMMENT ON COLUMN public.project_decisions.focus_context IS 'Contexto adicional del enfoque (tipo: enfoque)';

-- Comentarios para campos de ALCANCE
COMMENT ON COLUMN public.project_decisions.geographic_scope IS 'Ámbito geográfico del proyecto (tipo: alcance)';
COMMENT ON COLUMN public.project_decisions.monetary_scope IS 'Ámbito monetario o presupuestario (tipo: alcance)';
COMMENT ON COLUMN public.project_decisions.time_period_start IS 'Inicio del período temporal (tipo: alcance)';
COMMENT ON COLUMN public.project_decisions.time_period_end IS 'Fin del período temporal (tipo: alcance)';
COMMENT ON COLUMN public.project_decisions.target_entities IS 'Entidades o instituciones objetivo (tipo: alcance)';
COMMENT ON COLUMN public.project_decisions.scope_limitations IS 'Limitaciones específicas del alcance (tipo: alcance)';

-- Comentarios para campos de CONFIGURACIÓN
COMMENT ON COLUMN public.project_decisions.output_format IS 'Formatos de salida deseados - array para selección múltiple (tipo: configuracion)';
COMMENT ON COLUMN public.project_decisions.methodology IS 'Metodología a utilizar (tipo: configuracion)';
COMMENT ON COLUMN public.project_decisions.data_sources IS 'Fuentes de datos a utilizar (tipo: configuracion)';
COMMENT ON COLUMN public.project_decisions.search_locations IS 'Ubicaciones donde buscar información (tipo: configuracion)';
COMMENT ON COLUMN public.project_decisions.tools_required IS 'Herramientas necesarias para la implementación (tipo: configuracion)';
COMMENT ON COLUMN public.project_decisions.references IS 'Referencias y enlaces relevantes - array (tipo: configuracion)';

COMMIT;

-- ===================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN
-- ===================================================================

-- Verificar que los nuevos campos se crearon
DO $$
DECLARE
    new_columns_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO new_columns_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'project_decisions'
    AND column_name IN (
        'change_description', 'objective', 'next_steps', 'deadline',
        'focus_area', 'focus_context', 
        'geographic_scope', 'monetary_scope', 'time_period_start', 'time_period_end', 'target_entities', 'scope_limitations',
        'output_format', 'methodology', 'data_sources', 'search_locations', 'tools_required', 'references'
    );
    
    IF new_columns_count = 18 THEN
        RAISE NOTICE '✅ Migración exitosa: % nuevos campos agregados a project_decisions', new_columns_count;
    ELSE
        RAISE WARNING '⚠️ Migración incompleta: Solo % de 18 campos fueron agregados', new_columns_count;
    END IF;
END $$;

-- Mostrar estructura actualizada de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'project_decisions'
ORDER BY ordinal_position; 