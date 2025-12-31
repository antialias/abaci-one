-- Add original_filename column for preserving uncropped originals
-- When a photo is cropped/adjusted, the original is kept so re-edits
-- can start from the full original image instead of the cropped version.
ALTER TABLE `practice_attachments` ADD `original_filename` text;
