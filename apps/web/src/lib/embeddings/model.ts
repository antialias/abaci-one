/**
 * Text-embedding model identity: plain constants, safe to import from client
 * components. The runtime that computes vectors is `@/lib/embeddings` (server only).
 *
 * all-MiniLM-L6-v2 (int8-quantised ONNX, 23 MB): a 6-layer sentence model trained
 * for symmetric semantic similarity, which is what every caller here does
 * (flowchart↔flowchart, short query↔flowchart prompt, taxonomy label↔flowchart,
 * query↔seed profile). Its cosine scale (unrelated ≈ 0, related 0.4–0.8) is close
 * to the old OpenAI model's, so the similarity thresholds stay meaningful.
 * bge-small-en-v1.5 scored better on retrieval benchmarks but is 12 layers (~2×
 * slower), and compresses every score into 0.45–0.9, which would need every
 * threshold retuned.
 *
 * Keep MODEL_ID in step with scripts/fetch-embedding-model.mjs.
 */

/** Hugging Face repo id; also the directory under the models root. */
export const EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

/** ONNX weight variant (q8 → onnx/model_quantized.onnx). */
export const EMBEDDING_DTYPE = 'q8'

/**
 * Identifier stored next to persisted vectors (topic_taxonomy.embedding_model,
 * topic-taxonomy.json `model`). Vectors stamped with anything else are ignored.
 */
export const EMBEDDING_MODEL = `${EMBEDDING_MODEL_ID}@${EMBEDDING_DTYPE}`

/** Vector length produced by the model. */
export const EMBEDDING_DIMENSIONS = 384

/**
 * Version stamp stored with flowchart vectors (teacher_flowcharts.embedding_version).
 * Bump whenever the model or the flowchart content format changes; rows with any
 * other version are left out of similarity search until re-embedded.
 *
 * 3.0.0: local all-MiniLM-L6-v2 (384-d), replacing OpenAI text-embedding-3-large.
 */
export const EMBEDDING_VERSION = '3.0.0'

/**
 * True when a stored vector blob has the current model's length. A guard against
 * comparing vectors from different models (old OpenAI rows were 1536/3072-d).
 */
export function isCurrentDimension(buffer: { byteLength: number }): boolean {
  return buffer.byteLength === EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT
}
