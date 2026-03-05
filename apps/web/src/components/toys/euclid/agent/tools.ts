/**
 * Tool definitions for the Euclid voice session.
 */

import type { RealtimeTool } from '@/lib/voice/types'

export const TOOL_HANG_UP: RealtimeTool = {
  type: 'function',
  name: 'hang_up',
  description:
    'End the call. Use this when the student says goodbye, or when you need to end the conversation. ' +
    'Say a brief farewell in character before calling this.',
  parameters: {
    type: 'object',
    properties: {},
  },
}

export const TOOL_HIGHLIGHT: RealtimeTool = {
  type: 'function',
  name: 'highlight',
  description:
    "Visually highlight a geometric entity on the student's canvas with a golden glow. " +
    "Use this while speaking to direct the student's attention. " +
    'The highlight appears for a few seconds then fades. Call again to highlight something new.',
  parameters: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['point', 'segment', 'triangle', 'angle'],
        description: 'The type of geometric entity to highlight.',
      },
      labels: {
        type: 'string',
        description:
          'Point labels defining the entity. ' +
          'Point: "A". Segment: "AB". Triangle/angle: "ABC" (for angle, middle letter is vertex).',
      },
    },
    required: ['entity_type', 'labels'],
  },
}

export const TOOL_THINK_HARD: RealtimeTool = {
  type: 'function',
  name: 'think_hard',
  description:
    'Consult your own earlier writings and work through a proof carefully. ' +
    'Use this when the student asks something that requires deep geometric reasoning, ' +
    'visual analysis of the construction, or when you need to verify a result against your notes. ' +
    'You can see the current construction and will reason through it methodically. ' +
    'Set effort based on difficulty: "low" for simple clarifications, "medium" for moderate questions, ' +
    '"high" for complex proofs, "xhigh" for the hardest problems.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description:
          'The geometric question to reason about, including any relevant context from the conversation.',
      },
      effort: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'xhigh'],
        description: 'How carefully to work through the proof. Higher = slower but more thorough.',
      },
    },
    required: ['question', 'effort'],
  },
}

// ── Author tools: axiom-framed construction + fact store ──

export const TOOL_PLACE_POINT: RealtimeTool = {
  type: 'function',
  name: 'place_point',
  description:
    'Place a new free point on the construction canvas at the given coordinates. ' +
    'Use this to establish initial/given points before applying postulates. ' +
    'The label is auto-assigned (A, B, C, ...) unless explicitly specified. ' +
    'Coordinates are in construction units — the visible canvas is roughly -3 to 3 in both axes, ' +
    'with (0, 0) at center.',
  parameters: {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: 'X coordinate in construction units (e.g. -1.5, 0, 2.0).',
      },
      y: {
        type: 'number',
        description: 'Y coordinate in construction units (e.g. -1.0, 0, 1.5).',
      },
      label: {
        type: 'string',
        description:
          'Optional explicit label for the point (single uppercase letter, e.g. "A"). If omitted, auto-assigned.',
      },
    },
    required: ['x', 'y'],
  },
}

export const TOOL_RELOCATE_POINT: RealtimeTool = {
  type: 'function',
  name: 'relocate_point',
  description:
    'Move an existing free point to new coordinates. Only works for free (user-placed) points — ' +
    'given, intersection, and extension points are derived and cannot be independently relocated. ' +
    'Performs a trial replay of the entire construction before committing. If moving the point ' +
    'would break dependent constructions (e.g. an intersection that no longer exists), returns ' +
    'an error with the list of broken elements and does NOT commit the change.',
  parameters: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        description: 'Label of the free point to move (e.g. "A").',
      },
      x: {
        type: 'number',
        description: 'New X coordinate in construction units.',
      },
      y: {
        type: 'number',
        description: 'New Y coordinate in construction units.',
      },
      force: {
        type: 'boolean',
        description:
          'If true, commit the relocation even if it breaks dependent elements (they will be removed). ' +
          'Use only after the admin has been warned about breakage and explicitly confirms.',
      },
    },
    required: ['label', 'x', 'y'],
  },
}

export const TOOL_POSTULATE_1: RealtimeTool = {
  type: 'function',
  name: 'postulate_1',
  description:
    'Postulate 1: "To draw a straight line from any point to any point." ' +
    'Draws a segment between two existing points on the construction.',
  parameters: {
    type: 'object',
    properties: {
      from_label: {
        type: 'string',
        description: 'Label of the starting point (e.g. "A").',
      },
      to_label: {
        type: 'string',
        description: 'Label of the ending point (e.g. "B").',
      },
    },
    required: ['from_label', 'to_label'],
  },
}

export const TOOL_POSTULATE_2: RealtimeTool = {
  type: 'function',
  name: 'postulate_2',
  description:
    'Postulate 2: "To produce a finite straight line continuously in a straight line." ' +
    'Extends a segment through one endpoint to a new point. Requires a base point ' +
    'and a through point (the endpoint to extend past). DO NOT pass the distance ' +
    'parameter unless the user explicitly requests a specific extension length — ' +
    'when omitted, the segment is extended by its own length (i.e. doubled), which ' +
    'is almost always what you want.',
  parameters: {
    type: 'object',
    properties: {
      base_label: {
        type: 'string',
        description: 'Label of the base point defining the ray direction (e.g. "A").',
      },
      through_label: {
        type: 'string',
        description: 'Label of the point to extend through (e.g. "B").',
      },
      distance: {
        type: 'number',
        description:
          'How far to extend past the through point (in construction units). ' +
          'DO NOT pass this parameter unless the user specifies an explicit length. ' +
          'Must be positive. When omitted, defaults to the segment\'s own length.',
      },
    },
    required: ['base_label', 'through_label'],
  },
}

export const TOOL_POSTULATE_3: RealtimeTool = {
  type: 'function',
  name: 'postulate_3',
  description:
    'Postulate 3: "To describe a circle with any center and distance." ' +
    'Draws a circle centered at one point, with radius equal to the distance to another point.',
  parameters: {
    type: 'object',
    properties: {
      center_label: {
        type: 'string',
        description: 'Label of the center point (e.g. "A").',
      },
      radius_point_label: {
        type: 'string',
        description: 'Label of the point defining the radius (e.g. "B").',
      },
    },
    required: ['center_label', 'radius_point_label'],
  },
}

export const TOOL_MARK_INTERSECTION: RealtimeTool = {
  type: 'function',
  name: 'mark_intersection',
  description:
    'Mark an intersection point between two construction elements (circles or segments). ' +
    'The system finds available intersection candidates and marks the one matching the specified elements. ' +
    'When two elements intersect at two points, use "which" to select "first" or "second" (ordered by x then y).',
  parameters: {
    type: 'object',
    properties: {
      of_a: {
        type: 'string',
        description:
          'ID or description of the first element (e.g. "cir-1" for a circle, "seg-1" for a segment).',
      },
      of_b: {
        type: 'string',
        description: 'ID or description of the second element.',
      },
      which: {
        type: 'string',
        enum: ['first', 'second'],
        description:
          'Which intersection to mark when two elements meet at two points. "first" = lower x (or lower y if same x). Default: "first".',
      },
    },
    required: ['of_a', 'of_b'],
  },
}

export const TOOL_APPLY_PROPOSITION: RealtimeTool = {
  type: 'function',
  name: 'apply_proposition',
  description:
    'Apply a previously proven proposition as a macro construction. ' +
    'Executes the full construction of the proposition on the given input points, ' +
    'adding all intermediate elements and deriving all facts.',
  parameters: {
    type: 'object',
    properties: {
      prop_id: {
        type: 'number',
        description: 'The proposition number (e.g. 1 for Proposition I.1).',
      },
      input_labels: {
        type: 'string',
        description:
          'Comma-separated labels of the input points in order (e.g. "A,B" for Prop I.1).',
      },
    },
    required: ['prop_id', 'input_labels'],
  },
}

export const TOOL_DECLARE_EQUALITY: RealtimeTool = {
  type: 'function',
  name: 'declare_equality',
  description:
    'Assert that two distances are equal, with a citation from the axiomatic system. ' +
    "This adds an equality fact to the proof's fact store. " +
    'Citation types: "def15" (radii of a circle), "cn1" (transitivity), "cn2" (addition), ' +
    '"cn3" (subtraction), "cn4" (superposition), "given" (hypothesis), "prop" (prior proposition).',
  parameters: {
    type: 'object',
    properties: {
      left_a: { type: 'string', description: 'First point of the left distance pair (e.g. "A").' },
      left_b: {
        type: 'string',
        description: 'Second point of the left distance pair (e.g. "B").',
      },
      right_a: {
        type: 'string',
        description: 'First point of the right distance pair (e.g. "C").',
      },
      right_b: {
        type: 'string',
        description: 'Second point of the right distance pair (e.g. "D").',
      },
      citation_type: {
        type: 'string',
        enum: ['def15', 'cn1', 'cn2', 'cn3', 'cn4', 'given', 'prop'],
        description: 'The type of citation justifying the equality.',
      },
      citation_detail: {
        type: 'string',
        description:
          'Additional detail for the citation. For def15: circle ID (e.g. "cir-1"). ' +
          'For cn1: the two point labels of the shared distance (e.g. "A,B"). ' +
          'For cn3: "wholeA,wholeB,partA,partB". For prop: the proposition number. ' +
          'For cn2, cn4, given: leave empty.',
      },
      statement: {
        type: 'string',
        description: 'Human-readable statement (e.g. "CA = AB").',
      },
      justification: {
        type: 'string',
        description:
          'Human-readable justification (e.g. "Def.15: C on circle centered at A through B").',
      },
    },
    required: [
      'left_a',
      'left_b',
      'right_a',
      'right_b',
      'citation_type',
      'statement',
      'justification',
    ],
  },
}

export const TOOL_DECLARE_ANGLE_EQUALITY: RealtimeTool = {
  type: 'function',
  name: 'declare_angle_equality',
  description:
    'Assert that two angles are equal, with a citation from the axiomatic system. ' +
    'Angles are defined by vertex + two ray endpoints.',
  parameters: {
    type: 'object',
    properties: {
      left_vertex: { type: 'string', description: 'Vertex of the left angle.' },
      left_ray1: { type: 'string', description: 'First ray endpoint of the left angle.' },
      left_ray2: { type: 'string', description: 'Second ray endpoint of the left angle.' },
      right_vertex: { type: 'string', description: 'Vertex of the right angle.' },
      right_ray1: { type: 'string', description: 'First ray endpoint of the right angle.' },
      right_ray2: { type: 'string', description: 'Second ray endpoint of the right angle.' },
      citation_type: {
        type: 'string',
        enum: ['cn1', 'cn2', 'cn3-angle', 'cn4', 'given', 'prop'],
        description: 'The type of citation justifying the equality.',
      },
      citation_detail: {
        type: 'string',
        description: 'Additional detail for the citation (same format as declare_equality).',
      },
      statement: { type: 'string', description: 'Human-readable statement (e.g. "∠ABC = ∠DEF").' },
      justification: { type: 'string', description: 'Human-readable justification.' },
    },
    required: [
      'left_vertex',
      'left_ray1',
      'left_ray2',
      'right_vertex',
      'right_ray1',
      'right_ray2',
      'citation_type',
      'statement',
      'justification',
    ],
  },
}

export const TOOL_UNDO_LAST: RealtimeTool = {
  type: 'function',
  name: 'undo_last',
  description: 'Revert the most recent construction action, restoring the previous state.',
  parameters: {
    type: 'object',
    properties: {},
  },
}

/** All author-mode construction + fact store tools. */
export const AUTHOR_TOOLS: RealtimeTool[] = [
  TOOL_PLACE_POINT,
  TOOL_RELOCATE_POINT,
  TOOL_POSTULATE_1,
  TOOL_POSTULATE_2,
  TOOL_POSTULATE_3,
  TOOL_MARK_INTERSECTION,
  TOOL_APPLY_PROPOSITION,
  TOOL_DECLARE_EQUALITY,
  TOOL_DECLARE_ANGLE_EQUALITY,
  TOOL_UNDO_LAST,
]
