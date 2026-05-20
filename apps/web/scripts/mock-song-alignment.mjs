#!/usr/bin/env node
/**
 * Generate a plausible word-alignment sidecar JSON for an existing local song,
 * so the synced-lyrics player has something to highlight on devbox.
 *
 * Usage:
 *   node scripts/mock-song-alignment.mjs <songId>
 *
 * Reads the song's `llmOutput` from the local SQLite DB, tokenizes each
 * section's lines the same way the player does (split on whitespace), and
 * distributes word timings evenly across each section's planned duration with
 * a small instrumental buffer at the start and end. Writes the result to
 * `data/audio/songs/<songId>.json` — the same path the alignment route serves.
 *
 * The shape matches the parallel-arrays branch of `extractFlatWords` in
 * `src/lib/song/alignment.ts` (the first shape the normalizer tries).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const songId = process.argv[2]
if (!songId) {
  console.error('Usage: node scripts/mock-song-alignment.mjs <songId>')
  process.exit(1)
}

const dbPath = join(process.cwd(), 'data', 'sqlite.db')
const db = new Database(dbPath, { readonly: true })

const row = db
  .prepare('SELECT llm_output FROM session_songs WHERE id = ? AND status = ?')
  .get(songId, 'completed')

if (!row) {
  console.error(`No completed song found for id=${songId}`)
  process.exit(1)
}

const plan = JSON.parse(row.llm_output).plan
const sections = plan.sections

// Tokenize each line the same way the player does.
const tokenize = (line) => line.split(/\s+/).filter((w) => w.length > 0)

const allWords = []
const allStarts = []
const allEnds = []
let cursorMs = 0
const INSTRUMENTAL_BUFFER_MS = 400 // small lead-in / out per section

for (const section of sections) {
  const sectionWords = section.lines.flatMap(tokenize)
  if (sectionWords.length === 0) {
    cursorMs += section.duration_ms
    continue
  }

  const lyricStart = cursorMs + INSTRUMENTAL_BUFFER_MS
  const lyricEnd = cursorMs + section.duration_ms - INSTRUMENTAL_BUFFER_MS
  const span = Math.max(lyricEnd - lyricStart, sectionWords.length * 100)
  const perWord = span / sectionWords.length

  for (let i = 0; i < sectionWords.length; i++) {
    const start = lyricStart + i * perWord
    const end = lyricStart + (i + 1) * perWord
    allWords.push(sectionWords[i])
    // Seconds — `toMs()` in the normalizer multiplies values < 1000 by 1000.
    allStarts.push(+(start / 1000).toFixed(3))
    allEnds.push(+(end / 1000).toFixed(3))
  }

  cursorMs += section.duration_ms
}

const out = {
  // Parallel-arrays shape — the first one `extractFlatWords` tries.
  words: allWords,
  word_start_times_seconds: allStarts,
  word_end_times_seconds: allEnds,
  // Tag the file so it's obvious it's mocked if anyone inspects it.
  _mock: 'generated locally for synced-lyrics UI testing',
}

const outPath = join(process.cwd(), 'data', 'audio', 'songs', `${songId}.json`)
writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(
  `Wrote ${allWords.length} words across ${sections.length} sections → ${outPath}`
)
