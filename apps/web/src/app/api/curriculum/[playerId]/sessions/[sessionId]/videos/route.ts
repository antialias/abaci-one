/**
 * API route for listing per-problem vision recording videos for a session
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/videos
 *
 * Returns a list of available problem videos for the session.
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { sessionPlans, visionProblemVideos } from "@/db/schema";
import { getPlayerAccess, generateAuthorizationError } from "@/lib/classroom";
import { getDbUserId } from "@/lib/viewer";

interface RouteParams {
  params: Promise<{ playerId: string; sessionId: string }>;
}

/**
 * GET - List available problem videos for a session
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, sessionId } = await params;

    if (!playerId || !sessionId) {
      return NextResponse.json(
        { error: "Player ID and Session ID required" },
        { status: 400 },
      );
    }

    // Authorization check
    const userId = await getDbUserId();
    const access = await getPlayerAccess(userId, playerId);
    if (access.accessLevel === "none") {
      const authError = generateAuthorizationError(access, "view", {
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

    // Get all problem videos for this session (including failed/processing)
    // We'll dedupe and show the best status for each problem/epoch/attempt combo
    const videos = await db.query.visionProblemVideos.findMany({
      where: eq(visionProblemVideos.sessionId, sessionId),
      orderBy: [
        asc(visionProblemVideos.problemNumber),
        asc(visionProblemVideos.epochNumber),
        asc(visionProblemVideos.attemptNumber),
      ],
    });

    // Deduplicate by problem/epoch/attempt, keeping the "best" status
    // Priority: ready > processing > recording > failed
    const statusPriority: Record<string, number> = {
      ready: 0,
      processing: 1,
      recording: 2,
      failed: 3,
    };

    const videoMap = new Map<string, (typeof videos)[0]>();

    for (const video of videos) {
      const key = `${video.problemNumber}-${video.epochNumber}-${video.attemptNumber}`;
      const existing = videoMap.get(key);

      if (!existing) {
        videoMap.set(key, video);
      } else {
        // Keep the one with better status (lower priority number)
        const existingPriority = statusPriority[existing.status] ?? 999;
        const currentPriority = statusPriority[video.status] ?? 999;
        if (currentPriority < existingPriority) {
          videoMap.set(key, video);
        }
      }
    }

    // Convert map to sorted array
    const dedupedVideos = Array.from(videoMap.values()).sort((a, b) => {
      if (a.problemNumber !== b.problemNumber)
        return a.problemNumber - b.problemNumber;
      if (a.epochNumber !== b.epochNumber) return a.epochNumber - b.epochNumber;
      return a.attemptNumber - b.attemptNumber;
    });

    // Transform to response format with epoch/attempt info
    const videoList = dedupedVideos.map((video) => ({
      problemNumber: video.problemNumber,
      partIndex: video.partIndex,
      epochNumber: video.epochNumber,
      attemptNumber: video.attemptNumber,
      isRetry: video.isRetry,
      isManualRedo: video.isManualRedo,
      status: video.status,
      durationMs: video.durationMs,
      fileSize: video.fileSize,
      isCorrect: video.isCorrect,
      startedAt: video.startedAt,
      endedAt: video.endedAt,
      processingError: video.processingError,
    }));

    return NextResponse.json({ videos: videoList });
  } catch (error) {
    console.error("Error listing session videos:", error);
    return NextResponse.json(
      { error: "Failed to list videos" },
      { status: 500 },
    );
  }
}
