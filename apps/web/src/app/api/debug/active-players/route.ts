import { NextResponse } from "next/server";
import { getViewerId } from "@/lib/viewer";
import { getActivePlayers } from "@/lib/arcade/player-manager";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

// Force dynamic rendering - this route uses headers()
export const dynamic = "force-dynamic";

/**
 * GET /api/debug/active-players
 * Debug endpoint to check active players for current user
 */
export async function GET() {
  try {
    const viewerId = await getViewerId();

    // Get user record
    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found", viewerId },
        { status: 404 },
      );
    }

    // Get ALL players for this user
    const allPlayers = await db.query.players.findMany({
      where: eq(schema.players.userId, user.id),
    });

    // Get active players using the helper
    const activePlayers = await getActivePlayers(viewerId);

    return NextResponse.json({
      viewerId,
      userId: user.id,
      allPlayers: allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        isActive: p.isActive,
      })),
      activePlayers: activePlayers.map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        isActive: p.isActive,
      })),
      activeCount: activePlayers.length,
      totalCount: allPlayers.length,
    });
  } catch (error) {
    console.error("Failed to fetch active players:", error);
    return NextResponse.json(
      { error: "Failed to fetch active players", details: String(error) },
      { status: 500 },
    );
  }
}
