'use client'

// A React error boundary scoped to ONE studio pane (Gitea epic #5).
//
// The studio's shared state lives in AbacusStudioProvider, which wraps the whole
// page — so a throw in a hook THERE unwinds past every pane to the route's
// error.tsx ("Something broke") and blanks the entire studio, design rail
// included. The structural fix is to keep the provider's derivations total (see
// hexRGB / catalogFromParams), so the print/filament math degrades instead of
// throwing. This boundary is the second layer: wrap each FDM output pane (the 3D
// viewer, the fabrication rail) so any fault that DOES originate inside one of
// them surfaces contextually — a compact notice in that pane, with a retry —
// while the rest of the studio (the design controls above all) keeps working.

import { Component, type ReactNode } from 'react'

interface Props {
  /** Named in the fallback + console so a caught error says which pane broke. */
  label: string
  children: ReactNode
}

interface State {
  error: Error | null
}

export class FabricationErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[FabricationErrorBoundary:${this.props.label}]`, error, info?.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        data-component="fabrication-error-boundary"
        data-error-pane={this.props.label}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 16,
          margin: 12,
          borderRadius: 12,
          background: 'rgba(127,29,29,0.30)',
          border: '1px solid rgba(248,113,113,0.5)',
          color: 'rgba(254,226,226,0.96)',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true">⛔</span> The {this.props.label} hit an error
        </div>
        <div style={{ color: 'rgba(254,226,226,0.85)' }}>
          The rest of the studio still works — your design and the other panels are unaffected. Retry
          this panel, or keep designing and try again.
        </div>
        <button
          type="button"
          data-action="retry-fabrication-pane"
          onClick={this.reset}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid rgba(248,113,113,0.6)',
            background: 'rgba(254,226,226,0.12)',
            color: 'rgba(254,226,226,0.98)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <details style={{ color: 'rgba(254,226,226,0.7)' }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>Technical details</summary>
          <div style={{ marginTop: 6, fontWeight: 600 }}>{error.message}</div>
          {error.stack && (
            <pre
              style={{
                marginTop: 6,
                fontSize: 10,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 160,
                overflow: 'auto',
              }}
            >
              {error.stack}
            </pre>
          )}
        </details>
      </div>
    )
  }
}
