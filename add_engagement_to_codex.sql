-- Migration: Add engagement columns to codex_items table
-- Date: 2024-12-27
-- Purpose: Store social media engagement metrics (likes, comments, shares, views) for saved links

-- Add engagement columns to codex_items table
ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0;

ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0;

ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Create indexes for engagement metrics for better query performance
CREATE INDEX IF NOT EXISTS idx_codex_items_likes ON public.codex_items(likes);
CREATE INDEX IF NOT EXISTS idx_codex_items_comments ON public.codex_items(comments);
CREATE INDEX IF NOT EXISTS idx_codex_items_shares ON public.codex_items(shares);
CREATE INDEX IF NOT EXISTS idx_codex_items_views ON public.codex_items(views);

-- Add comments to document the new columns
COMMENT ON COLUMN codex_items.likes IS 'Number of likes for social media posts';
COMMENT ON COLUMN codex_items.comments IS 'Number of comments for social media posts';
COMMENT ON COLUMN codex_items.shares IS 'Number of shares for social media posts';
COMMENT ON COLUMN codex_items.views IS 'Number of views for social media posts/videos';

-- Update existing items to set default values
UPDATE public.codex_items 
SET likes = 0, comments = 0, shares = 0, views = 0 
WHERE likes IS NULL OR comments IS NULL OR shares IS NULL OR views IS NULL;

-- Migration completed successfully
SELECT 'Migration: engagement columns added to codex_items' as status;
