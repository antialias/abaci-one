/**
 * OfflineWorkSection — Parsing Limit Stories
 *
 * Demonstrates the PARSING_LIMIT_REACHED upgrade prompt vs. normal retry button
 * on failed worksheet photo tiles.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VisualDebugProvider } from '@/contexts/VisualDebugContext'
import {
  MockWorksheetParsingProvider,
  mockParsingStates,
} from '@/contexts/WorksheetParsingContext.mock'
import { css } from '../../../styled-system/css'
import { OfflineWorkSection, type OfflineAttachment } from './OfflineWorkSection'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
}

const WORKSHEET_URL = '/storybook-assets/worksheets/worksheet-10-problems.jpg'

// =============================================================================
// Shared attachments
// =============================================================================

const failedAttachment: OfflineAttachment = {
  id: 'att-failed',
  url: WORKSHEET_URL,
  filename: 'worksheet.jpg',
  parsingStatus: 'failed',
  rawParsingResult: null,
  needsReview: false,
  sessionCreated: false,
}

const unparsedAttachment: OfflineAttachment = {
  id: 'att-unparsed',
  url: WORKSHEET_URL,
  filename: 'worksheet-2.jpg',
  parsingStatus: null,
  rawParsingResult: null,
  needsReview: false,
  sessionCreated: false,
}

// =============================================================================
// Wrapper with all required providers + no-op handlers
// =============================================================================

function StoryShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className={css({ maxWidth: '500px', margin: '0 auto' })}>
      <div
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'gray.100',
          fontSize: '0.75rem',
          color: 'gray.500',
          textAlign: 'center',
          borderBottom: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function OfflineWorkSectionDemo({
  attachments,
  parsingState,
  label,
  isDark = false,
}: {
  attachments: OfflineAttachment[]
  parsingState?: Parameters<typeof MockWorksheetParsingProvider>[0]['state']
  label: string
  isDark?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <QueryClientProvider client={createQueryClient()}>
      <VisualDebugProvider>
        <MockWorksheetParsingProvider state={parsingState}>
          <StoryShell label={label}>
            <OfflineWorkSection
              attachments={attachments}
              fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
              isUploading={false}
              uploadError={null}
              deletingId={null}
              parsingId={null}
              dragOver={false}
              isDark={isDark}
              canUpload={true}
              onFileSelect={() => {}}
              onDrop={() => {}}
              onDragOver={() => {}}
              onDragLeave={() => {}}
              onOpenCamera={() => {}}
              onOpenViewer={() => {}}
              onDeletePhoto={() => {}}
            />
          </StoryShell>
        </MockWorksheetParsingProvider>
      </VisualDebugProvider>
    </QueryClientProvider>
  )
}

// =============================================================================
// Meta
// =============================================================================

const meta: Meta<typeof OfflineWorkSection> = {
  title: 'Practice/OfflineWorkSection/Parsing Limit',
  component: OfflineWorkSection,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof OfflineWorkSection>

// =============================================================================
// Stories
// =============================================================================

export const LimitReached: Story = {
  name: 'Upgrade Plan (PARSING_LIMIT_REACHED)',
  render: () => (
    <OfflineWorkSectionDemo
      attachments={[failedAttachment]}
      parsingState={mockParsingStates.error(
        'att-failed',
        'Monthly parsing limit reached. Upgrade your plan for more parses.',
        'PARSING_LIMIT_REACHED'
      )}
      label="Failed with PARSING_LIMIT_REACHED — shows amber 'Upgrade Plan' link"
    />
  ),
}

export const GenericFailure: Story = {
  name: 'Retry Button (Generic Error)',
  render: () => (
    <OfflineWorkSectionDemo
      attachments={[failedAttachment]}
      parsingState={mockParsingStates.error(
        'att-failed',
        'Server error: could not parse worksheet'
      )}
      label="Failed with generic error — shows orange 'Retry' button"
    />
  ),
}

export const SideBySide: Story = {
  name: 'Side-by-Side Comparison',
  render: () => (
    <div className={css({ display: 'flex', gap: '2rem', flexWrap: 'wrap' })}>
      <OfflineWorkSectionDemo
        attachments={[failedAttachment]}
        parsingState={mockParsingStates.error(
          'att-failed',
          'Monthly parsing limit reached. Upgrade your plan for more parses.',
          'PARSING_LIMIT_REACHED'
        )}
        label="Limit reached → Upgrade Plan"
      />
      <OfflineWorkSectionDemo
        attachments={[{ ...failedAttachment, id: 'att-generic' }]}
        parsingState={mockParsingStates.error('att-generic', 'Server error')}
        label="Generic error → Retry"
      />
    </div>
  ),
}

export const MixedTiles: Story = {
  name: 'Mixed: Unparsed + Limit Reached',
  render: () => (
    <OfflineWorkSectionDemo
      attachments={[unparsedAttachment, { ...failedAttachment, id: 'att-limit' }]}
      parsingState={mockParsingStates.error(
        'att-limit',
        'Monthly parsing limit reached',
        'PARSING_LIMIT_REACHED'
      )}
      label="First tile: unparsed (Parse button), Second tile: limit reached (Upgrade Plan)"
    />
  ),
}

export const DarkMode: Story = {
  name: 'Dark Mode — Limit Reached',
  render: () => (
    <div className={css({ backgroundColor: 'gray.900', padding: '1rem', borderRadius: '8px' })}>
      <OfflineWorkSectionDemo
        attachments={[failedAttachment]}
        parsingState={mockParsingStates.error(
          'att-failed',
          'Monthly parsing limit reached',
          'PARSING_LIMIT_REACHED'
        )}
        label="Dark mode variant"
        isDark
      />
    </div>
  ),
}
