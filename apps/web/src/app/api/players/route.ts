import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getViewerId } from "@/lib/viewer";

/**
 * GET /api/players
 * List all players for the current viewer (guest or user)
 */
export async function GET() {
  try {
    const viewerId = await getViewerId();

    // Get or create user record
    const user = await getOrCreateUser(viewerId);

    // Get all players for this user
    const players = await db.query.players.findMany({
      where: eq(schema.players.userId, user.id),
      orderBy: (players, { desc }) => [desc(players.createdAt)],
    });

    return NextResponse.json({ players });
  } catch (error) {
    console.error("Failed to fetch players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/players
 * Create a new player for the current viewer
 */
export async function POST(req: NextRequest) {
  try {
    const viewerId = await getViewerId();
    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.emoji || !body.color) {
      return NextResponse.json(
        { error: "Missing required fields: name, emoji, color" },
        { status: 400 },
      );
    }

    // Get or create user record
    const user = await getOrCreateUser(viewerId);

    // Create player
    const [player] = await db
      .insert(schema.players)
      .values({
        userId: user.id,
        name: body.name,
        emoji: body.emoji,
        color: body.color,
        isActive: body.isActive ?? false,
      })
      .returning();

    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    console.error("Failed to create player:", error);
    return NextResponse.json(
      { error: "Failed to create player" },
      { status: 500 },
    );
  }
}

/**
 * Get or create a user record for the given viewer ID (guest or user)
 */
async function getOrCreateUser(viewerId: string) {
  // Try to find existing user by guest ID
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  });

  // If no user exists, create one
  if (!user) {
    const [newUser] = await db
      .insert(schema.users)
      .values({
        guestId: viewerId,
      })
      .returning();

    user = newUser;
  }

  return user;
}
