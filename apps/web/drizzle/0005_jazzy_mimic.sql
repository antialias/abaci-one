PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_arcade_sessions` (
	`room_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`current_game` text NOT NULL,
	`game_url` text NOT NULL,
	`game_state` text NOT NULL,
	`active_players` text NOT NULL,
	`started_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `arcade_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_arcade_sessions`("room_id", "user_id", "current_game", "game_url", "game_state", "active_players", "started_at", "last_activity_at", "expires_at", "is_active", "version") SELECT "room_id", "user_id", "current_game", "game_url", "game_state", "active_players", "started_at", "last_activity_at", "expires_at", "is_active", "version" FROM `arcade_sessions`;--> statement-breakpoint
DROP TABLE `arcade_sessions`;--> statement-breakpoint
ALTER TABLE `__new_arcade_sessions` RENAME TO `arcade_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;