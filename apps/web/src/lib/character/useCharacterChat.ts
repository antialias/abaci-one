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
import { useConversationCompaction, type CompactionState } from './useConversationCompaction'

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
  /** Cold-start the conversation: Euclid speaks first with no visible user message. */
  coldStart: () => void
  /** Inject an external message (e.g., voice transcript) into the conversation. */
  addMessage: (msg: ChatMessage) => void
  /** Replace all trailing event messages with this one, or remove them if null. */
  setTrailingEvent: (msg: ChatMessage | null) => void
  isOpen: boolean
  open: () => void
  close: () => void
  /** Conversation compaction state — used by voice to get compacted history. */
  compaction: CompactionState & {
    compactForVoice: (messages: ChatMessage[]) => string
    isSummarizingRef: React.RefObject<boolean>
    manualCompactUpTo: (index: number) => void
  }
}

let nextId = 0
export function generateId(): string {
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

  // Async conversation compaction — summarizes old messages in the background
  const compaction = useConversationCompaction(messages)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const setTrailingEvent = useCallback((msg: ChatMessage | null) => {
    setMessages(prev => {
      // Strip all trailing event messages
      let i = prev.length
      while (i > 0 && prev[i - 1].isEvent) i--
      return msg ? [...prev.slice(0, i), msg] : prev.slice(0, i)
    })
  }, [])

  /** Shared streaming logic: fires the API request and streams deltas into assistantMsg. */
  const streamResponse = useCallback(
    (body: Record<string, unknown>, assistantMsgId: string, abortController: AbortController) => {
      const fetchStream = async () => {
        try {
          console.log('[character-chat] fetching stream...')
          const res = await fetch(chatEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: abortController.signal,
          })

          console.log('[character-chat] response status: %d, ok: %s', res.status, res.ok)

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            console.error('[character-chat] API error:', err)
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last.id === assistantMsgId) {
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
            console.error('[character-chat] no reader from response body')
            setIsStreaming(false)
            return
          }
          console.log('[character-chat] got reader, starting stream...')

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
                const event = JSON.parse(data) as { text?: string; error?: string }
                console.log('[character-chat] SSE event:', data.slice(0, 100))
                if (event.error) {
                  setMessages((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last.id === assistantMsgId) {
                      updated[updated.length - 1] = {
                        ...last,
                        content: event.error!,
                        isError: true,
                      }
                    }
                    return updated
                  })
                } else if (event.text) {
                  setMessages((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last.id === assistantMsgId) {
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
            if (last.id === assistantMsgId && !last.content) {
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
    [chatEndpoint],
  )

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return

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

      const screenshot = canvasRef?.current
        ? (captureScreenshot(canvasRef.current) ?? undefined)
        : undefined

      const apiMessages = compaction.compactForApi([...messages, userMsg])
      const body = buildRequestBody(apiMessages, screenshot)

      console.log('[character-chat] sendMessage: endpoint=%s, messageCount=%d, hasScreenshot=%s', chatEndpoint, apiMessages.length, !!screenshot)
      console.log('[character-chat] request body keys:', Object.keys(body).join(', '))

      streamResponse(body, assistantMsg.id, abortController)
    },
    [isStreaming, messages, chatEndpoint, buildRequestBody, canvasRef, compaction.compactForApi, streamResponse],
  )

  const coldStart = useCallback(
    () => {
      // Allow cold-start if no real conversation has happened (events are OK)
      const hasConversation = messages.some(m => !m.isEvent)
      if (isStreaming || hasConversation) return

      if (abortRef.current) {
        abortRef.current.abort()
      }

      // Hidden user message — sent to API but not shown in chat UI
      const hiddenUserMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: '[The student has just opened the chat. Proactively help them — assess where they are in the construction and tell them what to do next. Do NOT greet them or introduce yourself.]',
        timestamp: Date.now(),
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }

      // Keep existing event messages, append the assistant response
      setMessages(prev => [...prev, assistantMsg])
      setIsStreaming(true)

      const abortController = new AbortController()
      abortRef.current = abortController

      const screenshot = canvasRef?.current
        ? (captureScreenshot(canvasRef.current) ?? undefined)
        : undefined

      // Include existing events + hidden prompt so the API sees construction history
      const eventMessages = compaction.compactForApi(messages)
      const apiMessages = [...eventMessages, { role: 'user', content: hiddenUserMsg.content }]
      const body = buildRequestBody(apiMessages, screenshot)

      console.log('[character-chat] coldStart: endpoint=%s, events=%d, hasScreenshot=%s', chatEndpoint, eventMessages.length, !!screenshot)

      streamResponse(body, assistantMsg.id, abortController)
    },
    [isStreaming, messages, chatEndpoint, buildRequestBody, canvasRef, streamResponse, compaction.compactForApi],
  )

  return {
    messages, isStreaming, sendMessage, coldStart, addMessage, setTrailingEvent, isOpen, open, close,
    compaction: {
      headSummary: compaction.headSummary,
      coversUpTo: compaction.coversUpTo,
      compactForVoice: compaction.compactForVoice,
      isSummarizingRef: compaction.isSummarizingRef,
      manualCompactUpTo: compaction.manualCompactUpTo,
    },
  }
}
