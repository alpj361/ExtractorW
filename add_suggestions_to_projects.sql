-- ===================================================================
-- MIGRACIÓN: Agregar campo 'suggestions' a la tabla projects
-- Para almacenar sugerencias de IA persistentemente en la base de datos
-- ===================================================================

-- Agregar campo 'suggestions' como JSONB para almacenar las sugerencias
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS suggestions JSONB DEFAULT NULL;

-- Crear índice para búsquedas eficientes en el campo suggestions
CREATE INDEX IF NOT EXISTS idx_projects_suggestions 
ON public.projects USING GIN(suggestions);

-- Comentario para documentar el campo
COMMENT ON COLUMN public.projects.suggestions IS 'Almacena las sugerencias de IA para el proyecto en formato JSON. Incluye array de sugerencias, análisis y timestamp de generación.';

-- Ejemplo de estructura JSON que se almacenará:
-- {
--   "suggestions": [
--     {
--       "id": "uuid",
--       "title": "Título de la sugerencia",
--       "description": "Descripción detallada",
--       "category": "analysis|research|platform|external|documentation",
--       "priority": "high|medium|low",
--       "action": "Acción recomendada",
--       "estimatedTime": "Tiempo estimado",
--       "tools": ["herramienta1", "herramienta2"]
--     }
--   ],
--   "analysis": "Análisis general del proyecto",
--   "generatedAt": "2024-01-01T00:00:00.000Z"
-- } 