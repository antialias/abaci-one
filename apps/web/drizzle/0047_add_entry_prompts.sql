-- Custom SQL migration file, put your code below! --
CREATE TABLE `entry_prompts` (
  `id` text PRIMARY KEY NOT NULL,
  `teacher_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `classroom_id` text NOT NULL REFERENCES `classrooms`(`id`) ON DELETE CASCADE,
  `expires_at` integer NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `responded_by` text REFERENCES `users`(`id`),
  `responded_at` integer,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_entry_prompts_teacher` ON `entry_prompts` (`teacher_id`);
--> statement-breakpoint
CREATE INDEX `idx_entry_prompts_player` ON `entry_prompts` (`player_id`);
--> statement-breakpoint
CREATE INDEX `idx_entry_prompts_classroom` ON `entry_prompts` (`classroom_id`);
--> statement-breakpoint
CREATE INDEX `idx_entry_prompts_status` ON `entry_prompts` (`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_entry_prompts_unique_pending` ON `entry_prompts` (`player_id`, `classroom_id`) WHERE `status` = 'pending';
