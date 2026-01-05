import * as Slider from '@radix-ui/react-slider'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'

export interface DigitRangeSectionProps {
  digitRange: { min: number; max: number } | undefined
  onChange: (digitRange: { min: number; max: number }) => void
}

export function DigitRangeSection({ digitRange, onChange }: DigitRangeSectionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const min = digitRange?.min ?? 2
  const max = digitRange?.max ?? 2

  return (
    <div
      data-section="digit-range"
      className={css({
        bg: isDark ? 'gray.700' : 'gray.50',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
        rounded: 'lg',
        p: '3',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: '2',
        })}
      >
        <label
          className={css({
            fontSize: 'xs',
            fontWeight: 'semibold',
            color: isDark ? 'gray.300' : 'gray.700',
          })}
        >
          Digits per Number
        </label>
        <span
          className={css({
            fontSize: 'xs',
            fontWeight: 'bold',
            color: 'brand.600',
          })}
        >
          {min === max ? `${min}` : `${min}-${max}`}
        </span>
      </div>

      {/* Compact slider with inline labels */}
      <div className={css({ position: 'relative' })}>
        <Slider.Root
          className={css({
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
            touchAction: 'none',
            width: 'full',
            height: '5',
          })}
          value={[min, max]}
          onValueChange={(values) => {
            onChange({
              min: values[0],
              max: values[1],
            })
          }}
          min={1}
          max={5}
          step={1}
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              rounded: 'full',
              border: '2px solid',
              borderColor: 'brand.500',
              cursor: 'grab',
              _hover: { transform: 'scale(1.1)' },
              _focus: {
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
              },
              _active: { cursor: 'grabbing' },
            })}
          />
          <Slider.Thumb
            className={css({
              display: 'block',
              width: '3.5',
              height: '3.5',
              bg: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              rounded: 'full',
              border: '2px solid',
              borderColor: 'brand.600',
              cursor: 'grab',
              _hover: { transform: 'scale(1.1)' },
              _focus: {
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
              },
              _active: { cursor: 'grabbing' },
            })}
          />
        </Slider.Root>

        {/* Tick marks below slider */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            mt: '1',
            px: '0.5',
          })}
        >
          {[1, 2, 3, 4, 5].map((digit) => (
            <span
              key={`tick-${digit}`}
              className={css({
                fontSize: '2xs',
                fontWeight: 'medium',
                color: isDark ? 'gray.500' : 'gray.400',
              })}
            >
              {digit}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
