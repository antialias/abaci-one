-- Custom SQL migration file for worksheet attempts and problem attempts tables
CREATE TABLE `worksheet_attempts` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `uploaded_image_url` text NOT NULL, `worksheet_id` text, `operator` text NOT NULL, `digit_count` integer NOT NULL, `problem_count` integer NOT NULL, `grading_status` text DEFAULT 'pending' NOT NULL, `graded_at` integer, `total_problems` integer, `correct_count` integer, `accuracy` real, `error_patterns` text, `suggested_step_id` text, `ai_feedback` text, `ai_response_raw` text, `created_at` integer NOT NULL, `updated_at` integer NOT NULL, FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade);
--> statement-breakpoint
CREATE TABLE `problem_attempts` (`id` text PRIMARY KEY NOT NULL, `attempt_id` text NOT NULL, `user_id` text NOT NULL, `problem_index` integer NOT NULL, `operand_a` integer NOT NULL, `operand_b` integer NOT NULL, `operator` text NOT NULL, `correct_answer` integer NOT NULL, `student_answer` integer, `student_work_digits` text, `is_correct` integer NOT NULL, `error_type` text, `digit_count` integer NOT NULL, `requires_regrouping` integer NOT NULL, `regroups_in_places` text, `created_at` integer NOT NULL, FOREIGN KEY (`attempt_id`) REFERENCES `worksheet_attempts`(`id`) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade);
--> statement-breakpoint
CREATE INDEX `worksheet_attempts_user_idx` ON `worksheet_attempts` (`user_id`);
--> statement-breakpoint
CREATE INDEX `worksheet_attempts_status_idx` ON `worksheet_attempts` (`grading_status`);
--> statement-breakpoint
CREATE INDEX `problem_attempts_attempt_idx` ON `problem_attempts` (`attempt_id`);
--> statement-breakpoint
CREATE INDEX `problem_attempts_user_idx` ON `problem_attempts` (`user_id`);
--> statement-breakpoint
CREATE INDEX `problem_attempts_type_idx` ON `problem_attempts` (`user_id`, `digit_count`, `requires_regrouping`);
