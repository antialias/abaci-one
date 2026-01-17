'use client'

import { useState, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { getFlowchartList, getFlowchart } from '@/lib/flowcharts/definitions'
import { loadFlowchart } from '@/lib/flowcharts/loader'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'
import { FlowchartProblemInput, FlowchartWalker } from '@/components/flowchart'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

type ModalState =
  | { type: 'closed' }
  | { type: 'loading'; flowchartId: string }
  | { type: 'inputting'; flowchart: ExecutableFlowchart }
  | { type: 'walking'; flowchart: ExecutableFlowchart; problemInput: Record<string, ProblemValue> }
  | { type: 'error'; message: string }

export default function FlowchartPickerPage() {
  const flowcharts = getFlowchartList()
  const [modalState, setModalState] = useState<ModalState>({ type: 'closed' })

  // Load flowchart when modal opens
  useEffect(() => {
    if (modalState.type !== 'loading') return

    async function load() {
      const data = getFlowchart(modalState.flowchartId)
      if (!data) {
        setModalState({ type: 'error', message: `Flowchart not found` })
        return
      }

      try {
        const flowchart = await loadFlowchart(data.definition, data.mermaid)
        setModalState({ type: 'inputting', flowchart })
      } catch (error) {
        console.error('Error loading flowchart:', error)
        setModalState({ type: 'error', message: 'Failed to load flowchart' })
      }
    }

    load()
  }, [modalState])

  const handleCardClick = useCallback((flowchartId: string) => {
    setModalState({ type: 'loading', flowchartId })
  }, [])

  const handleProblemSubmit = useCallback(
    (values: Record<string, ProblemValue>) => {
      if (modalState.type !== 'inputting') return
      setModalState({
        type: 'walking',
        flowchart: modalState.flowchart,
        problemInput: values,
      })
    },
    [modalState]
  )

  const handleRestart = useCallback(() => {
    if (modalState.type !== 'walking') return
    setModalState({ type: 'inputting', flowchart: modalState.flowchart })
  }, [modalState])

  const handleClose = useCallback(() => {
    setModalState({ type: 'closed' })
  }, [])

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

      {/* Modal for flowchart interaction */}
      <Dialog.Root open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={css({
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              animation: 'fadeIn 0.2s ease-out',
            })}
          />
          <Dialog.Content
            className={css({
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
              borderRadius: '2xl',
              boxShadow: '2xl',
              width: '95vw',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              zIndex: 101,
              animation: 'scaleIn 0.2s ease-out',
              _focus: { outline: 'none' },
            })}
          >
            {/* Close button */}
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className={css({
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'full',
                  backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                  transition: 'all 0.15s',
                  zIndex: 10,
                  _hover: {
                    backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
                  },
                })}
              >
                ✕
              </button>
            </Dialog.Close>

            {/* Modal content */}
            <div className={css({ padding: '0' })}>
              {modalState.type === 'loading' && (
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '300px',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                  })}
                >
                  Loading...
                </div>
              )}

              {modalState.type === 'error' && (
                <div
                  className={vstack({
                    gap: '4',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '300px',
                    padding: '6',
                  })}
                >
                  <p
                    className={css({
                      color: { base: 'red.600', _dark: 'red.400' },
                      fontSize: 'lg',
                    })}
                  >
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
              )}

              {modalState.type === 'inputting' && (
                <FlowchartProblemInput
                  schema={modalState.flowchart.definition.problemInput}
                  onSubmit={handleProblemSubmit}
                  flowchart={modalState.flowchart}
                />
              )}

              {modalState.type === 'walking' && (
                <div className={css({ padding: '4' })}>
                  <FlowchartWalker
                    flowchart={modalState.flowchart}
                    problemInput={modalState.problemInput}
                    onComplete={handleClose}
                    onRestart={handleRestart}
                    onChangeProblem={handleRestart}
                  />
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
