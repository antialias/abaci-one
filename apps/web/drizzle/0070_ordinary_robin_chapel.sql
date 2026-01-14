-- Custom SQL migration file, put your code below! --
-- Add epoch/attempt tracking fields to vision_problem_videos
-- Note: epoch_number may already exist from earlier development, so we add only missing columns

ALTER TABLE `vision_problem_videos` ADD COLUMN `attempt_number` integer NOT NULL DEFAULT 1;
--> statement-breakpoint

ALTER TABLE `vision_problem_videos` ADD COLUMN `is_retry` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

ALTER TABLE `vision_problem_videos` ADD COLUMN `is_manual_redo` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Drop old index and recreate with all attempt tracking columns
DROP INDEX IF EXISTS `vision_problem_videos_session_problem_idx`;
--> statement-breakpoint

CREATE INDEX `vision_problem_videos_session_problem_idx` ON `vision_problem_videos` (`session_id`, `problem_number`, `epoch_number`, `attempt_number`);
