import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getViewerId } from "@/lib/viewer";

/**
 * GET /api/scanner-settings
 * Fetch scanner settings for the current user
 */
export async function GET() {
  try {
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);

    // Find or create scanner settings
    let settings = await db.query.scannerSettings.findFirst({
      where: eq(schema.scannerSettings.userId, user.id),
    });

    // If no settings exist, create with defaults
    if (!settings) {
      const [newSettings] = await db
        .insert(schema.scannerSettings)
        .values({ userId: user.id })
        .returning();
      settings = newSettings;
    }

    // Transform database format to QuadDetectorConfig format
    const config = {
      preprocessing: settings.preprocessing,
      enableHistogramEqualization: settings.enableHistogramEqualization,
      enableAdaptiveThreshold: settings.enableAdaptiveThreshold,
      enableMorphGradient: settings.enableMorphGradient,
      cannyThresholds: [settings.cannyLow, settings.cannyHigh] as [
        number,
        number,
      ],
      adaptiveBlockSize: settings.adaptiveBlockSize,
      adaptiveC: settings.adaptiveC,
      enableHoughLines: settings.enableHoughLines,
    };

    return NextResponse.json({ settings: config });
  } catch (error) {
    console.error("Failed to fetch scanner settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch scanner settings" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/scanner-settings
 * Update scanner settings for the current user
 */
export async function PATCH(req: NextRequest) {
  try {
    const viewerId = await getViewerId();

    // Handle empty or invalid JSON body gracefully
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or empty request body" },
        { status: 400 },
      );
    }

    // Security: Strip userId from request body - it must come from session only
    const { userId: _, ...updates } = body;

    // Transform QuadDetectorConfig format to database format
    const dbUpdates: Record<string, unknown> = {};

    if (updates.preprocessing !== undefined) {
      dbUpdates.preprocessing = updates.preprocessing;
    }
    if (updates.enableHistogramEqualization !== undefined) {
      dbUpdates.enableHistogramEqualization =
        updates.enableHistogramEqualization;
    }
    if (updates.enableAdaptiveThreshold !== undefined) {
      dbUpdates.enableAdaptiveThreshold = updates.enableAdaptiveThreshold;
    }
    if (updates.enableMorphGradient !== undefined) {
      dbUpdates.enableMorphGradient = updates.enableMorphGradient;
    }
    if (updates.cannyThresholds !== undefined) {
      const thresholds = updates.cannyThresholds as [number, number];
      dbUpdates.cannyLow = thresholds[0];
      dbUpdates.cannyHigh = thresholds[1];
    }
    if (updates.adaptiveBlockSize !== undefined) {
      dbUpdates.adaptiveBlockSize = updates.adaptiveBlockSize;
    }
    if (updates.adaptiveC !== undefined) {
      dbUpdates.adaptiveC = updates.adaptiveC;
    }
    if (updates.enableHoughLines !== undefined) {
      dbUpdates.enableHoughLines = updates.enableHoughLines;
    }

    const user = await getOrCreateUser(viewerId);

    // Ensure settings exist
    const existingSettings = await db.query.scannerSettings.findFirst({
      where: eq(schema.scannerSettings.userId, user.id),
    });

    let resultSettings: schema.ScannerSettings;

    if (!existingSettings) {
      // Create new settings with updates
      const [newSettings] = await db
        .insert(schema.scannerSettings)
        .values({ userId: user.id, ...dbUpdates })
        .returning();
      resultSettings = newSettings;
    } else {
      // Update existing settings
      const [updatedSettings] = await db
        .update(schema.scannerSettings)
        .set(dbUpdates)
        .where(eq(schema.scannerSettings.userId, user.id))
        .returning();
      resultSettings = updatedSettings;
    }

    // Transform back to QuadDetectorConfig format
    const config = {
      preprocessing: resultSettings.preprocessing,
      enableHistogramEqualization: resultSettings.enableHistogramEqualization,
      enableAdaptiveThreshold: resultSettings.enableAdaptiveThreshold,
      enableMorphGradient: resultSettings.enableMorphGradient,
      cannyThresholds: [resultSettings.cannyLow, resultSettings.cannyHigh] as [
        number,
        number,
      ],
      adaptiveBlockSize: resultSettings.adaptiveBlockSize,
      adaptiveC: resultSettings.adaptiveC,
      enableHoughLines: resultSettings.enableHoughLines,
    };

    return NextResponse.json({ settings: config });
  } catch (error) {
    console.error("Failed to update scanner settings:", error);
    return NextResponse.json(
      { error: "Failed to update scanner settings" },
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
