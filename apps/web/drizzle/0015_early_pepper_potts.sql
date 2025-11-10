-- Custom SQL migration file, put your code below! --
CREATE TABLE `worksheet_mastery` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `skill_id` text NOT NULL, `is_mastered` integer DEFAULT 0 NOT NULL, `total_attempts` integer DEFAULT 0 NOT NULL, `correct_attempts` integer DEFAULT 0 NOT NULL, `last_accuracy` real, `first_attempt_at` integer, `mastered_at` integer, `last_practiced_at` integer NOT NULL, `updated_at` integer NOT NULL, `created_at` integer NOT NULL, FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade);
--> statement-breakpoint
CREATE INDEX `worksheet_mastery_user_skill_idx` ON `worksheet_mastery` (`user_id`, `skill_id`);
