/**
 * Shared dispatch function for author-mode tool calls.
 *
 * Maps tool names (e.g. 'place_point', 'postulate_1') to AuthorToolCallbacks
 * methods. Used by both useEuclidChat (text chat) and useGeometryVoice (voice)
 * so the dispatch logic lives in one place.
 */

import type { AuthorToolCallbacks } from '../authorToolCallbacks'

/**
 * Dispatch an author tool call to the appropriate callback.
 * Returns the callback result, or an error object for unknown tools.
 */
export function dispatchAuthorTool(
  name: string,
  args: Record<string, unknown>,
  callbacks: AuthorToolCallbacks
): Promise<unknown> {
  switch (name) {
    case 'place_point':
      return callbacks.placePoint(
        Number(args.x),
        Number(args.y),
        args.label ? String(args.label) : undefined
      )
    case 'postulate_1':
      return callbacks.commitSegment(String(args.from_label), String(args.to_label))
    case 'postulate_2':
      return callbacks.commitExtend(
        String(args.base_label),
        String(args.through_label),
        args.distance != null ? Number(args.distance) : undefined
      )
    case 'postulate_3':
      return callbacks.commitCircle(String(args.center_label), String(args.radius_point_label))
    case 'mark_intersection':
      return callbacks.markIntersection(
        String(args.of_a),
        String(args.of_b),
        args.which ? String(args.which) : undefined
      )
    case 'apply_proposition':
      return callbacks.commitMacro(
        Number(args.prop_id),
        String(args.input_labels)
          .split(',')
          .map((s) => s.trim())
      )
    case 'declare_equality':
      return callbacks.addFact(
        String(args.left_a),
        String(args.left_b),
        String(args.right_a),
        String(args.right_b),
        String(args.citation_type),
        args.citation_detail ? String(args.citation_detail) : undefined,
        String(args.statement),
        String(args.justification)
      )
    case 'declare_angle_equality':
      return callbacks.addAngleFact(
        String(args.left_vertex),
        String(args.left_ray1),
        String(args.left_ray2),
        String(args.right_vertex),
        String(args.right_ray1),
        String(args.right_ray2),
        String(args.citation_type),
        args.citation_detail ? String(args.citation_detail) : undefined,
        String(args.statement),
        String(args.justification)
      )
    case 'relocate_point':
      return callbacks.relocatePoint(
        String(args.label),
        Number(args.x),
        Number(args.y),
        args.force === true
      )
    case 'undo_last':
      return callbacks.undoLast()
    case 'highlight':
      return callbacks.highlight(String(args.entity_type), String(args.labels))
    default:
      return Promise.resolve({ success: false, error: `Unknown tool: ${name}` })
  }
}

/** List of all author tool names handled by dispatchAuthorTool. */
export const AUTHOR_TOOL_NAMES = [
  'place_point',
  'postulate_1',
  'postulate_2',
  'postulate_3',
  'mark_intersection',
  'apply_proposition',
  'declare_equality',
  'declare_angle_equality',
  'relocate_point',
  'undo_last',
  'highlight',
] as const
