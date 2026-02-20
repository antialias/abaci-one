CREATE TABLE `feature_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`config` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
