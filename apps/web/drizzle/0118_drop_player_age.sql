PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_players` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`help_settings` text,
	`notes` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`is_practice_student` integer DEFAULT true NOT NULL,
	`birthday` text,
	`family_code` text,
	`family_code_generated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `__new_players` (
  `id`,
  `user_id`,
  `name`,
  `emoji`,
  `color`,
  `is_active`,
  `created_at`,
  `help_settings`,
  `notes`,
  `is_archived`,
  `is_practice_student`,
  `birthday`,
  `family_code`,
  `family_code_generated_at`
)
SELECT
  `id`,
  `user_id`,
  `name`,
  `emoji`,
  `color`,
  `is_active`,
  `created_at`,
  `help_settings`,
  `notes`,
  `is_archived`,
  `is_practice_student`,
  `birthday`,
  `family_code`,
  `family_code_generated_at`
FROM `players`;

DROP TABLE `players`;
ALTER TABLE `__new_players` RENAME TO `players`;
CREATE UNIQUE INDEX `players_family_code_unique` ON `players` (`family_code`);
CREATE INDEX `players_user_id_idx` ON `players` (`user_id`);

PRAGMA foreign_keys=ON;
