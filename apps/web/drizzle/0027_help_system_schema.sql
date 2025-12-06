-- Custom SQL migration file, put your code below! --

-- Add reinforcement tracking columns to player_skill_mastery table
ALTER TABLE `player_skill_mastery` ADD `needs_reinforcement` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `player_skill_mastery` ADD `last_help_level` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `player_skill_mastery` ADD `reinforcement_streak` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Add help_settings column to players table
ALTER TABLE `players` ADD `help_settings` text DEFAULT '{"helpMode":"auto","autoEscalationTimingMs":{"level1":30000,"level2":60000,"level3":90000},"beginnerFreeHelp":true,"advancedRequiresApproval":false}';
