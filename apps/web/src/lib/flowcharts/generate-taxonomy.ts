import { eq } from 'drizzle-orm'
import { LLMClient } from '@soroban/llm-client'
import { z } from 'zod'
import { db, schema } from '@/db'
import { EMBEDDING_MODEL, embeddingToBuffer } from './embedding'
import { clearTaxonomyCache } from './taxonomy'

/**
 * Common stop words to exclude from word frequency analysis
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
  'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
  'then', 'once', 'if', 'unless', 'until', 'while', 'although', 'because', 'since',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'any', 'up', 'down', 'out', 'off', 'over',
  'students', 'learn', 'using', 'use', 'step', 'steps', 'practice', 'understand',
  'like', 'different', 'various', 'based', 'given', 'find', 'solve', 'work',
])

/**
 * Extract word frequencies from flowchart content
 */
function extractWordFrequencies(texts: string[]): Map<string, number> {
  const frequencies = new Map<string, number>()

  for (const text of texts) {
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
function formatWordFrequencies(frequencies: Map<string, number>, limit: number = 60): string {
  const sorted = [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (sorted.length === 0) {
    return '(No existing flowcharts found)'
  }

  return sorted.map(([word, count]) => `${word} (${count})`).join(', ')
}

/**
 * Load flowchart content from the database for word frequency analysis
 */
async function loadFlowchartContent(): Promise<string[]> {
  const flowcharts = await db.query.teacherFlowcharts.findMany({
    where: eq(schema.teacherFlowcharts.status, 'published'),
    columns: {
      title: true,
      description: true,
    },
  })

  const texts: string[] = []
  for (const fc of flowcharts) {
    if (fc.title) texts.push(fc.title)
    if (fc.description) texts.push(fc.description)
  }

  return texts
}

/**
 * Generate topic labels using an LLM
 */
async function generateLabels(wordFreqHint: string): Promise<string[]> {
  const llm = new LLMClient()

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

Return approximately 200 labels total across all tiers.`,
    schema: z.object({
      labels: z.array(z.string()).min(150).max(250),
    }),
    model: 'gpt-4o-mini',
  })

  return response.data.labels
}

/**
 * Deduplicate labels (case-insensitive)
 */
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
 * Embed labels using OpenAI
 */
async function embedLabels(labels: string[]): Promise<Float32Array[]> {
  const llm = new LLMClient()

  const response = await llm.embed({
    input: labels,
    model: EMBEDDING_MODEL,
  })

  return response.embeddings
}

export interface TaxonomyGenerationResult {
  labelCount: number
  labels: string[]
}

/**
 * Regenerate the topic taxonomy and store in the database.
 *
 * 1. Loads word frequencies from existing flowcharts for context
 * 2. Generates ~200 topic labels via LLM (broad, domain, and specific tiers)
 * 3. Embeds all labels via OpenAI
 * 4. Replaces the entire topic_taxonomy table with new labels
 * 5. Clears the in-memory taxonomy cache
 */
export async function regenerateTaxonomy(): Promise<TaxonomyGenerationResult> {
  // Load flowchart content for word frequency hints
  const flowchartTexts = await loadFlowchartContent()
  const wordFrequencies = extractWordFrequencies(flowchartTexts)
  const wordFreqHint = formatWordFrequencies(wordFrequencies, 60)

  // Generate labels via LLM
  const rawLabels = await generateLabels(wordFreqHint)
  const labels = deduplicateLabels(rawLabels)

  // Embed all labels
  const embeddings = await embedLabels(labels)

  // Replace the entire taxonomy table
  await db.delete(schema.topicTaxonomy)

  const now = new Date()
  const rows = labels.map((label, i) => ({
    label,
    embedding: embeddingToBuffer(embeddings[i]),
    embeddingModel: EMBEDDING_MODEL,
    createdAt: now,
  }))

  // Insert in batches to avoid SQLite variable limit
  const BATCH_SIZE = 50
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await db.insert(schema.topicTaxonomy).values(batch)
  }

  // Clear the in-memory cache so the new taxonomy is used
  clearTaxonomyCache()

  return {
    labelCount: labels.length,
    labels,
  }
}
