CREATE TABLE `tts_collected_clips_new` (
  `id` text PRIMARY KEY NOT NULL,
  `tone` text NOT NULL,
  `play_count` integer NOT NULL DEFAULT 0,
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL
);
--> statement-breakpoint
DROP TABLE `tts_collected_clips`;
--> statement-breakpoint
ALTER TABLE `tts_collected_clips_new` RENAME TO `tts_collected_clips`;
--> statement-breakpoint
CREATE TABLE `tts_collected_clip_say` (
  `clip_id` text NOT NULL,
  `locale` text NOT NULL,
  `text` text NOT NULL,
  PRIMARY KEY(`clip_id`, `locale`)
);
