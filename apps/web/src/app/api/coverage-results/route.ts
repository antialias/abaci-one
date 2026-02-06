/**
 * Coverage results endpoint
 *
 * POST /api/coverage-results
 *
 * Receives unit test coverage summary from CI and stores it in the database.
 * Protected by Bearer token (COVERAGE_API_TOKEN env var).
 *
 * Request body:
 * {
 *   commitSha?: string,
 *   lines: number,      // percentage 0-100
 *   branches: number,   // percentage 0-100
 *   functions: number,  // percentage 0-100
 *   statements: number, // percentage 0-100
 * }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { coverageResults } from '@/db/schema'
import { updateCoverageMetrics } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

interface CoverageRequest {
  commitSha?: string
  lines: number
  branches: number
  functions: number
  statements: number
}

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.COVERAGE_API_TOKEN
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as CoverageRequest

    // Validate required fields
    if (
      typeof body.lines !== 'number' ||
      typeof body.branches !== 'number' ||
      typeof body.functions !== 'number' ||
      typeof body.statements !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: lines, branches, functions, statements (numbers)' },
        { status: 400 }
      )
    }

    const now = new Date()

    await db.insert(coverageResults).values({
      timestamp: now,
      commitSha: body.commitSha ?? null,
      linesPct: body.lines,
      branchesPct: body.branches,
      functionsPct: body.functions,
      statementsPct: body.statements,
    })

    // Update Prometheus gauges
    updateCoverageMetrics({
      linesPct: body.lines,
      branchesPct: body.branches,
      functionsPct: body.functions,
      statementsPct: body.statements,
      timestamp: now,
    })

    // Clean up old results (keep last 100)
    const allResults = await db
      .select({ id: coverageResults.id })
      .from(coverageResults)
      .orderBy(desc(coverageResults.timestamp))

    if (allResults.length > 100) {
      const idsToKeep = new Set(allResults.slice(0, 100).map((r) => r.id))
      const { inArray } = await import('drizzle-orm')
      const idsToDelete = allResults.filter((r) => !idsToKeep.has(r.id)).map((r) => r.id)
      if (idsToDelete.length > 0) {
        await db.delete(coverageResults).where(inArray(coverageResults.id, idsToDelete))
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Coverage results recorded',
    })
  } catch (error) {
    console.error('Error storing coverage results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
