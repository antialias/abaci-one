-- Custom SQL migration file, put your code below! --
-- Add problem generation mode column to player_curriculum table
-- 'adaptive' = BKT-based continuous scaling (default)
-- 'classic' = Fluency-based discrete states
ALTER TABLE `player_curriculum` ADD `problem_generation_mode` text DEFAULT 'adaptive' NOT NULL;
