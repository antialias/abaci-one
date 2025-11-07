'use client'

import React from 'react'
import { css } from '../../../../../../styled-system/css'
import { stack, hstack } from '../../../../../../styled-system/patterns'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary for worksheet pages
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app.
 *
 * This is critical for production - users should NEVER have to open
 * the browser console to understand what went wrong.
 */
export class WorksheetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('Worksheet Error Boundary caught an error:', error, errorInfo)

    // Store error info in state for display
    this.setState({
      error,
      errorInfo,
    })

    // TODO: Send error to error reporting service (Sentry, etc.)
    // Example:
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //   },
    // })
  }

  handleReset = () => {
    // Clear error state and try to recover
    this.setState({ hasError: false, error: null, errorInfo: null })

    // Reload the page to get fresh state
    window.location.reload()
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const error = this.state.error

      return (
        <div
          data-component="error-boundary"
          className={css({
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'gray.50',
            p: '8',
          })}
        >
          <div
            className={css({
              maxW: '2xl',
              w: 'full',
              bg: 'white',
              rounded: '2xl',
              shadow: 'modal',
              p: '8',
            })}
          >
            <div className={stack({ gap: '6' })}>
              {/* Error Icon & Title */}
              <div className={stack({ gap: '3', textAlign: 'center' })}>
                <div className={css({ fontSize: '6xl' })}>⚠️</div>
                <h1
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'red.700',
                  })}
                >
                  Something went wrong
                </h1>
                <p className={css({ fontSize: 'md', color: 'gray.600' })}>
                  We encountered an unexpected error while loading the worksheet creator. This
                  shouldn't happen, and we apologize for the inconvenience.
                </p>
              </div>

              {/* Error Details */}
              <div
                className={css({
                  bg: 'red.50',
                  border: '1px solid',
                  borderColor: 'red.200',
                  rounded: 'lg',
                  p: '4',
                })}
              >
                <div className={stack({ gap: '2' })}>
                  <div
                    className={css({
                      fontSize: 'sm',
                      fontWeight: 'semibold',
                      color: 'red.800',
                    })}
                  >
                    Error Details:
                  </div>
                  <pre
                    className={css({
                      fontSize: 'xs',
                      fontFamily: 'mono',
                      color: 'red.700',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowX: 'auto',
                    })}
                  >
                    {error.toString()}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <details className={css({ mt: '2' })}>
                      <summary
                        className={css({
                          fontSize: 'xs',
                          fontWeight: 'medium',
                          color: 'red.700',
                          cursor: 'pointer',
                          _hover: { color: 'red.800' },
                        })}
                      >
                        Component Stack (for developers)
                      </summary>
                      <pre
                        className={css({
                          fontSize: '2xs',
                          fontFamily: 'mono',
                          color: 'red.600',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          mt: '2',
                          maxH: '40',
                          overflowY: 'auto',
                        })}
                      >
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className={hstack({ gap: '3', justify: 'center' })}>
                <button
                  onClick={this.handleReset}
                  className={css({
                    px: '6',
                    py: '3',
                    bg: 'brand.600',
                    color: 'white',
                    fontWeight: 'semibold',
                    rounded: 'lg',
                    shadow: 'card',
                    transition: 'all',
                    cursor: 'pointer',
                    _hover: {
                      bg: 'brand.700',
                      transform: 'translateY(-1px)',
                      shadow: 'modal',
                    },
                  })}
                >
                  Reload Page
                </button>
                <a
                  href="/"
                  className={css({
                    px: '6',
                    py: '3',
                    bg: 'white',
                    color: 'gray.700',
                    fontWeight: 'semibold',
                    rounded: 'lg',
                    border: '1px solid',
                    borderColor: 'gray.300',
                    shadow: 'card',
                    transition: 'all',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    _hover: {
                      bg: 'gray.50',
                      borderColor: 'gray.400',
                    },
                  })}
                >
                  Go to Home
                </a>
              </div>

              {/* Help Text */}
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  textAlign: 'center',
                })}
              >
                If this problem persists, please report it via GitHub Issues.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
