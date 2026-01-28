/**
 * Client-side agglomerative clustering for flowchart tiles.
 *
 * Operates on a flat upper-triangle pairwise cosine distance matrix
 * returned by the browse API.
 */

export interface ClusterResult {
  /** Cluster index (0-based) for each input item, in same order as input IDs */
  assignments: number[]
  /** Number of clusters found */
  k: number
  /** Representative item index for each cluster (lowest avg distance to peers) */
  centroids: number[]
}

/**
 * Index into an upper-triangle flat array for an n×n symmetric matrix.
 * Requires i < j.
 */
export function distIndex(i: number, j: number, n: number): number {
  if (i === j) return -1
  const [lo, hi] = i < j ? [i, j] : [j, i]
  // Row `lo` starts at offset: lo*n - lo*(lo+1)/2 - lo
  // Then column offset within that row: hi - lo - 1
  return lo * n - (lo * (lo + 1)) / 2 + hi - lo - 1
}

/**
 * Agglomerative clustering with average linkage.
 *
 * Cuts the dendrogram when either:
 * - The number of clusters reaches maxK, OR
 * - The next merge distance exceeds mergeThreshold
 *
 * @param n             Number of items
 * @param distanceMatrix Upper-triangle flat array of pairwise distances
 * @param maxK          Maximum number of clusters (default 4)
 * @param mergeThreshold Stop merging if the next merge distance exceeds this (default 0.7)
 */
export function agglomerativeClustering(
  n: number,
  distanceMatrix: number[],
  maxK = 4,
  mergeThreshold = 0.7
): ClusterResult {
  if (n <= 0) {
    return { assignments: [], k: 0, centroids: [] }
  }
  if (n === 1) {
    return { assignments: [0], k: 1, centroids: [0] }
  }

  // Each cluster is a set of original item indices
  const clusters: Set<number>[] = Array.from({ length: n }, (_, i) => new Set([i]))
  // Map from cluster ID to its index in `clusters` (initially identity)
  const active = new Set<number>(Array.from({ length: n }, (_, i) => i))

  // Average-linkage distance between two clusters
  function clusterDist(a: Set<number>, b: Set<number>): number {
    let sum = 0
    let count = 0
    for (const i of a) {
      for (const j of b) {
        sum += distanceMatrix[distIndex(i, j, n)]
        count++
      }
    }
    return sum / count
  }

  // Merge until we reach maxK or threshold
  while (active.size > maxK) {
    // Find the pair of active clusters with minimum average-linkage distance
    let minDist = Infinity
    let mergeA = -1
    let mergeB = -1

    const activeArr = Array.from(active)
    for (let ai = 0; ai < activeArr.length; ai++) {
      for (let bi = ai + 1; bi < activeArr.length; bi++) {
        const d = clusterDist(clusters[activeArr[ai]], clusters[activeArr[bi]])
        if (d < minDist) {
          minDist = d
          mergeA = activeArr[ai]
          mergeB = activeArr[bi]
        }
      }
    }

    if (minDist > mergeThreshold) break

    // Merge B into A
    for (const item of clusters[mergeB]) {
      clusters[mergeA].add(item)
    }
    active.delete(mergeB)
  }

  // Continue merging up to maxK even if we haven't hit the threshold check above
  // (the while loop above stops at maxK, so this handles the threshold-only stopping)
  // Now handle the case where active.size > 1 and we stopped due to threshold
  // — we keep whatever clusters remain

  // Assign cluster indices
  const assignments = new Array<number>(n)
  const activeArr = Array.from(active)
  const centroids: number[] = []

  for (let clusterIdx = 0; clusterIdx < activeArr.length; clusterIdx++) {
    const members = Array.from(clusters[activeArr[clusterIdx]])

    // Assign each member to this cluster index
    for (const item of members) {
      assignments[item] = clusterIdx
    }

    // Find centroid: member with lowest average distance to other members
    if (members.length === 1) {
      centroids.push(members[0])
    } else {
      let bestItem = members[0]
      let bestAvg = Infinity
      for (const candidate of members) {
        let sum = 0
        for (const other of members) {
          if (candidate !== other) {
            sum += distanceMatrix[distIndex(candidate, other, n)]
          }
        }
        const avg = sum / (members.length - 1)
        if (avg < bestAvg) {
          bestAvg = avg
          bestItem = candidate
        }
      }
      centroids.push(bestItem)
    }
  }

  return { assignments, k: activeArr.length, centroids }
}

/**
 * Extract a sub-matrix from a full distance matrix for a subset of IDs.
 *
 * @param allIds   Ordered IDs matching the full matrix
 * @param matrix   Full upper-triangle flat distance array
 * @param subsetIds IDs to extract (order preserved)
 * @returns Sub-matrix with only the requested IDs, or null entries skipped
 */
export function subsetDistanceMatrix(
  allIds: string[],
  matrix: number[],
  subsetIds: string[]
): { ids: string[]; matrix: number[] } {
  const n = allIds.length
  // Build index lookup
  const idxMap = new Map<string, number>()
  for (let i = 0; i < allIds.length; i++) {
    idxMap.set(allIds[i], i)
  }

  // Filter to only IDs that exist in allIds
  const validIds = subsetIds.filter((id) => idxMap.has(id))
  const m = validIds.length

  if (m < 2) {
    return { ids: validIds, matrix: [] }
  }

  // Build sub-matrix
  const subMatrix: number[] = []
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      const origI = idxMap.get(validIds[i])!
      const origJ = idxMap.get(validIds[j])!
      subMatrix.push(matrix[distIndex(origI, origJ, n)])
    }
  }

  return { ids: validIds, matrix: subMatrix }
}
