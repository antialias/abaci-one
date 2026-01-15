import fs from "fs/promises";
import path from "path";

/**
 * Shared training data deletion utilities.
 *
 * All training data deletion should go through these functions to ensure
 * deletions are recorded in tombstone files (preventing re-sync from production).
 */

// Base paths for training data
const VISION_TRAINING_DIR = path.join(process.cwd(), "data/vision-training");
const COLUMN_CLASSIFIER_DIR = path.join(VISION_TRAINING_DIR, "collected");
const BOUNDARY_DETECTOR_DIR = path.join(VISION_TRAINING_DIR, "boundary-frames");

// Tombstone file paths
const COLUMN_CLASSIFIER_TOMBSTONE = path.join(
  COLUMN_CLASSIFIER_DIR,
  ".deleted",
);
const BOUNDARY_DETECTOR_TOMBSTONE = path.join(
  BOUNDARY_DETECTOR_DIR,
  ".deleted",
);

export interface DeletionResult {
  success: boolean;
  /** True if file was deleted (false if it didn't exist) */
  deleted: boolean;
  /** True if deletion was recorded to tombstone */
  tombstoneRecorded: boolean;
  /** Error message if something went wrong */
  error?: string;
}

/**
 * Record a deletion to a tombstone file.
 *
 * The tombstone file is a simple newline-delimited list of relative paths.
 * These paths are excluded during rsync from production.
 *
 * @param tombstonePath - Path to the tombstone file
 * @param relativePath - Relative path of the deleted file (e.g., "3/filename.png")
 * @returns True if recorded successfully, false otherwise
 */
async function recordToTombstone(
  tombstonePath: string,
  relativePath: string,
): Promise<boolean> {
  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(tombstonePath), { recursive: true });
    // Append to tombstone file
    await fs.appendFile(tombstonePath, `${relativePath}\n`);
    return true;
  } catch (error) {
    console.error(
      "[trainingDataDeletion] Failed to record to tombstone:",
      error,
    );
    return false;
  }
}

/**
 * Delete a column classifier training sample.
 *
 * Deletes the PNG file and records the deletion to the tombstone file
 * to prevent re-syncing from production.
 *
 * @param digit - The digit label (0-9)
 * @param filename - The filename (e.g., "1234567890_player_session_col0_uuid.png")
 */
export async function deleteColumnClassifierSample(
  digit: number,
  filename: string,
): Promise<DeletionResult> {
  // Validate inputs
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    return {
      success: false,
      deleted: false,
      tombstoneRecorded: false,
      error: "Invalid digit",
    };
  }
  if (
    !filename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return {
      success: false,
      deleted: false,
      tombstoneRecorded: false,
      error: "Invalid filename",
    };
  }
  if (!filename.endsWith(".png")) {
    return {
      success: false,
      deleted: false,
      tombstoneRecorded: false,
      error: "Filename must end with .png",
    };
  }

  const filePath = path.join(COLUMN_CLASSIFIER_DIR, String(digit), filename);
  const relativePath = `${digit}/${filename}`;

  let deleted = false;
  let tombstoneRecorded = false;

  // Try to delete the file
  try {
    await fs.unlink(filePath);
    deleted = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist - that's fine, still record to tombstone
      // (in case it exists on production)
    } else {
      return {
        success: false,
        deleted: false,
        tombstoneRecorded: false,
        error: `Failed to delete file: ${(error as Error).message}`,
      };
    }
  }

  // Record to tombstone (even if file didn't exist locally - it might exist on production)
  tombstoneRecorded = await recordToTombstone(
    COLUMN_CLASSIFIER_TOMBSTONE,
    relativePath,
  );

  return {
    success: true,
    deleted,
    tombstoneRecorded,
    error: tombstoneRecorded
      ? undefined
      : "Warning: deletion not recorded to tombstone",
  };
}

/**
 * Delete a boundary detector training sample.
 *
 * Deletes the image file (PNG or JPG) and its JSON annotation,
 * and records the deletion to the tombstone file.
 *
 * @param deviceId - The device subdirectory (e.g., "default", "passive-practice-remote")
 * @param baseName - The base filename without extension (e.g., "1234567890_abc123")
 */
export async function deleteBoundaryDetectorSample(
  deviceId: string,
  baseName: string,
): Promise<DeletionResult> {
  // Validate inputs
  if (
    !deviceId ||
    deviceId.includes("..") ||
    deviceId.includes("/") ||
    deviceId.includes("\\")
  ) {
    return {
      success: false,
      deleted: false,
      tombstoneRecorded: false,
      error: "Invalid deviceId",
    };
  }
  if (
    !baseName ||
    baseName.includes("..") ||
    baseName.includes("/") ||
    baseName.includes("\\")
  ) {
    return {
      success: false,
      deleted: false,
      tombstoneRecorded: false,
      error: "Invalid baseName",
    };
  }

  const deviceDir = path.join(BOUNDARY_DETECTOR_DIR, deviceId);
  const pngPath = path.join(deviceDir, `${baseName}.png`);
  const jpgPath = path.join(deviceDir, `${baseName}.jpg`);
  const jsonPath = path.join(deviceDir, `${baseName}.json`);

  let deleted = false;
  let imageExtension: "png" | "jpg" | null = null;

  // Try to delete PNG version
  try {
    await fs.unlink(pngPath);
    deleted = true;
    imageExtension = "png";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return {
        success: false,
        deleted: false,
        tombstoneRecorded: false,
        error: `Failed to delete PNG: ${(error as Error).message}`,
      };
    }
  }

  // Try to delete JPG version
  try {
    await fs.unlink(jpgPath);
    deleted = true;
    imageExtension = "jpg";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return {
        success: false,
        deleted: false,
        tombstoneRecorded: false,
        error: `Failed to delete JPG: ${(error as Error).message}`,
      };
    }
  }

  // Try to delete JSON annotation
  try {
    await fs.unlink(jsonPath);
    deleted = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // Log but don't fail - the image is the primary file
      console.error("[trainingDataDeletion] Failed to delete JSON:", error);
    }
  }

  // Record to tombstone
  // We record both PNG and JPG patterns to be safe
  let tombstoneRecorded = false;
  const pngRelativePath = `${deviceId}/${baseName}.png`;
  const jpgRelativePath = `${deviceId}/${baseName}.jpg`;

  // Record the actual extension if known, otherwise record both
  if (imageExtension === "png") {
    tombstoneRecorded = await recordToTombstone(
      BOUNDARY_DETECTOR_TOMBSTONE,
      pngRelativePath,
    );
  } else if (imageExtension === "jpg") {
    tombstoneRecorded = await recordToTombstone(
      BOUNDARY_DETECTOR_TOMBSTONE,
      jpgRelativePath,
    );
  } else {
    // Unknown extension - record both to be safe
    const pngRecorded = await recordToTombstone(
      BOUNDARY_DETECTOR_TOMBSTONE,
      pngRelativePath,
    );
    const jpgRecorded = await recordToTombstone(
      BOUNDARY_DETECTOR_TOMBSTONE,
      jpgRelativePath,
    );
    tombstoneRecorded = pngRecorded || jpgRecorded;
  }

  return {
    success: true,
    deleted,
    tombstoneRecorded,
    error: tombstoneRecorded
      ? undefined
      : "Warning: deletion not recorded to tombstone",
  };
}

/**
 * Read the list of deleted files from a tombstone.
 *
 * @param modelType - Which model's tombstone to read
 * @returns Set of relative paths that have been deleted
 */
export async function readTombstone(
  modelType: "column-classifier" | "boundary-detector",
): Promise<Set<string>> {
  const tombstonePath =
    modelType === "column-classifier"
      ? COLUMN_CLASSIFIER_TOMBSTONE
      : BOUNDARY_DETECTOR_TOMBSTONE;

  try {
    const content = await fs.readFile(tombstonePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    return new Set(lines);
  } catch {
    // File doesn't exist yet - no deletions recorded
    return new Set();
  }
}

/**
 * Initialize a tombstone file if it doesn't exist.
 *
 * This should be called at the start of a sync operation to ensure
 * the tombstone file exists. This prevents the scenario where:
 * 1. User deletes files locally before ever syncing
 * 2. User syncs from production
 * 3. Deleted files reappear because there was no tombstone to record them
 *
 * By creating the tombstone file on first sync, we ensure that any
 * subsequent deletions will be properly recorded.
 *
 * @param modelType - Which model's tombstone to initialize
 * @returns True if initialized (created or already existed), false on error
 */
export async function initializeTombstone(
  modelType: "column-classifier" | "boundary-detector",
): Promise<boolean> {
  const tombstonePath =
    modelType === "column-classifier"
      ? COLUMN_CLASSIFIER_TOMBSTONE
      : BOUNDARY_DETECTOR_TOMBSTONE;

  try {
    // Check if file already exists
    try {
      await fs.access(tombstonePath);
      // File exists, nothing to do
      return true;
    } catch {
      // File doesn't exist, create it
    }

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(tombstonePath), { recursive: true });

    // Create empty tombstone file
    await fs.writeFile(tombstonePath, "");
    console.log(
      `[trainingDataDeletion] Initialized tombstone: ${tombstonePath}`,
    );
    return true;
  } catch (error) {
    console.error(
      "[trainingDataDeletion] Failed to initialize tombstone:",
      error,
    );
    return false;
  }
}

export interface PruneTombstoneResult {
  success: boolean;
  /** Number of entries before pruning */
  entriesBefore: number;
  /** Number of entries after pruning */
  entriesAfter: number;
  /** Number of entries removed */
  entriesPruned: number;
  /** Error message if pruning failed */
  error?: string;
}

/**
 * Prune tombstone entries that no longer exist on production.
 *
 * IMPORTANT: This function requires a verified set of remote files.
 * The caller MUST have successfully connected to production and retrieved
 * the file list before calling this function. If SSH connection fails,
 * do NOT call this function - it would incorrectly prune all entries.
 *
 * The pruning logic:
 * - If a tombstoned file still exists on production → keep the entry
 * - If a tombstoned file no longer exists on production → remove the entry
 *   (no point excluding a file that doesn't exist)
 *
 * @param modelType - Which model's tombstone to prune
 * @param remoteFiles - Set of file paths that exist on production (MUST be from successful SSH)
 * @returns Result with pruning statistics
 */
export async function pruneTombstone(
  modelType: "column-classifier" | "boundary-detector",
  remoteFiles: Set<string>,
): Promise<PruneTombstoneResult> {
  const tombstonePath =
    modelType === "column-classifier"
      ? COLUMN_CLASSIFIER_TOMBSTONE
      : BOUNDARY_DETECTOR_TOMBSTONE;

  try {
    // Read current tombstone entries
    const currentEntries = await readTombstone(modelType);
    const entriesBefore = currentEntries.size;

    if (entriesBefore === 0) {
      return {
        success: true,
        entriesBefore: 0,
        entriesAfter: 0,
        entriesPruned: 0,
      };
    }

    // Keep only entries that still exist on production
    // (if file doesn't exist on production, no need to exclude it from sync)
    const entriesToKeep: string[] = [];
    for (const entry of currentEntries) {
      if (remoteFiles.has(entry)) {
        entriesToKeep.push(entry);
      }
    }

    const entriesAfter = entriesToKeep.length;
    const entriesPruned = entriesBefore - entriesAfter;

    // Only write if something changed
    if (entriesPruned > 0) {
      // Write the pruned tombstone (with trailing newline if non-empty)
      const content =
        entriesToKeep.length > 0 ? entriesToKeep.join("\n") + "\n" : "";
      await fs.writeFile(tombstonePath, content);
      console.log(
        `[trainingDataDeletion] Pruned tombstone for ${modelType}: ` +
          `${entriesPruned} entries removed, ${entriesAfter} remaining`,
      );
    }

    return {
      success: true,
      entriesBefore,
      entriesAfter,
      entriesPruned,
    };
  } catch (error) {
    console.error("[trainingDataDeletion] Failed to prune tombstone:", error);
    return {
      success: false,
      entriesBefore: 0,
      entriesAfter: 0,
      entriesPruned: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
