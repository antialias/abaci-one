import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { readdir, stat, unlink, rmdir } from "fs/promises";

/**
 * Options for video encoding
 */
export interface VideoEncoderOptions {
  /** Input frames directory */
  framesDir: string;
  /** Output MP4 file path */
  outputPath: string;
  /** Frame rate for output video (default: 10) */
  fps?: number;
  /** Video quality (CRF value, lower = better quality, default: 23) */
  quality?: number;
  /** Preset for encoding speed (default: 'medium') */
  preset?:
    | "ultrafast"
    | "superfast"
    | "veryfast"
    | "faster"
    | "fast"
    | "medium"
    | "slow"
    | "slower"
    | "veryslow";
}

/**
 * Result of video encoding
 */
export interface EncodingResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  durationMs?: number;
  error?: string;
}

/**
 * VideoEncoder - Encodes JPEG frames into H.264 MP4 video.
 *
 * Uses fluent-ffmpeg to encode accumulated frames from practice session recordings
 * into a browser-compatible MP4 video.
 *
 * Requirements:
 * - ffmpeg binary must be installed and accessible in PATH
 * - Input frames should be named sequentially (frame_000000.jpg, frame_000001.jpg, etc.)
 */
export class VideoEncoder {
  /**
   * Encode frames to MP4 video
   */
  static async encode(options: VideoEncoderOptions): Promise<EncodingResult> {
    const {
      framesDir,
      outputPath,
      fps = 10,
      quality = 23,
      preset = "medium",
    } = options;

    try {
      // Verify frames exist
      const files = await readdir(framesDir);
      const frameFiles = files
        .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
        .sort();

      if (frameFiles.length === 0) {
        return {
          success: false,
          error: "No frame files found",
        };
      }

      console.log(
        `[VideoEncoder] Encoding ${frameFiles.length} frames to ${outputPath}`,
      );

      // Build input pattern
      const inputPattern = path.join(framesDir, "frame_%06d.jpg");

      // Encode using ffmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(inputPattern)
          .inputFPS(fps)
          .outputOptions([
            "-c:v libx264", // H.264 codec
            `-crf ${quality}`, // Quality (0-51, lower is better)
            `-preset ${preset}`, // Encoding speed preset
            "-pix_fmt yuv420p", // Pixel format for browser compatibility
            "-movflags +faststart", // Enable fast start for streaming
          ])
          .output(outputPath)
          .on("start", (cmd) => {
            console.log(`[VideoEncoder] Running: ${cmd}`);
          })
          .on("progress", (progress) => {
            if (progress.percent) {
              console.log(
                `[VideoEncoder] Progress: ${progress.percent.toFixed(1)}%`,
              );
            }
          })
          .on("end", () => {
            console.log(`[VideoEncoder] Encoding complete: ${outputPath}`);
            resolve();
          })
          .on("error", (err) => {
            console.error(`[VideoEncoder] Encoding failed:`, err.message);
            reject(err);
          })
          .run();
      });

      // Get output file info
      const stats = await stat(outputPath);
      const durationMs = (frameFiles.length / fps) * 1000;

      return {
        success: true,
        outputPath,
        fileSize: stats.size,
        durationMs,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown encoding error",
      };
    }
  }

  /**
   * Clean up frame files after successful encoding
   */
  static async cleanupFrames(framesDir: string): Promise<void> {
    try {
      const files = await readdir(framesDir);

      for (const file of files) {
        await unlink(path.join(framesDir, file));
      }

      await rmdir(framesDir);
      console.log(`[VideoEncoder] Cleaned up frames directory: ${framesDir}`);
    } catch (error) {
      console.error(`[VideoEncoder] Failed to cleanup frames:`, error);
    }
  }

  /**
   * Check if ffmpeg is available
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          console.error("[VideoEncoder] ffmpeg not available:", err.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Get ffmpeg version info
   */
  static async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          resolve(null);
          return;
        }

        // Get version via ffmpeg command
        ffmpeg()
          .outputOptions(["-version"])
          .output("/dev/null")
          .on("stderr", (line: string) => {
            if (line.startsWith("ffmpeg version")) {
              resolve(line);
            }
          })
          .on("error", () => {
            resolve("ffmpeg available (version unknown)");
          })
          .run();
      });
    });
  }
}
