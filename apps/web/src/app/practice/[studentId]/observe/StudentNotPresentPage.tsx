'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/components/common/ToastContext'
import { api } from '@/lib/queryClient'
import { css } from '../../../../../styled-system/css'

interface StudentNotPresentPageProps {
  studentName: string
  studentEmoji: string
  studentId: string
  classroomId: string
}

/**
 * Shown to teachers when they try to observe a student who is enrolled
 * in their class but is not currently present in the classroom.
 */
export function StudentNotPresentPage({
  studentName,
  studentEmoji,
  studentId,
  classroomId,
}: StudentNotPresentPageProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { showSuccess, showError } = useToast()
  const [promptSent, setPromptSent] = useState(false)

  // Mutation to send entry prompt to parents
  const sendEntryPrompt = useMutation({
    mutationFn: async () => {
      const response = await api(`classrooms/${classroomId}/entry-prompts`, {
        method: 'POST',
        body: JSON.stringify({ playerIds: [studentId] }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send prompt')
      }
      return response.json()
    },
    onSuccess: (data) => {
      if (data.created > 0) {
        setPromptSent(true)
        showSuccess(
          'Entry prompt sent',
          `${studentName}'s parent has been notified to enter them into the classroom.`
        )
      } else if (data.skipped?.length > 0) {
        const reason = data.skipped[0]?.reason
        if (reason === 'pending_prompt_exists') {
          showError('Prompt already pending', `${studentName} already has a pending entry prompt.`)
        } else if (reason === 'already_present') {
          showSuccess('Already in classroom', `${studentName} is now in the classroom!`)
        } else {
          showError('Could not send prompt', reason || 'Unknown error')
        }
      }
    },
    onError: (error) => {
      showError(
        'Failed to send prompt',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      )
    },
  })

  const handleSendPrompt = useCallback(() => {
    sendEntryPrompt.mutate()
  }, [sendEntryPrompt])

  return (
    <PageWithNav>
      <main
        data-component="student-not-present-page"
        className={css({
          minHeight: 'calc(100vh - 80px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
        })}
      >
        <div
          className={css({
            maxWidth: '500px',
            width: '100%',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: 'lg',
            textAlign: 'center',
          })}
        >
          {/* Student avatar */}
          <div
            className={css({
              fontSize: '4rem',
              marginBottom: '1rem',
            })}
          >
            {studentEmoji}
          </div>

          {/* Title */}
          <h1
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              marginBottom: '0.5rem',
            })}
          >
            {studentName} is not in your classroom
          </h1>

          {/* Explanation */}
          <p
            className={css({
              fontSize: '1rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
            })}
          >
            {studentName} is enrolled in your class, but you can only observe their practice
            sessions when they are present in your classroom.
          </p>

          {/* Quick action - Send entry prompt */}
          {!promptSent ? (
            <div
              data-element="entry-prompt-section"
              className={css({
                backgroundColor: isDark ? 'orange.900/30' : 'orange.50',
                border: '2px solid',
                borderColor: isDark ? 'orange.700' : 'orange.300',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1rem',
              })}
            >
              <h2
                className={css({
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  color: isDark ? 'orange.300' : 'orange.700',
                  marginBottom: '0.5rem',
                })}
              >
                Notify {studentName}&apos;s parent
              </h2>
              <p
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'gray.300' : 'gray.600',
                  marginBottom: '1rem',
                  lineHeight: '1.5',
                })}
              >
                Send a notification to {studentName}&apos;s parent asking them to enter the
                classroom.
              </p>
              <button
                type="button"
                onClick={handleSendPrompt}
                disabled={sendEntryPrompt.isPending}
                data-action="send-entry-prompt"
                className={css({
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: isDark ? 'orange.600' : 'orange.500',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: sendEntryPrompt.isPending ? 'wait' : 'pointer',
                  opacity: sendEntryPrompt.isPending ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: isDark ? 'orange.500' : 'orange.600',
                  },
                  _disabled: {
                    cursor: 'wait',
                    opacity: 0.7,
                  },
                })}
              >
                {sendEntryPrompt.isPending ? 'Sending...' : 'Send Entry Prompt'}
              </button>
            </div>
          ) : (
            <div
              data-element="prompt-sent-confirmation"
              className={css({
                backgroundColor: isDark ? 'green.900/30' : 'green.50',
                border: '2px solid',
                borderColor: isDark ? 'green.700' : 'green.300',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1rem',
                textAlign: 'center',
              })}
            >
              <p
                className={css({
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  color: isDark ? 'green.300' : 'green.700',
                })}
              >
                Entry prompt sent to {studentName}&apos;s parent
              </p>
            </div>
          )}

          {/* How to fix it manually */}
          <div
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'gray.100',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
            })}
          >
            <h2
              className={css({
                fontSize: '0.8125rem',
                fontWeight: '600',
                color: isDark ? 'gray.400' : 'gray.500',
                marginBottom: '0.5rem',
              })}
            >
              Or have {studentName} join manually
            </h2>
            <ol
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'gray.400' : 'gray.500',
                lineHeight: '1.6',
                paddingLeft: '1.25rem',
                margin: 0,
              })}
            >
              <li>
                Have {studentName} open their device and go to <strong>Join Classroom</strong>
              </li>
              <li>They enter your classroom code to join</li>
              <li>Once they appear in your classroom dashboard, you can observe their session</li>
            </ol>
          </div>

          {/* Actions */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            })}
          >
            <Link
              href={`/practice/${studentId}/dashboard`}
              className={css({
                display: 'block',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                fontWeight: '500',
                color: 'white',
                backgroundColor: 'blue.500',
                borderRadius: '8px',
                textDecoration: 'none',
                _hover: { backgroundColor: 'blue.600' },
              })}
            >
              Go to {studentName}&apos;s Dashboard
            </Link>

            <Link
              href="/practice"
              className={css({
                display: 'block',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
                backgroundColor: 'transparent',
                borderRadius: '8px',
                textDecoration: 'none',
                _hover: {
                  backgroundColor: isDark ? 'gray.700' : 'gray.100',
                },
              })}
            >
              Back to Practice Home
            </Link>
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}
