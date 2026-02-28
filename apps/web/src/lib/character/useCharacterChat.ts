'use client'

/**
 * Generic SSE streaming chat hook for character conversations.
 *
 * Handles message state, open/close, SSE stream parsing, abort control,
 * and error fallbacks. The consumer provides:
 *  - chatEndpoint: API route URL
 *  - buildRequestBody: serializes domain-specific context into the POST body
 *  - canvasRef: optional canvas for screenshot capture
 */

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage } from './types'
import { captureScreenshot } from './captureScreenshot'

export interface UseCharacterChatOptions {
  /** API endpoint for chat streaming */
  chatEndpoint: string
  /** Build the request body from current messages + optional screenshot. */
  buildRequestBody: (
    messages: Array<{ role: string; content: string }>,
    screenshot: string | undefined,
  ) => Record<string, unknown>
  /** Canvas ref for screenshot capture (optional) */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
}

export interface UseCharacterChatReturn {
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

export function useCharacterChat(
  options: UseCharacterChatOptions,
): UseCharacterChatReturn {
  const { chatEndpoint, buildRequestBody, canvasRef } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

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

      // Capture screenshot
      const screenshot = canvasRef?.current
        ? (captureScreenshot(canvasRef.current) ?? undefined)
        : undefined

      // Build message history for API (without the empty assistant msg)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const body = buildRequestBody(apiMessages, screenshot)

      const fetchStream = async () => {
        try {
          const res = await fetch(chatEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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
          console.error('[character-chat] Stream error:', err)
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
    [isStreaming, messages, chatEndpoint, buildRequestBody, canvasRef],
  )

  return { messages, isStreaming, sendMessage, isOpen, open, close }
}
