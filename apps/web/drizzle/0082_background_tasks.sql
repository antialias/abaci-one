-- Background tasks table for long-running operations
CREATE TABLE `background_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text,
	`output` text,
	`error` text,
	`progress` integer DEFAULT 0,
	`progress_message` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`user_id` text
);
--> statement-breakpoint
CREATE INDEX `background_tasks_status_idx` ON `background_tasks` (`status`);
--> statement-breakpoint
CREATE INDEX `background_tasks_type_idx` ON `background_tasks` (`type`);
--> statement-breakpoint
CREATE INDEX `background_tasks_user_idx` ON `background_tasks` (`user_id`);
--> statement-breakpoint
CREATE INDEX `background_tasks_created_at_idx` ON `background_tasks` (`created_at`);
--> statement-breakpoint
-- Background task events table for event replay
CREATE TABLE `background_task_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL REFERENCES `background_tasks`(`id`) ON DELETE CASCADE,
	`event_type` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `background_task_events_task_id_idx` ON `background_task_events` (`task_id`);
