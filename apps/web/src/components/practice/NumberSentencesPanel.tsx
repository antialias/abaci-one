'use client'

import { useEffect, useRef, useState } from 'react'
import type { LinearReadinessSkillState } from '@/hooks/useLinearReadiness'
import { useLinearReadiness, useLinearReadinessVeto } from '@/hooks/useLinearReadiness'
import { css } from '../../../styled-system/css'
import { LinearEntryReport } from './LinearEntryReport'
import { ReadinessReport } from './ReadinessReport'
import { describeLinearLock, joinNames } from './start-practice-modal/LinearLockNote'

export const NUMBER_SENTENCES_PANEL_ID = 'number-sentences'

/**
 * Tier 2 of the linear-readiness disclosure: the dashboard's "why / what's needed"
 * panel. Hidden entirely when the derived-readiness flag is off.
 */
export function NumberSentencesPanel({
  studentId,
  isDark,
}: {
  studentId: string
  isDark: boolean
}) {
  const { data } = useLinearReadiness(studentId)
  const { clearVeto } = useLinearReadinessVeto(studentId)
  const ref = useRef<HTMLElement>(null)

  // Deep link target for "See what's needed" (…?tab=skills#number-sentences)
  useEffect(() => {
    if (!data?.enabled || !ref.current) return
    if (window.location.hash === `#${NUMBER_SENTENCES_PANEL_ID}`) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [data?.enabled])

  if (!data?.enabled) return null

  const ready = data.categories.filter((c) => c.status === 'ready')
  const vetoed = data.categories.filter((c) => c.status === 'vetoed')
  const { frontier } = data

  return (
    <section
      ref={ref}
      id={NUMBER_SENTENCES_PANEL_ID}
      data-component="number-sentences-panel"
      data-status={ready.length > 0 ? 'ready' : 'locked'}
      className={css({
        marginBottom: '1.25rem',
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        backgroundColor: isDark ? 'gray.800' : 'white',
        scrollMarginTop: '80px',
      })}
    >
      <h3
        data-element="number-sentences-heading"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '1rem',
          fontWeight: '600',
          marginBottom: '0.5rem',
          color: isDark ? 'gray.100' : 'gray.800',
        })}
      >
        <span aria-hidden>📝</span>
        Number sentences
      </h3>

      {ready.length > 0 ? (
        <p
          data-element="number-sentences-status"
          className={css({ fontSize: '0.875rem', color: isDark ? 'green.200' : 'green.700' })}
        >
          <span aria-hidden>✅ </span>
          {joinNames(ready.map((c) => c.name))} {ready.length === 1 ? 'is' : 'are'} ready for number
          sentences.
        </p>
      ) : (
        <p
          data-element="number-sentences-status"
          className={css({ fontSize: '0.875rem', color: isDark ? 'gray.300' : 'gray.600' })}
        >
          <span aria-hidden>🔒 </span>
          {describeLinearLock(data)}
        </p>
      )}

      {frontier && data.skills.length > 0 && (
        <div data-element="frontier-skills" className={css({ marginTop: '0.75rem' })}>
          <p
            data-element="frontier-summary"
            className={css({
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.375rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Working toward: {frontier.name} · {frontier.solidCount} of {frontier.total} solid
          </p>
          <ul
            data-element="frontier-skill-list"
            className={css({ display: 'flex', flexDirection: 'column', gap: '0.25rem' })}
          >
            {data.skills.map((skill) => (
              <FrontierSkillRow key={skill.skillId} skill={skill} isDark={isDark} />
            ))}
          </ul>
        </div>
      )}

      {data.pending.length > 0 && (
        <div data-element="pending-skills" className={css({ marginTop: '0.75rem' })}>
          <p
            data-element="pending-summary"
            className={css({
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.375rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Almost there: {data.pending.length} {data.pending.length === 1 ? 'skill' : 'skills'}{' '}
            still settling
          </p>
          <ul
            data-element="pending-skill-list"
            className={css({ display: 'flex', flexDirection: 'column', gap: '0.25rem' })}
          >
            {data.pending.map((skill) => (
              <FrontierSkillRow key={skill.skillId} skill={skill} isDark={isDark} />
            ))}
          </ul>
        </div>
      )}

      {vetoed.length > 0 && (
        <ul
          data-element="vetoed-categories"
          className={css({
            marginTop: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          })}
        >
          {vetoed.map((c) => (
            <li
              key={c.category}
              data-category={c.category}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: isDark ? 'gray.300' : 'gray.600',
              })}
            >
              <span>{c.name}: you said 'not yet'</span>
              <button
                type="button"
                data-action="undo-linear-veto"
                data-category={c.category}
                onClick={() => clearVeto.mutate({ category: c.category })}
                className={css({
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: isDark ? 'green.700' : 'green.300',
                  backgroundColor: isDark ? 'green.900' : 'green.50',
                  color: isDark ? 'green.200' : 'green.700',
                  cursor: clearVeto.isPending ? 'default' : 'pointer',
                  opacity: clearVeto.isPending ? 0.6 : 1,
                })}
              >
                Undo
              </button>
            </li>
          ))}
          {clearVeto.isError && (
            <li
              data-element="veto-error"
              role="alert"
              className={css({ fontSize: '0.8125rem', color: isDark ? 'red.300' : 'red.600' })}
            >
              Couldn't undo that — please try again.
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function FrontierSkillRow({
  skill,
  isDark,
}: {
  skill: LinearReadinessSkillState
  isDark: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const readiness = { [skill.skillId]: skill.readiness }
  const entry = skill.entry
  const solid = entry
    ? entry.advancesFrontier
    : skill.readiness.isSolid && skill.readiness.dimensions.volume.opportunities > 0
  return (
    <li
      data-element="frontier-skill"
      data-skill-id={skill.skillId}
      data-solid={solid}
      data-ready={entry?.ready ?? solid}
      className={css({
        borderRadius: '8px',
        backgroundColor: isDark ? 'gray.700' : 'gray.50',
      })}
    >
      <button
        type="button"
        data-action="toggle-skill-readiness"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className={css({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.375rem 0.625rem',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.875rem',
          color: isDark ? 'gray.200' : 'gray.700',
        })}
      >
        <span>{skill.name}</span>
        {entry ? (
          <LinearEntryReport entry={entry} variant="compact" />
        ) : (
          <ReadinessReport readiness={readiness} variant="compact" />
        )}
      </button>
      {expanded && (
        <div className={css({ padding: '0 0.625rem 0.5rem' })}>
          {entry ? (
            <LinearEntryReport entry={entry} variant="full" />
          ) : (
            <ReadinessReport readiness={readiness} variant="full" />
          )}
        </div>
      )}
    </li>
  )
}
