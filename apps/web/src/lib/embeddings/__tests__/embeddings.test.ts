/**
 * @vitest-environment node
 *
 * Runs the real model (no mocks). The weights are fetched once, pinned and
 * checksummed, by scripts/fetch-embedding-model.mjs if they are not already in
 * apps/web/models/.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_ID,
  embedText,
  embedTexts,
  isCurrentDimension,
} from '..'
import { cosineSimilarity } from '../similarity'

const appRoot = join(__dirname, '../../../..')

beforeAll(() => {
  if (!existsSync(join(appRoot, 'models', EMBEDDING_MODEL_ID, 'onnx', 'model_quantized.onnx'))) {
    execFileSync('node', [join(appRoot, 'scripts/fetch-embedding-model.mjs')], {
      stdio: 'inherit',
    })
  }
}, 180_000)

describe('embedding model loading', () => {
  // Runs first, while nothing is loaded yet: a missing model must fail with
  // instructions, never fall through to a network download.
  it('fails with the fetch instructions when the model files are missing', async () => {
    const previous = process.env.EMBEDDING_MODEL_DIR
    process.env.EMBEDDING_MODEL_DIR = mkdtempSync(join(tmpdir(), 'no-embedding-model-'))
    try {
      await expect(embedText('hello')).rejects.toThrow(/embeddings:fetch-model/)
    } finally {
      if (previous === undefined) delete process.env.EMBEDDING_MODEL_DIR
      else process.env.EMBEDDING_MODEL_DIR = previous
    }
  })
})

describe('embedTexts (real local model)', () => {
  it('returns one normalised 384-d vector per input', async () => {
    const [v] = await embedTexts(['Add fractions with unlike denominators'])
    expect(v).toBeInstanceOf(Float32Array)
    expect(v.length).toBe(EMBEDDING_DIMENSIONS)
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1, 4)
  }, 60_000)

  it('scores similar sentences above unrelated ones', async () => {
    const [query, similar, nearMiss, unrelated] = await embedTexts([
      'How do I add fractions with different denominators?',
      'Title: Fraction Addition & Subtraction\nDescription: Add and subtract fractions with unlike denominators',
      'Title: Multiplication Tables\nDescription: Memorise the times tables up to 12',
      'Title: The French Revolution\nDescription: Causes and key events of 1789',
    ])
    const sSimilar = cosineSimilarity(query, similar)
    const sNearMiss = cosineSimilarity(query, nearMiss)
    const sUnrelated = cosineSimilarity(query, unrelated)
    expect(sSimilar).toBeGreaterThan(sNearMiss)
    expect(sNearMiss).toBeGreaterThan(sUnrelated)
    // The app's thresholds (suggest 0.3, related 0.4) assume this scale.
    expect(sSimilar).toBeGreaterThan(0.5)
    expect(sUnrelated).toBeLessThan(0.3)
  }, 60_000)

  it('keeps input order across batches and matches single-text results', async () => {
    const topics = ['fractions', 'photosynthesis', 'verb tenses', 'long division', 'volcanoes']
    const texts = Array.from(
      { length: EMBEDDING_BATCH_SIZE * 2 + 3 },
      (_, i) => `Lesson ${i} is about ${topics[i % topics.length]}`
    )
    const batched = await embedTexts(texts)
    expect(batched).toHaveLength(texts.length)
    for (const i of [0, EMBEDDING_BATCH_SIZE + 1, texts.length - 1]) {
      const single = await embedText(texts[i])
      // Padding inside a batch shifts int8 results very slightly (~0.998).
      expect(cosineSimilarity(batched[i], single)).toBeGreaterThan(0.99)
      // ...and the vector at i is not its neighbour's.
      expect(cosineSimilarity(batched[i + (i === 0 ? 1 : -1)], single)).toBeLessThan(0.95)
    }
  }, 60_000)

  it('serves concurrent callers from one model', async () => {
    const results = await Promise.all([
      embedTexts(['abacus', 'soroban']),
      embedText('long division'),
      embedTexts(['photosynthesis']),
    ])
    expect(results[0]).toHaveLength(2)
    expect(results[1].length).toBe(EMBEDDING_DIMENSIONS)
    expect(results[2]).toHaveLength(1)
  }, 60_000)

  it('returns [] for no input', async () => {
    expect(await embedTexts([])).toEqual([])
  })
})

describe('isCurrentDimension', () => {
  it('accepts only blobs of the current model length', () => {
    expect(isCurrentDimension(Buffer.alloc(EMBEDDING_DIMENSIONS * 4))).toBe(true)
    expect(isCurrentDimension(Buffer.alloc(1536 * 4))).toBe(false) // text-embedding-3-small
    expect(isCurrentDimension(Buffer.alloc(3072 * 4))).toBe(false) // text-embedding-3-large
  })
})
