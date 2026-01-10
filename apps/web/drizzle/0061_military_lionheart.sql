-- Custom SQL migration file, put your code below! --

-- Vision training sessions table - stores training history and model references
CREATE TABLE `vision_training_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `model_type` text NOT NULL,
  `display_name` text NOT NULL,
  `config` text NOT NULL,
  `dataset_info` text NOT NULL,
  `result` text NOT NULL,
  `epoch_history` text NOT NULL,
  `model_path` text NOT NULL,
  `is_active` integer DEFAULT 0 NOT NULL,
  `notes` text,
  `tags` text DEFAULT '[]',
  `created_at` integer NOT NULL,
  `trained_at` integer NOT NULL
);
--> statement-breakpoint

-- Index for filtering by model type
CREATE INDEX `vision_training_sessions_model_type_idx` ON `vision_training_sessions` (`model_type`);
--> statement-breakpoint

-- Index for finding active models
CREATE INDEX `vision_training_sessions_is_active_idx` ON `vision_training_sessions` (`is_active`);
--> statement-breakpoint

-- Index for sorting by creation date
CREATE INDEX `vision_training_sessions_created_at_idx` ON `vision_training_sessions` (`created_at`);
--> statement-breakpoint

-- Compound index for finding active model by type
CREATE INDEX `vision_training_sessions_active_by_type_idx` ON `vision_training_sessions` (`model_type`, `is_active`);
