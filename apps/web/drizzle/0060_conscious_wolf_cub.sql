-- Custom SQL migration file, put your code below! --
-- Add game_break_settings column to session_plans table
ALTER TABLE `session_plans` ADD `game_break_settings` text;