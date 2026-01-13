-- Custom SQL migration file, put your code below! --
-- Add remote camera session ID column to session_plans table
ALTER TABLE `session_plans` ADD `remote_camera_session_id` text;
