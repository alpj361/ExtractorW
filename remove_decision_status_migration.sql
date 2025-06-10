-- Migración para eliminar el campo status de project_decisions
-- Ejecutar este script en la base de datos para completar la eliminación del sistema de estados

BEGIN;

-- 1. Eliminar el índice asociado al campo status
DROP INDEX IF EXISTS idx_project_decisions_status;

-- 2. Eliminar el campo status de la tabla project_decisions
ALTER TABLE public.project_decisions 
DROP COLUMN IF EXISTS status;

-- 3. Verificar que la tabla sigue funcionando correctamente
-- (Este comentario es solo informativo - la transacción se puede validar antes de hacer COMMIT)

COMMIT;

-- ===================================================================
-- NOTAS DE LA MIGRACIÓN:
-- ===================================================================
-- 
-- Esta migración elimina completamente el sistema de estados de las decisiones
-- siguiendo la filosofía de que "las decisiones simplemente se toman cuando se crean"
--
-- Campos eliminados:
-- - status: 'pending' | 'approved' | 'rejected' | 'implemented' | 'cancelled'
--
-- Índices eliminados:
-- - idx_project_decisions_status
--
-- La tabla project_decisions ahora mantiene:
-- - Sistema de capas (parent_decision_id)
-- - Tipos de decisión (decision_type)
-- - Niveles de urgencia (urgency)  
-- - Métricas de éxito (success_metrics)
-- - Fechas de implementación (implementation_date)
-- - Todo el contenido de decisiones sin gestión de estados
--
-- Esta migración es IRREVERSIBLE - una vez ejecutada no se puede deshacer
-- sin perder datos. Asegúrate de tener un backup antes de ejecutar.
-- 