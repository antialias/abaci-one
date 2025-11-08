import { css } from '../../../../../../../styled-system/css'

export interface StudentNameInputProps {
  value: string | undefined
  onChange: (value: string) => void
}

export function StudentNameInput({ value, onChange }: StudentNameInputProps) {
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
        borderColor: 'gray.300',
        rounded: 'lg',
        fontSize: 'sm',
        _focus: {
          outline: 'none',
          borderColor: 'brand.500',
          ring: '2px',
          ringColor: 'brand.200',
        },
        _placeholder: { color: 'gray.400' },
      })}
    />
  )
}
