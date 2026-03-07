ALTER TABLE `background_tasks` ADD COLUMN `parent_task_id` text;
--> statement-breakpoint
CREATE INDEX `background_tasks_parent_task_idx` ON `background_tasks` (`parent_task_id`);
