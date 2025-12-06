-- Custom SQL migration file, put your code below! --

-- Create practice_sessions table for tracking practice activity history
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`phase_id` text NOT NULL,
	`problems_attempted` integer DEFAULT 0 NOT NULL,
	`problems_correct` integer DEFAULT 0 NOT NULL,
	`average_time_ms` integer,
	`total_time_ms` integer,
	`skills_used` text DEFAULT '[]' NOT NULL,
	`visualization_mode` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create indexes for practice_sessions
CREATE INDEX `practice_sessions_player_id_idx` ON `practice_sessions` (`player_id`);
--> statement-breakpoint
CREATE INDEX `practice_sessions_started_at_idx` ON `practice_sessions` (`started_at`);
--> statement-breakpoint
CREATE INDEX `practice_sessions_player_phase_idx` ON `practice_sessions` (`player_id`, `phase_id`);