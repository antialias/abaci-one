-- Add physical_abacus_columns column to abacus_settings table
ALTER TABLE `abacus_settings` ADD `physical_abacus_columns` integer DEFAULT 4 NOT NULL;
