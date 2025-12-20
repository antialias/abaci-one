-- Custom SQL migration file, put your code below! --
-- Add isArchived column to players table for filtering inactive students

ALTER TABLE `players` ADD `is_archived` integer DEFAULT 0 NOT NULL;
