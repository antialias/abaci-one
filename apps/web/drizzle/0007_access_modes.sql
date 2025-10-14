-- Add access control columns to arcade_rooms
ALTER TABLE `arcade_rooms` ADD `access_mode` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `arcade_rooms` ADD `password` text(255);--> statement-breakpoint

-- Create room_join_requests table for approval-only mode
CREATE TABLE `room_join_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text(50) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewed_by` text,
	`reviewed_by_name` text(50),
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_room_join_requests_user_room` ON `room_join_requests` (`user_id`,`room_id`);
