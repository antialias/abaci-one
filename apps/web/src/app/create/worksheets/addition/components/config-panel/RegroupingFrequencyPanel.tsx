'use client'

import * as Slider from '@radix-ui/react-slider'
import { css } from '../../../../../../../styled-system/css'
import { stack } from '../../../../../../../styled-system/patterns'
import { useWorksheetConfig } from '../WorksheetConfigContext'
import { useTheme } from '@/contexts/ThemeContext'

export function RegroupingFrequencyPanel() {
  const { formState, onChange } = useWorksheetConfig()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <div
      data-section="regrouping"
      className={css({
        bg: isDark ? 'gray.800' : 'gray.50',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
        rounded: 'xl',
        p: '3',
      })}
    >
      <div className={stack({ gap: '2.5' })}>
        <div
          className={css({
            fontSize: 'xs',
            fontWeight: 'semibold',
            color: isDark ? 'gray.400' : 'gray.500',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
          })}
        >
          Regrouping Frequency
        </div>

        {/* Current values display */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'xs',
            color: isDark ? 'gray.400' : 'gray.600',
          })}
        >
          <div>
            Both:{' '}
            <span
              className={css({
                color: 'brand.600',
                fontWeight: 'semibold',
              })}
            >
              {Math.round((formState.pAllStart || 0) * 100)}%
            </span>
          </div>
          <div>
            Any:{' '}
            <span
              className={css({
                color: 'brand.600',
                fontWeight: 'semibold',
              })}
            >
              {Math.round((formState.pAnyStart || 0.25) * 100)}%
            </span>
          </div>
        </div>

        {/* Double-thumbed range slider */}
        <Slider.Root
          className={css({
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
            touchAction: 'none',
            width: 'full',
            height: '6',
          })}
          value={[(formState.pAllStart || 0) * 100, (formState.pAnyStart || 0.25) * 100]}
          onValueChange={(values) => {
            onChange({
              pAllStart: values[0] / 100,
              pAnyStart: values[1] / 100,
            })
          }}
          min={0}
          max={100}
          step={5}
          minStepsBetweenThumbs={0}
        >
          <Slider.Track
            className={css({
              position: 'relative',
              flexGrow: 1,
              bg: isDark ? 'gray.600' : 'gray.200',
              rounded: 'full',
              height: '1.5',
            })}
          >
            <Slider.Range
              className={css({
                position: 'absolute',
                bg: 'brand.500',
                rounded: 'full',
                height: 'full',
              })}
            />
          </Slider.Track>
          <Slider.Thumb
            className={css({
              display: 'block',
              width: '3.5',
              height: '3.5',
              bg: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              rounded: 'full',
              border: '2px solid',
              borderColor: 'brand.500',
              cursor: 'pointer',
              _hover: { transform: 'scale(1.1)' },
              _focus: {
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
              },
            })}
          />
          <Slider.Thumb
            className={css({
              display: 'block',
              width: '3.5',
              height: '3.5',
              bg: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              rounded: 'full',
              border: '2px solid',
              borderColor: 'brand.600',
              cursor: 'pointer',
              _hover: { transform: 'scale(1.1)' },
              _focus: {
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
              },
            })}
          />
        </Slider.Root>

        <div
          className={css({
            fontSize: '2xs',
            color: isDark ? 'gray.400' : 'gray.500',
            lineHeight: '1.3',
          })}
        >
          Regrouping difficulty at worksheet start (Both = all columns regroup, Any = at least one
          column regroups)
        </div>
      </div>
    </div>
  )
}
