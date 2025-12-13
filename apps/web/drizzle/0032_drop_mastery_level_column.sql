-- Custom SQL migration file, put your code below! --
-- Drop the deprecated mastery_level column from player_skill_mastery table
-- This column has been replaced by isPracticing + computed fluency state

ALTER TABLE `player_skill_mastery` DROP COLUMN `mastery_level`;
