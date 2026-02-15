import { useCallback, useEffect, useRef, useState } from 'react'
import { playRingTone } from './ringTone'
import { getVoiceForNumber } from './generateNumberPersonality'
import type { GeneratedScenario, TranscriptEntry } from './generateScenario'
import type { ChildProfile } from './childProfile'
import { EXPLORATION_IDS, CONSTANT_IDS, EXPLORATION_DISPLAY } from './explorationRegistry'
import { GAME_MAP } from './gameRegistry'
import { resolveMode, type ModeId, type ModeContext } from './sessionModes'

export type CallState = 'idle' | 'ringing' | 'active' | 'ending' | 'transferring' | 'error'

/** A record of a completed call, preserved across calls within a session. */
interface CallRecord {
  number: number
  conferenceNumbers: number[]
  transcripts: TranscriptEntry[]
  scenario: GeneratedScenario | null
  timestamp: number
}

/**
 * Format session call history for injection into a new call's conversation context.
 * Numbers that were previously called get full transcripts; the current number
 * gets flagged as "you" so the model knows to pick up where it left off.
 */
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

    // Include last 10 transcript entries per call to keep context manageable
    const transcripts = record.transcripts.slice(-10)
    for (const t of transcripts) {
      const speaker = t.role === 'child' ? 'Child' : `Number ${record.number}`
      lines.push(`${speaker}: "${t.text}"`)
    }
    lines.push('')
  }

  const calledBefore = history.some(r => r.number === currentNumber)
  if (calledBefore) {
    lines.push(
      'The child is calling you AGAIN. Greet them warmly — "Hey, you\'re back!" ' +
      'Pick up where you left off naturally. Reference what you discussed before. ' +
      'If they talked to other numbers, you may have heard about it on the number line.]'
    )
  } else {
    lines.push(
      'This is a new call to a number the child hasn\'t called before. ' +
      'If the child mentions talking to other numbers, you may have heard about it on the number line.]'
    )
  }

  return lines.join('\n')
}

const BASE_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes
const EXTENSION_MS = 2 * 60 * 1000 // +2 minutes
const WARNING_BEFORE_END_MS = 15 * 1000 // warn 15s before end
const HANG_UP_DELAY_MS = 2000 // show "Goodbye!" for 2s before closing
const TRANSFER_DELAY_MS = 1500 // show "Transferring..." before redialing

interface UseRealtimeVoiceOptions {
  /** Called when the model transfers the call to another number */
  onTransfer?: (targetNumber: number) => void
  /** Called when the model starts a constant exploration */
  onStartExploration?: (constantId: string) => void
  /** Called when the model pauses the exploration animation */
  onPauseExploration?: () => void
  /** Called when the model resumes the exploration animation */
  onResumeExploration?: () => void
  /** Called when the model seeks to a specific segment (0-indexed) */
  onSeekExploration?: (segmentIndex: number) => void
  /** Called when the model wants to pan/zoom the number line */
  onLookAt?: (center: number, range: number) => void
  /** Called when the model wants to highlight numbers/range on the number line */
  onIndicate?: (numbers: number[], range?: { from: number; to: number }, durationSeconds?: number, persistent?: boolean) => void
  /** Called when the model starts a game via start_game tool */
  onGameStart?: (gameId: string, params: Record<string, unknown>) => void
  /** Called when the model ends the current game via end_game tool */
  onGameEnd?: (gameId: string) => void
  /** Called when the model adjusts label style via set_number_line_style tool */
  onSetLabelStyle?: (scale: number, minOpacity: number) => void
  /** Ref that reports whether an exploration animation is currently active.
   *  When true, the call timer pauses the countdown (won't expire mid-video). */
  isExplorationActiveRef?: React.RefObject<boolean>
  /** Called when the agent identifies the caller mid-call via identify_caller tool */
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
  /** Classifies the error for UI decisions (e.g. whether to show retry) */
  errorCode: string | null
  dial: (number: number, options?: DialOptions) => void
  /** True when a playerId was provided but profile assembly failed server-side */
  profileFailed: boolean
  hangUp: () => void
  timeRemaining: number | null
  isSpeaking: boolean
  /** The number the call is being transferred to (only set during 'transferring' state) */
  transferTarget: number | null
  /** All numbers currently on the call (length > 1 means conference mode) */
  conferenceNumbers: number[]
  /** The number currently speaking (for visual indicator) */
  currentSpeaker: number | null
  /** Remove a single number from a conference call */
  removeFromCall: (numberToRemove: number) => void
  /** Send a system-level message to the voice agent (e.g. narration context).
   *  Set promptResponse=true to have the model speak after receiving it. */
  sendSystemMessage: (text: string, promptResponse?: boolean) => void
  /** Control narration muting. When true, the agent's audio output is muted
   *  (volume=0) so the user only hears the pre-recorded TTS narrator. Call with
   *  false to unmute (e.g. when the exploration finishes). */
  setNarrationPlaying: (playing: boolean) => void
  /** The current system instructions sent to the voice agent (for debug panel) */
  currentInstructions: string | null
}

export function useRealtimeVoice(options?: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
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
  // Track the currently active game ID and state (null when no game is running)
  const activeGameIdRef = useRef<string | null>(null)
  const gameStateRef = useRef<unknown>(null)
  const onPlayerIdentifiedRef = useRef(options?.onPlayerIdentified)
  onPlayerIdentifiedRef.current = options?.onPlayerIdentified
  const availablePlayersRef = useRef<Array<{ id: string; name: string; emoji: string }>>([])
  const isExplorationActiveRef = options?.isExplorationActiveRef
  // Cooldown: don't auto-pause exploration within N ms of a resume to prevent
  // TTS narration echo (mic picks up speaker audio) from immediately re-pausing.
  const lastResumeTimestampRef = useRef(0)
  // Pending exploration actions — deferred until agent finishes speaking.
  // response.function_call_arguments.done fires while audio is still streaming,
  // so we queue the action and execute it on response.done + audio silence.
  const pendingExplorationRef = useRef<{ type: 'start'; constantId: string } | { type: 'resume' } | null>(null)
  // Tracks whether the agent's audio is currently playing on the client.
  // Updated by the requestAnimationFrame audio-level loop, read by the
  // pending exploration executor to wait for actual silence.
  const agentAudioPlayingRef = useRef(false)
  // True while pre-recorded TTS narration is actively playing. When set, any
  // server-initiated response is immediately cancelled (prevents the server's
  // VAD from triggering agent speech when the mic picks up narrator audio).
  const narrationPlayingRef = useRef(false)
  // Timestamp of when the current response started generating — used to estimate
  // how much audio the client has played for conversation.item.truncate.
  const responseCreatedMsRef = useRef(0)

  // Helper: co-sets narrationPlayingRef AND mutes/unmutes the agent's audio
  // element. When narration is playing, the agent's voice is silenced at the
  // output level so the user only hears the pre-recorded TTS narrator.
  // The analyser (agentAudioPlayingRef) still sees the audio signal since it
  // taps the MediaStream directly, not the audio element.
  const setNarrationPlaying = useCallback((playing: boolean) => {
    narrationPlayingRef.current = playing
    if (audioElRef.current) {
      audioElRef.current.volume = playing ? 0 : 1
      console.log('[exploration] agent audio %s (narration %s)', playing ? 'muted' : 'unmuted', playing ? 'playing' : 'stopped')
    }
  }, [])
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const [profileFailed, setProfileFailed] = useState(false)
  const [currentInstructions, setCurrentInstructions] = useState<string | null>(null)
  const [conferenceNumbers, setConferenceNumbers] = useState<number[]>([])
  const conferenceNumbersRef = useRef<number[]>([])
  const [currentSpeaker, setCurrentSpeaker] = useState<number | null>(null)
  const currentSpeakerRef = useRef<number | null>(null)
  // Pending speaker: set by switch_speaker/add_to_call, committed when new audio starts.
  // Three commit triggers (first one wins): 1) response.audio_transcript.delta event,
  // 2) acoustic silence→speaking transition, 3) fallback timeout (1s).
  const pendingSpeakerRef = useRef<number | null>(null)
  const pendingSpeakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Active playerId — preserved across transfers and retries
  const activePlayerIdRef = useRef<string | undefined>(undefined)

  // Session mode state machine
  const activeModeRef = useRef<ModeId>('answering')
  const previousModeRef = useRef<ModeId | null>(null)
  const currentInstructionsRef = useRef<string | null>(null)
  const familiarizingResponseCountRef = useRef(0)
  const profileFailedRef = useRef(false)

  // Refs for cleanup
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const ringRef = useRef<{ stop: () => void } | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micGainRef = useRef<GainNode | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineRef = useRef<number>(0)
  const extensionUsedRef = useRef(false)
  const warningSentRef = useRef(false)
  const goodbyeRequestedRef = useRef(false)
  const hangUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef<CallState>('idle')

  // Scenario + transcript state
  const childProfileRef = useRef<ChildProfile | undefined>(undefined)
  const scenarioRef = useRef<GeneratedScenario | null>(null)
  const transcriptsRef = useRef<TranscriptEntry[]>([]) // ring buffer, last 12
  const calledNumberRef = useRef<number>(0)

  // Session history — persists across calls (NOT cleared by cleanup)
  const sessionHistoryRef = useRef<CallRecord[]>([])

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const cleanup = useCallback(() => {
    // Save call record to session history before clearing refs
    if (calledNumberRef.current && transcriptsRef.current.length > 0) {
      sessionHistoryRef.current.push({
        number: calledNumberRef.current,
        conferenceNumbers: [...conferenceNumbersRef.current],
        transcripts: [...transcriptsRef.current],
        scenario: scenarioRef.current ? { ...scenarioRef.current } : null,
        timestamp: Date.now(),
      })
    }

    // Cancel pending hang-up timer
    if (hangUpTimerRef.current) {
      clearTimeout(hangUpTimerRef.current)
      hangUpTimerRef.current = null
    }

    // Stop ring tone
    ringRef.current?.stop()
    ringRef.current = null

    // Close data channel
    if (dcRef.current) {
      try { dcRef.current.close() } catch { /* ignore */ }
      dcRef.current = null
    }

    // Close peer connection
    if (pcRef.current) {
      try { pcRef.current.close() } catch { /* ignore */ }
      pcRef.current = null
    }

    // Disconnect mic gain node
    micGainRef.current = null

    // Stop mic stream (releases mic permission)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    // Stop audio playback
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.srcObject = null
      audioElRef.current = null
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setTimeRemaining(null)
    setIsSpeaking(false)
    setConferenceNumbers([])
    conferenceNumbersRef.current = []
    setCurrentSpeaker(null)
    currentSpeakerRef.current = null
    pendingSpeakerRef.current = null
    if (pendingSpeakerTimerRef.current) {
      clearTimeout(pendingSpeakerTimerRef.current)
      pendingSpeakerTimerRef.current = null
    }

    scenarioRef.current = null
    transcriptsRef.current = []
    goodbyeRequestedRef.current = false
    setCurrentInstructions(null)
    activeModeRef.current = 'answering'
    previousModeRef.current = null
    familiarizingResponseCountRef.current = 0
    profileFailedRef.current = false
    currentInstructionsRef.current = null
  }, [])

  /** Queue a speaker switch — committed on audio onset, transcript delta, or 1s timeout. */
  const setPendingSpeaker = useCallback((speaker: number) => {
    pendingSpeakerRef.current = speaker
    if (pendingSpeakerTimerRef.current) clearTimeout(pendingSpeakerTimerRef.current)
    pendingSpeakerTimerRef.current = setTimeout(() => {
      pendingSpeakerTimerRef.current = null
      if (pendingSpeakerRef.current === speaker) {
        pendingSpeakerRef.current = null
        currentSpeakerRef.current = speaker
        setCurrentSpeaker(speaker)
        console.log('[conference] speaker indicator committed: %d (timeout fallback)', speaker)
      }
    }, 1000)
  }, [])

  const hangUp = useCallback(() => {
    cleanup()
    setState('idle')
    setError(null)
    setErrorCode(null)
  }, [cleanup])

  /** Build a ModeContext from current refs for mode resolution. */
  const buildModeContext = useCallback((): ModeContext => ({
    calledNumber: calledNumberRef.current,
    scenario: scenarioRef.current,
    childProfile: childProfileRef.current,
    profileFailed: profileFailedRef.current,
    conferenceNumbers: conferenceNumbersRef.current,
    currentSpeaker: currentSpeakerRef.current,
    activeGameId: activeGameIdRef.current,
    gameState: gameStateRef.current,
    availablePlayers: availablePlayersRef.current,
    currentInstructions: currentInstructionsRef.current,
  }), [])

  /** Send a session.update with instructions AND tools for a mode, tracked for debug. */
  const updateSession = useCallback((dc: RTCDataChannel, modeId?: ModeId) => {
    const targetMode = modeId ?? activeModeRef.current
    const ctx = buildModeContext()
    const { instructions, tools } = resolveMode(targetMode, ctx)
    dc.send(JSON.stringify({ type: 'session.update', session: { instructions, tools } }))
    setCurrentInstructions(instructions)
    currentInstructionsRef.current = instructions
    if (modeId) activeModeRef.current = modeId
  }, [buildModeContext])

  /** Push a new mode onto the stack (saves previous for exitMode). */
  const enterMode = useCallback((dc: RTCDataChannel, newMode: ModeId, savePrevious = true) => {
    if (savePrevious && activeModeRef.current !== newMode) {
      previousModeRef.current = activeModeRef.current
    }
    updateSession(dc, newMode)
  }, [updateSession])

  /** Pop back to the previous mode (or default if none saved). */
  const exitMode = useCallback((dc: RTCDataChannel) => {
    const prev = previousModeRef.current ?? 'default'
    previousModeRef.current = null
    updateSession(dc, prev)
  }, [updateSession])

  const dial = useCallback(async (number: number, options?: DialOptions) => {
    // Don't start a new call if one is in progress (allow from transferring state)
    const cur = stateRef.current as CallState
    if (cur !== 'idle' && cur !== 'error' && cur !== 'transferring') return

    setError(null)
    setErrorCode(null)
    setProfileFailed(false)
    profileFailedRef.current = false
    activeModeRef.current = 'answering'
    previousModeRef.current = null
    familiarizingResponseCountRef.current = 0
    extensionUsedRef.current = false
    warningSentRef.current = false
    goodbyeRequestedRef.current = false
    // Persist playerId for transfers/retries
    if (options?.playerId !== undefined) {
      activePlayerIdRef.current = options.playerId
    }
    // Store available players for mid-call identification
    availablePlayersRef.current = options?.availablePlayers ?? []

    // 1. Get microphone permission
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
    } catch (err) {
      const isDenied = err instanceof DOMException && err.name === 'NotAllowedError'
      setError(
        isDenied
          ? 'Microphone access denied. Please allow microphone access to talk to numbers!'
          : 'Could not access microphone.'
      )
      setErrorCode(isDenied ? 'mic_denied' : 'mic_error')
      setState('error')
      return
    }

    // 2. Start ringing
    setState('ringing')

    // Play ring tone
    const ringStartedAt = Date.now()
    try {
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      ringRef.current = playRingTone(audioCtx)
    } catch {
      // Ring tone is cosmetic — ignore failures
    }

    // 3. Fetch ephemeral token (includes scenario generation — may take several seconds)
    // If we've called this number before, reuse its scenario so the story continues
    const priorCalls = sessionHistoryRef.current.filter(r => r.number === number)
    const previousScenario = priorCalls.length > 0
      ? priorCalls[priorCalls.length - 1].scenario
      : null

    let clientSecret: string
    try {
      const res = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number,
          ...(activePlayerIdRef.current && { playerId: activePlayerIdRef.current }),
          ...(previousScenario && { previousScenario }),
          ...(options?.recommendedExplorations?.length && {
            recommendedExplorations: options.recommendedExplorations,
          }),
          ...(availablePlayersRef.current.length > 0 && {
            availablePlayers: availablePlayersRef.current,
          }),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        const apiError = new Error(data.error || `Server error: ${res.status}`)
        ;(apiError as Error & { code?: string }).code = data.code || undefined
        throw apiError
      }
      const data = await res.json()
      clientSecret = data.clientSecret
      // Store scenario and child profile
      scenarioRef.current = data.scenario ?? null
      childProfileRef.current = data.childProfile ?? undefined
      calledNumberRef.current = number
      if (data.instructions) {
        setCurrentInstructions(data.instructions)
        currentInstructionsRef.current = data.instructions
      }
      if (data.profileFailed) {
        setProfileFailed(true)
        profileFailedRef.current = true
      }
      if (data.scenario) {
        console.log('[voice] scenario for %d: %s', number, data.scenario.archetype)
      }
    } catch (err) {
      cleanup()
      if (err instanceof Error) console.error('[voice] session error:', err.message)
      // API route errors already have friendly messages; raw fetch failures need translation
      const msg = err instanceof Error ? err.message : ''
      const isFetchFailure = !msg || msg === 'Failed to fetch' || msg.startsWith('NetworkError')
      setError(isFetchFailure ? `Couldn't reach ${number}. Check your internet and try again!` : msg)
      setErrorCode((err as Error & { code?: string }).code || 'session_error')
      setState('error')
      return
    }

    // Check if user hung up during token fetch
    if ((stateRef.current as CallState) !== 'ringing') {
      cleanup()
      return
    }

    // 4. Establish WebRTC connection
    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // Route mic through a GainNode for soft echo suppression.
      // Instead of hard-muting the mic while the model speaks, we reduce
      // gain to ~15% — enough to suppress echo while still allowing the
      // child to barge in / interrupt with their actual voice.
      const audioCtx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = audioCtx
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {})
      }
      const micSource = audioCtx.createMediaStreamSource(stream)
      const micGain = audioCtx.createGain()
      micGain.gain.value = 1.0
      const micDest = audioCtx.createMediaStreamDestination()
      micSource.connect(micGain)
      micGain.connect(micDest)
      micGainRef.current = micGain
      const processedStream = micDest.stream

      // Add processed mic track (routed through gain node, not raw mic)
      processedStream.getAudioTracks().forEach(track => pc.addTrack(track, processedStream))

      // Create audio element for remote audio
      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioElRef.current = audioEl

      audioEl.onerror = () => console.error('[voice] audio playback error', audioEl.error)

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0]

        // Explicit play() — autoplay may be blocked if the user-gesture
        // context expired during async setup (token fetch, SDP exchange).
        audioEl.play().catch((err) => {
          console.error('[voice] audio play failed:', err.name, err.message)
        })

        // Simple speaking detection via audio activity
        try {
          const audioCtx = audioCtxRef.current ?? new AudioContext()
          audioCtxRef.current = audioCtx
          // Resume AudioContext if suspended (autoplay policy)
          if (audioCtx.state === 'suspended') {
            audioCtx.resume()
          }
          const source = audioCtx.createMediaStreamSource(event.streams[0])
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          // Soft echo gate: attenuate (not mute) mic while model outputs audio.
          // Reduces gain to ~15% so echo is suppressed but the child can still
          // barge in / interrupt. Full gain restores after ~250ms of model silence.
          let modelSilenceSince = 0
          let micAttenuated = false
          let wasSpeaking = false
          const MIC_RESTORE_DELAY_MS = 250
          const ATTENUATED_GAIN = 0.15
          const FULL_GAIN = 1.0

          const checkSpeaking = () => {
            const st = stateRef.current
            // Stop the loop on terminal states
            if (st === 'idle' || st === 'error' || st === 'ending') return

            // Only analyse audio once active (keep loop alive during ringing)
            if (st === 'active') {
              analyser.getByteFrequencyData(dataArray)
              let sum = 0
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
              const avg = sum / dataArray.length
              const nowSpeaking = avg > 15
              setIsSpeaking(nowSpeaking)
              agentAudioPlayingRef.current = nowSpeaking

              // Commit pending speaker on audio onset (silence → speaking transition).
              // This ensures the visual indicator switches only when the NEW character's
              // audio actually starts playing, not when the tool call fires (which can
              // happen while the previous character's audio is still in the buffer).
              if (nowSpeaking && !wasSpeaking && pendingSpeakerRef.current !== null) {
                const ps = pendingSpeakerRef.current
                pendingSpeakerRef.current = null
                if (pendingSpeakerTimerRef.current) {
                  clearTimeout(pendingSpeakerTimerRef.current)
                  pendingSpeakerTimerRef.current = null
                }
                currentSpeakerRef.current = ps
                setCurrentSpeaker(ps)
                console.log('[conference] speaker indicator committed: %d (audio onset)', ps)
              }
              wasSpeaking = nowSpeaking

              // Soft echo gate: reduce/restore mic gain based on model audio
              const gain = micGainRef.current
              if (gain) {
                const now = performance.now()
                if (nowSpeaking) {
                  // Model is outputting audio → attenuate mic to suppress echo
                  modelSilenceSince = 0
                  if (!micAttenuated) {
                    gain.gain.setTargetAtTime(ATTENUATED_GAIN, audioCtx.currentTime, 0.02)
                    micAttenuated = true
                  }
                } else {
                  // Model silent — restore full gain after brief delay
                  if (micAttenuated) {
                    if (modelSilenceSince === 0) modelSilenceSince = now
                    if (now - modelSilenceSince > MIC_RESTORE_DELAY_MS) {
                      gain.gain.setTargetAtTime(FULL_GAIN, audioCtx.currentTime, 0.05)
                      micAttenuated = false
                    }
                  }
                }
              }

            }
            requestAnimationFrame(checkSpeaking)
          }
          requestAnimationFrame(checkSpeaking)
        } catch {
          // Speaking detection is non-critical
        }
      }

      // Create data channel for Realtime API events
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onclose = () => {
        // Data channel closed unexpectedly (HMR, network, server timeout).
        // Only trigger hangUp if we're still in an active-ish state;
        // if we're already idle/ending, cleanup already happened.
        const st = stateRef.current
        if (st === 'ringing' || st === 'active') {
          hangUp()
        }
      }

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'session.created') {
            // Inject session history so the number remembers prior conversations
            const history = sessionHistoryRef.current
            if (history.length > 0) {
              const historyText = formatCallHistory(history, number)
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{ type: 'input_text', text: historyText }],
                },
              }))
              console.log('[conference] injected %d prior call records', history.length)
            }

            // Prompt the model to speak first (like answering a phone call)
            dc.send(JSON.stringify({ type: 'response.create' }))
          }
          if (msg.type === 'error') {
            const errCode = msg.error?.code || msg.error?.type || 'unknown'
            // These errors are harmless during exploration transitions:
            // - response_cancel_not_active: we speculatively cancel responses
            // - conversation_already_has_active_response: auto-pause sends
            //   response.create which may race with a VAD-triggered response
            // - item_truncation_failed: truncate target already processed / doesn't exist
            // - invalid_value: truncate audio_end_ms > actual audio length (audio
            //   already finished playing — the mute handles it instead)
            if (errCode === 'response_cancel_not_active' || errCode === 'conversation_already_has_active_response' || errCode === 'item_truncation_failed' || errCode === 'invalid_value') {
              console.log('[voice] %s (harmless, exploration transition)', errCode)
              return
            }
            console.error('[voice] server error:', JSON.stringify(msg.error))
            const isQuota = /insufficient_quota|quota_exceeded|billing/i.test(errCode)
            const isRateLimit = /rate_limit/i.test(errCode)
            cleanup()
            if (isQuota) {
              setError('Phone calls are taking a break right now. Try again later!')
              setErrorCode('quota_exceeded')
            } else if (isRateLimit) {
              setError(`${number} is busy right now. Try again in a moment!`)
              setErrorCode('rate_limited')
            } else {
              setError(msg.error?.message || 'Something went wrong during the call.')
              setErrorCode(errCode)
            }
            setState('error')
            return
          }

          // Log response lifecycle for exploration debugging
          if (msg.type === 'response.created' || msg.type === 'response.done') {
            console.log('[exploration] %s — response_id: %s, pending: %s, narrationPlaying: %s',
              msg.type, msg.response?.id,
              pendingExplorationRef.current ? JSON.stringify(pendingExplorationRef.current) : 'none',
              narrationPlayingRef.current)
          }

          // Track when current response started — used to estimate playback
          // position for conversation.item.truncate (audio cutoff).
          if (msg.type === 'response.created') {
            responseCreatedMsRef.current = Date.now()
          }

          // Suppress agent speech during narration playback. The mic picks up
          // the TTS narrator audio, server VAD interprets it as user speech, and
          // auto-creates a response. Cancel it immediately.
          // Also clear the flag if the exploration is no longer active (finished).
          if (msg.type === 'response.created' && narrationPlayingRef.current) {
            if (!isExplorationActiveRef?.current) {
              // Exploration ended — allow the agent to speak (completion check-in)
              console.log('[exploration] narration flag cleared — exploration no longer active')
              setNarrationPlaying(false)
              // Exit exploration mode back to previous mode
              if (activeModeRef.current === 'exploration') {
                exitMode(dc)
              }
            } else {
              console.log('[exploration] cancelling response %s — narration is playing', msg.response?.id)
              dc.send(JSON.stringify({ type: 'response.cancel' }))
            }
          }

          // Execute deferred exploration actions once the agent finishes speaking.
          // Tool calls fire mid-response (audio still streaming), so we queue
          // start/resume actions here and execute on response.done.
          //
          // start_exploration: wait for sustained silence so the intro plays out.
          // resume_exploration: truncate buffered audio immediately via
          //   conversation.item.truncate — this is the API's built-in mechanism
          //   for interrupting the agent (same as a user interruption via VAD).
          if (msg.type === 'response.done') {
            const pending = pendingExplorationRef.current
            console.log('[exploration] response.done — pending:', pending ? JSON.stringify(pending) : 'none', 'response_id:', msg.response?.id)
            if (pending) {
              pendingExplorationRef.current = null

              if (pending.type === 'start') {
                // For start: wait for the agent's intro to finish playing
                const executeStart = () => {
                  console.log('[exploration] executing deferred start_exploration:', pending.constantId)
                  onStartExplorationRef.current?.(pending.constantId)
                }
                const SUSTAINED_SILENCE_MS = 300
                console.log('[exploration] waiting for %dms sustained silence before executing start', SUSTAINED_SILENCE_MS)
                const startedWaiting = Date.now()
                let silenceStartMs = agentAudioPlayingRef.current ? 0 : Date.now()
                const waitForSilence = () => {
                  if (Date.now() - startedWaiting > 3000) {
                    console.log('[exploration] silence wait timed out after 3s — executing anyway')
                    executeStart()
                    return
                  }
                  if (agentAudioPlayingRef.current) {
                    silenceStartMs = 0
                    requestAnimationFrame(waitForSilence)
                    return
                  }
                  if (silenceStartMs === 0) silenceStartMs = Date.now()
                  if (Date.now() - silenceStartMs < SUSTAINED_SILENCE_MS) {
                    requestAnimationFrame(waitForSilence)
                    return
                  }
                  console.log('[exploration] sustained silence confirmed — executing start after %dms', Date.now() - startedWaiting)
                  executeStart()
                }
                requestAnimationFrame(waitForSilence)

              } else if (pending.type === 'resume') {
                // For resume: truncate buffered audio so the agent shuts up
                // immediately, then start narration. conversation.item.truncate
                // is the same mechanism the server uses when VAD detects user
                // speech — it stops audio playback, trims the transcript, and
                // updates the model's context. The call stays alive.
                const audioItem = msg.response?.output?.find(
                  (item: { type: string }) => item.type === 'message'
                )
                if (audioItem?.id) {
                  // Estimate how much audio the client has already played:
                  // elapsed time since response.created ≈ real-time playback.
                  const audioEndMs = Math.max(0, Date.now() - responseCreatedMsRef.current)
                  console.log('[exploration] truncating audio item %s at %dms — cutting off agent speech', audioItem.id, audioEndMs)
                  dc.send(JSON.stringify({
                    type: 'conversation.item.truncate',
                    item_id: audioItem.id,
                    content_index: 0,
                    audio_end_ms: audioEndMs,
                  }))
                } else {
                  console.log('[exploration] no audio item found in response to truncate')
                }
                // Execute immediately — truncation handles the audio cutoff.
                // Mute the agent's audio output so the user only hears the TTS narrator.
                console.log('[exploration] executing resume_exploration — narration starts NOW')
                setNarrationPlaying(true)
                lastResumeTimestampRef.current = Date.now()
                onResumeExplorationRef.current?.()
              }
            }

            // ── Mode transitions on response.done ──
            const modeBeforeTransition = activeModeRef.current
            if (modeBeforeTransition === 'answering') {
              if (childProfileRef.current) {
                // Profile pre-loaded — skip familiarizing, go straight to default
                enterMode(dc, 'default', false)
              } else {
                enterMode(dc, 'familiarizing', false)
              }
            } else if (modeBeforeTransition === 'familiarizing') {
              familiarizingResponseCountRef.current++
              if (familiarizingResponseCountRef.current >= 4) {
                // Auto-transition: agent gave up on identification or it wasn't needed
                enterMode(dc, 'default', false)
              }
            }
          }

          // Collect transcripts for evolve_story tool (both sides)
          if (msg.type === 'response.audio_transcript.done') {
            if (msg.transcript) {
              const buf = transcriptsRef.current
              buf.push({ role: 'number', text: msg.transcript })
              if (buf.length > 12) buf.shift()
            }
          }

          // Commit pending speaker when new response audio starts generating.
          // This is more reliable than acoustic silence→speaking detection since
          // WebRTC may bridge audio gaps, preventing the transition from being seen.
          if (msg.type === 'response.audio_transcript.delta' && pendingSpeakerRef.current !== null) {
            const ps = pendingSpeakerRef.current
            pendingSpeakerRef.current = null
            if (pendingSpeakerTimerRef.current) {
              clearTimeout(pendingSpeakerTimerRef.current)
              pendingSpeakerTimerRef.current = null
            }
            currentSpeakerRef.current = ps
            setCurrentSpeaker(ps)
            console.log('[conference] speaker indicator committed: %d (transcript delta)', ps)
          }
          if (msg.type === 'conversation.item.input_audio_transcription.completed') {
            if (msg.transcript) {
              const buf = transcriptsRef.current
              buf.push({ role: 'child', text: msg.transcript })
              if (buf.length > 12) buf.shift()

              // Auto-pause exploration when the child speaks — instant and reliable
              // rather than depending on the agent calling pause_exploration via prompt.
              // Cooldown: skip if exploration just resumed — TTS narration audio can leak
              // through the mic and get transcribed as "child speech", causing an
              // immediate re-pause. 3s is enough for echo to settle.
              if (isExplorationActiveRef?.current && Date.now() - lastResumeTimestampRef.current > 3000) {
                console.log('[exploration] auto-pause: child spoke during narration')
                setNarrationPlaying(false)  // unmute agent so it can answer
                onPauseExplorationRef.current?.()
                // The VAD-triggered response was likely cancelled (narration was
                // playing). Send response.create so the agent can answer the kid.
                dc.send(JSON.stringify({ type: 'response.create' }))
              }
            }
          }

          // Log all tool calls for debugging conference flow
          if (msg.type === 'response.function_call_arguments.done') {
            console.log('[conference] tool call: %s, args: %s, speaker: %s, conference: %s',
              msg.name, msg.arguments?.slice(0, 80), currentSpeakerRef.current, conferenceNumbersRef.current.join(','))
          }

          // --- Tool call handling ---
          if (msg.type !== 'response.function_call_arguments.done') return

          // Session-mode game tool dispatch (e.g. remove_stones for Nim).
          // Checked FIRST so game tools don't fall through to built-in handlers.
          if (activeGameIdRef.current) {
            const game = GAME_MAP.get(activeGameIdRef.current)
            if (game?.onToolCall && game.sessionTools?.some(t => t.name === msg.name)) {
              try {
                const args = JSON.parse(msg.arguments || '{}')
                const result = game.onToolCall(gameStateRef.current, msg.name, args)
                gameStateRef.current = result.state
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: msg.call_id,
                    output: JSON.stringify({ success: true, message: result.agentMessage }),
                  },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
                if (result.indicate) {
                  onIndicateRef.current?.(result.indicate.numbers, undefined, undefined, result.indicate.persistent)
                }
              } catch (err) {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: msg.call_id,
                    output: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Game tool call failed' }),
                  },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              }
              return // Handled by game — don't fall through
            }
          }

          // Handle model calling request_more_time tool
          if (msg.name === 'request_more_time' && !extensionUsedRef.current) {
            extensionUsedRef.current = true
            deadlineRef.current += EXTENSION_MS
            warningSentRef.current = false

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: 'Time extended. Do NOT mention this to the child — just keep the conversation going naturally.' }),
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))
          }

          // Handle model calling hang_up tool — graceful goodbye
          if (msg.name === 'hang_up') {
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true }),
              },
            }))
            setState('ending')
            // Wait for the agent's audio to finish playing before tearing down.
            // The tool call fires while speech is still buffered/streaming, so a
            // fixed delay cuts the goodbye short. Instead, poll for silence and
            // then hold for HANG_UP_DELAY_MS so the child sees "Goodbye!".
            const MAX_WAIT_MS = 8000 // safety cap — don't wait forever
            const waitStart = Date.now()
            const waitForSilence = () => {
              const elapsed = Date.now() - waitStart
              if (agentAudioPlayingRef.current && elapsed < MAX_WAIT_MS) {
                // Still speaking — check again soon
                hangUpTimerRef.current = setTimeout(waitForSilence, 150)
              } else {
                // Silent (or timed out) — show "Goodbye!" then tear down
                hangUpTimerRef.current = setTimeout(() => {
                  hangUpTimerRef.current = null
                  cleanup()
                  setState('idle')
                }, HANG_UP_DELAY_MS)
              }
            }
            waitForSilence()
          }

          // Handle model calling transfer_call tool — hand off to another number
          if (msg.name === 'transfer_call') {
            let targetNumber: number
            try {
              const args = JSON.parse(msg.arguments || '{}')
              targetNumber = Number(args.target_number)
              if (!isFinite(targetNumber)) throw new Error('invalid')
            } catch {
              // Bad target — acknowledge but don't transfer
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid number' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: `Transferring to ${targetNumber}` }),
              },
            }))

            // Show transferring state, tear down, then dial the new number
            setTransferTarget(targetNumber)
            setState('transferring')
            onTransferRef.current?.(targetNumber)

            hangUpTimerRef.current = setTimeout(() => {
              hangUpTimerRef.current = null
              cleanup()
              setTransferTarget(null)
              // dial() will be called by the effect in NumberLine that watches transferTarget
              // but we can also just call it directly here — playerId preserved via activePlayerIdRef
              dial(targetNumber)
            }, TRANSFER_DELAY_MS)
          }

          // Handle model calling add_to_call tool — conference mode (batch)
          if (msg.name === 'add_to_call') {
            let targetNumbers: number[]
            try {
              const args = JSON.parse(msg.arguments || '{}')
              const raw = args.target_numbers
              if (!Array.isArray(raw) || raw.length === 0) throw new Error('invalid')
              targetNumbers = raw.map((v: unknown) => {
                const n = Number(v)
                if (!isFinite(n)) throw new Error('invalid')
                return n
              })
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid target_numbers array' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }

            // Dedupe: skip numbers already on the call
            const existing = new Set(conferenceNumbersRef.current)
            const newNumbers = targetNumbers.filter(n => !existing.has(n))

            if (newNumbers.length === 0) {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: 'All those numbers are already on the call!' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }

            // Add all new numbers to conference list
            const updated = [...conferenceNumbersRef.current, ...newNumbers]
            conferenceNumbersRef.current = updated
            setConferenceNumbers(updated)

            const joinedNames = newNumbers.join(', ')
            console.log('[conference] add_to_call: adding %s, all on call: %s', joinedNames, updated.join(', '))

            // Acknowledge the tool call
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: `${joinedNames} joined the call!` }),
              },
            }))

            // Defer speaker indicator to first new number — committed on audio onset.
            // NOTE: voice can't be changed mid-session (OpenAI Realtime API limitation),
            // so the model differentiates characters through speech patterns only.
            setPendingSpeaker(newNumbers[0])
            currentSpeakerRef.current = newNumbers[0]
            enterMode(dc, 'conference')

            // Prompt the model to greet as all new participants, using switch_speaker for each
            const existingNumbers = conferenceNumbersRef.current.filter(n => !newNumbers.includes(n))
            const introText = newNumbers.length === 1
              ? `[System: ${newNumbers[0]} just joined the conference call! You are now speaking as ${newNumbers[0]} — introduce yourself to the child. After that, use switch_speaker to let other numbers on the call welcome them.]`
              : `[System: ${joinedNames} just joined the conference call! You are now speaking as ${newNumbers[0]} — introduce yourself. After that, use switch_speaker for each other new number (${newNumbers.slice(1).join(', ')}) to introduce themselves, then switch_speaker for existing numbers (${existingNumbers.join(', ')}) to react. Each character gets 1-2 sentences max.]`

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [{
                  type: 'input_text',
                  text: introText,
                }],
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))
          }

          // Handle model calling switch_speaker tool — explicit character switch in conference
          if (msg.name === 'switch_speaker') {
            let targetNumber: number
            try {
              const args = JSON.parse(msg.arguments || '{}')
              targetNumber = Number(args.number)
              if (!isFinite(targetNumber)) throw new Error('invalid')
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid number' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }

            const allNumbers = conferenceNumbersRef.current
            if (!allNumbers.includes(targetNumber)) {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: `${targetNumber} is not on the call` }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }

            // Defer speaker indicator until new audio starts playing.
            // The model's previous character audio may still be in the WebRTC buffer,
            // so we queue the switch and commit it on the next silence→speaking transition.
            const prevSpeaker = currentSpeakerRef.current
            setPendingSpeaker(targetNumber)
            currentSpeakerRef.current = targetNumber  // Update ref for instructions (visual follows via pendingSpeaker)
            console.log('[conference] switch_speaker: %d → %d (pending audio onset)', prevSpeaker, targetNumber)

            updateSession(dc)
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, now_speaking_as: targetNumber }),
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))
          }

          // Handle model calling start_exploration tool — kick off a constant demo
          if (msg.name === 'start_exploration') {
            let constantId: string
            try {
              const args = JSON.parse(msg.arguments || '{}')
              constantId = String(args.constant_id)
              if (!EXPLORATION_IDS.has(constantId)) throw new Error('invalid')
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid constant_id' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }

            // Branch: tour explorations — auto-hang-up and launch the tour.
            // Don't give the agent another turn to speak (it rambles).
            if (!CONSTANT_IDS.has(constantId)) {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true }),
                },
              }))
              // Queue the tour, then immediately end the call
              onStartExplorationRef.current?.(constantId)
              setState('ending')
              hangUpTimerRef.current = setTimeout(() => {
                hangUpTimerRef.current = null
                cleanup()
                setState('idle')
              }, HANG_UP_DELAY_MS)
              return
            }

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({
                  success: true,
                  message: `Exploration of ${constantId} is ready but PAUSED. Give the child a brief intro — match their energy level — then call resume_exploration to start.`,
                  companion_rules: 'Once the animation is playing: a pre-recorded narrator tells the story. You stay SILENT during playback. ' +
                    'You will receive context messages showing what the narrator is saying. ' +
                    'If the child speaks, the animation pauses automatically — answer their question, then call resume_exploration. ' +
                    'If the child seems disengaged, offer choices: keep watching, see a different one, or do something else. ' +
                    'One brief reaction when it finishes, then move on. Do NOT narrate, announce segments, or repeat what the narrator says.',
                }),
              },
            }))
            // Enter exploration mode — restricted tools + focused instructions
            enterMode(dc, 'exploration')
            // Defer until agent finishes speaking (response.done) — the tool call
            // event fires while audio is still streaming, and we can't send
            // response.create until the current response completes.
            console.log('[exploration] start_exploration tool call — deferring until response.done, constantId:', constantId)
            pendingExplorationRef.current = { type: 'start', constantId }
          }

          // Handle pause/resume/seek exploration tools
          if (msg.name === 'pause_exploration') {
            setNarrationPlaying(false)
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: 'Exploration paused' }),
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))
            onPauseExplorationRef.current?.()
          }

          if (msg.name === 'resume_exploration') {
            // Cut off the agent's current speech immediately — it tends to keep
            // talking after calling resume (e.g. narrating what the child is about
            // to see). Cancel first, then send the tool output.
            dc.send(JSON.stringify({ type: 'response.cancel' }))

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: 'Exploration resumed. The narrator is speaking now — stay completely silent until the child speaks or the exploration ends.' }),
              },
            }))
            // Defer narration start until buffered audio finishes playing.
            // Do NOT send response.create — the narrator takes over.
            console.log('[exploration] resume_exploration tool call — cancelling speech + deferring until response.done')
            pendingExplorationRef.current = { type: 'resume' }
          }

          if (msg.name === 'seek_exploration') {
            try {
              const args = JSON.parse(msg.arguments || '{}')
              const segNum = Number(args.segment_number)
              if (!isFinite(segNum) || segNum < 1) throw new Error('invalid')
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: `Jumped to segment ${segNum} (paused)` }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              // Convert 1-indexed to 0-indexed for the callback
              onSeekExplorationRef.current?.(segNum - 1)
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid segment_number' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
            }
          }

          // Handle model calling look_at tool — pan/zoom the number line
          if (msg.name === 'look_at') {
            try {
              const args = JSON.parse(msg.arguments || '{}')
              const center = Number(args.center)
              if (!isFinite(center)) throw new Error('invalid center')
              const range = Number(args.range) || 20
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: `Looking at ${center} (range ${range})` }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              onLookAtRef.current?.(center, Math.abs(range))
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid center value' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
            }
          }

          // Handle model calling evolve_story tool — generate a story development on demand
          if (msg.name === 'evolve_story') {
            if (!scenarioRef.current) {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'No active scenario to evolve' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
            } else {
              const recent = transcriptsRef.current.slice(-10)

              // Fire async without blocking the message handler
              fetch('/api/realtime/evolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  number: calledNumberRef.current,
                  scenario: scenarioRef.current,
                  recentTranscripts: recent,
                  conferenceNumbers: conferenceNumbersRef.current,
                }),
              })
                .then(res => res.ok ? res.json() : Promise.reject(new Error(`API error ${res.status}`)))
                .then(data => {
                  if (!data.evolution) {
                    dc.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: msg.call_id,
                        output: JSON.stringify({ success: true, message: 'The story is flowing well — no twist needed right now. Keep going with the current thread.' }),
                      },
                    }))
                    dc.send(JSON.stringify({ type: 'response.create' }))
                    return
                  }

                  const { development, newTension, suggestion } = data.evolution
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: msg.call_id,
                      output: JSON.stringify({
                        success: true,
                        development,
                        newTension,
                        suggestion,
                        message: 'Weave this development into the conversation naturally. Do not dump it all at once — let it unfold.',
                      }),
                    },
                  }))
                  dc.send(JSON.stringify({ type: 'response.create' }))
                })
                .catch(err => {
                  console.warn('[voice] evolve_story failed', err)
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: msg.call_id,
                      output: JSON.stringify({ success: false, error: 'Could not generate evolution right now. Keep the conversation going on your own.' }),
                    },
                  }))
                  dc.send(JSON.stringify({ type: 'response.create' }))
                })
            }
          }

          // Handle model calling identify_caller tool — mid-call player identification
          if (msg.name === 'identify_caller') {
            let playerId: string
            try {
              const args = JSON.parse(msg.arguments || '{}')
              playerId = args.player_id
              if (typeof playerId !== 'string' || !playerId) throw new Error('invalid')
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid player_id' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }

            // Update active player immediately
            activePlayerIdRef.current = playerId

            // Async fetch profile and inject mid-call
            fetch('/api/realtime/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId }),
            })
              .then(res => res.ok ? res.json() : Promise.reject(new Error(`API error ${res.status}`)))
              .then(data => {
                if (data.failed || !data.profile) {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: msg.call_id,
                      output: JSON.stringify({ success: true, message: "Couldn't load their profile, but that's okay — continue the conversation naturally." }),
                    },
                  }))
                  dc.send(JSON.stringify({ type: 'response.create' }))
                  return
                }

                const profile = data.profile as ChildProfile
                childProfileRef.current = profile

                // Build a summary for the tool output
                const namePart = profile.name ? `This is ${profile.name}` : 'Identified the caller'
                const agePart = profile.age != null ? `, age ${profile.age}` : ''
                const focusPart = profile.currentFocus ? `. Currently learning: ${profile.currentFocus}` : ''

                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: msg.call_id,
                    output: JSON.stringify({
                      success: true,
                      message: `${namePart}${agePart}${focusPart}. Their full profile has been loaded — personalize the conversation for them!`,
                    }),
                  },
                }))

                // Update session with the profile — transition to default if still familiarizing
                if (activeModeRef.current === 'familiarizing') {
                  enterMode(dc, 'default', false)
                } else {
                  updateSession(dc) // Refresh current mode with new profile
                }

                dc.send(JSON.stringify({ type: 'response.create' }))

                // Notify UI
                onPlayerIdentifiedRef.current?.(playerId)
              })
              .catch(err => {
                console.warn('[voice] identify_caller profile fetch failed', err)
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: msg.call_id,
                    output: JSON.stringify({ success: true, message: "Couldn't load their profile right now. Continue the conversation naturally." }),
                  },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          }

          // Handle model calling indicate tool — highlight numbers/range on the number line
          if (msg.name === 'indicate') {
            try {
              const args = JSON.parse(msg.arguments || '{}')
              const numbers: number[] = Array.isArray(args.numbers)
                ? args.numbers.filter((v: unknown) => typeof v === 'number' && isFinite(v as number))
                : []
              let range: { from: number; to: number } | undefined
              if (args.range && typeof args.range === 'object' && isFinite(Number(args.range.from)) && isFinite(Number(args.range.to))) {
                range = { from: Number(args.range.from), to: Number(args.range.to) }
              }
              if (numbers.length === 0 && !range) throw new Error('must provide numbers or range')
              const durationSeconds = typeof args.duration_seconds === 'number' && isFinite(args.duration_seconds) && args.duration_seconds > 0
                ? args.duration_seconds
                : undefined
              const persistent = args.persistent === true
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: `Indicating ${numbers.length} numbers${range ? ` and range ${range.from}–${range.to}` : ''}${persistent ? ' (persistent)' : durationSeconds ? ` for ${durationSeconds}s` : ''}` }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              onIndicateRef.current?.(numbers, range, durationSeconds, persistent)
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Must provide at least numbers (array) or range ({ from, to })' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
            }
          }

          // Handle model calling start_game tool — generic game dispatcher
          if (msg.name === 'start_game') {
            try {
              const args = JSON.parse(msg.arguments || '{}')
              const gameId = String(args.game_id)
              const game = GAME_MAP.get(gameId)
              if (!game) {
                throw new Error(`Unknown game: ${gameId}. Valid games: ${[...GAME_MAP.keys()].join(', ')}`)
              }
              if (activeGameIdRef.current) {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: msg.call_id,
                    output: JSON.stringify({ success: false, error: `A game is already active (${activeGameIdRef.current}). End it first with end_game.` }),
                  },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
                return
              }
              // Validate & get agent message via game's onStart
              const result = game.onStart?.(args) ?? { agentMessage: `${game.name} started!` }
              activeGameIdRef.current = gameId
              gameStateRef.current = result.state ?? null
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: result.agentMessage }),
                },
              }))
              enterMode(dc, 'game')  // Switch to game mode with focused instructions + tools
              dc.send(JSON.stringify({ type: 'response.create' }))
              onGameStartRef.current?.(gameId, args)
              // Auto-indicate initial game state (e.g. Nim shows all stones)
              if (result.indicate) {
                onIndicateRef.current?.(result.indicate.numbers, undefined, undefined, result.indicate.persistent)
              }
            } catch (err) {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Invalid game parameters' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
            }
          }

          // Handle model calling end_game tool — generic game end
          if (msg.name === 'end_game') {
            const gameId = activeGameIdRef.current
            if (!gameId) {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: 'No game is currently active.' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              return
            }
            const game = GAME_MAP.get(gameId)
            activeGameIdRef.current = null
            gameStateRef.current = null
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: `${game?.name ?? gameId} game ended.` }),
              },
            }))
            exitMode(dc)  // Restore previous mode (default or conference)
            dc.send(JSON.stringify({ type: 'response.create' }))
            onGameEndRef.current?.(gameId)
          }

          // Handle model calling set_number_line_style tool — adjust label visibility
          if (msg.name === 'set_number_line_style') {
            try {
              const args = JSON.parse(msg.arguments || '{}')
              const scale = Math.max(0.5, Math.min(3, typeof args.label_scale === 'number' && isFinite(args.label_scale) ? args.label_scale : 1))
              const minOpacity = Math.max(0, Math.min(1, typeof args.label_min_opacity === 'number' && isFinite(args.label_min_opacity) ? args.label_min_opacity : 0))
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: `Label style set: scale=${scale}, minOpacity=${minOpacity}` }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              onSetLabelStyleRef.current?.(scale, minOpacity)
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid parameters for set_number_line_style' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Create offer and send to OpenAI Realtime API
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      )

      if (!sdpResponse.ok) {
        console.error('[voice] WebRTC SDP exchange failed:', sdpResponse.status)
        throw new Error(`${number} couldn't pick up the phone. Try calling again!`)
      }

      const answerSdp = await sdpResponse.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      // Ensure minimum ring time (1.5s) — scenario generation may have already
      // used most of this, so we only wait the remainder.
      const MIN_RING_MS = 1500
      const elapsed = Date.now() - ringStartedAt
      if (elapsed < MIN_RING_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_RING_MS - elapsed))
      }

      // Check if still ringing (user might have hung up)
      if ((stateRef.current as CallState) !== 'ringing') {
        cleanup()
        return
      }

      // Stop ring tone
      ringRef.current?.stop()
      ringRef.current = null

      // Go active
      console.log('[conference] call active — number: %d, voice: %s', number, getVoiceForNumber(number))
      setState('active')
      conferenceNumbersRef.current = [number]
      setConferenceNumbers([number])
      currentSpeakerRef.current = number
      setCurrentSpeaker(number)

      deadlineRef.current = Date.now() + BASE_TIMEOUT_MS

      // Start countdown timer
      timerRef.current = setInterval(() => {
        // Freeze the countdown while an exploration is playing — push deadline
        // forward so the call doesn't expire mid-video.
        if (isExplorationActiveRef?.current) {
          deadlineRef.current = Math.max(deadlineRef.current, Date.now() + WARNING_BEFORE_END_MS + 5000)
          warningSentRef.current = false
        }

        const remaining = Math.max(0, deadlineRef.current - Date.now())
        setTimeRemaining(Math.ceil(remaining / 1000))

        // Send warning when time is running low
        if (
          !warningSentRef.current &&
          remaining < WARNING_BEFORE_END_MS &&
          remaining > 0 &&
          dcRef.current?.readyState === 'open'
        ) {
          warningSentRef.current = true
          dcRef.current.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{
                type: 'input_text',
                text: '[System: Only 15 seconds left. If the conversation is going well, silently call request_more_time. Otherwise give a gentle in-character hint that you might have to go soon — but do NOT mention timers, countdowns, or the time system directly.]',
              }],
            },
          }))
          dcRef.current.send(JSON.stringify({ type: 'response.create' }))
        }

        // Time's up — request a graceful goodbye instead of cutting the line
        if (remaining <= 0) {
          if (!goodbyeRequestedRef.current) {
            // First expiry: ask the model to say goodbye
            goodbyeRequestedRef.current = true

            if (dcRef.current?.readyState === 'open') {
              // Enter hanging_up mode — focused goodbye instructions + only hang_up tool
              enterMode(dcRef.current, 'hanging_up', false)
              dcRef.current.send(JSON.stringify({ type: 'response.create' }))
            }

            // Give the model a 10s grace period to say goodbye
            deadlineRef.current = Date.now() + 10_000
          } else {
            // Grace period exhausted — force hangup
            hangUp()
          }
        }
      }, 1000)

      // Handle connection closure
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          hangUp()
        }
      }
    } catch (err) {
      cleanup()
      if (err instanceof Error) console.error('[voice] connection error:', err.message)
      setError(err instanceof Error ? err.message : `${number} couldn't pick up the phone. Try calling again!`)
      setErrorCode('connection_error')
      setState('error')
    }
  }, [cleanup, hangUp])

  const sendSystemMessage = useCallback((text: string, promptResponse = false) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    console.log('[exploration] sendSystemMessage — promptResponse:', promptResponse, 'text:', text.slice(0, 80) + '...')
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }))
    if (promptResponse) {
      console.log('[exploration] sending response.create')
      dc.send(JSON.stringify({ type: 'response.create' }))
    }
  }, [])

  const removeFromCall = useCallback((numberToRemove: number) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return

    const updated = conferenceNumbersRef.current.filter(n => n !== numberToRemove)

    if (updated.length === 0) {
      hangUp()
      return
    }

    // Update conference list
    conferenceNumbersRef.current = updated
    setConferenceNumbers(updated)

    // Clean up voice assignment


    // If the removed number was the current speaker, switch to first remaining
    if (currentSpeakerRef.current === numberToRemove) {
      currentSpeakerRef.current = updated[0]
      setCurrentSpeaker(updated[0])
    }

    if (updated.length === 1) {
      // Revert to single-call mode
      const soloNumber = updated[0]
      currentSpeakerRef.current = soloNumber
      setCurrentSpeaker(soloNumber)

      enterMode(dc, 'default', false)
    } else {
      // Update conference prompt for remaining numbers
      updateSession(dc)
    }

    // Notify the model that someone left
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: `[System: ${numberToRemove} has left the call.]`,
        }],
      },
    }))
    dc.send(JSON.stringify({ type: 'response.create' }))
  }, [hangUp])

  // Detect orphaned state after HMR: state survived hot reload but
  // WebRTC resources (refs) were destroyed by the unmount/remount cycle.
  // Reset to idle so the UI doesn't show a phantom call.
  useEffect(() => {
    if (state !== 'idle' && state !== 'error' && !pcRef.current) {
      setState('idle')
      setError(null)
      setErrorCode(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return { state, error, errorCode, dial, hangUp, timeRemaining, isSpeaking, transferTarget, conferenceNumbers, currentSpeaker, removeFromCall, sendSystemMessage, setNarrationPlaying, profileFailed, currentInstructions }
}
