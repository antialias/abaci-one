#!/usr/bin/env npx tsx
/**
 * Cleanup script for expired vision recordings
 *
 * Deletes recordings that have passed their expiresAt timestamp.
 * Should be run periodically via cron job (e.g., daily).
 *
 * Usage:
 *   npx tsx scripts/cleanupVisionRecordings.ts
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 *   --verbose    Show detailed output
 */

import { eq, lt } from "drizzle-orm";
import { rm } from "fs/promises";
import path from "path";
import { db } from "../src/db";
import { visionRecordings } from "../src/db/schema/vision-recordings";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  console.log("=".repeat(60));
  console.log("Vision Recording Cleanup");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  const now = new Date();

  // Find expired recordings
  const expiredRecordings = await db.query.visionRecordings.findMany({
    where: lt(visionRecordings.expiresAt, now),
  });

  console.log(`Found ${expiredRecordings.length} expired recording(s)`);

  if (expiredRecordings.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  let deletedCount = 0;
  let errorCount = 0;
  let totalSizeBytes = 0;

  for (const recording of expiredRecordings) {
    const recordingDir = path.join(
      process.cwd(),
      "data",
      "uploads",
      "vision-recordings",
      recording.playerId,
      recording.id,
    );

    if (verbose) {
      console.log(`\nProcessing: ${recording.id}`);
      console.log(`  Session: ${recording.sessionId}`);
      console.log(`  Player: ${recording.playerId}`);
      console.log(`  Expired: ${recording.expiresAt.toISOString()}`);
      console.log(
        `  Size: ${recording.fileSize ? `${(recording.fileSize / 1024 / 1024).toFixed(2)} MB` : "unknown"}`,
      );
      console.log(`  Path: ${recordingDir}`);
    }

    if (recording.fileSize) {
      totalSizeBytes += recording.fileSize;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would delete: ${recording.id}`);
      deletedCount++;
      continue;
    }

    try {
      // Delete files from disk
      await rm(recordingDir, { recursive: true, force: true });

      // Delete database record
      await db
        .delete(visionRecordings)
        .where(eq(visionRecordings.id, recording.id));

      deletedCount++;
      console.log(`Deleted: ${recording.id}`);
    } catch (error) {
      errorCount++;
      console.error(`Error deleting ${recording.id}:`, error);
    }
  }

  console.log("");
  console.log("-".repeat(60));
  console.log("Summary:");
  console.log(`  Total expired: ${expiredRecordings.length}`);
  console.log(`  Deleted: ${deletedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(
    `  Space recovered: ${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log("");

  if (dryRun) {
    console.log("NOTE: This was a dry run. No files were actually deleted.");
    console.log("Run without --dry-run to perform actual cleanup.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
