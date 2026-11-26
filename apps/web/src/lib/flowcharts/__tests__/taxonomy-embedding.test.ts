/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '@/lib/embeddings/model'
import {
  computeLabelBreadths,
  parseTaxonomyFiles,
  serializeTaxonomyFiles,
  type TaxonomyIndex,
} from '../taxonomy-embedding'

function unit(...values: number[]): Float32Array {
  const v = new Float32Array(EMBEDDING_DIMENSIONS)
  values.forEach((x, i) => {
    v[i] = x
  })
  const n = Math.hypot(...values)
  return v.map((x) => x / n)
}

describe('taxonomy files', () => {
  it('round-trips labels, vectors and breadths', () => {
    const labels = ['Mathematics', 'Fractions', 'Grammar']
    const vectors = [unit(1, 1, 0), unit(1, 0, 0), unit(0, 0, 1)]
    const { index, bin } = serializeTaxonomyFiles(labels, vectors)

    expect(index.model).toBe(EMBEDDING_MODEL)
    expect(index.dimensions).toBe(EMBEDDING_DIMENSIONS)
    expect(bin.byteLength).toBe(labels.length * EMBEDDING_DIMENSIONS * 4)

    const parsed = parseTaxonomyFiles(index, bin)
    expect(parsed.labels).toEqual(labels)
    expect(Array.from(parsed.embeddings[1])).toEqual(Array.from(vectors[1]))
    expect(parsed.breadths).toEqual(index.breadths)
  })

  it('refuses files written by another model', () => {
    const { index, bin } = serializeTaxonomyFiles(['A'], [unit(1)])
    const old: TaxonomyIndex = { ...index, model: 'text-embedding-3-small', dimensions: 1536 }
    expect(() => parseTaxonomyFiles(old, bin)).toThrow(/--reembed/)
  })

  it('refuses a bin of the wrong size', () => {
    const { index } = serializeTaxonomyFiles(['A', 'B'], [unit(1), unit(0, 1)])
    expect(() => parseTaxonomyFiles(index, Buffer.alloc(1536 * 4 * 2))).toThrow(/bytes/)
  })

  it('the committed files are current-model vectors', () => {
    const dir = join(__dirname, '..')
    const index = JSON.parse(readFileSync(join(dir, 'topic-taxonomy.json'), 'utf-8'))
    const parsed = parseTaxonomyFiles(index, readFileSync(join(dir, 'topic-taxonomy.bin')))
    expect(parsed.labels.length).toBeGreaterThan(100)
    expect(parsed.embeddings.every((e) => e.length === EMBEDDING_DIMENSIONS)).toBe(true)
    const broadest = parsed.labels[parsed.breadths.indexOf(Math.max(...parsed.breadths))]
    expect(['Mathematics', 'Science', 'Technology', 'Economics']).toContain(broadest)
  })
})

describe('computeLabelBreadths', () => {
  it('scales mean similarity to 0-100, broad labels highest', () => {
    // "broad" is equally close to three otherwise unrelated specific labels
    const breadths = computeLabelBreadths([
      unit(1, 1, 1),
      unit(1, 0, 0),
      unit(0, 1, 0),
      unit(0, 0, 1),
    ])
    expect(breadths).toEqual([100, 0, 0, 0])
  })

  it('handles degenerate inputs', () => {
    expect(computeLabelBreadths([])).toEqual([])
    expect(computeLabelBreadths([unit(1)])).toEqual([0])
    expect(computeLabelBreadths([unit(1), unit(1)])).toEqual([0, 0])
  })
})
