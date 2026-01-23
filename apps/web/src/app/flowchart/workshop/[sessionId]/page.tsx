'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { DebugMermaidDiagram } from '@/components/flowchart/DebugMermaidDiagram'
import { FlowchartExampleGrid } from '@/components/flowchart/FlowchartExampleGrid'
import { DiagnosticAlert, DiagnosticList } from '@/components/flowchart/FlowchartDiagnostics'
import { TestsTab } from '@/components/flowchart/TestsTab'
import { WorksheetTab } from '@/components/flowchart/WorksheetTab'
import { WorksheetDebugPanel } from '@/components/flowchart/WorksheetDebugPanel'
import {
  generateDiverseExamples,
  type GeneratedExample,
  DEFAULT_CONSTRAINTS,
} from '@/lib/flowcharts/example-generator'
import { GenerationProgressPanel } from '@/components/flowchart-workshop/GenerationProgressPanel'
import { isGenerateResult, parseFlowchartSSE } from '@/lib/flowchart-workshop/sse-parser'
import {
  getStatusMessage,
  initialStreamingState,
  isStreaming,
  streamingReducer,
} from '@/lib/flowchart-workshop/state-machine'
import { loadFlowchart } from '@/lib/flowcharts/loader'
import { downloadFlowchartPDF } from '@/lib/flowcharts/pdf-export'
import {
  diagnoseFlowchart,
  checkTestCoverage,
  formatDiagnosticsForRefinement,
  type FlowchartDiagnostic,
  type DiagnosticReport,
} from '@/lib/flowcharts/doctor'
import {
  validateTestCases,
  checkCoverage,
  runTestCaseWithFlowchart,
  type ValidationReport,
} from '@/lib/flowchart-workshop/test-case-validator'
import type {
  ExecutableFlowchart,
  FlowchartDefinition,
  ProblemValue,
  StateSnapshot,
} from '@/lib/flowcharts/schema'
import { css } from '../../../../../styled-system/css'
import { hstack, vstack } from '../../../../../styled-system/patterns'

interface WorkshopSession {
  id: string
  state: string
  topicDescription: string | null
  draftDefinitionJson: string | null
  draftMermaidContent: string | null
  draftTitle: string | null
  draftDescription: string | null
  draftDifficulty: string | null
  draftEmoji: string | null
  draftNotes: string | null
  refinementHistory: string[]
  currentReasoningText: string | null
}

type TabType = 'structure' | 'input' | 'worksheet' | 'tests'

export default function WorkshopPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId
  const router = useRouter()

  const [session, setSession] = useState<WorkshopSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flowchartLoadError, setFlowchartLoadError] = useState<string | null>(null)

  const [refinementText, setRefinementText] = useState('')
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<FlowchartDiagnostic[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // Streaming state management
  const [streamingState, dispatch] = useReducer(streamingReducer, initialStreamingState)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isProgressPanelExpanded, setIsProgressPanelExpanded] = useState(false)

  // Derived state
  const isGenerating =
    streamingState.streamType === 'generate' && isStreaming(streamingState.status)
  const isRefining = streamingState.streamType === 'refine' && isStreaming(streamingState.status)
  const progressMessage = getStatusMessage(streamingState)

  const [activeTab, setActiveTab] = useState<TabType>('worksheet')
  const [executableFlowchart, setExecutableFlowchart] = useState<ExecutableFlowchart | null>(null)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [showCreatePdfModal, setShowCreatePdfModal] = useState(false)
  const [highlightedSnapshots, setHighlightedSnapshots] = useState<StateSnapshot[] | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)

  // Examples for worksheet generation
  const [worksheetExamples, setWorksheetExamples] = useState<GeneratedExample[]>([])

  // Generate examples when flowchart changes
  useEffect(() => {
    if (!executableFlowchart) {
      setWorksheetExamples([])
      return
    }
    try {
      const examples = generateDiverseExamples(executableFlowchart, 100, DEFAULT_CONSTRAINTS)
      setWorksheetExamples(examples)
    } catch (err) {
      console.error('Failed to generate worksheet examples:', err)
      setWorksheetExamples([])
    }
  }, [executableFlowchart])

  // Calculate tier counts from examples
  const worksheetTierCounts = useMemo(() => {
    if (worksheetExamples.length === 0) return { easy: 0, medium: 0, hard: 0 }

    // Calculate difficulty range
    const scores = worksheetExamples.map(
      (ex) => ex.complexity.decisions + ex.complexity.checkpoints
    )
    const min = Math.min(...scores)
    const max = Math.max(...scores)

    // Count by tier
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const ex of worksheetExamples) {
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
  }, [worksheetExamples])

  // Parse the definition from JSON
  const definition: FlowchartDefinition | null = useMemo(() => {
    if (!session?.draftDefinitionJson) return null
    try {
      return JSON.parse(session.draftDefinitionJson)
    } catch {
      return null
    }
  }, [session?.draftDefinitionJson])

  // Run diagnostic checks on the definition and mermaid content
  // Note: We depend on the raw JSON strings rather than parsed objects to avoid
  // reference instability that could cause the diagnostic to flicker
  const baseDiagnosticReport = useMemo(() => {
    if (!session?.draftDefinitionJson) return null
    try {
      const def = JSON.parse(session.draftDefinitionJson) as FlowchartDefinition
      return diagnoseFlowchart(def, session?.draftMermaidContent || undefined)
    } catch {
      return null
    }
  }, [session?.draftDefinitionJson, session?.draftMermaidContent])

  // Run test validation once and share with both doctor and TestsTab
  const [testValidationReport, setTestValidationReport] = useState<Awaited<
    ReturnType<typeof validateTestCases>
  > | null>(null)
  const [testCoverageDiagnostics, setTestCoverageDiagnostics] = useState<FlowchartDiagnostic[]>([])

  useEffect(() => {
    async function runTestValidation() {
      if (!definition) {
        setTestValidationReport(null)
        setTestCoverageDiagnostics([])
        return
      }

      let validationReport: ValidationReport

      // Use the unified computation path when we have an executable flowchart
      // This supports both legacy display.answer and new answer+transform model
      if (executableFlowchart && definition.problemInput.examples) {
        const examples = definition.problemInput.examples.filter((ex) => ex.expectedAnswer)
        const results = examples.map((example) => runTestCaseWithFlowchart(executableFlowchart, example))
        const coverage = await checkCoverage(executableFlowchart, definition.problemInput.examples)

        validationReport = {
          passed: results.every((r) => r.passed),
          results,
          coverage,
          summary: {
            total: results.length,
            passed: results.filter((r) => r.passed).length,
            failed: results.filter((r) => !r.passed && !r.error).length,
            errors: results.filter((r) => r.error).length,
          },
        }
      } else {
        // Fall back to basic validation (legacy path)
        validationReport = validateTestCases(definition)
      }

      // Store the report for TestsTab to use
      setTestValidationReport(validationReport)

      // Convert to diagnostics for the doctor
      const diagnostics = checkTestCoverage(definition, validationReport)
      setTestCoverageDiagnostics(diagnostics)
    }

    runTestValidation()
  }, [definition, executableFlowchart])

  // Combine base diagnostics with test coverage diagnostics
  const diagnosticReport = useMemo((): DiagnosticReport | null => {
    if (!baseDiagnosticReport) return null

    const allDiagnostics = [...baseDiagnosticReport.diagnostics, ...testCoverageDiagnostics]
    const errorCount = allDiagnostics.filter((d) => d.severity === 'error').length
    const warningCount = allDiagnostics.filter((d) => d.severity === 'warning').length

    return {
      isHealthy: errorCount === 0,
      errorCount,
      warningCount,
      diagnostics: allDiagnostics,
    }
  }, [baseDiagnosticReport, testCoverageDiagnostics])

  // State for showing diagnostic details
  const [showDiagnosticDetails, setShowDiagnosticDetails] = useState(false)

  // Build ExecutableFlowchart when definition and mermaid content are available
  useEffect(() => {
    async function buildExecutable() {
      if (!definition || !session?.draftMermaidContent) {
        setExecutableFlowchart(null)
        return
      }
      try {
        const flowchart = await loadFlowchart(definition, session.draftMermaidContent)
        setExecutableFlowchart(flowchart)
        setFlowchartLoadError(null)
      } catch (err) {
        console.error('Failed to build executable flowchart:', err)
        setExecutableFlowchart(null)
        setFlowchartLoadError(err instanceof Error ? err.message : 'Failed to load flowchart')
      }
    }
    buildExecutable()
  }, [definition, session?.draftMermaidContent])

  // Load session
  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch(`/api/flowchart-workshop/sessions/${sessionId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Session not found')
          } else if (response.status === 410) {
            setError('Session has expired')
          } else {
            setError('Failed to load session')
          }
          return
        }
        const data = await response.json()
        setSession(data.session)
      } catch (err) {
        console.error('Failed to load session:', err)
        setError('Failed to load session')
      } finally {
        setIsLoading(false)
      }
    }
    loadSession()
  }, [sessionId])

  // Connect to watch endpoint if:
  // 1. Session is in 'generating' state (reconnection case), or
  // 2. Session is in 'initial' state with topicDescription but no draft (auto-generation case)
  // This handles both reconnection and the auto-start flow
  const shouldAutoConnect =
    session &&
    (session.state === 'generating' ||
      (session.state === 'initial' && session.topicDescription && !session.draftDefinitionJson))

  useEffect(() => {
    if (!shouldAutoConnect || !session) return

    // Start streaming state to show progress
    dispatch({ type: 'START_STREAMING', streamType: 'generate' })
    setIsProgressPanelExpanded(true)

    // If there's already accumulated reasoning, show it
    if (session.currentReasoningText) {
      dispatch({ type: 'STREAM_REASONING', text: session.currentReasoningText, append: false })
    }

    // Create abort controller for watch connection
    const watchController = new AbortController()
    abortControllerRef.current = watchController

    // Connect to watch endpoint
    const connectWatch = async () => {
      try {
        const response = await fetch(`/api/flowchart-workshop/sessions/${sessionId}/watch`, {
          signal: watchController.signal,
        })

        if (!response.ok || !response.body) {
          dispatch({ type: 'STREAM_ERROR', message: 'Failed to connect to watch stream' })
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let currentEvent = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6))

                switch (currentEvent) {
                  case 'state':
                    // Seed with accumulated reasoning text (full replacement)
                    if (data.reasoningText) {
                      dispatch({
                        type: 'STREAM_REASONING',
                        text: data.reasoningText,
                        append: false,
                      })
                    }
                    break

                  case 'reasoning': {
                    // Live reasoning delta - append to existing
                    const reasoningData = data as { text: string; isDelta: boolean }
                    dispatch({ type: 'STREAM_REASONING', text: reasoningData.text, append: true })
                    break
                  }

                  case 'complete': {
                    // Generation completed - handle both DB format and live format
                    // DB path sends: draftDefinitionJson (JSON string), draftMermaidContent, etc.
                    // Live path sends: definition (object), mermaidContent, etc.
                    let parsedDefinition = null
                    let parsedNotes: string[] = []
                    let mermaidContent: string | undefined
                    let title: string | undefined
                    let description: string | undefined
                    let emoji: string | undefined
                    let difficulty: string | undefined

                    if (data.definition) {
                      // Live path - data is already parsed
                      parsedDefinition = data.definition
                      parsedNotes = data.notes || []
                      mermaidContent = data.mermaidContent
                      title = data.title
                      description = data.description
                      emoji = data.emoji
                      difficulty = data.difficulty
                    } else if (data.draftDefinitionJson) {
                      // DB path - parse JSON strings
                      try {
                        parsedDefinition = JSON.parse(data.draftDefinitionJson)
                        parsedNotes = data.draftNotes ? JSON.parse(data.draftNotes) : []
                      } catch {
                        // Ignore parse errors
                      }
                      mermaidContent = data.draftMermaidContent
                      title = data.draftTitle
                      description = data.draftDescription
                      emoji = data.draftEmoji
                      difficulty = data.draftDifficulty
                    }

                    if (parsedDefinition) {
                      dispatch({
                        type: 'STREAM_COMPLETE',
                        result: {
                          definition: parsedDefinition,
                          mermaidContent: mermaidContent || '',
                          title: title || 'Untitled',
                          description: description || '',
                          emoji: emoji || '📊',
                          difficulty: difficulty || 'Beginner',
                          notes: parsedNotes,
                        },
                      })
                    }

                    // Update session state to refining
                    setSession((prev) =>
                      prev
                        ? {
                            ...prev,
                            state: 'refining',
                            draftDefinitionJson:
                              data.draftDefinitionJson || JSON.stringify(parsedDefinition),
                            draftMermaidContent: mermaidContent ?? null,
                            draftTitle: title ?? null,
                            draftDescription: description ?? null,
                            draftDifficulty: difficulty ?? null,
                            draftEmoji: emoji ?? null,
                            draftNotes: data.draftNotes || JSON.stringify(parsedNotes),
                            currentReasoningText: null, // Clear on completion
                          }
                        : null
                    )
                    return // Exit the loop
                  }

                  case 'error':
                    dispatch({ type: 'STREAM_ERROR', message: data.message })
                    setError(data.message)
                    return // Exit the loop

                  case 'ping':
                    // Keep-alive, ignore
                    break
                }
              } catch {
                // Ignore parse errors
              }
              currentEvent = ''
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Intentional abort, ignore
          return
        }
        console.error('Watch connection error:', err)
        dispatch({ type: 'STREAM_ERROR', message: 'Connection lost' })
      }
    }

    connectWatch()

    return () => {
      watchController.abort()
    }
    // Depend on shouldAutoConnect (which encapsulates the connection criteria)
    // Not reasoning text (that would cause reconnection loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoConnect, sessionId])

  // Handle cancellation
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
    dispatch({ type: 'STREAM_CANCELLED' })
  }, [])

  // Handle initial generation
  const handleGenerate = useCallback(async () => {
    if (!session?.topicDescription) return

    // Reset and start
    dispatch({ type: 'START_STREAMING', streamType: 'generate' })
    setIsProgressPanelExpanded(true)

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`/api/flowchart-workshop/sessions/${sessionId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicDescription: session.topicDescription }),
        signal: abortControllerRef.current.signal,
      })

      // Parse the SSE stream
      await parseFlowchartSSE(
        response,
        {
          onStarted: (responseId) => {
            dispatch({ type: 'STREAM_STARTED', responseId })
          },
          onProgress: (stage, message) => {
            dispatch({ type: 'STREAM_PROGRESS', stage, message })
          },
          onReasoning: (text, isDelta) => {
            dispatch({ type: 'STREAM_REASONING', text, append: isDelta })
          },
          onOutputDelta: (text) => {
            dispatch({ type: 'STREAM_OUTPUT', text, append: true })
          },
          onComplete: (result) => {
            dispatch({ type: 'STREAM_COMPLETE', result })
            // Update session with the generated content
            if (isGenerateResult(result)) {
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      state: 'refining',
                      draftDefinitionJson: JSON.stringify(result.definition),
                      draftMermaidContent: result.mermaidContent,
                      draftTitle: result.title,
                      draftDescription: result.description,
                      draftDifficulty: result.difficulty,
                      draftEmoji: result.emoji,
                      draftNotes: JSON.stringify(result.notes),
                    }
                  : null
              )
            }
          },
          onError: (message) => {
            dispatch({ type: 'STREAM_ERROR', message })
            setError(message)
          },
          onCancelled: () => {
            dispatch({ type: 'STREAM_CANCELLED' })
          },
        },
        abortControllerRef.current.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        dispatch({ type: 'STREAM_CANCELLED' })
      } else {
        console.error('Generation failed:', err)
        const message = err instanceof Error ? err.message : 'Generation failed'
        dispatch({ type: 'STREAM_ERROR', message })
        setError(message)
      }
    }
  }, [session?.topicDescription, sessionId])

  // Handle refinement
  const handleRefine = useCallback(async () => {
    // Build the full refinement request from text + selected diagnostics
    const parts: string[] = []
    if (refinementText.trim()) {
      parts.push(refinementText.trim())
    }
    if (selectedDiagnostics.length > 0) {
      parts.push(formatDiagnosticsForRefinement(selectedDiagnostics))
    }

    const fullRequest = parts.join('\n\n')
    if (!fullRequest) return

    // Reset and start
    dispatch({ type: 'START_STREAMING', streamType: 'refine' })
    setIsProgressPanelExpanded(true)

    // Create new abort controller
    abortControllerRef.current = new AbortController()
    const currentRefinementText = fullRequest

    try {
      const response = await fetch(`/api/flowchart-workshop/sessions/${sessionId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: fullRequest }),
        signal: abortControllerRef.current.signal,
      })

      // Parse the SSE stream
      await parseFlowchartSSE(
        response,
        {
          onStarted: (responseId) => {
            dispatch({ type: 'STREAM_STARTED', responseId })
          },
          onProgress: (stage, message) => {
            dispatch({ type: 'STREAM_PROGRESS', stage, message })
          },
          onReasoning: (text, isDelta) => {
            dispatch({ type: 'STREAM_REASONING', text, append: isDelta })
          },
          onOutputDelta: (text) => {
            dispatch({ type: 'STREAM_OUTPUT', text, append: true })
          },
          onComplete: (result) => {
            dispatch({ type: 'STREAM_COMPLETE', result })
            // Update session with the refined content
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    draftDefinitionJson: JSON.stringify(result.definition),
                    draftMermaidContent: result.mermaidContent,
                    draftEmoji: result.emoji,
                    draftNotes: JSON.stringify(result.notes),
                    refinementHistory: [...(prev.refinementHistory || []), currentRefinementText],
                  }
                : null
            )
            setRefinementText('')
            setSelectedDiagnostics([])
          },
          onError: (message) => {
            dispatch({ type: 'STREAM_ERROR', message })
            setError(message)
          },
          onCancelled: () => {
            dispatch({ type: 'STREAM_CANCELLED' })
          },
        },
        abortControllerRef.current.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        dispatch({ type: 'STREAM_CANCELLED' })
      } else {
        console.error('Refinement failed:', err)
        const message = err instanceof Error ? err.message : 'Refinement failed'
        dispatch({ type: 'STREAM_ERROR', message })
        setError(message)
      }
    }
  }, [refinementText, selectedDiagnostics, sessionId])

  // Handler for updating the definition directly (e.g., adding test cases)
  const handleUpdateDefinition = useCallback(
    (updatedDefinition: FlowchartDefinition) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              draftDefinitionJson: JSON.stringify(updatedDefinition),
            }
          : null
      )
    },
    []
  )

  // Helper to check if two diagnostics are the same
  // Must compare code, location, AND message because multiple diagnostics
  // can have the same code and location (e.g., two unknown refs in same field)
  const isSameDiagnostic = useCallback(
    (a: FlowchartDiagnostic, b: FlowchartDiagnostic): boolean => {
      return (
        a.code === b.code &&
        a.location.description === b.location.description &&
        a.message === b.message
      )
    },
    []
  )

  // Handle diagnostic click - add/remove from selected diagnostics
  const handleDiagnosticClick = useCallback(
    (diagnostic: FlowchartDiagnostic) => {
      setSelectedDiagnostics((prev) => {
        // Check if already selected
        const isSelected = prev.some((d) => isSameDiagnostic(d, diagnostic))
        if (isSelected) {
          // Remove it
          return prev.filter((d) => !isSameDiagnostic(d, diagnostic))
        } else {
          // Add it
          return [...prev, diagnostic]
        }
      })
    },
    [isSameDiagnostic]
  )

  // Handle adding all diagnostics at once
  const handleAddAllDiagnostics = useCallback(() => {
    if (diagnosticReport) {
      setSelectedDiagnostics(diagnosticReport.diagnostics)
      setShowDiagnosticDetails(false)
    }
  }, [diagnosticReport])

  // Handle removing a diagnostic from selection
  const handleRemoveDiagnostic = useCallback(
    (diagnostic: FlowchartDiagnostic) => {
      setSelectedDiagnostics((prev) => prev.filter((d) => !isSameDiagnostic(d, diagnostic)))
    },
    [isSameDiagnostic]
  )

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/flowchart-workshop/sessions/${sessionId}/save`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      const data = await response.json()
      // Redirect to the saved flowchart
      router.push(`/flowchart/${data.flowchart.id}`)
    } catch (err) {
      console.error('Save failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [sessionId, router])

  // Handle save and publish
  const handleSaveAndPublish = useCallback(async () => {
    setIsPublishing(true)
    try {
      // First save the draft
      const saveResponse = await fetch(`/api/flowchart-workshop/sessions/${sessionId}/save`, {
        method: 'POST',
      })

      if (!saveResponse.ok) {
        const data = await saveResponse.json()
        throw new Error(data.error || 'Failed to save')
      }

      const saveData = await saveResponse.json()
      const flowchartId = saveData.flowchart.id

      // If this was an in-place update of a published flowchart, skip the publish step
      if (saveData.alreadyPublished) {
        router.push(`/flowchart/${flowchartId}`)
        return
      }

      // Otherwise, publish the draft
      const publishResponse = await fetch(`/api/teacher-flowcharts/${flowchartId}/publish`, {
        method: 'POST',
      })

      if (!publishResponse.ok) {
        const data = await publishResponse.json()
        throw new Error(data.error || 'Failed to publish')
      }

      // Redirect to the published flowchart
      router.push(`/flowchart/${flowchartId}`)
    } catch (err) {
      console.error('Save & publish failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to save and publish')
    } finally {
      setIsPublishing(false)
    }
  }, [sessionId, router])

  // Handle test
  const handleTest = useCallback(() => {
    router.push(`/flowchart/workshop/${sessionId}/test`)
  }, [sessionId, router])

  // Handle PDF export
  const handleExportPDF = useCallback(async () => {
    if (!session?.draftMermaidContent) return

    setIsExportingPDF(true)
    try {
      await downloadFlowchartPDF(session.draftMermaidContent, {
        title: session.draftTitle || 'Flowchart',
        description: session.draftDescription || undefined,
        sessionId,
      })
    } catch (err) {
      console.error('PDF export failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    } finally {
      setIsExportingPDF(false)
    }
  }, [session?.draftMermaidContent, session?.draftTitle, session?.draftDescription])

  if (isLoading) {
    return (
      <div className={css({ padding: '8', textAlign: 'center' })}>
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={vstack({ gap: '4', padding: '8', alignItems: 'center' })}>
        <p className={css({ color: { base: 'red.600', _dark: 'red.400' } })}>{error}</p>
        <button
          onClick={() => router.push('/flowchart')}
          className={css({
            paddingY: '3',
            paddingX: '6',
            borderRadius: 'md',
            backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
            color: { base: 'gray.800', _dark: 'gray.200' },
            border: 'none',
            cursor: 'pointer',
          })}
        >
          Back to Workshop
        </button>
      </div>
    )
  }

  if (!session) return null

  const hasDraft = Boolean(session.draftDefinitionJson && session.draftMermaidContent)
  const notes: string[] = session.draftNotes ? JSON.parse(session.draftNotes) : []

  return (
    <div
      data-component="workshop-main"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      })}
    >
      {/* Top bar */}
      <header
        data-element="top-bar"
        className={css({
          paddingY: '3',
          paddingX: '4',
          borderBottom: '1px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.700' },
          backgroundColor: { base: 'white', _dark: 'gray.900' },
        })}
      >
        <div className={hstack({ gap: '4', justifyContent: 'space-between' })}>
          <div className={hstack({ gap: '3', alignItems: 'center' })}>
            <button
              onClick={() => router.push('/flowchart')}
              className={css({
                padding: '2',
                borderRadius: 'md',
                backgroundColor: 'transparent',
                color: { base: 'gray.600', _dark: 'gray.400' },
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                },
              })}
            >
              ← Back
            </button>
            {session.draftEmoji && (
              <span className={css({ fontSize: '2xl' })}>{session.draftEmoji}</span>
            )}
            <h1
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: { base: 'gray.900', _dark: 'gray.100' },
              })}
            >
              {session.draftTitle || 'New Flowchart'}
            </h1>
            {session.draftDifficulty && (
              <span
                className={css({
                  fontSize: 'xs',
                  paddingY: '1',
                  paddingX: '2',
                  borderRadius: 'full',
                  backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                  color: { base: 'blue.700', _dark: 'blue.300' },
                })}
              >
                {session.draftDifficulty}
              </span>
            )}
          </div>
          <div className={hstack({ gap: '2' })}>
            {hasDraft && (
              <>
                <button
                  data-action="test"
                  onClick={handleTest}
                  className={css({
                    paddingY: '2',
                    paddingX: '4',
                    borderRadius: 'md',
                    backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                    color: { base: 'gray.700', _dark: 'gray.300' },
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                    },
                  })}
                >
                  Test
                </button>
                <button
                  data-action="save"
                  onClick={handleSave}
                  disabled={isSaving || isPublishing}
                  className={css({
                    paddingY: '2',
                    paddingX: '4',
                    borderRadius: 'md',
                    backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                    color: { base: 'gray.700', _dark: 'gray.300' },
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {isSaving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  data-action="save-and-publish"
                  onClick={handleSaveAndPublish}
                  disabled={isSaving || isPublishing}
                  className={css({
                    paddingY: '2',
                    paddingX: '4',
                    borderRadius: 'md',
                    backgroundColor: { base: 'green.600', _dark: 'green.500' },
                    color: 'white',
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: { base: 'green.700', _dark: 'green.600' },
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {isPublishing ? 'Publishing...' : 'Save & Publish'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Diagnostic Alert */}
      {diagnosticReport &&
        (diagnosticReport.errorCount > 0 || diagnosticReport.warningCount > 0) && (
          <div
            className={css({
              padding: '4',
              borderBottom: '1px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
            })}
          >
            <div className={hstack({ gap: '2', alignItems: 'flex-start' })}>
              <div className={css({ flex: 1 })}>
                <DiagnosticAlert
                  report={diagnosticReport}
                  onShowDetails={() => setShowDiagnosticDetails(!showDiagnosticDetails)}
                />
              </div>
              <button
                data-action="fix-all-issues"
                onClick={handleAddAllDiagnostics}
                className={css({
                  paddingY: '2',
                  paddingX: '3',
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
                })}
              >
                Fix All ({diagnosticReport.diagnostics.length})
              </button>
            </div>
            {showDiagnosticDetails && (
              <div className={css({ marginTop: '3' })}>
                <p
                  className={css({
                    fontSize: 'sm',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                    marginBottom: '2',
                  })}
                >
                  Click issues to add/remove from refinement:
                </p>
                <DiagnosticList
                  report={diagnosticReport}
                  onDiagnosticClick={handleDiagnosticClick}
                />
              </div>
            )}
          </div>
        )}

      {/* Flowchart Load Error */}
      {flowchartLoadError && (
        <div
          data-element="flowchart-load-error"
          className={css({
            padding: '4',
            margin: '4',
            backgroundColor: { base: 'red.50', _dark: 'red.900/30' },
            border: '1px solid',
            borderColor: { base: 'red.200', _dark: 'red.800' },
            borderRadius: 'lg',
          })}
        >
          <div className={hstack({ gap: '2', alignItems: 'flex-start' })}>
            <span className={css({ fontSize: 'xl' })}>❌</span>
            <div className={css({ flex: 1 })}>
              <h3
                className={css({
                  fontWeight: 'semibold',
                  color: { base: 'red.800', _dark: 'red.200' },
                  marginBottom: '1',
                })}
              >
                Flowchart Structure Error
              </h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: { base: 'red.700', _dark: 'red.300' },
                  marginBottom: '2',
                })}
              >
                {flowchartLoadError}
              </p>
              <p
                className={css({
                  fontSize: 'sm',
                  color: { base: 'red.600', _dark: 'red.400' },
                })}
              >
                Use the refinement panel below to ask the AI to fix this issue, or check the
                diagnostic details above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        className={css({
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        })}
      >
        {/* Left panel - Mermaid diagram */}
        <div
          data-element="diagram-panel"
          className={css({
            flex: 1,
            padding: '4',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid',
            borderColor: { base: 'gray.200', _dark: 'gray.700' },
          })}
        >
          {!hasDraft ? (
            <div className={vstack({ gap: '4', alignItems: 'center', padding: '8' })}>
              <p
                className={css({
                  color: { base: 'gray.600', _dark: 'gray.400' },
                  textAlign: 'center',
                })}
              >
                Topic: <strong>{session.topicDescription}</strong>
              </p>
              {/* Show progress panel when auto-generating or manually generating */}
              {shouldAutoConnect || isGenerating ? (
                <div className={css({ width: '100%', maxWidth: '500px' })}>
                  <GenerationProgressPanel
                    isExpanded={isProgressPanelExpanded}
                    onToggle={() => setIsProgressPanelExpanded(!isProgressPanelExpanded)}
                    status={streamingState.status}
                    progressMessage={progressMessage || 'Starting generation...'}
                    reasoningText={streamingState.reasoningText}
                    onCancel={isGenerating ? handleCancel : undefined}
                  />
                </div>
              ) : (
                /* Fallback generate button - only shown if auto-generation didn't start */
                <button
                  data-action="generate"
                  onClick={handleGenerate}
                  className={css({
                    paddingY: '4',
                    paddingX: '8',
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
                  })}
                >
                  Generate Flowchart
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Diagram toolbar */}
              <div
                data-element="diagram-toolbar"
                className={hstack({
                  gap: '2',
                  justifyContent: 'flex-end',
                  marginBottom: '2',
                  flexShrink: 0,
                })}
              >
                <button
                  data-action="regenerate"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  title="Regenerate flowchart from scratch"
                  className={css({
                    padding: '1.5 3',
                    borderRadius: 'md',
                    fontSize: 'sm',
                    backgroundColor: { base: 'orange.100', _dark: 'orange.900/50' },
                    color: { base: 'orange.700', _dark: 'orange.300' },
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5',
                    _hover: {
                      backgroundColor: { base: 'orange.200', _dark: 'orange.800/50' },
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  <span>🔄</span>
                  {isGenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
                <button
                  data-action="export-pdf"
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className={css({
                    padding: '1.5 3',
                    borderRadius: 'md',
                    fontSize: 'sm',
                    backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                    color: { base: 'gray.700', _dark: 'gray.300' },
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5',
                    _hover: {
                      backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  <span>📄</span>
                  {isExportingPDF ? 'Exporting...' : 'Download PDF'}
                </button>
              </div>
              <DebugMermaidDiagram
                mermaidContent={session.draftMermaidContent || ''}
                currentNodeId=""
                highlightedSnapshots={highlightedSnapshots ?? undefined}
                highlightedNodeId={highlightedNodeId ?? undefined}
                onRegenerate={handleGenerate}
                isRegenerating={isGenerating}
              />
            </>
          )}
        </div>

        {/* Right panel - Tabs */}
        <div
          data-element="info-panel"
          className={css({
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          })}
        >
          {/* Tab buttons */}
          <div
            className={hstack({
              gap: '0',
              borderBottom: '1px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              flexShrink: 0,
            })}
          >
            {(['worksheet', 'tests', 'structure', 'input'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={css({
                  flex: 1,
                  padding: '3',
                  border: 'none',
                  borderBottom: '2px solid',
                  borderBottomColor: activeTab === tab ? 'blue.500' : 'transparent',
                  backgroundColor: 'transparent',
                  color:
                    activeTab === tab
                      ? { base: 'blue.600', _dark: 'blue.400' }
                      : { base: 'gray.500', _dark: 'gray.500' },
                  fontWeight: activeTab === tab ? 'semibold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    color: { base: 'blue.600', _dark: 'blue.400' },
                  },
                })}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            className={css({
              flex: 1,
              overflow: 'auto',
              padding: '4',
              minHeight: 0,
            })}
          >
            {activeTab === 'structure' && <StructureTab definition={definition} notes={notes} />}
            {activeTab === 'input' && <InputTab definition={definition} />}
            {activeTab === 'tests' && (
              <TestsTab
                definition={definition}
                validationReport={testValidationReport}
                onUpdateDefinition={handleUpdateDefinition}
                onHoverSnapshots={setHighlightedSnapshots}
                onHoverNode={setHighlightedNodeId}
              />
            )}
            {activeTab === 'worksheet' && executableFlowchart && (
              <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
                {/* Create PDF Button */}
                <button
                  data-action="open-create-pdf-modal"
                  onClick={() => setShowCreatePdfModal(true)}
                  className={css({
                    paddingY: '3',
                    paddingX: '4',
                    borderRadius: 'lg',
                    backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                    color: 'white',
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2',
                    transition: 'all 0.15s',
                    _hover: {
                      backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
                    },
                  })}
                >
                  <span>📄</span>
                  Create PDF Worksheet
                </button>
                {/* Debug Panel - shows generated examples with answers */}
                <WorksheetDebugPanel
                  flowchart={executableFlowchart}
                  problemCount={10}
                  onHoverSnapshots={setHighlightedSnapshots}
                  onHoverNode={setHighlightedNodeId}
                />
              </div>
            )}
            {activeTab === 'worksheet' && !executableFlowchart && (
              <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
                Generate a flowchart to test worksheet generation.
              </p>
            )}
          </div>

          {/* Examples section - always visible at bottom */}
          <div
            data-element="examples-section"
            className={css({
              borderTop: '1px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              padding: '4',
              backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
              maxHeight: '300px',
              overflow: 'auto',
              flexShrink: 0,
            })}
          >
            <ExamplesTab
              definition={definition}
              flowchart={executableFlowchart}
              onTestExample={(values) => {
                // Navigate to test page - it will use the passed values
                router.push(`/flowchart/workshop/${sessionId}/test`)
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom panel - Refinement input */}
      {hasDraft && (
        <div
          data-element="refinement-panel"
          className={css({
            padding: '4',
            borderTop: '1px solid',
            borderColor: { base: 'gray.200', _dark: 'gray.700' },
            backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
          })}
        >
          {/* Selected diagnostics tokens */}
          {selectedDiagnostics.length > 0 && (
            <div
              data-element="selected-diagnostics"
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2',
                marginBottom: '3',
              })}
            >
              {selectedDiagnostics.map((diagnostic, index) => (
                <div
                  key={`${diagnostic.code}-${index}`}
                  data-element="diagnostic-token"
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '1',
                    paddingY: '1',
                    paddingX: '2',
                    borderRadius: 'md',
                    fontSize: 'sm',
                    backgroundColor:
                      diagnostic.severity === 'error'
                        ? { base: 'red.100', _dark: 'red.900/40' }
                        : { base: 'yellow.100', _dark: 'yellow.900/40' },
                    color:
                      diagnostic.severity === 'error'
                        ? { base: 'red.700', _dark: 'red.300' }
                        : { base: 'yellow.700', _dark: 'yellow.300' },
                  })}
                >
                  <span>{diagnostic.severity === 'error' ? '❌' : '⚠️'}</span>
                  <span
                    className={css({
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {diagnostic.title}
                  </span>
                  <button
                    onClick={() => handleRemoveDiagnostic(diagnostic)}
                    className={css({
                      padding: '0',
                      marginLeft: '1',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'xs',
                      opacity: 0.7,
                      _hover: { opacity: 1 },
                    })}
                    aria-label={`Remove ${diagnostic.title}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={hstack({ gap: '3' })}>
            <input
              data-element="refinement-input"
              type="text"
              value={refinementText}
              onChange={(e) => setRefinementText(e.target.value)}
              placeholder={
                selectedDiagnostics.length > 0
                  ? 'Add additional instructions (optional)...'
                  : "Describe how you'd like to change the flowchart..."
              }
              onKeyDown={(e) => e.key === 'Enter' && !isRefining && handleRefine()}
              className={css({
                flex: 1,
                padding: '3',
                borderRadius: 'lg',
                border: '2px solid',
                borderColor: { base: 'gray.300', _dark: 'gray.600' },
                backgroundColor: { base: 'white', _dark: 'gray.800' },
                color: { base: 'gray.900', _dark: 'gray.100' },
                _focus: {
                  outline: 'none',
                  borderColor: { base: 'blue.500', _dark: 'blue.400' },
                },
              })}
            />
            <button
              data-action="refine"
              onClick={handleRefine}
              disabled={isRefining || (!refinementText.trim() && selectedDiagnostics.length === 0)}
              className={css({
                paddingY: '3',
                paddingX: '6',
                borderRadius: 'lg',
                backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                color: 'white',
                fontWeight: 'medium',
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
                },
                _disabled: {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                },
              })}
            >
              {isRefining
                ? 'Refining...'
                : selectedDiagnostics.length > 0
                  ? `Fix ${selectedDiagnostics.length} Issue${selectedDiagnostics.length > 1 ? 's' : ''}`
                  : 'Refine'}
            </button>
          </div>
          {/* Progress panel during refinement */}
          {(isRefining ||
            ((streamingState.status === 'complete' || streamingState.status === 'error') &&
              streamingState.streamType === 'refine')) && (
            <div className={css({ marginTop: '3' })}>
              <GenerationProgressPanel
                isExpanded={isProgressPanelExpanded}
                onToggle={() => setIsProgressPanelExpanded(!isProgressPanelExpanded)}
                status={streamingState.status}
                progressMessage={progressMessage}
                reasoningText={streamingState.reasoningText}
                onCancel={isRefining ? handleCancel : undefined}
              />
            </div>
          )}
        </div>
      )}

      {/* Create PDF Modal */}
      {showCreatePdfModal && executableFlowchart && (
        <div
          data-component="create-pdf-modal-overlay"
          className={css({
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          })}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreatePdfModal(false)
          }}
        >
          <div
            data-component="create-pdf-modal"
            className={css({
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              borderRadius: 'xl',
              boxShadow: '2xl',
              width: '95vw',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '6',
            })}
          >
            <div className={hstack({ justifyContent: 'space-between', marginBottom: '4' })}>
              <h2
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: { base: 'gray.900', _dark: 'gray.100' },
                })}
              >
                Create PDF Worksheet
              </h2>
              <button
                data-action="close-create-pdf-modal"
                onClick={() => setShowCreatePdfModal(false)}
                className={css({
                  padding: '2',
                  borderRadius: 'md',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                  _hover: {
                    backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                  },
                })}
              >
                ✕
              </button>
            </div>
            <WorksheetTab
              flowchart={executableFlowchart}
              tierCounts={worksheetTierCounts}
              examples={worksheetExamples}
              workshopSessionId={sessionId}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Structure tab content
function StructureTab({
  definition,
  notes,
}: {
  definition: FlowchartDefinition | null
  notes: string[]
}) {
  if (!definition) {
    return (
      <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
        Generate a flowchart to see its structure.
      </p>
    )
  }

  const nodeEntries = Object.entries(definition.nodes)

  return (
    <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
      {notes.length > 0 && (
        <div
          className={css({
            padding: '3',
            borderRadius: 'lg',
            backgroundColor: { base: 'yellow.50', _dark: 'yellow.900/30' },
            border: '1px solid',
            borderColor: { base: 'yellow.200', _dark: 'yellow.800' },
          })}
        >
          <h3
            className={css({
              fontWeight: 'semibold',
              fontSize: 'sm',
              color: { base: 'yellow.800', _dark: 'yellow.300' },
              marginBottom: '2',
            })}
          >
            Notes
          </h3>
          <ul
            className={css({
              fontSize: 'sm',
              color: { base: 'yellow.700', _dark: 'yellow.400' },
            })}
          >
            {notes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3
          className={css({
            fontWeight: 'semibold',
            marginBottom: '2',
            color: { base: 'gray.800', _dark: 'gray.200' },
          })}
        >
          Nodes ({nodeEntries.length})
        </h3>
        <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
          {nodeEntries.map(([id, node]) => (
            <div
              key={id}
              className={css({
                paddingY: '2',
                paddingX: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
                fontSize: 'sm',
              })}
            >
              <div className={hstack({ gap: '2', justifyContent: 'space-between' })}>
                <code
                  className={css({
                    fontWeight: 'medium',
                    color: { base: 'gray.900', _dark: 'gray.100' },
                  })}
                >
                  {id}
                </code>
                <span
                  className={css({
                    padding: '0.5 2',
                    borderRadius: 'full',
                    fontSize: 'xs',
                    backgroundColor: getNodeTypeColor(node.type).bg,
                    color: getNodeTypeColor(node.type).text,
                  })}
                >
                  {node.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Input tab content
function InputTab({ definition }: { definition: FlowchartDefinition | null }) {
  if (!definition) {
    return (
      <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
        Generate a flowchart to see its input schema.
      </p>
    )
  }

  return (
    <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
      <div>
        <h3
          className={css({
            fontWeight: 'semibold',
            marginBottom: '2',
            color: { base: 'gray.800', _dark: 'gray.200' },
          })}
        >
          Problem Input Fields
        </h3>
        <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
          {definition.problemInput.fields.map((field) => (
            <div
              key={field.name}
              className={css({
                padding: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
                fontSize: 'sm',
              })}
            >
              <div className={hstack({ gap: '2', justifyContent: 'space-between' })}>
                <span
                  className={css({
                    fontWeight: 'medium',
                    color: { base: 'gray.900', _dark: 'gray.100' },
                  })}
                >
                  {field.label || field.name}
                </span>
                <span className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
                  {field.type}
                </span>
              </div>
              {'min' in field && 'max' in field && (
                <p
                  className={css({
                    fontSize: 'xs',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                  })}
                >
                  Range: {field.min} - {field.max}
                </p>
              )}
              {'options' in field && (
                <p
                  className={css({
                    fontSize: 'xs',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                  })}
                >
                  Options: {field.options.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {definition.problemInput.validation && (
        <div>
          <h3
            className={css({
              fontWeight: 'semibold',
              marginBottom: '1',
              color: { base: 'gray.800', _dark: 'gray.200' },
            })}
          >
            Validation
          </h3>
          <code
            className={css({
              fontSize: 'sm',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            {definition.problemInput.validation}
          </code>
        </div>
      )}
    </div>
  )
}

// Examples tab content - uses the shared FlowchartExampleGrid component
function ExamplesTab({
  definition,
  flowchart,
  onTestExample,
}: {
  definition: FlowchartDefinition | null
  flowchart: ExecutableFlowchart | null
  onTestExample: (values: Record<string, ProblemValue>) => void
}) {
  if (!definition) {
    return (
      <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
        Generate a flowchart to see example problems.
      </p>
    )
  }

  if (!flowchart) {
    return (
      <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
        Loading flowchart...
      </p>
    )
  }

  return (
    <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
      <FlowchartExampleGrid
        flowchart={flowchart}
        onSelect={onTestExample}
        compact={true}
        enableCaching={false} // Don't cache in workshop - always show fresh examples
      />
      <p
        className={css({
          fontSize: 'xs',
          color: { base: 'gray.400', _dark: 'gray.500' },
          textAlign: 'center',
        })}
      >
        Click an example to test the flowchart with those values
      </p>
    </div>
  )
}

// Helper to get color based on node type
function getNodeTypeColor(type: string): { bg: string; text: string } {
  switch (type) {
    case 'instruction':
      return { bg: 'blue.100', text: 'blue.700' }
    case 'decision':
      return { bg: 'purple.100', text: 'purple.700' }
    case 'checkpoint':
      return { bg: 'green.100', text: 'green.700' }
    case 'milestone':
      return { bg: 'yellow.100', text: 'yellow.700' }
    case 'embellishment':
      return { bg: 'pink.100', text: 'pink.700' }
    case 'terminal':
      return { bg: 'gray.100', text: 'gray.700' }
    default:
      return { bg: 'gray.100', text: 'gray.700' }
  }
}
