CREATE TABLE `print_service_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`origin` text NOT NULL,
	`token_sealed` text NOT NULL,
	`ring_secret_sealed` text,
	`webhook_registered_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `print_service_connections_user_id_idx` ON `print_service_connections` (`user_id`);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`user_id` text NOT NULL,
	`printer_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `print_service_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `print_jobs_user_id_idx` ON `print_jobs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `print_jobs_connection_id_idx` ON `print_jobs` (`connection_id`);
