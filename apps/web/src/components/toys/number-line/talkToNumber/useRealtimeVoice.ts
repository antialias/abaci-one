'use client'

/**
 * Number-line voice call hook — rebuilt on the shared voice framework.
 *
 * This hook wraps `useVoiceCall` from `@/lib/voice` and layers all the
 * number-line domain logic on top: conference calls, transfers,
 * explorations, games, story evolution, player identification, etc.
 *
 * The shared framework handles: WebRTC, audio, microphone, ring tone,
 * mode management, timer, data channel routing, and cleanup.
 *
 * This file handles: domain-specific tool dispatch (returning ToolCallResult),
 * conference/speaker state, transfer logic, exploration narration,
 * game state, session history, and the domain-specific public API.
 */

import { useCallback, useRef, useState, useMemo } from 'react'
import { useVoiceCall } from '@/lib/voice/useVoiceCall'
import type { VoiceSessionConfig, ToolCallResult, CallState as BaseCallState, UseVoiceCallReturn } from '@/lib/voice/types'
import { sendSystemMessage as sendSystemMessageHelper } from '@/lib/voice/toolCallHelpers'
import type { GeneratedScenario, TranscriptEntry } from './generateScenario'
import type { ChildProfile } from './childProfile'
import { EXPLORATION_IDS, CONSTANT_IDS } from './explorationRegistry'
import { GAME_MAP } from './gameRegistry'
import { resolveMode, type ModeId, type ModeContext, type SessionActivity } from './sessionModes'

export type CallState = BaseCallState | 'transferring'

// ── Levenshtein fuzzy matching for identify_caller ──────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[n]
}

function fuzzyMatchPlayer(
  input: string,
  players: Array<{ id: string; name: string; emoji: string }>
): { id: string; name: string } | null {
  if (players.length === 0) return null
  const norm = input.toLowerCase().trim()
  if (!norm) return null
  const exact = players.find((p) => p.name.toLowerCase() === norm)
  if (exact) return exact
  const prefixMatches = players.filter((p) => p.name.toLowerCase().startsWith(norm))
  if (prefixMatches.length === 1) return prefixMatches[0]
  let bestDist = Infinity
  let bestPlayer: { id: string; name: string } | null = null
  for (const p of players) {
    const dist = levenshtein(norm, p.name.toLowerCase())
    if (dist < bestDist) {
      bestDist = dist
      bestPlayer = p
    }
  }
  if (bestPlayer) {
    const maxLen = Math.max(norm.length, bestPlayer.name.length)
    if (bestDist <= Math.ceil(maxLen * 0.4)) return bestPlayer
  }
  return null
}

/** A single mode transition recorded for debug overlay. */
export interface ModeTransition {
  from: ModeId | 'idle'
  to: ModeId
  action: string
  timestamp: number
  tools: string[]
}

/** Debug info exposed to the UI for the voice state machine overlay. */
export interface ModeDebugInfo {
  current: ModeId
  previous: ModeId | null
  transitions: ModeTransition[]
}

/** A record of a completed call, preserved across calls within a session. */
interface CallRecord {
  number: number
  conferenceNumbers: number[]
  transcripts: TranscriptEntry[]
  scenario: GeneratedScenario | null
  timestamp: number
}

function formatCallHistory(history: CallRecord[], currentNumber: number): string {
  const lines: string[] = [
    '[System — The child has had previous conversations this session. Here is what happened:\n',
  ]
  for (const record of history.slice(-5)) {
    const isSelf = record.number === currentNumber
    const header = isSelf
      ? `=== Your earlier call (you are ${record.number}) ===`
      : `=== Child's call with Number ${record.number} ===`
    lines.push(header)
    const transcripts = record.transcripts.slice(-10)
    for (const t of transcripts) {
      const speaker = t.role === 'child' ? 'Child' : `Number ${record.number}`
      lines.push(`${speaker}: "${t.text}"`)
    }
    lines.push('')
  }
  const calledBefore = history.some((r) => r.number === currentNumber)
  if (calledBefore) {
    lines.push(
      'The child is calling you AGAIN. Greet them warmly — "Hey, you\'re back!" ' +
        'Pick up where you left off naturally. Reference what you discussed before. ' +
        'If they talked to other numbers, you may have heard about it on the number line.]'
    )
  } else {
    lines.push(
      "This is a new call to a number the child hasn't called before. " +
        'If the child mentions talking to other numbers, you may have heard about it on the number line.]'
    )
  }
  return lines.join('\n')
}

const BASE_TIMEOUT_MS = 2 * 60 * 1000
const EXTENSION_MS = 2 * 60 * 1000
const WARNING_BEFORE_END_MS = 15 * 1000
const HANG_UP_DELAY_MS = 2000
const TRANSFER_DELAY_MS = 1500

interface UseRealtimeVoiceOptions {
  onTransfer?: (targetNumber: number) => void
  onStartExploration?: (constantId: string) => void
  onPauseExploration?: () => void
  onResumeExploration?: () => void
  onSeekExploration?: (segmentIndex: number) => void
  onEndExploration?: () => void
  onLookAt?: (center: number, range: number) => void
  onIndicate?: (
    numbers: number[],
    range?: { from: number; to: number },
    durationSeconds?: number,
    persistent?: boolean
  ) => void
  onGameStart?: (gameId: string, params: Record<string, unknown>) => void
  onGameEnd?: (gameId: string) => void
  onSetLabelStyle?: (scale: number, minOpacity: number) => void
  isExplorationActiveRef?: React.RefObject<boolean>
  onPlayerIdentified?: (playerId: string) => void
}

interface DialOptions {
  recommendedExplorations?: string[]
  playerId?: string
  availablePlayers?: Array<{ id: string; name: string; emoji: string }>
}

interface UseRealtimeVoiceReturn {
  state: CallState
  error: string | null
  errorCode: string | null
  dial: (number: number, options?: DialOptions) => void
  profileFailed: boolean
  hangUp: () => void
  timeRemaining: number | null
  isSpeaking: boolean
  transferTarget: number | null
  conferenceNumbers: number[]
  currentSpeaker: number | null
  removeFromCall: (numberToRemove: number) => void
  sendSystemMessage: (text: string, promptResponse?: boolean) => void
  setNarrationPlaying: (playing: boolean) => void
  currentInstructions: string | null
  modeDebug: ModeDebugInfo
}

export function useRealtimeVoice(options?: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  // Stable refs for callbacks
  const onTransferRef = useRef(options?.onTransfer)
  onTransferRef.current = options?.onTransfer
  const onStartExplorationRef = useRef(options?.onStartExploration)
  onStartExplorationRef.current = options?.onStartExploration
  const onPauseExplorationRef = useRef(options?.onPauseExploration)
  onPauseExplorationRef.current = options?.onPauseExploration
  const onResumeExplorationRef = useRef(options?.onResumeExploration)
  onResumeExplorationRef.current = options?.onResumeExploration
  const onSeekExplorationRef = useRef(options?.onSeekExploration)
  onSeekExplorationRef.current = options?.onSeekExploration
  const onEndExplorationRef = useRef(options?.onEndExploration)
  onEndExplorationRef.current = options?.onEndExploration
  const onLookAtRef = useRef(options?.onLookAt)
  onLookAtRef.current = options?.onLookAt
  const onIndicateRef = useRef(options?.onIndicate)
  onIndicateRef.current = options?.onIndicate
  const onGameStartRef = useRef(options?.onGameStart)
  onGameStartRef.current = options?.onGameStart
  const onGameEndRef = useRef(options?.onGameEnd)
  onGameEndRef.current = options?.onGameEnd
  const onSetLabelStyleRef = useRef(options?.onSetLabelStyle)
  onSetLabelStyleRef.current = options?.onSetLabelStyle
  const onPlayerIdentifiedRef = useRef(options?.onPlayerIdentified)
  onPlayerIdentifiedRef.current = options?.onPlayerIdentified
  const isExplorationActiveRef = options?.isExplorationActiveRef

  // ── Domain-specific state ──
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const [profileFailed, setProfileFailed] = useState(false)
  const [conferenceNumbers, setConferenceNumbers] = useState<number[]>([])
  const conferenceNumbersRef = useRef<number[]>([])
  const [currentSpeaker, setCurrentSpeaker] = useState<number | null>(null)
  const currentSpeakerRef = useRef<number | null>(null)
  const pendingSpeakerRef = useRef<number | null>(null)
  const pendingSpeakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activePlayerIdRef = useRef<string | undefined>(undefined)
  const availablePlayersRef = useRef<Array<{ id: string; name: string; emoji: string }>>([])
  const activeGameIdRef = useRef<string | null>(null)
  const gameStateRef = useRef<unknown>(null)
  const sessionActivityRef = useRef<SessionActivity>({ gamesPlayed: [], explorationsLaunched: [] })
  const narrationPlayingRef = useRef(false)
  const lastResumeTimestampRef = useRef(0)
  const pendingExplorationRef = useRef<
    { type: 'start'; constantId: string } | { type: 'resume' } | null
  >(null)
  const responseCreatedMsRef = useRef(0)

  // Refs for voiceCall methods — set after hook is created (avoids circular dep with config)
  const extendTimerRef = useRef<(() => boolean) | null>(null)
  const voiceCallRef = useRef<UseVoiceCallReturn | null>(null)

  // Scenario + transcript + call state
  const childProfileRef = useRef<ChildProfile | undefined>(undefined)
  const profileFailedRef = useRef(false)
  const scenarioRef = useRef<GeneratedScenario | null>(null)
  const transcriptsRef = useRef<TranscriptEntry[]>([])
  const calledNumberRef = useRef<number>(0)
  const sessionHistoryRef = useRef<CallRecord[]>([])
  const extensionUsedRef = useRef(false) // Mirrors framework's extension state for ModeContext
  const windingDownRequestedRef = useRef(false)
  const goodbyeRequestedRef = useRef(false)
  const childHasSpokenRef = useRef(false)
  const familiarizingResponseCountRef = useRef(0)

  // Domain-specific call state (extends base CallState with 'transferring')
  const [domainState, setDomainState] = useState<'transferring' | null>(null)
  const transferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recommended explorations for the current dial
  const recommendedExplorationsRef = useRef<string[] | undefined>(undefined)

  const setPendingSpeaker = useCallback((speaker: number) => {
    pendingSpeakerRef.current = speaker
    if (pendingSpeakerTimerRef.current) clearTimeout(pendingSpeakerTimerRef.current)
    pendingSpeakerTimerRef.current = setTimeout(() => {
      pendingSpeakerTimerRef.current = null
      if (pendingSpeakerRef.current === speaker) {
        pendingSpeakerRef.current = null
        currentSpeakerRef.current = speaker
        setCurrentSpeaker(speaker)
      }
    }, 1000)
  }, [])

  /** Build a ModeContext from current refs. */
  const buildModeContext = useCallback(
    (): ModeContext => ({
      calledNumber: calledNumberRef.current,
      scenario: scenarioRef.current,
      childProfile: childProfileRef.current,
      profileFailed: profileFailedRef.current,
      conferenceNumbers: conferenceNumbersRef.current,
      currentSpeaker: currentSpeakerRef.current,
      activeGameId: activeGameIdRef.current,
      gameState: gameStateRef.current,
      availablePlayers: availablePlayersRef.current,
      currentInstructions: null,
      sessionActivity: sessionActivityRef.current,
      extensionAvailable: !extensionUsedRef.current,
    }),
    []
  )

  // ── Tool call handler ──
  // Returns ToolCallResult for each tool, or null for unhandled.
  // NOTE: Many number-line tools need direct data channel access for async patterns
  // (identify_caller, evolve_story). For these, we use the dc ref from the shared hook.
  const onToolCall = useCallback(
    (name: string, args: Record<string, unknown>, _ctx: ModeContext): ToolCallResult | null => {
      // request_more_time
      if (name === 'request_more_time') {
        const extended = extendTimerRef.current?.()
        if (!extended) {
          return { output: { success: false, error: 'No extension available.' } }
        }
        extensionUsedRef.current = true
        const shouldExitMode = windingDownRequestedRef.current
        windingDownRequestedRef.current = false
        return {
          output: {
            success: true,
            message:
              'Time extended. Do NOT mention this to the child — just keep the conversation going naturally.',
          },
          exitMode: shouldExitMode || undefined,
        }
      }

      // hang_up
      if (name === 'hang_up') {
        return { output: { success: true }, isHangUp: true }
      }

      // transfer_call
      if (name === 'transfer_call') {
        const targetNumber = Number(args.target_number)
        if (!isFinite(targetNumber)) {
          return { output: { success: false, error: 'Invalid number' } }
        }
        return {
          output: { success: true, message: `Transferring to ${targetNumber}` },
          isTransfer: true,
          transferTarget: targetNumber,
          promptResponse: false,
        }
      }

      // add_to_call (conference)
      if (name === 'add_to_call') {
        const raw = args.target_numbers
        if (!Array.isArray(raw) || raw.length === 0) {
          return { output: { success: false, error: 'Invalid target_numbers array' } }
        }
        const targetNumbers = raw.map((v: unknown) => Number(v)).filter(isFinite)
        if (targetNumbers.length === 0) {
          return { output: { success: false, error: 'Invalid target_numbers array' } }
        }

        const existing = new Set(conferenceNumbersRef.current)
        const newNumbers = targetNumbers.filter((n) => !existing.has(n))
        if (newNumbers.length === 0) {
          return { output: { success: true, message: 'All those numbers are already on the call!' } }
        }

        const updated = [...conferenceNumbersRef.current, ...newNumbers]
        conferenceNumbersRef.current = updated
        setConferenceNumbers(updated)
        setPendingSpeaker(newNumbers[0])
        currentSpeakerRef.current = newNumbers[0]

        return {
          output: { success: true, message: `${newNumbers.join(', ')} joined the call!` },
          enterMode: 'conference',
          promptResponse: false, // We'll prompt manually after injecting intro text
        }
      }

      // switch_speaker
      if (name === 'switch_speaker') {
        const targetNumber = Number(args.number)
        if (!isFinite(targetNumber)) {
          return { output: { success: false, error: 'Invalid number' } }
        }
        if (!conferenceNumbersRef.current.includes(targetNumber)) {
          return { output: { success: false, error: `${targetNumber} is not on the call` } }
        }
        setPendingSpeaker(targetNumber)
        currentSpeakerRef.current = targetNumber
        return { output: { success: true, now_speaking_as: targetNumber } }
      }

      // start_exploration
      if (name === 'start_exploration') {
        const constantId = String(args.constant_id)
        if (!EXPLORATION_IDS.has(constantId)) {
          return { output: { success: false, error: 'Invalid constant_id' } }
        }

        // Tour explorations — auto-hang-up
        if (!CONSTANT_IDS.has(constantId)) {
          onStartExplorationRef.current?.(constantId)
          return { output: { success: true }, isHangUp: true }
        }

        sessionActivityRef.current.explorationsLaunched.push(constantId)
        pendingExplorationRef.current = { type: 'start', constantId }
        return {
          output: {
            success: true,
            message: `Exploration of ${constantId} is ready but PAUSED. Give the child a brief intro — match their energy level — then call resume_exploration to start.`,
            companion_rules:
              'Once the animation is playing: a pre-recorded narrator tells the story. You stay SILENT during playback. ' +
              'You will receive context messages showing what the narrator is saying. ' +
              'If the child speaks, the animation pauses automatically — answer their question, then call resume_exploration. ' +
              'If the child seems disengaged, offer choices: keep watching, see a different one, or do something else. ' +
              'One brief reaction when it finishes, then move on. Do NOT narrate, announce segments, or repeat what the narrator says.',
          },
          enterMode: 'exploration',
        }
      }

      // pause_exploration
      if (name === 'pause_exploration') {
        narrationPlayingRef.current = false
        onPauseExplorationRef.current?.()
        return { output: { success: true, message: 'Exploration paused' } }
      }

      // resume_exploration
      if (name === 'resume_exploration') {
        pendingExplorationRef.current = { type: 'resume' }
        return {
          output: {
            success: true,
            message: 'Exploration resumed. The narrator is speaking now — stay completely silent until the child speaks or the exploration ends.',
          },
          promptResponse: false,
        }
      }

      // seek_exploration
      if (name === 'seek_exploration') {
        const segNum = Number(args.segment_number)
        if (!isFinite(segNum) || segNum < 1) {
          return { output: { success: false, error: 'Invalid segment_number' } }
        }
        onSeekExplorationRef.current?.(segNum - 1)
        return { output: { success: true, message: `Jumped to segment ${segNum} (paused)` } }
      }

      // end_exploration
      if (name === 'end_exploration') {
        narrationPlayingRef.current = false
        onEndExplorationRef.current?.()
        return {
          output: { success: true, message: "Exploration stopped. You're back in conversation mode — full tools available." },
          exitMode: true,
        }
      }

      // look_at
      if (name === 'look_at') {
        const center = Number(args.center)
        if (!isFinite(center)) {
          return { output: { success: false, error: 'Invalid center value' } }
        }
        const range = Number(args.range) || 20
        onLookAtRef.current?.(center, Math.abs(range))
        return { output: { success: true, message: `Looking at ${center} (range ${range})` } }
      }

      // evolve_story
      if (name === 'evolve_story') {
        if (!scenarioRef.current) {
          return { output: { success: false, error: 'No active scenario to evolve' } }
        }
        const recent = transcriptsRef.current.slice(-10)
        const asyncResult = fetch('/api/realtime/evolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: calledNumberRef.current,
            scenario: scenarioRef.current,
            recentTranscripts: recent,
            conferenceNumbers: conferenceNumbersRef.current,
          }),
        })
          .then((res) => res.ok ? res.json() : Promise.reject(new Error(`API error ${res.status}`)))
          .then((data) => {
            if (!data.evolution) {
              return {
                text: '[System: The story is flowing well — no twist needed right now. Keep going with the current thread.]',
              }
            }
            const { development, newTension, suggestion } = data.evolution
            return {
              text: `[System: Story evolution — Development: ${development}. New tension: ${newTension}. Suggestion: ${suggestion}. Weave this in naturally.]`,
            }
          })
        return {
          output: { success: true, message: 'Generating story evolution...' },
          asyncResult,
          promptResponse: false,
        }
      }

      // identify_caller
      if (name === 'identify_caller') {
        const inputName = args.name as string | undefined
        const inputId = args.player_id as string | undefined
        let playerId: string | undefined

        if (inputName && typeof inputName === 'string') {
          const match = fuzzyMatchPlayer(inputName, availablePlayersRef.current)
          if (!match) {
            return {
              output: {
                success: false,
                error: `No matching player found for "${inputName}". Known names: ${availablePlayersRef.current.map((p) => p.name).join(', ')}. Ask the child to repeat their name.`,
              },
            }
          }
          playerId = match.id
        } else if (inputId && typeof inputId === 'string') {
          playerId = inputId
        } else {
          return { output: { success: false, error: 'Pass the name you heard from the child.' } }
        }

        activePlayerIdRef.current = playerId

        const asyncResult = fetch('/api/realtime/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        })
          .then((res) => res.ok ? res.json() : Promise.reject(new Error(`API error ${res.status}`)))
          .then((data) => {
            if (data.failed || !data.profile) {
              return { text: "[System: Couldn't load their profile, but that's okay — continue naturally.]" }
            }
            const profile = data.profile as ChildProfile
            childProfileRef.current = profile
            const namePart = profile.name ? `This is ${profile.name}` : 'Identified the caller'
            const agePart = profile.age != null ? `, age ${profile.age}` : ''
            const focusPart = profile.currentFocus ? `. Currently learning: ${profile.currentFocus}` : ''
            onPlayerIdentifiedRef.current?.(playerId!)
            return {
              text: `[System: ${namePart}${agePart}${focusPart}. Personalize the conversation for them!]`,
            }
          })

        return {
          output: { success: true, message: 'Looking up the caller...' },
          asyncResult,
          promptResponse: false,
        }
      }

      // indicate
      if (name === 'indicate') {
        const numbers: number[] = Array.isArray(args.numbers)
          ? (args.numbers as unknown[]).filter((v) => typeof v === 'number' && isFinite(v as number)) as number[]
          : []
        let range: { from: number; to: number } | undefined
        if (args.range && typeof args.range === 'object') {
          const r = args.range as Record<string, unknown>
          if (isFinite(Number(r.from)) && isFinite(Number(r.to))) {
            range = { from: Number(r.from), to: Number(r.to) }
          }
        }
        if (numbers.length === 0 && !range) {
          return { output: { success: false, error: 'Must provide at least numbers (array) or range ({ from, to })' } }
        }
        const durationSeconds = typeof args.duration_seconds === 'number' && isFinite(args.duration_seconds) && args.duration_seconds > 0
          ? args.duration_seconds : undefined
        const persistent = args.persistent === true
        onIndicateRef.current?.(numbers, range, durationSeconds, persistent)
        return {
          output: {
            success: true,
            message: `Indicating ${numbers.length} numbers${range ? ` and range ${range.from}–${range.to}` : ''}${persistent ? ' (persistent)' : durationSeconds ? ` for ${durationSeconds}s` : ''}`,
          },
        }
      }

      // start_game
      if (name === 'start_game') {
        const gameId = String(args.game_id)
        const game = GAME_MAP.get(gameId)
        if (!game) {
          return { output: { success: false, error: `Unknown game: ${gameId}. Valid games: ${[...GAME_MAP.keys()].join(', ')}` } }
        }
        if (activeGameIdRef.current) {
          return { output: { success: false, error: `A game is already active (${activeGameIdRef.current}). End it first with end_game.` } }
        }
        const result = game.onStart?.(args as Record<string, unknown>) ?? { agentMessage: `${game.name} started!` }
        activeGameIdRef.current = gameId
        gameStateRef.current = result.state ?? null
        sessionActivityRef.current.gamesPlayed.push(gameId)
        onGameStartRef.current?.(gameId, args)
        if (result.indicate) {
          onIndicateRef.current?.(result.indicate.numbers, undefined, undefined, result.indicate.persistent)
        }
        return {
          output: { success: true, message: result.agentMessage },
          enterMode: 'game',
        }
      }

      // end_game
      if (name === 'end_game') {
        const gameId = activeGameIdRef.current
        if (!gameId) {
          return { output: { success: true, message: 'No game is currently active.' } }
        }
        const game = GAME_MAP.get(gameId)
        activeGameIdRef.current = null
        gameStateRef.current = null
        onGameEndRef.current?.(gameId)
        return {
          output: { success: true, message: `${game?.name ?? gameId} game ended.` },
          exitMode: true,
        }
      }

      // set_number_line_style
      if (name === 'set_number_line_style') {
        const scale = Math.max(0.5, Math.min(3,
          typeof args.label_scale === 'number' && isFinite(args.label_scale) ? args.label_scale : 1
        ))
        const minOpacity = Math.max(0, Math.min(1,
          typeof args.label_min_opacity === 'number' && isFinite(args.label_min_opacity) ? args.label_min_opacity : 0
        ))
        onSetLabelStyleRef.current?.(scale, minOpacity)
        return { output: { success: true, message: `Label style set: scale=${scale}, minOpacity=${minOpacity}` } }
      }

      // Game session tools (delegated to game handler)
      if (activeGameIdRef.current) {
        const game = GAME_MAP.get(activeGameIdRef.current)
        if (game?.onToolCall && game.sessionTools?.some((t) => t.name === name)) {
          try {
            const result = game.onToolCall(gameStateRef.current, name, args)
            gameStateRef.current = result.state
            if (result.indicate) {
              onIndicateRef.current?.(result.indicate.numbers, undefined, undefined, result.indicate.persistent)
            }
            return { output: { success: true, message: result.agentMessage } }
          } catch (err) {
            return { output: { success: false, error: err instanceof Error ? err.message : 'Game tool call failed' } }
          }
        }
      }

      return null // unhandled
    },
    [setPendingSpeaker]
  )

  const onResponseDone = useCallback(
    (_ctx: ModeContext, currentModeId: string): string | null => {
      if (currentModeId === 'answering' && childHasSpokenRef.current) {
        if (childProfileRef.current) {
          return 'default'
        }
        return 'familiarizing'
      }
      if (currentModeId === 'familiarizing') {
        familiarizingResponseCountRef.current++
        if (familiarizingResponseCountRef.current >= 4) {
          return 'default'
        }
      }
      return null
    },
    []
  )

  const onChildSpeech = useCallback((transcript: string) => {
    childHasSpokenRef.current = true
    const buf = transcriptsRef.current
    buf.push({ role: 'child', text: transcript })
    if (buf.length > 12) buf.shift()

    // Auto-pause exploration
    if (
      isExplorationActiveRef?.current &&
      Date.now() - lastResumeTimestampRef.current > 3000
    ) {
      narrationPlayingRef.current = false
      onPauseExplorationRef.current?.()
    }
  }, [isExplorationActiveRef])

  const onModelSpeech = useCallback((transcript: string) => {
    const buf = transcriptsRef.current
    buf.push({ role: 'number', text: transcript })
    if (buf.length > 12) buf.shift()
  }, [])

  // Build the modes map from the number-line session modes
  // We need to wrap them as VoiceMode<ModeContext>
  const modes = useMemo(() => {
    const modeIds: ModeId[] = [
      'answering', 'familiarizing', 'default', 'conference',
      'exploration', 'game', 'winding_down', 'hanging_up',
    ]
    const map: Record<string, { id: string; getInstructions: (ctx: ModeContext) => string; getTools: (ctx: ModeContext) => { type: 'function'; name: string; description: string; parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] } }[] }> = {}
    for (const id of modeIds) {
      map[id] = {
        id,
        getInstructions: (ctx: ModeContext) => resolveMode(id, ctx).instructions,
        getTools: (ctx: ModeContext) => resolveMode(id, ctx).tools,
      }
    }
    return map
  }, [])

  const config = useMemo((): VoiceSessionConfig<ModeContext> => ({
    sessionEndpoint: '/api/realtime/session',
    buildContext: buildModeContext,
    initialModeId: 'answering',
    modes,
    onToolCall,
    onResponseDone,
    onChildSpeech,
    onModelSpeech,
    getSessionBody: () => ({
      number: calledNumberRef.current,
      ...(activePlayerIdRef.current && { playerId: activePlayerIdRef.current }),
      ...(sessionHistoryRef.current.some((r) => r.number === calledNumberRef.current) && {
        previousScenario: sessionHistoryRef.current
          .filter((r) => r.number === calledNumberRef.current)
          .pop()?.scenario,
      }),
      ...(recommendedExplorationsRef.current?.length && {
        recommendedExplorations: recommendedExplorationsRef.current,
      }),
      ...(availablePlayersRef.current.length > 0 && {
        availablePlayers: availablePlayersRef.current,
      }),
    }),
    onSessionCreated: (data) => {
      scenarioRef.current = (data.scenario as GeneratedScenario) ?? null
      childProfileRef.current = (data.childProfile as ChildProfile) ?? undefined
      if (data.profileFailed) {
        setProfileFailed(true)
        profileFailedRef.current = true
      }
    },
    onSessionEstablished: (dc) => {
      const history = sessionHistoryRef.current
      if (history.length > 0) {
        const historyText = formatCallHistory(history, calledNumberRef.current)
        sendSystemMessageHelper(dc, historyText)
      }
      // Set conference state
      const num = calledNumberRef.current
      conferenceNumbersRef.current = [num]
      setConferenceNumbers([num])
      currentSpeakerRef.current = num
      setCurrentSpeaker(num)
    },
    timer: {
      baseDurationMs: BASE_TIMEOUT_MS,
      extensionMs: EXTENSION_MS,
      warningBeforeEndMs: WARNING_BEFORE_END_MS,
      hangUpDelayMs: HANG_UP_DELAY_MS,
    },
    onTimeWarning: (dc) => {
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: '[System: Only 15 seconds left. If the conversation is going well, silently call request_more_time. Otherwise give a gentle in-character hint that you might have to go soon — but do NOT mention timers, countdowns, or the time system directly.]',
            }],
          },
        })
      )
      dc.send(JSON.stringify({ type: 'response.create' }))
    },
    onTimeExpired: (dc) => {
      if (!windingDownRequestedRef.current) {
        windingDownRequestedRef.current = true
        // Enter winding_down mode
        dc.send(JSON.stringify({
          type: 'session.update',
          session: resolveMode('winding_down', buildModeContext()),
        }))
        dc.send(JSON.stringify({ type: 'response.create' }))
      } else if (!goodbyeRequestedRef.current) {
        goodbyeRequestedRef.current = true
        dc.send(JSON.stringify({
          type: 'session.update',
          session: resolveMode('hanging_up', buildModeContext()),
        }))
        dc.send(JSON.stringify({ type: 'response.create' }))
      }
      // Phase 3 handled by the framework (force hangup)
    },
    onResponseDoneRaw: (dc, msg, _currentModeId) => {
      const pending = pendingExplorationRef.current
      if (!pending) return
      pendingExplorationRef.current = null

      if (pending.type === 'start') {
        // Wait for agent audio to finish (sustained silence) before starting exploration
        const SUSTAINED_SILENCE_MS = 300
        const startedWaiting = Date.now()
        let silenceStartMs = voiceCallRef.current?.agentAudioPlayingRef.current ? 0 : Date.now()
        const waitForSilence = () => {
          if (Date.now() - startedWaiting > 3000) {
            onStartExplorationRef.current?.(pending.constantId)
            return
          }
          if (voiceCallRef.current?.agentAudioPlayingRef.current) {
            silenceStartMs = 0
            requestAnimationFrame(waitForSilence)
            return
          }
          if (silenceStartMs === 0) silenceStartMs = Date.now()
          if (Date.now() - silenceStartMs < SUSTAINED_SILENCE_MS) {
            requestAnimationFrame(waitForSilence)
            return
          }
          onStartExplorationRef.current?.(pending.constantId)
        }
        requestAnimationFrame(waitForSilence)
      } else if (pending.type === 'resume') {
        // Truncate agent's buffered audio so narrator takes over immediately
        const response = (msg as Record<string, unknown>).response as Record<string, unknown> | undefined
        const output = response?.output as Array<{ type: string; id?: string }> | undefined
        const audioItem = output?.find((item) => item.type === 'message')
        if (audioItem?.id) {
          const audioEndMs = Math.max(0, Date.now() - responseCreatedMsRef.current)
          dc.send(JSON.stringify({
            type: 'conversation.item.truncate',
            item_id: audioItem.id,
            content_index: 0,
            audio_end_ms: audioEndMs,
          }))
        }
        narrationPlayingRef.current = true
        if (voiceCallRef.current?.audioElRef.current) {
          voiceCallRef.current.audioElRef.current.volume = 0
        }
        lastResumeTimestampRef.current = Date.now()
        onResumeExplorationRef.current?.()
      }
    },
    onResponseCreated: (dc) => {
      // Track response creation time for audio truncation
      responseCreatedMsRef.current = Date.now()

      // During narration, cancel any VAD-triggered response
      if (narrationPlayingRef.current) {
        if (!isExplorationActiveRef?.current) {
          // Exploration ended — allow agent to speak
          narrationPlayingRef.current = false
          if (voiceCallRef.current?.audioElRef.current) {
            voiceCallRef.current.audioElRef.current.volume = 1
          }
        } else {
          dc.send(JSON.stringify({ type: 'response.cancel' }))
        }
      }
    },
    onTransfer: (targetNumber, cleanupFn, _redialFn) => {
      setTransferTarget(targetNumber)
      setDomainState('transferring')
      onTransferRef.current?.(targetNumber)

      transferTimerRef.current = setTimeout(() => {
        transferTimerRef.current = null
        cleanupFn()
        setTransferTarget(null)
        setDomainState(null)
        // Re-dial the new number (preserves playerId via activePlayerIdRef)
        calledNumberRef.current = targetNumber
        // Reset for new call
        windingDownRequestedRef.current = false
        goodbyeRequestedRef.current = false
        childHasSpokenRef.current = false
        familiarizingResponseCountRef.current = 0
        scenarioRef.current = null
        transcriptsRef.current = []
        voiceCallRef.current?.dial()
      }, TRANSFER_DELAY_MS)
    },
    suppressErrorCodes: [
      'response_cancel_not_active',
      'conversation_already_has_active_response',
      'item_truncation_failed',
      'invalid_value',
    ],
  }), [buildModeContext, modes, onToolCall, onResponseDone, onChildSpeech, onModelSpeech, isExplorationActiveRef])

  const voiceCall = useVoiceCall(config)

  // Store voiceCall in a ref for use in callbacks that can't directly reference it
  voiceCallRef.current = voiceCall

  // Wire up the extendTimer ref
  extendTimerRef.current = voiceCall.extendTimer

  // ── Domain-specific dial that accepts number + options ──
  const dial = useCallback(
    (number: number, dialOptions?: DialOptions) => {
      // Set refs before calling the framework's dial
      calledNumberRef.current = number
      if (dialOptions?.playerId !== undefined) {
        activePlayerIdRef.current = dialOptions.playerId
      }
      availablePlayersRef.current = dialOptions?.availablePlayers ?? []
      recommendedExplorationsRef.current = dialOptions?.recommendedExplorations

      // Reset domain state
      setProfileFailed(false)
      profileFailedRef.current = false
      extensionUsedRef.current = false
      windingDownRequestedRef.current = false
      goodbyeRequestedRef.current = false
      childHasSpokenRef.current = false
      familiarizingResponseCountRef.current = 0
      scenarioRef.current = null
      transcriptsRef.current = []
      setTransferTarget(null)
      setDomainState(null)

      voiceCall.dial()
    },
    [voiceCall]
  )

  const hangUp = useCallback(() => {
    // Save call record
    if (calledNumberRef.current && transcriptsRef.current.length > 0) {
      sessionHistoryRef.current.push({
        number: calledNumberRef.current,
        conferenceNumbers: [...conferenceNumbersRef.current],
        transcripts: [...transcriptsRef.current],
        scenario: scenarioRef.current ? { ...scenarioRef.current } : null,
        timestamp: Date.now(),
      })
    }
    // Clean up domain state
    conferenceNumbersRef.current = []
    setConferenceNumbers([])
    currentSpeakerRef.current = null
    setCurrentSpeaker(null)
    pendingSpeakerRef.current = null
    if (pendingSpeakerTimerRef.current) {
      clearTimeout(pendingSpeakerTimerRef.current)
      pendingSpeakerTimerRef.current = null
    }
    if (transferTimerRef.current) {
      clearTimeout(transferTimerRef.current)
      transferTimerRef.current = null
    }
    setTransferTarget(null)
    setDomainState(null)
    voiceCall.hangUp()
  }, [voiceCall])

  const removeFromCall = useCallback(
    (numberToRemove: number) => {
      const updated = conferenceNumbersRef.current.filter((n) => n !== numberToRemove)
      if (updated.length === 0) {
        hangUp()
        return
      }
      conferenceNumbersRef.current = updated
      setConferenceNumbers(updated)
      if (currentSpeakerRef.current === numberToRemove) {
        currentSpeakerRef.current = updated[0]
        setCurrentSpeaker(updated[0])
      }
      if (updated.length === 1) {
        voiceCall.enterMode('default', 'removeFromCall → solo')
      } else {
        voiceCall.updateSession('removeFromCall → conference')
      }
      voiceCall.sendSystemMessage(`[System: ${numberToRemove} has left the call.]`, true)
    },
    [hangUp, voiceCall]
  )

  const setNarrationPlaying = useCallback((playing: boolean) => {
    narrationPlayingRef.current = playing
    if (voiceCall.audioElRef.current) {
      voiceCall.audioElRef.current.volume = playing ? 0 : 1
    }
  }, [voiceCall.audioElRef])

  // Compute effective call state (overlay 'transferring' on base)
  const effectiveState: CallState = domainState === 'transferring' ? 'transferring' : voiceCall.state

  return {
    state: effectiveState,
    error: voiceCall.error,
    errorCode: voiceCall.errorCode,
    dial,
    hangUp,
    timeRemaining: voiceCall.timeRemaining,
    isSpeaking: voiceCall.isSpeaking,
    transferTarget,
    conferenceNumbers,
    currentSpeaker,
    removeFromCall,
    sendSystemMessage: voiceCall.sendSystemMessage,
    setNarrationPlaying,
    profileFailed,
    currentInstructions: voiceCall.currentInstructions,
    modeDebug: voiceCall.modeDebug as ModeDebugInfo,
  }
}
