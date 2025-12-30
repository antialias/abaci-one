import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
 * Demonstrates the grouped category layout for the practice page.
 *
 * The practice page organizes students by:
 * - **Buckets** (recency): "Today", "This Week", "Older", "New"
 * - **Categories** (skills): "Five Complements (Addition)", "Ten Complements (Subtraction)", etc.
 *
 * Categories are displayed differently based on their content:
 * - **Compact**: Categories with 1 student (and no attention placeholder) flow together on the same row
 * - **Full**: Categories with 2+ students or attention placeholders get full-width sticky headers
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

const students = {
  sonia: createStudent('1', 'Sonia', '🦋', '#FFE4E1', 3),
  marcus: createStudent('2', 'Marcus', '🦖', '#E0FFE0', 2),
  luna: createStudent('3', 'Luna', '🌙', '#E0E0FF', 1),
  alex: createStudent('4', 'Alex', '🚀', '#FFF0E0', 2),
  maya: createStudent('5', 'Maya', '🌸', '#FFE0F0', 3),
  kai: createStudent('6', 'Kai', '🐻', '#E0F0FF', 1),
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

// Component that replicates the exact structure from PracticeClient.tsx
function GroupedStudentsDemo({
  buckets,
  needsAttentionStudents = [],
  isDark = false,
}: {
  buckets: BucketData[]
  needsAttentionStudents?: StudentWithProgress[]
  isDark?: boolean
}) {
  // Build unified sections list (attention first, then buckets)
  type Section =
    | { type: 'attention'; students: StudentWithProgress[] }
    | { type: 'bucket'; bucket: BucketData }

  const allSections: Section[] = []
  if (needsAttentionStudents.length > 0) {
    allSections.push({ type: 'attention', students: needsAttentionStudents })
  }
  for (const bucket of buckets) {
    allSections.push({ type: 'bucket', bucket })
  }

  // Helper to check if a category is compact
  const isCategoryCompact = (cat: CategoryData) =>
    cat.students.length === 1 && (cat.attentionCount ?? 0) === 0

  // Helper to check if a bucket is compact
  const isBucketCompact = (bucket: BucketData) =>
    bucket.categories.every((cat) => isCategoryCompact(cat))

  // Helper to check if a section is compact
  const isSectionCompact = (section: Section) => {
    if (section.type === 'attention') {
      return section.students.length === 1
    }
    return isBucketCompact(section.bucket)
  }

  // Group consecutive compact sections
  type RenderItem =
    | { type: 'compact-sections'; sections: Section[] }
    | { type: 'full-section'; section: Section }

  const renderItems: RenderItem[] = []
  let compactBuffer: Section[] = []

  for (const section of allSections) {
    if (isSectionCompact(section)) {
      compactBuffer.push(section)
    } else {
      if (compactBuffer.length > 0) {
        renderItems.push({ type: 'compact-sections', sections: compactBuffer })
        compactBuffer = []
      }
      renderItems.push({ type: 'full-section', section })
    }
  }
  if (compactBuffer.length > 0) {
    renderItems.push({ type: 'compact-sections', sections: compactBuffer })
  }
  // Helper to render a compact section (single attention or compact bucket)
  const renderCompactSection = (section: Section, idx: number) => {
    if (section.type === 'attention') {
      // Single attention student - compact with label
      const student = section.students[0]
      return (
        <div
          key={`attention-compact-${idx}`}
          data-section="needs-attention"
          data-compact="true"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          })}
        >
          <span
            data-element="compact-label"
            className={css({
              fontSize: '0.6875rem',
              fontWeight: 'medium',
              color: isDark ? 'orange.400' : 'orange.500',
              paddingLeft: '4px',
            })}
          >
            <span className={css({ textTransform: 'uppercase' })}>Needs Attention</span>
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
    }

    // Compact bucket - all categories are single-student
    const bucket = section.bucket
    return bucket.categories.map((cat, catIdx) => (
      <div
        key={`${bucket.bucket}-${cat.category}-${catIdx}`}
        data-bucket={bucket.bucket}
        data-category={cat.category}
        data-compact="true"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        })}
      >
        <span
          data-element="compact-label"
          className={css({
            fontSize: '0.6875rem',
            fontWeight: 'medium',
            color: isDark ? 'gray.500' : 'gray.400',
            paddingLeft: '4px',
          })}
        >
          <span className={css({ textTransform: 'uppercase' })}>{bucket.bucketName}</span>
          <span className={css({ margin: '0 4px' })}>·</span>
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
    ))
  }

  // Helper to render a full section (multiple attention or non-compact bucket)
  const renderFullSection = (section: Section) => {
    if (section.type === 'attention') {
      // Full Needs Attention section
      return (
        <div key="needs-attention-full" data-section="needs-attention">
          <h2
            data-element="attention-header"
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
              borderColor: isDark ? 'orange.700' : 'orange.200',
            })}
          >
            ⚠️ Needs Attention
          </h2>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            })}
          >
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

    // Full bucket with categories
    const bucket = section.bucket
    return (
      <div key={bucket.bucket} data-bucket={bucket.bucket}>
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

        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          })}
        >
          {(() => {
            // Group consecutive compact categories within the bucket
            type CatRenderItem =
              | { type: 'compact-row'; categories: CategoryData[] }
              | { type: 'full'; category: CategoryData }

            const items: CatRenderItem[] = []
            let compactBuffer: CategoryData[] = []

            for (const cat of bucket.categories) {
              if (isCategoryCompact(cat)) {
                compactBuffer.push(cat)
              } else {
                if (compactBuffer.length > 0) {
                  items.push({ type: 'compact-row', categories: compactBuffer })
                  compactBuffer = []
                }
                items.push({ type: 'full', category: cat })
              }
            }
            if (compactBuffer.length > 0) {
              items.push({ type: 'compact-row', categories: compactBuffer })
            }

            return items.map((item, idx) => {
              if (item.type === 'compact-row') {
                return (
                  <div
                    key={`compact-${idx}`}
                    data-element="compact-category-row"
                    className={css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-start',
                    })}
                  >
                    {item.categories.map((cat) => (
                      <div
                        key={cat.category}
                        data-category={cat.category}
                        data-compact="true"
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        })}
                      >
                        <span
                          data-element="compact-category-label"
                          className={css({
                            fontSize: '0.75rem',
                            fontWeight: 'medium',
                            color: isDark ? 'gray.500' : 'gray.400',
                            paddingLeft: '4px',
                          })}
                        >
                          {cat.categoryName}
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
                    ))}
                  </div>
                )
              }

              const category = item.category
              return (
                <div key={category.category} data-category={category.category}>
                  <h3
                    data-element="category-header"
                    className={css({
                      fontSize: '0.8125rem',
                      fontWeight: 'medium',
                      color: isDark ? 'gray.500' : 'gray.400',
                      marginBottom: '8px',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                      paddingLeft: '4px',
                    })}
                  >
                    {category.categoryName}
                  </h3>
                  <div
                    className={css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignItems: 'stretch',
                    })}
                  >
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
                          textAlign: 'center',
                          minHeight: '120px',
                          minWidth: '150px',
                        })}
                      >
                        +{category.attentionCount} in Needs Attention
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>
    )
  }

  return (
    <div
      className={css({
        backgroundColor: isDark ? 'gray.900' : 'gray.50',
        padding: '1.5rem',
        borderRadius: '12px',
        minWidth: '800px',
      })}
    >
      <div
        data-component="grouped-students"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        })}
      >
        {renderItems.map((item, idx) => {
          if (item.type === 'compact-sections') {
            // Render compact sections flowing together
            return (
              <div
                key={`compact-sections-${idx}`}
                data-element="compact-sections-row"
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'flex-start',
                })}
              >
                {item.sections.map((section, sIdx) => renderCompactSection(section, sIdx))}
              </div>
            )
          }
          return renderFullSection(item.section)
        })}
      </div>
    </div>
  )
}

/**
 * All single-student categories flow together on the same row
 */
export const AllCompact: Story = {
  render: () => (
    <GroupedStudentsDemo
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-sub',
              categoryName: 'Five Complements (Subtraction)',
              students: [students.sonia],
            },
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.marcus],
            },
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Subtraction)',
              students: [students.luna],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * All categories have multiple students - each gets its own full-width header
 */
export const AllFull: Story = {
  render: () => (
    <GroupedStudentsDemo
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-sub',
              categoryName: 'Five Complements (Subtraction)',
              students: [students.sonia, students.marcus],
            },
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.luna, students.alex, students.maya],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Mix of compact and full categories - compact ones flow together,
 * full categories break the flow with their own header
 */
export const Mixed: Story = {
  render: () => (
    <GroupedStudentsDemo
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            // Compact - flows with next compact
            {
              category: 'five-comp-sub',
              categoryName: 'Five Complements (Subtraction)',
              students: [students.sonia],
            },
            // Full - breaks flow, gets own header
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.marcus, students.luna],
            },
            // These two compact categories flow together
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Subtraction)',
              students: [students.alex],
            },
            {
              category: 'ten-comp-add',
              categoryName: 'Ten Complements (Addition)',
              students: [students.maya],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Single student with attention placeholder - renders as full category
 * because attention placeholder needs space
 */
export const SingleWithAttention: Story = {
  render: () => (
    <GroupedStudentsDemo
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            // Compact
            {
              category: 'five-comp-sub',
              categoryName: 'Five Complements (Subtraction)',
              students: [students.sonia],
            },
            // Full (has attention placeholder even though only 1 student)
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.marcus],
              attentionCount: 3,
            },
            // Compact
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Subtraction)',
              students: [students.luna],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Multiple buckets showing the full hierarchy
 */
export const MultipleBuckets: Story = {
  render: () => (
    <GroupedStudentsDemo
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
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Subtraction)',
              students: [students.luna],
            },
            {
              category: 'ten-comp-add',
              categoryName: 'Ten Complements (Addition)',
              students: [students.alex],
            },
          ],
        },
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            { category: 'basic-add', categoryName: 'Basic Addition', students: [students.maya] },
            {
              category: 'basic-sub',
              categoryName: 'Basic Subtraction',
              students: [students.kai],
              attentionCount: 2,
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Many compact categories that wrap to multiple rows
 */
export const ManyCompactWrapping: Story = {
  render: () => (
    <GroupedStudentsDemo
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
            { category: 'basic-add', categoryName: 'Basic Addition', students: [students.maya] },
            { category: 'basic-sub', categoryName: 'Basic Subtraction', students: [students.kai] },
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
    <GroupedStudentsDemo
      isDark
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-sub',
              categoryName: 'Five Complements (Subtraction)',
              students: [students.sonia],
            },
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.marcus, students.luna],
            },
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Subtraction)',
              students: [students.alex],
            },
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
 * Realistic scenario with various category sizes across buckets
 */
export const RealisticScenario: Story = {
  render: () => (
    <GroupedStudentsDemo
      buckets={[
        {
          bucket: 'today',
          bucketName: 'Today',
          categories: [
            // Single compact
            {
              category: 'five-comp-sub',
              categoryName: 'Five Complements (Subtraction)',
              students: [students.sonia],
            },
          ],
        },
        {
          bucket: 'thisWeek',
          bucketName: 'This Week',
          categories: [
            // Full with multiple students
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.marcus, students.luna, students.alex],
            },
          ],
        },
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            // Two compact flow together
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Sub)',
              students: [students.maya],
            },
            {
              category: 'ten-comp-add',
              categoryName: 'Ten Complements (Add)',
              students: [students.kai],
            },
            // Full with attention
            {
              category: 'basic-math',
              categoryName: 'Basic Math',
              students: [students.sonia],
              attentionCount: 5,
            },
          ],
        },
      ]}
    />
  ),
}

// =============================================================================
// NEEDS ATTENTION STORIES
// =============================================================================

/**
 * Single student needing attention - renders compact, flows with other compact sections
 */
export const NeedsAttentionSingle: Story = {
  render: () => (
    <GroupedStudentsDemo
      needsAttentionStudents={[students.sonia]}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Add)',
              students: [students.marcus],
            },
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Sub)',
              students: [students.luna],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Multiple students needing attention - renders full section with sticky header
 */
export const NeedsAttentionMultiple: Story = {
  render: () => (
    <GroupedStudentsDemo
      needsAttentionStudents={[students.sonia, students.marcus, students.luna]}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Add)',
              students: [students.alex],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Single attention student flows together with single-student compact buckets
 */
export const NeedsAttentionWithCompactBuckets: Story = {
  render: () => (
    <GroupedStudentsDemo
      needsAttentionStudents={[students.sonia]}
      buckets={[
        {
          bucket: 'today',
          bucketName: 'Today',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.marcus],
            },
          ],
        },
        {
          bucket: 'thisWeek',
          bucketName: 'This Week',
          categories: [
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Comp (Sub)',
              students: [students.luna],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Multiple attention students (full section) followed by compact buckets
 */
export const NeedsAttentionFullThenCompact: Story = {
  render: () => (
    <GroupedStudentsDemo
      needsAttentionStudents={[students.sonia, students.marcus]}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Comp (Add)',
              students: [students.luna],
            },
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Comp (Sub)',
              students: [students.alex],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Complete realistic scenario with attention section
 */
export const NeedsAttentionRealistic: Story = {
  render: () => (
    <GroupedStudentsDemo
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
          ],
        },
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'basic-add',
              categoryName: 'Basic Addition',
              students: [students.maya],
            },
          ],
        },
      ]}
    />
  ),
}

/**
 * Dark mode with needs attention section
 */
export const NeedsAttentionDarkMode: Story = {
  render: () => (
    <GroupedStudentsDemo
      isDark
      needsAttentionStudents={[students.sonia, students.marcus]}
      buckets={[
        {
          bucket: 'older',
          bucketName: 'Older',
          categories: [
            {
              category: 'five-comp-add',
              categoryName: 'Five Complements (Addition)',
              students: [students.luna],
            },
            {
              category: 'ten-comp-sub',
              categoryName: 'Ten Complements (Subtraction)',
              students: [students.alex],
            },
          ],
        },
      ]}
    />
  ),
  parameters: {
    backgrounds: { default: 'dark' },
  },
}
