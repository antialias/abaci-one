/**
 * API route for streaming vision recording video
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/recording/video
 *
 * Streams the MP4 video file with Range header support for seeking.
 */

export const dynamic = "force-dynamic";

import { createReadStream, statSync, existsSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionPlans, visionRecordings } from "@/db/schema";
import { getPlayerAccess, generateAuthorizationError } from "@/lib/classroom";
import { getDbUserId } from "@/lib/viewer";

interface RouteParams {
  params: Promise<{ playerId: string; sessionId: string }>;
}

/**
 * GET - Stream recording video with Range support
 */
export async function GET(request: Request, { params }: RouteParams) {
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

    // Get recording
    const recording = await db.query.visionRecordings.findFirst({
      where: eq(visionRecordings.sessionId, sessionId),
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 },
      );
    }

    if (recording.status !== "ready") {
      return NextResponse.json(
        { error: `Recording not ready (status: ${recording.status})` },
        { status: 400 },
      );
    }

    // Build video file path
    const videoPath = path.join(
      process.cwd(),
      "data",
      "uploads",
      "vision-recordings",
      playerId,
      recording.id,
      recording.filename,
    );

    // Check if video file exists
    if (!existsSync(videoPath)) {
      console.error(`[recording/video] Video file not found: ${videoPath}`);
      return NextResponse.json(
        { error: "Video file not found" },
        { status: 404 },
      );
    }

    // Get file stats
    const stat = statSync(videoPath);
    const fileSize = stat.size;

    // Parse Range header for seeking
    const range = request.headers.get("range");

    if (range) {
      // Handle Range request (partial content)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const stream = createReadStream(videoPath, { start, end });

      // Convert Node.js stream to Web stream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => {
            controller.enqueue(chunk);
          });
          stream.on("end", () => {
            controller.close();
          });
          stream.on("error", (err) => {
            controller.error(err);
          });
        },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": "video/mp4",
        },
      });
    }

    // Full file request (no Range header)
    const stream = createReadStream(videoPath);

    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileSize),
        "Content-Type": "video/mp4",
      },
    });
  } catch (error) {
    console.error("Error streaming recording video:", error);
    return NextResponse.json(
      { error: "Failed to stream video" },
      { status: 500 },
    );
  }
}
