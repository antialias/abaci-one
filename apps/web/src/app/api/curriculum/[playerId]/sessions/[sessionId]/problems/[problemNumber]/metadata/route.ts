/**
 * API route for fetching per-problem vision recording metadata
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/problems/[problemNumber]/metadata
 *
 * Returns the JSON metadata file containing time-coded vision and practice state data
 * for synchronized playback of recorded problem attempts.
 */

export const dynamic = "force-dynamic";

import { readFile, access } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionPlans, visionProblemVideos } from "@/db/schema";
import { getPlayerAccess, generateAuthorizationError } from "@/lib/classroom";
import { getDbUserId } from "@/lib/viewer";
import type { ProblemMetadata } from "@/lib/vision/recording";

interface RouteParams {
  params: Promise<{
    playerId: string;
    sessionId: string;
    problemNumber: string;
  }>;
}

/**
 * GET - Fetch problem metadata JSON
 *
 * Query params:
 * - epoch: Epoch number (0 = initial pass, 1-2 = retry epochs). Defaults to 0.
 * - attempt: Attempt number within the epoch (1-indexed). Defaults to 1.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const {
      playerId,
      sessionId,
      problemNumber: problemNumberStr,
    } = await params;
    const { searchParams } = new URL(request.url);

    if (!playerId || !sessionId || !problemNumberStr) {
      return NextResponse.json(
        { error: "Player ID, Session ID, and Problem Number required" },
        { status: 400 },
      );
    }

    const problemNumber = parseInt(problemNumberStr, 10);
    if (isNaN(problemNumber) || problemNumber < 1) {
      return NextResponse.json(
        { error: "Invalid problem number" },
        { status: 400 },
      );
    }

    // Parse epoch and attempt from query params
    const epochNumber = parseInt(searchParams.get("epoch") ?? "0", 10);
    const attemptNumber = parseInt(searchParams.get("attempt") ?? "1", 10);

    // Authorization check
    const userId = await getDbUserId();
    const playerAccess = await getPlayerAccess(userId, playerId);
    if (playerAccess.accessLevel === "none") {
      const authError = generateAuthorizationError(playerAccess, "view", {
        actionDescription: "view recordings for this student",
      });
      return NextResponse.json(authError, { status: 403 });
    }

    // Verify session exists and belongs to player
    const session = await db.query.sessionPlans.findFirst({
      where: and(
        eq(sessionPlans.id, sessionId),
        eq(sessionPlans.playerId, playerId),
      ),
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get problem video record with epoch/attempt filtering
    const video = await db.query.visionProblemVideos.findFirst({
      where: and(
        eq(visionProblemVideos.sessionId, sessionId),
        eq(visionProblemVideos.problemNumber, problemNumber),
        eq(visionProblemVideos.epochNumber, epochNumber),
        eq(visionProblemVideos.attemptNumber, attemptNumber),
      ),
    });

    if (!video) {
      return NextResponse.json(
        { error: "Problem video not found" },
        { status: 404 },
      );
    }

    // Build metadata file path from video filename
    // New pattern: problem_NNN_eX_aY.meta.json (derived from video.filename)
    const baseName = video.filename.replace(".mp4", "");
    const metadataFilename = `${baseName}.meta.json`;
    const metadataPath = path.join(
      process.cwd(),
      "data",
      "uploads",
      "vision-recordings",
      playerId,
      sessionId,
      metadataFilename,
    );

    // Check if metadata file exists
    try {
      await access(metadataPath);
    } catch {
      // Metadata file doesn't exist - return empty metadata structure
      // This can happen for older recordings before metadata was implemented
      const emptyMetadata: ProblemMetadata = {
        problem: { terms: [], answer: 0 },
        entries: [],
        durationMs: video.durationMs ?? 0,
        frameCount: 0,
        isCorrect: null,
      };
      return NextResponse.json(emptyMetadata);
    }

    // Read and parse metadata file
    const metadataContent = await readFile(metadataPath, "utf-8");
    const metadata: ProblemMetadata = JSON.parse(metadataContent);

    return NextResponse.json(metadata);
  } catch (error) {
    console.error("Error fetching problem metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 },
    );
  }
}
