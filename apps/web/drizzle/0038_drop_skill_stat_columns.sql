-- Custom SQL migration file, put your code below! --
-- Drop deprecated skill stat columns from player_skill_mastery table
-- These stats are now computed on-the-fly from session results (single source of truth)
-- Requires SQLite 3.35.0+ (2021-03-12) for ALTER TABLE DROP COLUMN support

ALTER TABLE `player_skill_mastery` DROP COLUMN `attempts`;
--> statement-breakpoint

ALTER TABLE `player_skill_mastery` DROP COLUMN `correct`;
--> statement-breakpoint

ALTER TABLE `player_skill_mastery` DROP COLUMN `consecutive_correct`;
--> statement-breakpoint

ALTER TABLE `player_skill_mastery` DROP COLUMN `total_response_time_ms`;
--> statement-breakpoint

ALTER TABLE `player_skill_mastery` DROP COLUMN `response_time_count`;
