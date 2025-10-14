-- Add display_password column to arcade_rooms for showing plain text passwords to room owners
ALTER TABLE `arcade_rooms` ADD `display_password` text(100);
