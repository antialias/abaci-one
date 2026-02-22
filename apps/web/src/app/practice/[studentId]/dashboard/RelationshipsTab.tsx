'use client'

import { RelationshipCard } from '@/components/practice/RelationshipCard'
import { css } from '../../../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

interface RelationshipsTabProps {
  studentId: string
  studentName: string
  isDark: boolean
}

// ============================================================================
// RelationshipsTab
// ============================================================================

export function RelationshipsTab({ studentId, studentName, isDark }: RelationshipsTabProps) {
  return (
    <div
      data-component="relationships-tab"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      })}
    >
      <div>
        <h2
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'semibold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: '0.25rem',
          })}
        >
          Relationships
        </h2>
        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          Parents, classrooms, and other connections for {studentName}
        </p>
      </div>

      <RelationshipCard playerId={studentId} playerName={studentName} editable />
    </div>
  )
}
