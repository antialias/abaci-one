CREATE TABLE `abacus_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`color_scheme` text DEFAULT 'place-value' NOT NULL,
	`bead_shape` text DEFAULT 'diamond' NOT NULL,
	`color_palette` text DEFAULT 'default' NOT NULL,
	`hide_inactive_beads` integer DEFAULT false NOT NULL,
	`colored_numerals` integer DEFAULT false NOT NULL,
	`scale_factor` real DEFAULT 1 NOT NULL,
	`show_numbers` integer DEFAULT true NOT NULL,
	`animated` integer DEFAULT true NOT NULL,
	`interactive` integer DEFAULT false NOT NULL,
	`gestures` integer DEFAULT false NOT NULL,
	`sound_enabled` integer DEFAULT true NOT NULL,
	`sound_volume` real DEFAULT 0.8 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
