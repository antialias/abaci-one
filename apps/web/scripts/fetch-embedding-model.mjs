#!/usr/bin/env node
/**
 * Fetch the text-embedding model into apps/web/models/ (or --dest <dir>).
 *
 * The app computes embeddings in-process (src/lib/embeddings) and never
 * downloads a model at runtime. This script is the one place that does:
 *   - the Dockerfile runs it in its own stage and bakes the files into the image
 *   - on the laptop, run it once: `pnpm --filter @soroban/web embeddings:fetch-model`
 *
 * Files are pinned to a Hugging Face commit and checked against SHA-256, so the
 * image and the laptop always hold the same bytes. Re-running is a no-op when the
 * files are already present and intact.
 *
 * Keep MODEL_ID / DTYPE in step with src/lib/embeddings/model.ts.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
const REVISION = '751bff37182d3f1213fa05d7196b954e230abad9'

/** Exactly the files transformers.js reads for a q8 feature-extraction pipeline. */
const FILES = [
  {
    path: 'config.json',
    sha256: '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7',
  },
  {
    path: 'tokenizer.json',
    sha256: 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0',
  },
  {
    path: 'tokenizer_config.json',
    sha256: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3',
  },
  {
    path: 'onnx/model_quantized.onnx',
    sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  },
]

const here = dirname(fileURLToPath(import.meta.url))
const destFlag = process.argv.indexOf('--dest')
const destRoot =
  destFlag !== -1 ? resolve(process.argv[destFlag + 1]) : resolve(here, '..', 'models')
const modelDir = join(destRoot, MODEL_ID)

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

async function download(url, attempts = 4) {
  let lastError
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      lastError = err
      console.warn(`  attempt ${i}/${attempts} failed: ${err.message}`)
    }
  }
  throw lastError
}

for (const file of FILES) {
  const target = join(modelDir, file.path)
  if (existsSync(target) && sha256(readFileSync(target)) === file.sha256) {
    console.log(`ok       ${MODEL_ID}/${file.path}`)
    continue
  }
  const url = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${file.path}`
  console.log(`fetching ${MODEL_ID}/${file.path}`)
  const buf = await download(url)
  const got = sha256(buf)
  if (got !== file.sha256) {
    throw new Error(`SHA-256 mismatch for ${file.path}: expected ${file.sha256}, got ${got}`)
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(`${target}.tmp`, buf)
  renameSync(`${target}.tmp`, target)
}

console.log(`Embedding model ready in ${modelDir}`)
