/**
 * Mermaid Flowchart Parser
 *
 * Extracts structure from .mmd files:
 * - Node IDs and content
 * - Edge connections
 * - Subgraph (phase) definitions
 */

import type { ParsedMermaid, ParsedNodeContent, ParsedEdge } from './schema'

// =============================================================================
// Node Content Parsing
// =============================================================================

/**
 * Parse the raw content string from a Mermaid node label.
 *
 * Mermaid node content uses:
 * - <b>...</b> for bold (title)
 * - <br/> for line breaks
 * - <i>...</i> for italic (examples)
 * - ─────── for dividers
 * - Emojis throughout
 */
export function parseNodeContent(raw: string): ParsedNodeContent {
  // Decode HTML entities that might be in the content
  const decoded = raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')

  let title = ''
  const body: string[] = []
  let example: string | undefined
  let warning: string | undefined
  const checklist: string[] = []

  // First, try to extract title from <b>...</b> tags (may span multiple lines via <br/>)
  // This handles cases like <b>Title Line 1<br/>Title Line 2</b>
  const boldMatch = decoded.match(/<b>([\s\S]*?)<\/b>/)
  if (boldMatch) {
    // Replace <br/> with spaces in the title to make it single line
    title = stripHtml(boldMatch[1].replace(/<br\s*\/?>/gi, ' '))
  }

  // Remove the bold section from content before splitting for body processing
  const contentWithoutTitle = boldMatch ? decoded.replace(/<b>[\s\S]*?<\/b>/, '') : decoded

  const lines = contentWithoutTitle.split(/<br\s*\/?>/i)

  let inExample = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Skip divider lines
    if (trimmed.match(/^─+$/)) {
      continue
    }

    // Check for example marker (📝 emoji or italic)
    if (trimmed.includes('📝') || trimmed.includes('<i>')) {
      inExample = true
    }

    // Check for warning marker
    if (trimmed.includes('⚠️')) {
      warning = stripHtml(trimmed)
      continue
    }

    // Check for checklist items
    if (trimmed.includes('☐') || trimmed.includes('☑')) {
      checklist.push(stripHtml(trimmed))
      continue
    }

    // Add to example or body
    if (inExample) {
      if (example) {
        example += '\n' + stripHtml(trimmed)
      } else {
        example = stripHtml(trimmed)
      }
    } else {
      body.push(stripHtml(trimmed))
    }
  }

  return {
    // If no <b>...</b> title was found, use the first line as the title
    title: title || stripHtml(decoded.split(/<br/i)[0]),
    body,
    example,
    warning,
    checklist: checklist.length > 0 ? checklist : undefined,
    raw: decoded,
  }
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

// =============================================================================
// Mermaid File Parsing
// =============================================================================

/**
 * Parse a complete Mermaid flowchart file
 */
export function parseMermaidFile(content: string): ParsedMermaid {
  const nodes: Record<string, string> = {}
  const edges: ParsedEdge[] = []
  const phases: Array<{ id: string; title: string; nodes: string[] }> = []

  // Remove comments and init block
  const cleanContent = content
    .replace(/%%\{[^}]+\}%%/g, '') // Remove %%{...}%% init blocks
    .replace(/%%.*/g, '') // Remove %% comments

  // Parse subgraphs (phases)
  const subgraphPattern = /subgraph\s+(\w+)\s*\["([^"]+)"\]([\s\S]*?)end/g
  let subgraphMatch
  while ((subgraphMatch = subgraphPattern.exec(cleanContent)) !== null) {
    const [, id, title, subgraphContent] = subgraphMatch
    const phaseNodes: string[] = []

    // Extract node IDs from this subgraph
    // Look for node definitions: ID["..."] or ID{"..."} or ID(["..."])
    const nodePattern = /(\w+)\s*(?:\["|{"|(\(\["))/g
    let nodeMatch
    while ((nodeMatch = nodePattern.exec(subgraphContent)) !== null) {
      if (nodeMatch[1] !== 'direction') {
        phaseNodes.push(nodeMatch[1])
      }
    }

    phases.push({
      id,
      title: stripHtml(title),
      nodes: phaseNodes,
    })
  }

  // Parse all nodes
  // Matches: ID["content"], ID{"content"}, ID(["content"]), ID(("content"))
  const nodePatterns = [
    /(\w+)\s*\["([^"]+)"\]/g, // Rectangle: ID["content"]
    /(\w+)\s*\{"([^"]+)"\}/g, // Diamond: ID{"content"}
    /(\w+)\s*\(\["([^"]+)"\]\)/g, // Stadium: ID(["content"])
    /(\w+)\s*\(\("([^"]+)"\)\)/g, // Circle: ID(("content"))
  ]

  for (const pattern of nodePatterns) {
    let match
    // Need to reset lastIndex for each pattern
    pattern.lastIndex = 0
    while ((match = pattern.exec(cleanContent)) !== null) {
      const [, id, nodeContent] = match
      // Skip keywords
      if (id === 'subgraph' || id === 'direction' || id === 'flowchart' || id === 'style') {
        continue
      }
      nodes[id] = nodeContent
    }
  }

  // Parse edges
  // Matches: ID1 --> ID2, ID1 -->|"label"| ID2, ID1 --> ID2 --> ID3
  const edgePattern = /(\w+)\s*-->\s*(?:\|"([^"]+)"\|\s*)?(\w+)/g
  let edgeMatch
  while ((edgeMatch = edgePattern.exec(cleanContent)) !== null) {
    const [, from, label, to] = edgeMatch
    // Skip phase-to-phase connections and style definitions
    if (from.startsWith('PHASE') || from === 'style') continue

    edges.push({
      from,
      to,
      label: label || undefined,
    })
  }

  return { nodes, edges, phases }
}

/**
 * Get all outgoing edges from a node
 */
export function getOutgoingEdges(mermaid: ParsedMermaid, nodeId: string): ParsedEdge[] {
  return mermaid.edges.filter((edge) => edge.from === nodeId)
}

/**
 * Get the next node(s) from a given node
 */
export function getNextNodes(mermaid: ParsedMermaid, nodeId: string): string[] {
  return getOutgoingEdges(mermaid, nodeId).map((edge) => edge.to)
}

/**
 * Find which phase a node belongs to
 */
export function findNodePhase(
  mermaid: ParsedMermaid,
  nodeId: string
): { id: string; title: string } | undefined {
  for (const phase of mermaid.phases) {
    if (phase.nodes.includes(nodeId)) {
      return { id: phase.id, title: phase.title }
    }
  }
  return undefined
}

/**
 * Get the phase index (1-based) for progress tracking
 */
export function getPhaseIndex(mermaid: ParsedMermaid, nodeId: string): number {
  for (let i = 0; i < mermaid.phases.length; i++) {
    if (mermaid.phases[i].nodes.includes(nodeId)) {
      return i + 1
    }
  }
  return 0
}

/**
 * Get total number of phases
 */
export function getTotalPhases(mermaid: ParsedMermaid): number {
  return mermaid.phases.length
}
