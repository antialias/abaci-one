'use client'

import { useMemo } from 'react'
import { CATEGORY_PRIORITY } from '@/constants/skillCategories'
import type { SlotResult } from '@/db/schema/session-plans'
import { getCategoryDisplayName, getSkillDisplayName } from '@/utils/skillDisplay'
import { css } from '../../../styled-system/css'

interface SkillBreakdown {
  skillId: string
  correct: number
  total: number
}

interface SkillCategoryGroup {
  categoryId: string
  categoryName: string
  skills: SkillBreakdown[]
  /** Aggregate stats for the category */
  correct: number
  total: number
}

export interface SkillsPanelProps {
  results: SlotResult[]
  isDark: boolean
}

/**
 * SkillsPanel - Shows skills breakdown by category with human-readable names
 *
 * Features:
 * - Categories sorted by pedagogical order (CATEGORY_PRIORITY)
 * - Collapsible categories using <details>
 * - Progress bars with neutral blue color
 * - Human-readable skill names from SKILL_CATEGORIES
 */
export function SkillsPanel({ results, isDark }: SkillsPanelProps) {
  const skillCategories = useMemo(() => calculateSkillBreakdownByCategory(results), [results])

  if (skillCategories.length === 0) {
    return null
  }

  return (
    <div
      data-component="skills-panel"
      data-section="skill-breakdown"
      className={css({
        padding: '1rem',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '12px',
        boxShadow: 'sm',
      })}
    >
      <h3
        className={css({
          fontSize: '1rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.300' : 'gray.700',
          marginBottom: '1rem',
        })}
      >
        Skills Practiced
      </h3>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        })}
      >
        {skillCategories.map((category) => (
          <details
            key={category.categoryId}
            data-element="skill-category"
            className={css({
              '& > summary': {
                listStyle: 'none',
                cursor: 'pointer',
                '&::-webkit-details-marker': { display: 'none' },
              },
            })}
          >
            {/* Category header with aggregate stats (clickable summary) */}
            <summary
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                paddingBottom: '0.375rem',
                borderBottom: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
                _hover: {
                  backgroundColor: isDark ? 'gray.750' : 'gray.50',
                },
              })}
            >
              <div
                className={css({
                  flex: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.200' : 'gray.800',
                })}
              >
                {category.categoryName}
              </div>
              <div
                className={css({
                  width: '80px',
                  height: '6px',
                  backgroundColor: isDark ? 'gray.700' : 'gray.200',
                  borderRadius: '3px',
                  overflow: 'hidden',
                })}
              >
                <div
                  className={css({
                    height: '100%',
                    // Neutral blue color - not implying skill-level judgment
                    backgroundColor: isDark ? 'blue.400' : 'blue.500',
                    borderRadius: '3px',
                  })}
                  style={{
                    width: `${category.total > 0 ? (category.correct / category.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div
                className={css({
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: isDark ? 'blue.400' : 'blue.600',
                  minWidth: '36px',
                  textAlign: 'right',
                })}
              >
                {category.correct}/{category.total}
              </div>
            </summary>

            {/* Individual skills within category (expanded content) */}
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
                paddingLeft: '0.75rem',
                paddingTop: '0.5rem',
              })}
            >
              {category.skills.map((skill) => (
                <div
                  key={skill.skillId}
                  data-element="skill-row"
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  })}
                >
                  <div
                    className={css({
                      flex: 1,
                      fontSize: '0.8125rem',
                      color: isDark ? 'gray.400' : 'gray.600',
                    })}
                  >
                    {getSkillDisplayName(skill.skillId)}
                  </div>
                  <div
                    className={css({
                      width: '60px',
                      height: '4px',
                      backgroundColor: isDark ? 'gray.700' : 'gray.200',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    })}
                  >
                    <div
                      className={css({
                        height: '100%',
                        // Neutral blue color - not implying skill-level judgment
                        backgroundColor: isDark ? 'blue.400' : 'blue.500',
                        borderRadius: '2px',
                      })}
                      style={{
                        width: `${skill.total > 0 ? (skill.correct / skill.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div
                    className={css({
                      fontSize: '0.6875rem',
                      color: isDark ? 'blue.400' : 'blue.600',
                      minWidth: '28px',
                      textAlign: 'right',
                    })}
                  >
                    {skill.correct}/{skill.total}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

/**
 * Calculate skill breakdown grouped by category
 */
function calculateSkillBreakdownByCategory(results: SlotResult[]): SkillCategoryGroup[] {
  // First, collect all skills with their stats
  const skillMap = new Map<string, { correct: number; total: number }>()

  for (const result of results) {
    for (const skillId of result.skillsExercised) {
      const current = skillMap.get(skillId) || { correct: 0, total: 0 }
      current.total++
      if (result.isCorrect) current.correct++
      skillMap.set(skillId, current)
    }
  }

  // Group skills by category
  const categoryMap = new Map<
    string,
    { skills: SkillBreakdown[]; correct: number; total: number }
  >()

  for (const [skillId, stats] of skillMap.entries()) {
    const categoryId = skillId.split('.')[0] || 'other'
    const current = categoryMap.get(categoryId) || {
      skills: [],
      correct: 0,
      total: 0,
    }

    current.skills.push({
      skillId,
      ...stats,
    })
    current.correct += stats.correct
    current.total += stats.total

    categoryMap.set(categoryId, current)
  }

  // Sort categories by pedagogical order, then build result
  const result: SkillCategoryGroup[] = []

  for (const categoryId of CATEGORY_PRIORITY) {
    const categoryData = categoryMap.get(categoryId)
    if (categoryData && categoryData.skills.length > 0) {
      // Sort skills within category by total count (most practiced first)
      categoryData.skills.sort((a, b) => b.total - a.total)

      result.push({
        categoryId,
        categoryName: getCategoryDisplayName(categoryId),
        skills: categoryData.skills,
        correct: categoryData.correct,
        total: categoryData.total,
      })
    }
  }

  // Add any categories not in the predefined order (shouldn't happen, but just in case)
  for (const [categoryId, categoryData] of categoryMap.entries()) {
    if (!CATEGORY_PRIORITY.includes(categoryId as (typeof CATEGORY_PRIORITY)[number])) {
      categoryData.skills.sort((a, b) => b.total - a.total)

      result.push({
        categoryId,
        categoryName: getCategoryDisplayName(categoryId),
        skills: categoryData.skills,
        correct: categoryData.correct,
        total: categoryData.total,
      })
    }
  }

  return result
}

export default SkillsPanel
