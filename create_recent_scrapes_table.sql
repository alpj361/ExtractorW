-- Crear tabla para almacenar scrapes realizados por el MCP Server desde Vizta Chat
CREATE TABLE IF NOT EXISTS recent_scrapes (
  id BIGSERIAL PRIMARY KEY,
  
  -- Información de la consulta
  query_original TEXT NOT NULL,     -- La consulta original del usuario en Vizta Chat
  query_clean TEXT NOT NULL,        -- El término de búsqueda limpio usado en MCP
  herramienta TEXT NOT NULL,        -- Herramienta MCP usada (nitter_context, etc.)
  categoria TEXT NOT NULL,          -- Categoría asignada (Política, Económica, Sociales, General)
  
  -- Información del tweet/resultado
  tweet_id TEXT NOT NULL,           -- ID único del tweet
  usuario TEXT NOT NULL,            -- Username del autor del tweet
  fecha_tweet TIMESTAMP,            -- Fecha del tweet original
  texto TEXT NOT NULL,              -- Contenido del tweet
  enlace TEXT,                      -- URL al tweet original
  
  -- Métricas del tweet
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  
  -- Análisis de sentimiento
  sentimiento TEXT CHECK (sentimiento IN ('positivo', 'negativo', 'neutral')) DEFAULT 'neutral',
  score_sentimiento DECIMAL(3,2) CHECK (score_sentimiento >= -1.0 AND score_sentimiento <= 1.0) DEFAULT 0.0,
  confianza_sentimiento DECIMAL(3,2) CHECK (confianza_sentimiento >= 0.0 AND confianza_sentimiento <= 1.0) DEFAULT 0.0,
  emociones_detectadas JSONB DEFAULT '[]'::jsonb,
  analisis_ai_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Análisis avanzado (igual que trending_tweets)
  intencion_comunicativa TEXT CHECK (intencion_comunicativa IN ('informativo', 'opinativo', 'humorístico', 'alarmista', 'crítico', 'promocional', 'conversacional', 'protesta')) DEFAULT 'informativo',
  propagacion_viral TEXT CHECK (propagacion_viral IN ('viral', 'alto', 'medio', 'bajo', 'sin engagement')) DEFAULT 'bajo',
  score_propagacion INTEGER DEFAULT 0,
  entidades_mencionadas JSONB DEFAULT '[]'::jsonb,
  
  -- Información del usuario y sesión
  user_id UUID,                     -- ID del usuario que hizo la consulta
  session_id TEXT,                  -- ID de sesión del chat
  
  -- Metadatos del MCP
  mcp_request_id TEXT,              -- ID único de la request al MCP
  mcp_execution_time INTEGER,       -- Tiempo de ejecución en ms
  location TEXT DEFAULT 'guatemala', -- Ubicación para la cual se obtuvo
  fecha_captura TIMESTAMP DEFAULT NOW(), -- Cuando se capturó este tweet
  raw_data JSONB,                   -- Datos originales completos del tweet
  
  -- Timestamps automáticos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_tweet_id ON recent_scrapes(tweet_id);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_query_clean ON recent_scrapes(query_clean);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_herramienta ON recent_scrapes(herramienta);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_categoria ON recent_scrapes(categoria);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_fecha_captura ON recent_scrapes(fecha_captura);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_location ON recent_scrapes(location);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_usuario ON recent_scrapes(usuario);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_user_id ON recent_scrapes(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_session_id ON recent_scrapes(session_id);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_sentimiento ON recent_scrapes(sentimiento);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_score_sentimiento ON recent_scrapes(score_sentimiento);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_intencion ON recent_scrapes(intencion_comunicativa);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_propagacion ON recent_scrapes(propagacion_viral);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_score_propagacion ON recent_scrapes(score_propagacion);

-- Índices GIN para campos JSONB
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_entidades ON recent_scrapes USING GIN (entidades_mencionadas);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_emociones ON recent_scrapes USING GIN (emociones_detectadas);
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_raw_data ON recent_scrapes USING GIN (raw_data);

-- Índice compuesto para evitar duplicados por tweet_id, user_id y fecha
CREATE UNIQUE INDEX IF NOT EXISTS idx_recent_scrapes_unique 
ON recent_scrapes(tweet_id, user_id, DATE(fecha_captura));

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_recent_scrapes_updated_at 
BEFORE UPDATE ON recent_scrapes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para calcular score_propagacion automáticamente
CREATE OR REPLACE FUNCTION calculate_propagation_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.score_propagacion = COALESCE(NEW.likes, 0) + COALESCE(NEW.retweets, 0) + COALESCE(NEW.replies, 0);
    
    -- Calcular propagacion_viral basado en score
    IF NEW.score_propagacion > 1000 THEN
        NEW.propagacion_viral = 'viral';
    ELSIF NEW.score_propagacion > 100 THEN
        NEW.propagacion_viral = 'alto';
    ELSIF NEW.score_propagacion > 10 THEN
        NEW.propagacion_viral = 'medio';
    ELSIF NEW.score_propagacion > 0 THEN
        NEW.propagacion_viral = 'bajo';
    ELSE
        NEW.propagacion_viral = 'sin engagement';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_calculate_propagation_scrapes
BEFORE INSERT OR UPDATE ON recent_scrapes
FOR EACH ROW EXECUTE FUNCTION calculate_propagation_score();

-- Comentarios para documentación
COMMENT ON TABLE recent_scrapes IS 'Almacena tweets obtenidos por el MCP Server desde Vizta Chat con análisis completo de sentimiento, intención y entidades';
COMMENT ON COLUMN recent_scrapes.query_original IS 'Consulta original del usuario en Vizta Chat';
COMMENT ON COLUMN recent_scrapes.query_clean IS 'Término de búsqueda limpio usado en la herramienta MCP';
COMMENT ON COLUMN recent_scrapes.herramienta IS 'Herramienta MCP utilizada (nitter_context, future_tools)';
COMMENT ON COLUMN recent_scrapes.categoria IS 'Categoría automáticamente asignada basada en contenido';
COMMENT ON COLUMN recent_scrapes.tweet_id IS 'ID único del tweet en la plataforma original';
COMMENT ON COLUMN recent_scrapes.user_id IS 'ID del usuario que realizó la consulta en Vizta Chat';
COMMENT ON COLUMN recent_scrapes.session_id IS 'ID de sesión del chat para agrupar conversaciones';
COMMENT ON COLUMN recent_scrapes.mcp_request_id IS 'ID único de la request al MCP Server';
COMMENT ON COLUMN recent_scrapes.sentimiento IS 'Clasificación de sentimiento: positivo, negativo, neutral';
COMMENT ON COLUMN recent_scrapes.score_sentimiento IS 'Puntuación numérica del sentimiento (-1.0 a 1.0)';
COMMENT ON COLUMN recent_scrapes.confianza_sentimiento IS 'Nivel de confianza del análisis (0.0 a 1.0)';
COMMENT ON COLUMN recent_scrapes.emociones_detectadas IS 'Array de emociones detectadas con intensidad';
COMMENT ON COLUMN recent_scrapes.intencion_comunicativa IS 'Intención del tweet: informativo, opinativo, humorístico, alarmista, crítico, promocional, conversacional, protesta';
COMMENT ON COLUMN recent_scrapes.propagacion_viral IS 'Nivel de propagación basado en engagement: viral, alto, medio, bajo, sin engagement';
COMMENT ON COLUMN recent_scrapes.score_propagacion IS 'Score numérico de propagación calculado desde likes+retweets+replies';
COMMENT ON COLUMN recent_scrapes.entidades_mencionadas IS 'Array de entidades extraídas: personas, organizaciones, lugares, eventos';
COMMENT ON COLUMN recent_scrapes.analisis_ai_metadata IS 'Metadatos del análisis de IA (modelo usado, timestamp, etc.)';
COMMENT ON COLUMN recent_scrapes.raw_data IS 'Datos completos del tweet en formato JSON'; 