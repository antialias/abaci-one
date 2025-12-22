-- Custom SQL migration file, put your code below! --
-- Add missing indexes and generate family codes

-- ============================================================================
-- 1. Add missing indexes to parent_child table
-- ============================================================================

CREATE INDEX `idx_parent_child_parent` ON `parent_child` (`parent_user_id`);
--> statement-breakpoint

CREATE INDEX `idx_parent_child_child` ON `parent_child` (`child_player_id`);
--> statement-breakpoint

-- ============================================================================
-- 2. Generate family codes for existing players
-- ============================================================================

-- SQLite doesn't have built-in random string generation, so we use a combination
-- of hex(randomblob()) to create unique codes, then format them.
-- Format: FAM-XXXXXX where X is alphanumeric
-- The uniqueness constraint on family_code will ensure no collisions.

UPDATE `players`
SET `family_code` = 'FAM-' || UPPER(SUBSTR(HEX(RANDOMBLOB(3)), 1, 6))
WHERE `family_code` IS NULL;
