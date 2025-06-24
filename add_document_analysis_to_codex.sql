-- Migración: Agregar columna document_analysis a codex_items
-- Fecha: 2024-12-27
-- Propósito: Permitir almacenar análisis de documentos generados por IA

-- Agregar la nueva columna
ALTER TABLE codex_items 
ADD COLUMN IF NOT EXISTS document_analysis TEXT;

-- Crear índice para búsquedas de texto completo
CREATE INDEX IF NOT EXISTS idx_codex_items_document_analysis_gin 
ON codex_items USING gin(to_tsvector('spanish', document_analysis));

-- Comentario para documentar la columna
COMMENT ON COLUMN codex_items.document_analysis IS 'Análisis automatizado de documentos generado por IA (Gemini). Contiene hallazgos, resúmenes y palabras clave extraídas del documento.'; 