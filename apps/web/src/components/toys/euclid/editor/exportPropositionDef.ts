import type { ProofJSON, SerializedStep, SerializedElement, SerializedAction } from '../types'
import { PROPOSITION_REFS } from './propositionReference'

/**
 * Map a SerializedAction to the tool that should be auto-selected for this step.
 * Returns the ActiveTool string or null (for intersection taps, fact-only).
 */
function toolForAction(action: SerializedAction): string | null {
  switch (action.type) {
    case 'compass':
      return "'compass'"
    case 'straightedge':
      return "'straightedge'"
    case 'macro':
      return "'macro'"
    case 'intersection':
      return 'null'
    case 'fact-only':
      return 'null'
    case 'extend':
      return "'extend'"
  }
}

/**
 * Map a SerializedAction to the `expected` object in PropositionStep.
 */
function expectedForAction(action: SerializedAction): string {
  switch (action.type) {
    case 'compass':
      return `{ type: 'compass', centerId: '${action.centerId}', radiusPointId: '${action.radiusPointId}' }`
    case 'straightedge':
      return `{ type: 'straightedge', fromId: '${action.fromId}', toId: '${action.toId}' }`
    case 'intersection':
      return `{ type: 'intersection', label: '${action.label}' }`
    case 'macro':
      return `{ type: 'macro', propId: ${action.propId}, inputPointIds: [${action.inputPointIds.map((id) => `'${id}'`).join(', ')}] }`
    case 'fact-only':
      return `{ type: 'fact-only' }`
    case 'extend':
      return `{ type: 'extend', baseId: '${action.baseId}', throughId: '${action.throughId}', distance: ${action.distance}, label: '${action.label}' }`
  }
}

/**
 * Compute highlightIds from an action — the point IDs that should be visually
 * emphasized during this step.
 */
function highlightIdsForAction(action: SerializedAction): string[] {
  switch (action.type) {
    case 'compass':
      return [action.centerId, action.radiusPointId]
    case 'straightedge':
      return [action.fromId, action.toId]
    case 'intersection':
      return []
    case 'macro':
      return action.inputPointIds
    case 'fact-only':
      return []
    case 'extend':
      return [action.baseId, action.throughId]
  }
}

/**
 * Format a ConstructionElement literal for TypeScript output.
 */
function formatElement(el: SerializedElement, indent: string): string {
  if (el.kind === 'point') {
    return [
      `${indent}{`,
      `${indent}  kind: 'point',`,
      `${indent}  id: '${el.id}',`,
      `${indent}  x: ${el.x},`,
      `${indent}  y: ${el.y},`,
      `${indent}  label: '${el.label}',`,
      `${indent}  color: BYRNE.given,`,
      `${indent}  origin: 'given',`,
      `${indent}},`,
    ].join('\n')
  }
  if (el.kind === 'segment') {
    return [
      `${indent}{`,
      `${indent}  kind: 'segment',`,
      `${indent}  id: '${el.id}',`,
      `${indent}  fromId: '${el.fromId}',`,
      `${indent}  toId: '${el.toId}',`,
      `${indent}  color: BYRNE.given,`,
      `${indent}  origin: 'given',`,
      `${indent}},`,
    ].join('\n')
  }
  // circle (unlikely for given elements, but handle it)
  return [
    `${indent}{`,
    `${indent}  kind: 'circle',`,
    `${indent}  id: '${el.id}',`,
    `${indent}  centerId: '${el.centerId}',`,
    `${indent}  radiusPointId: '${el.radiusPointId}',`,
    `${indent}  color: BYRNE.given,`,
    `${indent}  origin: 'compass',`,
    `${indent}},`,
  ].join('\n')
}

/**
 * Format a PropositionStep literal.
 */
function formatStep(step: SerializedStep, indent: string): string {
  const highlights = highlightIdsForAction(step.action)
  const lines = [
    `${indent}{`,
    `${indent}  instruction: ${JSON.stringify(step.instruction)},`,
    `${indent}  expected: ${expectedForAction(step.action)},`,
    `${indent}  highlightIds: [${highlights.map((id) => `'${id}'`).join(', ')}],`,
    `${indent}  tool: ${toolForAction(step.action)},`,
  ]
  if (step.citation) {
    lines.push(`${indent}  citation: '${step.citation}',`)
  }
  lines.push(`${indent}},`)

  // Add notes as a comment before the step
  if (step.notes) {
    const commentLines = step.notes.split('\n').map((line) => `${indent}// ${line}`)
    return [...commentLines, ...lines].join('\n')
  }
  return lines.join('\n')
}

/**
 * Generate a TypeScript PropositionDef file from a ProofJSON.
 *
 * This produces a draft that can be further edited to add:
 * - Tutorial sub-steps (getTutorial)
 * - Exploration narration
 * - Draggable point configuration
 * - Given facts/angles
 * - Conclusion derivation
 */
export function exportPropositionDef(proof: ProofJSON): string {
  const ref = PROPOSITION_REFS[proof.id]
  const propNum = proof.id
  const constName = `PROP_${propNum}`
  const isConstruction = proof.kind === 'construction'

  const lines: string[] = []

  // Imports
  lines.push(`import type { PropositionDef, ConstructionElement } from '../types'`)
  lines.push(`import { BYRNE } from '../types'`)
  lines.push('')

  // JSDoc
  lines.push(`/**`)
  if (ref) {
    lines.push(` * Proposition I.${propNum}: ${ref.statement}`)
  } else {
    lines.push(` * Proposition I.${propNum}: ${proof.title}`)
  }
  lines.push(` */`)

  // Export const
  lines.push(`export const ${constName}: PropositionDef = {`)
  lines.push(`  id: ${propNum},`)
  lines.push(`  title: ${JSON.stringify(proof.title)},`)
  lines.push(`  kind: '${proof.kind}',`)

  // Given elements
  lines.push(`  givenElements: [`)
  for (const el of proof.givenElements) {
    lines.push(formatElement(el, '    '))
  }
  lines.push(`  ] as ConstructionElement[],`)

  // Steps
  lines.push(`  steps: [`)
  for (const step of proof.steps) {
    lines.push(formatStep(step, '    '))
  }
  lines.push(`  ],`)

  // Given facts (equality constraints)
  if (proof.givenFacts && proof.givenFacts.length > 0) {
    lines.push(`  givenFacts: [`)
    for (const gf of proof.givenFacts) {
      lines.push(`    {`)
      lines.push(`      left: { a: '${gf.left.a}', b: '${gf.left.b}' },`)
      lines.push(`      right: { a: '${gf.right.a}', b: '${gf.right.b}' },`)
      lines.push(`      statement: ${JSON.stringify(gf.statement)},`)
      lines.push(`    },`)
    }
    lines.push(`  ],`)
  }

  // Result segments (point IDs from given + first two points mentioned in last straightedge steps)
  const resultSegments = proof.steps
    .filter((s) => s.action.type === 'straightedge')
    .slice(-3)
    .map((s) => {
      const a = s.action as { fromId: string; toId: string }
      return `    { fromId: '${a.fromId}', toId: '${a.toId}' },`
    })
  if (resultSegments.length > 0) {
    lines.push(`  resultSegments: [`)
    for (const seg of resultSegments) {
      lines.push(seg)
    }
    lines.push(`  ],`)
  }

  // Draggable points (given points)
  const draggableIds = proof.givenElements.filter((e) => e.kind === 'point').map((e) => `'${e.id}'`)
  if (draggableIds.length > 0) {
    lines.push(`  draggablePointIds: [${draggableIds.join(', ')}],`)
  }

  // TODO placeholders
  lines.push(`  // TODO: Add getTutorial for guided interaction`)
  lines.push(`  // TODO: Add explorationNarration for post-completion drag phase`)

  // Author notes as a block comment
  if (proof.authorNotes) {
    lines.push(`  /*`)
    lines.push(`   * Author notes:`)
    for (const line of proof.authorNotes.split('\n')) {
      lines.push(`   * ${line}`)
    }
    lines.push(`   */`)
  }

  lines.push(`}`)
  lines.push('')

  return lines.join('\n')
}

/**
 * Generate a formatted prompt for Claude to convert a proof JSON into a full PropDef.
 * Includes the proof data, reference information, and instructions.
 */
export function generateClaudePrompt(proof: ProofJSON): string {
  const ref = PROPOSITION_REFS[proof.id]
  const draft = exportPropositionDef(proof)

  const sections: string[] = []

  sections.push(`# Generate PropositionDef for Proposition I.${proof.id}`)
  sections.push('')

  if (ref) {
    sections.push(`## Reference`)
    sections.push(`- **Statement:** ${ref.statement}`)
    sections.push(`- **Type:** ${ref.type === 'C' ? 'Construction' : 'Theorem'}`)
    sections.push(`- **Method:** ${ref.method}`)
    sections.push(`- **Dependencies:** ${ref.deps.join(', ')}`)
    if (ref.note) sections.push(`- **Note:** ${ref.note}`)
    sections.push('')
  }

  sections.push(`## Proof JSON`)
  sections.push('```json')
  sections.push(JSON.stringify(proof, null, 2))
  sections.push('```')
  sections.push('')

  sections.push(`## Generated Draft`)
  sections.push('The following TypeScript draft was auto-generated from the proof JSON.')
  sections.push('Please enhance it with:')
  sections.push('1. A `getTutorial` function with sub-steps for each construction step')
  sections.push('2. `explorationNarration` with intro speech and per-point drag tips')
  sections.push('3. `givenFacts` if the proposition has pre-existing equality constraints')
  sections.push('4. `deriveConclusion` if the proposition proves something (theorem)')
  sections.push('5. Review `resultSegments` and `draggablePointIds`')
  sections.push('')
  sections.push('```typescript')
  sections.push(draft)
  sections.push('```')

  return sections.join('\n')
}
