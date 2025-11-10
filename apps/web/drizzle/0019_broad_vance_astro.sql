-- Custom SQL migration file, put your code below! --

-- Remove foreign key constraint from worksheet_mastery to allow guest users
-- SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table

-- 1. Create new worksheet_mastery table without foreign key
CREATE TABLE `worksheet_mastery_new` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL,
  `skill_id` TEXT NOT NULL,
  `is_mastered` INTEGER DEFAULT 0 NOT NULL,
  `total_attempts` INTEGER DEFAULT 0 NOT NULL,
  `correct_attempts` INTEGER DEFAULT 0 NOT NULL,
  `last_accuracy` REAL,
  `first_attempt_at` INTEGER,
  `mastered_at` INTEGER,
  `last_practiced_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  `created_at` INTEGER NOT NULL
);--> statement-breakpoint

-- 2. Copy existing data (if any)
INSERT INTO `worksheet_mastery_new`
SELECT * FROM `worksheet_mastery`;--> statement-breakpoint

-- 3. Drop old table
DROP TABLE `worksheet_mastery`;--> statement-breakpoint

-- 4. Rename new table
ALTER TABLE `worksheet_mastery_new` RENAME TO `worksheet_mastery`;--> statement-breakpoint

-- 5. Recreate index
CREATE INDEX `worksheet_mastery_user_skill_idx` ON `worksheet_mastery` (`user_id`, `skill_id`);
