-- Add is_practicing boolean column to player_skill_mastery
-- This replaces the 3-state mastery_level with a simple boolean
-- Fluency state (effortless/fluent/rusty/practicing) is now computed from practice history
ALTER TABLE `player_skill_mastery` ADD `is_practicing` integer DEFAULT 0 NOT NULL;
