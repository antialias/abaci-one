-- Custom SQL migration file, put your code below! --

-- Vision recordings table for storing abacus camera recordings during practice sessions
CREATE TABLE `vision_recordings` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `session_plans`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `filename` text NOT NULL,
  `file_size` integer,
  `duration_ms` integer,
  `frame_count` integer,
  `avg_fps` real,
  `started_at` integer NOT NULL,
  `ended_at` integer,
  `status` text DEFAULT 'recording' NOT NULL,
  `processing_error` text,
  `problem_markers` text,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

-- Indexes for efficient queries
CREATE INDEX `vision_recordings_session_id_idx` ON `vision_recordings` (`session_id`);
--> statement-breakpoint
CREATE INDEX `vision_recordings_player_id_idx` ON `vision_recordings` (`player_id`);
--> statement-breakpoint
CREATE INDEX `vision_recordings_expires_at_idx` ON `vision_recordings` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `vision_recordings_status_idx` ON `vision_recordings` (`status`);
