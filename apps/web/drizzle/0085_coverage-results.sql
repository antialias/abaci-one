CREATE TABLE `coverage_results` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `timestamp` integer NOT NULL,
  `commit_sha` text,
  `lines_pct` real NOT NULL,
  `branches_pct` real NOT NULL,
  `functions_pct` real NOT NULL,
  `statements_pct` real NOT NULL
);
