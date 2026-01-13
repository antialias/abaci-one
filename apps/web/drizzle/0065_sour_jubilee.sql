-- Custom SQL migration file, put your code below! --

-- Create game_results table for scoreboard and history
CREATE TABLE `game_results` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `user_id` text,
  `game_name` text NOT NULL,
  `game_display_name` text NOT NULL,
  `game_icon` text,
  `session_type` text NOT NULL,
  `session_id` text,
  `normalized_score` real NOT NULL,
  `raw_score` integer,
  `accuracy` real,
  `category` text,
  `difficulty` text,
  `duration_ms` integer,
  `played_at` integer NOT NULL,
  `full_report` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

-- Index for player history lookups (player + game)
CREATE INDEX `game_results_player_game_idx` ON `game_results` (`player_id`, `game_name`);
--> statement-breakpoint

-- Index for game-wide leaderboards
CREATE INDEX `game_results_game_score_idx` ON `game_results` (`game_name`, `normalized_score`);
--> statement-breakpoint

-- Index for category leaderboards
CREATE INDEX `game_results_category_score_idx` ON `game_results` (`category`, `normalized_score`);
--> statement-breakpoint

-- Index for player history ordered by time
CREATE INDEX `game_results_player_time_idx` ON `game_results` (`player_id`, `played_at`);
