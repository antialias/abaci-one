'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { getFlowchartList, getFlowchart } from '@/lib/flowcharts/definitions'
import { loadFlowchart } from '@/lib/flowcharts/loader'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'
import { FlowchartProblemInput } from '@/components/flowchart'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

type ModalState =
  | { type: 'closed' }
  | { type: 'loading'; flowchartId: string }
  | { type: 'inputting'; flowchartId: string; flowchart: ExecutableFlowchart }
  | { type: 'error'; flowchartId: string; message: string }

export default function FlowchartPickerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flowcharts = getFlowchartList()

  // The selected flowchart ID from URL query param
  const selectedId = searchParams.get('select')

  // Internal modal state (loading/inputting/error) - derived from URL + async loading
  const [modalState, setModalState] = useState<ModalState>({ type: 'closed' })

  // Sync modal state with URL query param
  useEffect(() => {
    if (!selectedId) {
      // URL has no selection - close modal
      setModalState({ type: 'closed' })
      return
    }

    // URL has a selection - check if we need to load it
    const needsLoad = modalState.type === 'closed' || modalState.flowchartId !== selectedId
    if (needsLoad) {
      // Start loading the newly selected flowchart
      setModalState({ type: 'loading', flowchartId: selectedId })
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load flowchart when modal enters loading state
  useEffect(() => {
    if (modalState.type !== 'loading') return

    const flowchartId = modalState.flowchartId

    async function load() {
      const data = getFlowchart(flowchartId)
      if (!data) {
        setModalState({ type: 'error', flowchartId, message: `Flowchart not found` })
        return
      }

      try {
        const flowchart = await loadFlowchart(data.definition, data.mermaid)
        setModalState({ type: 'inputting', flowchartId, flowchart })
      } catch (error) {
        console.error('Error loading flowchart:', error)
        setModalState({ type: 'error', flowchartId, message: 'Failed to load flowchart' })
      }
    }

    load()
  }, [modalState])

  // Open modal by updating URL (adds to browser history)
  const handleCardClick = useCallback(
    (flowchartId: string) => {
      router.push(`/flowchart?select=${flowchartId}`, { scroll: false })
    },
    [router]
  )

  const handleProblemSubmit = useCallback(
    (values: Record<string, ProblemValue>) => {
      if (modalState.type !== 'inputting') return

      // Store problem values in sessionStorage for the walker page to pick up
      const storageKey = `flowchart-problem-${modalState.flowchartId}`
      sessionStorage.setItem(storageKey, JSON.stringify(values))

      // Navigate to the walker page
      router.push(`/flowchart/${modalState.flowchartId}`)
    },
    [modalState, router]
  )

  // Close modal by updating URL (replaces current history entry to avoid back-to-modal loop)
  const handleClose = useCallback(() => {
    router.replace('/flowchart', { scroll: false })
  }, [router])

  const isModalOpen = modalState.type !== 'closed'

  return (
    <div className={vstack({ gap: '8', padding: '6', alignItems: 'center', minHeight: '100vh' })}>
      <header className={vstack({ gap: '2', alignItems: 'center' })}>
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        >
          Flowchart Practice
        </h1>
        <p
          className={css({
            fontSize: 'lg',
            color: { base: 'gray.600', _dark: 'gray.400' },
            textAlign: 'center',
            maxWidth: '500px',
          })}
        >
          Step through math procedures one step at a time. Perfect for learning new algorithms!
        </p>
      </header>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '4',
          width: '100%',
          maxWidth: '800px',
        })}
      >
        {flowcharts.map((flowchart) => (
          <button
            key={flowchart.id}
            onClick={() => handleCardClick(flowchart.id)}
            className={css({
              display: 'block',
              padding: '6',
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              borderRadius: 'xl',
              boxShadow: 'md',
              border: '2px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              transition: 'all 0.2s',
              textDecoration: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
              _hover: {
                borderColor: { base: 'blue.400', _dark: 'blue.500' },
                transform: 'translateY(-2px)',
                boxShadow: 'lg',
              },
            })}
          >
            <div className={hstack({ gap: '4', alignItems: 'flex-start' })}>
              <span className={css({ fontSize: '3xl' })}>{flowchart.emoji}</span>
              <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
                <h2
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    color: { base: 'gray.900', _dark: 'gray.100' },
                  })}
                >
                  {flowchart.title}
                </h2>
                <p
                  className={css({
                    fontSize: 'sm',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                  })}
                >
                  {flowchart.description}
                </p>
                <span
                  className={css({
                    fontSize: 'xs',
                    paddingX: '2',
                    paddingY: '1',
                    borderRadius: 'full',
                    backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                    color: { base: 'blue.700', _dark: 'blue.300' },
                    marginTop: '1',
                  })}
                >
                  {flowchart.difficulty}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <footer
        className={css({
          marginTop: 'auto',
          padding: '4',
          color: { base: 'gray.500', _dark: 'gray.500' },
          fontSize: 'sm',
        })}
      >
        More flowcharts coming soon!
      </footer>

      {/* Modal for problem selection - state driven by URL query param */}
      <Dialog.Root
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) handleClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            className={css({
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              position: 'fixed',
              inset: 0,
              zIndex: 100,
            })}
          />

          {modalState.type === 'loading' && (
            <Dialog.Content
              className={css({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: { base: 'white', _dark: 'gray.800' },
                borderRadius: '2xl',
                padding: '8',
                zIndex: 101,
                _focus: { outline: 'none' },
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                })}
              >
                Loading...
              </div>
            </Dialog.Content>
          )}

          {modalState.type === 'error' && (
            <Dialog.Content
              className={css({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: { base: 'white', _dark: 'gray.800' },
                borderRadius: '2xl',
                padding: '8',
                zIndex: 101,
                _focus: { outline: 'none' },
              })}
            >
              <div className={vstack({ gap: '4', alignItems: 'center' })}>
                <p className={css({ color: { base: 'red.600', _dark: 'red.400' } })}>
                  {modalState.message}
                </p>
                <button
                  onClick={handleClose}
                  className={css({
                    paddingX: '4',
                    paddingY: '2',
                    borderRadius: 'md',
                    backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                    color: { base: 'gray.800', _dark: 'gray.200' },
                    border: 'none',
                    cursor: 'pointer',
                  })}
                >
                  Close
                </button>
              </div>
            </Dialog.Content>
          )}

          {modalState.type === 'inputting' && (
            <FlowchartProblemInput
              schema={modalState.flowchart.definition.problemInput}
              onSubmit={handleProblemSubmit}
              flowchart={modalState.flowchart}
              asModal
              onClose={handleClose}
            />
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
