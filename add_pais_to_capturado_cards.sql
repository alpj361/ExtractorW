-- Migration: Add 'pais' field to capturado_cards table
-- Date: 2025-01-03
-- Description: Adds country field to store the country mentioned in captured cards

BEGIN;

-- 1. Add pais column to capturado_cards table
ALTER TABLE public.capturado_cards 
ADD COLUMN IF NOT EXISTS pais TEXT;

-- 2. Create index for frequent queries by country
CREATE INDEX IF NOT EXISTS idx_capturado_cards_pais ON public.capturado_cards(pais);

-- 3. Add comment for documentation
COMMENT ON COLUMN public.capturado_cards.pais IS 'País mencionado en el hallazgo (ej: Guatemala, Honduras, El Salvador)';

COMMIT;

-- Migration completed successfully
SELECT 'Migration: pais field added to capturado_cards table' AS status; 