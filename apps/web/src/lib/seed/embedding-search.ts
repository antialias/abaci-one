import { generateEmbedding, generateEmbeddings } from '@/lib/flowcharts/embedding'
import { cosineSimilarity } from '@/lib/flowcharts/embedding-search'
import { getProfileInfoList } from './profiles'
import type { ProfileInfo } from './types'

/**
 * Cached profile embeddings — computed once on first search, never invalidated
 * (profiles are static code, they don't change at runtime).
 */
let profileEmbeddings: Map<string, Float32Array> | null = null
let embeddingPromise: Promise<Map<string, Float32Array>> | null = null

/**
 * Build the text content to embed for a profile.
 * Includes name, description, and the full intention notes for maximum
 * semantic coverage.
 */
function buildProfileContent(profile: ProfileInfo): string {
  return [profile.name, profile.description, profile.intentionNotes].join('\n')
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
      return cache
    })()
  }

  return embeddingPromise
}

export interface ProfileSearchResult {
  name: string
  similarity: number
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
