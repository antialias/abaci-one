CREATE TABLE `ai_usage` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `feature` text NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `api_type` text NOT NULL,
  `input_tokens` integer,
  `output_tokens` integer,
  `reasoning_tokens` integer,
  `audio_input_seconds` real,
  `audio_output_seconds` real,
  `image_count` integer,
  `input_characters` integer,
  `audio_duration_seconds` real,
  `background_task_id` text,
  `metadata` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_user_idx` ON `ai_usage` (`user_id`);
--> statement-breakpoint
CREATE INDEX `ai_usage_feature_idx` ON `ai_usage` (`feature`);
--> statement-breakpoint
CREATE INDEX `ai_usage_created_at_idx` ON `ai_usage` (`created_at`);
--> statement-breakpoint
CREATE INDEX `ai_usage_user_feature_idx` ON `ai_usage` (`user_id`, `feature`);
