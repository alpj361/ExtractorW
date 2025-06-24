-- Migración: Agregar columna topic a capturado_cards
-- Fecha: 2025-06-24
-- Propósito: Permitir agrupar hallazgos por tema semántico

ALTER TABLE public.capturado_cards
ADD COLUMN IF NOT EXISTS topic TEXT;

-- Índice para búsquedas rápidas por tema
CREATE INDEX IF NOT EXISTS idx_capturado_cards_topic ON public.capturado_cards(topic);

COMMENT ON COLUMN public.capturado_cards.topic IS 'Tema semántico del hallazgo para agrupación en Discovery'; 