'use client'

import React, { Component, type ReactNode } from 'react'
import { css } from '../../styled-system/css'

interface Props {
  children: ReactNode
  fallback?: (error: Error, resetError: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for arcade games
 * Catches React errors and displays a user-friendly error UI
 */
export class ArcadeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ArcadeErrorBoundary] Caught error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError)
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />
    }

    return this.props.children
  }
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  const [showDetails, setShowDetails] = React.useState(false)

  return (
    <div
      data-component="arcade-error-boundary"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '32px',
        backgroundColor: 'red.50',
        borderRadius: '12px',
        border: '2px solid',
        borderColor: 'red.300',
        margin: '16px',
      })}
    >
      {/* Error icon */}
      <div
        className={css({
          fontSize: '64px',
          marginBottom: '16px',
        })}
      >
        ⚠️
      </div>

      {/* Error title */}
      <h2
        className={css({
          fontSize: '24px',
          fontWeight: 'bold',
          color: 'red.900',
          marginBottom: '8px',
        })}
      >
        Something Went Wrong
      </h2>

      {/* Error message */}
      <p
        className={css({
          fontSize: '16px',
          color: 'red.800',
          marginBottom: '24px',
          textAlign: 'center',
          maxWidth: '600px',
        })}
      >
        The game encountered an unexpected error. Please try refreshing the page or returning to the arcade
        lobby.
      </p>

      {/* Action buttons */}
      <div
        className={css({
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
        })}
      >
        <button
          onClick={resetError}
          data-action="reset-error"
          className={css({
            padding: '12px 24px',
            backgroundColor: 'red.600',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: {
              backgroundColor: 'red.700',
            },
          })}
        >
          Try Again
        </button>

        <button
          onClick={() => (window.location.href = '/arcade-rooms')}
          data-action="return-to-lobby"
          className={css({
            padding: '12px 24px',
            backgroundColor: 'gray.200',
            color: 'gray.800',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: {
              backgroundColor: 'gray.300',
            },
          })}
        >
          Return to Lobby
        </button>
      </div>

      {/* Technical details (collapsible) */}
      <div className={css({ marginTop: '16px', width: '100%', maxWidth: '600px' })}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          data-action="toggle-error-details"
          className={css({
            background: 'transparent',
            border: 'none',
            color: 'red.700',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline',
            _hover: {
              color: 'red.900',
            },
          })}
        >
          {showDetails ? 'Hide' : 'Show'} technical details
        </button>

        {showDetails && (
          <div
            className={css({
              marginTop: '12px',
              padding: '16px',
              backgroundColor: 'white',
              border: '1px solid',
              borderColor: 'red.200',
              borderRadius: '8px',
            })}
          >
            <div
              className={css({
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'red.900',
                marginBottom: '8px',
              })}
            >
              Error: {error.message}
            </div>

            {error.stack && (
              <pre
                className={css({
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: 'gray.700',
                  overflow: 'auto',
                  maxHeight: '200px',
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
  )
}
