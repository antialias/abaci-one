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
  updates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  embedCalls: [] as string[][],
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
      return texts.map((t) => vec(t.length))
    }),
    embedText: vi.fn(async (text: string) => {
      fixtures.embedCalls.push([text])
      return vec(text.length)
    }),
  }
})

vi.mock('@/db', async () => {
  const schema = await import('@/db/schema')
  const update = (table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        fixtures.updates.push({ table, values })
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
        teacherFlowcharts: { findMany: vi.fn(async () => fixtures.flowcharts) },
        workshopSessions: {
          // The real query filters by flowchartId; the fixture keys on it too.
          findFirst: vi.fn(async () => fixtures.sessions.shift() ?? undefined),
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
    fixtures.sessions = [{ flowchartId: 'a', topicDescription: 'how to add fractions' }]
    fixtures.taxonomy = [
      { id: 1, label: 'Mathematics', embeddingModel: 'text-embedding-3-large' },
      { id: 2, label: 'Fractions', embeddingModel: 'text-embedding-3-large' },
    ]

    await startFlowchartEmbedding({})

    const flowchartUpdates = fixtures.updates.filter((u) => u.table === schema.teacherFlowcharts)
    expect(flowchartUpdates).toHaveLength(3)
    for (const u of flowchartUpdates) {
      expect(u.values.embeddingVersion).toBe(EMBEDDING_VERSION)
      expect((u.values.embedding as Buffer).byteLength).toBe(EMBEDDING_DIMENSIONS * 4)
    }
    // The workshop prompt is kept: embedded into the content and on its own
    expect(fixtures.embedCalls[0]).toHaveLength(2)
    expect(fixtures.embedCalls[0][0]).toContain('Original Topic: how to add fractions')
    expect(fixtures.embedCalls[0][1]).toBe('how to add fractions')
    expect(flowchartUpdates[0].values.promptEmbedding).toBeInstanceOf(Buffer)

    const taxonomyUpdates = fixtures.updates.filter((u) => u.table === schema.topicTaxonomy)
    expect(taxonomyUpdates).toHaveLength(2)
    expect(taxonomyUpdates.every((u) => u.values.embeddingModel === EMBEDDING_MODEL)).toBe(true)

    expect(lastHandle!.complete).toHaveBeenCalledWith(
      expect.objectContaining({ embeddedCount: 3, skippedCount: 1, taxonomyReembedded: 2 })
    )
  })

  it('leaves a current taxonomy alone', async () => {
    const { reembedTaxonomy } = await import('../generate-taxonomy')
    fixtures.taxonomy = [{ id: 1, label: 'Mathematics', embeddingModel: EMBEDDING_MODEL }]
    expect(await reembedTaxonomy()).toEqual({ reembeddedCount: 0, labelCount: 1 })
    expect(fixtures.updates).toHaveLength(0)
  })
})
