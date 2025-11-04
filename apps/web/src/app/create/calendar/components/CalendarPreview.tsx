'use client'

import { AbacusStatic } from '@soroban/abacus-react/static'
import { css } from '../../../../../styled-system/css'

interface CalendarPreviewProps {
  month: number
  year: number
  format: 'monthly' | 'daily'
  previewSvg: string | null
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

export function CalendarPreview({ month, year, format, previewSvg }: CalendarPreviewProps) {
  // If we have the generated PDF SVG, show that instead
  if (previewSvg) {
    return (
      <div
        data-component="calendar-preview"
        className={css({
          bg: 'gray.800',
          borderRadius: '12px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        })}
      >
        <p
          className={css({
            fontSize: '1.125rem',
            color: 'yellow.400',
            marginBottom: '1rem',
            textAlign: 'center',
            fontWeight: 'bold',
          })}
        >
          Generated PDF Preview
        </p>
        <div
          className={css({
            bg: 'white',
            borderRadius: '8px',
            padding: '1rem',
            maxWidth: '100%',
            overflow: 'auto',
          })}
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
      </div>
    )
  }

  // For daily format, no live preview
  if (format === 'daily') {
    return (
      <div
        data-component="calendar-preview"
        className={css({
          bg: 'gray.800',
          borderRadius: '12px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '600px',
        })}
      >
        <p
          className={css({
            fontSize: '1.25rem',
            color: 'gray.400',
            textAlign: 'center',
          })}
        >
          Daily format - preview after generation
        </p>
      </div>
    )
  }

  // Live preview: render calendar with React components
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfWeek(year, month)
  const monthName = MONTH_NAMES[month - 1]
  const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))

  // Generate calendar cells
  const calendarCells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day)
  }

  return (
    <div
      data-component="calendar-preview"
      className={css({
        bg: 'gray.800',
        borderRadius: '12px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      })}
    >
      <p
        className={css({
          fontSize: '1.125rem',
          color: 'yellow.400',
          marginBottom: '1rem',
          textAlign: 'center',
          fontWeight: 'bold',
        })}
      >
        Live Preview
      </p>
      <div
        className={css({
          bg: 'white',
          borderRadius: '8px',
          padding: '1rem',
          maxWidth: '100%',
          overflow: 'auto',
        })}
      >
        {/* Calendar Header */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '1rem',
          })}
        >
          <h2
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: '#1a1a1a',
            })}
          >
            {monthName}
          </h2>
          <div className={css({ transform: 'scale(0.6)' })}>
            <AbacusStatic
              value={year}
              columns={yearColumns}
              scaleFactor={1}
              showNumbers={false}
              frameVisible={true}
              compact={false}
            />
          </div>
        </div>

        {/* Weekday Headers */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            marginBottom: '2px',
          })}
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className={css({
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                padding: '0.5rem',
                color: '#555',
                borderBottom: '2px solid #333',
              })}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            bg: '#333',
            border: '2px solid #333',
          })}
        >
          {calendarCells.map((day, index) => (
            <div
              key={index}
              className={css({
                bg: 'white',
                minHeight: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
              })}
            >
              {day !== null && (
                <div className={css({ transform: 'scale(0.4)' })}>
                  <AbacusStatic
                    value={day}
                    columns={2}
                    scaleFactor={1}
                    showNumbers={false}
                    frameVisible={true}
                    compact={false}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
