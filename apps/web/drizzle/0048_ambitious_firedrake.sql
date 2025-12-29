-- Custom SQL migration file, put your code below! --
-- Add entry_prompt_expiry_minutes column to classrooms table
-- Allows teachers to configure their default entry prompt expiry time
-- NULL means use system default (30 minutes)
ALTER TABLE `classrooms` ADD `entry_prompt_expiry_minutes` integer;
