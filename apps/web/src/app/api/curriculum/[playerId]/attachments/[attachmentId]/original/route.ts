/**
 * API route for serving original (uncropped) practice attachment files
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/original
 *
 * Serves the original uncropped image file for a practice attachment.
 * If no original exists (legacy attachments or skipped crop), falls back
 * to the regular cropped file.
 *
 * Used when re-editing photos to start from the full original image
 * rather than cropping an already-cropped copy.
 */

import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { practiceAttachments } from "@/db/schema";
import { canPerformAction } from "@/lib/classroom";
import { getDbUserId } from "@/lib/viewer";

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>;
}

/**
 * GET - Serve original attachment file
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params;

    if (!playerId || !attachmentId) {
      return NextResponse.json(
        { error: "Player ID and Attachment ID required" },
        { status: 400 },
      );
    }

    // Authorization check
    const userId = await getDbUserId();
    const canView = await canPerformAction(userId, playerId, "view");
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get();

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    // Verify the attachment belongs to the specified player
    if (attachment.playerId !== playerId) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    // Use original filename if available, otherwise fall back to cropped file
    const filename = attachment.originalFilename || attachment.filename;

    // Build file path
    const filepath = join(
      process.cwd(),
      "data",
      "uploads",
      "players",
      playerId,
      filename,
    );

    // Check if file exists
    let fileStats;
    try {
      fileStats = await stat(filepath);
    } catch {
      // If original file doesn't exist, fall back to cropped file
      if (attachment.originalFilename) {
        const fallbackPath = join(
          process.cwd(),
          "data",
          "uploads",
          "players",
          playerId,
          attachment.filename,
        );
        try {
          fileStats = await stat(fallbackPath);
          // Use fallback path
          const fileBuffer = await readFile(fallbackPath);
          return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type": attachment.mimeType,
              "Content-Length": fileStats.size.toString(),
              "Cache-Control": "private, max-age=31536000",
            },
          });
        } catch {
          console.error(`Attachment file not found: ${fallbackPath}`);
          return NextResponse.json(
            { error: "File not found" },
            { status: 404 },
          );
        }
      }
      console.error(`Attachment file not found: ${filepath}`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read and serve file
    const fileBuffer = await readFile(filepath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": fileStats.size.toString(),
        "Cache-Control": "private, max-age=31536000", // Cache for 1 year (files are immutable)
      },
    });
  } catch (error) {
    console.error("Error serving original attachment:", error);
    return NextResponse.json(
      { error: "Failed to serve attachment" },
      { status: 500 },
    );
  }
}
