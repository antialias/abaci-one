-- Add prompt_embedding column for storing embedding of just the original topic description
-- This enables better matching for short queries that resemble user prompts
ALTER TABLE `teacher_flowcharts` ADD `prompt_embedding` blob;
