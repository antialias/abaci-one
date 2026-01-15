import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { promises as fsPromises } from "fs";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db";
import { visionTrainingSessions } from "@/db/schema/vision-training-sessions";
import { eq, and } from "drizzle-orm";
import {
  ensureVenvReady,
  isPlatformSupported,
  PYTHON_ENV,
  TRAINING_PYTHON,
} from "../config";

// Force dynamic rendering - this route manages training process state
export const dynamic = "force-dynamic";

/**
 * Path to the stop signal file for the current training session
 * When this file is created, the Python script will stop and save
 */
let activeStopFilePath: string | null = null;

/**
 * Training configuration options
 */
interface TrainingConfig {
  modelType?: "column-classifier" | "boundary-detector";
  epochs?: number;
  batchSize?: number;
  validationSplit?: number;
  noAugmentation?: boolean;
  colorAugmentation?: boolean;
}

/**
 * Model-specific configuration
 */
const MODEL_CONFIG = {
  "column-classifier": {
    script: "scripts/train-column-classifier/train_model.py",
    dataDir: "./data/vision-training/collected",
    // Models are now saved to data/vision-training/models/{modelType}/{sessionId}/
    modelsDir: "./data/vision-training/models/column-classifier",
  },
  "boundary-detector": {
    script: "scripts/train-boundary-detector/train_model.py",
    dataDir: "./data/vision-training/boundary-frames",
    // Models are now saved to data/vision-training/models/{modelType}/{sessionId}/
    modelsDir: "./data/vision-training/models/boundary-detector",
  },
} as const;

/**
 * Active training process (only one allowed at a time)
 */
let activeProcess: ChildProcess | null = null;
let activeAbortController: AbortController | null = null;

/**
 * Training session data collected during training
 * Used to save session to database when training completes
 */
interface TrainingSessionData {
  sessionId: string;
  modelType: "column-classifier" | "boundary-detector";
  config: {
    epochs: number;
    batchSize: number;
    validationSplit: number;
    colorAugmentation: boolean;
    [key: string]: unknown; // Allow additional config fields
  };
  datasetInfo: Record<string, unknown> | null;
  epochHistory: Array<Record<string, unknown>>;
  completeData: Record<string, unknown> | null;
  // New metadata fields
  hardware: Record<string, unknown> | null;
  environment: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  trainingDurationSeconds: number | null;
}

let activeSessionData: TrainingSessionData | null = null;

/**
 * Model type to public directory mapping
 */
const MODEL_TYPE_TO_PUBLIC_DIR: Record<string, string> = {
  "column-classifier": "abacus-column-classifier",
  "boundary-detector": "abacus-boundary-detector",
};

/**
 * Copy model files to public/models/
 */
async function copyModelToPublic(
  modelPath: string,
  modelType: "column-classifier" | "boundary-detector",
): Promise<void> {
  const sourceDir = path.join(
    process.cwd(),
    "data/vision-training/models",
    modelPath,
  );
  const targetDir = path.join(
    process.cwd(),
    "public/models",
    MODEL_TYPE_TO_PUBLIC_DIR[modelType],
  );

  // Ensure target directory exists
  await fsPromises.mkdir(targetDir, { recursive: true });

  // Read source directory
  const files = await fsPromises.readdir(sourceDir);

  // Copy each file
  for (const file of files) {
    const sourceFilePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    // Only copy regular files (not directories)
    const stat = await fsPromises.stat(sourceFilePath);
    if (stat.isFile()) {
      await fsPromises.copyFile(sourceFilePath, targetPath);
      console.log(`[Training] Copied ${file} to ${targetDir}`);
    }
  }
}

/**
 * Save training session to database
 */
async function saveTrainingSession(
  sessionData: TrainingSessionData,
): Promise<void> {
  if (!sessionData.completeData || !sessionData.datasetInfo) {
    console.error(
      "[Training] Cannot save session - missing complete data or dataset info",
    );
    return;
  }

  const modelPath = `${sessionData.modelType}/${sessionData.sessionId}`;
  const displayName = `${sessionData.modelType === "column-classifier" ? "Column Classifier" : "Boundary Detector"} - ${new Date().toLocaleDateString()}`;

  try {
    // Deactivate any existing active model for this type
    await db
      .update(visionTrainingSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(visionTrainingSessions.modelType, sessionData.modelType),
          eq(visionTrainingSessions.isActive, true),
        ),
      );

    // Copy model files to public directory
    await copyModelToPublic(modelPath, sessionData.modelType);

    // Create the new session
    await db.insert(visionTrainingSessions).values({
      modelType: sessionData.modelType,
      displayName,
      config:
        sessionData.config as unknown as import("@/app/vision-training/train/components/wizard/types").TrainingConfig,
      datasetInfo:
        sessionData.datasetInfo as unknown as import("@/app/vision-training/train/components/wizard/types").DatasetInfo,
      result:
        sessionData.completeData as unknown as import("@/app/vision-training/train/components/wizard/types").TrainingResult,
      epochHistory:
        sessionData.epochHistory as unknown as import("@/app/vision-training/train/components/wizard/types").EpochData[],
      modelPath,
      isActive: true,
      notes: null,
      tags: [],
      trainedAt: new Date(),
    });

    console.log("[Training] Session saved to database:", sessionData.sessionId);
  } catch (error) {
    console.error("[Training] Failed to save session to database:", error);
  }
}

/**
 * POST /api/vision-training/train
 *
 * Starts the Python training script and streams progress via SSE.
 * Only one training session can run at a time.
 */
export async function POST(request: Request): Promise<Response> {
  // Check platform support first
  const platformCheck = isPlatformSupported();
  if (!platformCheck.supported) {
    return new Response(
      JSON.stringify({
        error: "Platform not supported",
        details: platformCheck.reason,
        hint: "Training should be done on macOS, Linux x86_64, or Windows x86_64",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check if training is already running
  if (activeProcess && !activeProcess.killed) {
    return new Response(
      JSON.stringify({
        error: "Training already in progress",
        hint: "Wait for current training to complete or cancel it first",
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  // Ensure venv is set up (lazy, cached)
  const setup = await ensureVenvReady();
  if (!setup.success) {
    return new Response(
      JSON.stringify({
        error: "Python environment setup failed",
        details: setup.error,
        hint: "Check server logs for details",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse config from request body
  let config: TrainingConfig = {};
  try {
    const body = await request.text();
    if (body) {
      config = JSON.parse(body);
    }
  } catch {
    // Use defaults if body parsing fails
  }

  // Get model-specific configuration
  const modelType = config.modelType || "column-classifier";
  const modelConfig = MODEL_CONFIG[modelType];

  // Check if the training script exists for boundary detector
  // (It may not be implemented yet)
  if (modelType === "boundary-detector") {
    const fs = await import("fs");
    const scriptPath = path.join(process.cwd(), modelConfig.script);
    if (!fs.existsSync(scriptPath)) {
      return new Response(
        JSON.stringify({
          error: "Boundary detector training not yet implemented",
          hint: "The boundary detector training script has not been created yet",
        }),
        { status: 501, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Generate a unique session ID for this training run
  const sessionId = createId();

  // Compute output directory for this session's model files
  // Format: data/vision-training/models/{modelType}/{sessionId}/
  const sessionOutputDir = path.join(modelConfig.modelsDir, sessionId);

  // Generate a unique stop file path for this training session
  const cwd = path.resolve(process.cwd());
  activeStopFilePath = path.join(
    cwd,
    "data",
    "vision-training",
    `.stop-${Date.now()}`,
  );

  // Build command arguments
  const args = [
    modelConfig.script,
    "--json-progress",
    "--data-dir",
    modelConfig.dataDir,
    "--output-dir",
    sessionOutputDir,
    "--session-id",
    sessionId,
    "--stop-file",
    activeStopFilePath,
  ];

  if (config.epochs) {
    args.push("--epochs", String(config.epochs));
  }
  if (config.batchSize) {
    args.push("--batch-size", String(config.batchSize));
  }
  if (config.validationSplit) {
    args.push("--validation-split", String(config.validationSplit));
  }
  if (config.noAugmentation) {
    args.push("--no-augmentation");
  }
  if (config.colorAugmentation) {
    args.push("--color-augmentation");
  }

  // Create abort controller for cancellation
  activeAbortController = new AbortController();
  const { signal } = activeAbortController;

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      // Helper to send SSE event (guards against closed controller)
      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // Controller may be closed, ignore
          isClosed = true;
        }
      };

      // Helper to close the controller safely
      const closeController = () => {
        if (isClosed) return;
        isClosed = true;
        try {
          controller.close();
        } catch {
          // Already closed, ignore
        }
      };

      // Send initial event
      sendEvent("started", {
        message: "Training started",
        config: {
          epochs: config.epochs ?? 50,
          batchSize: config.batchSize ?? 32,
          validationSplit: config.validationSplit ?? 0.2,
          augmentation: !config.noAugmentation,
        },
      });

      // Initialize session data for collecting training info
      activeSessionData = {
        sessionId,
        modelType,
        config: {
          epochs: config.epochs ?? 50,
          batchSize: config.batchSize ?? 32,
          validationSplit: config.validationSplit ?? 0.2,
          colorAugmentation: config.colorAugmentation ?? false,
        },
        datasetInfo: null,
        epochHistory: [],
        completeData: null,
        // New metadata fields - will be populated from training_started event
        hardware: null,
        environment: null,
        startedAt: null,
        completedAt: null,
        trainingDurationSeconds: null,
      };

      // Spawn Python process - uses shared config so hardware detection matches
      activeProcess = spawn(TRAINING_PYTHON, args, {
        cwd,
        env: PYTHON_ENV,
      });

      // Handle stdout (JSON progress events)
      activeProcess.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            const eventType = event.event || "progress";
            sendEvent(eventType, event);

            // Capture training data for session saving
            if (activeSessionData) {
              if (eventType === "training_started") {
                // Capture hardware and environment info from Python
                activeSessionData.hardware = event.hardware || null;
                activeSessionData.environment = event.environment || null;
                activeSessionData.startedAt = event.started_at || null;
                // Update config with any additional fields from Python
                if (event.config) {
                  activeSessionData.config = {
                    ...activeSessionData.config,
                    ...event.config,
                  };
                }
              } else if (
                eventType === "dataset_loaded" ||
                eventType === "dataset_info"
              ) {
                activeSessionData.datasetInfo = {
                  type: modelType,
                  ...event,
                };
              } else if (eventType === "epoch") {
                activeSessionData.epochHistory.push(event);
              } else if (eventType === "complete") {
                // Capture complete data with timing info
                activeSessionData.completeData = {
                  type: modelType,
                  ...event,
                };
                activeSessionData.completedAt = event.completed_at || null;
                activeSessionData.trainingDurationSeconds =
                  event.training_duration_seconds || null;
                // Use epoch_history from complete event if available (more reliable)
                if (event.epoch_history && Array.isArray(event.epoch_history)) {
                  activeSessionData.epochHistory = event.epoch_history;
                }
                // Capture hardware/environment from complete event as fallback
                if (!activeSessionData.hardware && event.hardware) {
                  activeSessionData.hardware = event.hardware;
                }
                if (!activeSessionData.environment && event.environment) {
                  activeSessionData.environment = event.environment;
                }
              }
            }
          } catch {
            // Non-JSON output, send as log
            sendEvent("log", { message: line });
          }
        }
      });

      // Handle stderr
      activeProcess.stderr?.on("data", (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          // Filter out TensorFlow info messages
          if (
            !message.includes("successful NUMA node") &&
            !message.includes("StreamExecutor")
          ) {
            sendEvent("log", { message, type: "stderr" });
          }
        }
      });

      // Handle process exit
      activeProcess.on("close", (code) => {
        // Clean up stop file if it exists
        if (activeStopFilePath) {
          try {
            if (fs.existsSync(activeStopFilePath)) {
              fs.unlinkSync(activeStopFilePath);
            }
          } catch {
            // Ignore cleanup errors
          }
          activeStopFilePath = null;
        }

        if (code === 0) {
          // Save session to database before sending finished event
          if (activeSessionData) {
            saveTrainingSession(activeSessionData)
              .then(() => {
                console.log("[Training] Session saved successfully");
              })
              .catch((err) => {
                console.error("[Training] Failed to save session:", err);
              });
          }
          sendEvent("finished", {
            message: "Training completed successfully",
            code,
            sessionId: activeSessionData?.sessionId,
          });
        } else {
          sendEvent("error", {
            message: `Training failed with code ${code}`,
            code,
          });
        }
        activeProcess = null;
        activeAbortController = null;
        activeSessionData = null;
        closeController();
      });

      // Handle process error
      activeProcess.on("error", (error) => {
        sendEvent("error", { message: error.message });
        activeProcess = null;
        activeAbortController = null;
        activeSessionData = null;
        closeController();
      });

      // Handle cancellation
      signal.addEventListener("abort", () => {
        if (activeProcess && !activeProcess.killed) {
          activeProcess.kill("SIGTERM");
          sendEvent("cancelled", { message: "Training cancelled by user" });
        }
      });
    },

    cancel() {
      // Kill process if stream is cancelled
      if (activeProcess && !activeProcess.killed) {
        activeProcess.kill("SIGTERM");
      }
      activeProcess = null;
      activeAbortController = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * DELETE /api/vision-training/train
 *
 * Cancels any running training process.
 */
export async function DELETE(): Promise<Response> {
  if (!activeProcess || activeProcess.killed) {
    return new Response(
      JSON.stringify({ message: "No training in progress" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Signal abort to cancel the process
  activeAbortController?.abort();

  return new Response(
    JSON.stringify({ message: "Training cancellation requested" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * PUT /api/vision-training/train
 *
 * Triggers early graduation - stops training gracefully and saves the best model.
 * Unlike DELETE (cancel), this ensures the model is saved before stopping.
 */
export async function PUT(): Promise<Response> {
  if (!activeProcess || activeProcess.killed) {
    return new Response(
      JSON.stringify({ message: "No training in progress" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!activeStopFilePath) {
    return new Response(
      JSON.stringify({
        error: "Stop file path not set",
        hint: "Training may have been started with an older version",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Create the stop signal file
  // The Python script checks for this file at the start of each epoch
  try {
    fs.writeFileSync(activeStopFilePath, "stop", { encoding: "utf-8" });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to create stop signal",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      message:
        "Early stop requested - model will be saved at end of current epoch",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * GET /api/vision-training/train
 *
 * Check if training is currently running.
 */
export async function GET(): Promise<Response> {
  const isRunning = activeProcess !== null && !activeProcess.killed;

  return new Response(
    JSON.stringify({
      isRunning,
      message: isRunning ? "Training in progress" : "No training in progress",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
