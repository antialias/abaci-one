/**
 * Mermaid Flowchart Parser
 *
 * Extracts structure from Mermaid flowchart content (from .mmd files or embedded strings).
 *
 * ## Key Concepts
 *
 * - **Node content** is stored in Mermaid node labels using special formatting
 * - **Phases** are Mermaid subgraphs that group related nodes
 * - **Edges** connect nodes and may have labels
 *
 * ## Content Formatting
 *
 * Mermaid node labels use HTML-like formatting:
 * - `<b>...</b>` - Title (extracted separately)
 * - `<br/>` - Line breaks
 * - `<i>...</i>` - Italic (used for examples)
 * - `───────` - Dividers (ignored)
 * - `📝` - Example marker
 * - `⚠️` - Warning marker
 * - `☐` / `☑` - Checklist items
 *
 * @example
 * ```typescript
 * import { parseMermaidFile, parseNodeContent } from './parser'
 *
 * const mermaid = parseMermaidFile(mermaidContent)
 * const nodeContent = mermaid.nodes['START']
 * const parsed = parseNodeContent(nodeContent)
 * console.log(parsed.title, parsed.body)
 * ```
 *
 * @module flowcharts/parser
 */

import type { ParsedMermaid, ParsedNodeContent, ParsedEdge } from './schema'

// =============================================================================
// Node Content Parsing
// =============================================================================

/**
 * Parse the raw content string from a Mermaid node label into structured content.
 *
 * ## Input Format
 *
 * Mermaid node content uses HTML-like formatting:
 * - `<b>...</b>` - Bold text becomes the **title**
 * - `<br/>` - Line breaks separate content
 * - `<i>...</i>` - Italic text (treated as examples)
 * - `───────` - Divider lines (ignored)
 * - `📝` - Marks example text
 * - `⚠️` - Marks warning text
 * - `☐` / `☑` - Checklist items
 *
 * ## Output Structure
 *
 * ```typescript
 * {
 *   title: "The title text",        // From <b>...</b> or first line
 *   body: ["Line 1", "Line 2"],     // Main content lines
 *   example: "Example text",        // Lines after 📝 or <i>
 *   warning: "Warning text",        // Lines with ⚠️
 *   checklist: ["☐ Item 1"],       // Lines with checkboxes
 *   raw: "original content"         // Original for fallback
 * }
 * ```
 *
 * ## Edge Cases
 *
 * - **Emoji-only nodes** (like milestone `(("👍"))`): Title becomes the emoji, body is empty
 * - **No `<b>` tags**: First line becomes the title
 * - **Multi-line titles**: `<b>Line 1<br/>Line 2</b>` becomes a single-line title
 *
 * @param raw - The raw content string from a Mermaid node label
 * @returns Parsed and structured node content
 *
 * @example
 * ```typescript
 * const content = parseNodeContent('<b>Step 1</b><br/>Do this thing<br/>📝 Example: 3 + 4 = 7')
 * // { title: "Step 1", body: ["Do this thing"], example: "Example: 3 + 4 = 7", ... }
 *
 * const emoji = parseNodeContent('👍')
 * // { title: "👍", body: [], ... }
 * ```
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
  let inChecklist = false

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
      inChecklist = false
    }

    // Check for warning marker
    if (trimmed.includes('⚠️')) {
      warning = stripHtml(trimmed)
      inChecklist = false
      continue
    }

    // Check for checklist items
    if (trimmed.includes('☐') || trimmed.includes('☑')) {
      checklist.push(stripHtml(trimmed))
      inChecklist = true
      continue
    }

    // Check if this is a continuation line (indented line after a checklist item)
    // Original line starts with whitespace and we're in a checklist context
    if (inChecklist && line.match(/^\s/) && checklist.length > 0) {
      // Append to the last checklist item
      checklist[checklist.length - 1] += ' ' + stripHtml(trimmed)
      continue
    }

    // If we hit a non-indented line, we're no longer in checklist continuation mode
    inChecklist = false

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

/**
 * Sanitize mermaid content to fix common issues from LLM generation.
 *
 * ## Issues Fixed
 *
 * 1. **Unescaped quotes inside node labels**: LLMs often generate content like
 *    `NODE["...the same "state"."]` which breaks mermaid parsing because `"` is
 *    the delimiter. These inner quotes are replaced with Unicode smart quotes
 *    (`"` and `"`).
 *
 * ## How It Works
 *
 * The function finds all node label content (between `["...]`, `{"...}`, etc.)
 * and replaces any `"` characters that appear INSIDE the content (not the delimiters)
 * with Unicode curly quotes.
 *
 * @param content - The raw mermaid content (possibly from LLM generation)
 * @returns Sanitized mermaid content safe for parsing
 *
 * @example
 * ```typescript
 * const bad = 'NODE["sharing the same "state"."]'
 * const good = sanitizeMermaidContent(bad)
 * // 'NODE["sharing the same "state"."]'
 * ```
 */
export function sanitizeMermaidContent(content: string): string {
  // Match node definitions and replace inner quotes with curly quotes
  // Patterns: ID["..."], ID{"..."}, ID(["..."]), ID(("..."))
  //
  // The regex captures:
  // - Group 1: Opening delimiter (["  or {"  or (["  or ((" )
  // - Group 2: The content inside
  // - Group 3: Closing delimiter ("]  or "}  or "])  or ")) )

  return content.replace(
    /(\["|\{"|(\(\[")|\(\(")([\s\S]*?)("]|\}"|"]\)|"\)\))/g,
    (match, open, _stadium, innerContent, close) => {
      // If we captured the stadium opener, use that
      const actualOpen = _stadium || open

      // Replace straight quotes inside the content with smart quotes
      // Using alternating left/right quotes for natural reading
      let inQuote = false
      const sanitizedContent = innerContent.replace(/"/g, () => {
        inQuote = !inQuote
        return inQuote ? '"' : '"'
      })

      return `${actualOpen}${sanitizedContent}${close}`
    }
  )
}

// =============================================================================
// Mermaid File Parsing
// =============================================================================

/**
 * Parse a complete Mermaid flowchart into nodes, edges, and phases.
 *
 * ## What It Extracts
 *
 * - **Nodes**: ID → raw content mapping (content is NOT parsed here, use `parseNodeContent`)
 * - **Edges**: From → To connections with optional labels
 * - **Phases**: Subgraph groupings with title and contained node IDs
 *
 * ## Node Shapes Supported
 *
 * - `ID["content"]` - Rectangle
 * - `ID{"content"}` - Diamond (decision)
 * - `ID(["content"])` - Stadium (rounded rectangle)
 * - `ID(("content"))` - Circle (milestones, often emoji-only)
 *
 * ## Edge Format
 *
 * - `A --> B` - Simple edge
 * - `A -->|"label"| B` - Edge with label
 *
 * @param content - The complete Mermaid flowchart content (from .mmd file or embedded string)
 * @returns Parsed structure with nodes, edges, and phases
 *
 * @example
 * ```typescript
 * const mermaid = parseMermaidFile(`
 *   flowchart TB
 *     subgraph PHASE1["Step 1"]
 *       START["<b>Begin</b>"] --> DECISION{"<b>Continue?</b>"}
 *       DECISION -->|"Yes"| DONE(("👍"))
 *     end
 * `)
 *
 * mermaid.nodes['START']  // '<b>Begin</b>'
 * mermaid.edges[0]        // { from: 'START', to: 'DECISION' }
 * mermaid.phases[0]       // { id: 'PHASE1', title: 'Step 1', nodes: ['START', 'DECISION', 'DONE'] }
 * ```
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
  // Supports:
  // - Basic: ID1 --> ID2
  // - With quoted label: ID1 -->|"label"| ID2
  // - With unquoted label: ID1 -->|label| ID2
  // - With edge ID (mermaid v11.6+): ID1 edgeId@--> ID2
  // - With edge ID and label: ID1 edgeId@-->|"label"| ID2 or ID1 edgeId@-->|label| ID2
  // - Chained: ID1 --> ID2 --> ID3
  //
  // Edge ID syntax: The ID comes before @ and before the arrow
  // Label can be quoted ("label") or unquoted (label)
  const edgePattern = /(\w+)\s+(?:(\w+)@)?-->\s*(?:\|"?([^"|]+)"?\|\s*)?(\w+)/g
  let edgeMatch
  let edgeIndex = 0
  while ((edgeMatch = edgePattern.exec(cleanContent)) !== null) {
    const [, from, edgeId, label, to] = edgeMatch
    // Skip phase-to-phase connections and style definitions
    if (from.startsWith('PHASE') || from === 'style') continue

    edges.push({
      from,
      to,
      label: label || undefined,
      // Use explicit edge ID if provided, otherwise generate one
      id: edgeId || `edge_${edgeIndex}`,
      index: edgeIndex,
    })
    edgeIndex++
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
