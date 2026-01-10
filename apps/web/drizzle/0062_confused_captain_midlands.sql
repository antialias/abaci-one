-- Custom SQL migration file, put your code below! --

-- Vision training sync history table
CREATE TABLE `vision_training_sync_history` (
  `id` text PRIMARY KEY NOT NULL,
  `model_type` text NOT NULL,
  `status` text NOT NULL,
  `started_at` integer NOT NULL,
  `completed_at` integer,
  `duration_ms` integer,
  `files_transferred` integer NOT NULL DEFAULT 0,
  `remote_files_count` integer,
  `local_files_before` integer,
  `local_files_after` integer,
  `tombstone_entries_before` integer,
  `tombstone_entries_after` integer,
  `tombstone_pruned` integer,
  `files_excluded_by_tombstone` integer,
  `error` text,
  `remote_host` text,
  `notes` text
);
--> statement-breakpoint

-- Index for filtering by model type
CREATE INDEX `vision_sync_history_model_type_idx` ON `vision_training_sync_history` (`model_type`);
--> statement-breakpoint

-- Index for filtering by status
CREATE INDEX `vision_sync_history_status_idx` ON `vision_training_sync_history` (`status`);
--> statement-breakpoint

-- Index for sorting by start time
CREATE INDEX `vision_sync_history_started_at_idx` ON `vision_training_sync_history` (`started_at`);
--> statement-breakpoint

-- Compound index for model type + start time (common query)
CREATE INDEX `vision_sync_history_model_type_started_at_idx` ON `vision_training_sync_history` (`model_type`, `started_at`);
