'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { css } from '../../../../../../styled-system/css'
import { vstack, hstack } from '../../../../../../styled-system/patterns'
import { FlowchartWalker } from '@/components/flowchart/FlowchartWalker'
import { FlowchartProblemInput } from '@/components/flowchart/FlowchartProblemInput'
import { loadFlowchart } from '@/lib/flowcharts/loader'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'

type TestState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'selecting'; flowchart: ExecutableFlowchart }
  | { type: 'walking'; flowchart: ExecutableFlowchart; values: Record<string, ProblemValue> }

export default function WorkshopTestPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId
  const router = useRouter()
  const [state, setState] = useState<TestState>({ type: 'loading' })

  // Load the session and parse the draft
  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch(`/api/flowchart-workshop/sessions/${sessionId}`)
        if (!response.ok) {
          setState({ type: 'error', message: 'Session not found' })
          return
        }

        const data = await response.json()
        const session = data.session

        if (!session.draftDefinitionJson || !session.draftMermaidContent) {
          setState({ type: 'error', message: 'No draft to test - generate first' })
          return
        }

        // Parse and load the flowchart
        const definition = JSON.parse(session.draftDefinitionJson)
        const flowchart = await loadFlowchart(definition, session.draftMermaidContent)

        setState({ type: 'selecting', flowchart })
      } catch (err) {
        console.error('Failed to load session:', err)
        setState({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load',
        })
      }
    }
    loadSession()
  }, [sessionId])

  const handleProblemSubmit = useCallback(
    (values: Record<string, ProblemValue>) => {
      if (state.type !== 'selecting') return
      setState({ type: 'walking', flowchart: state.flowchart, values })
    },
    [state]
  )

  const handleComplete = useCallback(() => {
    router.push(`/flowchart/workshop/${sessionId}`)
  }, [router, sessionId])

  const handleBack = useCallback(() => {
    if (state.type === 'walking') {
      setState({ type: 'selecting', flowchart: state.flowchart })
    } else {
      router.push(`/flowchart/workshop/${sessionId}`)
    }
  }, [state, router, sessionId])

  if (state.type === 'loading') {
    return (
      <div className={css({ padding: '8', textAlign: 'center' })}>
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
          Loading flowchart...
        </p>
      </div>
    )
  }

  if (state.type === 'error') {
    return (
      <div className={vstack({ gap: '4', padding: '8', alignItems: 'center' })}>
        <p className={css({ color: { base: 'red.600', _dark: 'red.400' } })}>{state.message}</p>
        <button
          onClick={() => router.push(`/flowchart/workshop/${sessionId}`)}
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

  if (state.type === 'selecting') {
    return (
      <div className={vstack({ gap: '6', padding: '6', alignItems: 'center', minHeight: '100vh' })}>
        <header className={vstack({ gap: '2', alignItems: 'center' })}>
          <h1
            className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: { base: 'gray.900', _dark: 'gray.100' },
            })}
          >
            Test: {state.flowchart.definition.title}
          </h1>
          <p className={css({ color: { base: 'gray.600', _dark: 'gray.400' } })}>
            Enter values to test the flowchart
          </p>
        </header>

        <div
          className={css({
            maxWidth: '500px',
            width: '100%',
          })}
        >
          <FlowchartProblemInput
            schema={state.flowchart.definition.problemInput}
            onSubmit={handleProblemSubmit}
            flowchart={state.flowchart}
          />
        </div>

        <button
          onClick={handleBack}
          className={css({
            paddingY: '2',
            paddingX: '4',
            borderRadius: 'md',
            backgroundColor: 'transparent',
            color: { base: 'gray.600', _dark: 'gray.400' },
            border: '1px solid',
            borderColor: { base: 'gray.300', _dark: 'gray.600' },
            cursor: 'pointer',
            _hover: {
              backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
            },
          })}
        >
          ← Back to Workshop
        </button>
      </div>
    )
  }

  // Walking state
  return (
    <div className={css({ minHeight: '100vh' })}>
      <header
        className={css({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          paddingY: '3',
          paddingX: '4',
          backgroundColor: { base: 'white/90', _dark: 'gray.900/90' },
          borderBottom: '1px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.700' },
          backdropFilter: 'blur(8px)',
          zIndex: 50,
        })}
      >
        <div className={hstack({ gap: '4', justifyContent: 'space-between' })}>
          <button
            onClick={handleBack}
            className={css({
              paddingY: '2',
              paddingX: '4',
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
            ← Try Different Values
          </button>
          <span
            className={css({
              fontWeight: 'medium',
              color: { base: 'gray.700', _dark: 'gray.300' },
            })}
          >
            Testing: {state.flowchart.definition.title}
          </span>
          <button
            onClick={handleComplete}
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
            })}
          >
            Done Testing
          </button>
        </div>
      </header>

      <div className={css({ paddingTop: '80px' })}>
        <FlowchartWalker
          flowchart={state.flowchart}
          problemInput={state.values}
          onComplete={handleComplete}
        />
      </div>
    </div>
  )
}
