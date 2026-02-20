'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

type RecorderState = 'idle' | 'recording' | 'recorded' | 'uploading'

interface ClipRecorderProps {
  voice: string
  clipId: string
  promptText: string
  tone: string
  hasExistingClip: boolean
  isDeactivated: boolean
  stream: MediaStream | null
  onSaved: () => void
  onCancel: () => void
}

export function ClipRecorder({
  voice,
  clipId,
  promptText,
  tone,
  hasExistingClip,
  isDeactivated,
  stream,
  onSaved,
  onCancel,
}: ClipRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Clean up blob URL on unmount or re-record
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(() => {
    if (!stream) {
      setError('No microphone stream available. Select a microphone above.')
      return
    }

    setError(null)
    chunksRef.current = []

    // Clean up previous blob URL
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
    }
    setBlob(null)

    // Try audio/webm;codecs=opus first, fall back to audio/webm
    let mimeType = 'audio/webm;codecs=opus'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm'
    }

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      stopTimer()
      const recorded = new Blob(chunksRef.current, { type: mimeType })
      setBlob(recorded)
      setBlobUrl(URL.createObjectURL(recorded))
      setState('recorded')
    }

    recorder.start()
    startTimeRef.current = Date.now()
    setElapsed(0)
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 200)
    setState('recording')
  }, [stream, blobUrl, stopTimer])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!blob) return
    setState('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('audio', blob, `${clipId}.webm`)

      const res = await fetch(
        `/api/admin/audio/custom-clips/${encodeURIComponent(voice)}/${encodeURIComponent(clipId)}`,
        { method: 'POST', body: formData }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setState('recorded')
    }
  }, [blob, voice, clipId, onSaved])

  // Keyboard shortcut: Space to start/stop recording
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Don't hijack space when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return
      e.preventDefault()

      if (state === 'idle') {
        startRecording()
      } else if (state === 'recording') {
        stopRecording()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, startRecording, stopRecording])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop()
      }
    }
  }, [stopTimer])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div
      data-component="ClipRecorder"
      className={css({
        backgroundColor: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '16px',
      })}
    >
      {/* Prompt display */}
      <div className={css({ marginBottom: '12px' })}>
        <div
          className={css({
            color: '#f0f6fc',
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '4px',
          })}
        >
          &ldquo;{promptText}&rdquo;
        </div>
        {tone && <div className={css({ color: '#8b949e', fontSize: '13px' })}>Tone: {tone}</div>}
        {hasExistingClip && (
          <div
            className={css({
              color: isDeactivated ? '#d29922' : '#3fb950',
              fontSize: '12px',
              marginTop: '4px',
            })}
          >
            {isDeactivated
              ? 'Existing clip (deactivated) — re-recording will replace it'
              : 'Existing clip — re-recording will replace it'}
          </div>
        )}
      </div>

      {error && (
        <div
          className={css({
            backgroundColor: '#3d1f28',
            border: '1px solid #f85149',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '12px',
            color: '#f85149',
            fontSize: '13px',
          })}
        >
          {error}
        </div>
      )}

      {/* State: idle */}
      {state === 'idle' && (
        <div className={css({ display: 'flex', gap: '8px', alignItems: 'center' })}>
          <button
            data-action="start-recording"
            onClick={startRecording}
            disabled={!stream}
            className={css({
              backgroundColor: '#da3633',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#f85149' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Record (Space)
          </button>
          <button
            data-action="cancel-recording"
            onClick={onCancel}
            className={css({
              background: 'none',
              border: '1px solid #30363d',
              color: '#8b949e',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              '&:hover': { borderColor: '#8b949e' },
            })}
          >
            Cancel
          </button>
          {!stream && (
            <span className={css({ color: '#d29922', fontSize: '12px' })}>
              Select a microphone above
            </span>
          )}
        </div>
      )}

      {/* State: recording */}
      {state === 'recording' && (
        <div className={css({ display: 'flex', gap: '12px', alignItems: 'center' })}>
          <span
            data-element="recording-indicator"
            className={css({
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#da3633',
              animation: 'pulse 1s ease-in-out infinite',
            })}
          />
          <span className={css({ color: '#f85149', fontWeight: '600', fontFamily: 'monospace' })}>
            {formatTime(elapsed)}
          </span>
          <button
            data-action="stop-recording"
            onClick={stopRecording}
            className={css({
              backgroundColor: '#30363d',
              color: '#f0f6fc',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#484f58' },
            })}
          >
            Stop (Space)
          </button>
        </div>
      )}

      {/* State: recorded */}
      {state === 'recorded' && blobUrl && (
        <div>
          <div className={css({ marginBottom: '12px' })}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              data-element="recording-preview"
              src={blobUrl}
              controls
              className={css({ width: '100%', maxWidth: '400px' })}
            />
          </div>
          <div className={css({ display: 'flex', gap: '8px' })}>
            <button
              data-action="save-recording"
              onClick={handleSave}
              className={css({
                backgroundColor: '#238636',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#2ea043' },
              })}
            >
              Save
            </button>
            <button
              data-action="re-record"
              onClick={() => {
                setState('idle')
                if (blobUrl) URL.revokeObjectURL(blobUrl)
                setBlobUrl(null)
                setBlob(null)
              }}
              className={css({
                background: 'none',
                border: '1px solid #30363d',
                color: '#8b949e',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                '&:hover': { borderColor: '#8b949e' },
              })}
            >
              Re-record
            </button>
            <button
              data-action="cancel-recording"
              onClick={onCancel}
              className={css({
                background: 'none',
                border: 'none',
                color: '#8b949e',
                fontSize: '14px',
                cursor: 'pointer',
                '&:hover': { color: '#c9d1d9' },
              })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* State: uploading */}
      {state === 'uploading' && (
        <div className={css({ color: '#8b949e', fontSize: '14px' })}>Uploading...</div>
      )}
    </div>
  )
}
