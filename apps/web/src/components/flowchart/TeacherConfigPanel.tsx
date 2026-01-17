'use client'

import { useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
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
  /** Number of examples to generate */
  exampleCount: number
  /** Called when example count changes */
  onExampleCountChange: (count: number) => void
  /** Called when regenerate is requested */
  onRegenerate: () => void
  /** Whether to show debug controls (example count slider) */
  showDebugControls?: boolean
}

/**
 * Teacher-facing configuration modal for controlling problem generation constraints.
 * Triggered by a gear icon button, opens in a Radix modal.
 */
export function TeacherConfigPanel({
  constraints,
  onConstraintsChange,
  exampleCount,
  onExampleCountChange,
  onRegenerate,
  showDebugControls = false,
}: TeacherConfigPanelProps) {
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
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-testid="teacher-config-trigger"
          title="Teacher Settings"
          className={css({
            padding: '1',
            borderRadius: 'md',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'lg',
            transition: 'all 0.2s',
            _hover: {
              backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
              transform: 'scale(1.1)',
            },
          })}
        >
          ⚙️
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            animation: 'fadeIn 0.15s ease-out',
          })}
        />
        <Dialog.Content
          data-testid="teacher-config-panel"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: { base: 'white', _dark: 'gray.800' },
            borderRadius: 'xl',
            boxShadow: 'xl',
            padding: '5',
            width: '90vw',
            maxWidth: '400px',
            maxHeight: '85vh',
            overflowY: 'auto',
            zIndex: 101,
            animation: 'scaleIn 0.15s ease-out',
            _focus: {
              outline: 'none',
            },
          })}
        >
          <Dialog.Title
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              color: { base: 'gray.800', _dark: 'gray.100' },
              marginBottom: '4',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            })}
          >
            <span>⚙️</span>
            <span>Teacher Settings</span>
          </Dialog.Title>

          <Dialog.Description
            className={css({
              fontSize: 'sm',
              color: { base: 'gray.500', _dark: 'gray.400' },
              marginBottom: '4',
            })}
          >
            Configure how problems are generated for this flowchart.
          </Dialog.Description>

          <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
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

            {/* Example Count Slider - debug only */}
            {showDebugControls && (
              <div
                className={css({
                  padding: '3',
                  borderRadius: 'md',
                  backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
                  border: '1px solid',
                  borderColor: { base: 'gray.200', _dark: 'gray.700' },
                })}
              >
                <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
                  <div
                    className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}
                  >
                    <label
                      htmlFor="example-count"
                      className={css({
                        fontSize: 'sm',
                        fontWeight: 'medium',
                        color: { base: 'gray.800', _dark: 'gray.200' },
                      })}
                    >
                      Examples to generate
                    </label>
                    <span
                      className={css({
                        fontSize: 'sm',
                        fontWeight: 'bold',
                        color: { base: 'gray.600', _dark: 'gray.400' },
                      })}
                    >
                      {exampleCount}
                    </span>
                  </div>
                  <input
                    id="example-count"
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={exampleCount}
                    onChange={(e) => onExampleCountChange(Number(e.target.value))}
                    className={css({ width: '100%', cursor: 'pointer' })}
                  />
                  <div
                    className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}
                  >
                    <span className={css({ fontSize: 'xs', color: 'gray.500' })}>
                      Higher = more reliable grid coverage
                    </span>
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className={css({
                        paddingX: '3',
                        paddingY: '1',
                        fontSize: 'xs',
                        fontWeight: 'medium',
                        backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
                        color: 'white',
                        borderRadius: 'md',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: {
                          backgroundColor: { base: 'blue.600', _dark: 'blue.700' },
                        },
                      })}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className={css({
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '28px',
                height: '28px',
                borderRadius: 'full',
                backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: { base: 'gray.500', _dark: 'gray.400' },
                transition: 'all 0.15s',
                _hover: {
                  backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                },
              })}
            >
              ✕
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
        padding: '3',
        borderRadius: 'md',
        backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
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
