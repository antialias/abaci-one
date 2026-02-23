CREATE TABLE `session_songs` (
  `id` text PRIMARY KEY NOT NULL,
  `session_plan_id` text NOT NULL REFERENCES `session_plans`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `status` text NOT NULL DEFAULT 'pending',
  `suno_task_id` text,
  `prompt_input` text,
  `llm_output` text,
  `audio_url` text,
  `local_file_path` text,
  `duration_seconds` real,
  `error_message` text,
  `background_task_id` text REFERENCES `background_tasks`(`id`),
  `trigger_source` text,
  `created_at` integer NOT NULL,
  `submitted_at` integer,
  `completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `session_songs_session_plan_id_idx` ON `session_songs` (`session_plan_id`);
--> statement-breakpoint
CREATE INDEX `session_songs_player_id_idx` ON `session_songs` (`player_id`);
--> statement-breakpoint
CREATE INDEX `session_songs_status_idx` ON `session_songs` (`status`);
