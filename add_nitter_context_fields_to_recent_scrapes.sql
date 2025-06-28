-- Migración para agregar campos de nitter_context a recent_scrapes
-- Fecha: 2025-01-27
-- Propósito: Soporte completo para análisis de tweets con IA y metadata de sesión

-- Agregar campos de análisis de sentimiento y IA
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS sentimiento VARCHAR(50);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS score_sentimiento DECIMAL(3,2);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS confianza_sentimiento DECIMAL(3,2);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS emociones_detectadas TEXT[];
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS intencion_comunicativa VARCHAR(100);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS entidades_mencionadas TEXT[];
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS analisis_ai_metadata JSONB;

-- Agregar campos de sesión y metadatos MCP
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS mcp_request_id VARCHAR(255);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS mcp_execution_time INTEGER;
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS fecha_captura TIMESTAMPTZ;

-- Agregar campos adicionales si no existen
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS query_original TEXT;
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS query_clean TEXT;
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS herramienta VARCHAR(100);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE recent_scrapes ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_user_id ON recent_scrapes(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_session_id ON recent_scrapes(session_id);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_herramienta ON recent_scrapes(herramienta);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_categoria ON recent_scrapes(categoria);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_sentimiento ON recent_scrapes(sentimiento);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_fecha_captura ON recent_scrapes(fecha_captura);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_location ON recent_scrapes(location);

-- Índices GIN para búsquedas en arrays y JSONB
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_emociones_gin ON recent_scrapes USING GIN(emociones_detectadas);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_entidades_gin ON recent_scrapes USING GIN(entidades_mencionadas);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_analisis_metadata_gin ON recent_scrapes USING GIN(analisis_ai_metadata);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_raw_data_gin ON recent_scrapes USING GIN(raw_data);

-- Comentarios para documentación
COMMENT ON COLUMN recent_scrapes.sentimiento IS 'Sentimiento del tweet: positivo, negativo, neutral';
COMMENT ON COLUMN recent_scrapes.score_sentimiento IS 'Puntuación de sentimiento de -1.0 a 1.0';
COMMENT ON COLUMN recent_scrapes.confianza_sentimiento IS 'Confianza del análisis de sentimiento de 0.0 a 1.0';
COMMENT ON COLUMN recent_scrapes.emociones_detectadas IS 'Array de emociones detectadas en el tweet';
COMMENT ON COLUMN recent_scrapes.intencion_comunicativa IS 'Intención comunicativa: informativa, opinion, humorous, etc.';
COMMENT ON COLUMN recent_scrapes.entidades_mencionadas IS 'Entidades extraídas: personas, organizaciones, lugares, eventos';
COMMENT ON COLUMN recent_scrapes.analisis_ai_metadata IS 'Metadata del análisis de IA incluyendo modelo usado, tokens, etc.';
COMMENT ON COLUMN recent_scrapes.user_id IS 'ID del usuario que solicitó el análisis';
COMMENT ON COLUMN recent_scrapes.session_id IS 'ID de sesión del chat';
COMMENT ON COLUMN recent_scrapes.mcp_request_id IS 'ID único de la request MCP';
COMMENT ON COLUMN recent_scrapes.mcp_execution_time IS 'Tiempo de ejecución en milisegundos';
COMMENT ON COLUMN recent_scrapes.location IS 'Ubicación del filtro de búsqueda';
COMMENT ON COLUMN recent_scrapes.fecha_captura IS 'Timestamp de cuando se capturó el tweet';
COMMENT ON COLUMN recent_scrapes.herramienta IS 'Herramienta usada para obtener el tweet: nitter_context, etc.';
COMMENT ON COLUMN recent_scrapes.categoria IS 'Categoría automática del tema: Política, Deportes, etc.';
COMMENT ON COLUMN recent_scrapes.verified IS 'Si la cuenta del usuario está verificada';
COMMENT ON COLUMN recent_scrapes.raw_data IS 'Datos originales del tweet tal como se recibieron';

-- Verificar que la migración fue exitosa
DO $$
BEGIN
    -- Verificar que las columnas principales existen
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recent_scrapes' 
        AND column_name = 'analisis_ai_metadata'
    ) THEN
        RAISE NOTICE '✅ Migración completada exitosamente. Columnas agregadas a recent_scrapes.';
    ELSE
        RAISE EXCEPTION '❌ Error en migración: no se pudo agregar analisis_ai_metadata';
    END IF;
END $$; 