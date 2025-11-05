'use client'

import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
}

export function ConfigPanel({ formState, onChange }: ConfigPanelProps) {
  const t = useTranslations('create.worksheets.addition')

  return (
    <div data-component="config-panel" className={stack({ gap: '6' })}>
      <div className={stack({ gap: '1' })}>
        <h2
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'gray.900',
          })}
        >
          {t('config.title')}
        </h2>
        <p
          className={css({
            fontSize: 'sm',
            color: 'gray.600',
          })}
        >
          {t('config.subtitle')}
        </p>
      </div>

      {/* Personalization Section */}
      <div data-section="personalization" className={stack({ gap: '4' })}>
        <h3
          className={css({
            fontSize: 'md',
            fontWeight: 'semibold',
            color: 'gray.800',
          })}
        >
          {t('config.personalization.title')}
        </h3>

        <div data-setting="name" className={stack({ gap: '2' })}>
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
            })}
          >
            {t('config.personalization.name')}
          </label>
          <input
            type="text"
            value={formState.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Student name"
            className={css({
              px: '3',
              py: '2',
              border: '1px solid',
              borderColor: 'gray.300',
              rounded: 'lg',
              fontSize: 'sm',
              _focus: {
                outline: 'none',
                borderColor: 'brand.500',
                ring: '2px',
                ringColor: 'brand.200',
              },
            })}
          />
        </div>
      </div>

      {/* Problem Set Section */}
      <div data-section="problem-set" className={stack({ gap: '4' })}>
        <h3
          className={css({
            fontSize: 'md',
            fontWeight: 'semibold',
            color: 'gray.800',
          })}
        >
          {t('config.problemSet.title')}
        </h3>

        <div data-setting="orientation" className={stack({ gap: '2' })}>
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
            })}
          >
            Page Orientation
          </label>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2',
            })}
          >
            <button
              onClick={() => onChange({ cols: 3, rows: 5, total: 15, orientation: 'portrait' })}
              className={css({
                px: '3',
                py: '2',
                border: '2px solid',
                borderColor:
                  (formState.orientation || 'portrait') === 'portrait' ? 'brand.500' : 'gray.300',
                bg: (formState.orientation || 'portrait') === 'portrait' ? 'brand.50' : 'white',
                color:
                  (formState.orientation || 'portrait') === 'portrait' ? 'brand.700' : 'gray.700',
                rounded: 'lg',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                justifyContent: 'center',
                _hover: {
                  borderColor: 'brand.400',
                  bg:
                    (formState.orientation || 'portrait') === 'portrait' ? 'brand.100' : 'gray.50',
                },
              })}
            >
              <div>📄</div>
              <div>Portrait</div>
            </button>

            <button
              onClick={() => onChange({ cols: 5, rows: 4, total: 20, orientation: 'landscape' })}
              className={css({
                px: '3',
                py: '2',
                border: '2px solid',
                borderColor:
                  (formState.orientation || 'portrait') === 'landscape' ? 'brand.500' : 'gray.300',
                bg: (formState.orientation || 'portrait') === 'landscape' ? 'brand.50' : 'white',
                color:
                  (formState.orientation || 'portrait') === 'landscape' ? 'brand.700' : 'gray.700',
                rounded: 'lg',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                justifyContent: 'center',
                _hover: {
                  borderColor: 'brand.400',
                  bg:
                    (formState.orientation || 'portrait') === 'landscape' ? 'brand.100' : 'gray.50',
                },
              })}
            >
              <div>📃</div>
              <div>Landscape</div>
            </button>
          </div>
        </div>

        <div data-setting="problem-count" className={stack({ gap: '2' })}>
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
            })}
          >
            Number of Problems
          </label>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '2',
            })}
          >
            {(formState.orientation || 'portrait') === 'portrait'
              ? // Portrait options (2-3 columns)
                // Portrait can fit ~5 rows per page
                [
                  { cols: 2, rows: 3 },
                  { cols: 2, rows: 4 },
                  { cols: 2, rows: 5 },
                  { cols: 3, rows: 4 },
                  { cols: 3, rows: 5 },
                  { cols: 3, rows: 10 },
                ].map(({ cols, rows }) => {
                  const maxRowsPerPage = 5
                  const pages = Math.ceil(rows / maxRowsPerPage)
                  const total = cols * rows
                  const isSelected = formState.cols === cols && formState.rows === rows
                  return (
                    <button
                      key={`${cols}x${rows}`}
                      onClick={() => onChange({ cols, rows, total })}
                      className={css({
                        px: '3',
                        py: '2',
                        border: '2px solid',
                        borderColor: isSelected ? 'brand.500' : 'gray.300',
                        bg: isSelected ? 'brand.50' : 'white',
                        rounded: 'lg',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2',
                        _hover: {
                          borderColor: 'brand.400',
                          bg: isSelected ? 'brand.100' : 'gray.50',
                        },
                      })}
                    >
                      {/* Visual grid representation */}
                      <div
                        className={css({
                          display: 'grid',
                          gap: '1',
                          gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        })}
                      >
                        {Array.from({ length: total }).map((_, i) => (
                          <div
                            key={i}
                            className={css({
                              w: '3',
                              h: '3',
                              bg: isSelected ? 'brand.400' : 'gray.400',
                              rounded: 'sm',
                            })}
                          />
                        ))}
                      </div>
                      {/* Problem count */}
                      <div
                        className={css({
                          fontSize: 'sm',
                          fontWeight: 'bold',
                          color: isSelected ? 'brand.700' : 'gray.700',
                        })}
                      >
                        {total}
                      </div>
                      {/* Page count */}
                      <div
                        className={css({
                          fontSize: 'xs',
                          color: isSelected ? 'brand.600' : 'gray.500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1',
                        })}
                      >
                        {Array.from({ length: pages }).map((_, i) => (
                          <span key={i}>📄</span>
                        ))}
                        <span>
                          {pages} page{pages > 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  )
                })
              : // Landscape options (4-5 columns)
                // Landscape can fit ~2 rows per page
                [
                  { cols: 4, rows: 3 },
                  { cols: 5, rows: 3 },
                  { cols: 4, rows: 4 },
                  { cols: 5, rows: 4 },
                  { cols: 4, rows: 5 },
                  { cols: 5, rows: 5 },
                  { cols: 5, rows: 6 },
                ].map(({ cols, rows }) => {
                  const maxRowsPerPage = 2
                  const pages = Math.ceil(rows / maxRowsPerPage)
                  const total = cols * rows
                  const isSelected = formState.cols === cols && formState.rows === rows
                  return (
                    <button
                      key={`${cols}x${rows}`}
                      onClick={() => onChange({ cols, rows, total })}
                      className={css({
                        px: '3',
                        py: '2',
                        border: '2px solid',
                        borderColor: isSelected ? 'brand.500' : 'gray.300',
                        bg: isSelected ? 'brand.50' : 'white',
                        rounded: 'lg',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2',
                        _hover: {
                          borderColor: 'brand.400',
                          bg: isSelected ? 'brand.100' : 'gray.50',
                        },
                      })}
                    >
                      {/* Visual grid representation */}
                      <div
                        className={css({
                          display: 'grid',
                          gap: '1',
                          gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        })}
                      >
                        {Array.from({ length: total }).map((_, i) => (
                          <div
                            key={i}
                            className={css({
                              w: '3',
                              h: '3',
                              bg: isSelected ? 'brand.400' : 'gray.400',
                              rounded: 'sm',
                            })}
                          />
                        ))}
                      </div>
                      {/* Problem count */}
                      <div
                        className={css({
                          fontSize: 'sm',
                          fontWeight: 'bold',
                          color: isSelected ? 'brand.700' : 'gray.700',
                        })}
                      >
                        {total}
                      </div>
                      {/* Page count */}
                      <div
                        className={css({
                          fontSize: 'xs',
                          color: isSelected ? 'brand.600' : 'gray.500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1',
                        })}
                      >
                        {Array.from({ length: pages }).map((_, i) => (
                          <span key={i}>📄</span>
                        ))}
                        <span>
                          {pages} page{pages > 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  )
                })}
          </div>
        </div>
      </div>

      {/* Difficulty Section */}
      <div data-section="difficulty" className={stack({ gap: '4' })}>
        <h3
          className={css({
            fontSize: 'md',
            fontWeight: 'semibold',
            color: 'gray.800',
          })}
        >
          {t('config.difficulty.title')}
        </h3>

        <div data-setting="p-any-start" className={stack({ gap: '2' })}>
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
            })}
          >
            {t('config.difficulty.pAnyStart')} ({Math.round((formState.pAnyStart || 0.75) * 100)}%)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={formState.pAnyStart || 0.75}
            onChange={(e) => onChange({ pAnyStart: Number(e.target.value) })}
            className={css({ w: 'full' })}
          />
          <div className={css({ fontSize: 'xs', color: 'gray.500' })}>
            % requiring any regrouping (ones or both) at sheet start
          </div>
        </div>

        <div data-setting="p-all-start" className={stack({ gap: '2' })}>
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
            })}
          >
            {t('config.difficulty.pAllStart')} ({Math.round((formState.pAllStart || 0.25) * 100)}%)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={formState.pAllStart || 0.25}
            onChange={(e) => onChange({ pAllStart: Number(e.target.value) })}
            className={css({ w: 'full' })}
          />
          <div className={css({ fontSize: 'xs', color: 'gray.500' })}>
            % requiring regrouping in both ones and tens at start
          </div>
        </div>

        <div
          data-setting="interpolate"
          className={css({ display: 'flex', gap: '3', alignItems: 'center' })}
        >
          <input
            type="checkbox"
            checked={formState.interpolate ?? true}
            onChange={(e) => onChange({ interpolate: e.target.checked })}
            className={css({
              w: '4',
              h: '4',
              cursor: 'pointer',
            })}
          />
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
              cursor: 'pointer',
            })}
          >
            {t('config.difficulty.interpolate')}
          </label>
        </div>
        <div className={css({ fontSize: 'xs', color: 'gray.500', ml: '7' })}>
          Start easy, progressively get harder toward target percentages
        </div>
      </div>

      {/* Display Options Section */}
      <div data-section="display" className={stack({ gap: '4' })}>
        <h3
          className={css({
            fontSize: 'md',
            fontWeight: 'semibold',
            color: 'gray.800',
          })}
        >
          {t('config.display.title')}
        </h3>

        <div
          data-setting="show-carry-boxes"
          className={css({ display: 'flex', gap: '3', alignItems: 'center' })}
        >
          <input
            type="checkbox"
            checked={formState.showCarryBoxes ?? true}
            onChange={(e) => onChange({ showCarryBoxes: e.target.checked })}
            className={css({
              w: '4',
              h: '4',
              cursor: 'pointer',
            })}
          />
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
              cursor: 'pointer',
            })}
          >
            {t('config.display.showCarryBoxes')}
          </label>
        </div>

        <div
          data-setting="show-cell-border"
          className={css({ display: 'flex', gap: '3', alignItems: 'center' })}
        >
          <input
            type="checkbox"
            checked={formState.showCellBorder ?? true}
            onChange={(e) => onChange({ showCellBorder: e.target.checked })}
            className={css({
              w: '4',
              h: '4',
              cursor: 'pointer',
            })}
          />
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
              cursor: 'pointer',
            })}
          >
            {t('config.display.showCellBorder')}
          </label>
        </div>
      </div>
    </div>
  )
}
