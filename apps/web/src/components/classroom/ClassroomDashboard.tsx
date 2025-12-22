'use client'

import { useState } from 'react'
import type { Classroom, Player } from '@/db/schema'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import { ClassroomCodeShare } from './ClassroomCodeShare'
import { ClassroomTab } from './ClassroomTab'
import { EnrollChildFlow } from './EnrollChildFlow'
import { StudentManagerTab } from './StudentManagerTab'

type TabId = 'classroom' | 'students'

interface ClassroomDashboardProps {
  classroom: Classroom
  /** Teacher's own children (get special "parent access" treatment) */
  ownChildren?: Player[]
}

/**
 * ClassroomDashboard - Main teacher dashboard
 *
 * Two tabs:
 * - Classroom: Live view of present students
 * - Student Manager: Enrolled students list with progress
 *
 * Teacher's own children appear separately with full parent access.
 */
export function ClassroomDashboard({ classroom, ownChildren = [] }: ClassroomDashboardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeTab, setActiveTab] = useState<TabId>('classroom')
  const [showEnrollChild, setShowEnrollChild] = useState(false)

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'classroom', label: 'Classroom', icon: '🏫' },
    { id: 'students', label: 'Student Manager', icon: '👥' },
  ]

  return (
    <div
      data-component="classroom-dashboard"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
      })}
    >
      {/* Header */}
      <header
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          '@media (min-width: 640px)': {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        })}
      >
        <div>
          <h1
            className={css({
              fontSize: '1.75rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.900',
              marginBottom: '4px',
            })}
          >
            {classroom.name}
          </h1>
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Teacher Dashboard
          </p>
        </div>

        <ClassroomCodeShare code={classroom.code} compact />
      </header>

      {/* Own children section (if teacher has kids) */}
      {ownChildren.length > 0 && (
        <section
          className={css({
            padding: '16px',
            backgroundColor: isDark ? 'green.900/20' : 'green.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isDark ? 'green.800' : 'green.200',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            })}
          >
            <h2
              className={css({
                fontSize: '0.9375rem',
                fontWeight: 'bold',
                color: isDark ? 'green.300' : 'green.700',
              })}
            >
              Your Children
            </h2>
            <button
              type="button"
              onClick={() => setShowEnrollChild(true)}
              data-action="enroll-child-in-other-classroom"
              className={css({
                padding: '6px 12px',
                backgroundColor: 'transparent',
                color: isDark ? 'green.400' : 'green.700',
                border: '1px solid',
                borderColor: isDark ? 'green.700' : 'green.400',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isDark ? 'green.900/50' : 'green.100',
                },
              })}
            >
              📚 Enroll in another classroom
            </button>
          </div>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
            })}
          >
            {ownChildren.map((child) => (
              <div
                key={child.id}
                data-element="own-child-card"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                })}
              >
                <span
                  className={css({
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                  })}
                  style={{ backgroundColor: child.color }}
                >
                  {child.emoji}
                </span>
                <span
                  className={css({
                    fontWeight: 'medium',
                    color: isDark ? 'white' : 'gray.800',
                  })}
                >
                  {child.name}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Enroll child modal */}
      {showEnrollChild && (
        <div
          data-component="enroll-child-modal"
          className={css({
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 1000,
          })}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEnrollChild(false)
            }
          }}
        >
          <EnrollChildFlow
            children={ownChildren}
            onSuccess={() => setShowEnrollChild(false)}
            onCancel={() => setShowEnrollChild(false)}
          />
        </div>
      )}

      {/* Tab navigation */}
      <nav
        className={css({
          display: 'flex',
          gap: '4px',
          backgroundColor: isDark ? 'gray.800' : 'gray.100',
          padding: '4px',
          borderRadius: '12px',
        })}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            data-action={`select-tab-${tab.id}`}
            data-active={activeTab === tab.id}
            className={css({
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '0.9375rem',
              fontWeight: 'medium',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backgroundColor:
                activeTab === tab.id ? (isDark ? 'gray.700' : 'white') : 'transparent',
              color:
                activeTab === tab.id
                  ? isDark
                    ? 'white'
                    : 'gray.900'
                  : isDark
                    ? 'gray.400'
                    : 'gray.600',
              boxShadow: activeTab === tab.id ? 'sm' : 'none',
              _hover: {
                backgroundColor:
                  activeTab === tab.id
                    ? isDark
                      ? 'gray.700'
                      : 'white'
                    : isDark
                      ? 'gray.700/50'
                      : 'gray.200',
              },
            })}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main>
        {activeTab === 'classroom' ? (
          <ClassroomTab classroom={classroom} />
        ) : (
          <StudentManagerTab classroom={classroom} />
        )}
      </main>
    </div>
  )
}
