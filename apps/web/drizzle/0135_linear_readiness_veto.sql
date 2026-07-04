CREATE TABLE `linear_readiness_veto` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`category` text NOT NULL,
	`reason` text,
	`vetoed_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `linear_readiness_veto_player_category_unique` ON `linear_readiness_veto` (`player_id`,`category`);
