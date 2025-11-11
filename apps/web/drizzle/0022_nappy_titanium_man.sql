-- Custom SQL migration file, put your code below! --

-- Table for fully user-created custom skills
CREATE TABLE `custom_skills` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `operator` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `digit_range` text NOT NULL,
  `regrouping_config` text NOT NULL,
  `display_rules` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_custom_skills_user_operator` ON `custom_skills` (`user_id`, `operator`);
--> statement-breakpoint
-- Table for customizations of default skills
CREATE TABLE `skill_customizations` (
  `user_id` text NOT NULL,
  `skill_id` text NOT NULL,
  `operator` text NOT NULL,
  `digit_range` text NOT NULL,
  `regrouping_config` text NOT NULL,
  `display_rules` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `skill_id`, `operator`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
