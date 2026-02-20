-- Backfill: convert stored guestIds to database user.ids
-- Only rows where the stored value matches a users.guest_id need conversion.
-- Authenticated users already stored user.id via getViewerId() returning session.user.id.

UPDATE `arcade_rooms` SET `created_by` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `arcade_rooms`.`created_by`
)
WHERE `created_by` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_members` SET `user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_members`.`user_id`
)
WHERE `user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_bans` SET `user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_bans`.`user_id`
)
WHERE `user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_bans` SET `banned_by` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_bans`.`banned_by`
)
WHERE `banned_by` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_reports` SET `reporter_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_reports`.`reporter_id`
)
WHERE `reporter_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_reports` SET `reported_user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_reports`.`reported_user_id`
)
WHERE `reported_user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_reports` SET `reviewed_by` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_reports`.`reviewed_by`
)
WHERE `reviewed_by` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_invitations` SET `user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_invitations`.`user_id`
)
WHERE `user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_invitations` SET `invited_by` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_invitations`.`invited_by`
)
WHERE `invited_by` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_join_requests` SET `user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_join_requests`.`user_id`
)
WHERE `user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_join_requests` SET `reviewed_by` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_join_requests`.`reviewed_by`
)
WHERE `reviewed_by` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `room_member_history` SET `user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `room_member_history`.`user_id`
)
WHERE `user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `worksheet_settings` SET `user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `worksheet_settings`.`user_id`
)
WHERE `user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

-- NOTE: worksheet_mastery, worksheet_attempts, and problem_attempts tables
-- may not exist in all environments (schema-defined but not yet migrated).
-- They will use getDbUserId() from creation, so no backfill needed.
-- If these tables are created later via migration, add a backfill then.

UPDATE `game_results` SET `user_id` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `game_results`.`user_id`
)
WHERE `user_id` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
--> statement-breakpoint

UPDATE `session_observation_shares` SET `created_by` = (
  SELECT `id` FROM `users` WHERE `guest_id` = `session_observation_shares`.`created_by`
)
WHERE `created_by` IN (SELECT `guest_id` FROM `users` WHERE `guest_id` IS NOT NULL);
