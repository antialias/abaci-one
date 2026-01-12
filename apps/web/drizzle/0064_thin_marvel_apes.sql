-- Custom SQL migration file, put your code below! --
ALTER TABLE `scanner_settings` ADD `enable_hough_lines` integer DEFAULT true NOT NULL;
