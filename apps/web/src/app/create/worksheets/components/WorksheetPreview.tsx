'use client'

import { Suspense, useState, useEffect, useRef, Component, type ReactNode } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { css } from '@styled/css'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { FloatingPageIndicator } from './FloatingPageIndicator'
import { PagePlaceholder } from './PagePlaceholder'
import { useTheme } from '@/contexts/ThemeContext'

interface WorksheetPreviewProps {
  formState: WorksheetFormState
  initialData?: string[]
  isScrolling?: boolean
}

function getDefaultDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

async function fetchWorksheetPreview(formState: WorksheetFormState): Promise<string[]> {
  // Set current date for preview
  const configWithDate = {
    ...formState,
    date: getDefaultDate(),
  }

  // Use absolute URL for SSR compatibility
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const url = `${baseUrl}/api/create/worksheets/preview`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configWithDate),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMsg = errorData.error || errorData.message || 'Failed to fetch preview'
    const details = errorData.details ? `\n\n${errorData.details}` : ''
    const errors = errorData.errors ? `\n\nErrors:\n${errorData.errors.join('\n')}` : ''
    throw new Error(errorMsg + details + errors)
  }

  const data = await response.json()
  return data.pages
}

function PreviewContent({ formState, initialData, isScrolling = false }: WorksheetPreviewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  // Track if we've used the initial data (so we only use it once)
  const initialDataUsed = useRef(false)

  // Only use initialData on the very first query, not on subsequent fetches
  const queryInitialData = !initialDataUsed.current && initialData ? initialData : undefined

  if (queryInitialData) {
    initialDataUsed.current = true
  }

  // Use Suspense Query - will suspend during loading
  const { data: pages } = useSuspenseQuery({
    queryKey: [
      'worksheet-preview',
      // PRIMARY state
      formState.problemsPerPage,
      formState.cols,
      formState.pages,
      formState.orientation,
      // V4: Problem size (CRITICAL - affects column layout and problem generation)
      formState.digitRange?.min,
      formState.digitRange?.max,
      // V4: Operator selection (addition, subtraction, or mixed)
      formState.operator,
      // V4: Mode and conditional display settings
      formState.mode,
      formState.displayRules, // Smart mode: conditional scaffolding
      formState.difficultyProfile, // Smart mode: difficulty preset
      formState.manualPreset, // Manual mode: manual preset
      // Mastery mode: skill IDs (CRITICAL for mastery+mixed mode)
      formState.currentAdditionSkillId,
      formState.currentSubtractionSkillId,
      formState.currentStepId,
      // Other settings that affect appearance
      formState.name,
      formState.pAnyStart,
      formState.pAllStart,
      formState.interpolate,
      formState.showCarryBoxes,
      formState.showAnswerBoxes,
      formState.showPlaceValueColors,
      formState.showProblemNumbers,
      formState.showCellBorder,
      formState.showTenFrames,
      formState.showTenFramesForAll,
      formState.seed, // Include seed to bust cache when problem set regenerates
      // Note: fontSize, date, rows, total intentionally excluded
      // (rows and total are derived from primary state)
    ],
    queryFn: () => fetchWorksheetPreview(formState),
    initialData: queryInitialData, // Only use on first render
  })

  const totalPages = pages.length

  // When initialData is provided (e.g., shared worksheets), show all pages immediately
  // Otherwise use virtualization for performance
  // Store this as state so it persists after initialData is consumed
  const [shouldVirtualize] = useState(() => !initialData)

  // Initialize visible pages based on whether we should virtualize
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => {
    if (!shouldVirtualize && initialData) {
      // Show all pages immediately for pre-rendered content
      return new Set(Array.from({ length: initialData.length }, (_, i) => i))
    }
    return new Set([0])
  })

  const [currentPage, setCurrentPage] = useState(0)

  // Track when refs are fully populated
  const [refsReady, setRefsReady] = useState(false)

  // Debug: Log when currentPage changes
  useEffect(() => {
    console.log('[PAGE INDICATOR] currentPage state changed to:', currentPage)
  }, [currentPage])

  // Reset to first page and visible pages when preview updates
  useEffect(() => {
    setCurrentPage(0)
    if (shouldVirtualize) {
      setVisiblePages(new Set([0]))
    } else {
      // Show all pages for non-virtualized view
      setVisiblePages(new Set(Array.from({ length: pages.length }, (_, i) => i)))
    }
    pageRefs.current = []
    setRefsReady(false)
  }, [pages, shouldVirtualize])

  // Check if all refs are populated after each render
  useEffect(() => {
    if (totalPages > 1 && pageRefs.current.length === totalPages) {
      const allPopulated = pageRefs.current.every((ref) => ref !== null)
      console.log('[PAGE INDICATOR] Refs check - totalPages:', totalPages, 'refs.length:', pageRefs.current.length, 'allPopulated:', allPopulated, 'refsReady:', refsReady)
      if (allPopulated && !refsReady) {
        console.log('[PAGE INDICATOR] All refs populated! Setting refsReady to true')
        setRefsReady(true)
      }
    }
  })

  // Intersection Observer to track visible pages (only when virtualizing)
  useEffect(() => {
    console.log('[PAGE INDICATOR] Observer useEffect triggered - shouldVirtualize:', shouldVirtualize, 'totalPages:', totalPages, 'refsReady:', refsReady)

    if (!shouldVirtualize) {
      console.log('[PAGE INDICATOR] Skipping observer setup - not virtualizing')
      return // Skip virtualization when showing all pages
    }

    if (totalPages <= 1) {
      console.log('[PAGE INDICATOR] Skipping observer setup - only', totalPages, 'page(s)')
      return // No need for virtualization with single page
    }

    // Wait for refs to be populated
    if (!refsReady) {
      console.log('[PAGE INDICATOR] Skipping observer setup - refs not ready')
      return
    }

    console.log('[PAGE INDICATOR] Setting up IntersectionObserver for', totalPages, 'pages')

    const observer = new IntersectionObserver(
      (entries) => {
        console.log('[PAGE INDICATOR] Observer callback triggered with', entries.length, 'entries')

        // Find the most visible page among all entries
        let mostVisiblePage = 0
        let maxRatio = 0

        entries.forEach((entry) => {
          const pageIndex = Number(entry.target.getAttribute('data-page-index'))
          console.log('[PAGE INDICATOR] Page', pageIndex, '- ratio:', entry.intersectionRatio, 'intersecting:', entry.isIntersecting)

          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            mostVisiblePage = pageIndex
          }
        })

        console.log('[PAGE INDICATOR] Most visible page:', mostVisiblePage, 'with ratio:', maxRatio)

        // Update current page if we found a more visible page
        if (maxRatio > 0) {
          console.log('[PAGE INDICATOR] Setting current page to:', mostVisiblePage)
          setCurrentPage(mostVisiblePage)
        } else {
          console.log('[PAGE INDICATOR] No visible page (maxRatio = 0), keeping current page')
        }

        // Update visible pages set
        setVisiblePages((prev) => {
          const next = new Set(prev)

          entries.forEach((entry) => {
            const pageIndex = Number(entry.target.getAttribute('data-page-index'))

            if (entry.isIntersecting) {
              // Add visible page
              next.add(pageIndex)
              // Preload adjacent pages for smooth scrolling
              if (pageIndex > 0) next.add(pageIndex - 1)
              if (pageIndex < totalPages - 1) next.add(pageIndex + 1)
            }
          })

          return next
        })
      },
      {
        root: null, // Use viewport as root (scrolling happens in parent)
        rootMargin: '50% 0px', // Start loading when page is 50% away from viewport
        threshold: [0, 0.5, 1],
      }
    )

    // Observe all page containers
    pageRefs.current.forEach((ref) => {
      if (ref) {
        observer.observe(ref)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [totalPages, refsReady, shouldVirtualize])

  // Jump to page function for floating indicator
  const jumpToPage = (pageIndex: number) => {
    pageRefs.current[pageIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      data-component="worksheet-preview"
      className={css({
        bg: isDark ? 'gray.700' : 'white',
        rounded: 'lg',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
        position: 'relative',
        minHeight: 'full',
      })}
    >
      {/* Floating page indicator */}
      {totalPages > 1 && (
        <FloatingPageIndicator
          currentPage={currentPage}
          totalPages={totalPages}
          onJumpToPage={jumpToPage}
          isScrolling={isScrolling}
        />
      )}

      {/* Page containers */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '6',
          p: '4',
        })}
      >
        {pages.map((page, index) => (
          <div
            key={index}
            ref={(el) => (pageRefs.current[index] = el)}
            data-page-index={index}
            data-element="page-container"
            className={css({
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            })}
          >
            {visiblePages.has(index) ? (
              <div
                className={css({
                  '& svg': {
                    maxWidth: '100%',
                    height: 'auto',
                    width: 'auto',
                  },
                })}
                dangerouslySetInnerHTML={{ __html: page }}
              />
            ) : (
              <PagePlaceholder pageNumber={index + 1} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewFallback() {
  return (
    <div
      data-component="worksheet-preview-loading"
      className={css({
        bg: 'white',
        rounded: '2xl',
        p: '6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '600px',
      })}
    >
      <p
        className={css({
          fontSize: 'lg',
          color: 'gray.400',
          textAlign: 'center',
        })}
      >
        Generating preview...
      </p>
    </div>
  )
}

function PreviewErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Log full error details to console
  useEffect(() => {
    console.error('[WorksheetPreview] Preview generation failed:', {
      message: error.message,
      stack: error.stack,
      error,
    })
  }, [error])

  return (
    <div
      data-component="worksheet-preview-error"
      className={css({
        bg: isDark ? 'gray.800' : 'white',
        rounded: 'xl',
        p: '6',
        border: '2px solid',
        borderColor: 'red.300',
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        minHeight: '400px',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'flex-start',
          gap: '3',
        })}
      >
        <div
          className={css({
            fontSize: '3xl',
            flexShrink: 0,
          })}
        >
          ⚠️
        </div>
        <div className={css({ flex: 1 })}>
          <h3
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              color: isDark ? 'red.300' : 'red.600',
              mb: '2',
            })}
          >
            Preview Generation Failed
          </h3>
          <p
            className={css({
              fontSize: 'sm',
              color: isDark ? 'gray.300' : 'gray.600',
              mb: '3',
              lineHeight: '1.6',
            })}
          >
            The worksheet preview could not be generated. This usually happens due to invalid
            settings or a temporary server issue. Your settings are still saved.
          </p>

          {/* Actionable suggestions */}
          <div
            className={css({
              bg: isDark ? 'gray.900' : 'gray.50',
              p: '4',
              rounded: 'lg',
              fontSize: 'sm',
              mb: '3',
            })}
          >
            <h4
              className={css({
                fontWeight: 'semibold',
                color: isDark ? 'gray.200' : 'gray.800',
                mb: '2',
              })}
            >
              Try these steps:
            </h4>
            <ul
              className={css({
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
                color: isDark ? 'gray.300' : 'gray.700',
              })}
            >
              <li className={css({ display: 'flex', gap: '2' })}>
                <span>1.</span>
                <span>Click the "Retry Preview" button below to try generating again</span>
              </li>
              <li className={css({ display: 'flex', gap: '2' })}>
                <span>2.</span>
                <span>
                  Try adjusting your worksheet settings (e.g., reduce problems per page or number of
                  pages)
                </span>
              </li>
              <li className={css({ display: 'flex', gap: '2' })}>
                <span>3.</span>
                <span>
                  Check if you have extreme values in difficulty settings that might be causing
                  issues
                </span>
              </li>
              <li className={css({ display: 'flex', gap: '2' })}>
                <span>4.</span>
                <span>
                  If the preview continues to fail, you can still try generating the full worksheet
                  PDF
                </span>
              </li>
            </ul>
          </div>

          {/* Retry button */}
          <button
            onClick={onRetry}
            className={css({
              px: '4',
              py: '2',
              bg: isDark ? 'blue.600' : 'blue.500',
              color: 'white',
              rounded: 'lg',
              fontWeight: 'medium',
              fontSize: 'sm',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                bg: isDark ? 'blue.700' : 'blue.600',
                transform: 'translateY(-1px)',
                boxShadow: 'md',
              },
              _active: {
                transform: 'translateY(0)',
              },
            })}
          >
            🔄 Retry Preview
          </button>
        </div>
      </div>

      {/* Technical details (collapsible) */}
      <details
        className={css({
          bg: isDark ? 'gray.900' : 'gray.50',
          p: '3',
          rounded: 'md',
          fontSize: 'sm',
          borderTop: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <summary
          className={css({
            cursor: 'pointer',
            fontWeight: 'medium',
            color: isDark ? 'gray.400' : 'gray.600',
            _hover: {
              color: isDark ? 'gray.300' : 'gray.900',
            },
          })}
        >
          Technical Details (for debugging)
        </summary>
        <div className={css({ mt: '3' })}>
          <div
            className={css({
              mb: '2',
              fontSize: 'xs',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            Error message:
          </div>
          <pre
            className={css({
              p: '2',
              bg: isDark ? 'gray.950' : 'white',
              rounded: 'sm',
              fontSize: 'xs',
              overflow: 'auto',
              color: isDark ? 'red.300' : 'red.600',
              mb: '3',
              border: '1px solid',
              borderColor: isDark ? 'gray.800' : 'gray.200',
            })}
          >
            {error.message}
          </pre>
          {error.stack && (
            <>
              <div
                className={css({
                  mb: '2',
                  fontSize: 'xs',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                Stack trace (also logged to browser console):
              </div>
              <pre
                className={css({
                  p: '2',
                  bg: isDark ? 'gray.950' : 'white',
                  rounded: 'sm',
                  fontSize: 'xs',
                  overflow: 'auto',
                  maxHeight: '200px',
                  color: isDark ? 'gray.400' : 'gray.600',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.800' : 'gray.200',
                })}
              >
                {error.stack}
              </pre>
            </>
          )}
        </div>
      </details>
    </div>
  )
}

class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[WorksheetPreview] Error caught by boundary:', error, errorInfo)
  }

  handleRetry = () => {
    console.log('[WorksheetPreview] Retry requested - resetting error boundary')
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <PreviewErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }

    return this.props.children
  }
}

export function WorksheetPreview({ formState, initialData, isScrolling }: WorksheetPreviewProps) {
  return (
    <PreviewErrorBoundary>
      <Suspense fallback={<PreviewFallback />}>
        <PreviewContent formState={formState} initialData={initialData} isScrolling={isScrolling} />
      </Suspense>
    </PreviewErrorBoundary>
  )
}
