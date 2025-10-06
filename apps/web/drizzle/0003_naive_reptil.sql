CREATE TABLE `arcade_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text(6) NOT NULL,
	`name` text(50) NOT NULL,
	`created_by` text NOT NULL,
	`creator_name` text(50) NOT NULL,
	`created_at` integer NOT NULL,
	`last_activity` integer NOT NULL,
	`ttl_minutes` integer DEFAULT 60 NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`game_name` text NOT NULL,
	`game_config` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`current_session_id` text,
	`total_games_played` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arcade_rooms_code_unique` ON `arcade_rooms` (`code`);--> statement-breakpoint
CREATE TABLE `room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text(50) NOT NULL,
	`is_creator` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`is_online` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `arcade_sessions` ADD `room_id` text REFERENCES arcade_rooms(id);