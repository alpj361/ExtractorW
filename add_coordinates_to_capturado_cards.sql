-- Migration: Add geographic and topic columns to capturado_cards
-- Date: 2025-01-27
-- Description: Adds coordinates, pais, and topic columns to support improved geographic detection

BEGIN;

-- 1. Add missing columns
ALTER TABLE public.capturado_cards 
ADD COLUMN IF NOT EXISTS coordinates JSONB,
ADD COLUMN IF NOT EXISTS pais TEXT,
ADD COLUMN IF NOT EXISTS topic TEXT;

-- 2. Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_capturado_cards_pais ON public.capturado_cards(pais);
CREATE INDEX IF NOT EXISTS idx_capturado_cards_topic ON public.capturado_cards(topic);
CREATE INDEX IF NOT EXISTS idx_capturado_cards_coordinates ON public.capturado_cards USING GIN (coordinates);

-- 3. Add comments for documentation
COMMENT ON COLUMN public.capturado_cards.coordinates IS 'Geographic coordinates as JSON object with lat/lng properties';
COMMENT ON COLUMN public.capturado_cards.pais IS 'Country name for geographic classification';
COMMENT ON COLUMN public.capturado_cards.topic IS 'Topic/theme classification for the card';

COMMIT;

-- Migration completed successfully
SELECT 'Migration: Added coordinates, pais, and topic columns to capturado_cards' AS status; 