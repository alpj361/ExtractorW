-- ===================================================================
-- MIGRACIÓN: Agregar campo 'tasks' a la tabla projects
-- Para almacenar tareas del proyecto persistentemente en la base de datos
-- ===================================================================

-- Agregar campo 'tasks' como JSONB para almacenar las tareas
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT NULL;

-- Crear índice para búsquedas eficientes en el campo tasks
CREATE INDEX IF NOT EXISTS idx_projects_tasks 
ON public.projects USING GIN(tasks);

-- Comentario para documentar el campo
COMMENT ON COLUMN public.projects.tasks IS 'Almacena las tareas del proyecto en formato JSON. Incluye array de tareas con estado de completado y timestamp de creación.';

-- Ejemplo de estructura JSON que se almacenará:
-- {
--   "tasks": [
--     {
--       "id": "uuid",
--       "title": "Título de la tarea",
--       "completed": false,
--       "created_at": "2024-01-01T00:00:00.000Z",
--       "project_id": "project-uuid"
--     }
--   ],
--   "updatedAt": "2024-01-01T00:00:00.000Z"
-- } 