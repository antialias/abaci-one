-- Add retry_state column to session_plans for tracking retry epochs
ALTER TABLE `session_plans` ADD `retry_state` text;
