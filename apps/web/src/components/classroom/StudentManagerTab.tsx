'use client'

import type { Classroom } from '@/db/schema'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import { ClassroomCodeShare } from './ClassroomCodeShare'

interface StudentManagerTabProps {
  classroom: Classroom
}

/**
 * StudentManagerTab - Manage enrolled students
 *
 * Shows all students enrolled in the classroom.
 * For Phase 3, this is an empty state.
 * Phase 4 will add enrollment functionality.
 */
export function StudentManagerTab({ classroom }: StudentManagerTabProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div
      data-component="student-manager-tab"
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
          👥
        </div>
        <h3
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: isDark ? 'white' : 'gray.800',
            marginBottom: '8px',
          })}
        >
          No Students Enrolled
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
          Parents can enroll their children using your classroom code. Once enrolled, you can view
          their progress and skills here.
        </p>

        <ClassroomCodeShare code={classroom.code} />
      </div>

      {/* What you'll see when students enroll */}
      <div
        className={css({
          padding: '20px',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <h4
          className={css({
            fontSize: '0.9375rem',
            fontWeight: 'bold',
            color: isDark ? 'white' : 'gray.800',
            marginBottom: '12px',
          })}
        >
          When students enroll, you can:
        </h4>
        <ul
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.300' : 'gray.600',
            paddingLeft: '20px',
            listStyleType: 'disc',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          })}
        >
          <li>View each student's skill mastery and progress</li>
          <li>See their practice session history</li>
          <li>Observe live practice sessions</li>
          <li>Guide them through tutorials remotely</li>
        </ul>
      </div>
    </div>
  )
}
