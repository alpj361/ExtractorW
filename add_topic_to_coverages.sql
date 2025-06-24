-- Migración: Agregar columna topic a project_coverages
-- Fecha: 2024-01-XX
-- Descripción: Agregar soporte para temas/topics en coberturas de proyecto

BEGIN;

-- Agregar columna topic a project_coverages
ALTER TABLE project_coverages 
ADD COLUMN IF NOT EXISTS topic VARCHAR(100);

-- Crear índice para mejorar consultas por topic
CREATE INDEX IF NOT EXISTS idx_project_coverages_topic 
ON project_coverages(topic);

-- Crear índice compuesto para consultas por proyecto y tema
CREATE INDEX IF NOT EXISTS idx_project_coverages_project_topic 
ON project_coverages(project_id, topic);

-- Actualizar coberturas existentes con topic por defecto
UPDATE project_coverages 
SET topic = 'General' 
WHERE topic IS NULL;

-- Agregar comentario a la columna
COMMENT ON COLUMN project_coverages.topic IS 'Tema o categoría de la cobertura extraída de los hallazgos';

COMMIT;

-- Verificar la migración
DO $$
BEGIN
    -- Verificar que la columna existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_coverages' 
        AND column_name = 'topic'
    ) THEN
        RAISE NOTICE '✅ Columna topic agregada exitosamente a project_coverages';
    ELSE
        RAISE EXCEPTION '❌ Error: No se pudo agregar la columna topic';
    END IF;

    -- Verificar índices
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'project_coverages' 
        AND indexname = 'idx_project_coverages_topic'
    ) THEN
        RAISE NOTICE '✅ Índice idx_project_coverages_topic creado exitosamente';
    END IF;

    -- Mostrar estadísticas
    RAISE NOTICE '📊 Registros actualizados en project_coverages: %', 
        (SELECT COUNT(*) FROM project_coverages WHERE topic = 'General');
        
END $$; 