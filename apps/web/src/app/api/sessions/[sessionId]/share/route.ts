import { type NextRequest, NextResponse } from "next/server";
import { canPerformAction, isParentOf } from "@/lib/classroom";
import { getSessionPlan } from "@/lib/curriculum";
import {
  createSessionShare,
  getActiveSharesForSession,
  revokeSessionShare,
  type ShareDuration,
} from "@/lib/session-share";
import { getShareUrl } from "@/lib/share/urls";
import { getDbUserId } from "@/lib/viewer";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/sessions/[sessionId]/share
 * Create a new share link for a session
 *
 * Body: { expiresIn: '1h' | '24h' }
 * Returns: { token, url, expiresAt }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;

  try {
    // Get current user
    const userId = await getDbUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the session to find the player ID
    const session = await getSessionPlan(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check authorization - only parents can create share links (not teachers)
    const isParent = await isParentOf(userId, session.playerId);
    if (!isParent) {
      return NextResponse.json(
        { error: "Only parents can create share links" },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const expiresIn = body.expiresIn as ShareDuration;
    if (expiresIn !== "1h" && expiresIn !== "24h") {
      return NextResponse.json(
        { error: "Invalid expiresIn value" },
        { status: 400 },
      );
    }

    // Create the share
    const share = await createSessionShare(
      sessionId,
      session.playerId,
      userId,
      expiresIn,
    );

    // Build the full URL using the share URL helper (handles env vars correctly)
    const url = getShareUrl("observe", share.id);

    return NextResponse.json({
      token: share.id,
      url,
      expiresAt: share.expiresAt.getTime(),
    });
  } catch (error) {
    console.error("Error creating session share:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/sessions/[sessionId]/share
 * List all active shares for a session
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;

  try {
    // Get current user
    const userId = await getDbUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the session to find the player ID
    const session = await getSessionPlan(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check authorization
    const canObserve = await canPerformAction(
      userId,
      session.playerId,
      "observe",
    );
    if (!canObserve) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get active shares
    const shares = await getActiveSharesForSession(sessionId);

    return NextResponse.json({
      shares: shares.map((s) => ({
        token: s.id,
        expiresAt:
          s.expiresAt instanceof Date ? s.expiresAt.getTime() : s.expiresAt,
        viewCount: s.viewCount,
        createdAt:
          s.createdAt instanceof Date ? s.createdAt.getTime() : s.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error listing session shares:", error);
    return NextResponse.json(
      { error: "Failed to list shares" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/sessions/[sessionId]/share?token=xxx
 * Revoke a specific share link
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    // Get current user
    const userId = await getDbUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the session to find the player ID
    const session = await getSessionPlan(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check authorization - only parents can revoke share links
    const isParent = await isParentOf(userId, session.playerId);
    if (!isParent) {
      return NextResponse.json(
        { error: "Only parents can revoke share links" },
        { status: 403 },
      );
    }

    // Revoke the share
    await revokeSessionShare(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking session share:", error);
    return NextResponse.json(
      { error: "Failed to revoke share" },
      { status: 500 },
    );
  }
}
