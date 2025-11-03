-- Migration: Add player_stats table
-- Per-player game statistics tracking

CREATE TABLE `player_stats` (
	`player_id` text PRIMARY KEY NOT NULL,
	`games_played` integer DEFAULT 0 NOT NULL,
	`total_wins` integer DEFAULT 0 NOT NULL,
	`total_losses` integer DEFAULT 0 NOT NULL,
	`best_time` integer,
	`highest_accuracy` real DEFAULT 0 NOT NULL,
	`favorite_game_type` text,
	`game_stats` text DEFAULT '{}' NOT NULL,
	`last_played_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
