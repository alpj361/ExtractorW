-- ===================================================================
-- MIGRACIÓN: Tabla document_table_rows para almacenar filas de tablas
-- extraídas de documentos (PDF, Word, etc.)
-- Fecha: 2025-06-27
-- ===================================================================

BEGIN;

-- 1. Crear tabla principal
CREATE TABLE IF NOT EXISTS public.document_table_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  codex_item_id UUID REFERENCES public.codex_items(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  row_data JSONB NOT NULL,
  source TEXT DEFAULT 'document_table',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices para consultas comunes
CREATE INDEX IF NOT EXISTS idx_document_table_rows_project ON public.document_table_rows(project_id);
CREATE INDEX IF NOT EXISTS idx_document_table_rows_codex ON public.document_table_rows(codex_item_id);

COMMIT; 