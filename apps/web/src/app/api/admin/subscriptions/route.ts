import { eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { withAuth } from "@/lib/auth/withAuth";

/**
 * GET /api/admin/subscriptions?email=<partial>
 *
 * Search users by email (LIKE match), return with subscription info.
 * Admin-only via route-policy.csv (`p, admin, /api/admin/*, *`).
 */
export const GET = withAuth(async (request) => {
  const url = new URL(request.url);
  const emailQuery = url.searchParams.get("email")?.trim();

  if (!emailQuery) {
    return NextResponse.json(
      { error: "email query parameter is required" },
      { status: 400 },
    );
  }

  const results = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      subscriptionPlan: schema.subscriptions.plan,
      subscriptionStatus: schema.subscriptions.status,
    })
    .from(schema.users)
    .leftJoin(
      schema.subscriptions,
      eq(schema.users.id, schema.subscriptions.userId),
    )
    .where(like(schema.users.email, `%${emailQuery}%`))
    .limit(20);

  const users = results.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    subscription: row.subscriptionPlan
      ? { plan: row.subscriptionPlan, status: row.subscriptionStatus }
      : null,
  }));

  return NextResponse.json({ users });
});

/**
 * PUT /api/admin/subscriptions
 *
 * Set a user's subscription tier.
 * - { userId, tier: 'free' }   → deletes subscription row
 * - { userId, tier: 'family' } → upserts subscription with plan: 'family', status: 'active'
 */
export const PUT = withAuth(async (request) => {
  const body = await request.json();
  const { userId, tier } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (tier !== "free" && tier !== "family") {
    return NextResponse.json(
      { error: 'tier must be "free" or "family"' },
      { status: 400 },
    );
  }

  if (tier === "free") {
    const deleted = await db
      .delete(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .returning({ id: schema.subscriptions.id });

    return NextResponse.json({
      tier: "free",
      action: deleted.length > 0 ? "deleted" : "already_free",
    });
  }

  // tier === 'family': upsert subscription row
  const now = new Date();
  await db
    .insert(schema.subscriptions)
    .values({
      userId,
      stripeCustomerId: `cus_admin_set_${userId}`,
      stripeSubscriptionId: `sub_admin_set_${userId}`,
      plan: "family",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: {
        plan: "family",
        status: "active",
        stripeCustomerId: `cus_admin_set_${userId}`,
        stripeSubscriptionId: `sub_admin_set_${userId}`,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        updatedAt: now,
      },
    });

  return NextResponse.json({ tier: "family", action: "upserted" });
});
