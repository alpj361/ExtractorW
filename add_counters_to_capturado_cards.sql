-- Migration: Add counter, percentage, quantity to capturado_cards
-- Date: 2025-08-09

BEGIN;

ALTER TABLE public.capturado_cards
  ADD COLUMN IF NOT EXISTS counter INTEGER,
  ADD COLUMN IF NOT EXISTS percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC;

COMMENT ON COLUMN public.capturado_cards.counter IS 'Contador de ocurrencias (veces que algo sucede)';
COMMENT ON COLUMN public.capturado_cards.percentage IS 'Porcentaje asociado al hallazgo (0-100)';
COMMENT ON COLUMN public.capturado_cards.quantity IS 'Cantidad de unidades (no monetarias)';

COMMIT;

SELECT 'Migration: counters added to capturado_cards' AS status;

