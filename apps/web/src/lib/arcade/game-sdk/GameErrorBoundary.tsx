/**
 * Error Boundary for Arcade Games
 *
 * Catches errors in game components and displays a friendly error message
 * instead of crashing the entire app.
 */

'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  gameName?: string
}

interface State {
  hasError: boolean
  error?: Error
}

export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('Game error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            minHeight: '400px',
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              marginBottom: '20px',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: '#dc2626',
            }}
          >
            Game Error
          </h2>
          <p
            style={{
              fontSize: '16px',
              color: '#6b7280',
              marginBottom: '12px',
              maxWidth: '500px',
            }}
          >
            {this.props.gameName
              ? `There was an error loading the game "${this.props.gameName}".`
              : 'There was an error loading the game.'}
          </p>
          {this.state.error && (
            <pre
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '12px',
                maxWidth: '600px',
                overflow: 'auto',
                textAlign: 'left',
                fontSize: '12px',
                color: '#374151',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
