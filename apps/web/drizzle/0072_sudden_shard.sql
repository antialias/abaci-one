-- Custom SQL migration file, put your code below! --

-- Teacher Flowcharts table
CREATE TABLE IF NOT EXISTS `teacher_flowcharts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `emoji` text DEFAULT '📊',
  `difficulty` text,
  `definition_json` text NOT NULL,
  `mermaid_content` text NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `parent_version_id` text,
  `status` text DEFAULT 'draft' NOT NULL,
  `published_at` integer,
  `search_keywords` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `teacher_flowcharts_user_idx` ON `teacher_flowcharts` (`user_id`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `teacher_flowcharts_status_idx` ON `teacher_flowcharts` (`status`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `teacher_flowcharts_parent_version_idx` ON `teacher_flowcharts` (`parent_version_id`);
--> statement-breakpoint

-- Workshop Sessions table
CREATE TABLE IF NOT EXISTS `workshop_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `flowchart_id` text,
  `remix_from_id` text,
  `state` text DEFAULT 'initial' NOT NULL,
  `topic_description` text,
  `refinement_history` text,
  `draft_definition_json` text,
  `draft_mermaid_content` text,
  `draft_title` text,
  `draft_description` text,
  `draft_difficulty` text,
  `draft_emoji` text,
  `draft_notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`flowchart_id`) REFERENCES `teacher_flowcharts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `workshop_sessions_user_idx` ON `workshop_sessions` (`user_id`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `workshop_sessions_state_idx` ON `workshop_sessions` (`state`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `workshop_sessions_expires_idx` ON `workshop_sessions` (`expires_at`);
