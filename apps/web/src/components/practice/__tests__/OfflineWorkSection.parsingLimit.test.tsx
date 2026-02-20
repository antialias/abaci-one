/**
 * Tests for PARSING_LIMIT_REACHED upgrade prompt in OfflineWorkSection
 *
 * When a worksheet parse fails with code 'PARSING_LIMIT_REACHED',
 * the tile should show an "Upgrade Plan" link instead of a retry button.
 */

import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import type { ParsingContextState } from '@/lib/worksheet-parsing/state-machine'
import { initialParsingState } from '@/lib/worksheet-parsing/state-machine'
import type { WorksheetParsingContextValue } from '@/contexts/WorksheetParsingContext'
import { OfflineWorkSection, type OfflineAttachment } from '../OfflineWorkSection'

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css'),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock child components to simplify rendering
vi.mock('../ParsingProgressOverlay', () => ({
  ParsingProgressOverlay: () => null,
}))
vi.mock('../ParsingProgressPanel', () => ({
  ParsingProgressPanel: () => null,
}))
vi.mock('../ProgressiveHighlightOverlay', () => ({
  ProgressiveHighlightOverlayCompact: () => null,
}))
vi.mock('../../worksheet-parsing', () => ({
  WorksheetReviewSummary: () => null,
}))

// Mock the worksheet parsing context hook
const mockContextValue: WorksheetParsingContextValue = {
  state: initialParsingState,
  isParsingAttachment: () => false,
  isAnyParsingActive: () => false,
  getStreamingStatus: () => null,
  startParse: vi.fn(),
  startReparse: vi.fn(),
  cancel: vi.fn(),
  cancelAll: vi.fn(),
  reconnectToTask: vi.fn().mockResolvedValue(false),
  submitCorrection: vi.fn(),
  approve: vi.fn().mockResolvedValue({ sessionId: null }),
  unapprove: vi.fn(),
}

vi.mock('@/contexts/WorksheetParsingContext', () => ({
  useWorksheetParsingContext: () => mockContextValue,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const baseAttachment: OfflineAttachment = {
  id: 'att-1',
  // Use data URI to avoid jsdom Canvas.Image error (setup.ts intercepts data: URIs)
  url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  filename: 'test.jpg',
  parsingStatus: null,
  rawParsingResult: null,
  needsReview: false,
  sessionCreated: false,
}

const baseProps = {
  attachments: [baseAttachment],
  fileInputRef: { current: null } as React.RefObject<HTMLInputElement>,
  isUploading: false,
  uploadError: null,
  deletingId: null,
  parsingId: null,
  dragOver: false,
  isDark: false,
  onFileSelect: vi.fn(),
  onDrop: vi.fn(),
  onDragOver: vi.fn(),
  onDragLeave: vi.fn(),
  onOpenCamera: vi.fn(),
  onOpenViewer: vi.fn(),
  onDeletePhoto: vi.fn(),
}

describe('OfflineWorkSection - PARSING_LIMIT_REACHED', () => {
  it('shows "Upgrade Plan" link when error code is PARSING_LIMIT_REACHED', () => {
    const failedAttachment: OfflineAttachment = {
      ...baseAttachment,
      parsingStatus: 'failed',
    }

    // Set lastErrors with the PARSING_LIMIT_REACHED code
    mockContextValue.state = {
      ...initialParsingState,
      lastErrors: new Map([
        ['att-1', { message: 'Monthly parsing limit reached', code: 'PARSING_LIMIT_REACHED' }],
      ]),
    }

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <OfflineWorkSection {...baseProps} attachments={[failedAttachment]} />
      </Wrapper>
    )

    // Should show upgrade link, not retry button
    const upgradeLink = screen.getByText('Upgrade Plan')
    expect(upgradeLink).toBeTruthy()
    expect(upgradeLink.closest('a')?.getAttribute('href')).toBe('/pricing')

    // Should NOT show retry button
    expect(screen.queryByText('Retry')).toBeNull()
  })

  it('shows "Retry" button for regular parse failures', () => {
    const failedAttachment: OfflineAttachment = {
      ...baseAttachment,
      parsingStatus: 'failed',
    }

    // Set lastErrors with a generic error (no code)
    mockContextValue.state = {
      ...initialParsingState,
      lastErrors: new Map([['att-1', { message: 'Server error' }]]),
    }

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <OfflineWorkSection {...baseProps} attachments={[failedAttachment]} />
      </Wrapper>
    )

    // Should show retry button, not upgrade link
    expect(screen.getByText('Retry')).toBeTruthy()
    expect(screen.queryByText('Upgrade Plan')).toBeNull()
  })

  it('shows "Retry" button when no error is stored in context', () => {
    const failedAttachment: OfflineAttachment = {
      ...baseAttachment,
      parsingStatus: 'failed',
    }

    // Empty lastErrors (e.g., page was refreshed)
    mockContextValue.state = {
      ...initialParsingState,
      lastErrors: new Map(),
    }

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <OfflineWorkSection {...baseProps} attachments={[failedAttachment]} />
      </Wrapper>
    )

    expect(screen.getByText('Retry')).toBeTruthy()
    expect(screen.queryByText('Upgrade Plan')).toBeNull()
  })

  it('shows "Parse" button for unparsed attachments', () => {
    mockContextValue.state = initialParsingState

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <OfflineWorkSection {...baseProps} attachments={[baseAttachment]} />
      </Wrapper>
    )

    expect(screen.getByText('Parse')).toBeTruthy()
    expect(screen.queryByText('Retry')).toBeNull()
    expect(screen.queryByText('Upgrade Plan')).toBeNull()
  })
})
