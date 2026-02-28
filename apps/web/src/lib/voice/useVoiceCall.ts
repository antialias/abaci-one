'use client'

/**
 * Generic voice call hook — WebRTC connection to the OpenAI Realtime API.
 *
 * Extracted from the number-line's useRealtimeVoice.ts. Consumers provide
 * a VoiceSessionConfig<TContext> that controls all domain-specific behavior
 * (modes, tool handlers, session body, callbacks).
 *
 * The hook manages:
 *  - Microphone permission + GainNode echo suppression
 *  - Ring tone playback
 *  - Session token fetch (POST to config.sessionEndpoint)
 *  - WebRTC setup (RTCPeerConnection, data channel, SDP exchange)
 *  - AnalyserNode-based speaking detection
 *  - Data channel message routing (tool calls, mode transitions, transcripts)
 *  - Mode management (enter/exit/update)
 *  - Timer/countdown with configurable durations
 *  - Async tool call support
 *  - Cleanup and lifecycle (HMR orphan detection, unmount)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { playRingTone } from './ringTone'
import {
  sendToolResponse as sendToolResponseHelper,
  sendSystemMessage as sendSystemMessageHelper,
  sendImageContext as sendImageContextHelper,
  sendContextUpdate as sendContextUpdateHelper,
  sendUserText as sendUserTextHelper,
} from './toolCallHelpers'
import type {
  CallState,
  ModeDebugInfo,
  TimerConfig,
  ToolCallResult,
  UseVoiceCallReturn,
  VoiceSessionConfig,
} from './types'

const DEFAULT_TIMER: TimerConfig = {
  baseDurationMs: 2 * 60 * 1000,
  extensionMs: 2 * 60 * 1000,
  warningBeforeEndMs: 15 * 1000,
  hangUpDelayMs: 2000,
}

/** Error codes the framework suppresses by default (harmless race conditions). */
const DEFAULT_SUPPRESS_CODES = new Set([
  'response_cancel_not_active',
  'conversation_already_has_active_response',
  'item_truncation_failed',
  'invalid_value',
])

export function useVoiceCall<TContext>(
  config: VoiceSessionConfig<TContext>
): UseVoiceCallReturn {
  // Stable ref for config to avoid stale closures
  const configRef = useRef(config)
  configRef.current = config

  const timer = { ...DEFAULT_TIMER, ...config.timer }

  // ── State ──
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentInstructions, setCurrentInstructions] = useState<string | null>(null)

  // Mode state machine
  const activeModeRef = useRef<string>(config.initialModeId)
  const previousModeRef = useRef<string | null>(null)
  const currentInstructionsRef = useRef<string | null>(null)
  const childHasSpokenRef = useRef(false)

  const [modeDebug, setModeDebug] = useState<ModeDebugInfo>({
    current: config.initialModeId,
    previous: null,
    transitions: [],
  })

  // ── Refs ──
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
  const hangUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef<CallState>('idle')
  const agentAudioPlayingRef = useRef(false)

  // Suppress error codes from consumer + defaults
  const suppressCodes = useRef(
    new Set([...DEFAULT_SUPPRESS_CODES, ...(config.suppressErrorCodes ?? [])])
  )

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    if (hangUpTimerRef.current) {
      clearTimeout(hangUpTimerRef.current)
      hangUpTimerRef.current = null
    }

    ringRef.current?.stop()
    ringRef.current = null

    if (dcRef.current) {
      try { dcRef.current.close() } catch { /* ignore */ }
      dcRef.current = null
    }

    if (pcRef.current) {
      try { pcRef.current.close() } catch { /* ignore */ }
      pcRef.current = null
    }

    micGainRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.srcObject = null
      audioElRef.current = null
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setTimeRemaining(null)
    setIsSpeaking(false)
    setCurrentInstructions(null)
    activeModeRef.current = configRef.current.initialModeId
    previousModeRef.current = null
    childHasSpokenRef.current = false
    currentInstructionsRef.current = null
    setModeDebug({
      current: configRef.current.initialModeId,
      previous: null,
      transitions: [],
    })
  }, [])

  const hangUp = useCallback(() => {
    cleanup()
    setState('idle')
    setError(null)
    setErrorCode(null)
  }, [cleanup])

  // ── Mode management ──
  const resolveMode = useCallback(
    (modeId: string, ctx: TContext): { instructions: string; tools: { type: 'function'; name: string; description: string; parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] } }[] } => {
      const mode = configRef.current.modes[modeId]
      if (!mode) {
        console.error('[voice] unknown mode:', modeId)
        // Fall back to initial mode
        const fallback = configRef.current.modes[configRef.current.initialModeId]
        return {
          instructions: fallback.getInstructions(ctx),
          tools: fallback.getTools(ctx),
        }
      }
      return {
        instructions: mode.getInstructions(ctx),
        tools: mode.getTools(ctx),
      }
    },
    []
  )

  const updateSessionInternal = useCallback(
    (dc: RTCDataChannel, modeId?: string, action?: string) => {
      const from = activeModeRef.current
      const targetMode = modeId ?? from
      const ctx = configRef.current.buildContext()
      const { instructions, tools } = resolveMode(targetMode, ctx)
      const toolNames = tools.map((t) => t.name)
      console.log(
        '[mode] updateSession → %s (from %s), action: %s, tools: [%s]',
        targetMode,
        from,
        action ?? 'refresh',
        toolNames.join(', ')
      )
      dc.send(JSON.stringify({ type: 'session.update', session: { instructions, tools } }))
      setCurrentInstructions(instructions)
      currentInstructionsRef.current = instructions
      if (modeId) activeModeRef.current = modeId
      setModeDebug((prev) => ({
        current: targetMode,
        previous: previousModeRef.current,
        transitions: [
          ...prev.transitions.slice(-19),
          {
            from,
            to: targetMode,
            action: action ?? 'refresh',
            timestamp: Date.now(),
            tools: toolNames,
          },
        ],
      }))
    },
    [resolveMode]
  )

  const enterModeInternal = useCallback(
    (dc: RTCDataChannel, newMode: string, savePrevious = true, action?: string) => {
      console.log(
        '[mode] enterMode: %s → %s (savePrevious=%s)',
        activeModeRef.current,
        newMode,
        savePrevious
      )
      if (savePrevious && activeModeRef.current !== newMode) {
        previousModeRef.current = activeModeRef.current
      }
      updateSessionInternal(dc, newMode, action)
    },
    [updateSessionInternal]
  )

  const exitModeInternal = useCallback(
    (dc: RTCDataChannel, action?: string) => {
      const prev = previousModeRef.current ?? configRef.current.initialModeId
      console.log('[mode] exitMode: %s → %s', activeModeRef.current, prev)
      previousModeRef.current = null
      updateSessionInternal(dc, prev, action ?? `exit → ${prev}`)
    },
    [updateSessionInternal]
  )

  // ── Timer extension ──
  const extendTimer = useCallback((): boolean => {
    if (extensionUsedRef.current) return false
    extensionUsedRef.current = true
    deadlineRef.current += timer.extensionMs
    warningSentRef.current = false
    return true
  }, [timer.extensionMs])

  // ── Public mode controls (use current dc) ──
  const enterMode = useCallback(
    (modeId: string, action?: string) => {
      const dc = dcRef.current
      if (!dc || dc.readyState !== 'open') return
      enterModeInternal(dc, modeId, true, action)
    },
    [enterModeInternal]
  )

  const exitMode = useCallback(
    (action?: string) => {
      const dc = dcRef.current
      if (!dc || dc.readyState !== 'open') return
      exitModeInternal(dc, action)
    },
    [exitModeInternal]
  )

  const updateSession = useCallback(
    (action?: string) => {
      const dc = dcRef.current
      if (!dc || dc.readyState !== 'open') return
      updateSessionInternal(dc, undefined, action)
    },
    [updateSessionInternal]
  )

  // ── Public message helpers ──
  const sendSystemMessage = useCallback((text: string, promptResponse = false) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    sendSystemMessageHelper(dc, text, promptResponse)
  }, [])

  const sendImageContext = useCallback((base64DataUrl: string) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    sendImageContextHelper(dc, base64DataUrl)
  }, [])

  const sendContextUpdate = useCallback((text: string, base64DataUrl?: string | null, promptResponse?: boolean) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    sendContextUpdateHelper(dc, text, base64DataUrl, promptResponse)
  }, [])

  const sendUserText = useCallback((text: string) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    sendUserTextHelper(dc, text)
  }, [])

  // ── Dial ──
  const dial = useCallback(async () => {
    const cur = stateRef.current
    if (cur !== 'idle' && cur !== 'error') return

    setError(null)
    setErrorCode(null)
    activeModeRef.current = configRef.current.initialModeId
    previousModeRef.current = null
    extensionUsedRef.current = false
    warningSentRef.current = false
    childHasSpokenRef.current = false

    // 1. Microphone permission
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
          ? 'Microphone access denied. Please allow microphone access!'
          : 'Could not access microphone.'
      )
      setErrorCode(isDenied ? 'mic_denied' : 'mic_error')
      setState('error')
      return
    }

    // 2. Ring tone
    setState('ringing')
    const ringStartedAt = Date.now()
    try {
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      ringRef.current = playRingTone(audioCtx)
    } catch {
      // Ring tone is cosmetic
    }

    // 3. Fetch session token
    let clientSecret: string
    try {
      const sessionBody = configRef.current.getSessionBody()
      const res = await fetch(configRef.current.sessionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        const apiError = new Error(data.error || `Server error: ${res.status}`)
        ;(apiError as Error & { code?: string }).code = data.code || undefined
        throw apiError
      }
      const data = await res.json()
      clientSecret = data.clientSecret

      // Let consumer process session response
      configRef.current.onSessionCreated?.(data)

      if (data.instructions) {
        setCurrentInstructions(data.instructions)
        currentInstructionsRef.current = data.instructions
      }
    } catch (err) {
      cleanup()
      if (err instanceof Error) console.error('[voice] session error:', err.message)
      const msg = err instanceof Error ? err.message : ''
      const isFetchFailure = !msg || msg === 'Failed to fetch' || msg.startsWith('NetworkError')
      setError(isFetchFailure ? 'Connection failed. Check your internet and try again!' : msg)
      setErrorCode((err as Error & { code?: string }).code || 'session_error')
      setState('error')
      return
    }

    // Check if user hung up during token fetch
    if (stateRef.current !== 'ringing') {
      cleanup()
      return
    }

    // 4. WebRTC connection
    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // GainNode echo suppression
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

      processedStream.getAudioTracks().forEach((track) => pc.addTrack(track, processedStream))

      // Audio element for remote audio
      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioElRef.current = audioEl
      audioEl.onerror = () => console.error('[voice] audio playback error', audioEl.error)

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0]
        audioEl.play().catch((err) => {
          console.error('[voice] audio play failed:', err.name, err.message)
        })

        // Speaking detection via audio analysis
        try {
          const ctx = audioCtxRef.current ?? new AudioContext()
          audioCtxRef.current = ctx
          if (ctx.state === 'suspended') ctx.resume()
          const source = ctx.createMediaStreamSource(event.streams[0])
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          // Soft echo gate
          let modelSilenceSince = 0
          let micAttenuated = false
          const MIC_RESTORE_DELAY_MS = 250
          const ATTENUATED_GAIN = 0.15
          const FULL_GAIN = 1.0

          const checkSpeaking = () => {
            const st = stateRef.current
            if (st === 'idle' || st === 'error' || st === 'ending') return

            if (st === 'active') {
              analyser.getByteFrequencyData(dataArray)
              let sum = 0
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
              const avg = sum / dataArray.length
              const nowSpeaking = avg > 15
              setIsSpeaking(nowSpeaking)
              agentAudioPlayingRef.current = nowSpeaking

              // Echo gate
              const gain = micGainRef.current
              if (gain) {
                const now = performance.now()
                if (nowSpeaking) {
                  modelSilenceSince = 0
                  if (!micAttenuated) {
                    gain.gain.setTargetAtTime(ATTENUATED_GAIN, ctx.currentTime, 0.02)
                    micAttenuated = true
                  }
                } else {
                  if (micAttenuated) {
                    if (modelSilenceSince === 0) modelSilenceSince = now
                    if (now - modelSilenceSince > MIC_RESTORE_DELAY_MS) {
                      gain.gain.setTargetAtTime(FULL_GAIN, ctx.currentTime, 0.05)
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

      // Data channel
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onclose = () => {
        const st = stateRef.current
        if (st === 'ringing' || st === 'active') {
          hangUp()
        }
      }

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          // ── session.created ──
          if (msg.type === 'session.created') {
            configRef.current.onSessionEstablished?.(dc)
            dc.send(JSON.stringify({ type: 'response.create' }))
          }

          // ── error ──
          if (msg.type === 'error') {
            const errCode = msg.error?.code || msg.error?.type || 'unknown'
            if (suppressCodes.current.has(errCode)) {
              console.log('[voice] %s (suppressed)', errCode)
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
              setError('Line is busy right now. Try again in a moment!')
              setErrorCode('rate_limited')
            } else {
              setError(msg.error?.message || 'Something went wrong during the call.')
              setErrorCode(errCode)
            }
            setState('error')
            return
          }

          // ── response.created — narration cancellation ──
          if (msg.type === 'response.created') {
            configRef.current.onResponseCreated?.(dc)
          }

          // ── response.done — mode transitions ──
          if (msg.type === 'response.done') {
            // Raw handler first (for deferred exploration start etc.)
            configRef.current.onResponseDoneRaw?.(dc, msg, activeModeRef.current)
            // Then mode-transition handler
            const ctx = configRef.current.buildContext()
            const newMode = configRef.current.onResponseDone?.(ctx, activeModeRef.current)
            if (newMode && newMode !== activeModeRef.current) {
              enterModeInternal(dc, newMode, false, `response.done → ${newMode}`)
            }
          }

          // ── Transcripts ──
          if (msg.type === 'response.audio_transcript.done' && msg.transcript) {
            configRef.current.onModelSpeech?.(msg.transcript)
          }
          if (
            msg.type === 'conversation.item.input_audio_transcription.completed' &&
            msg.transcript
          ) {
            childHasSpokenRef.current = true
            configRef.current.onChildSpeech?.(msg.transcript)
          }

          // ── Tool calls ──
          if (msg.type !== 'response.function_call_arguments.done') return

          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(msg.arguments || '{}')
          } catch {
            // Bad JSON — proceed with empty args
          }

          const ctx = configRef.current.buildContext()
          const result = configRef.current.onToolCall(msg.name, args, ctx)

          if (!result) {
            // Unhandled tool — send generic error
            sendToolResponseHelper(dc, msg.call_id, {
              success: false,
              error: `Unknown tool: ${msg.name}`,
            })
            return
          }

          // Handle transfer specially
          if (result.isTransfer && result.transferTarget != null) {
            sendToolResponseHelper(dc, msg.call_id, result.output, false)
            const target = result.transferTarget
            configRef.current.onTransfer?.(
              target,
              () => cleanup(),
              () => dial()
            )
            return
          }

          // Handle hang_up specially
          if (result.isHangUp) {
            sendToolResponseHelper(dc, msg.call_id, result.output, false)
            setState('ending')
            const MAX_WAIT_MS = 8000
            const waitStart = Date.now()
            const waitForSilence = () => {
              const elapsed = Date.now() - waitStart
              if (agentAudioPlayingRef.current && elapsed < MAX_WAIT_MS) {
                hangUpTimerRef.current = setTimeout(waitForSilence, 150)
              } else {
                hangUpTimerRef.current = setTimeout(() => {
                  hangUpTimerRef.current = null
                  cleanup()
                  setState('idle')
                }, timer.hangUpDelayMs)
              }
            }
            waitForSilence()
            return
          }

          // Send immediate tool response
          const promptResponse = result.promptResponse !== false
          sendToolResponseHelper(dc, msg.call_id, result.output, !result.asyncResult && promptResponse)

          // Mode transitions
          if (result.enterMode) {
            enterModeInternal(dc, result.enterMode, true, `tool:${msg.name} → ${result.enterMode}`)
          }
          if (result.exitMode) {
            exitModeInternal(dc, `tool:${msg.name} → exit`)
          }

          // Async follow-up
          if (result.asyncResult) {
            result.asyncResult.then(
              (asyncData) => {
                if (dcRef.current?.readyState !== 'open') return
                sendSystemMessageHelper(dcRef.current, asyncData.text, true)
                if (asyncData.exitMode) {
                  exitModeInternal(dcRef.current, `async:${msg.name} → exit`)
                }
              },
              (err) => {
                console.error('[voice] async tool error:', err)
                if (dcRef.current?.readyState !== 'open') return
                sendSystemMessageHelper(
                  dcRef.current,
                  `[System: The async operation failed: ${err instanceof Error ? err.message : 'Unknown error'}]`,
                  true
                )
              }
            )
          }
        } catch {
          // Ignore parse errors
        }
      }

      // SDP exchange
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
        throw new Error("Couldn't connect. Try calling again!")
      }

      const answerSdp = await sdpResponse.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      // Minimum ring time
      const MIN_RING_MS = 1500
      const elapsed = Date.now() - ringStartedAt
      if (elapsed < MIN_RING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_RING_MS - elapsed))
      }

      if (stateRef.current !== 'ringing') {
        cleanup()
        return
      }

      // Stop ring tone
      ringRef.current?.stop()
      ringRef.current = null

      // Go active
      console.log('[voice] call active')
      setState('active')

      deadlineRef.current = Date.now() + timer.baseDurationMs

      // Timer countdown
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, deadlineRef.current - Date.now())
        setTimeRemaining(Math.ceil(remaining / 1000))

        // Time warning
        if (
          !warningSentRef.current &&
          remaining < timer.warningBeforeEndMs &&
          remaining > 0 &&
          dcRef.current?.readyState === 'open'
        ) {
          warningSentRef.current = true
          configRef.current.onTimeWarning?.(dcRef.current, remaining)
        }

        // Time expired
        if (remaining <= 0) {
          if (dcRef.current?.readyState === 'open') {
            configRef.current.onTimeExpired?.(dcRef.current)
          }
          // If consumer doesn't handle it, force hangup
          if (!configRef.current.onTimeExpired) {
            hangUp()
          }
        }
      }, 1000)

      // Connection closure
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          hangUp()
        }
      }
    } catch (err) {
      cleanup()
      if (err instanceof Error) console.error('[voice] connection error:', err.message)
      setError(
        err instanceof Error ? err.message : "Couldn't connect. Try calling again!"
      )
      setErrorCode('connection_error')
      setState('error')
    }
  }, [cleanup, hangUp, enterModeInternal, exitModeInternal, timer])

  // HMR orphan detection
  useEffect(() => {
    if (state !== 'idle' && state !== 'error' && !pcRef.current) {
      setState('idle')
      setError(null)
      setErrorCode(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanup() }
  }, [cleanup])

  return {
    state,
    error,
    errorCode,
    dial,
    hangUp,
    timeRemaining,
    isSpeaking,
    sendSystemMessage,
    sendImageContext,
    sendContextUpdate,
    currentInstructions,
    modeDebug,
    dcRef,
    agentAudioPlayingRef,
    enterMode,
    exitMode,
    updateSession,
    extendTimer,
    audioElRef,
    sendUserText,
  }
}
