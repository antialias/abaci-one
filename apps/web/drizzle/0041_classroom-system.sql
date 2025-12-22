-- Custom SQL migration file, put your code below! --
-- Classroom system: parent-child relationships, classrooms, enrollments, presence

-- ============================================================================
-- 1. Add family_code to players table
-- ============================================================================

ALTER TABLE `players` ADD `family_code` text;
--> statement-breakpoint

CREATE UNIQUE INDEX `players_family_code_unique` ON `players` (`family_code`);
--> statement-breakpoint

-- ============================================================================
-- 2. Add pause fields to session_plans table
-- ============================================================================

ALTER TABLE `session_plans` ADD `paused_at` integer;
--> statement-breakpoint

ALTER TABLE `session_plans` ADD `paused_by` text;
--> statement-breakpoint

ALTER TABLE `session_plans` ADD `paused_reason` text;
--> statement-breakpoint

-- ============================================================================
-- 3. Create parent_child table (many-to-many family relationships)
-- ============================================================================

CREATE TABLE `parent_child` (
  `parent_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `child_player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `linked_at` integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (`parent_user_id`, `child_player_id`)
);
--> statement-breakpoint

-- ============================================================================
-- 4. Create classrooms table (one per teacher)
-- ============================================================================

CREATE TABLE `classrooms` (
  `id` text PRIMARY KEY NOT NULL,
  `teacher_id` text NOT NULL UNIQUE REFERENCES `users`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `code` text NOT NULL UNIQUE,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

CREATE INDEX `classrooms_code_idx` ON `classrooms` (`code`);
--> statement-breakpoint

-- ============================================================================
-- 5. Create classroom_enrollments table (persistent student roster)
-- ============================================================================

CREATE TABLE `classroom_enrollments` (
  `id` text PRIMARY KEY NOT NULL,
  `classroom_id` text NOT NULL REFERENCES `classrooms`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `enrolled_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

CREATE UNIQUE INDEX `idx_enrollments_classroom_player` ON `classroom_enrollments` (`classroom_id`, `player_id`);
--> statement-breakpoint

CREATE INDEX `idx_enrollments_classroom` ON `classroom_enrollments` (`classroom_id`);
--> statement-breakpoint

CREATE INDEX `idx_enrollments_player` ON `classroom_enrollments` (`player_id`);
--> statement-breakpoint

-- ============================================================================
-- 6. Create enrollment_requests table (consent workflow)
-- ============================================================================

CREATE TABLE `enrollment_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `classroom_id` text NOT NULL REFERENCES `classrooms`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `requested_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `requested_by_role` text NOT NULL,
  `requested_at` integer NOT NULL DEFAULT (unixepoch()),
  `status` text NOT NULL DEFAULT 'pending',
  `teacher_approval` text,
  `teacher_approved_at` integer,
  `parent_approval` text,
  `parent_approved_by` text REFERENCES `users`(`id`),
  `parent_approved_at` integer,
  `resolved_at` integer
);
--> statement-breakpoint

CREATE UNIQUE INDEX `idx_enrollment_requests_classroom_player` ON `enrollment_requests` (`classroom_id`, `player_id`);
--> statement-breakpoint

CREATE INDEX `idx_enrollment_requests_classroom` ON `enrollment_requests` (`classroom_id`);
--> statement-breakpoint

CREATE INDEX `idx_enrollment_requests_player` ON `enrollment_requests` (`player_id`);
--> statement-breakpoint

CREATE INDEX `idx_enrollment_requests_status` ON `enrollment_requests` (`status`);
--> statement-breakpoint

-- ============================================================================
-- 7. Create classroom_presence table (ephemeral "in classroom" state)
-- ============================================================================

CREATE TABLE `classroom_presence` (
  `player_id` text PRIMARY KEY NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `classroom_id` text NOT NULL REFERENCES `classrooms`(`id`) ON DELETE CASCADE,
  `entered_at` integer NOT NULL DEFAULT (unixepoch()),
  `entered_by` text NOT NULL REFERENCES `users`(`id`)
);
--> statement-breakpoint

CREATE INDEX `idx_presence_classroom` ON `classroom_presence` (`classroom_id`);
--> statement-breakpoint

-- ============================================================================
-- 8. Data migration: Create parent_child entries from existing players
-- ============================================================================

-- For each existing player, create a parent_child relationship with the creator
INSERT INTO `parent_child` (`parent_user_id`, `child_player_id`, `linked_at`)
SELECT `user_id`, `id`, `created_at` FROM `players`;
