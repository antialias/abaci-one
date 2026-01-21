'use client'

import { useState, useCallback, useMemo, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'
import type { GeneratedExample } from '@/lib/flowcharts/loader'
import type { DiagnosticReport } from '@/lib/flowcharts/doctor'
import { PracticeTab } from './PracticeTab'
import { FlowchartTab } from './FlowchartTab'
import { WorksheetTab } from './WorksheetTab'
import { DiagnosticAlert, DiagnosticList } from './FlowchartDiagnostics'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

export type ModalTab = 'practice' | 'flowchart' | 'worksheet'

interface FlowchartModalProps {
  /** The loaded flowchart to display */
  flowchart: ExecutableFlowchart
  /** Called when a problem is selected to start practicing */
  onSubmit: (values: Record<string, ProblemValue>) => void
  /** Called when the modal should close */
  onClose?: () => void
  /** Optional share URL for the flowchart */
  shareUrl?: string
  /** Initial tab to show */
  defaultTab?: ModalTab
  /** Generated examples from parent (cached) */
  examples?: GeneratedExample[]
  /** Called when examples are generated (for parent caching) */
  onExamplesGenerated?: (examples: GeneratedExample[]) => void
  /** Tier counts for worksheet tab */
  tierCounts?: { easy: number; medium: number; hard: number }
  /** Optional diagnostic report to show health issues */
  diagnosticReport?: DiagnosticReport
  /** Flowchart ID (for workshop navigation) */
  flowchartId?: string
  /** Whether this is a database flowchart owned by current user */
  isOwnedByUser?: boolean
  /** Source of the flowchart */
  source?: 'hardcoded' | 'database'
}

/**
 * Modal component for flowcharts with three tabs:
 * - Practice: Select problems from generated examples
 * - Flowchart: View mermaid diagram + download PDF
 * - Worksheet: Generate PDF worksheets with difficulty controls
 */
export const FlowchartModal = forwardRef<HTMLDivElement, FlowchartModalProps>(
  function FlowchartModal(
    {
      flowchart,
      onSubmit,
      onClose,
      shareUrl,
      defaultTab = 'practice',
      examples: initialExamples = [],
      onExamplesGenerated,
      tierCounts: externalTierCounts,
      diagnosticReport,
      flowchartId,
      isOwnedByUser,
      source,
    },
    ref
  ) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<ModalTab>(defaultTab)
    const [showDiagnosticDetails, setShowDiagnosticDetails] = useState(false)
    const [isCreatingWorkshop, setIsCreatingWorkshop] = useState(false)

    // Handler to create a workshop session for editing (user's own flowchart)
    const handleEdit = useCallback(async () => {
      if (!flowchartId || isCreatingWorkshop) return

      setIsCreatingWorkshop(true)
      try {
        const response = await fetch('/api/flowchart-workshop/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editPublishedId: flowchartId }),
        })

        if (!response.ok) {
          throw new Error('Failed to create edit session')
        }

        const data = await response.json()
        onClose?.()
        router.push(`/flowchart/workshop/${data.session.id}`)
      } catch (error) {
        console.error('Failed to start editing:', error)
        setIsCreatingWorkshop(false)
      }
    }, [flowchartId, isCreatingWorkshop, onClose, router])

    // Handler to create a remix session
    const handleRemix = useCallback(async () => {
      if (!flowchartId || isCreatingWorkshop) return

      setIsCreatingWorkshop(true)
      try {
        const response = await fetch('/api/flowchart-workshop/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remixFromId: flowchartId }),
        })

        if (!response.ok) {
          throw new Error('Failed to create remix session')
        }

        const data = await response.json()
        onClose?.()
        router.push(`/flowchart/workshop/${data.session.id}`)
      } catch (error) {
        console.error('Failed to remix flowchart:', error)
        setIsCreatingWorkshop(false)
      }
    }, [flowchartId, isCreatingWorkshop, onClose, router])

    // Handler to create a workshop session and navigate to it (for fixing diagnostics)
    const handleFixInWorkshop = useCallback(async () => {
      if (!flowchartId || isCreatingWorkshop) return

      setIsCreatingWorkshop(true)
      try {
        // Build the request body based on ownership
        const body: Record<string, string> = {}

        if (source === 'database' && isOwnedByUser) {
          // User owns this published flowchart - edit in place
          body.editPublishedId = flowchartId
        } else if (source === 'database') {
          // Someone else's flowchart - remix it
          body.remixFromId = flowchartId
        } else {
          // Hardcoded flowchart - remix it
          body.remixFromId = flowchartId
        }

        const response = await fetch('/api/flowchart-workshop/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          throw new Error('Failed to create workshop session')
        }

        const data = await response.json()
        const sessionId = data.session.id

        // Close modal and navigate to workshop
        onClose?.()
        router.push(`/flowchart/workshop/${sessionId}`)
      } catch (error) {
        console.error('Failed to create workshop session:', error)
        setIsCreatingWorkshop(false)
      }
    }, [flowchartId, isOwnedByUser, source, isCreatingWorkshop, onClose, router])

    // Track examples internally so worksheet tab can access them after PracticeTab generates them
    const [internalExamples, setInternalExamples] = useState<GeneratedExample[]>(initialExamples)

    // Handle examples being generated by PracticeTab
    const handleExamplesGenerated = useCallback(
      (newExamples: GeneratedExample[]) => {
        setInternalExamples(newExamples)
        onExamplesGenerated?.(newExamples)
      },
      [onExamplesGenerated]
    )

    // Calculate tier counts from examples if not provided externally
    const tierCounts = useMemo(() => {
      if (externalTierCounts) return externalTierCounts
      if (internalExamples.length === 0) return { easy: 0, medium: 0, hard: 0 }

      // Calculate difficulty range
      const scores = internalExamples.map(
        (ex) => ex.complexity.decisions + ex.complexity.checkpoints
      )
      const min = Math.min(...scores)
      const max = Math.max(...scores)

      // Count by tier
      const counts = { easy: 0, medium: 0, hard: 0 }
      for (const ex of internalExamples) {
        const score = ex.complexity.decisions + ex.complexity.checkpoints
        if (max === min) {
          counts.easy++
        } else {
          const normalized = (score - min) / (max - min)
          if (normalized < 0.25) counts.easy++
          else if (normalized < 0.75) counts.medium++
          else counts.hard++
        }
      }
      return counts
    }, [internalExamples, externalTierCounts])

    const handleTabChange = useCallback((value: string) => {
      setActiveTab(value as ModalTab)
    }, [])

    return (
      <Dialog.Content
        ref={ref}
        data-component="flowchart-modal"
        className={css({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          borderRadius: '2xl',
          boxShadow: '2xl',
          width: '95vw',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'hidden',
          zIndex: 101,
          _focus: { outline: 'none' },
        })}
      >
        {/* Close button */}
        <div
          data-element="close-corner"
          className={css({
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '44px',
            height: '44px',
            backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
            borderBottomLeftRadius: 'xl',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: '4px',
            paddingRight: '4px',
            zIndex: 20,
          })}
        >
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={css({
                width: '28px',
                height: '28px',
                borderRadius: 'md',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: { base: 'gray.500', _dark: 'gray.400' },
                transition: 'all 0.2s',
                _hover: {
                  backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                  transform: 'scale(1.1)',
                },
              })}
            >
              ✕
            </button>
          </Dialog.Close>
        </div>

        {/* Title */}
        <div
          className={css({
            padding: '6',
            paddingBottom: '4',
            borderBottom: '1px solid',
            borderColor: { base: 'gray.200', _dark: 'gray.700' },
          })}
        >
          <Dialog.Title asChild>
            <h2
              data-element="title"
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: { base: 'gray.800', _dark: 'gray.100' },
                textAlign: 'center',
                letterSpacing: '-0.01em',
                paddingRight: '10', // Space for close button
              })}
            >
              {flowchart.definition.title}
            </h2>
          </Dialog.Title>
          <Dialog.Description className={css({ srOnly: true })}>
            Practice, view flowchart diagram, or generate worksheets for{' '}
            {flowchart.definition.title}
          </Dialog.Description>

          {/* Action buttons - Edit/Remix */}
          {flowchartId && (
            <div
              data-element="modal-actions"
              className={hstack({ gap: '2', justifyContent: 'center', marginTop: '3' })}
            >
              {source === 'database' && isOwnedByUser && (
                <button
                  data-action="edit"
                  onClick={handleEdit}
                  disabled={isCreatingWorkshop}
                  className={css({
                    paddingY: '2', paddingX: '4',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    borderRadius: 'md',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                    color: { base: 'blue.700', _dark: 'blue.300' },
                    _hover: {
                      backgroundColor: { base: 'blue.200', _dark: 'blue.800' },
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {isCreatingWorkshop ? 'Opening...' : 'Edit'}
                </button>
              )}
              <button
                data-action="remix"
                onClick={handleRemix}
                disabled={isCreatingWorkshop}
                className={css({
                  paddingY: '2', paddingX: '4',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  borderRadius: 'md',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                  color: { base: 'gray.700', _dark: 'gray.300' },
                  _hover: {
                    backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                  },
                  _disabled: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  },
                })}
              >
                {isCreatingWorkshop ? 'Opening...' : 'Remix'}
              </button>
            </div>
          )}
        </div>

        {/* Diagnostic Alert */}
        {diagnosticReport &&
          (diagnosticReport.errorCount > 0 || diagnosticReport.warningCount > 0) && (
            <div className={css({ padding: '4', paddingTop: '0', paddingBottom: '0' })}>
              <div className={hstack({ gap: '2', alignItems: 'flex-start' })}>
                <div className={css({ flex: 1 })}>
                  <DiagnosticAlert
                    report={diagnosticReport}
                    onShowDetails={() => setShowDiagnosticDetails(!showDiagnosticDetails)}
                    compact
                  />
                </div>
                {/* Fix in Workshop button - only show for database flowcharts */}
                {flowchartId && source === 'database' && (
                  <button
                    data-action="fix-in-workshop"
                    onClick={handleFixInWorkshop}
                    disabled={isCreatingWorkshop}
                    className={css({
                      paddingY: '2', paddingX: '3',
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      borderRadius: 'md',
                      backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                      _hover: {
                        backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
                      },
                      _disabled: {
                        opacity: 0.6,
                        cursor: 'not-allowed',
                      },
                    })}
                  >
                    {isCreatingWorkshop
                      ? 'Opening...'
                      : isOwnedByUser
                        ? 'Fix in Workshop'
                        : 'Remix & Fix'}
                  </button>
                )}
              </div>
              {showDiagnosticDetails && (
                <div
                  className={css({
                    marginTop: '3',
                    maxHeight: '200px',
                    overflow: 'auto',
                    borderRadius: 'md',
                    border: '1px solid',
                    borderColor: { base: 'gray.200', _dark: 'gray.700' },
                    padding: '3',
                    backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
                  })}
                >
                  <DiagnosticList report={diagnosticReport} maxItems={5} />
                </div>
              )}
            </div>
          )}

        {/* Tabs */}
        <Tabs.Root
          value={activeTab}
          onValueChange={handleTabChange}
          className={css({
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
          })}
        >
          {/* Tab List */}
          <Tabs.List
            data-element="tab-list"
            className={css({
              display: 'flex',
              gap: '1',
              padding: '2',
              paddingTop: '0',
              borderBottom: '1px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              justifyContent: 'center',
            })}
          >
            <Tabs.Trigger
              value="practice"
              className={css({
                paddingY: '2', paddingX: '4',
                fontSize: 'sm',
                fontWeight: 'medium',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: 'transparent',
                color: { base: 'gray.600', _dark: 'gray.400' },
                _hover: {
                  backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                  color: { base: 'gray.900', _dark: 'gray.100' },
                },
                '&[data-state="active"]': {
                  backgroundColor: { base: 'blue.50', _dark: 'blue.900/30' },
                  color: { base: 'blue.700', _dark: 'blue.300' },
                },
              })}
            >
              Practice
            </Tabs.Trigger>
            <Tabs.Trigger
              value="flowchart"
              className={css({
                paddingY: '2', paddingX: '4',
                fontSize: 'sm',
                fontWeight: 'medium',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: 'transparent',
                color: { base: 'gray.600', _dark: 'gray.400' },
                _hover: {
                  backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                  color: { base: 'gray.900', _dark: 'gray.100' },
                },
                '&[data-state="active"]': {
                  backgroundColor: { base: 'blue.50', _dark: 'blue.900/30' },
                  color: { base: 'blue.700', _dark: 'blue.300' },
                },
              })}
            >
              Flowchart
            </Tabs.Trigger>
            <Tabs.Trigger
              value="worksheet"
              className={css({
                paddingY: '2', paddingX: '4',
                fontSize: 'sm',
                fontWeight: 'medium',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: 'transparent',
                color: { base: 'gray.600', _dark: 'gray.400' },
                _hover: {
                  backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                  color: { base: 'gray.900', _dark: 'gray.100' },
                },
                '&[data-state="active"]': {
                  backgroundColor: { base: 'blue.50', _dark: 'blue.900/30' },
                  color: { base: 'blue.700', _dark: 'blue.300' },
                },
              })}
            >
              Worksheet
            </Tabs.Trigger>
          </Tabs.List>

          {/* Tab Content */}
          <div
            className={css({
              flex: 1,
              overflow: 'auto',
            })}
          >
            <Tabs.Content
              value="practice"
              className={css({
                padding: '4',
                outline: 'none',
              })}
            >
              <PracticeTab
                schema={flowchart.definition.problemInput}
                flowchart={flowchart}
                onSubmit={onSubmit}
                examples={internalExamples}
                onExamplesGenerated={handleExamplesGenerated}
                shareUrl={shareUrl}
              />
            </Tabs.Content>

            <Tabs.Content
              value="flowchart"
              className={css({
                padding: '4',
                outline: 'none',
              })}
            >
              <FlowchartTab flowchart={flowchart} shareUrl={shareUrl} />
            </Tabs.Content>

            <Tabs.Content
              value="worksheet"
              className={css({
                padding: '4',
                outline: 'none',
              })}
            >
              <WorksheetTab
                flowchart={flowchart}
                tierCounts={tierCounts}
                examples={internalExamples}
                flowchartId={flowchartId}
              />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </Dialog.Content>
    )
  }
)
