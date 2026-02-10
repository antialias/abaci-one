import { createHash } from 'crypto'
import { generateEmbedding, generateEmbeddings } from '@/lib/flowcharts/embedding'
import { cosineSimilarity } from '@/lib/flowcharts/embedding-search'
import { getProfileInfoList } from './profiles'
import type { ProfileInfo } from './types'

/**
 * Cached profile embeddings with content hash for staleness detection.
 */
let profileEmbeddings: Map<string, Float32Array> | null = null
let embeddingPromise: Promise<Map<string, Float32Array>> | null = null
let cachedContentHash: string | null = null
let cachedAt: Date | null = null

/**
 * Build the text content to embed for a profile.
 * Uses structured labels so the embedding model understands the role
 * of each field (similar to the flowchart embedding system).
 */
function buildProfileContent(profile: ProfileInfo): string {
  const parts: string[] = [
    `Profile: ${profile.name}`,
    `Description: ${profile.description}`,
    `Category: ${formatCategory(profile.category)}`,
  ]

  if (profile.expectedSessionMode) {
    parts.push(`Expected Session Mode: ${profile.expectedSessionMode}`)
  }

  if (profile.tags.length > 0) {
    parts.push(`Tags: ${profile.tags.join(', ')}`)
  }

  parts.push(`Practicing Skills: ${profile.practicingSkillCount}`)
  parts.push(`Testing Notes: ${profile.intentionNotes}`)

  return parts.join('\n')
}

function formatCategory(category: ProfileInfo['category']): string {
  switch (category) {
    case 'bkt':
      return 'Skill Mastery Levels'
    case 'session':
      return 'Session Mode Triggers'
    case 'edge':
      return 'Edge Cases & Data Robustness'
  }
}

/**
 * Compute a SHA-256 hash of all profile content to detect changes.
 */
function computeContentHash(): string {
  const profiles = getProfileInfoList()
  const allContent = profiles.map(buildProfileContent).join('\n---\n')
  return createHash('sha256').update(allContent).digest('hex').slice(0, 16)
}

/**
 * Lazily compute and cache embeddings for all seed profiles.
 * Uses a single batched API call for efficiency.
 * The promise is shared so concurrent calls don't duplicate work.
 */
async function getProfileEmbeddings(): Promise<Map<string, Float32Array>> {
  if (profileEmbeddings) return profileEmbeddings

  if (!embeddingPromise) {
    embeddingPromise = (async () => {
      const profiles = getProfileInfoList()
      const contents = profiles.map(buildProfileContent)
      const embeddings = await generateEmbeddings(contents)

      const cache = new Map<string, Float32Array>()
      for (let i = 0; i < profiles.length; i++) {
        cache.set(profiles[i].name, embeddings[i])
      }

      profileEmbeddings = cache
      cachedContentHash = computeContentHash()
      cachedAt = new Date()
      return cache
    })()
  }

  return embeddingPromise
}

export interface ProfileSearchResult {
  name: string
  similarity: number
}

export interface EmbeddingStatus {
  cached: boolean
  stale: boolean
  profileCount: number
  cachedHash: string | null
  currentHash: string
  cachedAt: string | null
}

/**
 * Check whether cached embeddings are stale (profile content has changed
 * since embeddings were generated).
 */
export function getEmbeddingStatus(): EmbeddingStatus {
  const currentHash = computeContentHash()
  const profiles = getProfileInfoList()
  return {
    cached: profileEmbeddings !== null,
    stale: cachedContentHash !== null && cachedContentHash !== currentHash,
    profileCount: profiles.length,
    cachedHash: cachedContentHash,
    currentHash,
    cachedAt: cachedAt?.toISOString() ?? null,
  }
}

/**
 * Invalidate cached embeddings and regenerate them.
 * Returns the new status after regeneration.
 */
export async function regenerateEmbeddings(): Promise<EmbeddingStatus> {
  profileEmbeddings = null
  embeddingPromise = null
  cachedContentHash = null
  cachedAt = null
  await getProfileEmbeddings()
  return getEmbeddingStatus()
}

/**
 * Search seed profiles by natural language query using embedding similarity.
 */
export async function searchProfiles(
  query: string,
  options: { limit?: number; minSimilarity?: number } = {}
): Promise<ProfileSearchResult[]> {
  const { limit = 21, minSimilarity = 0.3 } = options

  const [queryEmbedding, cache] = await Promise.all([
    generateEmbedding(query),
    getProfileEmbeddings(),
  ])

  const results: ProfileSearchResult[] = []

  for (const [name, embedding] of cache) {
    const similarity = cosineSimilarity(queryEmbedding, embedding)
    if (similarity >= minSimilarity) {
      results.push({ name, similarity })
    }
  }

  results.sort((a, b) => b.similarity - a.similarity)
  return results.slice(0, limit)
}
