-- Create room_game_configs table for per-game settings storage
-- This replaces the monolithic gameConfig JSON column with a normalized table
CREATE TABLE `room_game_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`game_name` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_game_idx` ON `room_game_configs` (`room_id`, `game_name`);
--> statement-breakpoint

-- Migrate existing 'matching' configs from arcade_rooms.game_config
INSERT INTO `room_game_configs` (`id`, `room_id`, `game_name`, `config`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(16))),
  `id` as room_id,
  'matching' as game_name,
  json_extract(`game_config`, '$.matching') as config,
  `created_at`,
  `last_activity` as updated_at
FROM `arcade_rooms`
WHERE json_extract(`game_config`, '$.matching') IS NOT NULL;
--> statement-breakpoint

-- Migrate existing 'memory-quiz' configs from arcade_rooms.game_config
INSERT INTO `room_game_configs` (`id`, `room_id`, `game_name`, `config`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(16))),
  `id` as room_id,
  'memory-quiz' as game_name,
  json_extract(`game_config`, '$."memory-quiz"') as config,
  `created_at`,
  `last_activity` as updated_at
FROM `arcade_rooms`
WHERE json_extract(`game_config`, '$."memory-quiz"') IS NOT NULL;
