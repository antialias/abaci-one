CREATE TABLE `player_abacus_identity` (
	`player_id` text PRIMARY KEY NOT NULL,
	`color_scheme` text DEFAULT 'place-value' NOT NULL,
	`color_palette` text DEFAULT 'default' NOT NULL,
	`columns` integer DEFAULT 4 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
