-- Migration: Add audio_transcription column to codex_items table
-- Date: 2024
-- Description: Adds functionality to store transcriptions of audio and video files

-- Add audio_transcription column to codex_items table
ALTER TABLE codex_items 
ADD COLUMN audio_transcription TEXT;

-- Add index for better search performance on transcriptions
CREATE INDEX IF NOT EXISTS idx_codex_items_audio_transcription 
ON codex_items USING gin(to_tsvector('spanish', audio_transcription));

-- Add comment to describe the new column
COMMENT ON COLUMN codex_items.audio_transcription IS 'Transcripción automática del audio/video usando Gemini AI';

-- Update existing items to set default value
UPDATE codex_items 
SET audio_transcription = NULL 
WHERE audio_transcription IS NULL;

-- Migration completed successfully
SELECT 'Migration: audio_transcription column added to codex_items' as status; 