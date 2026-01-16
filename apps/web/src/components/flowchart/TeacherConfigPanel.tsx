'use client'

import { useState, useCallback } from 'react'
import * as Switch from '@radix-ui/react-switch'
import type { GenerationConstraints } from '@/lib/flowcharts/loader'
import { DEFAULT_CONSTRAINTS } from '@/lib/flowcharts/loader'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface TeacherConfigPanelProps {
  /** Current constraints */
  constraints: GenerationConstraints
  /** Called when constraints change */
  onConstraintsChange: (constraints: GenerationConstraints) => void
  /** Whether the panel is collapsed by default */
  defaultCollapsed?: boolean
}

/**
 * Teacher-facing configuration panel for controlling problem generation constraints.
 * Collapsible panel with settings like "positive answers only".
 */
export function TeacherConfigPanel({
  constraints,
  onConstraintsChange,
  defaultCollapsed = true,
}: TeacherConfigPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  const handleToggle = useCallback(
    (key: keyof GenerationConstraints) => {
      onConstraintsChange({
        ...constraints,
        [key]: !constraints[key],
      })
    },
    [constraints, onConstraintsChange]
  )

  return (
    <div
      data-testid="teacher-config-panel"
      data-collapsed={isCollapsed}
      className={css({
        backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
        borderRadius: 'lg',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
        overflow: 'hidden',
        transition: 'all 0.2s',
      })}
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '2 3',
          fontSize: 'sm',
          fontWeight: 'medium',
          color: { base: 'gray.600', _dark: 'gray.400' },
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          _hover: {
            backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
          },
        })}
      >
        <span className={hstack({ gap: '2', alignItems: 'center' })}>
          <span>⚙️</span>
          <span>Teacher Settings</span>
        </span>
        <span
          className={css({
            transition: 'transform 0.2s',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          })}
        >
          ▼
        </span>
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div
          className={vstack({
            gap: '3',
            padding: '3',
            paddingTop: '0',
            alignItems: 'stretch',
          })}
        >
          {/* Positive Answers Only */}
          <ConfigSwitch
            id="positive-answers"
            label="Positive answers only"
            description="Generated problems will always have non-negative results"
            checked={
              constraints.positiveAnswersOnly ?? DEFAULT_CONSTRAINTS.positiveAnswersOnly ?? true
            }
            onCheckedChange={() => handleToggle('positiveAnswersOnly')}
          />
        </div>
      )}
    </div>
  )
}

interface ConfigSwitchProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function ConfigSwitch({ id, label, description, checked, onCheckedChange }: ConfigSwitchProps) {
  return (
    <div
      className={hstack({
        justifyContent: 'space-between',
        gap: '3',
        padding: '2',
        borderRadius: 'md',
        backgroundColor: { base: 'white', _dark: 'gray.900' },
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
      })}
    >
      <label
        htmlFor={id}
        className={vstack({
          gap: '0.5',
          alignItems: 'flex-start',
          cursor: 'pointer',
        })}
      >
        <span
          className={css({
            fontSize: 'sm',
            fontWeight: 'medium',
            color: { base: 'gray.800', _dark: 'gray.200' },
          })}
        >
          {label}
        </span>
        <span
          className={css({
            fontSize: 'xs',
            color: { base: 'gray.500', _dark: 'gray.500' },
          })}
        >
          {description}
        </span>
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={css({
          width: '42px',
          height: '24px',
          backgroundColor: checked
            ? { base: 'green.500', _dark: 'green.600' }
            : { base: 'gray.300', _dark: 'gray.600' },
          borderRadius: 'full',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          flexShrink: 0,
          _focusVisible: {
            outline: '2px solid',
            outlineColor: { base: 'blue.500', _dark: 'blue.400' },
            outlineOffset: '2px',
          },
        })}
      >
        <Switch.Thumb
          className={css({
            display: 'block',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: 'full',
            boxShadow: 'sm',
            transition: 'transform 0.2s',
            transform: checked ? 'translateX(20px)' : 'translateX(2px)',
          })}
        />
      </Switch.Root>
    </div>
  )
}
