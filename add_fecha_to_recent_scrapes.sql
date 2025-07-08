-- Migration: Add 'fecha' column to recent_scrapes to store original tweet date in timestamp format
-- Ejecuta esto después de create_recent_scrapes_table.sql

ALTER TABLE recent_scrapes
ADD COLUMN IF NOT EXISTS fecha TIMESTAMPTZ;

-- Optional index to improve query performance on fecha
CREATE INDEX IF NOT EXISTS idx_recent_scrapes_fecha ON recent_scrapes(fecha);

-- Comment for documentation
COMMENT ON COLUMN recent_scrapes.fecha IS 'Fecha original asociada al registro, equivalente a fecha_tweet en formatos anteriores'; 