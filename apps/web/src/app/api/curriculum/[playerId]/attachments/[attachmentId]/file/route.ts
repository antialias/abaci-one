/**
 * API route for serving practice attachment files
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/file
 *
 * Serves the actual image file for a practice attachment.
 * Authorization is checked to ensure only parents and teachers can access.
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
 * GET - Serve attachment file
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

    // Build file path
    const filepath = join(
      process.cwd(),
      "data",
      "uploads",
      "players",
      playerId,
      attachment.filename,
    );

    // Check if file exists
    try {
      await stat(filepath);
    } catch {
      console.error(`Attachment file not found: ${filepath}`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read and serve file
    const fileBuffer = await readFile(filepath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": attachment.fileSize.toString(),
        "Cache-Control": "private, max-age=31536000", // Cache for 1 year (files are immutable)
      },
    });
  } catch (error) {
    console.error("Error serving attachment:", error);
    return NextResponse.json(
      { error: "Failed to serve attachment" },
      { status: 500 },
    );
  }
}
