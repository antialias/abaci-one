/**
 * All tool definitions for the OpenAI Realtime API, extracted from route.ts.
 *
 * Static tools are exported as constants; context-dependent tools are factories.
 * Composed sets group tools by session mode.
 */

import type { RealtimeTool, ModeContext } from './types'
import { AVAILABLE_EXPLORATIONS } from '../explorationRegistry'
import { GAME_IDS, getGameToolDescription } from '../gameRegistry'

// ── Static tools ────────────────────────────────────────────────────────────

export const TOOL_HANG_UP: RealtimeTool = {
  type: 'function',
  name: 'hang_up',
  description:
    'End the phone call. You MUST say a clear, warm goodbye to the child BEFORE calling this — never hang up silently. Say something like "It was great talking to you! Bye!" in character, THEN call this tool. The child needs closure.',
  parameters: { type: 'object', properties: {} },
}

export const TOOL_LOOK_AT: RealtimeTool = {
  type: 'function',
  name: 'look_at',
  description:
    'Pan and zoom the number line to show a specific region. The child sees the number line animate smoothly to the new view. Use this whenever you\'re talking about a specific number or region — e.g. "let me show you where I live", "look over at 100", "let\'s zoom out and see the big picture". You control what the child sees.',
  parameters: {
    type: 'object',
    properties: {
      center: {
        type: 'number',
        description: 'The number to center the view on',
      },
      range: {
        type: 'number',
        description:
          'How wide a range to show (in number-line units). E.g. range=10 shows roughly 5 units on each side of center. Default: 20. Use small values (2-5) to zoom in close, large values (50-1000) to zoom out.',
      },
    },
    required: ['center'],
  },
}

export const TOOL_INDICATE: RealtimeTool = {
  type: 'function',
  name: 'indicate',
  description:
    'Highlight specific numbers or a range on the number line with a temporary glowing visual indicator. Use this to point things out — "see these primes?", "this whole area here", "look, I live right here". IMPORTANT: If the numbers or range you want to highlight are outside what the child can currently see, call look_at FIRST to navigate there, THEN call indicate — otherwise the highlight will be invisible. You can control how long the highlight stays visible with duration_seconds.',
  parameters: {
    type: 'object',
    properties: {
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Specific numbers to highlight with glowing dots on the number line',
      },
      range: {
        type: 'object',
        properties: {
          from: { type: 'number', description: 'Start of the range to highlight' },
          to: { type: 'number', description: 'End of the range to highlight' },
        },
        required: ['from', 'to'],
        description: 'A range to highlight as a shaded band on the number line',
      },
      duration_seconds: {
        type: 'number',
        description:
          'How long the highlight stays visible (default 4). Use longer durations (8-15) when explaining something about the highlighted region, shorter (2-3) for quick "look here" moments. Ignored when persistent is true.',
      },
      persistent: {
        type: 'boolean',
        description:
          'When true, the highlight stays visible until replaced by another indicate call or the game ends. Use this during games to show persistent state (e.g. remaining stones in Nim).',
      },
    },
  },
}

export const TOOL_EVOLVE_STORY: RealtimeTool = {
  type: 'function',
  name: 'evolve_story',
  description:
    'Call this PROACTIVELY to get a fresh story development. Do NOT wait for awkward silence — call it after 4-6 exchanges when the initial topic is settling, when the child gives a short answer, when you feel the conversation could use a new thread, or during any natural breath. Call it even when things are going okay — fresh material keeps the conversation engaging. The only bad time to call this is in the middle of a rapid back-and-forth exchange. You\'ll get back a development, a new tension, and a suggestion to weave in naturally.',
  parameters: { type: 'object', properties: {} },
}

export const TOOL_TRANSFER_CALL: RealtimeTool = {
  type: 'function',
  name: 'transfer_call',
  description:
    'Transfer the phone call to another number. Use this when the child asks to talk to a different number (e.g. "can I talk to 7?"). Say something like "Sure, let me transfer you!" then call this tool.',
  parameters: {
    type: 'object',
    properties: {
      target_number: {
        type: 'number',
        description: 'The number to transfer the call to',
      },
    },
    required: ['target_number'],
  },
}

export const TOOL_ADD_TO_CALL: RealtimeTool = {
  type: 'function',
  name: 'add_to_call',
  description:
    'Add one or more numbers to the current call as a conference/group call. Use this when the child wants multiple numbers talking together (e.g. "can 12 join us?", "add 5 and 7 to the call", "let\'s get 3, 8, and 12 on here"). Always pass ALL requested numbers in a single call. After calling this, you will play multiple characters.',
  parameters: {
    type: 'object',
    properties: {
      target_numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'The numbers to add to the conference call',
      },
    },
    required: ['target_numbers'],
  },
}

export const TOOL_SWITCH_SPEAKER: RealtimeTool = {
  type: 'function',
  name: 'switch_speaker',
  description:
    'Switch which number character you are speaking as during a conference call. Call this BEFORE speaking as a different number — it updates the visual indicator showing the child who is talking. NEVER start speaking as a different character without calling this first. The child sees which number is talking on screen, and it MUST match what you say.',
  parameters: {
    type: 'object',
    properties: {
      number: {
        type: 'number',
        description: 'The number to speak as (must be on the current call)',
      },
    },
    required: ['number'],
  },
}

export const TOOL_START_EXPLORATION: RealtimeTool = {
  type: 'function',
  name: 'start_exploration',
  description:
    `Launch an animated visual exploration on the number line. For constant explorations (phi, pi, tau, e, gamma, sqrt2, ramanujan): the animation starts PAUSED — introduce the constant to the child first, then call resume_exploration when ready. A pre-recorded narrator handles the narration. Stay quiet during playback. For tour explorations (primes): you will need to hang up first — the tour launches automatically after the call ends. Explain the tour to the child, say goodbye warmly, invite them to call back after watching, then call hang_up. Available explorations: ${AVAILABLE_EXPLORATIONS.map(e => `${e.id} (${e.name})`).join(', ')}.`,
  parameters: {
    type: 'object',
    properties: {
      constant_id: {
        type: 'string',
        enum: AVAILABLE_EXPLORATIONS.map(e => e.id),
        description: 'Which exploration to launch',
      },
    },
    required: ['constant_id'],
  },
}

export const TOOL_PAUSE_EXPLORATION: RealtimeTool = {
  type: 'function',
  name: 'pause_exploration',
  description:
    'Pause the currently playing exploration animation. The animation also pauses automatically when the child speaks. Use this for deliberate pauses when you want to highlight something or linger on an interesting moment.',
  parameters: { type: 'object', properties: {} },
}

export const TOOL_RESUME_EXPLORATION: RealtimeTool = {
  type: 'function',
  name: 'resume_exploration',
  description:
    'Resume the exploration animation from where it was paused. Call this after you\'ve answered the child\'s question and they\'re ready to continue watching.',
  parameters: { type: 'object', properties: {} },
}

export const TOOL_SEEK_EXPLORATION: RealtimeTool = {
  type: 'function',
  name: 'seek_exploration',
  description:
    'Jump the exploration animation to a specific segment by number (1-indexed, matching the script you received). The animation pauses at that segment so you can discuss it. Use this when the child asks to see a specific part again, e.g. "show me the part about the spiral" — find the matching segment number from the script and seek to it.',
  parameters: {
    type: 'object',
    properties: {
      segment_number: {
        type: 'number',
        description: 'Which segment to jump to (1-indexed)',
      },
    },
    required: ['segment_number'],
  },
}

export const TOOL_SET_NUMBER_LINE_STYLE: RealtimeTool = {
  type: 'function',
  name: 'set_number_line_style',
  description:
    'Adjust the visual style of number labels on the number line. Use this to make labels larger and more visible when playing games or when the current zoom makes labels hard to read.',
  parameters: {
    type: 'object',
    properties: {
      label_scale: {
        type: 'number',
        description:
          'Font size multiplier for labels (0.5–3, default 1). Use 1.5–2 to make labels clearly readable at wide zoom levels.',
      },
      label_min_opacity: {
        type: 'number',
        description:
          'Minimum opacity for all labels (0–1, default 0). Set to 0.8–1.0 to make even small numbers fully visible.',
      },
    },
  },
}

export const TOOL_END_EXPLORATION: RealtimeTool = {
  type: 'function',
  name: 'end_exploration',
  description:
    'Stop the current exploration and return to conversation. Use this when the child wants to stop watching and do something else — play a game, talk, etc.',
  parameters: { type: 'object', properties: {} },
}

export const TOOL_END_GAME: RealtimeTool = {
  type: 'function',
  name: 'end_game',
  description: 'End the current game and return to open play.',
  parameters: { type: 'object', properties: {} },
}

export const TOOL_REQUEST_MORE_TIME: RealtimeTool = {
  type: 'function',
  name: 'request_more_time',
  description:
    'Call this when the conversation is going great and you want more time to keep talking. IMPORTANT: Do NOT mention the time extension to the child. Just keep talking naturally as if nothing happened.',
  parameters: { type: 'object', properties: {} },
}

// ── Factory tools (context-dependent) ───────────────────────────────────────

export function makeIdentifyCallerTool(
  players: Array<{ id: string; name: string; emoji: string }>,
): RealtimeTool {
  const nameList = players.map(p => p.name).join(', ')
  return {
    type: 'function',
    name: 'identify_caller',
    description:
      `Call this when you learn a child's name, or when a different child takes over the phone. ` +
      `Pass your best guess of the name — it will be fuzzy-matched. Don't hesitate to call this even if you're not 100% sure of the spelling. ` +
      `Known names: ${nameList}. ` +
      `You can call this again anytime a different kid takes over.`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name the child said (your best guess — fuzzy matching will handle misspellings)',
        },
      },
      required: ['name'],
    },
  }
}

export function makeStartGameTool(): RealtimeTool {
  return {
    type: 'function',
    name: 'start_game',
    description: getGameToolDescription(),
    parameters: {
      type: 'object',
      properties: {
        game_id: {
          type: 'string',
          enum: GAME_IDS,
          description: 'Which game to start',
        },
        target: {
          type: 'number',
          description: 'For find_number: the target number to find. For race: the target to reach (default 21).',
        },
        min: {
          type: 'number',
          description: 'For guess_my_number: lower bound of the range (default 1).',
        },
        max: {
          type: 'number',
          description: 'For guess_my_number: upper bound of the range (default 100).',
        },
        stones: {
          type: 'number',
          description: 'For nim/poison: total number of stones (default 15). Must be a positive integer.',
        },
        max_take: {
          type: 'number',
          description: 'For nim/poison: maximum stones a player can take per turn (default 3). Must be a positive integer.',
        },
        max_add: {
          type: 'number',
          description: 'For race: maximum a player can add per turn (default 3). Must be a positive integer.',
        },
      },
      required: ['game_id'],
    },
  }
}

// ── Composed tool sets per mode ─────────────────────────────────────────────

export function getAnsweringTools(): RealtimeTool[] {
  return [TOOL_LOOK_AT, TOOL_HANG_UP]
}

export function getFamiliarizingTools(ctx: ModeContext): RealtimeTool[] {
  const tools: RealtimeTool[] = [TOOL_LOOK_AT, TOOL_INDICATE, TOOL_HANG_UP]
  if (ctx.availablePlayers.length > 0) {
    tools.unshift(makeIdentifyCallerTool(ctx.availablePlayers))
  }
  return tools
}

export function getDefaultTools(ctx: ModeContext): RealtimeTool[] {
  const tools: RealtimeTool[] = []

  // Always include identify_caller when players are available (allows mid-call switching)
  if (ctx.availablePlayers.length > 0) {
    tools.push(makeIdentifyCallerTool(ctx.availablePlayers))
  }

  tools.push(
    TOOL_REQUEST_MORE_TIME,
    TOOL_HANG_UP,
    TOOL_TRANSFER_CALL,
    TOOL_ADD_TO_CALL,
    TOOL_START_EXPLORATION,
    TOOL_LOOK_AT,
    TOOL_EVOLVE_STORY,
    makeStartGameTool(),
    TOOL_SET_NUMBER_LINE_STYLE,
    TOOL_INDICATE,
  )

  return tools
}

export function getConferenceTools(): RealtimeTool[] {
  return [
    TOOL_SWITCH_SPEAKER,
    TOOL_ADD_TO_CALL,
    TOOL_LOOK_AT,
    TOOL_INDICATE,
    TOOL_EVOLVE_STORY,
    TOOL_START_EXPLORATION,
    makeStartGameTool(),
    TOOL_HANG_UP,
    TOOL_REQUEST_MORE_TIME,
    TOOL_SET_NUMBER_LINE_STYLE,
  ]
}

export function getExplorationTools(): RealtimeTool[] {
  return [
    TOOL_PAUSE_EXPLORATION,
    TOOL_RESUME_EXPLORATION,
    TOOL_SEEK_EXPLORATION,
    TOOL_END_EXPLORATION,
    TOOL_HANG_UP,
  ]
}

export function getHangingUpTools(): RealtimeTool[] {
  return [TOOL_HANG_UP]
}
