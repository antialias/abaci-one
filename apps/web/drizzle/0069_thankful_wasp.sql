-- Custom SQL migration file, put your code below! --

-- Add retry tracking columns to vision_problem_videos
ALTER TABLE `vision_problem_videos` ADD `original_problem_number` integer;
--> statement-breakpoint

ALTER TABLE `vision_problem_videos` ADD `epoch_number` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Index for finding all attempts for an original problem (original + retries)
CREATE INDEX `vision_problem_videos_original_problem_idx` ON `vision_problem_videos` (`session_id`, `original_problem_number`);
