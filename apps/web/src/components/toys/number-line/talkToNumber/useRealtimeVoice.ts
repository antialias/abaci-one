import { useCallback, useEffect, useRef, useState } from 'react'
import { playRingTone } from './ringTone'
import { generateNumberPersonality, generateConferencePrompt, getVoiceForNumber } from './generateNumberPersonality'
import type { GeneratedScenario, TranscriptEntry } from './generateScenario'
import type { ChildProfile } from './childProfile'
import { EXPLORATION_IDS, CONSTANT_IDS, EXPLORATION_DISPLAY } from './explorationRegistry'

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
  onIndicate?: (numbers: number[], range?: { from: number; to: number }, durationSeconds?: number) => void
  /** Called when the model starts a "find the number" game */
  onStartFindNumber?: (target: number) => void
  /** Called when the model stops the "find the number" game */
  onStopFindNumber?: () => void
  /** Ref that reports whether an exploration animation is currently active.
   *  When true, the call timer pauses the countdown (won't expire mid-video). */
  isExplorationActiveRef?: React.RefObject<boolean>
}

interface DialOptions {
  recommendedExplorations?: string[]
}

interface UseRealtimeVoiceReturn {
  state: CallState
  error: string | null
  /** Classifies the error for UI decisions (e.g. whether to show retry) */
  errorCode: string | null
  dial: (number: number, options?: DialOptions) => void
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
  const onStartFindNumberRef = useRef(options?.onStartFindNumber)
  onStartFindNumberRef.current = options?.onStartFindNumber
  const onStopFindNumberRef = useRef(options?.onStopFindNumber)
  onStopFindNumberRef.current = options?.onStopFindNumber
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
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const [conferenceNumbers, setConferenceNumbers] = useState<number[]>([])
  const conferenceNumbersRef = useRef<number[]>([])
  const [currentSpeaker, setCurrentSpeaker] = useState<number | null>(null)
  const currentSpeakerRef = useRef<number | null>(null)
  // Pending speaker: set by switch_speaker/add_to_call, committed when new audio starts.
  // Three commit triggers (first one wins): 1) response.audio_transcript.delta event,
  // 2) acoustic silence→speaking transition, 3) fallback timeout (1s).
  const pendingSpeakerRef = useRef<number | null>(null)
  const pendingSpeakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const dial = useCallback(async (number: number, options?: DialOptions) => {
    // Don't start a new call if one is in progress (allow from transferring state)
    const cur = stateRef.current as CallState
    if (cur !== 'idle' && cur !== 'error' && cur !== 'transferring') return

    setError(null)
    setErrorCode(null)
    extensionUsedRef.current = false
    warningSentRef.current = false
    goodbyeRequestedRef.current = false

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
          ...(previousScenario && { previousScenario }),
          ...(options?.recommendedExplorations?.length && {
            recommendedExplorations: options.recommendedExplorations,
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
            // response_cancel_not_active is harmless — we speculatively cancel
            // in-progress responses during exploration transitions, and sometimes
            // the response has already finished. Just log and continue.
            if (errCode === 'response_cancel_not_active') {
              console.log('[voice] response.cancel: no active response (harmless)')
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
            console.log('[exploration] %s — response_id: %s, pending: %s',
              msg.type, msg.response?.id, pendingExplorationRef.current ? JSON.stringify(pendingExplorationRef.current) : 'none')
          }

          // Execute deferred exploration actions once the agent finishes speaking.
          // Tool calls fire mid-response (audio still streaming), so we queue
          // start/resume actions here. On response.done we wait for actual client-side
          // audio silence (via the analyser node) before executing — response.done
          // means the server finished generating, but buffered audio may still be
          // playing through WebRTC.
          if (msg.type === 'response.done') {
            const pending = pendingExplorationRef.current
            console.log('[exploration] response.done — pending:', pending ? JSON.stringify(pending) : 'none', 'response_id:', msg.response?.id)
            if (pending) {
              pendingExplorationRef.current = null

              const executePending = () => {
                if (pending.type === 'start') {
                  console.log('[exploration] executing deferred start_exploration:', pending.constantId)
                  onStartExplorationRef.current?.(pending.constantId)
                } else if (pending.type === 'resume') {
                  console.log('[exploration] executing deferred resume_exploration — narration starts NOW')
                  lastResumeTimestampRef.current = Date.now()
                  onResumeExplorationRef.current?.()
                }
              }

              // If agent audio is still playing, poll until it stops
              if (agentAudioPlayingRef.current) {
                console.log('[exploration] agent audio still playing — waiting for silence')
                const startedWaiting = Date.now()
                const waitForSilence = () => {
                  // Safety timeout: don't wait more than 3s
                  if (Date.now() - startedWaiting > 3000) {
                    console.log('[exploration] silence wait timed out after 3s — executing anyway')
                    executePending()
                    return
                  }
                  if (agentAudioPlayingRef.current) {
                    requestAnimationFrame(waitForSilence)
                    return
                  }
                  console.log('[exploration] agent audio stopped — executing after %dms', Date.now() - startedWaiting)
                  executePending()
                }
                requestAnimationFrame(waitForSilence)
              } else {
                console.log('[exploration] agent audio already silent — executing immediately')
                executePending()
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
                onPauseExplorationRef.current?.()
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
              // but we can also just call it directly here
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
            dc.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: generateConferencePrompt(updated, newNumbers[0], childProfileRef.current),
              },
            }))

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
            console.log('[conference] switch_speaker: %d → %d (pending audio onset)', prevSpeaker, targetNumber)

            dc.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: generateConferencePrompt(allNumbers, targetNumber, childProfileRef.current),
              },
            }))
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

            // Branch: tour explorations require hanging up first
            if (!CONSTANT_IDS.has(constantId)) {
              const display = EXPLORATION_DISPLAY[constantId]
              const tourName = display?.name ?? constantId
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({
                    success: true,
                    message: `The ${tourName} tour is queued and will launch automatically after this call ends. ` +
                      `RIGHT NOW: Tell the child about the tour — what they'll see, why it's exciting. ` +
                      `Say a warm goodbye and invite them to call you back after watching it. ` +
                      `IMPORTANT: Do NOT call hang_up yet. Speak to the child FIRST in this response. ` +
                      `You will call hang_up in your NEXT turn, after the child has a chance to react.`,
                  }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              // Queue the tour to launch after hangup
              onStartExplorationRef.current?.(constantId)
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
            // Defer until agent finishes speaking (response.done) — the tool call
            // event fires while audio is still streaming, and we can't send
            // response.create until the current response completes.
            console.log('[exploration] start_exploration tool call — deferring until response.done, constantId:', constantId)
            pendingExplorationRef.current = { type: 'start', constantId }
          }

          // Handle pause/resume/seek exploration tools
          if (msg.name === 'pause_exploration') {
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
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: 'Exploration resumed. The narrator is speaking now — stay completely silent until the child speaks or the exploration ends.' }),
              },
            }))
            // Defer narration start until agent finishes speaking (response.done).
            // Do NOT send response.create — the narrator takes over and the agent
            // stays silent until the child speaks or the exploration finishes.
            console.log('[exploration] resume_exploration tool call — deferring until response.done')
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
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: `Indicating ${numbers.length} numbers${range ? ` and range ${range.from}–${range.to}` : ''}${durationSeconds ? ` for ${durationSeconds}s` : ''}` }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              onIndicateRef.current?.(numbers, range, durationSeconds)
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

          // Handle model calling start_find_number tool
          if (msg.name === 'start_find_number') {
            try {
              const args = JSON.parse(msg.arguments || '{}')
              const target = Number(args.target)
              if (!isFinite(target)) throw new Error('invalid target')
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: true, message: `Find-the-number game started! Target: ${target}. The child CANNOT see the target — they only see "Find the mystery number!" Give them verbal clues about the number's neighborhood and properties. RULES: 1) Say "higher numbers" or "lower numbers" for direction — NEVER say "left" or "right" (children confuse screen directions). 2) Instead of saying "zoom in", hint at the number's precision — e.g. "it has a decimal" or "think about what's between 3 and 4." 3) Give neighborhood hints: "it's between 20 and 30", "near a multiple of 5", "close to a number you already know." You will receive proximity updates with the child's visible range and distance.` }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
              onStartFindNumberRef.current?.(target)
            } catch {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: msg.call_id,
                  output: JSON.stringify({ success: false, error: 'Invalid target number' }),
                },
              }))
              dc.send(JSON.stringify({ type: 'response.create' }))
            }
          }

          // Handle model calling stop_find_number tool
          if (msg.name === 'stop_find_number') {
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: 'Find-the-number game stopped.' }),
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))
            onStopFindNumberRef.current?.()
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
              dcRef.current.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{
                    type: 'input_text',
                    text: '[System: Time is up. You MUST say a quick, warm goodbye to the child RIGHT NOW, then call the hang_up tool. Keep it to one sentence — "It was great talking to you, bye!" — then hang_up immediately.]',
                  }],
                },
              }))
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

      dc.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: generateNumberPersonality(soloNumber),
        },
      }))
    } else {
      // Update conference prompt for remaining numbers
      dc.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: generateConferencePrompt(updated, updated[0], childProfileRef.current),
        },
      }))
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

  return { state, error, errorCode, dial, hangUp, timeRemaining, isSpeaking, transferTarget, conferenceNumbers, currentSpeaker, removeFromCall, sendSystemMessage }
}
