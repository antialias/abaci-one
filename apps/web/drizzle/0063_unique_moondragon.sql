-- Custom SQL migration file, put your code below! --
CREATE TABLE `scanner_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`preprocessing` text DEFAULT 'multi' NOT NULL,
	`enable_histogram_equalization` integer DEFAULT true NOT NULL,
	`enable_adaptive_threshold` integer DEFAULT true NOT NULL,
	`enable_morph_gradient` integer DEFAULT true NOT NULL,
	`canny_low` integer DEFAULT 50 NOT NULL,
	`canny_high` integer DEFAULT 150 NOT NULL,
	`adaptive_block_size` integer DEFAULT 11 NOT NULL,
	`adaptive_c` real DEFAULT 2 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
