'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createSocket } from '@/lib/socket'

interface SelectedSegment {
  index: number
  scrubberLabel?: string
  ttsText: string
  startProgress: number
  endProgress: number
  animationDurationMs: number
}

interface DemoRefinePanelProps {
  constantId: string
  startProgress: number
  endProgress: number
  segments: SelectedSegment[]
  isDark: boolean
  onClose: () => void
  onComplete: () => void
  onTaskStart?: () => void
  onTaskEnd?: () => void
  onCaptureScreenshot?: () => string | null
}

type PanelState = 'idle' | 'running' | 'done'

interface OutputLine {
  type: 'text' | 'tool' | 'error' | 'result'
  content: string
}

interface HistoryEntry {
  prompt: string
  success: boolean | null
  sessionId: string | null
  error: string | null
  toolCount: number
  timestamp: number
}

const DEFAULT_WIDTH = 480
const DEFAULT_HEIGHT = 360
const MIN_WIDTH = 320
const MIN_HEIGHT = 200

// ---- sessionStorage keys & helpers ----
// Shared key so NumberLine can also detect an active task on mount
const ACTIVE_TASK_KEY = 'refine-active-task'

function getActiveTask(): { taskId: string; prompt: string } | null {
  try {
    const stored = sessionStorage.getItem(ACTIVE_TASK_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function DemoRefinePanel({
  constantId,
  startProgress,
  endProgress,
  segments,
  isDark,
  onClose,
  onComplete,
  onTaskStart,
  onTaskEnd,
  onCaptureScreenshot,
}: DemoRefinePanelProps) {
  // ---- Restore from sessionStorage on mount (survives HMR) ----
  const resumedTask = useRef(getActiveTask())
  const isResuming = resumedTask.current !== null

  const [state, setState] = useState<PanelState>(isResuming ? 'running' : 'idle')
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState<OutputLine[]>(
    isResuming ? [{ type: 'text', content: '--- reconnected after page reload ---' }] : []
  )
  const [progress, setProgress] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean | null>(null)
  const [taskId, setTaskId] = useState<string | null>(resumedTask.current?.taskId ?? null)
  const [error, setError] = useState<string | null>(null)
  const historyStorageKey = `refine-history-${constantId}`
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const stored = sessionStorage.getItem(historyStorageKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null)
  const [continueTarget, setContinueTarget] = useState<string | null>(null)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toolCountRef = useRef(0)
  const currentPromptRef = useRef(resumedTask.current?.prompt ?? '')
  // Tracks intermediate result between claude_result and completed events (avoids stale closures)
  const pendingResultRef = useRef<{ sessionId: string | null; success: boolean | null }>({
    sessionId: null,
    success: null,
  })

  // Screenshot annotation state
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [annotating, setAnnotating] = useState(false)
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  // Position & size state (initialized to bottom-right)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT })

  // Drag state
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  )
  // Resize state
  const resizeRef = useRef<{
    startX: number
    startY: number
    origW: number
    origH: number
    origX: number
    origY: number
    edge: string
  } | null>(null)

  // Initialize position on mount
  useEffect(() => {
    if (pos === null) {
      setPos({
        x: Math.max(12, window.innerWidth - DEFAULT_WIDTH - 12),
        y: Math.max(12, window.innerHeight - DEFAULT_HEIGHT - 80),
      })
    }
  }, [pos])

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  // Focus textarea on mount and when returning to idle
  useEffect(() => {
    if (state === 'idle') {
      textareaRef.current?.focus()
    }
  }, [state])

  // Persist history to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(historyStorageKey, JSON.stringify(history))
    } catch {}
  }, [history, historyStorageKey])

  // Auto-select most recent session for continuation
  useEffect(() => {
    if (state !== 'idle') return
    const mostRecent = [...history].reverse().find((e) => e.sessionId)
    setContinueTarget(mostRecent?.sessionId ?? null)
  }, [history, state])

  // ---- Active task persistence (survives HMR) ----
  useEffect(() => {
    if (taskId && state === 'running') {
      try {
        sessionStorage.setItem(
          ACTIVE_TASK_KEY,
          JSON.stringify({
            taskId,
            prompt: currentPromptRef.current,
          })
        )
      } catch {}
    } else {
      sessionStorage.removeItem(ACTIVE_TASK_KEY)
    }
  }, [taskId, state])

  // Notify parent when resuming from HMR (so it sets refineTaskActive)
  useEffect(() => {
    if (resumedTask.current) {
      onTaskStart?.()
      resumedTask.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- History helpers ----

  const pushOptimisticEntry = useCallback(() => {
    setHistory((prev) => [
      ...prev,
      {
        prompt: currentPromptRef.current,
        success: null,
        sessionId: null,
        error: 'Interrupted before completion',
        toolCount: 0,
        timestamp: Date.now(),
      },
    ])
  }, [])

  const updateLastEntry = useCallback((patch: Partial<HistoryEntry>) => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      next[next.length - 1] = { ...next[next.length - 1], ...patch }
      return next
    })
  }, [])

  const finalizeHistory = useCallback(
    (ok: boolean | null, sid: string | null, err: string | null) => {
      updateLastEntry({
        success: ok,
        sessionId: sid,
        error: err,
        toolCount: toolCountRef.current,
      })
    },
    [updateLastEntry]
  )

  // ---- Socket.IO event handler (ref pattern avoids stale closures) ----

  const eventHandlerRef = useRef<
    (event: { taskId: string; eventType: string; payload: Record<string, unknown> }) => void
  >(() => {})
  eventHandlerRef.current = (event) => {
    if (event.taskId !== taskId) return

    switch (event.eventType) {
      case 'claude_output':
        setOutput((prev) => [...prev, { type: 'text', content: String(event.payload.text ?? '') }])
        break
      case 'tool_use': {
        toolCountRef.current++
        const tool = String(event.payload.tool ?? '')
        const file = event.payload.file ? ` ${event.payload.file}` : ''
        setOutput((prev) => [...prev, { type: 'tool', content: `${tool}${file}` }])
        updateLastEntry({ toolCount: toolCountRef.current })
        break
      }
      case 'session_id': {
        const sid = String(event.payload.sessionId ?? '')
        if (sid) {
          pendingResultRef.current.sessionId = sid
          setSessionId(sid)
          updateLastEntry({ sessionId: sid })
        }
        break
      }
      case 'claude_result': {
        const sid = String(event.payload.sessionId ?? '')
        const ok = Boolean(event.payload.success)
        pendingResultRef.current.sessionId = sid
        pendingResultRef.current.success = ok
        setSessionId(sid)
        setSuccess(ok)
        setOutput((prev) => [
          ...prev,
          {
            type: 'result',
            content: ok ? 'Completed successfully' : 'Completed with errors',
          },
        ])
        break
      }
      case 'stderr':
        setOutput((prev) => [...prev, { type: 'error', content: String(event.payload.text ?? '') }])
        break
      case 'progress':
        setProgress(Number(event.payload.progress ?? 0))
        break
      case 'completed': {
        const { success: ok, sessionId: sid } = pendingResultRef.current
        setState('done')
        finalizeHistory(ok, sid, null)
        onTaskEnd?.()
        break
      }
      case 'failed': {
        const errMsg = String(event.payload.error ?? 'Task failed')
        const { sessionId: sid } = pendingResultRef.current
        setError(errMsg)
        setState('done')
        finalizeHistory(false, sid, errMsg)
        onTaskEnd?.()
        break
      }
      case 'cancelled': {
        const { sessionId: sid } = pendingResultRef.current
        setError('Task cancelled')
        setState('done')
        finalizeHistory(null, sid, 'Cancelled')
        onTaskEnd?.()
        break
      }
    }
  }

  // ---- Socket.IO subscription (auto-reconnects on HMR remount) ----

  const isRunning = state === 'running'

  useEffect(() => {
    if (!taskId || !isRunning) return

    const socket = createSocket({ reconnection: true })

    socket.on('connect', () => {
      socket.emit('task:subscribe', taskId)
    })

    socket.on(
      'task:event',
      (evt: { taskId: string; eventType: string; payload: Record<string, unknown> }) => {
        eventHandlerRef.current(evt)
      }
    )

    // Handle task:state — server sends current state on subscribe.
    // If the task already finished (e.g. during HMR), transition out of running.
    socket.on(
      'task:state',
      (taskState: {
        id: string
        status: string
        error?: string | null
        output?: { sessionId?: string } | null
      }) => {
        if (taskState.id !== taskId) return
        if (taskState.status === 'completed') {
          const sid = taskState.output?.sessionId ?? null
          pendingResultRef.current = { sessionId: sid, success: true }
          if (sid) setSessionId(sid)
          setSuccess(true)
          setOutput((prev) => [...prev, { type: 'result', content: 'Completed successfully' }])
          setState('done')
          finalizeHistory(true, sid, null)
          onTaskEnd?.()
        } else if (taskState.status === 'failed') {
          const errMsg = taskState.error ?? 'Task failed'
          setError(errMsg)
          setState('done')
          finalizeHistory(false, null, errMsg)
          onTaskEnd?.()
        } else if (taskState.status === 'cancelled') {
          setError('Task cancelled')
          setState('done')
          finalizeHistory(null, null, 'Cancelled')
          onTaskEnd?.()
        }
      }
    )

    return () => {
      socket.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, isRunning])

  // --- Drag-to-move (header) ---
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [pos]
  )

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    e.preventDefault()
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 100, d.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 60, d.origY + dy)),
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    dragRef.current = null
  }, [])

  // --- Drag-to-resize (edges/corners) ---
  const handleResizeStart = useCallback(
    (e: React.PointerEvent, edge: string) => {
      if (!pos) return
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: size.w,
        origH: size.h,
        origX: pos.x,
        origY: pos.y,
        edge,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [pos, size]
  )

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r) return
    e.preventDefault()
    const dx = e.clientX - r.startX
    const dy = e.clientY - r.startY

    let newW = r.origW
    let newH = r.origH
    let newX = r.origX
    let newY = r.origY

    if (r.edge.includes('e')) newW = Math.max(MIN_WIDTH, r.origW + dx)
    if (r.edge.includes('s')) newH = Math.max(MIN_HEIGHT, r.origH + dy)
    if (r.edge.includes('w')) {
      const dw = Math.min(dx, r.origW - MIN_WIDTH)
      newW = r.origW - dw
      newX = r.origX + dw
    }
    if (r.edge.includes('n')) {
      const dh = Math.min(dy, r.origH - MIN_HEIGHT)
      newH = r.origH - dh
      newY = r.origY + dh
    }

    setSize({ w: newW, h: newH })
    setPos({ x: newX, y: newY })
  }, [])

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null
  }, [])

  const handleNewRefinement = useCallback(() => {
    setPrompt('')
    setOutput([])
    setProgress(0)
    setSessionId(null)
    setSuccess(null)
    setTaskId(null) // Triggers socket cleanup via effect
    setError(null)
    setScreenshotDataUrl(null)
    setAnnotating(false)
    setContinueTarget(null)
    toolCountRef.current = 0
    pendingResultRef.current = { sessionId: null, success: null }
    setState('idle')
  }, [])

  // --- Screenshot capture ---
  const handleCaptureFrame = useCallback(() => {
    if (!onCaptureScreenshot) return
    const dataUrl = onCaptureScreenshot()
    if (dataUrl) {
      setScreenshotDataUrl(dataUrl)
      setAnnotating(true)
    }
  }, [onCaptureScreenshot])

  // --- Annotation drawing handlers ---
  const handleAnnotationPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = annotationCanvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const rect = canvas.getBoundingClientRect()
    lastPointRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleAnnotationPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = annotationCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const last = lastPointRef.current
    if (last) {
      ctx.beginPath()
      ctx.strokeStyle = '#ff00ff'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    lastPointRef.current = { x, y }
  }, [])

  const handleAnnotationPointerUp = useCallback(() => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }, [])

  const handleAnnotationClear = useCallback(() => {
    const canvas = annotationCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Composite screenshot + annotations into final data URL
  // Annotation canvas is at CSS display size; screenshot is at full resolution.
  // We composite at screenshot resolution, scaling annotation marks up to match.
  const handleAnnotationDone = useCallback(() => {
    if (!screenshotDataUrl) return
    const img = new Image()
    img.onload = () => {
      const composite = document.createElement('canvas')
      composite.width = img.width
      composite.height = img.height
      const ctx = composite.getContext('2d')
      if (!ctx) return
      // Draw full-res screenshot
      ctx.drawImage(img, 0, 0)
      // Scale annotation layer from CSS size to screenshot size
      const annCanvas = annotationCanvasRef.current
      if (annCanvas && annCanvas.width > 0 && annCanvas.height > 0) {
        ctx.drawImage(annCanvas, 0, 0, img.width, img.height)
      }
      setScreenshotDataUrl(composite.toDataURL('image/png'))
      setAnnotating(false)
    }
    img.src = screenshotDataUrl
  }, [screenshotDataUrl])

  const handleAnnotationCancel = useCallback(() => {
    setScreenshotDataUrl(null)
    setAnnotating(false)
  }, [])

  // ---- handleSubmit: POST only, socket is managed by useEffect ----

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return

    currentPromptRef.current = prompt.trim()
    toolCountRef.current = 0
    pendingResultRef.current = { sessionId: null, success: null }
    pushOptimisticEntry()
    setState('running')
    setOutput([])
    setProgress(0)
    setError(null)
    setSessionId(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/demo/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          constantId,
          startProgress,
          endProgress,
          prompt: prompt.trim(),
          selectedSegments: segments,
          ...(screenshotDataUrl
            ? {
                screenshotBase64: screenshotDataUrl.replace(/^data:image\/png;base64,/, ''),
              }
            : {}),
          ...(continueTarget ? { continueSessionId: continueTarget } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        const errMsg = data.error ?? `HTTP ${res.status}`
        setError(errMsg)
        finalizeHistory(false, null, errMsg)
        setState('idle')
        return
      }

      const { taskId: tid } = await res.json()
      setTaskId(tid) // Triggers the socket subscription effect
      onTaskStart?.()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errMsg)
      finalizeHistory(false, null, errMsg)
      setState('idle')
    }
  }, [
    prompt,
    constantId,
    startProgress,
    endProgress,
    segments,
    onTaskStart,
    pushOptimisticEntry,
    finalizeHistory,
    screenshotDataUrl,
    continueTarget,
  ])

  const handleCancel = useCallback(() => {
    if (taskId && state === 'running') {
      const socket = createSocket()
      socket.emit('task:cancel', taskId)
      socket.disconnect()
    }
    sessionStorage.removeItem(ACTIVE_TASK_KEY)
    onClose()
  }, [taskId, state, onClose])

  const [resumeCopied, setResumeCopied] = useState(false)
  const handleResumeInTerminal = useCallback(() => {
    if (!sessionId) return
    const cmd = `claude --resume ${sessionId}`
    navigator.clipboard.writeText(cmd)
    setResumeCopied(true)
    setTimeout(() => setResumeCopied(false), 2000)
    // Cancel the background task so Claude isn't running in two places
    if (taskId) {
      const socket = createSocket()
      socket.emit('task:cancel', taskId)
      socket.disconnect()
    }
  }, [sessionId, taskId])

  const bg = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(248, 250, 252, 0.85)'
  const border = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)'
  const textColor = isDark ? '#e2e8f0' : '#1e293b'
  const mutedColor = isDark ? '#94a3b8' : '#64748b'
  const accentColor = '#a855f7'

  if (!pos) return null

  // Shared resize handle props factory
  const resizeHandle = (edge: string, cursor: string, style: React.CSSProperties) => (
    <div
      data-element={`refine-resize-${edge}`}
      onPointerDown={(e) => handleResizeStart(e, edge)}
      onPointerMove={handleResizeMove}
      onPointerUp={handleResizeEnd}
      onPointerCancel={handleResizeEnd}
      style={{
        position: 'absolute',
        zIndex: 2,
        cursor,
        touchAction: 'none',
        ...style,
      }}
    />
  )

  function formatAge(ts: number): string {
    const sec = Math.round((Date.now() - ts) / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m ago`
    return `${Math.round(min / 60)}h ago`
  }

  return (
    <div
      ref={panelRef}
      data-component="demo-refine-panel"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${border}`,
        borderRadius: 12,
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)',
        color: textColor,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        zIndex: 50,
        overflow: 'hidden',
        opacity: 0.85,
      }}
    >
      {/* Resize handles — edges */}
      {resizeHandle('n', 'ns-resize', { top: -3, left: 8, right: 8, height: 6 })}
      {resizeHandle('s', 'ns-resize', { bottom: -3, left: 8, right: 8, height: 6 })}
      {resizeHandle('w', 'ew-resize', { left: -3, top: 8, bottom: 8, width: 6 })}
      {resizeHandle('e', 'ew-resize', { right: -3, top: 8, bottom: 8, width: 6 })}
      {/* Resize handles — corners */}
      {resizeHandle('nw', 'nwse-resize', { top: -4, left: -4, width: 12, height: 12 })}
      {resizeHandle('ne', 'nesw-resize', { top: -4, right: -4, width: 12, height: 12 })}
      {resizeHandle('sw', 'nesw-resize', { bottom: -4, left: -4, width: 12, height: 12 })}
      {resizeHandle('se', 'nwse-resize', { bottom: -4, right: -4, width: 12, height: 12 })}

      {/* Header — drag to move */}
      <div
        data-element="refine-header"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Refine Demo
          </span>
          <span style={{ fontSize: 11, color: mutedColor }}>
            {constantId} &middot; {segments.length} segment{segments.length !== 1 ? 's' : ''}
            {history.length > 0 && ` \u00b7 ${history.length} prior`}
          </span>
        </div>
        <button
          data-action="refine-close"
          onClick={state === 'running' ? handleCancel : onClose}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'none',
            border: 'none',
            color: mutedColor,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 6px',
          }}
        >
          &times;
        </button>
      </div>

      {/* Annotation overlay */}
      {annotating && screenshotDataUrl && (
        <div
          data-element="refine-annotation-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(248, 250, 252, 0.95)',
            borderRadius: 12,
          }}
        >
          <div style={{ padding: '8px 14px', fontSize: 11, color: mutedColor, flexShrink: 0 }}>
            Draw magenta marks on areas of interest. Click Done when finished.
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', margin: '0 14px' }}>
            {/* Screenshot as background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotDataUrl}
              alt="Captured frame"
              data-element="refine-annotation-bg"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
              onLoad={() => {
                // Size annotation canvas to match its CSS display size (1:1 with pointer coords)
                const canvas = annotationCanvasRef.current
                if (canvas) {
                  const rect = canvas.getBoundingClientRect()
                  canvas.width = rect.width
                  canvas.height = rect.height
                }
              }}
            />
            {/* Transparent annotation canvas on top */}
            <canvas
              ref={annotationCanvasRef}
              data-element="refine-annotation-canvas"
              onPointerDown={handleAnnotationPointerDown}
              onPointerMove={handleAnnotationPointerMove}
              onPointerUp={handleAnnotationPointerUp}
              onPointerCancel={handleAnnotationPointerUp}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                cursor: 'crosshair',
                touchAction: 'none',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              padding: '10px 14px',
              flexShrink: 0,
            }}
          >
            <button
              data-action="refine-annotation-cancel"
              onClick={handleAnnotationCancel}
              style={{
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: 500,
                background: 'none',
                border: `1px solid ${border}`,
                borderRadius: 6,
                color: mutedColor,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              data-action="refine-annotation-clear"
              onClick={handleAnnotationClear}
              style={{
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: 500,
                background: 'none',
                border: `1px solid ${border}`,
                borderRadius: 6,
                color: textColor,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
            <button
              data-action="refine-annotation-done"
              onClick={handleAnnotationDone}
              style={{
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: 600,
                background: '#ff00ff',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* History section — always visible when there are entries and in idle/done state */}
        {history.length > 0 && (state === 'idle' || state === 'done') && (
          <div
            data-element="refine-history"
            style={{
              borderBottom: `1px solid ${border}`,
              maxHeight: 160,
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            {/* "New session" row — only when there are continuable entries */}
            {history.some((e) => e.sessionId) && (
              <div
                data-element="refine-history-new-session"
                onClick={() => setContinueTarget(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  borderLeft: !continueTarget
                    ? `3px solid ${accentColor}`
                    : '3px solid transparent',
                  backgroundColor: !continueTarget
                    ? isDark
                      ? 'rgba(168, 85, 247, 0.06)'
                      : 'rgba(168, 85, 247, 0.04)'
                    : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: !continueTarget ? 600 : 400,
                    color: !continueTarget ? accentColor : mutedColor,
                  }}
                >
                  + New session
                </span>
              </div>
            )}
            {history.map((entry, i) => {
              const isExpanded = expandedHistoryIdx === i
              const isSelected = !!entry.sessionId && continueTarget === entry.sessionId
              const isContinuable = !!entry.sessionId
              const statusColor =
                entry.success === true ? '#4ade80' : entry.success === false ? '#f87171' : '#fbbf24'
              const statusLabel =
                entry.success === true ? 'OK' : entry.success === false ? 'FAIL' : 'CANCELLED'
              return (
                <div key={i}>
                  <div
                    data-element="refine-history-entry"
                    onClick={() => {
                      if (isContinuable) {
                        setContinueTarget(isSelected ? null : entry.sessionId)
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 14px',
                      cursor: isContinuable ? 'pointer' : 'default',
                      borderLeft: isSelected ? `3px solid ${accentColor}` : '3px solid transparent',
                      borderBottom: isExpanded ? 'none' : undefined,
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(168, 85, 247, 0.06)'
                          : 'rgba(168, 85, 247, 0.04)'
                        : isExpanded
                          ? isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.02)'
                          : undefined,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 3,
                        backgroundColor: statusColor + '22',
                        color: statusColor,
                        flexShrink: 0,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {statusLabel}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isSelected ? textColor : textColor,
                      }}
                    >
                      {entry.prompt}
                    </span>
                    <span style={{ fontSize: 10, color: mutedColor, flexShrink: 0 }}>
                      {entry.toolCount > 0 && `${entry.toolCount} tools \u00b7 `}
                      {formatAge(entry.timestamp)}
                    </span>
                    <span
                      data-action="refine-history-expand"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedHistoryIdx(isExpanded ? null : i)
                      }}
                      style={{
                        fontSize: 10,
                        color: mutedColor,
                        flexShrink: 0,
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s',
                        padding: '2px 4px',
                        cursor: 'pointer',
                      }}
                    >
                      &#x25B6;
                    </span>
                  </div>
                  {isExpanded && (
                    <div
                      data-element="refine-history-detail"
                      style={{
                        padding: '4px 14px 8px 14px',
                        fontSize: 11,
                        borderLeft: isSelected
                          ? `3px solid ${accentColor}`
                          : '3px solid transparent',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <div
                        style={{
                          color: mutedColor,
                          marginBottom: 4,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5,
                        }}
                      >
                        {entry.prompt}
                      </div>
                      {entry.error && (
                        <div style={{ color: '#f87171', fontSize: 10, marginBottom: 2 }}>
                          {entry.error}
                        </div>
                      )}
                      {entry.sessionId && (
                        <code
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(`claude --resume ${entry.sessionId}`)
                          }}
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 3,
                            backgroundColor: isDark
                              ? 'rgba(30, 41, 59, 0.8)'
                              : 'rgba(241, 245, 249, 0.8)',
                            cursor: 'pointer',
                            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                            display: 'inline-block',
                          }}
                          title="Click to copy"
                        >
                          claude --resume {entry.sessionId}
                        </code>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Selected segments summary */}
        {state === 'idle' && segments.length > 0 && history.length === 0 && (
          <div
            data-element="refine-segments"
            style={{
              padding: '8px 14px',
              borderBottom: `1px solid ${border}`,
              maxHeight: 100,
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            {segments.map((seg) => (
              <div
                key={seg.index}
                style={{
                  fontSize: 11,
                  color: mutedColor,
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 20 }}>#{seg.index}</span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {seg.scrubberLabel ? `${seg.scrubberLabel}: ` : ''}
                  {seg.ttsText}
                </span>
              </div>
            ))}
          </div>
        )}

        {state === 'idle' && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: '#ef4444',
                  padding: '6px 10px',
                  background: 'rgba(239,68,68,0.1)',
                  borderRadius: 6,
                }}
              >
                {error}
              </div>
            )}
            <textarea
              ref={textareaRef}
              data-element="refine-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                continueTarget
                  ? 'Follow-up on the previous refinement...'
                  : history.length > 0
                    ? 'Describe the next refinement...'
                    : "Describe the refinement... e.g., 'Make the narration more exciting during the spiral reveal'"
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              style={{
                width: '100%',
                minHeight: 64,
                maxHeight: 120,
                resize: 'vertical',
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(241, 245, 249, 0.8)',
                color: textColor,
                border: `1px solid ${border}`,
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {/* Screenshot thumbnail preview */}
            {screenshotDataUrl && !annotating && (
              <div
                data-element="refine-screenshot-thumbnail"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotDataUrl}
                  alt="Annotated screenshot"
                  style={{
                    height: 48,
                    borderRadius: 4,
                    border: `1px solid ${border}`,
                    objectFit: 'contain',
                  }}
                />
                <span style={{ fontSize: 10, color: mutedColor, flex: 1 }}>
                  Screenshot attached
                </span>
                <button
                  data-action="refine-screenshot-remove"
                  onClick={() => setScreenshotDataUrl(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: mutedColor,
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: '2px 6px',
                  }}
                  title="Remove screenshot"
                >
                  &times;
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {onCaptureScreenshot && !screenshotDataUrl && (
                <button
                  data-action="refine-capture"
                  onClick={handleCaptureFrame}
                  style={{
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 500,
                    background: 'none',
                    border: `1px solid #ff00ff44`,
                    borderRadius: 6,
                    color: '#ff00ff',
                    cursor: 'pointer',
                    marginRight: 'auto',
                  }}
                >
                  Capture Frame
                </button>
              )}
              <button
                data-action="refine-cancel"
                onClick={onClose}
                style={{
                  padding: '6px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'none',
                  border: `1px solid ${border}`,
                  borderRadius: 6,
                  color: mutedColor,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                data-action="refine-submit"
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                style={{
                  padding: '6px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: prompt.trim() ? accentColor : isDark ? '#334155' : '#cbd5e1',
                  border: 'none',
                  borderRadius: 6,
                  color: prompt.trim() ? '#fff' : mutedColor,
                  cursor: prompt.trim() ? 'pointer' : 'default',
                }}
              >
                {continueTarget ? 'Continue' : 'Submit'} (Cmd+Enter)
              </button>
            </div>
          </div>
        )}

        {(state === 'running' || state === 'done') && (
          <>
            {/* Progress bar */}
            {state === 'running' && (
              <div
                data-element="refine-progress"
                style={{
                  height: 3,
                  backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.1)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: accentColor,
                    transition: 'width 0.3s',
                    borderRadius: 2,
                  }}
                />
              </div>
            )}

            {/* Resume in Terminal — shown during running once session ID is available */}
            {state === 'running' && sessionId && (
              <div
                data-element="refine-resume-bar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderBottom: `1px solid ${border}`,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11, color: mutedColor, flex: 1 }}>
                  Session ready — resume interactively in your terminal
                </span>
                <button
                  data-action="refine-resume-terminal"
                  onClick={handleResumeInTerminal}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    background: 'none',
                    border: `1px solid ${accentColor}66`,
                    borderRadius: 5,
                    color: accentColor,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {resumeCopied ? 'Copied! Paste in terminal' : 'Resume in Terminal'}
                </button>
              </div>
            )}

            {/* Output stream */}
            <div
              data-element="refine-output"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '8px 14px',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              {output.map((line, i) => {
                let color = textColor
                let prefix = ''
                if (line.type === 'tool') {
                  color = '#a78bfa'
                  prefix = '> '
                } else if (line.type === 'error') {
                  color = '#f87171'
                  prefix = '! '
                } else if (line.type === 'result') {
                  color = success ? '#4ade80' : '#f87171'
                  prefix = success ? '+ ' : '- '
                }
                return (
                  <div key={i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {prefix}
                    {line.content}
                  </div>
                )
              })}
              {state === 'running' && (
                <div style={{ color: mutedColor, marginTop: 4 }}>Working...</div>
              )}
              <div ref={outputEndRef} />
            </div>

            {/* Done actions */}
            {state === 'done' && (
              <div
                data-element="refine-done"
                style={{
                  padding: '10px 14px',
                  borderTop: `1px solid ${border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
                {sessionId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: mutedColor }}>Resume:</span>
                    <code
                      data-element="refine-resume-cmd"
                      onClick={() => {
                        navigator.clipboard.writeText(`claude --resume ${sessionId}`)
                      }}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: isDark
                          ? 'rgba(30, 41, 59, 0.8)'
                          : 'rgba(241, 245, 249, 0.8)',
                        cursor: 'pointer',
                        userSelect: 'all',
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      }}
                    >
                      claude --resume {sessionId}
                    </code>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    data-action="refine-close-done"
                    onClick={onClose}
                    style={{
                      padding: '6px 16px',
                      fontSize: 12,
                      fontWeight: 500,
                      background: 'none',
                      border: `1px solid ${border}`,
                      borderRadius: 6,
                      color: mutedColor,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                  <button
                    data-action="refine-new"
                    onClick={handleNewRefinement}
                    style={{
                      padding: '6px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'none',
                      border: `1px solid ${border}`,
                      borderRadius: 6,
                      color: textColor,
                      cursor: 'pointer',
                    }}
                  >
                    New Refinement
                  </button>
                  {success && (
                    <button
                      data-action="refine-reload"
                      onClick={onComplete}
                      style={{
                        padding: '6px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: accentColor,
                        border: 'none',
                        borderRadius: 6,
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Reload Page
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
