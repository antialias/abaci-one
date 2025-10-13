CREATE TABLE `room_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reporter_name` text(50) NOT NULL,
	`reported_user_id` text NOT NULL,
	`reported_user_name` text(50) NOT NULL,
	`reason` text NOT NULL,
	`details` text(500),
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewed_by` text,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `room_bans` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text(50) NOT NULL,
	`banned_by` text NOT NULL,
	`banned_by_name` text(50) NOT NULL,
	`reason` text NOT NULL,
	`notes` text(500),
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_room_bans_user_room` ON `room_bans` (`user_id`,`room_id`);