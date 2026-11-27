-- Phase 6b-0 (session architecture §10 P6b-7; owner-approved 2026-11-27):
-- close the sessions left in progress from before Phase 3a. A row with
-- row_version 0 has never been written by 3a or later code, and one started
-- before 2026-11-26 is long dead (46 in prod). Each is closed as
-- abandonSessionPlan closes one (SESSION_ABANDONED, then
-- revokeSharesForSession), except completed_at: the session's last activity,
-- its last try (a try's JSON timestamp is an ISO string or epoch ms; the
-- column is seconds) if it falls between the start and now, else its start;
-- never now.
--
-- Idempotent: the predicate needs status 'in_progress' and row_version 0; the
-- write sets 'abandoned' and bumps row_version.

-- 1. revokeSharesForSession: the sessions' active share links expire. First,
-- while the rows still match.
UPDATE `session_observation_shares`
SET `status` = 'expired'
WHERE `status` = 'active'
  AND `session_id` IN (
    SELECT `id` FROM `session_plans`
    WHERE `status` = 'in_progress'
      AND `row_version` = 0
      AND `started_at` < unixepoch('2026-11-26')
  );
--> statement-breakpoint
-- 2. SESSION_ABANDONED through withRowCas: status, flowMove (flow_version and
-- flow_updated_at move only when flow_state does), an open break closed at now
-- (endedAt, and durationMs when it has a start), row_version + 1.
UPDATE `session_plans`
SET
  `status` = 'abandoned',
  `flow_state` = 'abandoned',
  `flow_version` = CASE WHEN `flow_state` = 'abandoned' THEN `flow_version` ELSE `flow_version` + 1 END,
  `flow_updated_at` = CASE WHEN `flow_state` = 'abandoned' THEN `flow_updated_at` ELSE unixepoch('now') END,
  -- Only object elements are read (json_type on a non-object throws and would
  -- fail the whole migrate), and only times between the start and now count:
  -- a mis-read unit (seconds-epoch read as ms lands in 1970) or a bad clock
  -- falls back to the start instead of misdating the session.
  `completed_at` = COALESCE(
    (
      SELECT MAX(t) FROM (
        SELECT
          CASE json_type(r.value, '$.timestamp')
            WHEN 'text' THEN unixepoch(json_extract(r.value, '$.timestamp'))
            WHEN 'integer' THEN CAST(json_extract(r.value, '$.timestamp') / 1000 AS INTEGER)
            WHEN 'real' THEN CAST(json_extract(r.value, '$.timestamp') / 1000 AS INTEGER)
          END AS t
        FROM json_each(CASE WHEN json_valid(`results`) THEN `results` ELSE '[]' END) AS r
        WHERE r.type = 'object'
      )
      WHERE (`started_at` IS NULL OR t >= `started_at`) AND t <= unixepoch('now')
    ),
    `started_at`
  ),
  `breaks` = CASE
    WHEN json_valid(`breaks`)
      AND json_array_length(`breaks`) > 0
      AND json_type(`breaks`, '$[#-1].endedAt') IS NULL
    THEN CASE
      WHEN json_type(`breaks`, '$[#-1].startedAt') = 'text'
      THEN json_set(
        `breaks`,
        '$[#-1].endedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        '$[#-1].durationMs', MAX(
          0,
          CAST(round((julianday('now') - julianday(json_extract(`breaks`, '$[#-1].startedAt'))) * 86400000) AS INTEGER)
        )
      )
      ELSE json_set(`breaks`, '$[#-1].endedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    END
    ELSE `breaks`
  END,
  `row_version` = `row_version` + 1
WHERE `status` = 'in_progress'
  AND `row_version` = 0
  AND `started_at` < unixepoch('2026-11-26');
