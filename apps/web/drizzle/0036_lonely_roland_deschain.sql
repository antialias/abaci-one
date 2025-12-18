-- Custom SQL migration file, put your code below! --
-- Add notes column to players table for teacher notes
ALTER TABLE `players` ADD `notes` text;