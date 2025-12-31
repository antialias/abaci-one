-- Add corners column for preserving crop coordinates
-- Stores JSON array of 4 {x, y} points in original image coordinates
-- Used to restore crop position when re-editing photos
ALTER TABLE `practice_attachments` ADD `corners` text;
