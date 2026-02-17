CREATE TABLE `euclid_progress` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `proposition_id` integer NOT NULL,
  `completed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `euclid_progress_player_idx` ON `euclid_progress` (`player_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `euclid_progress_player_prop_unique` ON `euclid_progress` (`player_id`, `proposition_id`);
