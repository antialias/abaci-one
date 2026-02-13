import { useCallback, useEffect, useRef, useState } from 'react'
import { playRingTone } from './ringTone'
import { generateNumberPersonality, generateConferencePrompt, getVoiceForNumber, assignUniqueVoice } from './generateNumberPersonality'

export type CallState = 'idle' | 'ringing' | 'active' | 'ending' | 'transferring' | 'error'

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
  /** Ref that reports whether an exploration animation is currently active.
   *  When true, the call timer pauses the countdown (won't expire mid-video). */
  isExplorationActiveRef?: React.RefObject<boolean>
}

interface UseRealtimeVoiceReturn {
  state: CallState
  error: string | null
  dial: (number: number) => void
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
  const isExplorationActiveRef = options?.isExplorationActiveRef
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const [conferenceNumbers, setConferenceNumbers] = useState<number[]>([])
  const conferenceNumbersRef = useRef<number[]>([])
  const [currentSpeaker, setCurrentSpeaker] = useState<number | null>(null)
  const currentSpeakerRef = useRef<number | null>(null)

  // Voice rotation state for conference calls
  const voiceAssignmentsRef = useRef<Map<number, string>>(new Map())
  const rotationRef = useRef<{
    speakerQueue: number[]   // remaining characters to speak this round
    isRotating: boolean       // are we in the middle of rotation?
    hadToolCall: boolean      // did this response contain a tool call?
  }>({ speakerQueue: [], isRotating: false, hadToolCall: false })

  // Refs for cleanup
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const ringRef = useRef<{ stop: () => void } | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineRef = useRef<number>(0)
  const extensionUsedRef = useRef(false)
  const warningSentRef = useRef(false)
  const hangUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef<CallState>('idle')

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const cleanup = useCallback(() => {
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

    // Stop mic stream
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
    voiceAssignmentsRef.current.clear()
    rotationRef.current = { speakerQueue: [], isRotating: false, hadToolCall: false }
  }, [])

  const hangUp = useCallback(() => {
    cleanup()
    setState('idle')
    setError(null)
  }, [cleanup])

  const dial = useCallback(async (number: number) => {
    // Don't start a new call if one is in progress (allow from transferring state)
    const cur = stateRef.current as CallState
    if (cur !== 'idle' && cur !== 'error' && cur !== 'transferring') {
      console.log('[voice] dial() rejected — state is', cur, '(expected idle/error/transferring)')
      return
    }

    setError(null)
    extensionUsedRef.current = false
    warningSentRef.current = false

    // 1. Get microphone permission
    console.log('[voice] dial(%d) — requesting mic with echo cancellation', number)
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
      // Log actual constraints the browser applied
      const micTrack = stream.getAudioTracks()[0]
      if (micTrack) {
        const settings = micTrack.getSettings()
        console.log('[voice] mic track settings:', {
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
          deviceId: settings.deviceId,
          sampleRate: settings.sampleRate,
        })
      }
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access to talk to numbers!'
          : 'Could not access microphone.'
      )
      setState('error')
      return
    }

    // 2. Start ringing
    setState('ringing')

    // Play ring tone
    try {
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      console.log('[voice] AudioContext created, state:', audioCtx.state, 'sampleRate:', audioCtx.sampleRate)
      ringRef.current = playRingTone(audioCtx)
    } catch (err) {
      console.warn('[voice] ring tone failed:', err)
    }

    // 3. Fetch ephemeral token
    let clientSecret: string
    try {
      const res = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        throw new Error(data.error || `Server error: ${res.status}`)
      }
      const data = await res.json()
      clientSecret = data.clientSecret
    } catch (err) {
      cleanup()
      setError(err instanceof Error ? err.message : 'Failed to connect')
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

      // Add mic track
      stream.getAudioTracks().forEach(track => {
        console.log('[voice] adding mic track to PC:', track.label, 'enabled:', track.enabled, 'muted:', track.muted)
        pc.addTrack(track, stream)
      })

      // Create audio element for remote audio
      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioElRef.current = audioEl

      // Log audio element state changes
      audioEl.onplay = () => console.log('[voice] audioEl: play event')
      audioEl.onpause = () => console.log('[voice] audioEl: pause event')
      audioEl.onplaying = () => console.log('[voice] audioEl: playing event')
      audioEl.onwaiting = () => console.log('[voice] audioEl: waiting event')
      audioEl.onstalled = () => console.log('[voice] audioEl: stalled event')
      audioEl.onerror = () => console.error('[voice] audioEl: error event', audioEl.error)

      pc.ontrack = (event) => {
        console.log('[voice] ontrack fired — streams:', event.streams.length, 'track kind:', event.track.kind, 'readyState:', event.track.readyState)
        audioEl.srcObject = event.streams[0]
        console.log('[voice] audioEl.srcObject set, autoplay:', audioEl.autoplay, 'paused:', audioEl.paused, 'readyState:', audioEl.readyState)

        // Explicit play() — autoplay may be blocked if the user-gesture
        // context expired during async setup (token fetch, SDP exchange).
        audioEl.play().then(() => {
          console.log('[voice] audioEl.play() succeeded, paused:', audioEl.paused)
        }).catch((err) => {
          console.error('[voice] audioEl.play() FAILED:', err.name, err.message)
        })

        // Simple speaking detection via audio activity
        try {
          const audioCtx = audioCtxRef.current ?? new AudioContext()
          audioCtxRef.current = audioCtx
          console.log('[voice] ontrack AudioContext state:', audioCtx.state)
          // Resume AudioContext if suspended (autoplay policy)
          if (audioCtx.state === 'suspended') {
            console.log('[voice] AudioContext suspended — resuming...')
            audioCtx.resume().then(() => {
              console.log('[voice] AudioContext resumed, state:', audioCtx.state)
            })
          }
          const source = audioCtx.createMediaStreamSource(event.streams[0])
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          let speakingLogTimer = 0
          // Software echo gate: mute mic while model outputs audio so the
          // speaker sound doesn't feed back and trigger speech_started.
          // The mic unmutes after ~250ms of silence for responsive barge-in.
          let modelSilenceSince = 0
          let micMuted = false
          const MIC_UNMUTE_DELAY_MS = 250 // keep mic muted briefly after model stops

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

              // Software echo gate: mute/unmute mic track based on model audio
              const micTrack = streamRef.current?.getAudioTracks()[0]
              if (micTrack) {
                const now = performance.now()
                if (nowSpeaking) {
                  // Model is outputting audio → mute mic to prevent echo
                  modelSilenceSince = 0
                  if (!micMuted) {
                    micTrack.enabled = false
                    micMuted = true
                    console.log('[voice] 🔇 mic MUTED (model speaking, echo gate)')
                  }
                } else {
                  // Model silent — start/continue unmute delay
                  if (micMuted) {
                    if (modelSilenceSince === 0) modelSilenceSince = now
                    if (now - modelSilenceSince > MIC_UNMUTE_DELAY_MS) {
                      micTrack.enabled = true
                      micMuted = false
                      console.log('[voice] 🔊 mic UNMUTED (model silent)')
                    }
                  }
                }
              }

              // Periodic log of audio levels (every ~0.5s = 30 frames)
              speakingLogTimer++
              if (speakingLogTimer % 30 === 0) {
                const micTrackState = streamRef.current?.getAudioTracks()[0]
                console.log('[voice] 📊 avg:', avg.toFixed(1), 'modelSpeaking:', nowSpeaking, 'micMuted:', micMuted, 'mic.enabled:', micTrackState?.enabled, 'mic.muted:', micTrackState?.muted)
              }
            }
            requestAnimationFrame(checkSpeaking)
          }
          requestAnimationFrame(checkSpeaking)
        } catch (err) {
          console.warn('[voice] speaking detection setup failed:', err)
        }
      }

      // Log WebRTC connection state transitions
      pc.oniceconnectionstatechange = () => {
        console.log('[voice] ICE connection state:', pc.iceConnectionState)
      }
      pc.onsignalingstatechange = () => {
        console.log('[voice] signaling state:', pc.signalingState)
      }

      // Create data channel for Realtime API events
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onopen = () => {
        console.log('[voice] data channel opened')
        // Log mic track state at connection time
        const micTrack = streamRef.current?.getAudioTracks()[0]
        console.log('[voice] mic at dc open — enabled:', micTrack?.enabled, 'muted:', micTrack?.muted, 'readyState:', micTrack?.readyState)
      }
      dc.onclose = () => console.log('[voice] data channel closed')

      // Helper: switch voice and prompt next speaker in rotation
      const promptNextSpeaker = () => {
        const rot = rotationRef.current
        const allNumbers = conferenceNumbersRef.current
        if (rot.speakerQueue.length === 0 || allNumbers.length <= 1) {
          // Rotation complete — switch voice back to first character (who responds to user next)
          rot.isRotating = false
          currentSpeakerRef.current = allNumbers[0] ?? null
          setCurrentSpeaker(allNumbers[0] ?? null)
          console.log('[voice] rotation complete, currentSpeaker →', allNumbers[0] ?? null)
          const firstVoice = voiceAssignmentsRef.current.get(allNumbers[0])
          if (firstVoice) {
            dc.send(JSON.stringify({
              type: 'session.update',
              session: {
                voice: firstVoice,
                instructions: generateConferencePrompt(allNumbers, allNumbers[0]),
              },
            }))
          }
          return
        }

        const nextSpeaker = rot.speakerQueue.shift()!
        currentSpeakerRef.current = nextSpeaker
        setCurrentSpeaker(nextSpeaker)
        console.log('[voice] rotation next, currentSpeaker →', nextSpeaker, 'remaining queue:', [...rot.speakerQueue])
        const nextVoice = voiceAssignmentsRef.current.get(nextSpeaker)

        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: nextVoice,
            instructions: generateConferencePrompt(allNumbers, nextSpeaker),
          },
        }))
        dc.send(JSON.stringify({ type: 'response.create' }))
      }

      // Track mic mute state at the dc.onmessage level so we can log it
      let dcMicMuted = false
      const getMicEnabled = () => streamRef.current?.getAudioTracks()[0]?.enabled ?? 'N/A'

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          // --- Log ALL event types for debugging ---
          const quietEvents = new Set([
            'response.audio.delta',           // very frequent audio chunks
            'response.audio_transcript.delta', // frequent transcript deltas
          ])
          if (!quietEvents.has(msg.type)) {
            console.log('[voice] DC event:', msg.type, 'mic.enabled:', getMicEnabled())
          }

          // --- Debug: log session lifecycle with full config ---
          if (msg.type === 'session.created') {
            const td = msg.session?.turn_detection
            console.log('[voice] ✅ session.created — turn_detection:', JSON.stringify(td))
          }
          if (msg.type === 'session.updated') {
            const td = msg.session?.turn_detection
            console.log('[voice] session.updated — turn_detection:', JSON.stringify(td))
          }
          if (msg.type === 'error') {
            console.error('[voice] ⚠️ server error:', JSON.stringify(msg.error))
          }

          // --- Debug: log transcript completions with speaker info ---
          if (msg.type === 'response.audio_transcript.done') {
            console.log('[voice] transcript done (currentSpeaker=%s):', currentSpeakerRef.current, msg.transcript)
          }

          // --- Track tool calls within a response ---
          if (msg.type === 'response.function_call_arguments.done') {
            rotationRef.current.hadToolCall = true
          }

          // --- User started speaking: abort rotation ---
          if (msg.type === 'input_audio_buffer.speech_started') {
            console.log('[voice] ⚡ speech_started — mic.enabled:', getMicEnabled(), 'audioEl.paused:', audioElRef.current?.paused, 'audioEl.readyState:', audioElRef.current?.readyState)
            const rot = rotationRef.current
            if (rot.isRotating) {
              rot.speakerQueue = []
              rot.isRotating = false
              // Voice stays on whoever was last set — they'll respond to the user
            }
          }
          if (msg.type === 'input_audio_buffer.speech_stopped') {
            console.log('[voice] 🔇 speech_stopped — mic.enabled:', getMicEnabled())
          }
          if (msg.type === 'input_audio_buffer.committed') {
            console.log('[voice] 📤 input_audio_buffer committed')
          }
          // Log response cancellations (model interrupted mid-speech)
          if (msg.type === 'response.cancelled') {
            console.log('[voice] ❌ response.cancelled — model was interrupted')
          }

          // --- Response completed: maybe continue rotation ---
          if (msg.type === 'response.done') {
            const rot = rotationRef.current
            const allNumbers = conferenceNumbersRef.current
            console.log('[voice] response.done — conferenceNumbers:', [...allNumbers], 'isRotating:', rot.isRotating, 'hadToolCall:', rot.hadToolCall, 'currentSpeaker:', currentSpeakerRef.current)

            // Only rotate in conference mode (>1 number), and not after tool calls
            if (allNumbers.length > 1 && !rot.hadToolCall) {
              if (rot.isRotating) {
                // Continue rotation to next speaker
                promptNextSpeaker()
              } else {
                // Start a new rotation: all characters except the one who just spoke
                const justSpoke = currentSpeakerRef.current
                rot.speakerQueue = allNumbers.filter(n => n !== justSpoke)
                rot.isRotating = true
                promptNextSpeaker()
              }
            }

            // Reset tool call tracker for next response
            rot.hadToolCall = false
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
                output: JSON.stringify({ success: true, message: 'You got 2 more minutes!' }),
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))
          }

          // Handle model calling hang_up tool — graceful goodbye
          if (msg.name === 'hang_up') {
            // Stop any rotation in progress
            rotationRef.current.speakerQueue = []
            rotationRef.current.isRotating = false

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true }),
              },
            }))
            setState('ending')
            hangUpTimerRef.current = setTimeout(() => {
              hangUpTimerRef.current = null
              cleanup()
              setState('idle')
            }, HANG_UP_DELAY_MS)
          }

          // Handle model calling transfer_call tool — hand off to another number
          if (msg.name === 'transfer_call') {
            // Stop any rotation in progress
            rotationRef.current.speakerQueue = []
            rotationRef.current.isRotating = false

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

          // Handle model calling add_to_call tool — conference mode
          if (msg.name === 'add_to_call') {
            // Stop any rotation in progress
            rotationRef.current.speakerQueue = []
            rotationRef.current.isRotating = false

            let targetNumber: number
            try {
              const args = JSON.parse(msg.arguments || '{}')
              targetNumber = Number(args.target_number)
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

            // Add to conference list
            const updated = [...conferenceNumbersRef.current, targetNumber]
            conferenceNumbersRef.current = updated
            setConferenceNumbers(updated)

            // Assign a unique voice for the new number
            const takenVoices = new Set(voiceAssignmentsRef.current.values())
            const newVoice = assignUniqueVoice(targetNumber, takenVoices)
            voiceAssignmentsRef.current.set(targetNumber, newVoice)

            // Acknowledge the tool call
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: `${targetNumber} has joined the call!` }),
              },
            }))

            // Switch to new number's voice so they greet everyone in their own voice
            currentSpeakerRef.current = targetNumber
            setCurrentSpeaker(targetNumber)
            dc.send(JSON.stringify({
              type: 'session.update',
              session: {
                voice: newVoice,
                instructions: generateConferencePrompt(updated, targetNumber),
              },
            }))

            // Prompt the model to greet as the new participant
            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [{
                  type: 'input_text',
                  text: `[System: ${targetNumber} just joined the conference call! Speak as ${targetNumber} introducing yourself, then the other numbers will react.]`,
                }],
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
              const valid = new Set(['phi', 'pi', 'tau', 'e', 'gamma', 'sqrt2', 'ramanujan'])
              if (!valid.has(constantId)) throw new Error('invalid')
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

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify({ success: true, message: `Exploration of ${constantId} is ready but PAUSED. Give the child a brief intro, then you MUST call resume_exploration to start the animation playing. Do NOT begin narrating the script until after you call resume_exploration.` }),
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))

            onStartExplorationRef.current?.(constantId)
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
                output: JSON.stringify({ success: true, message: 'Exploration resumed' }),
              },
            }))
            dc.send(JSON.stringify({ type: 'response.create' }))
            onResumeExplorationRef.current?.()
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
        } catch {
          // Ignore parse errors
        }
      }

      // Create offer
      console.log('[voice] creating SDP offer...')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Send to OpenAI Realtime API
      console.log('[voice] sending SDP offer to OpenAI...')
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
        throw new Error(`WebRTC connection failed: ${sdpResponse.status}`)
      }

      const answerSdp = await sdpResponse.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      console.log('[voice] SDP exchange complete, connectionState:', pc.connectionState, 'iceConnectionState:', pc.iceConnectionState)

      // Wait a moment for the ring effect, then go active
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Check if still ringing (user might have hung up)
      if ((stateRef.current as CallState) !== 'ringing') {
        cleanup()
        return
      }

      // Stop ring tone
      ringRef.current?.stop()
      ringRef.current = null

      // Go active
      console.log('[voice] going active — audioEl paused:', audioEl.paused, 'audioEl.readyState:', audioEl.readyState, 'audioCtx state:', audioCtxRef.current?.state)
      setState('active')
      conferenceNumbersRef.current = [number]
      setConferenceNumbers([number])
      currentSpeakerRef.current = number
      setCurrentSpeaker(number)
      voiceAssignmentsRef.current.set(number, getVoiceForNumber(number))
      rotationRef.current = { speakerQueue: [], isRotating: false, hadToolCall: false }
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
                text: '[System: Only 15 seconds left in the call. Wrap up naturally or use request_more_time if you want to keep talking.]',
              }],
            },
          }))
          dcRef.current.send(JSON.stringify({ type: 'response.create' }))
        }

        // Time's up
        if (remaining <= 0) {
          hangUp()
        }
      }, 1000)

      // Handle connection closure
      pc.onconnectionstatechange = () => {
        console.log('[voice] connectionState changed:', pc.connectionState)
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          hangUp()
        }
      }
    } catch (err) {
      cleanup()
      setError(err instanceof Error ? err.message : 'Connection failed')
      setState('error')
    }
  }, [cleanup, hangUp])

  const sendSystemMessage = useCallback((text: string, promptResponse = false) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }))
    if (promptResponse) {
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
    voiceAssignmentsRef.current.delete(numberToRemove)

    // Clean up rotation queue
    const rot = rotationRef.current
    rot.speakerQueue = rot.speakerQueue.filter(n => n !== numberToRemove)
    if (rot.speakerQueue.length === 0) {
      rot.isRotating = false
    }

    // If the removed number was the current speaker, switch to first remaining
    if (currentSpeakerRef.current === numberToRemove) {
      currentSpeakerRef.current = updated[0]
      setCurrentSpeaker(updated[0])
    }

    if (updated.length === 1) {
      // Revert to single-call mode
      const soloNumber = updated[0]
      const soloVoice = voiceAssignmentsRef.current.get(soloNumber) ?? getVoiceForNumber(soloNumber)
      currentSpeakerRef.current = soloNumber
      setCurrentSpeaker(soloNumber)
      rot.speakerQueue = []
      rot.isRotating = false

      dc.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: soloVoice,
          instructions: generateNumberPersonality(soloNumber),
        },
      }))
    } else {
      // Update conference prompt for remaining numbers
      const firstVoice = voiceAssignmentsRef.current.get(updated[0])
      if (firstVoice) {
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: firstVoice,
            instructions: generateConferencePrompt(updated, updated[0]),
          },
        }))
      }
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return { state, error, dial, hangUp, timeRemaining, isSpeaking, transferTarget, conferenceNumbers, currentSpeaker, removeFromCall, sendSystemMessage }
}
