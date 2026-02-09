CREATE TABLE `tts_collected_clips` (
  `id` text PRIMARY KEY NOT NULL,
  `text` text NOT NULL,
  `tone` text NOT NULL,
  `play_count` integer NOT NULL DEFAULT 0,
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL
);
