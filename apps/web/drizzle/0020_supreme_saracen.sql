-- Custom SQL migration file, put your code below! --

-- Add error_message column to worksheet_attempts for storing grading failure details
ALTER TABLE `worksheet_attempts` ADD `error_message` text;
