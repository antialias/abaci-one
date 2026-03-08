/**
 * Admin API for AI usage reporting.
 *
 * GET /api/admin/ai-usage?days=7
 * Returns aggregated usage data grouped by feature and model.
 */

import { NextResponse } from 'next/server'
import { sql, gte } from 'drizzle-orm'
import { db } from '@/db'
import { aiUsage } from '@/db/schema/ai-usage'
import { users } from '@/db/schema/users'
import { withAuth } from '@/lib/auth/withAuth'
import { estimateCost } from '@/lib/ai-usage/pricing'

export const GET = withAuth(
  async (request) => {
    const url = new URL(request.url)
    const days = Math.min(parseInt(url.searchParams.get('days') ?? '7', 10), 90)
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Summary by feature + model
    const featureSummary = await db
      .select({
        feature: aiUsage.feature,
        provider: aiUsage.provider,
        model: aiUsage.model,
        apiType: aiUsage.apiType,
        count: sql<number>`count(*)`.as('count'),
        totalInputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`.as(
          'total_input_tokens'
        ),
        totalOutputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`.as(
          'total_output_tokens'
        ),
        totalReasoningTokens: sql<number>`coalesce(sum(${aiUsage.reasoningTokens}), 0)`.as(
          'total_reasoning_tokens'
        ),
        totalImageCount: sql<number>`coalesce(sum(${aiUsage.imageCount}), 0)`.as(
          'total_image_count'
        ),
        totalInputCharacters: sql<number>`coalesce(sum(${aiUsage.inputCharacters}), 0)`.as(
          'total_input_characters'
        ),
        totalAudioDuration: sql<number>`coalesce(sum(${aiUsage.audioDurationSeconds}), 0)`.as(
          'total_audio_duration'
        ),
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, cutoff))
      .groupBy(aiUsage.feature, aiUsage.provider, aiUsage.model, aiUsage.apiType)
      .orderBy(sql`count(*) DESC`)

    // Per-user totals
    const userSummary = await db
      .select({
        userId: aiUsage.userId,
        email: users.email,
        name: users.name,
        count: sql<number>`count(*)`.as('count'),
        totalInputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`.as(
          'total_input_tokens'
        ),
        totalOutputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`.as(
          'total_output_tokens'
        ),
        totalImageCount: sql<number>`coalesce(sum(${aiUsage.imageCount}), 0)`.as(
          'total_image_count'
        ),
        totalInputCharacters: sql<number>`coalesce(sum(${aiUsage.inputCharacters}), 0)`.as(
          'total_input_characters'
        ),
        totalAudioDuration: sql<number>`coalesce(sum(${aiUsage.audioDurationSeconds}), 0)`.as(
          'total_audio_duration'
        ),
      })
      .from(aiUsage)
      .leftJoin(users, sql`${aiUsage.userId} = ${users.id}`)
      .where(gte(aiUsage.createdAt, cutoff))
      .groupBy(aiUsage.userId)
      .orderBy(sql`count(*) DESC`)

    // Estimate costs for feature summary
    const featureWithCost = featureSummary.map((row) => ({
      ...row,
      estimatedCost: estimateCost({
        provider: row.provider,
        model: row.model,
        apiType: row.apiType,
        inputTokens: row.totalInputTokens,
        outputTokens: row.totalOutputTokens,
        reasoningTokens: row.totalReasoningTokens,
        imageCount: row.totalImageCount,
        inputCharacters: row.totalInputCharacters,
        audioDurationSeconds: row.totalAudioDuration,
      }),
    }))

    const totalCost = featureWithCost.reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0)
    const totalCalls = featureSummary.reduce((sum, r) => sum + r.count, 0)

    return NextResponse.json({
      days,
      totalCalls,
      totalEstimatedCost: Math.round(totalCost * 10000) / 10000,
      byFeature: featureWithCost,
      byUser: userSummary,
    })
  },
  { role: 'admin' }
)
