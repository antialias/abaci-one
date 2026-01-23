-- Add version counter to workshop_sessions
ALTER TABLE `workshop_sessions` ADD COLUMN `current_version_number` integer DEFAULT 0;
--> statement-breakpoint
-- Create version history table
CREATE TABLE `flowchart_version_history` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `workshop_sessions`(`id`) ON DELETE CASCADE,
  `version_number` integer NOT NULL,
  `definition_json` text NOT NULL,
  `mermaid_content` text NOT NULL,
  `title` text,
  `description` text,
  `emoji` text,
  `difficulty` text,
  `notes` text,
  `source` text NOT NULL,
  `source_request` text,
  `validation_passed` integer,
  `coverage_percent` integer,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fvh_session_idx` ON `flowchart_version_history` (`session_id`);
--> statement-breakpoint
CREATE INDEX `fvh_version_idx` ON `flowchart_version_history` (`session_id`, `version_number`);
