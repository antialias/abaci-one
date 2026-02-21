CREATE TABLE `family_events` (
	`id` text PRIMARY KEY NOT NULL,
	`child_player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
	`event_type` text NOT NULL,
	`actor_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`target_user_id` text,
	`created_at` integer NOT NULL
);
