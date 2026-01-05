'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import type { DisplayRules } from '../displayRules'
import { defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { RuleThermometer } from './config-panel/RuleThermometer'
import { DisplayOptionsPreview } from './DisplayOptionsPreview'

export interface DisplayControlsPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

export function DisplayControlsPanel({
  formState,
  onChange,
  isDark = false,
}: DisplayControlsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Get current displayRules or use defaults
  const displayRules: DisplayRules = formState.displayRules ?? defaultAdditionConfig.displayRules

  // Helper to update a single display rule
  const updateRule = (key: keyof DisplayRules, value: DisplayRules[keyof DisplayRules]) => {
    onChange({
      displayRules: {
        ...displayRules,
        [key]: value,
      },
    })
  }

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <div data-section="display-controls" className={stack({ gap: '3' })}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              cursor: 'pointer',
              bg: 'transparent',
              border: 'none',
              _hover: {
                '& > div:first-child': {
                  color: isDark ? 'gray.300' : 'gray.600',
                },
              },
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              })}
            >
              <div
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.400' : 'gray.500',
                  textTransform: 'uppercase',
                  letterSpacing: 'wider',
                  transition: 'color 0.2s',
                })}
              >
                Pedagogical Scaffolding
              </div>
              <div
                className={css({
                  fontSize: '2xs',
                  color: isDark ? 'gray.500' : 'gray.400',
                  fontStyle: 'italic',
                })}
              >
                (Advanced)
              </div>
            </div>
            <div
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.500' : 'gray.400',
                transition: 'transform 0.2s',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              })}
            >
              ▼
            </div>
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div className={stack({ gap: '3' })}>
            <div
              className={css({
                display: 'flex',
                gap: '1.5',
                justifyContent: 'flex-end',
              })}
            >
              <button
                onClick={() =>
                  onChange({
                    displayRules: {
                      ...displayRules,
                      carryBoxes: 'always',
                      answerBoxes: 'always',
                      placeValueColors: 'always',
                      tenFrames: 'always',
                      borrowNotation: 'always',
                      borrowingHints: 'always',
                    },
                  })
                }
                className={css({
                  px: '2',
                  py: '0.5',
                  fontSize: '2xs',
                  color: isDark ? 'brand.300' : 'brand.600',
                  border: '1px solid',
                  borderColor: isDark ? 'brand.500' : 'brand.300',
                  bg: isDark ? 'gray.700' : 'white',
                  rounded: 'md',
                  cursor: 'pointer',
                  _hover: { bg: isDark ? 'gray.600' : 'brand.50' },
                })}
              >
                All Always
              </button>
              <button
                onClick={() =>
                  onChange({
                    displayRules: {
                      ...displayRules,
                      carryBoxes: 'never',
                      answerBoxes: 'never',
                      placeValueColors: 'never',
                      tenFrames: 'never',
                      borrowNotation: 'never',
                      borrowingHints: 'never',
                    },
                  })
                }
                className={css({
                  px: '2',
                  py: '0.5',
                  fontSize: '2xs',
                  color: isDark ? 'gray.300' : 'gray.600',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.500' : 'gray.300',
                  bg: isDark ? 'gray.700' : 'white',
                  rounded: 'md',
                  cursor: 'pointer',
                  _hover: { bg: isDark ? 'gray.600' : 'gray.50' },
                })}
              >
                Minimal
              </button>
            </div>

            {/* Pedagogical scaffolding thermometers */}
            <div className={stack({ gap: '3' })}>
              <RuleThermometer
                label="Answer Boxes"
                description="Guide students to write organized, aligned answers"
                value={displayRules.answerBoxes}
                onChange={(value) => updateRule('answerBoxes', value)}
                isDark={isDark}
              />

              <RuleThermometer
                label="Place Value Colors"
                description="Reinforce place value understanding visually"
                value={displayRules.placeValueColors}
                onChange={(value) => updateRule('placeValueColors', value)}
                isDark={isDark}
              />

              <RuleThermometer
                label={
                  formState.operator === 'subtraction'
                    ? 'Borrow Boxes'
                    : formState.operator === 'mixed'
                      ? 'Carry/Borrow Boxes'
                      : 'Carry Boxes'
                }
                description={
                  formState.operator === 'subtraction'
                    ? 'Help students track borrowing during subtraction'
                    : formState.operator === 'mixed'
                      ? 'Help students track regrouping (carrying in addition, borrowing in subtraction)'
                      : 'Help students track regrouping during addition'
                }
                value={displayRules.carryBoxes}
                onChange={(value) => updateRule('carryBoxes', value)}
                isDark={isDark}
              />

              {(formState.operator === 'subtraction' || formState.operator === 'mixed') && (
                <RuleThermometer
                  label="Borrowed 10s Box"
                  description="Box for adding 10 to borrowing digit"
                  value={displayRules.borrowNotation}
                  onChange={(value) => updateRule('borrowNotation', value)}
                  isDark={isDark}
                />
              )}

              {(formState.operator === 'subtraction' || formState.operator === 'mixed') && (
                <RuleThermometer
                  label="Borrowing Hints"
                  description="Show arrows and calculations guiding the borrowing process"
                  value={displayRules.borrowingHints}
                  onChange={(value) => updateRule('borrowingHints', value)}
                  isDark={isDark}
                />
              )}

              <RuleThermometer
                label="Ten-Frames"
                description="Visualize regrouping with concrete counting tools"
                value={displayRules.tenFrames}
                onChange={(value) => updateRule('tenFrames', value)}
                isDark={isDark}
              />
            </div>

            {/* Live Preview - Collapsible */}
            <Collapsible.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
              <Collapsible.Trigger asChild>
                <button
                  type="button"
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    cursor: 'pointer',
                    bg: 'transparent',
                    border: 'none',
                    mt: '2',
                    _hover: {
                      '& > div:first-child': {
                        color: isDark ? 'gray.300' : 'gray.600',
                      },
                    },
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'semibold',
                        color: isDark ? 'gray.400' : 'gray.500',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                        transition: 'color 0.2s',
                      })}
                    >
                      Live Preview
                    </div>
                    <div
                      className={css({
                        fontSize: '2xs',
                        color: isDark ? 'gray.500' : 'gray.400',
                        fontStyle: 'italic',
                      })}
                    >
                      (Optional)
                    </div>
                  </div>
                  <div
                    className={css({
                      fontSize: 'sm',
                      color: isDark ? 'gray.500' : 'gray.400',
                      transition: 'transform 0.2s',
                      transform: isPreviewOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    })}
                  >
                    ▼
                  </div>
                </button>
              </Collapsible.Trigger>

              <Collapsible.Content>
                <div className={css({ mt: '2' })}>
                  <DisplayOptionsPreview formState={formState} />
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  )
}
