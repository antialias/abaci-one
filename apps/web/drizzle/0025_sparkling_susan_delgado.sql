-- Custom SQL migration file, put your code below! --

-- Drop and recreate session_plans table with new three-part structure
-- Changes:
-- 1. Renamed 'slots' column to 'parts' (JSON column containing SessionPart[])
-- 2. Added 'current_part_index' column
-- 3. Removed 'visualization_mode' column (now per-part)
-- 4. Removed 'problem_format' column (now per-part)

-- Drop existing indexes
DROP INDEX IF EXISTS `session_plans_player_id_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `session_plans_status_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `session_plans_created_at_idx`;
--> statement-breakpoint

-- Drop old table (data will be lost, but this is a new feature in development)
DROP TABLE IF EXISTS `session_plans`;
--> statement-breakpoint

-- Create new table with updated schema
CREATE TABLE `session_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`target_duration_minutes` integer NOT NULL,
	`estimated_problem_count` integer NOT NULL,
	`avg_time_per_problem_seconds` integer NOT NULL,
	`parts` text NOT NULL,
	`summary` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_part_index` integer DEFAULT 0 NOT NULL,
	`current_slot_index` integer DEFAULT 0 NOT NULL,
	`session_health` text,
	`adjustments` text DEFAULT '[]' NOT NULL,
	`results` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Recreate indexes
CREATE INDEX `session_plans_player_id_idx` ON `session_plans` (`player_id`);
--> statement-breakpoint
CREATE INDEX `session_plans_status_idx` ON `session_plans` (`status`);
--> statement-breakpoint
CREATE INDEX `session_plans_created_at_idx` ON `session_plans` (`created_at`);
