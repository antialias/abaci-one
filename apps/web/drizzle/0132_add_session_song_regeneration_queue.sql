ALTER TABLE `session_songs` ADD COLUMN `content_review_status` text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `session_songs` ADD COLUMN `content_review_note` text;
--> statement-breakpoint
ALTER TABLE `session_songs` ADD COLUMN `content_reviewed_at` integer;
--> statement-breakpoint
ALTER TABLE `session_songs` ADD COLUMN `content_reviewed_by` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `session_songs` ADD COLUMN `regeneration_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `session_songs` ADD COLUMN `last_regeneration_reason` text;
--> statement-breakpoint
ALTER TABLE `session_songs` ADD COLUMN `last_regeneration_at` integer;
--> statement-breakpoint
CREATE INDEX `session_songs_content_review_status_idx` ON `session_songs` (`content_review_status`);
