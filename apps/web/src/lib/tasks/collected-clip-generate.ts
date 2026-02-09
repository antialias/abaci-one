import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { db } from "@/db";
import { ttsCollectedClips } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { createTask } from "../task-manager";
import type { CollectedClipGenerateEvent } from "./events";

const AUDIO_DIR = join(process.cwd(), "data", "audio");

export interface CollectedClipGenerateInput {
  voice: string;
  clipIds: string[];
}

export interface CollectedClipGenerateOutput {
  voice: string;
  generated: number;
  errors: number;
  total: number;
}

/**
 * Start a background task to generate OpenAI TTS mp3s for collected clips.
 *
 * Unlike static manifest generation, collected clips store their tone as
 * freeform text which is passed directly to the OpenAI `instructions` param.
 * Files are saved as `cc-{clipId}.mp3` to avoid collisions with static clips.
 */
export async function startCollectedClipGeneration(
  input: CollectedClipGenerateInput,
): Promise<string> {
  return createTask<
    CollectedClipGenerateInput,
    CollectedClipGenerateOutput,
    CollectedClipGenerateEvent
  >("collected-clip-generate", input, async (handle, config) => {
    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      handle.fail("LLM_OPENAI_API_KEY is not configured");
      return;
    }

    const voiceDir = join(AUDIO_DIR, config.voice);
    mkdirSync(voiceDir, { recursive: true });

    // Fetch clip data from DB
    const clips = await db
      .select()
      .from(ttsCollectedClips)
      .where(inArray(ttsCollectedClips.id, config.clipIds));

    if (clips.length === 0) {
      handle.emit({
        type: "cc_gen_complete",
        generated: 0,
        errors: 0,
        total: 0,
      });
      handle.complete({
        voice: config.voice,
        generated: 0,
        errors: 0,
        total: 0,
      });
      return;
    }

    // Filter to clips that don't already have files on disk
    const missing = clips.filter(
      (clip) => !existsSync(join(voiceDir, `cc-${clip.id}.mp3`)),
    );

    handle.emit({
      type: "cc_gen_started",
      voice: config.voice,
      totalClips: clips.length,
      missingClips: missing.length,
    });

    if (missing.length === 0) {
      handle.emit({
        type: "cc_gen_complete",
        generated: 0,
        errors: 0,
        total: clips.length,
      });
      handle.complete({
        voice: config.voice,
        generated: 0,
        errors: 0,
        total: clips.length,
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
            model: "gpt-4o-mini-tts",
            voice: config.voice,
            input: clip.text,
            instructions: clip.tone,
            response_format: "mp3",
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          errors++;
          handle.emit({
            type: "cc_clip_error",
            clipId: clip.id,
            error: `HTTP ${response.status}: ${errText}`,
          });
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        writeFileSync(
          join(voiceDir, `cc-${clip.id}.mp3`),
          Buffer.from(arrayBuffer),
        );
        generated++;
        handle.emit({ type: "cc_clip_done", clipId: clip.id });
      } catch (err) {
        errors++;
        handle.emit({
          type: "cc_clip_error",
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
      type: "cc_gen_complete",
      generated,
      errors,
      total: clips.length,
    });

    handle.complete({
      voice: config.voice,
      generated,
      errors,
      total: clips.length,
    });
  });
}
