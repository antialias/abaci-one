'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useClassroomByCode, useCreateEnrollmentRequest } from '@/hooks/useClassroom'
import { usePlayersWithSkillData } from '@/hooks/useUserPlayers'
import { css } from '../../../../../styled-system/css'

/**
 * Join classroom by code page
 *
 * Flow:
 * 1. Look up classroom by code
 * 2. Show classroom info
 * 3. Let user select which child to enroll (if they have children)
 * 4. Submit enrollment request
 */
export default function JoinClassroomPage({ params }: { params: { code: string } }) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const code = params.code.toUpperCase()

  // Look up classroom
  const { data: classroom, isLoading: lookingUp, error: lookupError } = useClassroomByCode(code)

  // Get user's children
  const { data: children, isLoading: loadingChildren } = usePlayersWithSkillData()

  // Enrollment mutation
  const createRequest = useCreateEnrollmentRequest()

  // Selected child
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)

  // Auto-select if only one child
  useEffect(() => {
    if (children?.length === 1 && !selectedChildId) {
      setSelectedChildId(children[0].id)
    }
  }, [children, selectedChildId])

  const handleEnroll = useCallback(async () => {
    if (!classroom || !selectedChildId) return

    try {
      await createRequest.mutateAsync({
        classroomId: classroom.id,
        playerId: selectedChildId,
      })
    } catch {
      // Error handled by mutation state
    }
  }, [classroom, selectedChildId, createRequest])

  const handleGoToPractice = useCallback(() => {
    router.push('/practice')
  }, [router])

  const isLoading = lookingUp || loadingChildren

  // Not found
  if (!isLoading && !classroom && code.length >= 4) {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: isDark ? 'gray.900' : 'gray.50',
          padding: '20px',
        })}
      >
        <div
          className={css({
            textAlign: 'center',
            maxWidth: '400px',
          })}
        >
          <div className={css({ fontSize: '48px', marginBottom: '16px' })}>🔍</div>
          <h1
            className={css({
              fontSize: '24px',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.900',
              marginBottom: '8px',
            })}
          >
            Classroom Not Found
          </h1>
          <p
            className={css({
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '24px',
            })}
          >
            No classroom found with code <strong>{code}</strong>. Please check the code and try
            again.
          </p>
          <button
            type="button"
            onClick={() => router.push('/practice')}
            className={css({
              padding: '12px 24px',
              bg: isDark ? 'blue.600' : 'blue.500',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'medium',
              cursor: 'pointer',
            })}
          >
            Go to Practice
          </button>
        </div>
      </div>
    )
  }

  // No children
  if (!isLoading && children?.length === 0) {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: isDark ? 'gray.900' : 'gray.50',
          padding: '20px',
        })}
      >
        <div
          className={css({
            textAlign: 'center',
            maxWidth: '400px',
          })}
        >
          <div className={css({ fontSize: '48px', marginBottom: '16px' })}>👶</div>
          <h1
            className={css({
              fontSize: '24px',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.900',
              marginBottom: '8px',
            })}
          >
            No Children Found
          </h1>
          <p
            className={css({
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '24px',
            })}
          >
            You need to add a child to your account before enrolling them in a classroom.
          </p>
          <button
            type="button"
            onClick={() => router.push('/practice')}
            className={css({
              padding: '12px 24px',
              bg: isDark ? 'blue.600' : 'blue.500',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'medium',
              cursor: 'pointer',
            })}
          >
            Go to Practice
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-component="join-classroom-page"
      className={css({
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bg: isDark ? 'gray.900' : 'gray.50',
        padding: '20px',
      })}
    >
      <div
        className={css({
          bg: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '450px',
          width: '100%',
          boxShadow: 'lg',
        })}
      >
        {isLoading ? (
          <div
            className={css({
              textAlign: 'center',
              padding: '40px',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Loading...
          </div>
        ) : createRequest.isSuccess ? (
          // Success state
          <div data-section="enrollment-success" className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: '48px', marginBottom: '16px' })}>✅</div>
            <h1
              className={css({
                fontSize: '24px',
                fontWeight: 'bold',
                color: isDark ? 'green.300' : 'green.600',
                marginBottom: '8px',
              })}
            >
              Enrollment Request Sent!
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '24px',
              })}
            >
              The teacher will review and approve the enrollment for{' '}
              <strong>{children?.find((c) => c.id === selectedChildId)?.name}</strong> to join{' '}
              <strong>{classroom?.name}</strong>.
            </p>
            <button
              type="button"
              onClick={handleGoToPractice}
              className={css({
                width: '100%',
                padding: '14px',
                bg: isDark ? 'green.600' : 'green.500',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              })}
            >
              Go to Practice
            </button>
          </div>
        ) : (
          // Enrollment form
          <>
            <h1
              className={css({
                fontSize: '24px',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.900',
                marginBottom: '8px',
              })}
            >
              Join Classroom
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '24px',
              })}
            >
              Enroll your child in this classroom.
            </p>

            {/* Classroom info */}
            {classroom && (
              <div
                data-section="classroom-info"
                className={css({
                  padding: '16px',
                  bg: isDark ? 'green.900/30' : 'green.50',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: isDark ? 'green.700' : 'green.200',
                  marginBottom: '24px',
                })}
              >
                <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
                  <span className={css({ fontSize: '32px' })}>🏫</span>
                  <div>
                    <p
                      className={css({
                        fontWeight: 'bold',
                        fontSize: '18px',
                        color: isDark ? 'green.300' : 'green.700',
                      })}
                    >
                      {classroom.name}
                    </p>
                    <p
                      className={css({
                        fontSize: '14px',
                        color: isDark ? 'green.400' : 'green.600',
                      })}
                    >
                      Teacher:{' '}
                      {(classroom as { teacher?: { name?: string } }).teacher?.name ?? 'Teacher'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Child selection */}
            {children && children.length > 1 && (
              <div className={css({ marginBottom: '24px' })}>
                <label
                  className={css({
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.300' : 'gray.700',
                    marginBottom: '8px',
                  })}
                >
                  Select a child to enroll:
                </label>
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                  {children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedChildId(child.id)}
                      data-selected={selectedChildId === child.id}
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        bg:
                          selectedChildId === child.id
                            ? isDark
                              ? 'blue.900/50'
                              : 'blue.50'
                            : isDark
                              ? 'gray.700'
                              : 'gray.100',
                        border: '2px solid',
                        borderColor:
                          selectedChildId === child.id
                            ? isDark
                              ? 'blue.500'
                              : 'blue.400'
                            : 'transparent',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      })}
                    >
                      <span className={css({ fontSize: '24px' })}>👧</span>
                      <span
                        className={css({
                          fontWeight: 'medium',
                          color: isDark ? 'white' : 'gray.900',
                        })}
                      >
                        {child.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Single child - show their name */}
            {children && children.length === 1 && (
              <div
                className={css({
                  padding: '12px 16px',
                  bg: isDark ? 'gray.700' : 'gray.100',
                  borderRadius: '8px',
                  marginBottom: '24px',
                })}
              >
                <span
                  className={css({ color: isDark ? 'gray.400' : 'gray.600', fontSize: '14px' })}
                >
                  Enrolling:
                </span>{' '}
                <span
                  className={css({ fontWeight: 'medium', color: isDark ? 'white' : 'gray.900' })}
                >
                  {children[0].name}
                </span>
              </div>
            )}

            {/* Error display */}
            {createRequest.error && (
              <p
                className={css({
                  color: 'red.500',
                  fontSize: '14px',
                  marginBottom: '16px',
                })}
              >
                {createRequest.error.message}
              </p>
            )}

            {/* Actions */}
            <div className={css({ display: 'flex', gap: '12px' })}>
              <button
                type="button"
                onClick={() => router.push('/practice')}
                disabled={createRequest.isPending}
                className={css({
                  flex: 1,
                  padding: '14px',
                  bg: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.300' : 'gray.700',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEnroll}
                disabled={!selectedChildId || createRequest.isPending}
                className={css({
                  flex: 2,
                  padding: '14px',
                  bg: selectedChildId
                    ? isDark
                      ? 'green.600'
                      : 'green.500'
                    : isDark
                      ? 'gray.700'
                      : 'gray.300',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: selectedChildId ? 'pointer' : 'not-allowed',
                  opacity: selectedChildId ? 1 : 0.5,
                })}
              >
                {createRequest.isPending ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
