import { type NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { FLOWCHART_SEEDS } from '@/lib/flowcharts/definitions'
import { getDbUserId } from '@/lib/viewer'

/**
 * Seed Status for a flowchart seed
 */
interface SeedStatus {
  id: string
  title: string
  emoji: string
  difficulty: string
  description: string
  /** Whether this seed exists in the database */
  isSeeded: boolean
  /** The database entry ID if seeded (may differ from seed ID) */
  databaseId?: string
  /** When the seed was added to the database */
  seededAt?: string
  /** Who seeded this flowchart */
  seededByUserId?: string
}

/**
 * GET /api/flowcharts/seeds
 *
 * List all available flowchart seeds and their database status.
 * Only available when visual debug is enabled.
 */
export async function GET() {
  try {
    // Get seed IDs
    const seedIds = Object.keys(FLOWCHART_SEEDS)

    // Check which seeds are already in the database
    // Seeds are stored with their original ID as the primary key
    const existingSeeds = await db.query.teacherFlowcharts.findMany({
      where: inArray(schema.teacherFlowcharts.id, seedIds),
      columns: {
        id: true,
        userId: true,
        publishedAt: true,
      },
    })

    const seededMap = new Map(existingSeeds.map((s) => [s.id, s]))

    // Build status for each seed
    const seeds: SeedStatus[] = Object.entries(FLOWCHART_SEEDS).map(([id, seed]) => {
      const dbEntry = seededMap.get(id)
      return {
        id,
        title: seed.meta.title,
        emoji: seed.meta.emoji,
        difficulty: seed.meta.difficulty,
        description: seed.meta.description,
        isSeeded: !!dbEntry,
        databaseId: dbEntry?.id,
        seededAt: dbEntry?.publishedAt?.toISOString(),
        seededByUserId: dbEntry?.userId,
      }
    })

    return NextResponse.json({ seeds })
  } catch (error) {
    console.error('Failed to get seed status:', error)
    return NextResponse.json({ error: 'Failed to get seed status' }, { status: 500 })
  }
}

/**
 * POST /api/flowcharts/seeds
 *
 * Seed one or all flowcharts into the database.
 * The seeded flowcharts are owned by the current user.
 *
 * Body:
 * - action: 'seed' | 'seed-all' | 'reset'
 * - id?: string (required for 'seed' and 'reset')
 */
export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const userId = await getDbUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { action, id } = body as { action: string; id?: string }

    if (action === 'seed') {
      if (!id) {
        return NextResponse.json({ error: 'Missing seed ID' }, { status: 400 })
      }

      const seed = FLOWCHART_SEEDS[id]
      if (!seed) {
        return NextResponse.json({ error: 'Unknown seed ID' }, { status: 404 })
      }

      // Check if already seeded
      const existing = await db.query.teacherFlowcharts.findFirst({
        where: eq(schema.teacherFlowcharts.id, id),
      })

      if (existing) {
        return NextResponse.json({ error: 'Seed already exists in database' }, { status: 409 })
      }

      // Insert the seed
      const now = new Date()
      await db.insert(schema.teacherFlowcharts).values({
        id, // Use the seed ID as the database ID
        userId,
        title: seed.meta.title,
        description: seed.meta.description,
        emoji: seed.meta.emoji,
        difficulty: seed.meta.difficulty,
        definitionJson: JSON.stringify(seed.definition),
        mermaidContent: seed.mermaid,
        status: 'published',
        publishedAt: now,
        searchKeywords: `${seed.meta.title} ${seed.meta.description}`.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'seed-all') {
      const seedIds = Object.keys(FLOWCHART_SEEDS)

      // Check which seeds are already in the database
      const existingSeeds = await db.query.teacherFlowcharts.findMany({
        where: inArray(schema.teacherFlowcharts.id, seedIds),
        columns: { id: true },
      })
      const existingIds = new Set(existingSeeds.map((s) => s.id))

      // Filter to only unseeded
      const toSeed = seedIds.filter((seedId) => !existingIds.has(seedId))

      if (toSeed.length === 0) {
        return NextResponse.json({ success: true, seeded: [], message: 'All seeds already exist' })
      }

      // Insert all missing seeds
      const now = new Date()
      const values = toSeed.map((seedId) => {
        const seed = FLOWCHART_SEEDS[seedId]
        return {
          id: seedId,
          userId,
          title: seed.meta.title,
          description: seed.meta.description,
          emoji: seed.meta.emoji,
          difficulty: seed.meta.difficulty,
          definitionJson: JSON.stringify(seed.definition),
          mermaidContent: seed.mermaid,
          status: 'published' as const,
          publishedAt: now,
          searchKeywords: `${seed.meta.title} ${seed.meta.description}`.toLowerCase(),
          createdAt: now,
          updatedAt: now,
        }
      })

      await db.insert(schema.teacherFlowcharts).values(values)

      return NextResponse.json({ success: true, seeded: toSeed })
    }

    if (action === 'reset') {
      if (!id) {
        return NextResponse.json({ error: 'Missing seed ID' }, { status: 400 })
      }

      const seed = FLOWCHART_SEEDS[id]
      if (!seed) {
        return NextResponse.json({ error: 'Unknown seed ID' }, { status: 404 })
      }

      // Delete existing and re-insert
      await db.delete(schema.teacherFlowcharts).where(eq(schema.teacherFlowcharts.id, id))

      const now = new Date()
      await db.insert(schema.teacherFlowcharts).values({
        id,
        userId,
        title: seed.meta.title,
        description: seed.meta.description,
        emoji: seed.meta.emoji,
        difficulty: seed.meta.difficulty,
        definitionJson: JSON.stringify(seed.definition),
        mermaidContent: seed.mermaid,
        status: 'published',
        publishedAt: now,
        searchKeywords: `${seed.meta.title} ${seed.meta.description}`.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      })

      return NextResponse.json({ success: true, id, action: 'reset' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Failed to seed flowchart:', error)
    return NextResponse.json({ error: 'Failed to seed flowchart' }, { status: 500 })
  }
}
