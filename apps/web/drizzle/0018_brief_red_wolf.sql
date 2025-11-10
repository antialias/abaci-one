-- Custom SQL migration file, put your code below! --

-- Remove foreign key constraints from worksheet_attempts and problem_attempts to allow guest users
-- SQLite doesn't support DROP CONSTRAINT, so we need to recreate the tables

-- 1. Create new worksheet_attempts table without foreign key
CREATE TABLE `worksheet_attempts_new` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL,
  `uploaded_image_url` TEXT NOT NULL,
  `worksheet_id` TEXT,
  `session_id` TEXT,
  `operator` TEXT NOT NULL,
  `digit_count` INTEGER NOT NULL,
  `problem_count` INTEGER NOT NULL,
  `grading_status` TEXT DEFAULT 'pending' NOT NULL,
  `graded_at` INTEGER,
  `total_problems` INTEGER,
  `correct_count` INTEGER,
  `accuracy` REAL,
  `error_patterns` TEXT,
  `suggested_step_id` TEXT,
  `ai_feedback` TEXT,
  `ai_response_raw` TEXT,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);--> statement-breakpoint

-- 2. Copy existing data
INSERT INTO `worksheet_attempts_new`
SELECT * FROM `worksheet_attempts`;--> statement-breakpoint

-- 3. Drop old table
DROP TABLE `worksheet_attempts`;--> statement-breakpoint

-- 4. Rename new table
ALTER TABLE `worksheet_attempts_new` RENAME TO `worksheet_attempts`;--> statement-breakpoint

-- 5. Recreate indexes
CREATE INDEX `worksheet_attempts_user_idx` ON `worksheet_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `worksheet_attempts_status_idx` ON `worksheet_attempts` (`grading_status`);--> statement-breakpoint
CREATE INDEX `worksheet_attempts_session_idx` ON `worksheet_attempts` (`session_id`);--> statement-breakpoint

-- 6. Create new problem_attempts table without user foreign key
CREATE TABLE `problem_attempts_new` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `attempt_id` TEXT NOT NULL REFERENCES `worksheet_attempts`(`id`) ON DELETE CASCADE,
  `user_id` TEXT NOT NULL,
  `problem_index` INTEGER NOT NULL,
  `operand_a` INTEGER NOT NULL,
  `operand_b` INTEGER NOT NULL,
  `operator` TEXT NOT NULL,
  `correct_answer` INTEGER NOT NULL,
  `student_answer` INTEGER,
  `student_work_digits` TEXT,
  `is_correct` INTEGER NOT NULL,
  `error_type` TEXT,
  `digit_count` INTEGER NOT NULL,
  `requires_regrouping` INTEGER NOT NULL,
  `regroups_in_places` TEXT,
  `created_at` INTEGER NOT NULL
);--> statement-breakpoint

-- 7. Copy existing data (if any)
INSERT INTO `problem_attempts_new`
SELECT * FROM `problem_attempts`;--> statement-breakpoint

-- 8. Drop old table
DROP TABLE `problem_attempts`;--> statement-breakpoint

-- 9. Rename new table
ALTER TABLE `problem_attempts_new` RENAME TO `problem_attempts`;--> statement-breakpoint

-- 10. Recreate indexes
CREATE INDEX `problem_attempts_attempt_idx` ON `problem_attempts` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `problem_attempts_user_idx` ON `problem_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `problem_attempts_type_idx` ON `problem_attempts` (`user_id`, `digit_count`, `requires_regrouping`);
