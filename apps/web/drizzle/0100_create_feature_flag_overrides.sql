CREATE TABLE `feature_flag_overrides` (
  `flag_key` text NOT NULL,
  `user_id` text NOT NULL,
  `enabled` integer NOT NULL DEFAULT 1,
  `config` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY(`flag_key`, `user_id`)
);
