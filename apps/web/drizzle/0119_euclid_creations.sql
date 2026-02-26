CREATE TABLE `euclid_creations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`data` text NOT NULL,
	`thumbnail` text,
	`is_public` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `euclid_creations_user_id_idx` ON `euclid_creations` (`user_id`);
--> statement-breakpoint
CREATE INDEX `euclid_creations_public_created_idx` ON `euclid_creations` (`is_public`,`created_at`);
