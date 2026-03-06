CREATE TABLE `number_line_postcards` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `player_id` text,
  `caller_number` integer NOT NULL,
  `session_id` text,
  `status` text NOT NULL DEFAULT 'pending',
  `manifest` text NOT NULL,
  `image_url` text,
  `thumbnail_url` text,
  `is_read` integer NOT NULL DEFAULT 0,
  `task_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `postcards_user_idx` ON `number_line_postcards` (`user_id`);
--> statement-breakpoint
CREATE INDEX `postcards_player_idx` ON `number_line_postcards` (`player_id`);
--> statement-breakpoint
CREATE INDEX `postcards_status_idx` ON `number_line_postcards` (`status`);
