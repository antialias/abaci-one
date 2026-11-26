#!/usr/bin/env npx tsx
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config() // .env as fallback

/**
 * Generate topic taxonomy for cluster labeling.
 *
 * Generates ~200 topic labels at multiple specificity levels:
 * - Broad labels (e.g., "Mathematics", "Science") for diverse clusters
 * - Domain labels (e.g., "Fractions", "Grammar") for medium groupings
 * - Topic labels (e.g., "Fraction Addition", "Verb Tenses") for specific matches
 *
 * Labels are informed by word frequencies from existing flowcharts.
 *
 * Labels come from an LLM; their vectors are computed in-process with the app's
 * embedding model (src/lib/embeddings — run `pnpm embeddings:fetch-model` once).
 *
 * Usage:
 *   npx tsx scripts/generateTopicTaxonomy.ts           # Generate from scratch
 *   npx tsx scripts/generateTopicTaxonomy.ts --expand  # Add new labels to existing taxonomy
 *   npx tsx scripts/generateTopicTaxonomy.ts --reembed # Keep the labels, recompute every
 *                                                      # vector with the current model (no LLM)
 */

import { LLMClient } from '@soroban/llm-client'
import Database from 'better-sqlite3'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { embedTexts } from '../src/lib/embeddings'
import {
  buildLabelEmbeddingContent,
  parseTaxonomyFiles,
  serializeTaxonomyFiles,
  type TaxonomyIndex,
} from '../src/lib/flowcharts/taxonomy-embedding'

const OUTPUT_DIR = join(__dirname, '../src/lib/flowcharts')
const JSON_PATH = join(OUTPUT_DIR, 'topic-taxonomy.json')
const BIN_PATH = join(OUTPUT_DIR, 'topic-taxonomy.bin')
const DB_PATH = join(__dirname, '../data/sqlite.db')

// Common stop words to exclude from frequency analysis
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'need',
  'dare',
  'ought',
  'used',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'when',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'also',
  'now',
  'here',
  'there',
  'then',
  'once',
  'if',
  'unless',
  'until',
  'while',
  'although',
  'because',
  'since',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'again',
  'further',
  'any',
  'up',
  'down',
  'out',
  'off',
  'over',
  'students',
  'learn',
  'using',
  'use',
  'step',
  'steps',
  'practice',
  'understand',
  'like',
  'different',
  'various',
  'based',
  'given',
  'find',
  'solve',
  'work',
])

/**
 * Extract word frequencies from flowchart content
 */
function extractWordFrequencies(texts: string[]): Map<string, number> {
  const frequencies = new Map<string, number>()

  for (const text of texts) {
    // Split on non-word characters, lowercase, filter
    const words = text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1)
    }
  }

  return frequencies
}

/**
 * Format top word frequencies for the prompt
 */
function formatWordFrequencies(frequencies: Map<string, number>, limit: number = 50): string {
  const sorted = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)

  if (sorted.length === 0) {
    return '(No existing flowcharts found)'
  }

  return sorted.map(([word, count]) => `${word} (${count})`).join(', ')
}

/**
 * Load flowchart content from the database
 */
function loadFlowchartContent(): string[] {
  if (!existsSync(DB_PATH)) {
    console.log('Database not found, skipping content analysis')
    return []
  }

  const sqlite = new Database(DB_PATH)

  // Use raw SQL to avoid Drizzle schema resolution issues in scripts
  const flowcharts = sqlite
    .prepare(
      `SELECT title, description
       FROM teacher_flowcharts
       WHERE status = 'published'`
    )
    .all() as Array<{ title: string | null; description: string | null }>

  sqlite.close()

  const texts: string[] = []
  for (const fc of flowcharts) {
    if (fc.title) texts.push(fc.title)
    if (fc.description) texts.push(fc.description)
  }

  console.log(`Loaded ${flowcharts.length} published flowcharts`)
  return texts
}

async function generateLabels(existingLabels: string[], wordFreqHint: string): Promise<string[]> {
  const llm = new LLMClient()

  const avoidClause =
    existingLabels.length > 0
      ? `\n\nIMPORTANT: Do NOT include any of these existing labels (or close synonyms):\n${existingLabels.map((l) => `- ${l}`).join('\n')}`
      : ''

  const response = await llm.call({
    prompt: `Generate a comprehensive list of topic labels for categorizing educational flowcharts. The labels should cover the FULL spectrum of education from kindergarten through graduate/professional level, with multiple levels of specificity.

## Specificity Tiers (generate labels at ALL levels):

**Tier 1 - Broad subjects (~20 labels):**
Very broad categories that can group diverse content. Examples: "Mathematics", "Language Arts", "Science", "Social Studies", "Arts & Music", "Life Skills", "Technology", "Engineering", "Medicine"

**Tier 2 - Domains (~50 labels):**
Subject domains that group related topics. Examples: "Fractions", "Linear Algebra", "Organic Chemistry", "Grammar", "Physics", "Machine Learning", "Music Theory"

**Tier 3 - Specific topics (~130 labels):**
Focused topics for specific content. Examples: "Fraction Addition", "Matrix Operations", "Cramer's Rule", "Verb Tenses", "Newton's Laws", "Neural Networks"

## Content hints from existing flowcharts:
Here are the most common terms from existing flowcharts in the system:
${wordFreqHint}

Use these to ensure coverage of topics that actually exist, including any niche topics.

## Requirements:
- Each label should be 2-5 words (broader labels can be 1-2 words)
- Use Title Case
- Cover the FULL educational spectrum: elementary, middle school, high school, undergraduate, graduate, professional
- Avoid redundancy — each label should cover a distinct topic area
- IMPORTANT: Include broad labels! When content is diverse, a cluster needs a broad label like "Mathematics" rather than being unlabeled.

## Topic coverage (ensure all levels are represented):

**Mathematics:**
- Elementary: counting, place value, basic operations, fractions, decimals, percentages, basic geometry, measurement
- Middle/High School: algebra, linear equations, quadratic equations, polynomials, trigonometry, statistics, probability
- Advanced: linear algebra, matrices, determinants, systems of equations, calculus, differential equations, abstract algebra, number theory, topology, real analysis

**Language Arts:**
- Elementary: phonics, reading comprehension, vocabulary, grammar, parts of speech, sentence structure, punctuation, spelling
- Middle/High School: essay writing, literary analysis, rhetoric, research papers, citations
- Advanced: linguistics, semantics, discourse analysis, technical writing

**Science:**
- Elementary/Middle: scientific method, life science, physical science, earth science, ecosystems
- High School: biology, chemistry, physics, environmental science
- Advanced: molecular biology, organic chemistry, quantum mechanics, thermodynamics, astrophysics, neuroscience

**Engineering & Technology:**
- Fundamentals: basic coding, algorithms, data structures, circuits
- Advanced: machine learning, computer architecture, signal processing, control systems, aerospace, materials science

**Social Studies & Humanities:**
- History, geography, civics, economics, philosophy, psychology, sociology, anthropology

**Professional/Applied:**
- Medicine, law, business, finance, accounting, project management

**Arts & Other:**
- Music theory, art techniques, physical education, health, nutrition, practical life skills

Return approximately 200 labels total across all tiers.${avoidClause}`,
    schema: z.object({
      labels: z.array(z.string()).min(150).max(250),
    }),
  })

  return response.data.labels
}

function deduplicateLabels(labels: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const label of labels) {
    const normalized = label.trim()
    const key = normalized.toLowerCase()
    if (!seen.has(key) && normalized.length > 0) {
      seen.add(key)
      result.push(normalized)
    }
  }

  return result
}

/**
 * Embed labels exactly as the DB taxonomy does (src/lib/flowcharts/generate-taxonomy.ts),
 * so both sources share one space.
 */
async function embedLabels(labels: string[]): Promise<Float32Array[]> {
  console.log(`Embedding ${labels.length} labels...`)
  return embedTexts(labels.map(buildLabelEmbeddingContent))
}

function writeTaxonomy(labels: string[], embeddings: Float32Array[]): void {
  const { index, bin } = serializeTaxonomyFiles(labels, embeddings)
  writeFileSync(JSON_PATH, `${JSON.stringify(index, null, 2)}\n`)
  console.log(`Wrote ${JSON_PATH} (${labels.length} labels, model ${index.model})`)
  writeFileSync(BIN_PATH, bin)
  console.log(`Wrote ${BIN_PATH} (${bin.byteLength} bytes)`)
}

/** Recompute every label's vector with the current model, keeping the labels. */
async function reembed(): Promise<void> {
  const index: TaxonomyIndex = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Re-embedding ${index.labels.length} labels (were ${index.model})`)
  writeTaxonomy(index.labels, await embedLabels(index.labels))
}

async function main() {
  if (process.argv.includes('--reembed')) {
    await reembed()
    return
  }

  const isExpand = process.argv.includes('--expand')

  // Load existing flowchart content for word frequency analysis
  console.log('Analyzing existing flowchart content...')
  const flowchartTexts = loadFlowchartContent()
  const wordFrequencies = extractWordFrequencies(flowchartTexts)
  const wordFreqHint = formatWordFrequencies(wordFrequencies, 60)
  console.log(`Top terms: ${wordFreqHint.slice(0, 200)}...`)

  let existingLabels: string[] = []
  const existingEmbeddings: Float32Array[] = []

  if (isExpand && existsSync(JSON_PATH) && existsSync(BIN_PATH)) {
    console.log('Loading existing taxonomy for expansion...')
    const index: TaxonomyIndex = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
    const existing = parseTaxonomyFiles(index, readFileSync(BIN_PATH))
    existingLabels = existing.labels
    existingEmbeddings.push(...existing.embeddings)

    console.log(`Existing taxonomy: ${existingLabels.length} labels`)
  }

  // Generate new labels
  console.log('Generating topic labels via LLM...')
  const rawLabels = await generateLabels(existingLabels, wordFreqHint)
  console.log(`Generated ${rawLabels.length} raw labels`)

  // Deduplicate (including against existing labels)
  const allRawLabels = [...existingLabels, ...rawLabels]
  const allLabels = deduplicateLabels(allRawLabels)
  const newLabels = allLabels.slice(existingLabels.length)

  console.log(`After dedup: ${newLabels.length} new labels (${allLabels.length} total)`)

  if (newLabels.length === 0) {
    console.log('No new labels to add.')
    return
  }

  // Embed new labels
  const newEmbeddings = await embedLabels(newLabels)

  // Combine with existing
  const finalLabels = [...existingLabels, ...newLabels]
  const finalEmbeddings = [...existingEmbeddings, ...newEmbeddings]

  // Write output
  writeTaxonomy(finalLabels, finalEmbeddings)

  console.log('\nDone! Generated labels:')
  for (const label of finalLabels) {
    console.log(`  - ${label}`)
  }
}

main().catch((err) => {
  console.error('Failed to generate taxonomy:', err)
  process.exit(1)
})
