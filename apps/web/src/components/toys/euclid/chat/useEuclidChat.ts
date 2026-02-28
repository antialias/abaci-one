'use client'

/**
 * Euclid text chat hook — manages chat state, context serialization, and SSE streaming.
 */

import { useState, useCallback, useRef } from 'react'
import type {
  ConstructionState,
  ActiveTool,
  CompassPhase,
  StraightedgePhase,
  ExtendPhase,
  MacroPhase,
  PropositionStep,
} from '../types'
import type { ProofFact } from '../engine/facts'
import {
  serializeConstructionGraph,
  serializeProofFacts,
  serializeToolState,
  type ToolStateInfo,
} from '../voice/serializeProofState'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface UseEuclidChatOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  constructionRef: React.RefObject<ConstructionState>
  proofFactsRef: React.RefObject<ProofFact[]>
  currentStepRef: React.RefObject<number>
  propositionId: number
  isComplete: boolean
  playgroundMode: boolean
  activeToolRef: React.RefObject<ActiveTool>
  compassPhaseRef: React.RefObject<CompassPhase>
  straightedgePhaseRef: React.RefObject<StraightedgePhase>
  extendPhaseRef: React.RefObject<ExtendPhase>
  macroPhaseRef: React.RefObject<MacroPhase>
  dragPointIdRef: React.RefObject<string | null>
  steps: PropositionStep[]
}

export interface UseEuclidChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (text: string) => void
  isOpen: boolean
  open: () => void
  close: () => void
}

let nextId = 0
function generateId(): string {
  return `msg-${Date.now()}-${nextId++}`
}

/**
 * Capture a screenshot from the canvas, scaled down for transmission.
 */
function captureScreenshot(canvas: HTMLCanvasElement): string | null {
  try {
    const targetWidth = 512
    const targetHeight = 384
    const offscreen = document.createElement('canvas')
    offscreen.width = targetWidth
    offscreen.height = targetHeight
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight)
    return offscreen.toDataURL('image/png')
  } catch {
    return null
  }
}

export function useEuclidChat(options: UseEuclidChatOptions): UseEuclidChatReturn {
  const {
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    isComplete,
    playgroundMode,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    steps,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const readToolState = useCallback((): ToolStateInfo => ({
    activeTool: activeToolRef.current ?? 'compass',
    compassPhase: compassPhaseRef.current ?? { tag: 'idle' },
    straightedgePhase: straightedgePhaseRef.current ?? { tag: 'idle' },
    extendPhase: extendPhaseRef.current ?? { tag: 'idle' },
    macroPhase: macroPhaseRef.current ?? { tag: 'idle' },
    dragPointId: dragPointIdRef.current ?? null,
  }), [activeToolRef, compassPhaseRef, straightedgePhaseRef, extendPhaseRef, macroPhaseRef, dragPointIdRef])

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return

      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort()
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const abortController = new AbortController()
      abortRef.current = abortController

      // Serialize current state
      const emptyState = { elements: [], nextLabelIndex: 0, nextColorIndex: 0 } as ConstructionState
      const state = constructionRef.current ?? emptyState
      const facts = proofFactsRef.current ?? []
      const step = currentStepRef.current ?? 0
      const toolInfo = readToolState()

      const constructionGraph = serializeConstructionGraph(state)
      const proofFactsText = serializeProofFacts(facts)
      const toolState = serializeToolState(toolInfo, state, step, steps, isComplete)

      // Build step list
      let stepList: string
      if (isComplete) {
        stepList = 'Construction is COMPLETE. Student is exploring freely.'
      } else {
        const stepLines = steps.map((s, i) => {
          const marker = i === step ? '\u2192' : i < step ? '\u2713' : ' '
          const citation = s.citation ? ` [${s.citation}]` : ''
          return `  ${marker} Step ${i + 1}: ${s.instruction}${citation}`
        })
        stepList = `Step ${step + 1} of ${steps.length}:\n${stepLines.join('\n')}`
      }

      // Capture screenshot
      const screenshot = canvasRef.current ? captureScreenshot(canvasRef.current) : undefined

      // Build message history for API (without the empty assistant msg)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const fetchStream = async () => {
        try {
          const res = await fetch('/api/realtime/euclid/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: apiMessages,
              propositionId,
              currentStep: step,
              isComplete,
              playgroundMode,
              constructionGraph,
              toolState,
              proofFacts: proofFactsText,
              stepList,
              screenshot: screenshot ?? undefined,
            }),
            signal: abortController.signal,
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last.id === assistantMsg.id) {
                updated[updated.length - 1] = {
                  ...last,
                  content: err.error || 'I cannot respond right now. Try again.',
                }
              }
              return updated
            })
            setIsStreaming(false)
            return
          }

          const reader = res.body?.getReader()
          if (!reader) {
            setIsStreaming(false)
            return
          }

          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const event = JSON.parse(data) as { text?: string }
                if (event.text) {
                  setMessages((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last.id === assistantMsg.id) {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content + event.text,
                      }
                    }
                    return updated
                  })
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return
          console.error('[euclid-chat] Stream error:', err)
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.id === assistantMsg.id && !last.content) {
              updated[updated.length - 1] = {
                ...last,
                content: 'I cannot respond right now. Try again.',
              }
            }
            return updated
          })
        } finally {
          setIsStreaming(false)
        }
      }

      fetchStream()
    },
    [
      isStreaming,
      messages,
      constructionRef,
      proofFactsRef,
      currentStepRef,
      canvasRef,
      propositionId,
      isComplete,
      playgroundMode,
      steps,
      readToolState,
    ]
  )

  return { messages, isStreaming, sendMessage, isOpen, open, close }
}
