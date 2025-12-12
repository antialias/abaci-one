-- Custom SQL migration file, put your code below! --
-- Add response time tracking columns to player_skill_mastery table

ALTER TABLE `player_skill_mastery` ADD `total_response_time_ms` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `player_skill_mastery` ADD `response_time_count` integer DEFAULT 0 NOT NULL;
