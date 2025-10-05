CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`upgraded_at` integer,
	`email` text,
	`name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_guest_id_unique` ON `users` (`guest_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_user_id_idx` ON `players` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_stats` (
	`user_id` text PRIMARY KEY NOT NULL,
	`games_played` integer DEFAULT 0 NOT NULL,
	`total_wins` integer DEFAULT 0 NOT NULL,
	`favorite_game_type` text,
	`best_time` integer,
	`highest_accuracy` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
