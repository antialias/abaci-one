'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { getFlowchartList, getFlowchart } from '@/lib/flowcharts/definitions'
import { loadFlowchart } from '@/lib/flowcharts/loader'
import { downloadFlowchartPDF } from '@/lib/flowcharts/pdf-export'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'
import {
  FlowchartProblemInput,
  FlowchartCard,
  CreateFlowchartButton,
  CreateFlowchartModal,
  DeleteToastContainer,
  type PendingDeletion,
} from '@/components/flowchart'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

type ModalState =
  | { type: 'closed' }
  | { type: 'loading'; flowchartId: string }
  | { type: 'inputting'; flowchartId: string; flowchart: ExecutableFlowchart }
  | { type: 'error'; flowchartId: string; message: string }

type FilterType = 'all' | 'published' | 'drafts'

interface WorkshopSession {
  id: string
  state: string
  topicDescription: string | null
  draftTitle: string | null
  draftEmoji: string | null
  createdAt: string
  updatedAt: string
}

export default function FlowchartPickerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flowcharts = getFlowchartList()

  // The selected flowchart ID from URL query param
  const selectedId = searchParams.get('select')

  // Internal modal state (loading/inputting/error) - derived from URL + async loading
  const [modalState, setModalState] = useState<ModalState>({ type: 'closed' })

  // Create flowchart modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Filter state
  const [filter, setFilter] = useState<FilterType>('all')

  // Draft sessions state
  const [draftSessions, setDraftSessions] = useState<WorkshopSession[]>([])
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true)

  // Pending deletions for undo functionality
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([])

  // PDF download state (tracks which flowchart is currently being exported)
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null)

  // Load draft sessions
  useEffect(() => {
    async function loadDrafts() {
      try {
        const response = await fetch('/api/flowchart-workshop/sessions')
        if (response.ok) {
          const data = await response.json()
          setDraftSessions(data.sessions || [])
        }
      } catch (err) {
        console.error('Failed to load draft sessions:', err)
      } finally {
        setIsLoadingDrafts(false)
      }
    }
    loadDrafts()
  }, [])

  // Handle draft session actions
  const handleResumeDraft = useCallback(
    (sessionId: string) => {
      router.push(`/flowchart/workshop/${sessionId}`)
    },
    [router]
  )

  // Handle remixing a built-in flowchart
  const handleRemix = useCallback(
    async (flowchartId: string) => {
      try {
        const response = await fetch('/api/flowchart-workshop/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remixFromId: flowchartId }),
        })

        if (!response.ok) {
          throw new Error('Failed to create remix session')
        }

        const { session } = await response.json()
        router.push(`/flowchart/workshop/${session.id}`)
      } catch (err) {
        console.error('Failed to remix flowchart:', err)
      }
    },
    [router]
  )

  // Handle PDF download for a built-in flowchart
  const handleDownloadPDF = useCallback(async (flowchartId: string) => {
    const flowchartData = getFlowchart(flowchartId)
    if (!flowchartData) {
      console.error('Flowchart not found:', flowchartId)
      return
    }

    setExportingPdfId(flowchartId)
    try {
      await downloadFlowchartPDF(flowchartData.mermaid, {
        title: flowchartData.meta.title,
        description: flowchartData.meta.description,
        flowchartId,
      })
    } catch (err) {
      console.error('Failed to export PDF:', err)
    } finally {
      setExportingPdfId(null)
    }
  }, [])

  // Start deletion with undo option
  const handleDeleteDraft = useCallback(
    (sessionId: string) => {
      const session = draftSessions.find((s) => s.id === sessionId)
      if (!session) return

      // Add to pending deletions
      setPendingDeletions((prev) => [
        ...prev,
        {
          id: sessionId,
          title: session.draftTitle || session.topicDescription || 'Untitled',
          createdAt: Date.now(),
        },
      ])

      // Hide from list immediately
      setDraftSessions((prev) => prev.filter((s) => s.id !== sessionId))
    },
    [draftSessions]
  )

  // Undo deletion
  const handleUndoDelete = useCallback((deletion: PendingDeletion) => {
    // Remove from pending
    setPendingDeletions((prev) => prev.filter((d) => d.id !== deletion.id))

    // Re-fetch sessions to restore the item
    fetch('/api/flowchart-workshop/sessions')
      .then((res) => res.json())
      .then((data) => setDraftSessions(data.sessions || []))
      .catch(console.error)
  }, [])

  // Confirm deletion (actually delete)
  const handleConfirmDelete = useCallback(async (deletion: PendingDeletion) => {
    // Remove from pending
    setPendingDeletions((prev) => prev.filter((d) => d.id !== deletion.id))

    // Actually delete
    try {
      await fetch(`/api/flowchart-workshop/sessions/${deletion.id}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }, [])

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
      <header className={vstack({ gap: '4', alignItems: 'center' })}>
        <div className={vstack({ gap: '2', alignItems: 'center' })}>
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
        </div>

        {/* Filter buttons */}
        <div
          className={hstack({
            gap: '2',
            padding: '1',
            borderRadius: 'lg',
            backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
          })}
        >
          {[
            { value: 'all' as const, label: 'All' },
            { value: 'published' as const, label: 'Published' },
            {
              value: 'drafts' as const,
              label: `Drafts${draftSessions.length > 0 ? ` (${draftSessions.length})` : ''}`,
            },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={css({
                padding: '2 4',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor:
                  filter === option.value ? { base: 'white', _dark: 'gray.700' } : 'transparent',
                color:
                  filter === option.value
                    ? { base: 'gray.900', _dark: 'gray.100' }
                    : { base: 'gray.600', _dark: 'gray.400' },
                boxShadow: filter === option.value ? 'sm' : 'none',
                _hover: {
                  color: { base: 'gray.900', _dark: 'gray.100' },
                },
              })}
            >
              {option.label}
            </button>
          ))}
        </div>
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
        {/* Create Your Own button - appears first (except when showing only published) */}
        {filter !== 'published' && (
          <CreateFlowchartButton onClick={() => setIsCreateModalOpen(true)} />
        )}

        {/* Built-in (published) flowcharts */}
        {filter !== 'drafts' &&
          flowcharts.map((flowchart) => (
            <FlowchartCard
              key={flowchart.id}
              title={flowchart.title}
              description={flowchart.description}
              emoji={flowchart.emoji}
              difficulty={flowchart.difficulty}
              onClick={() => handleCardClick(flowchart.id)}
              actions={[
                {
                  label: exportingPdfId === flowchart.id ? 'Exporting...' : 'PDF',
                  onClick: () => handleDownloadPDF(flowchart.id),
                  variant: 'secondary',
                  disabled: exportingPdfId === flowchart.id,
                },
                {
                  label: 'Remix',
                  onClick: () => handleRemix(flowchart.id),
                  variant: 'secondary',
                },
              ]}
            />
          ))}

        {/* Draft flowcharts */}
        {filter !== 'published' &&
          draftSessions.map((session) => (
            <FlowchartCard
              key={session.id}
              title={session.draftTitle || session.topicDescription || 'Untitled'}
              emoji={session.draftEmoji || '📝'}
              status={session.state === 'refining' ? 'In Progress' : 'Draft'}
              subtitle={`Updated ${new Date(session.updatedAt).toLocaleDateString()}`}
              onClick={() => handleResumeDraft(session.id)}
              actions={[
                {
                  label: 'Edit',
                  onClick: () => handleResumeDraft(session.id),
                  variant: 'primary',
                },
                {
                  label: 'Delete',
                  onClick: () => handleDeleteDraft(session.id),
                  variant: 'danger',
                },
              ]}
            />
          ))}

        {/* Empty state for drafts filter */}
        {filter === 'drafts' && !isLoadingDrafts && draftSessions.length === 0 && (
          <div
            className={css({
              gridColumn: '1 / -1',
              padding: '8',
              textAlign: 'center',
              color: { base: 'gray.500', _dark: 'gray.400' },
            })}
          >
            <p>No drafts yet. Click the + button to create your first flowchart!</p>
          </div>
        )}
      </div>

      {/* Delete toast for undo functionality */}
      <DeleteToastContainer
        deletions={pendingDeletions}
        onUndo={handleUndoDelete}
        onConfirm={handleConfirmDelete}
      />

      {/* Modal for creating new flowchart */}
      <CreateFlowchartModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />

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
