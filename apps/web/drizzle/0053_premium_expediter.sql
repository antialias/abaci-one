-- Custom SQL migration file, put your code below! --
-- Add rotation column to practice_attachments for persisting image rotation
ALTER TABLE `practice_attachments` ADD COLUMN `rotation` integer DEFAULT 0;
