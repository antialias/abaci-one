-- Smoke test runs table for storing E2E test results
CREATE TABLE `smoke_test_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `started_at` integer NOT NULL,
  `completed_at` integer,
  `status` text NOT NULL,
  `total_tests` integer,
  `passed_tests` integer,
  `failed_tests` integer,
  `duration_ms` integer,
  `results_json` text,
  `error_message` text
);
--> statement-breakpoint
CREATE INDEX `smoke_test_runs_started_at_idx` ON `smoke_test_runs` (`started_at`);
--> statement-breakpoint
CREATE INDEX `smoke_test_runs_status_idx` ON `smoke_test_runs` (`status`);
