import { css } from '../../../../../../../styled-system/css'

export interface StudentNameInputProps {
  value: string | undefined
  onChange: (value: string) => void
  isDark?: boolean
}

export function StudentNameInput({ value, onChange, isDark = false }: StudentNameInputProps) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Student Name"
      className={css({
        w: 'full',
        px: '3',
        py: '2',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.300',
        bg: isDark ? 'gray.700' : 'white',
        color: isDark ? 'gray.100' : 'gray.900',
        rounded: 'lg',
        fontSize: 'sm',
        _focus: {
          outline: 'none',
          borderColor: 'brand.500',
          ring: '2px',
          ringColor: 'brand.200',
        },
        _placeholder: { color: isDark ? 'gray.500' : 'gray.400' },
      })}
    />
  )
}
