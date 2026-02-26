'use client'

import { useEffect, useMemo, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import { EuclidFoundationCanvas } from './EuclidFoundationCanvas'
import {
  FOUNDATION_ITEMS,
  FOUNDATION_DIAGRAMS,
  FOUNDATION_CATEGORIES,
  type FoundationCategory,
} from './foundationsData'
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'

interface FoundationsDeckProps {
  languageStyle: KidLanguageStyle
  focusId?: string | null
  onFocusChange?: (id: string) => void
}

export function FoundationsDeck({ languageStyle, focusId, onFocusChange }: FoundationsDeckProps) {
  const [category, setCategory] = useState<FoundationCategory>('definitions')
  const items = useMemo(
    () => FOUNDATION_ITEMS.filter((item) => item.category === category),
    [category]
  )
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? FOUNDATION_ITEMS[0]?.id)

  useEffect(() => {
    if (!focusId) return
    const found = FOUNDATION_ITEMS.find((item) => item.id === focusId)
    if (!found) return
    setCategory(found.category)
    setSelectedId(found.id)
  }, [focusId])

  const selected = useMemo(() => {
    const found = FOUNDATION_ITEMS.find((item) => item.id === selectedId)
    return found ?? items[0]
  }, [selectedId, items])

  const diagram = selected ? FOUNDATION_DIAGRAMS[selected.diagramId] : undefined
  const preferPlain = languageStyle === 'simple'
  const preferClassical = languageStyle === 'classical'

  const primaryText = preferPlain ? selected?.plain : selected?.statement
  const secondaryText = preferPlain ? selected?.statement : selected?.plain

  const primaryLabel = preferPlain ? 'In plain words' : 'Statement'
  const secondaryLabel = preferPlain ? 'Original' : preferClassical ? 'Plain words' : 'Plain words'

  return (
    <div
      data-component="foundations-deck"
      className={css({
        display: 'grid',
        gridTemplateColumns: { base: '1fr', lg: '1.1fr 0.9fr' },
        gap: '1.5rem',
        alignItems: 'start',
      })}
    >
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        })}
      >
        <div
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          })}
        >
          {FOUNDATION_CATEGORIES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-selected={category === tab.id}
              onClick={() => {
                setCategory(tab.id)
                const nextItems = FOUNDATION_ITEMS.filter((item) => item.category === tab.id)
                const nextId = nextItems[0]?.id ?? FOUNDATION_ITEMS[0]?.id
                setSelectedId(nextId)
                if (nextId) onFocusChange?.(nextId)
              }}
              className={css({
                padding: '0.45rem 0.9rem',
                borderRadius: '999px',
                border: '1px solid',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              })}
              style={{
                borderColor:
                  category === tab.id ? 'rgba(16,185,129,0.6)' : 'rgba(203, 213, 225, 0.6)',
                backgroundColor:
                  category === tab.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.7)',
                color: category === tab.id ? '#0f766e' : '#475569',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)' },
            gap: '0.75rem',
          })}
        >
          {items.map((item) => {
            const isSelected = item.id === selected?.id
            return (
              <button
                key={item.id}
                type="button"
                data-selected={isSelected}
                onClick={() => {
                  setSelectedId(item.id)
                  onFocusChange?.(item.id)
                }}
                className={css({
                  textAlign: 'left',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: '1px solid',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  _hover: {
                    transform: 'translateY(-1px)',
                  },
                })}
                style={{
                  borderColor: isSelected
                    ? 'rgba(16,185,129,0.55)'
                    : 'rgba(203, 213, 225, 0.7)',
                  boxShadow: isSelected
                    ? '0 12px 24px rgba(15, 118, 110, 0.12)'
                    : '0 2px 8px rgba(15,23,42,0.06)',
                }}
              >
                <span
                  className={css({
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
                  })}
                >
                  {item.label}
                </span>
                <span
                  className={css({
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    color: '#0f172a',
                  })}
                >
                  {item.title}
                </span>
                <span
                  className={css({
                    fontSize: '0.8rem',
                    color: '#64748b',
                    lineHeight: '1.4',
                  })}
                >
                  {item.statement}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          position: { base: 'static', lg: 'sticky' },
          top: { lg: 'calc(var(--app-nav-height) + 16px + 1rem)' },
        })}
      >
        <div
          className={css({
            padding: '1rem',
            borderRadius: '16px',
            border: '1px solid rgba(203, 213, 225, 0.7)',
            background: 'rgba(255,255,255,0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: '0 18px 32px rgba(15,23,42,0.08)',
          })}
        >
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            })}
          >
            <span
              className={css({
                fontSize: '0.75rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#94a3b8',
              })}
            >
              {selected?.label}
            </span>
            <h2
              className={css({
                fontSize: '1.3rem',
                fontWeight: '700',
                color: '#0f172a',
                margin: 0,
              })}
            >
              {selected?.title}
            </h2>
          </div>

          <div
            className={css({
              width: '100%',
              aspectRatio: '4 / 3',
            })}
          >
            {diagram && <EuclidFoundationCanvas diagram={diagram} />}
          </div>

          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            })}
          >
            <div>
              <div
                className={css({
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  marginBottom: '0.25rem',
                })}
              >
                {primaryLabel}
              </div>
              <div
                className={css({
                  fontSize: '0.95rem',
                  color: '#0f172a',
                  lineHeight: '1.55',
                  fontStyle: preferClassical && !preferPlain ? 'italic' : 'normal',
                })}
              >
                {primaryText}
              </div>
            </div>
            <div>
              <div
                className={css({
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  marginBottom: '0.25rem',
                })}
              >
                {secondaryLabel}
              </div>
              <div
                className={css({
                  fontSize: '0.85rem',
                  color: '#475569',
                  lineHeight: '1.5',
                })}
              >
                {secondaryText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
