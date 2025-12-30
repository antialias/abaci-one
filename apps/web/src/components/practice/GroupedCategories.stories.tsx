import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { type CompactItem, useMeasuredCompactLayout } from '../../hooks/useMeasuredCompactLayout'
import { css } from '../../../styled-system/css'
import { StudentSelector, type StudentWithProgress } from './StudentSelector'

// Mock router for Next.js navigation
const mockRouter = {
  push: (url: string) => console.log('Router push:', url),
  refresh: () => console.log('Router refresh'),
}

// Create a fresh query client for stories
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
}

/**
 * Demonstrates the measurement-based grouped category layout for the practice page.
 *
 * The layout uses actual measured widths to determine which items can fit together
 * on the same row, rather than a simple count-based heuristic.
 *
 * Key behaviors:
 * - **Measurement-based**: Items are rendered hidden, measured, then grouped based on actual fit
 * - **Responsive**: Adapts to container width changes via ResizeObserver
 * - **No flash**: useLayoutEffect ensures measurement happens before paint
 */
const meta: Meta = {
  title: 'Practice/GroupedCategories',
  parameters: {
    layout: 'padded',
    nextjs: {
      appDirectory: true,
      navigation: {
        push: mockRouter.push,
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={createQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

// Sample student data
const createStudent = (
  id: string,
  name: string,
  emoji: string,
  color: string,
  level?: number
): StudentWithProgress => ({
  id,
  name,
  emoji,
  color,
  currentLevel: level,
  masteryPercent: level ? level * 25 : undefined,
  createdAt: new Date(),
})

// Students with varying name lengths to show measurement differences
const students = {
  sonia: createStudent('1', 'Sonia', '🦋', '#FFE4E1', 3),
  marcus: createStudent('2', 'Marcus', '🦖', '#E0FFE0', 2),
  luna: createStudent('3', 'Luna', '🌙', '#E0E0FF', 1),
  alex: createStudent('4', 'Alex', '🚀', '#FFF0E0', 2),
  maya: createStudent('5', 'Maya', '🌸', '#FFE0F0', 3),
  kai: createStudent('6', 'Kai', '🐻', '#E0F0FF', 1),
  // Long names to demonstrate width-based wrapping
  alexanderTheGreat: createStudent('7', 'Alexander the Great', '👑', '#FFD700', 3),
  christopherColumbus: createStudent('8', 'Christopher Columbus', '🧭', '#87CEEB', 2),
  elizabethBennet: createStudent('9', 'Elizabeth Bennet', '📚', '#DDA0DD', 1),
}

interface CategoryData {
  category: string
  categoryName: string
  students: StudentWithProgress[]
  attentionCount?: number
}

interface BucketData {
  bucket: string
  bucketName: string
  categories: CategoryData[]
}

// =============================================================================
// MeasuredGroupedStudentsDemo - Uses the actual measurement hook
// =============================================================================

interface MeasuredGroupedStudentsDemoProps {
  buckets: BucketData[]
  needsAttentionStudents?: StudentWithProgress[]
  isDark?: boolean
  containerWidth?: number | string // Allow controlling container width for demos
}

/**
 * Demo component that uses the actual useMeasuredCompactLayout hook
 * to demonstrate measurement-based row grouping.
 */
function MeasuredGroupedStudentsDemo({
  buckets,
  needsAttentionStudents = [],
  isDark = false,
  containerWidth = '100%',
}: MeasuredGroupedStudentsDemoProps) {
  // Helper to check if a category is compact
  const isCategoryCompact = (cat: CategoryData) =>
    cat.students.length === 1 && (cat.attentionCount ?? 0) === 0

  // Helper to check if a bucket is compact
  const isBucketCompact = (bucket: BucketData) =>
    bucket.categories.every((cat) => isCategoryCompact(cat))

  // Section type for attention and buckets
  type Section =
    | { type: 'attention'; students: StudentWithProgress[] }
    | { type: 'bucket'; bucket: BucketData }

  // Helper to check if a section is compact
  const isSectionCompact = (section: Section) => {
    if (section.type === 'attention') {
      return section.students.length === 1
    }
    return isBucketCompact(section.bucket)
  }

  // Build list of all sections
  const allSections: Section[] = useMemo(() => {
    const sections: Section[] = []
    if (needsAttentionStudents.length > 0) {
      sections.push({ type: 'attention', students: needsAttentionStudents })
    }
    for (const bucket of buckets) {
      sections.push({ type: 'bucket', bucket })
    }
    return sections
  }, [needsAttentionStudents, buckets])

  // Chunk sections into "compact runs" and "full sections"
  type Chunk = { type: 'compact-run'; sections: Section[] } | { type: 'full'; section: Section }

  const chunks: Chunk[] = useMemo(() => {
    const result: Chunk[] = []
    let compactRun: Section[] = []

    for (const section of allSections) {
      if (isSectionCompact(section)) {
        compactRun.push(section)
      } else {
        if (compactRun.length > 0) {
          result.push({ type: 'compact-run', sections: compactRun })
          compactRun = []
        }
        result.push({ type: 'full', section })
      }
    }
    if (compactRun.length > 0) {
      result.push({ type: 'compact-run', sections: compactRun })
    }
    return result
  }, [allSections]) // eslint-disable-line react-hooks/exhaustive-deps

  // Render compact category item
  const renderCompactCategoryItem = useCallback(
    (bucket: BucketData, cat: CategoryData, itemKey: string) => {
      return (
        <div
          key={itemKey}
          data-bucket={bucket.bucket}
          data-category={cat.category ?? 'new'}
          data-compact="true"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          })}
        >
          <span
            data-element="compact-label"
            className={css({
              fontSize: '0.6875rem',
              fontWeight: 'medium',
              color: isDark ? 'gray.500' : 'gray.400',
              paddingLeft: '4px',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            })}
          >
            <span
              className={css({
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: isDark ? 'gray.600' : 'gray.350',
              })}
            >
              {bucket.bucketName}
            </span>
            <span className={css({ color: isDark ? 'gray.600' : 'gray.300' })}>·</span>
            <span>{cat.categoryName}</span>
          </span>
          <StudentSelector
            students={cat.students}
            onSelectStudent={() => {}}
            onToggleSelection={() => {}}
            title=""
            hideAddButton
            compact
          />
        </div>
      )
    },
    [isDark]
  )

  // Render compact attention item
  const renderCompactAttentionItem = useCallback(
    (student: StudentWithProgress, itemKey: string) => {
      return (
        <div
          key={itemKey}
          data-bucket="attention"
          data-compact="true"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          })}
        >
          <span
            data-element="compact-label"
            className={css({
              fontSize: '0.6875rem',
              fontWeight: 'medium',
              color: isDark ? 'orange.400' : 'orange.500',
              paddingLeft: '4px',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            })}
          >
            <span>⚠️</span>
            <span className={css({ textTransform: 'uppercase', letterSpacing: '0.03em' })}>
              Needs Attention
            </span>
          </span>
          <StudentSelector
            students={[student]}
            onSelectStudent={() => {}}
            onToggleSelection={() => {}}
            title=""
            hideAddButton
            compact
          />
        </div>
      )
    },
    [isDark]
  )

  // Build compact items for measurement
  const compactItems: CompactItem[] = useMemo(() => {
    const items: CompactItem[] = []
    for (const chunk of chunks) {
      if (chunk.type === 'compact-run') {
        for (const section of chunk.sections) {
          if (section.type === 'attention') {
            const itemKey = 'attention'
            items.push({
              id: itemKey,
              element: renderCompactAttentionItem(section.students[0], itemKey),
            })
          } else {
            for (const cat of section.bucket.categories) {
              const itemKey = `${section.bucket.bucket}-${cat.category ?? 'null'}`
              items.push({
                id: itemKey,
                element: renderCompactCategoryItem(section.bucket, cat, itemKey),
              })
            }
          }
        }
      }
    }
    return items
  }, [chunks, renderCompactAttentionItem, renderCompactCategoryItem])

  // Use measurement hook
  const { containerRef, itemRefs, rows, isReady } = useMeasuredCompactLayout(compactItems, 12)

  // Create map from item ID to row index
  const itemRowMap = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((row, rowIdx) => {
      for (const item of row) {
        map.set(item.id, rowIdx)
      }
    })
    return map
  }, [rows])

  // Render full section
  const renderFullSection = useCallback(
    (section: Section, key: string) => {
      if (section.type === 'attention') {
        return (
          <div key={key} data-bucket="attention" data-component="needs-attention-bucket">
            <h2
              data-element="bucket-header"
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'semibold',
                color: isDark ? 'orange.400' : 'orange.600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                borderBottom: '2px solid',
                borderColor: isDark ? 'orange.700' : 'orange.300',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              })}
            >
              <span>⚠️</span>
              <span>Needs Attention</span>
              <span
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'orange.700' : 'orange.500',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                })}
              >
                {section.students.length}
              </span>
            </h2>
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}>
              <StudentSelector
                students={section.students}
                onSelectStudent={() => {}}
                onToggleSelection={() => {}}
                title=""
                hideAddButton
                compact
              />
            </div>
          </div>
        )
      }

      const bucket = section.bucket
      return (
        <div key={key} data-bucket={bucket.bucket}>
          <h2
            data-element="bucket-header"
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'semibold',
              color: isDark ? 'gray.400' : 'gray.500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              borderBottom: '2px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
            })}
          >
            {bucket.bucketName}
          </h2>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
            {bucket.categories.map((category) => (
              <div key={category.category ?? 'null'} data-category={category.category ?? 'new'}>
                <h3
                  data-element="category-header"
                  className={css({
                    fontSize: '0.8125rem',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.500' : 'gray.400',
                    marginBottom: '8px',
                    paddingLeft: '4px',
                  })}
                >
                  {category.categoryName}
                </h3>
                <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}>
                  <StudentSelector
                    students={category.students}
                    onSelectStudent={() => {}}
                    onToggleSelection={() => {}}
                    title=""
                    hideAddButton
                    compact
                  />
                  {(category.attentionCount ?? 0) > 0 && (
                    <div
                      data-element="attention-placeholder"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '2px dashed',
                        borderColor: isDark ? 'orange.700' : 'orange.300',
                        color: isDark ? 'orange.400' : 'orange.600',
                        fontSize: '0.8125rem',
                        minHeight: '60px',
                      })}
                    >
                      +{category.attentionCount} in Needs Attention
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    [isDark]
  )

  return (
    <div
      className={css({
        backgroundColor: isDark ? 'gray.900' : 'gray.50',
        padding: '1.5rem',
        borderRadius: '12px',
      })}
      style={{ width: containerWidth }}
    >
      {/* Debug info */}
      <div
        className={css({
          marginBottom: '16px',
          padding: '8px 12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.100',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: isDark ? 'gray.400' : 'gray.600',
        })}
      >
        <strong>Measurement Debug:</strong> {compactItems.length} compact items → {rows.length} rows
        {rows.map((row, i) => (
          <span key={i} className={css({ marginLeft: '8px' })}>
            [Row {i + 1}: {row.length} items]
          </span>
        ))}
      </div>

      <div
        ref={containerRef}
        data-component="grouped-students"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          position: 'relative',
        })}
      >
        {/* Hidden measurement container */}
        <div
          data-element="measurement-container"
          style={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            flexWrap: 'nowrap',
          }}
        >
          {compactItems.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
              style={{ flexShrink: 0 }}
            >
              {item.element}
            </div>
          ))}
        </div>

        {/* Visible layout */}
        {isReady &&
          chunks.map((chunk, chunkIdx) => {
            if (chunk.type === 'full') {
              return renderFullSection(
                chunk.section,
                chunk.section.type === 'attention' ? 'attention' : chunk.section.bucket.bucket
              )
            }

            // Get all item IDs for this compact run
            const runItemIds: string[] = []
            for (const section of chunk.sections) {
              if (section.type === 'attention') {
                runItemIds.push('attention')
              } else {
                for (const cat of section.bucket.categories) {
                  runItemIds.push(`${section.bucket.bucket}-${cat.category ?? 'null'}`)
                }
              }
            }

            // Group items by measured row
            const rowGroups = new Map<number, CompactItem[]>()
            for (const id of runItemIds) {
              const rowIdx = itemRowMap.get(id) ?? 0
              const item = compactItems.find((i) => i.id === id)
              if (item) {
                if (!rowGroups.has(rowIdx)) {
                  rowGroups.set(rowIdx, [])
                }
                rowGroups.get(rowIdx)!.push(item)
              }
            }

            return Array.from(rowGroups.entries())
              .sort(([a], [b]) => a - b)
              .map(([rowIdx, items]) => (
                <div
                  key={`compact-run-${chunkIdx}-row-${rowIdx}`}
                  data-element="compact-sections-row"
                  className={css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'flex-start',
                  })}
                >
                  {items.map((item) => (
                    <Fragment key={item.id}>{item.element}</Fragment>
                  ))}
                </div>
              ))
          })}
      </div>
    </div>
  )
}

// =============================================================================
// Interactive Width Demo
// =============================================================================

function InteractiveWidthDemo() {
  const [width, setWidth] = useState(800)

  return (
    <div>
      <div
        className={css({
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        })}
      >
        <label className={css({ fontSize: '0.875rem', color: 'gray.600' })}>
          Container Width: {width}px
        </label>
        <input
          type="range"
          min={300}
          max={1200}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className={css({ width: '200px' })}
        />
      </div>
      <MeasuredGroupedStudentsDemo
        containerWidth={width}
        buckets={[
          {
            bucket: 'older',
            bucketName: 'Older',
            categories: [
              {
                category: 'five-comp-sub',
                categoryName: 'Five Comp (Sub)',
                students: [students.sonia],
              },
              {
                category: 'five-comp-add',
                categoryName: 'Five Comp (Add)',
                students: [students.marcus],
              },
              {
                category: 'ten-comp-sub',
                categoryName: 'Ten Comp (Sub)',
                students: [students.luna],
              },
              {
                category: 'ten-comp-add',
                categoryName: 'Ten Comp (Add)',
                students: [students.alex],
              },
              { category: 'basic-add', categoryName: 'Basic Addition', students: [students.maya] },
              {
                category: 'basic-sub',
                categoryName: 'Basic Subtraction',
                students: [students.kai],
              },
            ],
          },
        ]}
      />
    </div>
  )
}

// =============================================================================
// STORIES
// =============================================================================

/**
 * Interactive demo - drag the slider to see how items reflow based on container width
 */
export const InteractiveResize: Story = {
  render: () => <InteractiveWidthDemo />,
}

/**
 * Wide container (800px) - all 6 compact items may fit on fewer rows
 */
export const WideContainer: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={800}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-sub',
              categoryName: 'Five Comp (Sub)',
              students: [students.sonia],
            },
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.marcus],
            },
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.luna] },
            { category: 'ten-comp-add', categoryName: 'Ten Comp (Add)', students: [students.alex] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Narrow container (400px) - items wrap to more rows
 */
export const NarrowContainer: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={400}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-sub',
              categoryName: 'Five Comp (Sub)',
              students: [students.sonia],
            },
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.marcus],
            },
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.luna] },
            { category: 'ten-comp-add', categoryName: 'Ten Comp (Add)', students: [students.alex] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Very narrow container (300px) - each item on its own row
 */
export const VeryNarrowContainer: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={300}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-sub',
              categoryName: 'Five Comp (Sub)',
              students: [students.sonia],
            },
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.marcus],
            },
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.luna] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Long student names cause items to be wider, affecting row grouping
 */
export const LongStudentNames: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={700}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-sub',
              categoryName: 'Five Comp (Sub)',
              students: [students.alexanderTheGreat],
            },
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.christopherColumbus],
            },
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Comp (Sub)',
              students: [students.elizabethBennet],
            },
            {
              category: 'ten-comp-add',
              categoryName: 'Ten Comp (Add)',
              students: [students.sonia],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Mix of long and short names
 */
export const MixedNameLengths: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={600}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            { category: 'cat-1', categoryName: 'Category A', students: [students.kai] },
            {
              category: 'cat-2',
              categoryName: 'Category B',
              students: [students.alexanderTheGreat],
            },
            { category: 'cat-3', categoryName: 'Category C', students: [students.luna] },
            {
              category: 'cat-4',
              categoryName: 'Category D',
              students: [students.christopherColumbus],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Multiple students in a category - renders as full section, not compact
 */
export const MultiStudentCategory: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={800}
      buckets={[
        {
          bucket: 'today',
          bucketName: 'Today',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.sonia, students.marcus, students.luna],
            },
          ],
        },
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.alex] },
            { category: 'ten-comp-add', categoryName: 'Ten Comp (Add)', students: [students.maya] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Mix of compact and full sections - full sections break the flow
 */
export const MixedCompactAndFull: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={700}
      buckets={[
        {
          bucket: 'today',
          bucketName: 'Today',
          categories: [
            { category: 'cat-1', categoryName: 'Single A', students: [students.sonia] },
            { category: 'cat-2', categoryName: 'Single B', students: [students.marcus] },
          ],
        },
        {
          bucket: 'thisWeek',
          bucketName: 'This Week',
          categories: [
            {
              category: 'cat-3',
              categoryName: 'Multi Students',
              students: [students.luna, students.alex, students.maya],
            },
          ],
        },
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [{ category: 'cat-4', categoryName: 'Single C', students: [students.kai] }],
        },
      ]}
    />
  ),
}

/**
 * Needs Attention section (single student) - compact, flows with other compact items
 */
export const NeedsAttentionSingleCompact: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={700}
      needsAttentionStudents={[students.sonia]}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.marcus],
            },
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.luna] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Needs Attention section (multiple students) - full section with header
 */
export const NeedsAttentionMultipleFull: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={700}
      needsAttentionStudents={[students.sonia, students.marcus, students.luna]}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.alex],
            },
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.maya] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Category with attention placeholder - not compact due to placeholder
 */
export const CategoryWithAttentionPlaceholder: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={700}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            { category: 'cat-1', categoryName: 'Compact', students: [students.sonia] },
            {
              category: 'cat-2',
              categoryName: 'Has Placeholder',
              students: [students.marcus],
              attentionCount: 3,
            },
            { category: 'cat-3', categoryName: 'Compact', students: [students.luna] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Multiple buckets with various configurations
 */
export const MultipleBucketsComplex: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={800}
      needsAttentionStudents={[students.kai]}
      buckets={[
        {
          bucket: 'today',
          bucketName: 'Today',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.sonia, students.marcus],
            },
          ],
        },
        {
          bucket: 'thisWeek',
          bucketName: 'This Week',
          categories: [
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.luna] },
            { category: 'ten-comp-add', categoryName: 'Ten Comp (Add)', students: [students.alex] },
          ],
        },
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            { category: 'basic-add', categoryName: 'Basic Addition', students: [students.maya] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Dark mode
 */
export const DarkMode: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      isDark
      containerWidth={700}
      needsAttentionStudents={[students.sonia]}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.marcus],
            },
            { category: 'ten-comp-sub', categoryName: 'Ten Comp (Sub)', students: [students.luna] },
            { category: 'ten-comp-add', categoryName: 'Ten Comp (Add)', students: [students.alex] },
          ],
        },
      ]}
    />
  ),
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

/**
 * All categories are single-student - all flow together as compact
 */
export const AllCompact: Story = {
  render: () => (
    <MeasuredGroupedStudentsDemo
      containerWidth={900}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'cat-1',
              categoryName: 'Five Complements (Subtraction)',
              students: [students.sonia],
            },
            {
              category: 'cat-2',
              categoryName: 'Five Complements (Addition)',
              students: [students.marcus],
            },
            {
              category: 'cat-3',
              categoryName: 'Ten Complements (Subtraction)',
              students: [students.luna],
            },
            {
              category: 'cat-4',
              categoryName: 'Ten Complements (Addition)',
              students: [students.alex],
            },
            { category: 'cat-5', categoryName: 'Basic Addition', students: [students.maya] },
            { category: 'cat-6', categoryName: 'Basic Subtraction', students: [students.kai] },
          ],
        },
      ]}
    />
  ),
}

/**
 * Edge case: empty buckets
 */
export const EmptyState: Story = {
  render: () => <MeasuredGroupedStudentsDemo containerWidth={700} buckets={[]} />,
}
