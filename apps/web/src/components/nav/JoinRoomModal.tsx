import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { useRoomData } from '@/hooks/useRoomData'

export interface JoinRoomModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean

  /**
   * Callback when modal should close
   */
  onClose: () => void

  /**
   * Optional callback when room is successfully joined
   */
  onSuccess?: () => void
}

/**
 * Modal for joining a room by entering a 6-character code
 */
export function JoinRoomModal({ isOpen, onClose, onSuccess }: JoinRoomModalProps) {
  const { getRoomByCode, joinRoom } = useRoomData()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleClose = () => {
    setCode('')
    setError('')
    setIsLoading(false)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const normalizedCode = code.trim().toUpperCase()
    if (normalizedCode.length !== 6) {
      setError('Code must be 6 characters')
      return
    }

    setIsLoading(true)

    try {
      // Look up room by code
      const room = await getRoomByCode(normalizedCode)

      // Join the room
      await joinRoom(room.id)

      // Success! Close modal
      handleClose()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div
        style={{
          border: '2px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: 'rgba(196, 181, 253, 1)',
          }}
        >
          Join Room by Code
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(209, 213, 219, 0.8)',
            marginBottom: '24px',
          }}
        >
          Enter the 6-character room code
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setError('')
            }}
            placeholder="ABC123"
            maxLength={6}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              border: error
                ? '2px solid rgba(239, 68, 68, 0.6)'
                : '2px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              textAlign: 'center',
              letterSpacing: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(196, 181, 253, 1)',
              outline: 'none',
              marginBottom: '8px',
            }}
          />

          {error && (
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(248, 113, 113, 1)',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(75, 85, 99, 0.3)',
                color: 'rgba(209, 213, 219, 1)',
                border: '2px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
                }
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={code.trim().length !== 6 || isLoading}
              style={{
                flex: 1,
                padding: '12px',
                background:
                  code.trim().length === 6 && !isLoading
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))'
                    : 'rgba(75, 85, 99, 0.3)',
                color:
                  code.trim().length === 6 && !isLoading
                    ? 'rgba(255, 255, 255, 1)'
                    : 'rgba(156, 163, 175, 1)',
                border:
                  code.trim().length === 6 && !isLoading
                    ? '2px solid rgba(59, 130, 246, 0.6)'
                    : '2px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: code.trim().length === 6 && !isLoading ? 'pointer' : 'not-allowed',
                opacity: code.trim().length === 6 && !isLoading ? 1 : 0.5,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (code.trim().length === 6 && !isLoading) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))'
                }
              }}
              onMouseLeave={(e) => {
                if (code.trim().length === 6 && !isLoading) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))'
                }
              }}
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
