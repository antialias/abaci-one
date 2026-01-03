import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getPendingRequestsForParent } from "@/lib/classroom";
import { getViewerId } from "@/lib/viewer";

/**
 * Get or create user record for a viewerId (guestId)
 */
async function getOrCreateUser(viewerId: string) {
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  });

  if (!user) {
    const [newUser] = await db
      .insert(schema.users)
      .values({ guestId: viewerId })
      .returning();
    user = newUser;
  }

  return user;
}

/**
 * GET /api/enrollment-requests/pending
 * Get enrollment requests pending current user's approval as parent
 *
 * These are requests initiated by teachers for the user's children,
 * where parent approval hasn't been given yet.
 *
 * Returns: { requests: EnrollmentRequestWithRelations[] }
 */
export async function GET() {
  try {
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);

    const requests = await getPendingRequestsForParent(user.id);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to fetch pending enrollment requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending enrollment requests" },
      { status: 500 },
    );
  }
}
