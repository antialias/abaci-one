'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'
import { loadFlowchart } from '@/lib/flowcharts/loader'
import { getFlowchart } from '@/lib/flowcharts/definitions'
import { FlowchartWalker, FlowchartProblemInput } from '@/components/flowchart'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'
import { vstack } from '../../../../styled-system/patterns'

type PageState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'inputting'; flowchart: ExecutableFlowchart }
  | { type: 'walking'; flowchart: ExecutableFlowchart; problemInput: Record<string, ProblemValue> }

export default function FlowchartPage() {
  const params = useParams()
  const router = useRouter()
  const flowchartId = params.flowchartId as string

  const [state, setState] = useState<PageState>({ type: 'loading' })
  // Track if we've already processed sessionStorage (prevents React Strict Mode double-run issues)
  const processedStorageRef = useRef(false)

  // Load flowchart on mount, check for stored problem values
  useEffect(() => {
    async function load() {
      const data = getFlowchart(flowchartId)
      if (!data) {
        setState({ type: 'error', message: `Flowchart "${flowchartId}" not found` })
        return
      }

      try {
        const flowchart = await loadFlowchart(data.definition, data.mermaid)

        // Check for stored problem values from the picker modal
        // Use ref to prevent React Strict Mode double-run from losing the values
        if (!processedStorageRef.current) {
          processedStorageRef.current = true
          const storageKey = `flowchart-problem-${flowchartId}`
          const storedValues = sessionStorage.getItem(storageKey)

          if (storedValues) {
            // Clear the stored values so they don't persist across refreshes
            sessionStorage.removeItem(storageKey)

            try {
              const problemInput = JSON.parse(storedValues) as Record<string, ProblemValue>
              setState({ type: 'walking', flowchart, problemInput })
              return
            } catch {
              // If parsing fails, fall through to inputting
              console.warn('Failed to parse stored problem values')
            }
          }
          // Only set to inputting on first run if no stored values found
          setState({ type: 'inputting', flowchart })
        }
        // On subsequent runs (React Strict Mode), don't change state - let the first run's state persist
      } catch (error) {
        console.error('Error loading flowchart:', error)
        setState({ type: 'error', message: 'Failed to load flowchart' })
      }
    }

    load()
  }, [flowchartId])

  // Handle problem input submission
  const handleProblemSubmit = useCallback(
    (values: Record<string, ProblemValue>) => {
      if (state.type !== 'inputting') return
      setState({
        type: 'walking',
        flowchart: state.flowchart,
        problemInput: values,
      })
    },
    [state]
  )

  // Handle restart (go back to input)
  const handleRestart = useCallback(() => {
    if (state.type !== 'walking') return
    setState({ type: 'inputting', flowchart: state.flowchart })
  }, [state])

  // Handle completion
  const handleComplete = useCallback(() => {
    // Could save results, update progress, etc.
    // For now, go back to picker
    router.push('/flowchart')
  }, [router])

  // Handle change problem (go back to picker modal)
  const handleChangeProblem = useCallback(() => {
    router.push('/flowchart')
  }, [router])

  // Nav slot content - Back to flowcharts link
  const navSlot = (
    <Link
      href="/flowchart"
      className={css({
        fontSize: 'sm',
        color: { base: 'blue.600', _dark: 'blue.400' },
        textDecoration: 'none',
        _hover: { textDecoration: 'underline' },
      })}
    >
      ← Back to flowcharts
    </Link>
  )

  // Render based on state
  return (
    <PageWithNav navSlot={navSlot}>
      <div className={vstack({ gap: '4', padding: '4', minHeight: '100vh' })}>
        {/* Main content */}
        <main
          className={css({
            flex: 1,
            width: '100%',
            maxWidth: '600px',
            margin: '0 auto',
          })}
        >
        {state.type === 'loading' && (
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

        {state.type === 'error' && (
          <div
            className={vstack({
              gap: '4',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
            })}
          >
            <p
              className={css({
                color: { base: 'red.600', _dark: 'red.400' },
                fontSize: 'lg',
              })}
            >
              {state.message}
            </p>
            <button
              onClick={() => router.push('/flowchart')}
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
              Go back
            </button>
          </div>
        )}

        {state.type === 'inputting' && (
          <FlowchartProblemInput
            schema={state.flowchart.definition.problemInput}
            onSubmit={handleProblemSubmit}
            flowchart={state.flowchart}
          />
        )}

        {state.type === 'walking' && (
          <FlowchartWalker
            flowchart={state.flowchart}
            problemInput={state.problemInput}
            onComplete={handleComplete}
            onRestart={handleRestart}
            onChangeProblem={handleChangeProblem}
          />
        )}
        </main>
      </div>
    </PageWithNav>
  )
}
