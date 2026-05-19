CREATE TABLE `song_shares` (
  `id` text PRIMARY KEY NOT NULL,
  `song_id` text NOT NULL REFERENCES `session_songs`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `created_by` text NOT NULL,
  `visibility` text NOT NULL DEFAULT '{"showAge":false,"showAccuracy":false,"showProblemDetail":false,"showStreakSkills":false}',
  `status` text NOT NULL DEFAULT 'active',
  `views` integer NOT NULL DEFAULT 0,
  `last_viewed_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `song_shares_song_id_idx` ON `song_shares`(`song_id`);
--> statement-breakpoint
CREATE INDEX `song_shares_player_id_idx` ON `song_shares`(`player_id`);
--> statement-breakpoint
CREATE INDEX `song_shares_status_idx` ON `song_shares`(`status`);
