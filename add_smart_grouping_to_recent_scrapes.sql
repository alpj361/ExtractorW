-- ===================================================================
-- MIGRACIÓN: Agrupación Inteligente para Recent Scrapes
-- Fecha: 2025-01-17
-- Descripción: Agrega campos para títulos generados automáticamente y agrupación temática
-- ===================================================================

-- Agregar columna para título generado por GPT
ALTER TABLE recent_scrapes 
ADD COLUMN IF NOT EXISTS generated_title TEXT;

-- Agregar columna para grupo/tema detectado automáticamente
ALTER TABLE recent_scrapes 
ADD COLUMN IF NOT EXISTS detected_group TEXT DEFAULT 'general';

-- Crear índice para mejorar consultas de agrupación
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_detected_group 
ON recent_scrapes(detected_group);

-- Crear índice compuesto para optimizar consultas por usuario y grupo
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_user_group 
ON recent_scrapes(user_id, detected_group);

-- Crear índice para búsquedas por título generado
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_generated_title 
ON recent_scrapes USING GIN (to_tsvector('spanish', generated_title));

-- Comentarios en las columnas
COMMENT ON COLUMN recent_scrapes.generated_title 
IS 'Título generado automáticamente por GPT basado en el contenido de los tweets encontrados';

COMMENT ON COLUMN recent_scrapes.detected_group 
IS 'Grupo/tema detectado automáticamente para agrupación inteligente (ej: politica-guatemala, economia-guatemala, etc)';

-- Actualizar registros existentes con valores por defecto
UPDATE recent_scrapes 
SET 
  generated_title = COALESCE(query_original, 'Monitoreo sin título'),
  detected_group = 'general'
WHERE generated_title IS NULL OR detected_group IS NULL;

-- Crear función para limpiar y normalizar grupos
CREATE OR REPLACE FUNCTION normalize_detected_group(input_group TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Normalizar el grupo de entrada
  RETURN CASE 
    WHEN input_group ILIKE '%politic%' OR input_group ILIKE '%gobierno%' OR input_group ILIKE '%arevalo%' OR input_group ILIKE '%giammattei%' THEN 'politica-guatemala'
    WHEN input_group ILIKE '%econom%' OR input_group ILIKE '%precio%' OR input_group ILIKE '%empleo%' THEN 'economia-guatemala'
    WHEN input_group ILIKE '%deport%' OR input_group ILIKE '%futbol%' OR input_group ILIKE '%selec%' THEN 'deportes-guatemala'
    WHEN input_group ILIKE '%cultur%' OR input_group ILIKE '%festival%' OR input_group ILIKE '%tradicion%' THEN 'cultura-guatemala'
    WHEN input_group ILIKE '%social%' OR input_group ILIKE '%marcha%' OR input_group ILIKE '%protesta%' THEN 'social-guatemala'
    WHEN input_group ILIKE '%tecnolog%' OR input_group ILIKE '%tech%' OR input_group ILIKE '%innovacion%' THEN 'tecnologia'
    WHEN input_group ILIKE '%internacional%' OR input_group ILIKE '%mundial%' THEN 'internacional'
    WHEN input_group ILIKE '%entretenimiento%' OR input_group ILIKE '%musica%' OR input_group ILIKE '%cine%' THEN 'entretenimiento'
    ELSE 'general'
  END;
END;
$$ LANGUAGE plpgsql;

-- Ejemplo de uso de la función de normalización
-- SELECT normalize_detected_group('politica-guatemala'); -- Devuelve: politica-guatemala
-- SELECT normalize_detected_group('DEPORTES'); -- Devuelve: deportes-guatemala

-- Crear vista para estadísticas de agrupación
CREATE OR REPLACE VIEW recent_scrapes_group_stats AS
SELECT 
  detected_group,
  COUNT(*) as scrapes_count,
  SUM(tweet_count) as total_tweets,
  SUM(total_engagement) as total_engagement,
  ROUND(AVG(avg_engagement)) as avg_engagement_per_scrape,
  MIN(created_at) as first_scrape,
  MAX(created_at) as last_scrape,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT generated_title) as unique_topics
FROM recent_scrapes 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY detected_group
ORDER BY scrapes_count DESC;

-- Crear vista para monitoreos agrupados por usuario
CREATE OR REPLACE VIEW user_grouped_scrapes AS
SELECT 
  user_id,
  detected_group,
  COUNT(*) as scrapes_in_group,
  SUM(tweet_count) as total_tweets_in_group,
  SUM(total_engagement) as total_engagement_in_group,
  ROUND(AVG(avg_engagement)) as avg_engagement_in_group,
  MAX(created_at) as last_activity,
  STRING_AGG(DISTINCT generated_title, ', ' ORDER BY generated_title) as topics_in_group
FROM recent_scrapes 
GROUP BY user_id, detected_group
ORDER BY user_id, last_activity DESC;

-- Verificar que la migración se aplicó correctamente
DO $$
BEGIN
  -- Verificar que las columnas existen
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recent_scrapes' 
    AND column_name = 'generated_title'
  ) THEN
    RAISE EXCEPTION 'La columna generated_title no se creó correctamente';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recent_scrapes' 
    AND column_name = 'detected_group'
  ) THEN
    RAISE EXCEPTION 'La columna detected_group no se creó correctamente';
  END IF;
  
  -- Verificar que los índices existen
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'recent_scrapes' 
    AND indexname = 'idx_recent_scrapes_detected_group'
  ) THEN
    RAISE EXCEPTION 'El índice idx_recent_scrapes_detected_group no se creó correctamente';
  END IF;
  
  RAISE NOTICE '✅ Migración de agrupación inteligente aplicada exitosamente';
  RAISE NOTICE '📊 Nuevas columnas: generated_title, detected_group';
  RAISE NOTICE '🔍 Nuevos índices: idx_recent_scrapes_detected_group, idx_recent_scrapes_user_group, idx_recent_scrapes_generated_title';
  RAISE NOTICE '📈 Nuevas vistas: recent_scrapes_group_stats, user_grouped_scrapes';
  RAISE NOTICE '⚙️ Nueva función: normalize_detected_group()';
END $$; 