-- Migration: Create capturado_cards table for insight cards extracted from transcriptions
-- Date: 2025-06-21
-- Description: Stores structured data (entity, amount, city, etc.) extracted from codex_items audio_transcription

BEGIN;

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.capturado_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    codex_item_id UUID REFERENCES public.codex_items(id) ON DELETE CASCADE,
    entity TEXT,
    amount NUMERIC,
    currency TEXT,
    city TEXT,
    department TEXT,
    discovery TEXT,
    source TEXT,
    start_date DATE,
    duration_days INTEGER,
    description TEXT,
    extra JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_capturado_cards_project ON public.capturado_cards(project_id);
CREATE INDEX IF NOT EXISTS idx_capturado_cards_codex_item ON public.capturado_cards(codex_item_id);
CREATE INDEX IF NOT EXISTS idx_capturado_cards_entity ON public.capturado_cards(entity);
CREATE INDEX IF NOT EXISTS idx_capturado_cards_city ON public.capturado_cards(city);
CREATE INDEX IF NOT EXISTS idx_capturado_cards_department ON public.capturado_cards(department);

-- 3. Enable RLS and basic policies
ALTER TABLE public.capturado_cards ENABLE ROW LEVEL SECURITY;

-- Service-role bypass (API key with service_role role)
CREATE POLICY "Service role bypass" ON public.capturado_cards
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Users can read cards of projects they own (simplified; adjust if you have project membership table)
CREATE POLICY "Users can view cards of own projects" ON public.capturado_cards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_id AND projects.user_id = auth.uid()
        )
    );

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION handle_updated_at_capturado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_capturado ON public.capturado_cards;
CREATE TRIGGER set_updated_at_capturado
    BEFORE UPDATE ON public.capturado_cards
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at_capturado();

COMMIT;

-- Migration completed successfully
SELECT 'Migration: capturado_cards table created' AS status;