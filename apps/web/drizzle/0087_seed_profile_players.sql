CREATE TABLE `seed_profile_players` (
  `profile_id` text NOT NULL,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `seeded_at` integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (`profile_id`, `player_id`)
);
