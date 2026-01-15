import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { visionTrainingSyncHistory, toSyncHistorySummary } from "@/db/schema";

// Force dynamic rendering - this route reads from database
export const dynamic = "force-dynamic";

type ModelType = "column-classifier" | "boundary-detector";

/**
 * GET /api/vision-training/sync/history
 *
 * Get sync history for a model type.
 *
 * Query params:
 * - modelType: 'column-classifier' | 'boundary-detector' (default: column-classifier)
 * - limit: Number of records to return (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modelTypeParam = searchParams.get("modelType");
    const modelType: ModelType =
      modelTypeParam === "boundary-detector"
        ? "boundary-detector"
        : "column-classifier";
    const limitParam = searchParams.get("limit");
    const limit = Math.min(
      Math.max(parseInt(limitParam || "20", 10) || 20, 1),
      100,
    );

    const records = await db
      .select()
      .from(visionTrainingSyncHistory)
      .where(eq(visionTrainingSyncHistory.modelType, modelType))
      .orderBy(desc(visionTrainingSyncHistory.startedAt))
      .limit(limit);

    // Get summary stats
    const allRecords = await db
      .select()
      .from(visionTrainingSyncHistory)
      .where(eq(visionTrainingSyncHistory.modelType, modelType));

    const totalSyncs = allRecords.length;
    const successfulSyncs = allRecords.filter(
      (r) => r.status === "success",
    ).length;
    const failedSyncs = allRecords.filter((r) => r.status === "failed").length;
    const lastSuccessfulSync = allRecords
      .filter((r) => r.status === "success")
      .sort(
        (a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0),
      )[0];

    return Response.json({
      modelType,
      history: records.map(toSyncHistorySummary),
      stats: {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        lastSuccessfulSync: lastSuccessfulSync
          ? {
              id: lastSuccessfulSync.id,
              startedAt: lastSuccessfulSync.startedAt,
              filesTransferred: lastSuccessfulSync.filesTransferred,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[vision-training/sync/history] Error:", error);
    return Response.json(
      { error: "Failed to fetch sync history" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/vision-training/sync/history
 *
 * Delete a specific sync history record.
 *
 * Query params:
 * - id: Record ID to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing id parameter" }, { status: 400 });
    }

    await db
      .delete(visionTrainingSyncHistory)
      .where(eq(visionTrainingSyncHistory.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("[vision-training/sync/history] DELETE Error:", error);
    return Response.json(
      { error: "Failed to delete sync history record" },
      { status: 500 },
    );
  }
}
