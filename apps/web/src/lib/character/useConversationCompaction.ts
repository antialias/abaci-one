'use client'

/**
 * Async conversation compaction — summarizes the head of a conversation
 * in the background so API calls use a compact [summary, ...tail] view
 * instead of the full message history.
 *
 * The summarization is:
 * - Triggered when the head grows past a threshold
 * - Non-blocking — the current send uses whatever is cached
 * - Incremental — each summary builds on the previous one
 * - Shared — both text chat and voice use the same cached summary
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage } from './types'

export interface CompactionState {
  /** Cached summary of older messages (null if not yet summarized) */
  headSummary: string | null
  /** Index in the full messages array up to which the summary covers (exclusive) */
  coversUpTo: number
}

export interface UseConversationCompactionReturn extends CompactionState {
  /**
   * Build the compacted message array for API consumption.
   * Returns [summaryMessage, ...tailMessages] if a summary is cached,
   * or the full messages array if not.
   */
  compactForApi: (
    messages: ChatMessage[],
  ) => Array<{ role: string; content: string }>
  /**
   * Build compacted conversation lines for voice session history injection.
   * Returns formatted text suitable for sendSystemMessage().
   */
  compactForVoice: (messages: ChatMessage[]) => string
  /** Ref indicating whether a summarization request is currently in-flight */
  isSummarizingRef: React.RefObject<boolean>
  /** Manually trigger compaction of all messages before the given index */
  manualCompactUpTo: (index: number) => void
}

/** How many recent messages to keep verbatim in the tail */
const TAIL_SIZE = 15

/** How many new head messages must accumulate before re-summarizing */
const GROWTH_THRESHOLD = 10

/** Minimum total messages before compaction kicks in */
const MIN_MESSAGES = TAIL_SIZE + GROWTH_THRESHOLD

export function useConversationCompaction(
  messages: ChatMessage[],
): UseConversationCompactionReturn {
  const [headSummary, setHeadSummary] = useState<string | null>(null)
  const [coversUpTo, setCoversUpTo] = useState(0)
  const isSummarizingRef = useRef(false)
  // Track the message count at which we last triggered summarization
  // to avoid re-triggering on every render
  const lastTriggerCountRef = useRef(0)

  useEffect(() => {
    if (messages.length < MIN_MESSAGES) return
    if (isSummarizingRef.current) return

    const headSize = messages.length - TAIL_SIZE
    const newHeadMessages = headSize - coversUpTo
    if (newHeadMessages < GROWTH_THRESHOLD) return
    // Don't re-trigger for the same message count
    if (messages.length === lastTriggerCountRef.current) return

    lastTriggerCountRef.current = messages.length
    isSummarizingRef.current = true

    const messagesToSummarize = messages.slice(coversUpTo, headSize)
    const apiMessages = messagesToSummarize
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        content: m.isEvent ? `[Event: ${m.content}]` : m.content,
      }))

    // Fire and forget — result arrives async, next send uses it
    const summarize = async () => {
      try {
        console.log(
          '[compaction] summarizing %d messages (coversUpTo=%d, headSize=%d)',
          apiMessages.length,
          coversUpTo,
          headSize,
        )
        const res = await fetch('/api/chat/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            previousSummary: headSummary ?? undefined,
          }),
        })

        if (!res.ok) {
          console.warn('[compaction] summarization failed:', res.status)
          return
        }

        const data = await res.json()
        if (data.summary) {
          console.log(
            '[compaction] summary ready (%d chars), covers up to index %d',
            data.summary.length,
            headSize,
          )
          setHeadSummary(data.summary)
          setCoversUpTo(headSize)
        }
      } catch (err) {
        console.warn('[compaction] summarization error:', err)
      } finally {
        isSummarizingRef.current = false
      }
    }

    summarize()
    // Deliberately using messages.length (not messages) to avoid re-triggering
    // on every content change. The lastTriggerCountRef guard prevents duplicates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, coversUpTo, headSummary])

  const compactForApi = useCallback(
    (msgs: ChatMessage[]): Array<{ role: string; content: string }> => {
      const source =
        headSummary && coversUpTo > 0
          ? [
              {
                role: 'user' as const,
                content: `[CONVERSATION SUMMARY — this covers the earlier part of the conversation:]\n${headSummary}\n[END SUMMARY]`,
                isError: false,
                isEvent: false,
              } as ChatMessage,
              ...msgs.slice(coversUpTo),
            ]
          : msgs

      return source
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.role,
          content: m.isEvent ? `[CONSTRUCTION EVENT: ${m.content}]` : m.content,
        }))
    },
    [headSummary, coversUpTo],
  )

  const compactForVoice = useCallback(
    (msgs: ChatMessage[]): string => {
      const preamble = headSummary
        ? `[Summary of earlier conversation: ${headSummary}]\n\n`
        : ''

      const tail = (headSummary && coversUpTo > 0
        ? msgs.slice(coversUpTo)
        : msgs
      ).filter((m) => !m.isError)

      const lines = tail
        .map((m) => {
          if (m.isEvent) return `[Event: ${m.content}]`
          return `${m.role === 'user' ? 'Student' : 'Euclid'}: ${m.content}`
        })
        .join('\n')

      return `${preamble}${lines}`
    },
    [headSummary, coversUpTo],
  )

  const manualCompactUpTo = useCallback(
    (index: number) => {
      if (isSummarizingRef.current) return
      if (index <= 0 || index > messages.length) return

      isSummarizingRef.current = true
      const messagesToSummarize = messages.slice(0, index)
      const apiMessages = messagesToSummarize
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.role,
          content: m.isEvent ? `[Event: ${m.content}]` : m.content,
        }))

      const summarize = async () => {
        try {
          console.log(
            '[compaction] manual compact up to index %d (%d messages)',
            index,
            apiMessages.length,
          )
          const res = await fetch('/api/chat/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: apiMessages,
              previousSummary: undefined,
            }),
          })

          if (!res.ok) {
            console.warn('[compaction] manual summarization failed:', res.status)
            return
          }

          const data = await res.json()
          if (data.summary) {
            console.log(
              '[compaction] manual summary ready (%d chars), covers up to index %d',
              data.summary.length,
              index,
            )
            setHeadSummary(data.summary)
            setCoversUpTo(index)
          }
        } catch (err) {
          console.warn('[compaction] manual summarization error:', err)
        } finally {
          isSummarizingRef.current = false
        }
      }

      summarize()
    },
    [messages],
  )

  return { headSummary, coversUpTo, compactForApi, compactForVoice, isSummarizingRef, manualCompactUpTo }
}
