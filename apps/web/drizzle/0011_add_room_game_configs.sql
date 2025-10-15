-- Create room_game_configs table for normalized game settings storage
-- This migration is safe to run multiple times (uses IF NOT EXISTS)

-- Create the table
CREATE TABLE IF NOT EXISTS `room_game_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`game_name` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS `room_game_idx` ON `room_game_configs` (`room_id`,`game_name`);
--> statement-breakpoint

-- Migrate existing game configs from arcade_rooms.game_config column
-- This INSERT will only run if data hasn't been migrated yet
INSERT OR IGNORE INTO room_game_configs (id, room_id, game_name, config, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))) as id,
  id as room_id,
  game_name,
  game_config as config,
  created_at,
  last_activity as updated_at
FROM arcade_rooms
WHERE game_config IS NOT NULL
  AND game_name IS NOT NULL
  AND game_name IN ('matching', 'memory-quiz', 'complement-race');
