-- Add runner tracking columns for distributed task management
-- runner_id: identifies which pod/process owns the task
-- last_heartbeat: updated periodically to prove task is alive

ALTER TABLE `background_tasks` ADD COLUMN `runner_id` text;
--> statement-breakpoint
ALTER TABLE `background_tasks` ADD COLUMN `last_heartbeat` integer;
