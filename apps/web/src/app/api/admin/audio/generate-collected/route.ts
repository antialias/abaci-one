import { type NextRequest, NextResponse } from "next/server";
import { startCollectedClipGeneration } from "@/lib/tasks/collected-clip-generate";

/**
 * POST /api/admin/audio/generate-collected
 *
 * Starts a background task to generate OpenAI TTS mp3s for collected clips.
 *
 * Body: { voice: string, clipIds: string[] }
 * Response: { taskId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voice, clipIds } = body;

    if (typeof voice !== "string" || voice.trim().length === 0) {
      return NextResponse.json(
        { error: "voice must be a non-empty string" },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(clipIds) ||
      clipIds.length === 0 ||
      !clipIds.every((id: unknown) => typeof id === "string")
    ) {
      return NextResponse.json(
        { error: "clipIds must be a non-empty array of strings" },
        { status: 400 },
      );
    }

    const taskId = await startCollectedClipGeneration({
      voice: voice.trim(),
      clipIds,
    });

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error("Error starting collected clip generation:", error);
    return NextResponse.json(
      { error: "Failed to start collected clip generation" },
      { status: 500 },
    );
  }
}
