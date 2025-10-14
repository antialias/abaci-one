-- Make game_name and game_config nullable to support game selection in room
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Create temporary table with correct schema
CREATE TABLE `arcade_rooms_new` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text(6) NOT NULL,
	`name` text(50),
	`created_by` text NOT NULL,
	`creator_name` text(50) NOT NULL,
	`created_at` integer NOT NULL,
	`last_activity` integer NOT NULL,
	`ttl_minutes` integer DEFAULT 60 NOT NULL,
	`access_mode` text DEFAULT 'open' NOT NULL,
	`password` text(255),
	`display_password` text(100),
	`game_name` text,
	`game_config` text,
	`status` text DEFAULT 'lobby' NOT NULL,
	`current_session_id` text,
	`total_games_played` integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

-- Copy all data
INSERT INTO `arcade_rooms_new`
SELECT `id`, `code`, `name`, `created_by`, `creator_name`, `created_at`,
       `last_activity`, `ttl_minutes`, `access_mode`, `password`, `display_password`,
       `game_name`, `game_config`, `status`, `current_session_id`, `total_games_played`
FROM `arcade_rooms`;--> statement-breakpoint

-- Drop old table
DROP TABLE `arcade_rooms`;--> statement-breakpoint

-- Rename new table
ALTER TABLE `arcade_rooms_new` RENAME TO `arcade_rooms`;--> statement-breakpoint

-- Recreate index
CREATE UNIQUE INDEX `arcade_rooms_code_unique` ON `arcade_rooms` (`code`);--> statement-breakpoint

PRAGMA foreign_keys=ON;
