CREATE TABLE `arcade_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`current_game` text NOT NULL,
	`game_url` text NOT NULL,
	`game_state` text NOT NULL,
	`active_players` text NOT NULL,
	`started_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
