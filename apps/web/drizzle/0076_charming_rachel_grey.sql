-- Custom SQL migration file, put your code below! --
-- Add linkedPublishedId to workshop_sessions for edit-in-place workflow
ALTER TABLE `workshop_sessions` ADD `linked_published_id` text REFERENCES `teacher_flowcharts`(`id`) ON DELETE SET NULL;
