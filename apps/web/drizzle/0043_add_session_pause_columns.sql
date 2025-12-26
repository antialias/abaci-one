-- Custom SQL migration file, put your code below! --

-- Note: These columns were manually added during development.
-- Migration kept for consistency but columns already exist.
-- Columns added to session_plans:
--   is_paused integer DEFAULT 0 NOT NULL
--   paused_at integer
--   paused_by text
--   paused_reason text

SELECT 1;
