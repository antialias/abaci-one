-- Custom SQL migration file, put your code below! --

-- Practice attachments table for storing photos of student work
CREATE TABLE `practice_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `session_id` text NOT NULL REFERENCES `session_plans`(`id`) ON DELETE CASCADE,
  `filename` text NOT NULL,
  `mime_type` text NOT NULL,
  `file_size` integer NOT NULL,
  `uploaded_by` text NOT NULL REFERENCES `users`(`id`),
  `uploaded_at` text NOT NULL
);
--> statement-breakpoint

-- Index for fast lookups by player
CREATE INDEX `practice_attachments_player_idx` ON `practice_attachments` (`player_id`);
--> statement-breakpoint

-- Index for fast lookups by session
CREATE INDEX `practice_attachments_session_idx` ON `practice_attachments` (`session_id`);
