/**
 * Auto-generates per-macro tool instructions from the recipe registry.
 *
 * Used in author mode system prompts (both text chat and voice) so the model
 * knows exactly how to invoke each `apply_proposition` macro: which inputs
 * it expects, what it produces, and what facts it derives.
 *
 * Addresses GitHub issue #117 — the model previously struggled with the
 * generic `apply_proposition` tool because it had no per-macro guidance.
 */

import { RECIPE_REGISTRY } from './recipe/definitions/registry'
import type { ConstructionRecipe, RecipeCitation } from './recipe/types'

function formatCitation(c: RecipeCitation): string {
  switch (c.type) {
    case 'def15':
      return 'Def.15'
    case 'cn1':
      return 'C.N.1'
    case 'cn3':
      return 'C.N.3'
    case 'prop':
      return `I.${c.propId}`
  }
}

function buildRecipeDoc(recipe: ConstructionRecipe): string {
  const { propId, label, inputSlots, distinctInputPairs, exports: recipeExports, facts } = recipe

  // Usage line: apply_proposition(1, "A,B")
  const inputRefs = inputSlots.map((s) => s.ref).join(',')
  const lines: string[] = [
    `Prop I.${propId} — "${label}"`,
    `  Usage: apply_proposition(${propId}, "${inputRefs}")`,
  ]

  // Inputs with roles
  const inputDescs = inputSlots.map((s) => `${s.ref} (${s.label.toLowerCase()})`).join(', ')
  lines.push(`  Inputs: ${inputDescs}`)

  // Distinctness constraints
  if (distinctInputPairs.length > 0) {
    const constraints = distinctInputPairs
      .map(([i, j]) => `${inputSlots[i].ref} ≠ ${inputSlots[j].ref}`)
      .join(', ')
    lines.push(`  Constraint: ${constraints}`)
  }

  // Exports
  if (recipeExports.length > 0) {
    const exportDescs = recipeExports.map((e) => {
      // For segments, show the ref in a readable form (seg-CA → CA)
      const displayRef = e.kind === 'segment' ? e.ref.replace(/^seg-/, '') : e.ref
      const kindLabel = e.kind === 'point' ? `point ${displayRef}` : `segment ${displayRef}`
      return e.outputLabelKey ? `${kindLabel} (${e.outputLabelKey})` : kindLabel
    })
    lines.push(`  Produces: ${exportDescs.join(', ')}`)
  }

  // Key result — the last fact is typically the conclusion
  if (facts.length > 0) {
    const conclusion = facts[facts.length - 1]
    const stmt = conclusion.statementTemplate.replace(/\{(\w)\}/g, '$1')
    lines.push(`  Key result: ${stmt} [${formatCitation(conclusion.citation)}]`)
  }

  // Full fact chain (show when there are intermediate steps)
  if (facts.length > 1) {
    lines.push(`  Fact chain:`)
    for (const fact of facts) {
      const stmt = fact.statementTemplate.replace(/\{(\w)\}/g, '$1')
      lines.push(`    ${stmt} [${formatCitation(fact.citation)}]`)
    }
  }

  return lines.join('\n')
}

/** Build per-macro documentation from the recipe registry. */
export function buildMacroInstructions(): string {
  const propIds = Object.keys(RECIPE_REGISTRY)
    .map(Number)
    .sort((a, b) => a - b)

  if (propIds.length === 0) return ''

  const docs = propIds.map((id) => buildRecipeDoc(RECIPE_REGISTRY[id])).join('\n\n')

  return `=== AVAILABLE PROPOSITION MACROS ===
These propositions have been proven and can be applied as single operations.

IMPORTANT — INPUT ORDER MATTERS:
- Reversing input order produces a DIFFERENT result. Intersection points are chosen
  relative to the direction from the first input to the second ("chirality").
- Example: apply_proposition(1, "A,B") builds a triangle on one side of AB.
  apply_proposition(1, "B,A") builds the triangle on the OTHER side.
- The same proposition CAN be applied multiple times with different inputs.

${docs}`
}
