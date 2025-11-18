'use client'

import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import { useWorksheetConfig } from '../WorksheetConfigContext'
import { useTheme } from '@/contexts/ThemeContext'
import { RuleThermometer } from '../config-panel/RuleThermometer'
import type { DisplayRules } from '../../displayRules'
import { defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'

export function ScaffoldingTab() {
  const { formState, onChange } = useWorksheetConfig()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const displayRules: DisplayRules = formState.displayRules ?? defaultAdditionConfig.displayRules

  // Check if we're in mastery+mixed mode (needs operator-specific rules)
  const isMasteryMixed = formState.mode === 'mastery' && formState.operator === 'mixed'

  const updateRule = (key: keyof DisplayRules, value: DisplayRules[keyof DisplayRules]) => {
    const newDisplayRules = {
      ...displayRules,
      [key]: value,
    }

    // In mastery+mixed mode, update both general AND operator-specific display rules
    if (isMasteryMixed) {
      onChange({
        displayRules: newDisplayRules,
        additionDisplayRules: newDisplayRules,
        subtractionDisplayRules: newDisplayRules,
      })
    } else {
      onChange({
        displayRules: newDisplayRules,
      })
    }
  }

  return (
    <div data-component="scaffolding-tab" className={stack({ gap: '3' })}>
      {/* Quick presets */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        })}
      >
        <div
          className={css({
            fontSize: 'xs',
            fontWeight: 'semibold',
            color: isDark ? 'gray.400' : 'gray.500',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
          })}
        >
          Quick Presets
        </div>
        <div className={css({ display: 'flex', gap: '1.5' })}>
          <button
            onClick={() => {
              const newDisplayRules = {
                ...displayRules,
                carryBoxes: 'always' as const,
                answerBoxes: 'always' as const,
                placeValueColors: 'always' as const,
                tenFrames: 'always' as const,
                borrowNotation: 'always' as const,
                borrowingHints: 'always' as const,
              }
              // In mastery+mixed mode, update operator-specific rules too
              if (isMasteryMixed) {
                onChange({
                  displayRules: newDisplayRules,
                  additionDisplayRules: newDisplayRules,
                  subtractionDisplayRules: newDisplayRules,
                })
              } else {
                onChange({
                  displayRules: newDisplayRules,
                })
              }
            }}
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
            onClick={() => {
              const newDisplayRules = {
                ...displayRules,
                carryBoxes: 'never' as const,
                answerBoxes: 'never' as const,
                placeValueColors: 'never' as const,
                tenFrames: 'never' as const,
                borrowNotation: 'never' as const,
                borrowingHints: 'never' as const,
              }
              // In mastery+mixed mode, update operator-specific rules too
              if (isMasteryMixed) {
                onChange({
                  displayRules: newDisplayRules,
                  additionDisplayRules: newDisplayRules,
                  subtractionDisplayRules: newDisplayRules,
                })
              } else {
                onChange({
                  displayRules: newDisplayRules,
                })
              }
            }}
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
      </div>

      {/* Pedagogical scaffolding thermometers */}
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
  )
}
