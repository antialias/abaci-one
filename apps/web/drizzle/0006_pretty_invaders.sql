CREATE TABLE `room_member_history` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text(50) NOT NULL,
	`first_joined_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`last_action` text DEFAULT 'active' NOT NULL,
	`last_action_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `room_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text(50) NOT NULL,
	`invited_by` text NOT NULL,
	`invited_by_name` text(50) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invitation_type` text DEFAULT 'manual' NOT NULL,
	`message` text(500),
	`created_at` integer NOT NULL,
	`responded_at` integer,
	`expires_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_room_invitations_user_room` ON `room_invitations` (`user_id`,`room_id`);