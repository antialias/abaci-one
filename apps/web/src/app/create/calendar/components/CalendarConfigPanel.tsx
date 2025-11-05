'use client'

import { useTranslations } from 'next-intl'
import { css } from '../../../../../styled-system/css'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { AbacusDisplayDropdown } from '@/components/AbacusDisplayDropdown'

interface CalendarConfigPanelProps {
  month: number
  year: number
  format: 'monthly' | 'daily'
  paperSize: 'us-letter' | 'a4' | 'a3' | 'tabloid'
  isGenerating: boolean
  onMonthChange: (month: number) => void
  onYearChange: (year: number) => void
  onFormatChange: (format: 'monthly' | 'daily') => void
  onPaperSizeChange: (size: 'us-letter' | 'a4' | 'a3' | 'tabloid') => void
  onGenerate: () => void
}

export function CalendarConfigPanel({
  month,
  year,
  format,
  paperSize,
  isGenerating,
  onMonthChange,
  onYearChange,
  onFormatChange,
  onPaperSizeChange,
  onGenerate,
}: CalendarConfigPanelProps) {
  const t = useTranslations('calendar')
  const abacusConfig = useAbacusConfig()

  const MONTHS = [
    t('months.january'),
    t('months.february'),
    t('months.march'),
    t('months.april'),
    t('months.may'),
    t('months.june'),
    t('months.july'),
    t('months.august'),
    t('months.september'),
    t('months.october'),
    t('months.november'),
    t('months.december'),
  ]

  return (
    <div
      data-component="calendar-config-panel"
      className={css({
        bg: 'gray.800',
        borderRadius: '12px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      })}
    >
      {/* Format Selection */}
      <fieldset
        data-section="format-selection"
        className={css({
          border: 'none',
          padding: '0',
          margin: '0',
        })}
      >
        <legend
          className={css({
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
            color: 'yellow.400',
          })}
        >
          {t('format.title')}
        </legend>
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          })}
        >
          <label
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '6px',
              _hover: { bg: 'gray.700' },
            })}
          >
            <input
              type="radio"
              value="monthly"
              checked={format === 'monthly'}
              onChange={(e) => onFormatChange(e.target.value as 'monthly' | 'daily')}
              className={css({
                cursor: 'pointer',
              })}
            />
            <span>{t('format.monthly')}</span>
          </label>
          <label
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '6px',
              _hover: { bg: 'gray.700' },
            })}
          >
            <input
              type="radio"
              value="daily"
              checked={format === 'daily'}
              onChange={(e) => onFormatChange(e.target.value as 'monthly' | 'daily')}
              className={css({
                cursor: 'pointer',
              })}
            />
            <span>{t('format.daily')}</span>
          </label>
        </div>
      </fieldset>

      {/* Date Selection */}
      <fieldset
        data-section="date-selection"
        className={css({
          border: 'none',
          padding: '0',
          margin: '0',
        })}
      >
        <legend
          className={css({
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
            color: 'yellow.400',
          })}
        >
          {t('date.title')}
        </legend>
        <div
          className={css({
            display: 'flex',
            gap: '0.5rem',
          })}
        >
          <select
            data-element="month-select"
            value={month}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className={css({
              flex: '1',
              padding: '0.5rem',
              borderRadius: '6px',
              bg: 'gray.700',
              color: 'white',
              border: '1px solid',
              borderColor: 'gray.600',
              cursor: 'pointer',
              _hover: { borderColor: 'gray.500' },
            })}
          >
            {MONTHS.map((monthName, index) => (
              <option key={monthName} value={index + 1}>
                {monthName}
              </option>
            ))}
          </select>
          <input
            type="number"
            data-element="year-input"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            min={1}
            max={9999}
            className={css({
              width: '100px',
              padding: '0.5rem',
              borderRadius: '6px',
              bg: 'gray.700',
              color: 'white',
              border: '1px solid',
              borderColor: 'gray.600',
              _hover: { borderColor: 'gray.500' },
            })}
          />
        </div>
      </fieldset>

      {/* Paper Size */}
      <fieldset
        data-section="paper-size"
        className={css({
          border: 'none',
          padding: '0',
          margin: '0',
        })}
      >
        <legend
          className={css({
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
            color: 'yellow.400',
          })}
        >
          {t('paperSize.title')}
        </legend>
        <select
          data-element="paper-size-select"
          value={paperSize}
          onChange={(e) =>
            onPaperSizeChange(e.target.value as 'us-letter' | 'a4' | 'a3' | 'tabloid')
          }
          className={css({
            width: '100%',
            padding: '0.5rem',
            borderRadius: '6px',
            bg: 'gray.700',
            color: 'white',
            border: '1px solid',
            borderColor: 'gray.600',
            cursor: 'pointer',
            _hover: { borderColor: 'gray.500' },
          })}
        >
          <option value="us-letter">{t('paperSize.usLetter')}</option>
          <option value="a4">{t('paperSize.a4')}</option>
          <option value="a3">{t('paperSize.a3')}</option>
          <option value="tabloid">{t('paperSize.tabloid')}</option>
        </select>
      </fieldset>

      {/* Abacus Styling */}
      <div
        data-section="styling-info"
        className={css({
          padding: '1rem',
          bg: 'gray.700',
          borderRadius: '8px',
        })}
      >
        <p
          className={css({
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
            color: 'gray.300',
          })}
        >
          {t('styling.preview')}
        </p>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '0.75rem',
          })}
        >
          <AbacusReact
            value={12}
            columns={2}
            customStyles={abacusConfig.customStyles}
            scaleFactor={0.5}
            showNumbers={false}
          />
        </div>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
          })}
        >
          <AbacusDisplayDropdown />
        </div>
      </div>

      {/* Generate Button */}
      <button
        type="button"
        data-action="generate-calendar"
        onClick={onGenerate}
        disabled={isGenerating}
        className={css({
          padding: '1rem',
          bg: 'yellow.500',
          color: 'gray.900',
          fontWeight: '600',
          fontSize: '1.125rem',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          _hover: {
            bg: 'yellow.400',
          },
          _disabled: {
            bg: 'gray.600',
            color: 'gray.400',
            cursor: 'not-allowed',
          },
        })}
      >
        {isGenerating ? t('generate.generating') : t('generate.button')}
      </button>
    </div>
  )
}
