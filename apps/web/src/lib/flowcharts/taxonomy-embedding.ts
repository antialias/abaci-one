import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '@/lib/embeddings/model'
import { cosineSimilarity } from '@/lib/embeddings/similarity'

/**
 * Pure helpers shared by the taxonomy runtime (DB + admin), the static-file
 * fallback and scripts/generateTopicTaxonomy.ts. No DB, no model.
 */

/**
 * The text embedded for a taxonomy label: the bare label.
 *
 * With the OpenAI model, labels were wrapped in a two-sentence "educational topic
 * category" template. all-MiniLM-L6-v2 mean-pools tokens, so the shared template
 * dominated every label vector (label↔label similarity 0.77, label↔flowchart
 * 0.2–0.45). Bare labels separate cleanly (label↔label 0.19) and match the right
 * flowcharts more strongly (e.g. "Solving Linear Equations" → Linear Equations
 * 0.78 vs 0.46), which keeps them inside the browse page's 0.75 distance cut-off.
 */
export function buildLabelEmbeddingContent(label: string): string {
  return label
}

/**
 * Breadth score per label, 0-100 where higher = broader.
 *
 * Broad labels (e.g. "Mathematics") sit closer, on average, to every other label;
 * specific ones ("Fraction Addition") sit in their own corner. Scores are the mean
 * similarity to all other labels, min-max scaled across the taxonomy, so they do
 * not depend on any one model's absolute similarity range.
 */
export function computeLabelBreadths(embeddings: Float32Array[]): number[] {
  const n = embeddings.length
  if (n < 2) return new Array(n).fill(0)

  const meanSims: number[] = []
  for (let i = 0; i < n; i++) {
    let total = 0
    for (let j = 0; j < n; j++) {
      if (i !== j) total += cosineSimilarity(embeddings[i], embeddings[j])
    }
    meanSims.push(total / (n - 1))
  }

  const min = Math.min(...meanSims)
  const max = Math.max(...meanSims)
  const span = max - min
  return meanSims.map((s) => (span === 0 ? 0 : Math.round(((s - min) / span) * 100)))
}

/** topic-taxonomy.json */
export interface TaxonomyIndex {
  version: string
  /** EMBEDDING_MODEL that wrote topic-taxonomy.bin */
  model: string
  dimensions: number
  labels: string[]
  breadths?: number[]
}

export interface ParsedTaxonomy {
  labels: string[]
  embeddings: Float32Array[]
  breadths: number[]
}

/**
 * Parse topic-taxonomy.json + topic-taxonomy.bin (packed Float32 vectors).
 * Throws when the files were written by another model or have the wrong size,
 * so stale vectors are never compared against current ones.
 */
export function parseTaxonomyFiles(index: TaxonomyIndex, bin: Buffer): ParsedTaxonomy {
  if (index.model !== EMBEDDING_MODEL || index.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `topic-taxonomy files are for ${index.model} (${index.dimensions}-d); expected ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}-d). Regenerate with scripts/generateTopicTaxonomy.ts --reembed.`
    )
  }
  const bytesPerLabel = EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT
  if (bin.byteLength !== index.labels.length * bytesPerLabel) {
    throw new Error(
      `topic-taxonomy.bin is ${bin.byteLength} bytes; expected ${index.labels.length} × ${bytesPerLabel}`
    )
  }

  const embeddings: Float32Array[] = []
  for (let i = 0; i < index.labels.length; i++) {
    const slice = bin.subarray(i * bytesPerLabel, (i + 1) * bytesPerLabel)
    // Copy into a fresh ArrayBuffer so the Float32Array is properly aligned
    const ab = new ArrayBuffer(bytesPerLabel)
    new Uint8Array(ab).set(slice)
    embeddings.push(new Float32Array(ab))
  }

  const breadths =
    index.breadths?.length === index.labels.length
      ? index.breadths
      : new Array(index.labels.length).fill(0)

  return { labels: index.labels, embeddings, breadths }
}

/** Inverse of parseTaxonomyFiles. */
export function serializeTaxonomyFiles(
  labels: string[],
  embeddings: Float32Array[]
): { index: TaxonomyIndex; bin: Buffer } {
  const bytesPerLabel = EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT
  const bin = Buffer.alloc(labels.length * bytesPerLabel)
  embeddings.forEach((e, i) => {
    if (e.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Label ${i} has ${e.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`)
    }
    Buffer.from(e.buffer, e.byteOffset, e.byteLength).copy(bin, i * bytesPerLabel)
  })
  return {
    index: {
      version: '3.0.0',
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      labels,
      breadths: computeLabelBreadths(embeddings),
    },
    bin,
  }
}
