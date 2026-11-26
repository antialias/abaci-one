/**
 * @vitest-environment node
 *
 * The switch to the local embedding model leaves old OpenAI vectors in the DB
 * until the post-deploy re-embed runs. These tests pin down that (a) old vectors
 * are never compared with new ones in the meantime, and (b) the re-embed task
 * recomputes every stored vector, flowcharts and taxonomy alike.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_VERSION } from '@/lib/embeddings/model'

// ---------------------------------------------------------------------------
// Mocks: DB rows in memory, a fake embedder, and a task runner that runs inline
// ---------------------------------------------------------------------------

const fixtures = vi.hoisted(() => ({
  flowcharts: [] as Array<Record<string, unknown>>,
  sessions: [] as Array<{ flowchartId: string; topicDescription: string | null }>,
  taxonomy: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ table: unknown; id?: unknown; values: Record<string, unknown> }>,
  embedCalls: [] as string[][],
  /** Runs inside each embed call, e.g. to simulate a concurrent save. */
  onEmbed: null as null | (() => void),
}))

// Inspectable stand-ins for drizzle's eq/and, so the in-memory DB below can
// apply the same filters the real queries do.
type Cond = { op: 'eq'; col: unknown; val: unknown } | { op: 'and'; parts: Cond[] }
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: (col: unknown, val: unknown): Cond => ({ op: 'eq', col, val }),
  and: (...parts: Cond[]): Cond => ({ op: 'and', parts }),
}))

vi.mock('@/lib/embeddings', async () => {
  const model = await import('@/lib/embeddings/model')
  const vec = (seed: number) => {
    const v = new Float32Array(model.EMBEDDING_DIMENSIONS)
    v[seed % model.EMBEDDING_DIMENSIONS] = 1
    return v
  }
  return {
    ...model,
    embedTexts: vi.fn(async (texts: string[]) => {
      fixtures.embedCalls.push(texts)
      fixtures.onEmbed?.()
      return texts.map((t) => vec(t.length))
    }),
    embedText: vi.fn(async (text: string) => {
      fixtures.embedCalls.push([text])
      fixtures.onEmbed?.()
      return vec(text.length)
    }),
  }
})

vi.mock('@/db', async () => {
  const schema = await import('@/db/schema')
  // Column object → the row property it maps to, for the tables used here.
  const keyOf = (col: unknown): string => {
    for (const table of [schema.teacherFlowcharts, schema.workshopSessions, schema.topicTaxonomy]) {
      for (const [key, value] of Object.entries(table)) if (value === col) return key
    }
    throw new Error('unknown column in test condition')
  }
  const matches = (row: Record<string, unknown>, cond?: Cond): boolean => {
    if (!cond) return true
    if (cond.op === 'and') return cond.parts.every((c) => matches(row, c))
    const have = row[keyOf(cond.col)]
    return have instanceof Date && cond.val instanceof Date
      ? have.getTime() === cond.val.getTime()
      : have === cond.val
  }
  const rowsOf = (table: unknown) =>
    (table === schema.teacherFlowcharts
      ? fixtures.flowcharts
      : table === schema.topicTaxonomy
        ? fixtures.taxonomy
        : []) as Array<Record<string, unknown>>
  const update = (table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: async (cond: Cond) => {
        const hit = rowsOf(table).filter((r) => matches(r, cond))
        for (const r of hit) fixtures.updates.push({ table, id: r.id, values })
        return { rowsAffected: hit.length }
      },
    }),
  })
  const select = () => ({
    from: (table: unknown) =>
      Promise.resolve(table === schema.topicTaxonomy ? fixtures.taxonomy : []),
  })
  return {
    schema,
    db: {
      select,
      update,
      query: {
        teacherFlowcharts: {
          findMany: vi.fn(async () => fixtures.flowcharts),
          findFirst: vi.fn(async ({ where }: { where: Cond }) => {
            // A copy, as a real query returns: later writes to the row don't show
            const row = fixtures.flowcharts.find((r) => matches(r, where))
            return row && { ...row }
          }),
        },
        workshopSessions: {
          findFirst: vi.fn(async ({ where }: { where: Cond }) =>
            fixtures.sessions.find((r) => matches(r, where))
          ),
        },
      },
    },
  }
})

vi.mock('@/lib/task-manager', () => ({
  createTask: vi.fn(
    async (
      _type: string,
      input: unknown,
      handler: (handle: unknown, input: unknown) => Promise<void>
    ) => {
      const handle = {
        id: 'task-1',
        emit: vi.fn(),
        emitTransient: vi.fn(),
        setProgress: vi.fn(),
        complete: vi.fn(),
        fail: vi.fn(),
        isCancelled: () => false,
      }
      await handler(handle, input)
      lastHandle = handle
      return 'task-1'
    }
  ),
}))
let lastHandle: { complete: ReturnType<typeof vi.fn> } | null = null

const blob = (dims: number) => Buffer.alloc(dims * Float32Array.BYTES_PER_ELEMENT)

beforeEach(() => {
  fixtures.flowcharts = []
  fixtures.sessions = []
  fixtures.taxonomy = []
  fixtures.updates = []
  fixtures.embedCalls = []
  fixtures.onEmbed = null
  lastHandle = null
})

// ---------------------------------------------------------------------------

describe('similarity search ignores vectors from other models', () => {
  it('drops rows with an old version stamp or the wrong length', async () => {
    const { getAllFlowchartEmbeddings, invalidateEmbeddingCache } = await import(
      '../embedding-search'
    )
    invalidateEmbeddingCache()
    const base = {
      status: 'published',
      title: 't',
      description: 'd',
      emoji: null,
      difficulty: null,
    }
    fixtures.flowcharts = [
      {
        ...base,
        id: 'current',
        embedding: blob(EMBEDDING_DIMENSIONS),
        promptEmbedding: blob(EMBEDDING_DIMENSIONS),
        embeddingVersion: EMBEDDING_VERSION,
      },
      {
        ...base,
        id: 'old-openai',
        embedding: blob(3072),
        promptEmbedding: blob(3072),
        embeddingVersion: '2.0.0',
      },
      {
        ...base,
        id: 'mislabelled',
        embedding: blob(1536),
        promptEmbedding: null,
        embeddingVersion: EMBEDDING_VERSION,
      },
    ]

    const cache = await getAllFlowchartEmbeddings()
    expect([...cache.keys()]).toEqual(['current'])
    expect(cache.get('current')!.embedding.length).toBe(EMBEDDING_DIMENSIONS)
  })
})

describe('taxonomy falls back to the static files until the DB is re-embedded', () => {
  it('uses DB rows only when every row is the current model', async () => {
    const { loadTaxonomy, clearTaxonomyCache } = await import('../taxonomy')
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Half re-embedded: must not mix spaces → committed files (current model)
    fixtures.taxonomy = [
      { label: 'Fresh', embedding: blob(EMBEDDING_DIMENSIONS), embeddingModel: EMBEDDING_MODEL },
      { label: 'Stale', embedding: blob(3072), embeddingModel: 'text-embedding-3-large' },
    ]
    clearTaxonomyCache()
    const fromFiles = await loadTaxonomy()
    expect(fromFiles.labels).toContain('Mathematics')
    expect(fromFiles.labels).not.toContain('Fresh')
    expect(fromFiles.embeddings.every((e) => e.length === EMBEDDING_DIMENSIONS)).toBe(true)

    // Fully re-embedded → DB
    fixtures.taxonomy = [
      {
        label: 'Fresh',
        embedding: blob(EMBEDDING_DIMENSIONS),
        embeddingModel: EMBEDDING_MODEL,
        breadth: 7,
      },
    ]
    clearTaxonomyCache()
    const fromDb = await loadTaxonomy()
    expect(fromDb.labels).toEqual(['Fresh'])
    expect(fromDb.breadths).toEqual([7])
  })
  it('picks up DB changes made by another replica once the TTL passes', async () => {
    const { loadTaxonomy, clearTaxonomyCache, TAXONOMY_CACHE_TTL_MS } = await import('../taxonomy')
    vi.useFakeTimers()
    try {
      const row = (label: string) => ({
        label,
        embedding: blob(EMBEDDING_DIMENSIONS),
        embeddingModel: EMBEDDING_MODEL,
      })
      fixtures.taxonomy = [row('Before')]
      clearTaxonomyCache()
      expect((await loadTaxonomy()).labels).toEqual(['Before'])

      // Another replica rewrites the table; this one never hears clearTaxonomyCache().
      fixtures.taxonomy = [row('After')]
      vi.advanceTimersByTime(TAXONOMY_CACHE_TTL_MS - 1)
      expect((await loadTaxonomy()).labels).toEqual(['Before'])
      vi.advanceTimersByTime(2)
      expect((await loadTaxonomy()).labels).toEqual(['After'])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('re-embed task (post-deploy step)', () => {
  it('recomputes every stale flowchart vector, any status, then the taxonomy', async () => {
    const { startFlowchartEmbedding } = await import('@/lib/tasks/flowchart-embed')
    const { schema } = await import('@/db')

    fixtures.flowcharts = [
      // stale published row with a workshop prompt → content + prompt vectors
      {
        id: 'a',
        title: 'Fractions',
        description: 'Add',
        difficulty: 'Beginner',
        status: 'published',
        embeddingVersion: '2.0.0',
      },
      // stale draft: not searchable, but its old vector must not survive
      {
        id: 'b',
        title: 'Draft',
        description: null,
        difficulty: null,
        status: 'draft',
        embeddingVersion: '2.0.0',
      },
      // published, never embedded
      {
        id: 'c',
        title: 'New',
        description: null,
        difficulty: null,
        status: 'published',
        embeddingVersion: null,
      },
      // already current: skipped
      {
        id: 'd',
        title: 'Done',
        description: null,
        difficulty: null,
        status: 'published',
        embeddingVersion: EMBEDDING_VERSION,
      },
      // draft without a vector: nothing to do
      {
        id: 'e',
        title: 'Empty',
        description: null,
        difficulty: null,
        status: 'draft',
        embeddingVersion: null,
      },
    ]
    // Listed out of task order, and with a session for a row that is skipped, so
    // a lookup that ignored flowchartId would hand topics to the wrong rows.
    fixtures.sessions = [
      { flowchartId: 'd', topicDescription: 'already done' },
      { flowchartId: 'c', topicDescription: 'something new' },
      { flowchartId: 'a', topicDescription: 'how to add fractions' },
    ]
    fixtures.taxonomy = [
      { id: 1, label: 'Mathematics', embeddingModel: 'text-embedding-3-large' },
      { id: 2, label: 'Fractions', embeddingModel: 'text-embedding-3-large' },
    ]

    await startFlowchartEmbedding({})

    const flowchartUpdates = fixtures.updates.filter((u) => u.table === schema.teacherFlowcharts)
    expect(flowchartUpdates.map((u) => u.id)).toEqual(['a', 'b', 'c'])
    for (const u of flowchartUpdates) {
      expect(u.values.embeddingVersion).toBe(EMBEDDING_VERSION)
      expect((u.values.embedding as Buffer).byteLength).toBe(EMBEDDING_DIMENSIONS * 4)
    }
    // Each row's own workshop prompt is kept: embedded into the content and on its own
    expect(fixtures.embedCalls.slice(0, 3)).toEqual([
      [expect.stringContaining('Original Topic: how to add fractions'), 'how to add fractions'],
      [expect.not.stringContaining('Original Topic')],
      [expect.stringContaining('Original Topic: something new'), 'something new'],
    ])
    expect(fixtures.embedCalls[0][0]).toContain('Title: Fractions')
    expect(fixtures.embedCalls[2][0]).toContain('Title: New')
    const byId = Object.fromEntries(flowchartUpdates.map((u) => [u.id, u.values]))
    expect(byId.a.promptEmbedding).toBeInstanceOf(Buffer)
    expect(byId.b.promptEmbedding).toBeNull()

    const taxonomyUpdates = fixtures.updates.filter((u) => u.table === schema.topicTaxonomy)
    expect(taxonomyUpdates).toHaveLength(2)
    expect(taxonomyUpdates.every((u) => u.values.embeddingModel === EMBEDDING_MODEL)).toBe(true)

    expect(lastHandle!.complete).toHaveBeenCalledWith(
      expect.objectContaining({ embeddedCount: 3, skippedCount: 1, taxonomyReembedded: 2 })
    )
  })

  it('embeds the row as it is now, not the copy the task listed', async () => {
    const { reembedFlowchart } = await import('@/lib/tasks/flowchart-embed')
    const t0 = new Date('2026-11-25T10:00:00Z')
    fixtures.flowcharts = [
      {
        id: 'a',
        title: 'Renamed title',
        description: 'New words',
        difficulty: null,
        updatedAt: t0,
      },
    ]
    expect(await reembedFlowchart('a')).toBe(true)
    expect(fixtures.embedCalls[0][0]).toContain('Title: Renamed title')
    expect(fixtures.embedCalls[0][0]).toContain('Description: New words')
    expect(fixtures.updates).toHaveLength(1)
  })

  it('does not overwrite a save that lands while it embeds', async () => {
    const { reembedFlowchart } = await import('@/lib/tasks/flowchart-embed')
    const row: Record<string, unknown> = {
      id: 'a',
      title: 'Old',
      description: null,
      difficulty: null,
      updatedAt: new Date('2026-11-25T10:00:00Z'),
    }
    fixtures.flowcharts = [row]
    // A workshop save bumps updatedAt (and writes its own vector) mid-embed.
    fixtures.onEmbed = () => {
      row.title = 'Saved meanwhile'
      row.updatedAt = new Date('2026-11-25T10:00:05Z')
    }
    expect(await reembedFlowchart('a')).toBe(false)
    expect(fixtures.updates).toHaveLength(0)
  })

  it('returns false for a row that no longer exists', async () => {
    const { reembedFlowchart } = await import('@/lib/tasks/flowchart-embed')
    expect(await reembedFlowchart('gone')).toBe(false)
    expect(fixtures.embedCalls).toHaveLength(0)
  })

  it('leaves a current taxonomy alone', async () => {
    const { reembedTaxonomy } = await import('../generate-taxonomy')
    fixtures.taxonomy = [{ id: 1, label: 'Mathematics', embeddingModel: EMBEDDING_MODEL }]
    expect(await reembedTaxonomy()).toEqual({ reembeddedCount: 0, labelCount: 1 })
    expect(fixtures.updates).toHaveLength(0)
  })
})

describe('seed profile search', () => {
  it('retries after a failed embedding instead of caching the rejection', async () => {
    const { searchProfiles } = await import('@/lib/seed/embedding-search')
    const { embedTexts } = await import('@/lib/embeddings')
    vi.mocked(embedTexts).mockRejectedValueOnce(new Error('model not fetched'))
    await expect(searchProfiles('new student')).rejects.toThrow('model not fetched')
    await expect(searchProfiles('new student', { minSimilarity: -1 })).resolves.not.toHaveLength(0)
  })
})
