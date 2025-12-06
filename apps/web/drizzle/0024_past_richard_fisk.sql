-- Custom SQL migration file, put your code below! --

-- Create player_curriculum table
CREATE TABLE IF NOT EXISTS `player_curriculum` (
	`player_id` text PRIMARY KEY NOT NULL,
	`current_level` integer DEFAULT 1 NOT NULL,
	`current_phase_id` text DEFAULT 'L1.add.+1.direct' NOT NULL,
	`worksheet_preset` text,
	`visualization_mode` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create player_skill_mastery table
CREATE TABLE IF NOT EXISTS `player_skill_mastery` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`consecutive_correct` integer DEFAULT 0 NOT NULL,
	`mastery_level` text DEFAULT 'learning' NOT NULL,
	`last_practiced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create indexes for player_skill_mastery
CREATE INDEX IF NOT EXISTS `player_skill_mastery_player_id_idx` ON `player_skill_mastery` (`player_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `player_skill_mastery_player_skill_unique` ON `player_skill_mastery` (`player_id`, `skill_id`);
