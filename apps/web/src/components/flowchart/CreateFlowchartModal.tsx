'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { css } from '../../../styled-system/css'
import { vstack } from '../../../styled-system/patterns'
import { SuggestionPanel } from './SuggestionPanel'

interface Suggestion {
  id: string
  title: string
  description: string
  emoji: string
  difficulty: string
  similarity: number
  source: 'hardcoded' | 'database'
}

interface CreateFlowchartModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal for creating a new custom flowchart.
 * Has two modes:
 * - Create mode: shows topic input, create button, and collapsed suggestions
 * - Browse mode: shows full list of similar flowcharts
 */
export function CreateFlowchartModal({ open, onOpenChange }: CreateFlowchartModalProps) {
  const router = useRouter()
  const [topicDescription, setTopicDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search for similar flowcharts
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if query is too short
    if (topicDescription.trim().length < 3) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    // Debounce the search by 500ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/flowcharts/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: topicDescription }),
        })

        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (err) {
        console.error('Failed to search for suggestions:', err)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [topicDescription])

  const handleUseFlowchart = useCallback(
    (flowchartId: string) => {
      onOpenChange(false)
      router.push(`/flowchart/${flowchartId}`)
    },
    [onOpenChange, router]
  )

  const handleCreateSession = useCallback(async () => {
    if (!topicDescription.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      // Create the session
      const response = await fetch('/api/flowchart-workshop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicDescription }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create session')
      }

      const { session } = await response.json()

      // Navigate to the workshop immediately
      // The workshop page will trigger generation and connect to the watch endpoint
      console.log(`[create-modal] Navigating to /flowchart/workshop/${session.id}`)
      router.push(`/flowchart/workshop/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
      setIsCreating(false)
    }
  }, [topicDescription, router])

  const handleClose = useCallback(() => {
    // Reset state when closing
    setTopicDescription('')
    setError(null)
    setIsCreating(false)
    setSuggestions([])
    setIsSearching(false)
    setShowAllSuggestions(false)
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            position: 'fixed',
            inset: 0,
            zIndex: 100,
          })}
        />
        <Dialog.Content
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: { base: 'white', _dark: 'gray.800' },
            borderRadius: '2xl',
            padding: '8',
            width: '90vw',
            maxWidth: '500px',
            maxHeight: '85vh',
            overflow: 'auto',
            zIndex: 101,
            boxShadow: 'xl',
            _focus: { outline: 'none' },
          })}
        >
          {showAllSuggestions ? (
            // Browse mode: show full list of suggestions
            <div className={vstack({ gap: '6', alignItems: 'stretch' })}>
              <Dialog.Title
                className={css({
                  fontSize: '2xl',
                  fontWeight: 'bold',
                  color: { base: 'gray.900', _dark: 'gray.100' },
                  textAlign: 'center',
                })}
              >
                Similar Flowcharts
              </Dialog.Title>

              <SuggestionPanel
                suggestions={suggestions}
                isLoading={isSearching}
                isExpanded={true}
                onUseFlowchart={handleUseFlowchart}
                onExpand={() => {}}
                onCollapse={() => setShowAllSuggestions(false)}
              />
            </div>
          ) : (
            // Create mode: show form with collapsed suggestions
            <div className={vstack({ gap: '6', alignItems: 'stretch' })}>
              <div className={vstack({ gap: '2', alignItems: 'center' })}>
                <Dialog.Title
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: { base: 'gray.900', _dark: 'gray.100' },
                    textAlign: 'center',
                  })}
                >
                  Create Your Own Flowchart
                </Dialog.Title>
                <Dialog.Description
                  className={css({
                    fontSize: 'md',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                    textAlign: 'center',
                  })}
                >
                  Describe the math concept you want to teach and AI will generate an interactive
                  flowchart for you.
                </Dialog.Description>
              </div>

              <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
                <label
                  htmlFor="topic"
                  className={css({
                    fontSize: 'md',
                    fontWeight: 'medium',
                    color: { base: 'gray.800', _dark: 'gray.200' },
                  })}
                >
                  What math concept do you want to teach?
                </label>
                <textarea
                  id="topic"
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  placeholder="e.g., Multiplying fractions by whole numbers for 4th graders, or Long division with remainders step by step..."
                  rows={4}
                  autoFocus
                  className={css({
                    width: '100%',
                    padding: '4',
                    borderRadius: 'lg',
                    border: '2px solid',
                    borderColor: { base: 'gray.300', _dark: 'gray.600' },
                    backgroundColor: { base: 'white', _dark: 'gray.900' },
                    color: { base: 'gray.900', _dark: 'gray.100' },
                    fontSize: 'md',
                    resize: 'vertical',
                    _focus: {
                      outline: 'none',
                      borderColor: { base: 'blue.500', _dark: 'blue.400' },
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
                    },
                    _placeholder: {
                      color: { base: 'gray.400', _dark: 'gray.500' },
                    },
                  })}
                />
                {error && (
                  <p
                    className={css({
                      color: { base: 'red.600', _dark: 'red.400' },
                      fontSize: 'sm',
                    })}
                  >
                    {error}
                  </p>
                )}
              </div>

              <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
                <button
                  onClick={handleCreateSession}
                  disabled={isCreating || !topicDescription.trim()}
                  className={css({
                    padding: '4',
                    borderRadius: 'lg',
                    backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                    color: 'white',
                    fontWeight: 'semibold',
                    fontSize: 'lg',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    _hover: {
                      backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {isCreating ? 'Creating...' : 'Create Flowchart'}
                </button>

                <SuggestionPanel
                  suggestions={suggestions}
                  isLoading={isSearching}
                  isExpanded={false}
                  onUseFlowchart={handleUseFlowchart}
                  onExpand={() => setShowAllSuggestions(true)}
                  onCollapse={() => {}}
                />

                <button
                  onClick={handleClose}
                  className={css({
                    padding: '3',
                    borderRadius: 'lg',
                    backgroundColor: 'transparent',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                    },
                  })}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
