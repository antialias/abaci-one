/**
 * MCP Resources - Static documentation accessible to MCP consumers
 *
 * Resources are read-only data that provide context to language models.
 * This module exposes worksheet pedagogy documentation.
 */

import fs from 'fs'
import path from 'path'

export interface McpResource {
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface McpResourceContent {
  uri: string
  mimeType: string
  text: string
}

/**
 * Registry of available resources
 * URIs use the format: docs://worksheet/{topic}
 */
const RESOURCE_REGISTRY: McpResource[] = [
  {
    uri: 'docs://worksheet/regrouping',
    name: 'Regrouping (Carrying/Borrowing)',
    description:
      'What regrouping means pedagogically, and how pAnyStart/pAllStart control problem difficulty',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://worksheet/scaffolding',
    name: 'Scaffolding Options',
    description:
      'Visual aids on worksheets: carryBoxes, answerBoxes, placeValueColors, tenFrames, and display rule values',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://worksheet/difficulty-profiles',
    name: 'Difficulty Profiles',
    description:
      'The six preset profiles (beginner → expert), when to use each, and progression philosophy',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://worksheet/digit-range',
    name: 'Digit Range',
    description: 'How digitRange.min and digitRange.max affect problem complexity',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://worksheet/operators',
    name: 'Operators (Addition/Subtraction/Mixed)',
    description:
      'Difference between operators, pedagogical sequence, and scaffolding differences',
    mimeType: 'text/markdown',
  },
]

/**
 * Map URIs to file paths
 * Files are stored in docs/mcp/worksheet/
 */
function getFilePath(uri: string): string | null {
  const prefix = 'docs://worksheet/'
  if (!uri.startsWith(prefix)) {
    return null
  }

  const topic = uri.slice(prefix.length)

  // Validate topic to prevent directory traversal
  if (!/^[a-z-]+$/.test(topic)) {
    return null
  }

  // Construct path relative to the project root
  // In Next.js, process.cwd() is the project root (apps/web)
  return path.join(process.cwd(), 'docs', 'mcp', 'worksheet', `${topic}.md`)
}

/**
 * List all available resources
 */
export function listResources(): { resources: McpResource[] } {
  return { resources: RESOURCE_REGISTRY }
}

/**
 * Read a specific resource by URI
 */
export function readResource(uri: string): { contents: McpResourceContent[] } | { error: string } {
  // Find resource in registry
  const resource = RESOURCE_REGISTRY.find((r) => r.uri === uri)
  if (!resource) {
    return { error: `Resource not found: ${uri}` }
  }

  // Get file path
  const filePath = getFilePath(uri)
  if (!filePath) {
    return { error: `Invalid resource URI: ${uri}` }
  }

  // Read file content
  try {
    const text = fs.readFileSync(filePath, 'utf-8')
    return {
      contents: [
        {
          uri,
          mimeType: resource.mimeType,
          text,
        },
      ],
    }
  } catch (err) {
    console.error(`Failed to read resource ${uri}:`, err)
    return { error: `Failed to read resource: ${uri}` }
  }
}
