-- Custom SQL migration file, put your code below! --
-- Add native_abacus_numbers column to abacus_settings table
ALTER TABLE `abacus_settings` ADD `native_abacus_numbers` integer DEFAULT 0 NOT NULL;