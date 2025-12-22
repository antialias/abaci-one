'use client'

import type { Classroom } from '@/db/schema'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import { ClassroomCodeShare } from './ClassroomCodeShare'

interface ClassroomTabProps {
  classroom: Classroom
}

/**
 * ClassroomTab - Shows live classroom view
 *
 * Displays students currently "present" in the classroom.
 * For Phase 3, this is an empty state.
 * Phase 6 will add presence functionality.
 */
export function ClassroomTab({ classroom }: ClassroomTabProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div
      data-component="classroom-tab"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      })}
    >
      {/* Empty state */}
      <div
        className={css({
          textAlign: 'center',
          padding: '48px 24px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          borderRadius: '16px',
          border: '2px dashed',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <div
          className={css({
            fontSize: '3rem',
            marginBottom: '16px',
          })}
        >
          🏫
        </div>
        <h3
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: isDark ? 'white' : 'gray.800',
            marginBottom: '8px',
          })}
        >
          No Students Present
        </h3>
        <p
          className={css({
            fontSize: '0.9375rem',
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: '24px',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto',
          })}
        >
          When students join your classroom for practice, they'll appear here. Share your classroom
          code to get started.
        </p>

        <ClassroomCodeShare code={classroom.code} />
      </div>

      {/* Instructions */}
      <div
        className={css({
          padding: '20px',
          backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'blue.800' : 'blue.200',
        })}
      >
        <h4
          className={css({
            fontSize: '0.9375rem',
            fontWeight: 'bold',
            color: isDark ? 'blue.300' : 'blue.700',
            marginBottom: '8px',
          })}
        >
          How students join
        </h4>
        <ol
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'blue.200' : 'blue.800',
            paddingLeft: '20px',
            listStyleType: 'decimal',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          })}
        >
          <li>Share your classroom code with parents</li>
          <li>Parents enroll their child using the code</li>
          <li>Students appear here when they start practicing</li>
        </ol>
      </div>
    </div>
  )
}
