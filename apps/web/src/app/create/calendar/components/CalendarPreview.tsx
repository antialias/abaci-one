'use client'

import { css } from '../../../../../styled-system/css'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'

interface CalendarPreviewProps {
  month: number
  year: number
  format: 'monthly' | 'daily'
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

export function CalendarPreview({ month, year, format }: CalendarPreviewProps) {
  const abacusConfig = useAbacusConfig()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfWeek(year, month)

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
            color: 'gray.300',
            marginBottom: '1.5rem',
            textAlign: 'center',
          })}
        >
          Daily format preview
        </p>
        <div
          className={css({
            bg: 'white',
            padding: '3rem 2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '400px',
            width: '100%',
          })}
        >
          {/* Year at top */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '2rem',
            })}
          >
            <AbacusReact
              value={year}
              columns={4}
              customStyles={abacusConfig.customStyles}
              scaleFactor={0.4}
              showNumbers={false}
            />
          </div>

          {/* Large day number */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '2rem',
            })}
          >
            <AbacusReact
              value={1}
              columns={2}
              customStyles={abacusConfig.customStyles}
              scaleFactor={0.8}
              showNumbers={false}
            />
          </div>

          {/* Date text */}
          <div
            className={css({
              textAlign: 'center',
              color: 'gray.800',
            })}
          >
            <div
              className={css({
                fontSize: '1.25rem',
                fontWeight: '600',
                marginBottom: '0.25rem',
              })}
            >
              {new Date(year, month - 1, 1).toLocaleDateString('en-US', {
                weekday: 'long',
              })}
            </div>
            <div
              className={css({
                fontSize: '1rem',
                color: 'gray.600',
              })}
            >
              {MONTHS[month - 1]} 1, {year}
            </div>
          </div>
        </div>
        <p
          className={css({
            fontSize: '0.875rem',
            color: 'gray.400',
            marginTop: '1rem',
            textAlign: 'center',
          })}
        >
          Example of first day (1 page per day for all {daysInMonth} days)
        </p>
      </div>
    )
  }

  // Monthly format
  const calendarDays: (number | null)[] = []

  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null)
  }

  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div
      data-component="calendar-preview"
      className={css({
        bg: 'gray.800',
        borderRadius: '12px',
        padding: '2rem',
      })}
    >
      <div
        className={css({
          textAlign: 'center',
          marginBottom: '2rem',
        })}
      >
        <h2
          className={css({
            fontSize: '2rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: 'yellow.400',
          })}
        >
          {MONTHS[month - 1]}
        </h2>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
          })}
        >
          <AbacusReact
            value={year}
            columns={4}
            customStyles={abacusConfig.customStyles}
            scaleFactor={0.6}
            showNumbers={false}
          />
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem',
        })}
      >
        {/* Weekday headers */}
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={css({
              textAlign: 'center',
              fontWeight: '600',
              padding: '0.5rem',
              color: 'yellow.400',
              fontSize: '0.875rem',
            })}
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={css({
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: day ? 'gray.700' : 'transparent',
              borderRadius: '6px',
              padding: '0.25rem',
            })}
          >
            {day && (
              <AbacusReact
                value={day}
                columns={2}
                customStyles={abacusConfig.customStyles}
                scaleFactor={1.0}
                showNumbers={false}
              />
            )}
          </div>
        ))}
      </div>

      <p
        className={css({
          fontSize: '0.875rem',
          color: 'gray.400',
          marginTop: '1.5rem',
          textAlign: 'center',
        })}
      >
        Preview of monthly calendar layout (actual PDF will be optimized for printing)
      </p>
    </div>
  )
}
