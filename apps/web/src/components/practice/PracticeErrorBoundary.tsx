'use client'

import React, { Component, type ReactNode } from 'react'
import { css } from '../../../styled-system/css'

interface Props {
  children: ReactNode
  studentName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for practice sessions
 * Shows kid-friendly message with clear actions for grown-ups
 */
export class PracticeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PracticeErrorBoundary] Caught error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <PracticeErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          studentName={this.props.studentName}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Kid-friendly error UI with grown-up instructions
 */
function PracticeErrorFallback({
  error,
  resetError,
  studentName,
}: {
  error: Error
  resetError: () => void
  studentName?: string
}) {
  const [showDetails, setShowDetails] = React.useState(false)

  return (
    <div
      data-component="practice-error-boundary"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        backgroundColor: 'amber.50',
        textAlign: 'center',
      })}
    >
      {/* Kid-friendly section */}
      <div
        className={css({
          marginBottom: '2rem',
        })}
      >
        <div className={css({ fontSize: '4rem', marginBottom: '1rem' })}>😕</div>
        <h1
          className={css({
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: 'gray.800',
            marginBottom: '0.5rem',
          })}
        >
          Oops! Something went wrong.
        </h1>
        <p
          className={css({
            fontSize: '1.25rem',
            color: 'gray.600',
          })}
        >
          Go get a grown-up to help fix this.
        </p>
      </div>

      {/* Grown-up section */}
      <div
        className={css({
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '2px solid',
          borderColor: 'amber.300',
          maxWidth: '500px',
          width: '100%',
        })}
      >
        <h2
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            color: 'gray.700',
            marginBottom: '1rem',
          })}
        >
          For grown-ups:
        </h2>

        <p
          className={css({
            fontSize: '0.875rem',
            color: 'gray.600',
            marginBottom: '1rem',
          })}
        >
          {studentName ? `${studentName}'s` : 'The'} practice session encountered an error. Try one
          of these options:
        </p>

        {/* Action buttons */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '1rem',
          })}
        >
          <button
            type="button"
            onClick={resetError}
            data-action="try-again"
            className={css({
              padding: '0.75rem 1.5rem',
              backgroundColor: 'blue.600',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              _hover: {
                backgroundColor: 'blue.700',
              },
            })}
          >
            Try Again
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = '/practice')}
            data-action="start-over"
            className={css({
              padding: '0.75rem 1.5rem',
              backgroundColor: 'gray.200',
              color: 'gray.800',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              _hover: {
                backgroundColor: 'gray.300',
              },
            })}
          >
            Start Over (Pick Student Again)
          </button>
        </div>

        {/* Technical details (collapsible) */}
        <div
          className={css({
            marginTop: '1rem',
            borderTop: '1px solid',
            borderColor: 'gray.200',
            paddingTop: '1rem',
          })}
        >
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            data-action="toggle-error-details"
            className={css({
              background: 'transparent',
              border: 'none',
              color: 'gray.500',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              _hover: {
                color: 'gray.700',
              },
            })}
          >
            {showDetails ? 'Hide' : 'Show'} technical details
          </button>

          {showDetails && (
            <div
              className={css({
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'gray.100',
                borderRadius: '6px',
                textAlign: 'left',
              })}
            >
              <div
                className={css({
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: 'red.700',
                  marginBottom: '0.5rem',
                })}
              >
                Error: {error.message}
              </div>

              {error.stack && (
                <pre
                  className={css({
                    fontSize: '0.625rem',
                    fontFamily: 'monospace',
                    color: 'gray.600',
                    overflow: 'auto',
                    maxHeight: '150px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  })}
                >
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
