CREATE TABLE `topic_taxonomy` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`embedding` blob NOT NULL,
	`embedding_model` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_taxonomy_label_unique` ON `topic_taxonomy` (`label`);
