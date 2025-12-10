-- Custom SQL migration file, put your code below! --
-- Add mastered_skill_ids column to session_plans for skill mismatch detection
ALTER TABLE `session_plans` ADD `mastered_skill_ids` text DEFAULT '[]' NOT NULL;
