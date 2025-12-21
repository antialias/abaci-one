-- Custom SQL migration file, put your code below! --
-- Rename last_help_level to last_had_help (terminology change: "help level" is no longer accurate since it's a boolean)
ALTER TABLE `player_skill_mastery` RENAME COLUMN `last_help_level` TO `last_had_help`;
