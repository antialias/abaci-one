CREATE TABLE `abacus_print_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`style` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
