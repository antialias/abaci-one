'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import { useTheme } from '@/contexts/ThemeContext'
import { DifficultyPlot2D, type PlotPoint } from './DifficultyPlot2D'
import { DigitRangeSection } from './DigitRangeSection'
import type { DisplayRules } from '../../displayRules'

export interface SkillConfig {
  digitRange: { min: number; max: number }
  regroupingConfig: { pAnyStart: number; pAllStart: number }
  displayRules: DisplayRules
}

export interface SkillConfigurationModalProps {
  /** Whether modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Modal mode: 'create' for new skill, 'edit' for existing skill */
  mode: 'create' | 'edit'
  /** Operator for the skill */
  operator: 'addition' | 'subtraction'
  /** Existing skill configuration (for edit mode) */
  existingConfig?: SkillConfig & { name: string; description?: string }
  /** Callback when save is clicked */
  onSave: (config: {
    name: string
    description?: string
    digitRange: { min: number; max: number }
    regroupingConfig: { pAnyStart: number; pAllStart: number }
    displayRules: DisplayRules
  }) => void
  /** Other skills in mastery progression to plot (for edit mode) */
  masteryProgressionSkills?: PlotPoint[]
}

/**
 * Modal for configuring custom skills or editing existing skills
 * Uses the 2D difficulty plot and digit range slider
 */
export function SkillConfigurationModal({
  open,
  onClose,
  mode,
  operator,
  existingConfig,
  onSave,
  masteryProgressionSkills,
}: SkillConfigurationModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Form state
  const [name, setName] = useState(existingConfig?.name ?? '')
  const [description, setDescription] = useState(existingConfig?.description ?? '')
  const [digitRange, setDigitRange] = useState(existingConfig?.digitRange ?? { min: 2, max: 2 })
  const [regroupingConfig, setRegroupingConfig] = useState(
    existingConfig?.regroupingConfig ?? { pAnyStart: 0.25, pAllStart: 0 }
  )
  const [displayRules, setDisplayRules] = useState<DisplayRules>(
    existingConfig?.displayRules ?? {
      carryBoxes: 'never',
      answerBoxes: 'always',
      placeValueColors: 'never',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    }
  )

  const handleDifficultyChange = (config: {
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
  }) => {
    setRegroupingConfig({
      pAnyStart: config.pAnyStart,
      pAllStart: config.pAllStart,
    })
    setDisplayRules(config.displayRules)
  }

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a skill name')
      return
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      digitRange,
      regroupingConfig,
      displayRules,
    })
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'rgba(0, 0, 0, 0.5)',
            zIndex: 50,
          })}
        />
        <Dialog.Content
          data-component="skill-configuration-modal"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bg: isDark ? 'gray.800' : 'white',
            borderRadius: 'xl',
            boxShadow: 'xl',
            p: '6',
            maxWidth: '650px',
            width: '90vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 51,
          })}
        >
          {/* Header */}
          <div className={stack({ gap: '2', mb: '5' })}>
            <Dialog.Title
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
              })}
            >
              {mode === 'create' ? 'Create Custom Skill' : 'Configure Skill'}
            </Dialog.Title>
            <Dialog.Description
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {mode === 'create'
                ? 'Create a new skill with custom difficulty settings'
                : 'Modify the difficulty settings for this skill'}
            </Dialog.Description>
          </div>

          {/* Form */}
          <div className={stack({ gap: '5' })}>
            {/* Name Field */}
            <div className={stack({ gap: '2' })}>
              <label
                htmlFor="skill-name"
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                })}
              >
                Skill Name *
              </label>
              <input
                id="skill-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Advanced Two-Digit Addition"
                className={css({
                  px: '3',
                  py: '2',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  borderRadius: 'md',
                  bg: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'gray.100' : 'gray.900',
                  fontSize: 'sm',
                  _focus: {
                    outline: 'none',
                    borderColor: isDark ? 'blue.500' : 'blue.600',
                    ring: '2px',
                    ringColor: isDark ? 'blue.500/20' : 'blue.600/20',
                  },
                })}
              />
            </div>

            {/* Description Field */}
            <div className={stack({ gap: '2' })}>
              <label
                htmlFor="skill-description"
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                })}
              >
                Description (optional)
              </label>
              <textarea
                id="skill-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what students will practice in this skill..."
                rows={3}
                className={css({
                  px: '3',
                  py: '2',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  borderRadius: 'md',
                  bg: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'gray.100' : 'gray.900',
                  fontSize: 'sm',
                  resize: 'vertical',
                  _focus: {
                    outline: 'none',
                    borderColor: isDark ? 'blue.500' : 'blue.600',
                    ring: '2px',
                    ringColor: isDark ? 'blue.500/20' : 'blue.600/20',
                  },
                })}
              />
            </div>

            {/* Digit Range */}
            <div>
              <div
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '3',
                })}
              >
                Number of Digits
              </div>
              <DigitRangeSection
                digitRange={digitRange}
                onChange={(newDigitRange) => setDigitRange(newDigitRange)}
              />
            </div>

            {/* 2D Difficulty Plot */}
            <div>
              <div
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '3',
                })}
              >
                Difficulty Configuration
              </div>
              <DifficultyPlot2D
                pAnyStart={regroupingConfig.pAnyStart}
                pAllStart={regroupingConfig.pAllStart}
                displayRules={displayRules}
                onChange={handleDifficultyChange}
                isDark={isDark}
                customPoints={masteryProgressionSkills}
              />
              <div
                className={css({
                  mt: '2',
                  fontSize: 'xs',
                  color: isDark ? 'gray.400' : 'gray.500',
                  textAlign: 'center',
                })}
              >
                Click on the plot to select a difficulty configuration
              </div>
            </div>

            {/* Current Configuration Summary */}
            <div
              className={css({
                p: '3',
                bg: isDark ? 'gray.700' : 'gray.50',
                borderRadius: 'md',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.200',
              })}
            >
              <div
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.400' : 'gray.500',
                  textTransform: 'uppercase',
                  letterSpacing: 'wider',
                  mb: '2',
                })}
              >
                Current Configuration
              </div>
              <div
                className={css({
                  fontSize: 'sm',
                  color: isDark ? 'gray.300' : 'gray.700',
                })}
              >
                <div>
                  <strong>Digits:</strong>{' '}
                  {digitRange.min === digitRange.max
                    ? digitRange.min
                    : `${digitRange.min}-${digitRange.max}`}
                </div>
                <div>
                  <strong>Regrouping:</strong> {Math.round(regroupingConfig.pAnyStart * 100)}%
                </div>
                <div>
                  <strong>Operator:</strong> {operator}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className={css({
              display: 'flex',
              gap: '3',
              justifyContent: 'flex-end',
              mt: '6',
            })}
          >
            <button
              type="button"
              onClick={onClose}
              data-action="cancel"
              className={css({
                px: '4',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: isDark ? 'gray.300' : 'gray.700',
                bg: 'transparent',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: {
                  bg: isDark ? 'gray.700' : 'gray.50',
                },
              })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              data-action="save-skill"
              className={css({
                px: '4',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'white',
                bg: isDark ? 'blue.600' : 'blue.700',
                border: 'none',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: {
                  bg: isDark ? 'blue.700' : 'blue.800',
                },
              })}
            >
              {mode === 'create' ? 'Create Skill' : 'Save Changes'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
