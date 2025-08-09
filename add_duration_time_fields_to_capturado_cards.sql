-- Migration: Add duration and time fields to capturado_cards
-- Date: 2025-08-09

BEGIN;

-- 1) Duración flexible (texto + total en segundos + componentes desglosados)
ALTER TABLE public.capturado_cards
  ADD COLUMN IF NOT EXISTS duration_text TEXT,                         -- Cadena original, ej: "YY:MM:DD:HH:MM"
  ADD COLUMN IF NOT EXISTS duration_total_seconds BIGINT,              -- Normalizada para cálculos (precisa)
  ADD COLUMN IF NOT EXISTS duration_components JSONB DEFAULT '{}'::jsonb; -- {years, months, days, hours, minutes}

COMMENT ON COLUMN public.capturado_cards.duration_text IS 'Duración original en formato YY:MM:DD:HH:MM (o variantes)';
COMMENT ON COLUMN public.capturado_cards.duration_total_seconds IS 'Duración normalizada en segundos para cálculos';
COMMENT ON COLUMN public.capturado_cards.duration_components IS 'Duración desglosada en JSON: {"years":N,"months":N,"days":N,"hours":N,"minutes":N}';

-- Índice útil para ordenar/filtrar por duración total
CREATE INDEX IF NOT EXISTS idx_capturado_duration_total_seconds
  ON public.capturado_cards (duration_total_seconds);

-- 2) Periodos de tiempo (día único, rango de años, décadas, etc.)
--    Usar daterange permite operaciones robustas (contains, overlaps, etc.)
ALTER TABLE public.capturado_cards
  ADD COLUMN IF NOT EXISTS time_range DATERANGE,                       -- [lower, upper) con granularidad elegida
  ADD COLUMN IF NOT EXISTS time_label TEXT,                            -- Etiqueta amigable ("1990s", "2015–2018", "2025-08-09")
  ADD COLUMN IF NOT EXISTS time_granularity TEXT                       -- 'day' | 'month' | 'year' | 'decade' | 'custom'
    CHECK (time_granularity IN ('day','month','year','decade','custom'));

COMMENT ON COLUMN public.capturado_cards.time_range IS 'Rango de fechas (daterange). Convención [lower, upper)';
COMMENT ON COLUMN public.capturado_cards.time_label IS 'Etiqueta legible del periodo temporal';
COMMENT ON COLUMN public.capturado_cards.time_granularity IS 'Granularidad del periodo: day|month|year|decade|custom';

-- Índice GiST para acelerar consultas por solapamiento/contención de rangos
CREATE INDEX IF NOT EXISTS idx_capturado_time_range_gist
  ON public.capturado_cards USING GIST (time_range);

COMMIT;

SELECT 'Migration: duration and time fields added to capturado_cards' AS status;

