import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { useCreateRoom } from '@/hooks/useRoomData'

export interface CreateRoomModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean

  /**
   * Callback when modal should close
   */
  onClose: () => void

  /**
   * Optional callback when room is successfully created
   */
  onSuccess?: () => void
}

/**
 * Modal for creating a new multiplayer room
 */
export function CreateRoomModal({ isOpen, onClose, onSuccess }: CreateRoomModalProps) {
  const { mutateAsync: createRoom, isPending } = useCreateRoom()
  const [error, setError] = useState('')
  const [gameName, setGameName] = useState<'matching' | 'memory-quiz' | 'complement-race'>(
    'matching'
  )
  const [accessMode, setAccessMode] = useState<
    'open' | 'password' | 'approval-only' | 'restricted'
  >('open')
  const [password, setPassword] = useState('')

  const handleClose = () => {
    setError('')
    setGameName('matching')
    setAccessMode('open')
    setPassword('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const formData = new FormData(e.currentTarget)
    const nameValue = formData.get('name') as string

    // Treat empty name as null
    const name = nameValue?.trim() || null

    // Validate password for password-protected rooms
    if (accessMode === 'password' && !password) {
      setError('Password is required for password-protected rooms')
      return
    }

    try {
      // Create the room (creator is auto-added as first member)
      await createRoom({
        name,
        gameName,
        creatorName: 'Player',
        gameConfig: { difficulty: 6 },
        accessMode,
        password: accessMode === 'password' ? password : undefined,
      })

      // Success! Close modal
      handleClose()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div
        style={{
          border: '2px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '16px',
          padding: '24px',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: 'rgba(134, 239, 172, 1)',
          }}
        >
          Create New Room
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(209, 213, 219, 0.8)',
            marginBottom: '24px',
          }}
        >
          You'll leave the current room and create a new one
        </p>

        <form onSubmit={handleSubmit}>
          {/* Room Name */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '600',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '13px',
              }}
            >
              Room Name{' '}
              <span
                style={{ fontWeight: '400', color: 'rgba(156, 163, 175, 1)', fontSize: '12px' }}
              >
                (optional)
              </span>
            </label>
            <input
              name="name"
              type="text"
              placeholder="e.g., Friday Night Games (defaults to: 🎮 CODE)"
              disabled={isPending}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.6)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
              }}
            />
          </div>

          {/* Game Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '13px',
              }}
            >
              Choose Game
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { value: 'matching' as const, emoji: '🃏', label: 'Memory', desc: 'Matching' },
                { value: 'memory-quiz' as const, emoji: '🧠', label: 'Memory', desc: 'Quiz' },
                {
                  value: 'complement-race' as const,
                  emoji: '⚡',
                  label: 'Complement',
                  desc: 'Race',
                },
              ].map((game) => (
                <button
                  key={game.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => setGameName(game.value)}
                  style={{
                    padding: '12px 8px',
                    background:
                      gameName === game.value
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      gameName === game.value
                        ? '2px solid rgba(34, 197, 94, 0.6)'
                        : '2px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color:
                      gameName === game.value
                        ? 'rgba(134, 239, 172, 1)'
                        : 'rgba(209, 213, 219, 0.8)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    opacity: isPending ? 0.5 : 1,
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isPending && gameName !== game.value) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (gameName !== game.value) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                      e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
                    }
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{game.emoji}</span>
                  <div style={{ lineHeight: '1.2' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{game.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>{game.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Access Mode Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '13px',
              }}
            >
              Who Can Join
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { value: 'open', emoji: '🌐', label: 'Open', desc: 'Anyone' },
                { value: 'password', emoji: '🔑', label: 'Password', desc: 'With key' },
                { value: 'approval-only', emoji: '✋', label: 'Approval', desc: 'Request' },
                { value: 'restricted', emoji: '🚫', label: 'Restricted', desc: 'Invite only' },
              ].map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setAccessMode(mode.value as typeof accessMode)
                    if (mode.value !== 'password') setPassword('')
                  }}
                  style={{
                    padding: '10px 12px',
                    background:
                      accessMode === mode.value
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      accessMode === mode.value
                        ? '2px solid rgba(34, 197, 94, 0.6)'
                        : '2px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '8px',
                    color:
                      accessMode === mode.value
                        ? 'rgba(134, 239, 172, 1)'
                        : 'rgba(209, 213, 219, 0.8)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    opacity: isPending ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isPending && accessMode !== mode.value) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (accessMode !== mode.value) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                      e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
                    }
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{mode.emoji}</span>
                  <div style={{ textAlign: 'left', flex: 1, lineHeight: '1.2' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{mode.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>{mode.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {accessMode === 'password' && (
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: 'rgba(209, 213, 219, 1)',
                  fontSize: '14px',
                }}
              >
                Room Password
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a password"
                disabled={isPending}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(209, 213, 219, 1)',
                  fontSize: '15px',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.6)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
                }}
              />
            </div>
          )}

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

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(75, 85, 99, 0.3)',
                color: 'rgba(209, 213, 219, 1)',
                border: '2px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isPending) {
                  e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isPending) {
                  e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
                }
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                flex: 1,
                padding: '12px',
                background: isPending
                  ? 'rgba(75, 85, 99, 0.3)'
                  : 'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))',
                color: 'rgba(255, 255, 255, 1)',
                border: isPending
                  ? '2px solid rgba(75, 85, 99, 0.5)'
                  : '2px solid rgba(34, 197, 94, 0.6)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isPending) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))'
                }
              }}
              onMouseLeave={(e) => {
                if (!isPending) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))'
                }
              }}
            >
              {isPending ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
