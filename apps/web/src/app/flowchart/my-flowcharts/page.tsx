'use client'

import { useRouter } from 'next/navigation'
import { css } from '../../../../styled-system/css'
import { vstack, hstack } from '../../../../styled-system/patterns'
import { FlowchartCard } from '@/components/flowcharts/FlowchartCard'
import {
  useMyFlowcharts,
  usePublishFlowchart,
  useUnpublishFlowchart,
  useDeleteFlowchart,
  useEditFlowchart,
} from '@/hooks/useTeacherFlowcharts'

export default function MyFlowchartsPage() {
  const router = useRouter()
  const { data: flowcharts = [], isLoading } = useMyFlowcharts()
  const publish = usePublishFlowchart()
  const unpublish = useUnpublishFlowchart()
  const deleteChart = useDeleteFlowchart()
  const edit = useEditFlowchart()

  const drafts = flowcharts.filter((f) => f.status === 'draft')
  const published = flowcharts.filter((f) => f.status === 'published')

  const isPending = (id: string) =>
    (publish.isPending && publish.variables === id) ||
    (unpublish.isPending && unpublish.variables === id) ||
    (deleteChart.isPending && deleteChart.variables === id) ||
    (edit.isPending && edit.variables === id)

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
            _hover: { backgroundColor: { base: 'blue.700', _dark: 'blue.600' } },
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
            _hover: { backgroundColor: { base: 'gray.200', _dark: 'gray.700' } },
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
                {published.map((f) => (
                  <FlowchartCard
                    key={f.id}
                    flowchart={f}
                    isLoading={isPending(f.id)}
                    onEdit={() => edit.mutate(f.id)}
                    onPublish={() => publish.mutate(f.id)}
                    onUnpublish={() => unpublish.mutate(f.id)}
                    onDelete={() => {
                      if (confirm('Archive this flowchart? It will no longer be visible to others.'))
                        deleteChart.mutate(f.id)
                    }}
                    onUse={() => router.push(`/flowchart/${f.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

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
                {drafts.map((f) => (
                  <FlowchartCard
                    key={f.id}
                    flowchart={f}
                    isLoading={isPending(f.id)}
                    onEdit={() => edit.mutate(f.id)}
                    onPublish={() => publish.mutate(f.id)}
                    onUnpublish={() => unpublish.mutate(f.id)}
                    onDelete={() => {
                      if (confirm('Archive this flowchart? It will no longer be visible to others.'))
                        deleteChart.mutate(f.id)
                    }}
                    onUse={() => router.push(`/flowchart/${f.id}`)}
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
