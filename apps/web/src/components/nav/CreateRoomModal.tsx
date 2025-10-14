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

  const handleClose = () => {
    setError('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const gameName = formData.get('gameName') as string

    if (!name || !gameName) {
      setError('Please fill in all fields')
      return
    }

    try {
      // Create the room (creator is auto-added as first member)
      await createRoom({
        name,
        gameName,
        creatorName: 'Player',
        gameConfig: { difficulty: 6 },
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
              Room Name
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="My Awesome Room"
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

          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
              }}
            >
              Game
            </label>
            <select
              name="gameName"
              required
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
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.6)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
              }}
            >
              <option value="matching">Memory Matching</option>
              <option value="memory-quiz">Memory Quiz</option>
              <option value="complement-race">Complement Race</option>
            </select>
          </div>

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
