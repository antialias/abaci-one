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

interface PageRange {
  startPage?: number
  endPage?: number
  cursor?: number
  limit?: number
}

interface PreviewResponse {
  pages: string[]
  totalPages: number
  startPage: number
  endPage: number
  nextCursor: number | null
}

async function fetchWorksheetPreview(
  formState: WorksheetFormState,
  range?: PageRange
): Promise<PreviewResponse> {
  // Set current date for preview
  const configWithDate = {
    ...formState,
    date: getDefaultDate(),
  }

  // Use absolute URL for SSR compatibility
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

  // Build query string for pagination
  const params = new URLSearchParams()
  if (range?.cursor !== undefined) {
    params.set('cursor', String(range.cursor))
    if (range.limit !== undefined) {
      params.set('limit', String(range.limit))
    }
  } else if (range?.startPage !== undefined || range?.endPage !== undefined) {
    if (range.startPage !== undefined) {
      params.set('startPage', String(range.startPage))
    }
    if (range.endPage !== undefined) {
      params.set('endPage', String(range.endPage))
    }
  }

  const queryString = params.toString()
  const url = `${baseUrl}/api/create/worksheets/preview${queryString ? `?${queryString}` : ''}`

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
  return data
}

function PreviewContent({ formState, initialData, isScrolling = false }: WorksheetPreviewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  // Common query key for all page-related queries
  const baseQueryKey = [
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
    formState.seed, // Include seed to bust cache when problem set regenerates
  ] as const

  // Fetch initial batch to get total page count and first few pages
  const INITIAL_PAGES = 3
  const { data: initialResponse } = useSuspenseQuery({
    queryKey: [...baseQueryKey, 'initial'],
    queryFn: () =>
      fetchWorksheetPreview(formState, {
        startPage: 0,
        endPage: INITIAL_PAGES - 1,
      }),
  })

  const totalPages = initialResponse.totalPages
  const [loadedPages, setLoadedPages] = useState<Map<number, string>>(() => {
    // Initialize with initial pages or initialData
    const map = new Map<number, string>()
    if (initialData) {
      initialData.forEach((page, index) => map.set(index, page))
    } else {
      initialResponse.pages.forEach((page, index) => {
        map.set(initialResponse.startPage + index, page)
      })
    }
    return map
  })

  // Virtualization decision based on page count, not config source
  // Always virtualize multi-page worksheets for performance
  const shouldVirtualize = totalPages > 1

  // Track which pages are visible in viewport
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set([0]))

  // Track which pages are currently being fetched
  const [fetchingPages, setFetchingPages] = useState<Set<number>>(new Set())

  const [currentPage, setCurrentPage] = useState(0)

  // Track when refs are fully populated
  const [refsReady, setRefsReady] = useState(false)

  // Reset state when form config changes
  useEffect(() => {
    setCurrentPage(0)
    setVisiblePages(new Set([0]))
    setFetchingPages(new Set())
    pageRefs.current = []
    setRefsReady(false)

    // Reset loaded pages with new initial response
    const map = new Map<number, string>()
    if (initialData) {
      initialData.forEach((page, index) => map.set(index, page))
    } else {
      initialResponse.pages.forEach((page, index) => {
        map.set(initialResponse.startPage + index, page)
      })
    }
    setLoadedPages(map)
  }, [initialResponse, initialData])

  // Fetch pages as they become visible
  useEffect(() => {
    if (!shouldVirtualize) return

    // Find pages that are visible but not loaded and not being fetched
    const pagesToFetch = Array.from(visiblePages).filter(
      (pageIndex) => !loadedPages.has(pageIndex) && !fetchingPages.has(pageIndex)
    )

    if (pagesToFetch.length === 0) return

    // Group consecutive pages into ranges for batch fetching
    const ranges: { start: number; end: number }[] = []
    let currentRange: { start: number; end: number } | null = null

    pagesToFetch
      .sort((a, b) => a - b)
      .forEach((pageIndex) => {
        if (currentRange === null) {
          currentRange = { start: pageIndex, end: pageIndex }
        } else if (pageIndex === currentRange.end + 1) {
          currentRange.end = pageIndex
        } else {
          ranges.push(currentRange)
          currentRange = { start: pageIndex, end: pageIndex }
        }
      })
    if (currentRange !== null) {
      ranges.push(currentRange)
    }

    // Fetch each range
    ranges.forEach(({ start, end }) => {
      // Mark pages as being fetched
      setFetchingPages((prev) => {
        const next = new Set(prev)
        for (let i = start; i <= end; i++) {
          next.add(i)
        }
        return next
      })

      // Fetch the range
      fetchWorksheetPreview(formState, { startPage: start, endPage: end })
        .then((response) => {
          // Add fetched pages to loaded pages
          setLoadedPages((prev) => {
            const next = new Map(prev)
            response.pages.forEach((page, index) => {
              next.set(response.startPage + index, page)
            })
            return next
          })

          // Remove from fetching set
          setFetchingPages((prev) => {
            const next = new Set(prev)
            for (let i = response.startPage; i <= response.endPage; i++) {
              next.delete(i)
            }
            return next
          })
        })
        .catch((error) => {
          console.error('Failed to fetch pages ' + start + '-' + end + ':', error)

          // Remove from fetching set on error
          setFetchingPages((prev) => {
            const next = new Set(prev)
            for (let i = start; i <= end; i++) {
              next.delete(i)
            }
            return next
          })
        })
    })
  }, [visiblePages, loadedPages, fetchingPages, shouldVirtualize, formState])

  // Check if all refs are populated after each render
  useEffect(() => {
    if (totalPages > 1 && pageRefs.current.length === totalPages) {
      const allPopulated = pageRefs.current.every((ref) => ref !== null)
      if (allPopulated && !refsReady) {
        setRefsReady(true)
      }
    }
  })

  // Intersection Observer to track current page (works with or without virtualization)
  useEffect(() => {
    if (totalPages <= 1) {
      return // No need for page tracking with single page
    }

    // Wait for refs to be populated
    if (!refsReady) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible page among all entries
        let mostVisiblePage = 0
        let maxRatio = 0

        entries.forEach((entry) => {
          const pageIndex = Number(entry.target.getAttribute('data-page-index'))

          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            mostVisiblePage = pageIndex
          }
        })

        // Update current page with hysteresis to prevent flickering
        // Only update if:
        // 1. New page has > 0 visibility
        // 2. New page is different from current
        // 3. New page is significantly more visible (>0.6 ratio) OR current page has very low visibility (<0.3)
        if (maxRatio > 0) {
          setCurrentPage((prev) => {
            const isDifferentPage = mostVisiblePage !== prev
            const isSignificantlyVisible = maxRatio > 0.6
            const currentPageLowVisibility = maxRatio > 0.3 // If maxRatio is high, current page must be less visible

            if (isDifferentPage && (isSignificantlyVisible || !currentPageLowVisibility)) {
              return mostVisiblePage
            }

            return prev
          })
        }

        // Update visible pages set (only when virtualizing)
        if (shouldVirtualize) {
          setVisiblePages((prev) => {
            const next = new Set<number>()

            // Only keep pages that are currently intersecting
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

            // Keep any pages from prev that weren't in entries (not observed in this callback)
            prev.forEach((pageIndex) => {
              const wasObserved = entries.some(
                (entry) => Number(entry.target.getAttribute('data-page-index')) === pageIndex
              )
              if (!wasObserved) {
                next.add(pageIndex)
              }
            })

            return next
          })
        }
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
        {Array.from({ length: totalPages }, (_, index) => {
          const isLoaded = loadedPages.has(index)
          const isFetching = fetchingPages.has(index)
          const isVisible = visiblePages.has(index)
          const page = loadedPages.get(index)

          return (
            <div
              key={index}
              ref={(el) => {
                pageRefs.current[index] = el
              }}
              data-page-index={index}
              data-element="page-container"
              data-page-loaded={isLoaded ? 'true' : 'false'}
              data-page-fetching={isFetching ? 'true' : 'false'}
              className={css({
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
              })}
            >
              {isLoaded && page ? (
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
                <PagePlaceholder
                  pageNumber={index + 1}
                  orientation={formState.orientation}
                  rows={Math.ceil((formState.problemsPerPage ?? 20) / (formState.cols ?? 5))}
                  cols={formState.cols}
                  loading={isFetching}
                />
              )}
            </div>
          )
        })}
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
