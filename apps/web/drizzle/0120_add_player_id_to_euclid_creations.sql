ALTER TABLE `euclid_creations` ADD `player_id` text;
--> statement-breakpoint
CREATE INDEX `euclid_creations_player_id_idx` ON `euclid_creations` (`player_id`);
