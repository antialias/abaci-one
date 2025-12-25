'use client'

import { useCallback, useState } from 'react'
import type { Classroom } from '@/db/schema'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useEnrolledClassrooms,
  useStudentPresence,
  useEnterClassroom,
  useLeaveClassroom,
} from '@/hooks/useClassroom'
import { usePlayerEnrollmentSocket } from '@/hooks/usePlayerEnrollmentSocket'
import { EnrollChildModal } from './EnrollChildModal'
import { css } from '../../../styled-system/css'

interface EnterClassroomButtonProps {
  playerId: string
  playerName: string
}

/**
 * EnterClassroomButton - Allows students to enter/leave enrolled classrooms
 *
 * Shows:
 * - Current classroom presence (if in one)
 * - List of enrolled classrooms to enter
 * - Enter/leave actions
 */
export function EnterClassroomButton({ playerId, playerName }: EnterClassroomButtonProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [isOpen, setIsOpen] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  // Fetch enrolled classrooms and current presence
  const { data: enrolledClassrooms = [], isLoading: loadingClassrooms } =
    useEnrolledClassrooms(playerId)
  const { data: currentPresence, isLoading: loadingPresence } = useStudentPresence(playerId)

  // Subscribe to real-time enrollment updates
  usePlayerEnrollmentSocket(playerId)

  // Mutations
  const enterClassroom = useEnterClassroom()
  const leaveClassroom = useLeaveClassroom()

  const handleEnter = useCallback(
    (classroomId: string) => {
      enterClassroom.mutate(
        { classroomId, playerId },
        {
          onSuccess: () => {
            setIsOpen(false)
          },
        }
      )
    },
    [enterClassroom, playerId]
  )

  const handleLeave = useCallback(() => {
    if (!currentPresence) return
    leaveClassroom.mutate({
      classroomId: currentPresence.classroomId,
      playerId,
    })
  }, [currentPresence, leaveClassroom, playerId])

  // Don't show while loading
  if (loadingClassrooms) {
    return null
  }

  const isInClassroom = !!currentPresence
  const currentClassroom = currentPresence?.classroom

  return (
    <div data-component="enter-classroom-button" className={css({ position: 'relative' })}>
      {/* Main button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        data-action="toggle-classroom-menu"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: isInClassroom
            ? isDark
              ? 'green.900/30'
              : 'green.50'
            : isDark
              ? 'gray.700'
              : 'gray.100',
          color: isInClassroom
            ? isDark
              ? 'green.400'
              : 'green.700'
            : isDark
              ? 'gray.300'
              : 'gray.700',
          border: '1px solid',
          borderColor: isInClassroom
            ? isDark
              ? 'green.700'
              : 'green.300'
            : isDark
              ? 'gray.600'
              : 'gray.300',
          borderRadius: '10px',
          fontSize: '0.9375rem',
          fontWeight: 'medium',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          _hover: {
            backgroundColor: isInClassroom
              ? isDark
                ? 'green.900/50'
                : 'green.100'
              : isDark
                ? 'gray.600'
                : 'gray.200',
          },
        })}
      >
        {isInClassroom ? (
          <>
            <span
              className={css({
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'green.500',
              })}
            />
            <span>In {currentClassroom?.name || 'Classroom'}</span>
          </>
        ) : (
          <>
            <span>🏫</span>
            <span>Enter Classroom</span>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className={css({
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            })}
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div
            data-element="classroom-menu"
            className={css({
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              minWidth: '280px',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              zIndex: 1000,
              overflow: 'hidden',
            })}
          >
            <div
              className={css({
                padding: '12px 16px',
                borderBottom: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
              })}
            >
              <p
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: isDark ? 'white' : 'gray.800',
                })}
              >
                {playerName}&apos;s Classrooms
              </p>
            </div>

            {loadingClassrooms || loadingPresence ? (
              <div
                className={css({
                  padding: '16px',
                  textAlign: 'center',
                  color: isDark ? 'gray.400' : 'gray.500',
                  fontSize: '0.875rem',
                })}
              >
                Loading...
              </div>
            ) : (
              <div className={css({ maxHeight: '300px', overflowY: 'auto' })}>
                {/* Current presence */}
                {currentPresence && currentClassroom && (
                  <div
                    className={css({
                      padding: '12px 16px',
                      backgroundColor: isDark ? 'green.900/20' : 'green.50',
                      borderBottom: '1px solid',
                      borderColor: isDark ? 'gray.700' : 'gray.200',
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      })}
                    >
                      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <span
                          className={css({
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'green.500',
                          })}
                        />
                        <span
                          className={css({
                            fontSize: '0.8125rem',
                            fontWeight: 'medium',
                            color: isDark ? 'green.400' : 'green.700',
                          })}
                        >
                          Currently in
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLeave}
                        disabled={leaveClassroom.isPending}
                        data-action="leave-classroom"
                        className={css({
                          padding: '4px 10px',
                          backgroundColor: isDark ? 'gray.700' : 'gray.200',
                          color: isDark ? 'gray.300' : 'gray.700',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
                          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                        })}
                      >
                        {leaveClassroom.isPending ? 'Leaving...' : 'Leave'}
                      </button>
                    </div>
                    <p
                      className={css({
                        fontWeight: 'medium',
                        color: isDark ? 'white' : 'gray.800',
                      })}
                    >
                      {currentClassroom.name}
                    </p>
                  </div>
                )}

                {/* Enrolled classrooms list */}
                {enrolledClassrooms
                  .filter((c) => c.id !== currentPresence?.classroomId)
                  .map((classroom) => (
                    <ClassroomMenuItem
                      key={classroom.id}
                      classroom={classroom}
                      onEnter={() => handleEnter(classroom.id)}
                      isEntering={
                        enterClassroom.isPending &&
                        enterClassroom.variables?.classroomId === classroom.id
                      }
                      isDisabled={!!currentPresence}
                      isDark={isDark}
                    />
                  ))}

                {enrolledClassrooms.length === 0 && (
                  <div
                    className={css({
                      padding: '16px',
                      textAlign: 'center',
                      color: isDark ? 'gray.400' : 'gray.500',
                      fontSize: '0.875rem',
                    })}
                  >
                    Not enrolled in any classrooms
                  </div>
                )}

                {/* Separator and Enroll option */}
                <div
                  className={css({
                    borderTop: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                    marginTop: enrolledClassrooms.length > 0 ? '4px' : 0,
                    paddingTop: '4px',
                  })}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      setShowEnrollModal(true)
                    }}
                    data-action="open-enroll-modal"
                    className={css({
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      color: isDark ? 'blue.400' : 'blue.600',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 'medium',
                      textAlign: 'left',
                      _hover: {
                        backgroundColor: isDark ? 'gray.700' : 'gray.50',
                      },
                    })}
                  >
                    <span>➕</span>
                    <span>Enroll in Classroom</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Enroll in Classroom Modal */}
      <EnrollChildModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        playerId={playerId}
        playerName={playerName}
      />
    </div>
  )
}

interface ClassroomMenuItemProps {
  classroom: Classroom
  onEnter: () => void
  isEntering: boolean
  isDisabled: boolean
  isDark: boolean
}

function ClassroomMenuItem({
  classroom,
  onEnter,
  isEntering,
  isDisabled,
  isDark,
}: ClassroomMenuItemProps) {
  return (
    <div
      data-element="classroom-menu-item"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.100',
        _last: { borderBottom: 'none' },
      })}
    >
      <div>
        <p
          className={css({
            fontWeight: 'medium',
            color: isDark ? 'white' : 'gray.800',
            fontSize: '0.9375rem',
          })}
        >
          {classroom.name}
        </p>
      </div>

      <button
        type="button"
        onClick={onEnter}
        disabled={isEntering || isDisabled}
        data-action="enter-classroom"
        className={css({
          padding: '6px 14px',
          backgroundColor: isDisabled
            ? isDark
              ? 'gray.700'
              : 'gray.200'
            : isDark
              ? 'green.700'
              : 'green.500',
          color: isDisabled ? (isDark ? 'gray.500' : 'gray.400') : 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          fontWeight: 'medium',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          _hover: {
            backgroundColor:
              isDisabled || isEntering ? undefined : isDark ? 'green.600' : 'green.600',
          },
          _disabled: { opacity: isDisabled ? 0.5 : 1, cursor: 'not-allowed' },
        })}
      >
        {isEntering ? 'Entering...' : isDisabled ? 'Leave first' : 'Enter'}
      </button>
    </div>
  )
}
