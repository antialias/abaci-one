'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { css } from '../../../../styled-system/css'
import { vstack, hstack } from '../../../../styled-system/patterns'

interface TeacherFlowchart {
  id: string
  title: string
  description: string | null
  emoji: string
  difficulty: string | null
  status: 'draft' | 'published' | 'archived'
  version: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export default function MyFlowchartsPage() {
  const router = useRouter()
  const [flowcharts, setFlowcharts] = useState<TeacherFlowchart[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // Load flowcharts
  useEffect(() => {
    async function loadFlowcharts() {
      try {
        const response = await fetch('/api/teacher-flowcharts')
        if (response.ok) {
          const data = await response.json()
          setFlowcharts(data.flowcharts || [])
        }
      } catch (err) {
        console.error('Failed to load flowcharts:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadFlowcharts()
  }, [])

  const handlePublish = useCallback(async (id: string) => {
    setActionInProgress(id)
    try {
      const response = await fetch(`/api/teacher-flowcharts/${id}/publish`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setFlowcharts((prev) => prev.map((f) => (f.id === id ? { ...f, ...data.flowchart } : f)))
      } else {
        const data = await response.json()
        alert(`Failed to publish: ${data.error}`)
      }
    } catch (err) {
      console.error('Publish failed:', err)
      alert('Failed to publish')
    } finally {
      setActionInProgress(null)
    }
  }, [])

  const handleUnpublish = useCallback(async (id: string) => {
    setActionInProgress(id)
    try {
      const response = await fetch(`/api/teacher-flowcharts/${id}/unpublish`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setFlowcharts((prev) => prev.map((f) => (f.id === id ? { ...f, ...data.flowchart } : f)))
      }
    } catch (err) {
      console.error('Unpublish failed:', err)
    } finally {
      setActionInProgress(null)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Archive this flowchart? It will no longer be visible to others.')) return

    setActionInProgress(id)
    try {
      const response = await fetch(`/api/teacher-flowcharts/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setFlowcharts((prev) => prev.filter((f) => f.id !== id))
      }
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setActionInProgress(null)
    }
  }, [])

  const handleEdit = useCallback(
    async (id: string) => {
      // Create a new workshop session to edit this flowchart
      try {
        const response = await fetch('/api/flowchart-workshop/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowchartId: id }),
        })
        if (response.ok) {
          const data = await response.json()
          router.push(`/flowchart/workshop/${data.session.id}`)
        }
      } catch (err) {
        console.error('Failed to create edit session:', err)
      }
    },
    [router]
  )

  const drafts = flowcharts.filter((f) => f.status === 'draft')
  const published = flowcharts.filter((f) => f.status === 'published')

  return (
    <div
      data-component="my-flowcharts"
      className={vstack({ gap: '8', padding: '6', alignItems: 'center', minHeight: '100vh' })}
    >
      <header className={vstack({ gap: '2', alignItems: 'center' })}>
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        >
          My Flowcharts
        </h1>
        <p
          className={css({
            fontSize: 'lg',
            color: { base: 'gray.600', _dark: 'gray.400' },
            textAlign: 'center',
          })}
        >
          Manage your custom flowcharts
        </p>
      </header>

      <div className={hstack({ gap: '3' })}>
        <button
          onClick={() => router.push('/flowchart/workshop')}
          className={css({
            paddingY: '3',
            paddingX: '6',
            borderRadius: 'lg',
            backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
            color: 'white',
            fontWeight: 'semibold',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
            },
          })}
        >
          + Create New
        </button>
        <button
          onClick={() => router.push('/flowchart/browse')}
          className={css({
            paddingY: '3',
            paddingX: '6',
            borderRadius: 'lg',
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
          Browse All
        </button>
      </div>

      {isLoading ? (
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>Loading...</p>
      ) : flowcharts.length === 0 ? (
        <div className={css({ textAlign: 'center', padding: '8' })}>
          <p className={css({ color: { base: 'gray.600', _dark: 'gray.400' }, marginBottom: '4' })}>
            You haven&apos;t created any flowcharts yet.
          </p>
          <button
            onClick={() => router.push('/flowchart/workshop')}
            className={css({
              paddingY: '3',
              paddingX: '6',
              borderRadius: 'lg',
              backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
              color: 'white',
              fontWeight: 'semibold',
              border: 'none',
              cursor: 'pointer',
            })}
          >
            Create Your First Flowchart
          </button>
        </div>
      ) : (
        <div className={css({ width: '100%', maxWidth: '800px' })}>
          {/* Published section */}
          {published.length > 0 && (
            <section data-section="published" className={css({ marginBottom: '8' })}>
              <h2
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'semibold',
                  color: { base: 'gray.800', _dark: 'gray.200' },
                  marginBottom: '4',
                })}
              >
                Published ({published.length})
              </h2>
              <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
                {published.map((flowchart) => (
                  <FlowchartCard
                    key={flowchart.id}
                    flowchart={flowchart}
                    isLoading={actionInProgress === flowchart.id}
                    onEdit={() => handleEdit(flowchart.id)}
                    onPublish={() => handlePublish(flowchart.id)}
                    onUnpublish={() => handleUnpublish(flowchart.id)}
                    onDelete={() => handleDelete(flowchart.id)}
                    onUse={() => router.push(`/flowchart/${flowchart.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Drafts section */}
          {drafts.length > 0 && (
            <section data-section="drafts">
              <h2
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'semibold',
                  color: { base: 'gray.800', _dark: 'gray.200' },
                  marginBottom: '4',
                })}
              >
                Drafts ({drafts.length})
              </h2>
              <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
                {drafts.map((flowchart) => (
                  <FlowchartCard
                    key={flowchart.id}
                    flowchart={flowchart}
                    isLoading={actionInProgress === flowchart.id}
                    onEdit={() => handleEdit(flowchart.id)}
                    onPublish={() => handlePublish(flowchart.id)}
                    onUnpublish={() => handleUnpublish(flowchart.id)}
                    onDelete={() => handleDelete(flowchart.id)}
                    onUse={() => router.push(`/flowchart/${flowchart.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function FlowchartCard({
  flowchart,
  isLoading,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
  onUse,
}: {
  flowchart: TeacherFlowchart
  isLoading: boolean
  onEdit: () => void
  onPublish: () => void
  onUnpublish: () => void
  onDelete: () => void
  onUse: () => void
}) {
  return (
    <div
      data-element="flowchart-card"
      className={css({
        padding: '4',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: 'lg',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
      })}
    >
      <div
        className={hstack({ gap: '4', justifyContent: 'space-between', alignItems: 'flex-start' })}
      >
        <div className={hstack({ gap: '3', alignItems: 'flex-start' })}>
          <span className={css({ fontSize: '2xl' })}>{flowchart.emoji || '📊'}</span>
          <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
            <h3
              className={css({
                fontWeight: 'semibold',
                color: { base: 'gray.900', _dark: 'gray.100' },
              })}
            >
              {flowchart.title}
            </h3>
            {flowchart.description && (
              <p
                className={css({
                  fontSize: 'sm',
                  color: { base: 'gray.600', _dark: 'gray.400' },
                })}
              >
                {flowchart.description}
              </p>
            )}
            <div className={hstack({ gap: '2' })}>
              {flowchart.difficulty && (
                <span
                  className={css({
                    fontSize: 'xs',
                    padding: '0.5 2',
                    borderRadius: 'full',
                    backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                    color: { base: 'blue.700', _dark: 'blue.300' },
                  })}
                >
                  {flowchart.difficulty}
                </span>
              )}
              <span
                className={css({
                  fontSize: 'xs',
                  padding: '0.5 2',
                  borderRadius: 'full',
                  backgroundColor:
                    flowchart.status === 'published'
                      ? { base: 'green.100', _dark: 'green.900' }
                      : { base: 'gray.100', _dark: 'gray.700' },
                  color:
                    flowchart.status === 'published'
                      ? { base: 'green.700', _dark: 'green.300' }
                      : { base: 'gray.600', _dark: 'gray.400' },
                })}
              >
                {flowchart.status}
              </span>
              {flowchart.version > 1 && (
                <span
                  className={css({
                    fontSize: 'xs',
                    color: { base: 'gray.500', _dark: 'gray.500' },
                  })}
                >
                  v{flowchart.version}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={hstack({ gap: '2' })}>
          {flowchart.status === 'published' && (
            <button
              data-action="use"
              onClick={onUse}
              disabled={isLoading}
              className={css({
                paddingY: '2',
                paddingX: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                color: 'white',
                fontSize: 'sm',
                fontWeight: 'medium',
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
                },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Use
            </button>
          )}
          <button
            data-action="edit"
            onClick={onEdit}
            disabled={isLoading}
            className={css({
              paddingY: '2',
              paddingX: '3',
              borderRadius: 'md',
              backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
              color: { base: 'gray.700', _dark: 'gray.300' },
              fontSize: 'sm',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
              },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Edit
          </button>
          {flowchart.status === 'draft' ? (
            <button
              data-action="publish"
              onClick={onPublish}
              disabled={isLoading}
              className={css({
                paddingY: '2',
                paddingX: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'green.100', _dark: 'green.900' },
                color: { base: 'green.700', _dark: 'green.300' },
                fontSize: 'sm',
                fontWeight: 'medium',
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: { base: 'green.200', _dark: 'green.800' },
                },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isLoading ? '...' : 'Publish'}
            </button>
          ) : (
            <button
              data-action="unpublish"
              onClick={onUnpublish}
              disabled={isLoading}
              className={css({
                paddingY: '2',
                paddingX: '3',
                borderRadius: 'md',
                backgroundColor: { base: 'yellow.100', _dark: 'yellow.900' },
                color: { base: 'yellow.700', _dark: 'yellow.300' },
                fontSize: 'sm',
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: { base: 'yellow.200', _dark: 'yellow.800' },
                },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isLoading ? '...' : 'Unpublish'}
            </button>
          )}
          <button
            data-action="delete"
            onClick={onDelete}
            disabled={isLoading}
            className={css({
              paddingY: '2',
              paddingX: '3',
              borderRadius: 'md',
              backgroundColor: 'transparent',
              color: { base: 'gray.500', _dark: 'gray.500' },
              fontSize: 'sm',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                backgroundColor: { base: 'red.50', _dark: 'red.900/30' },
                color: { base: 'red.600', _dark: 'red.400' },
              },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
