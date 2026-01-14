-- Custom SQL migration file, put your code below! --

-- Vision problem videos - per-problem video recordings for observer playback
CREATE TABLE `vision_problem_videos` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `session_plans`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `problem_number` integer NOT NULL,
  `part_index` integer NOT NULL,
  `filename` text NOT NULL,
  `file_size` integer,
  `duration_ms` integer,
  `frame_count` integer,
  `avg_fps` real,
  `started_at` integer NOT NULL,
  `ended_at` integer,
  `is_correct` integer,
  `status` text NOT NULL DEFAULT 'recording',
  `processing_error` text,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

-- Indexes for efficient queries
CREATE INDEX `vision_problem_videos_session_id_idx` ON `vision_problem_videos` (`session_id`);
--> statement-breakpoint
CREATE INDEX `vision_problem_videos_session_problem_idx` ON `vision_problem_videos` (`session_id`, `problem_number`);
--> statement-breakpoint
CREATE INDEX `vision_problem_videos_player_id_idx` ON `vision_problem_videos` (`player_id`);
--> statement-breakpoint
CREATE INDEX `vision_problem_videos_expires_at_idx` ON `vision_problem_videos` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `vision_problem_videos_status_idx` ON `vision_problem_videos` (`status`);
