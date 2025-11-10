import React from 'react'

interface JoinRoomInputProps {
  onJoin: (code: string) => void
}

type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid'

export function JoinRoomInput({ onJoin }: JoinRoomInputProps) {
  const [code, setCode] = React.useState('')
  const [validationState, setValidationState] = React.useState<ValidationState>('idle')
  const [error, setError] = React.useState<string>('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Format code as user types: ABC123 → ABC-123
  const formatCode = (value: string): string => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length <= 3) return cleaned
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value)
    setCode(formatted)
    setError('')

    // Reset validation when user types
    if (validationState !== 'idle') {
      setValidationState('idle')
    }

    // Auto-validate when 6 characters entered
    const cleanCode = formatted.replace('-', '')
    if (cleanCode.length === 6) {
      validateCode(cleanCode)
    }
  }

  const validateCode = async (codeToValidate: string) => {
    setValidationState('checking')

    try {
      // Check if room exists via API
      const response = await fetch(`/api/arcade/rooms/code/${codeToValidate}`)

      if (response.ok) {
        setValidationState('valid')
      } else {
        setValidationState('invalid')
        setError('Room not found')
      }
    } catch (err) {
      setValidationState('invalid')
      setError('Unable to validate code')
    }
  }

  const handleJoin = () => {
    const cleanCode = code.replace('-', '')
    if (cleanCode.length === 6 && validationState === 'valid') {
      onJoin(cleanCode)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && validationState === 'valid') {
      handleJoin()
    }
  }

  // Visual state colors
  const getBorderColor = () => {
    switch (validationState) {
      case 'valid':
        return '#10b981'
      case 'invalid':
        return '#ef4444'
      case 'checking':
        return '#3b82f6'
      default:
        return '#e5e7eb'
    }
  }

  const getIcon = () => {
    switch (validationState) {
      case 'valid':
        return '✅'
      case 'invalid':
        return '❌'
      case 'checking':
        return '🔄'
      default:
        return ''
    }
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder="ABC-123"
          maxLength={7} // ABC-123
          style={{
            width: '100%',
            padding: '12px 40px 12px 12px',
            fontSize: '16px',
            fontWeight: '600',
            letterSpacing: '2px',
            textAlign: 'center',
            border: `2px solid ${getBorderColor()}`,
            borderRadius: '8px',
            outline: 'none',
            transition: 'all 0.2s ease',
            fontFamily: 'monospace',
          }}
        />

        {/* Validation Icon */}
        {validationState !== 'idle' && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              animation: validationState === 'checking' ? 'spin 1s linear infinite' : 'none',
            }}
          >
            {getIcon()}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '12px',
            color: '#ef4444',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* Join button */}
      {validationState === 'valid' && (
        <button
          type="button"
          onClick={handleJoin}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)'
          }}
        >
          🚀 Join Room
        </button>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              from { transform: translateY(-50%) rotate(0deg); }
              to { transform: translateY(-50%) rotate(360deg); }
            }
          `,
        }}
      />
    </div>
  )
}
