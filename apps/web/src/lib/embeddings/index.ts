/**
 * Text embeddings computed in-process with a small open model (ONNX Runtime via
 * @huggingface/transformers). No account or network is involved: the model files
 * are baked into the Docker image, and on the laptop fetched once with
 * `pnpm --filter @soroban/web embeddings:fetch-model`.
 *
 * Every caller in the app embeds through this module. The model loads lazily, once
 * per process (shared on globalThis so Next's route bundles and the custom server
 * use one copy), and inference runs one batch at a time to bound memory.
 *
 * Server-only. Client code that needs the model's name or version imports
 * `@/lib/embeddings/model` instead.
 */
import { join } from 'node:path'
import type { FeatureExtractionPipeline } from '@huggingface/transformers'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_ID,
  EMBEDDING_VERSION,
  isCurrentDimension,
} from './model'

export {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_ID,
  EMBEDDING_VERSION,
  isCurrentDimension,
}

/**
 * Texts per inference call. Measured on all-MiniLM-L6-v2 q8: batches of 8 run as
 * fast as 64 but keep ONNX Runtime's working memory ~200 MiB lower.
 */
export const EMBEDDING_BATCH_SIZE = 8

/** Directory holding `<model id>/…`; EMBEDDING_MODEL_DIR overrides `<cwd>/models`. */
export function embeddingModelRoot(): string {
  return process.env.EMBEDDING_MODEL_DIR || join(process.cwd(), 'models')
}

interface EmbedderState {
  extractor: Promise<FeatureExtractionPipeline> | null
  /** Tail of the inference queue: each batch waits for the one before it. */
  queue: Promise<unknown>
}

const STATE_KEY = Symbol.for('soroban.embeddings.state')
const globalStore = globalThis as unknown as Record<symbol, EmbedderState | undefined>
const state: EmbedderState = (globalStore[STATE_KEY] ??= {
  extractor: null,
  queue: Promise.resolve(),
})

async function loadExtractor(): Promise<FeatureExtractionPipeline> {
  const { env, pipeline } = await import('@huggingface/transformers')
  // Local files only: production must never reach Hugging Face at runtime.
  env.allowRemoteModels = false
  env.allowLocalModels = true
  env.localModelPath = embeddingModelRoot()
  try {
    return (await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
      dtype: EMBEDDING_DTYPE,
      local_files_only: true,
    })) as FeatureExtractionPipeline
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Embedding model ${EMBEDDING_MODEL_ID} could not be loaded from ${env.localModelPath}. ` +
        `Run \`pnpm --filter @soroban/web embeddings:fetch-model\` (or set EMBEDDING_MODEL_DIR). ` +
        `Cause: ${reason}`
    )
  }
}

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!state.extractor) {
    state.extractor = loadExtractor().catch((err) => {
      // Let the next call retry instead of caching the failure forever.
      state.extractor = null
      throw err
    })
  }
  return state.extractor
}

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = state.queue.then(task, task)
  state.queue = result.catch(() => undefined)
  return result
}

/**
 * Embed texts. Returns one L2-normalised Float32Array (EMBEDDING_DIMENSIONS long)
 * per input, in input order.
 */
export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return []
  const extractor = await getExtractor()
  const out: Float32Array[] = []
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE)
    const tensor = await runExclusive(() => extractor(batch, { pooling: 'mean', normalize: true }))
    const data = tensor.data as Float32Array
    const [rows, dims] = tensor.dims
    if (rows !== batch.length || dims !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding model returned [${tensor.dims.join(', ')}], expected [${batch.length}, ${EMBEDDING_DIMENSIONS}]`
      )
    }
    for (let r = 0; r < rows; r++) {
      // slice() copies into a fresh, aligned buffer owned by this vector alone.
      out.push(data.slice(r * dims, (r + 1) * dims))
    }
    tensor.dispose()
  }
  return out
}

/** Embed one text. */
export async function embedText(text: string): Promise<Float32Array> {
  const [vector] = await embedTexts([text])
  return vector
}
