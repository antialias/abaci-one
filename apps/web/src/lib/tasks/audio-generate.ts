import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { AUDIO_MANIFEST } from "@/lib/audio/audioManifest";
import { createTask } from "../task-manager";
import type { AudioGenerateEvent } from "./events";

const AUDIO_DIR = join(process.cwd(), "public", "audio");

export interface AudioGenerateInput {
  voice: string;
  clipIds?: string[]; // If provided, delete these files first and regenerate only them
}

export interface AudioGenerateOutput {
  voice: string;
  generated: number;
  errors: number;
  total: number;
}

/**
 * Start an audio generation background task.
 *
 * Generates all missing TTS clips for a given voice using OpenAI TTS API.
 * Reports per-clip progress via task events.
 */
export async function startAudioGeneration(
  input: AudioGenerateInput,
): Promise<string> {
  return createTask<
    AudioGenerateInput,
    AudioGenerateOutput,
    AudioGenerateEvent
  >("audio-generate", input, async (handle, config) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      handle.fail("OPENAI_API_KEY is not configured");
      return;
    }

    const voiceDir = join(AUDIO_DIR, config.voice);
    mkdirSync(voiceDir, { recursive: true });

    // If clipIds provided, delete those files first so they'll be "missing"
    if (config.clipIds && config.clipIds.length > 0) {
      const targetSet = new Set(config.clipIds);
      for (const clip of AUDIO_MANIFEST) {
        if (targetSet.has(clip.id)) {
          const filePath = join(voiceDir, clip.filename);
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
        }
      }
    }

    // Determine which clips to generate
    const clipScope = config.clipIds
      ? AUDIO_MANIFEST.filter((clip) => config.clipIds!.includes(clip.id))
      : AUDIO_MANIFEST;

    const missing = clipScope.filter(
      (clip) => !existsSync(join(voiceDir, clip.filename)),
    );

    handle.emit({
      type: "audio_started",
      voice: config.voice,
      totalClips: clipScope.length,
      missingClips: missing.length,
      clipIds: config.clipIds,
    });

    if (missing.length === 0) {
      handle.emit({
        type: "audio_complete",
        generated: 0,
        errors: 0,
        total: clipScope.length,
      });
      handle.complete({
        voice: config.voice,
        generated: 0,
        errors: 0,
        total: clipScope.length,
      });
      return;
    }

    handle.setProgress(0, `Generating 0/${missing.length} clips`);

    let generated = 0;
    let errors = 0;

    for (let i = 0; i < missing.length; i++) {
      if (handle.isCancelled()) break;

      const clip = missing[i];

      try {
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1",
            voice: config.voice,
            input: clip.text,
            response_format: "mp3",
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          errors++;
          handle.emit({
            type: "clip_error",
            clipId: clip.id,
            error: `HTTP ${response.status}: ${errText}`,
          });
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        writeFileSync(join(voiceDir, clip.filename), Buffer.from(arrayBuffer));
        generated++;
        handle.emit({ type: "clip_done", clipId: clip.id });
      } catch (err) {
        errors++;
        handle.emit({
          type: "clip_error",
          clipId: clip.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const progress = Math.round(((i + 1) / missing.length) * 100);
      handle.setProgress(
        progress,
        `Generating ${i + 1}/${missing.length} clips`,
      );
    }

    handle.emit({
      type: "audio_complete",
      generated,
      errors,
      total: clipScope.length,
    });

    handle.complete({
      voice: config.voice,
      generated,
      errors,
      total: clipScope.length,
    });
  });
}
