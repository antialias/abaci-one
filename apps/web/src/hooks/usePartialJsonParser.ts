'use client'

/**
 * Partial JSON Parser for Streaming LLM Output
 *
 * Parses incomplete JSON streams to extract completed problem objects
 * as they stream in. Used to provide progressive visual feedback during
 * worksheet parsing.
 *
 * @example
 * ```typescript
 * const completedProblems = extractCompletedProblems(partialJson)
 * // Returns: [{ problemNumber: 1, problemBoundingBox: {...} }, ...]
 * ```
 */

import type { BoundingBox } from '@/lib/worksheet-parsing'

/** Minimal problem data needed for progressive highlighting */
export interface CompletedProblem {
  problemNumber: number
  problemBoundingBox: BoundingBox
}

/**
 * Extract completed problem objects from a partial JSON stream
 *
 * The LLM streams JSON character-by-character. This function parses
 * the partial output to find complete `{...}` objects within the
 * `"problems": [...]` array.
 *
 * It uses brace depth tracking to find complete objects, then attempts
 * to parse each one for the required fields.
 *
 * @param partialJson - The accumulated partial JSON string from streaming
 * @returns Array of completed problems that have been fully streamed
 */
export function extractCompletedProblems(partialJson: string): CompletedProblem[] {
  const problems: CompletedProblem[] = []

  // Find the start of the problems array
  const problemsArrayStart = findProblemsArrayStart(partialJson)
  if (problemsArrayStart === -1) {
    return problems
  }

  // Extract just the content inside the problems array
  const arrayContent = partialJson.slice(problemsArrayStart)

  // Find complete objects within the array
  const completeObjects = findCompleteObjects(arrayContent)

  // Try to parse each complete object
  for (const objStr of completeObjects) {
    const problem = tryParseProblem(objStr)
    if (problem) {
      problems.push(problem)
    }
  }

  return problems
}

/**
 * Find the start index of the problems array content (after the opening '[')
 */
function findProblemsArrayStart(json: string): number {
  // Look for "problems": [ or "problems":[
  const patterns = [/"problems"\s*:\s*\[/, /"problems":\[/]

  for (const pattern of patterns) {
    const match = json.match(pattern)
    if (match && match.index !== undefined) {
      // Return position right after the opening bracket
      return match.index + match[0].length
    }
  }

  return -1
}

/**
 * Find complete JSON objects within array content using brace depth tracking
 */
function findCompleteObjects(arrayContent: string): string[] {
  const objects: string[] = []
  let depth = 0
  let objectStart = -1
  let inString = false
  let escapeNext = false

  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i]

    // Handle escape sequences in strings
    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\' && inString) {
      escapeNext = true
      continue
    }

    // Track string boundaries
    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }

    // Only process braces outside of strings
    if (!inString) {
      if (char === '{') {
        if (depth === 0) {
          objectStart = i
        }
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0 && objectStart !== -1) {
          // Found a complete object
          const objStr = arrayContent.slice(objectStart, i + 1)
          objects.push(objStr)
          objectStart = -1
        }
      }
    }
  }

  return objects
}

/**
 * Try to parse a JSON object string as a problem with the required fields
 */
function tryParseProblem(objStr: string): CompletedProblem | null {
  try {
    const obj = JSON.parse(objStr)

    // Check for required fields
    if (
      typeof obj.problemNumber === 'number' &&
      obj.problemBoundingBox &&
      typeof obj.problemBoundingBox.x === 'number' &&
      typeof obj.problemBoundingBox.y === 'number' &&
      typeof obj.problemBoundingBox.width === 'number' &&
      typeof obj.problemBoundingBox.height === 'number'
    ) {
      return {
        problemNumber: obj.problemNumber,
        problemBoundingBox: {
          x: obj.problemBoundingBox.x,
          y: obj.problemBoundingBox.y,
          width: obj.problemBoundingBox.width,
          height: obj.problemBoundingBox.height,
        },
      }
    }
  } catch {
    // JSON.parse failed - object is not yet complete or malformed
  }

  return null
}

/**
 * Get the count of problems that have been fully streamed
 *
 * Useful for progress indicators: "Parsing... 5/24 problems"
 */
export function getCompletedProblemCount(partialJson: string): number {
  return extractCompletedProblems(partialJson).length
}

/**
 * Estimate total problem count from partial JSON
 *
 * Looks for "totalProblems" or counts expected based on row indicators.
 * Returns null if cannot determine.
 */
export function estimateTotalProblems(partialJson: string): number | null {
  // Look for pageMetadata.totalProblems if it exists
  const totalMatch = partialJson.match(/"totalProblems"\s*:\s*(\d+)/)
  if (totalMatch) {
    return parseInt(totalMatch[1], 10)
  }

  // Look for problems array length hint (may be inaccurate during streaming)
  // This is a rough estimate
  return null
}
