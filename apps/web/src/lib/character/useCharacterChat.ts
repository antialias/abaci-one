'use client'

/**
 * Generic SSE streaming chat hook for character conversations.
 *
 * Handles message state, open/close, SSE stream parsing, abort control,
 * tool call continuation, and error fallbacks. The consumer provides:
 *  - chatEndpoint: API route URL
 *  - buildRequestBody: serializes domain-specific context into the POST body
 *  - canvasRef: optional canvas for screenshot capture
 *  - tools/onToolCall: optional tool support for author mode
 */

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage } from './types'
import { captureScreenshot } from './captureScreenshot'
import { useConversationCompaction, type CompactionState } from './useConversationCompaction'
import type { RealtimeTool } from '@/lib/voice/types'

export interface UseCharacterChatOptions {
  /** API endpoint for chat streaming */
  chatEndpoint: string
  /** Build the request body from current messages + optional screenshot. */
  buildRequestBody: (
    messages: Array<{ role: string; content: string; toolCallId?: string }>,
    screenshot: string | undefined
  ) => Record<string, unknown>
  /** Canvas ref for screenshot capture (optional) */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  /** Called after a user message is added to the chat (e.g. for async markup). */
  onUserMessageAdded?: (messageId: string, content: string) => void
  /** Tools available for the model to call. When set, tool call SSE events are parsed. */
  tools?: RealtimeTool[]
  /** Handle a tool call from the model. Returns the tool result (JSON-serializable). */
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>
}

export interface UseCharacterChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (text: string) => void
  /** Cold-start the conversation: Euclid speaks first with no visible user message. */
  coldStart: () => void
  /** Inject an external message (e.g., voice transcript) into the conversation. */
  addMessage: (msg: ChatMessage) => void
  /** Insert a message before any trailing event messages (use for speech that started before events arrived). */
  addMessageBeforeTrailingEvents: (msg: ChatMessage) => void
  /** Replace all trailing event messages with this one, or remove them if null. */
  setTrailingEvent: (msg: ChatMessage | null) => void
  /** Update the content of an existing message by ID (used for async markup). */
  updateMessageContent: (id: string, content: string) => void
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

/** Describe a tool call for display in chat. */
function describeToolAction(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'place_point':
      return `Place point${args.label ? ` ${args.label}` : ''} at (${args.x}, ${args.y})`
    case 'postulate_1':
      return `Post.1: Segment ${args.from_label}${args.to_label}`
    case 'postulate_2':
      return `Post.2: Extend ${args.base_label}${args.through_label}`
    case 'postulate_3':
      return `Post.3: Circle centered at ${args.center_label} through ${args.radius_point_label}`
    case 'mark_intersection':
      return `Intersection of ${args.of_a} and ${args.of_b}`
    case 'apply_proposition':
      return `I.${args.prop_id}: Apply to ${args.input_labels}`
    case 'declare_equality':
      return `${args.statement}`
    case 'declare_angle_equality':
      return `${args.statement}`
    case 'undo_last':
      return 'Undo last action'
    case 'highlight':
      return `Highlight ${args.entity_type} ${args.labels}`
    default:
      return `${name}(${JSON.stringify(args).slice(0, 60)})`
  }
}

interface ToolCallEvent {
  callId: string
  name: string
  arguments: Record<string, unknown>
}

export function useCharacterChat(options: UseCharacterChatOptions): UseCharacterChatReturn {
  const { chatEndpoint, buildRequestBody, canvasRef, onUserMessageAdded, tools, onToolCall } =
    options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Refs for tool continuation — we need stable references for the async loop
  const toolsRef = useRef(tools)
  toolsRef.current = tools
  const onToolCallRef = useRef(onToolCall)
  onToolCallRef.current = onToolCall
  const buildRequestBodyRef = useRef(buildRequestBody)
  buildRequestBodyRef.current = buildRequestBody
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // Async conversation compaction — summarizes old messages in the background
  const compaction = useConversationCompaction(messages)
  const compactForApiRef = useRef(compaction.compactForApi)
  compactForApiRef.current = compaction.compactForApi

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const addMessageBeforeTrailingEvents = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      // Find where trailing event messages start
      let i = prev.length
      while (i > 0 && prev[i - 1].isEvent) i--
      // Insert before the trailing events
      return [...prev.slice(0, i), msg, ...prev.slice(i)]
    })
  }, [])

  const setTrailingEvent = useCallback((msg: ChatMessage | null) => {
    setMessages((prev) => {
      // Strip all trailing event messages
      let i = prev.length
      while (i > 0 && prev[i - 1].isEvent) i--
      return msg ? [...prev.slice(0, i), msg] : prev.slice(0, i)
    })
  }, [])

  const updateMessageContent = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)))
  }, [])

  /**
   * Shared streaming logic: fires the API request and streams deltas.
   * Returns collected tool calls (if any) so the caller can handle continuation.
   */
  const streamResponseAsync = useCallback(
    async (
      body: Record<string, unknown>,
      assistantMsgId: string,
      abortController: AbortController
    ): Promise<ToolCallEvent[]> => {
      const toolCalls: ToolCallEvent[] = []

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
          return []
        }

        const reader = res.body?.getReader()
        if (!reader) {
          console.error('[character-chat] no reader from response body')
          return []
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
              const event = JSON.parse(data) as {
                text?: string
                error?: string
                toolCall?: ToolCallEvent
              }
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
              } else if (event.toolCall) {
                toolCalls.push(event.toolCall)
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
        if ((err as Error).name === 'AbortError') return []
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
      }

      return toolCalls
    },
    [chatEndpoint]
  )

  /**
   * Execute tool calls from the model, add action messages, and send continuation.
   * Loops until the model produces text output (no more tool calls) or max iterations.
   */
  const handleToolContinuation = useCallback(
    async (
      initialToolCalls: ToolCallEvent[],
      apiMessages: Array<{ role: string; content: string; toolCallId?: string }>,
      abortController: AbortController,
      screenshot: string | undefined
    ) => {
      let pendingToolCalls = initialToolCalls
      let iteration = 0
      const MAX_ITERATIONS = 10

      while (pendingToolCalls.length > 0 && iteration < MAX_ITERATIONS) {
        iteration++
        console.log(
          '[character-chat] tool continuation iteration %d, %d tool calls',
          iteration,
          pendingToolCalls.length
        )

        // Execute each tool call and collect results
        const toolResults: Array<{ callId: string; name: string; result: unknown }> = []
        for (const tc of pendingToolCalls) {
          // Add tool action message to chat
          const actionDesc = describeToolAction(tc.name, tc.arguments)
          const actionMsg: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: actionDesc,
            timestamp: Date.now(),
            isToolAction: true,
          }
          setMessages((prev) => [...prev, actionMsg])

          // Execute the tool
          let result: unknown = { success: false, error: 'No tool handler' }
          if (onToolCallRef.current) {
            try {
              result = await onToolCallRef.current(tc.name, tc.arguments)
            } catch (err) {
              result = { success: false, error: String(err) }
            }
          }
          toolResults.push({ callId: tc.callId, name: tc.name, result })
        }

        // Build continuation messages: append tool results
        const continuationMessages = [
          ...apiMessages,
          // The tool call items are implicit in the Responses API (the model already emitted them)
          // We just need to send function_call_output items
          ...toolResults.map((tr) => ({
            role: 'tool' as const,
            content: JSON.stringify(tr.result),
            toolCallId: tr.callId,
          })),
        ]

        // Create a new assistant message for the continuation response
        const continuationMsgId = generateId()
        const continuationMsg: ChatMessage = {
          id: continuationMsgId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, continuationMsg])

        // Send continuation request
        const body = buildRequestBodyRef.current(continuationMessages, screenshot)
        pendingToolCalls = await streamResponseAsync(body, continuationMsgId, abortController)

        // Update apiMessages for potential next iteration
        apiMessages = continuationMessages
      }

      if (iteration >= MAX_ITERATIONS) {
        console.warn('[character-chat] max tool continuation iterations reached')
      }
    },
    [streamResponseAsync]
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
      onUserMessageAdded?.(userMsg.id, userMsg.content)

      const abortController = new AbortController()
      abortRef.current = abortController

      const screenshot = canvasRef?.current
        ? (captureScreenshot(canvasRef.current) ?? undefined)
        : undefined

      const apiMessages = compaction.compactForApi([...messages, userMsg])
      const body = buildRequestBody(apiMessages, screenshot)

      console.log(
        '[character-chat] sendMessage: endpoint=%s, messageCount=%d, hasScreenshot=%s',
        chatEndpoint,
        apiMessages.length,
        !!screenshot
      )

      // Stream response and handle tool calls
      const run = async () => {
        try {
          const toolCalls = await streamResponseAsync(body, assistantMsg.id, abortController)
          if (toolCalls.length > 0 && onToolCallRef.current) {
            await handleToolContinuation(toolCalls, apiMessages, abortController, screenshot)
          }
        } finally {
          setIsStreaming(false)
        }
      }
      run()
    },
    [
      isStreaming,
      messages,
      chatEndpoint,
      buildRequestBody,
      canvasRef,
      compaction.compactForApi,
      streamResponseAsync,
      handleToolContinuation,
      onUserMessageAdded,
    ]
  )

  const coldStart = useCallback(() => {
    // Allow cold-start if no real conversation has happened (events are OK)
    const hasConversation = messages.some((m) => !m.isEvent)
    if (isStreaming || hasConversation) return

    if (abortRef.current) {
      abortRef.current.abort()
    }

    // Hidden user message — sent to API but not shown in chat UI
    const hiddenUserMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content:
        '[The student has just opened the chat. Proactively help them — assess where they are in the construction and tell them what to do next. Do NOT greet them or introduce yourself.]',
      timestamp: Date.now(),
    }

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    // Keep existing event messages, append the assistant response
    setMessages((prev) => [...prev, assistantMsg])
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

    console.log(
      '[character-chat] coldStart: endpoint=%s, events=%d, hasScreenshot=%s',
      chatEndpoint,
      eventMessages.length,
      !!screenshot
    )

    const run = async () => {
      try {
        const toolCalls = await streamResponseAsync(body, assistantMsg.id, abortController)
        if (toolCalls.length > 0 && onToolCallRef.current) {
          await handleToolContinuation(toolCalls, apiMessages, abortController, screenshot)
        }
      } finally {
        setIsStreaming(false)
      }
    }
    run()
  }, [
    isStreaming,
    messages,
    chatEndpoint,
    buildRequestBody,
    canvasRef,
    streamResponseAsync,
    handleToolContinuation,
    compaction.compactForApi,
  ])

  return {
    messages,
    isStreaming,
    sendMessage,
    coldStart,
    addMessage,
    addMessageBeforeTrailingEvents,
    setTrailingEvent,
    updateMessageContent,
    isOpen,
    open,
    close,
    compaction: {
      headSummary: compaction.headSummary,
      coversUpTo: compaction.coversUpTo,
      compactForVoice: compaction.compactForVoice,
      isSummarizingRef: compaction.isSummarizingRef,
      manualCompactUpTo: compaction.manualCompactUpTo,
    },
  }
}
