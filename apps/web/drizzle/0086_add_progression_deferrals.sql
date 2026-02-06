CREATE TABLE `progression_deferrals` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
	`skill_id` text NOT NULL,
	`deferred_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progression_deferrals_player_skill_idx` ON `progression_deferrals` (`player_id`, `skill_id`);
