import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PLAYER_EMOJIS } from '../../../../../constants/playerEmojis'
import { EmojiPicker } from '../EmojiPicker'

// Mock the emoji keywords function for testing
vi.mock('emojibase-data/en/data.json', () => ({
  default: [
    {
      emoji: '🐱',
      label: 'cat face',
      tags: ['cat', 'animal', 'pet', 'cute'],
      emoticon: ':)',
    },
    {
      emoji: '🐯',
      label: 'tiger face',
      tags: ['tiger', 'animal', 'big cat', 'wild'],
      emoticon: null,
    },
    {
      emoji: '🤩',
      label: 'star-struck',
      tags: ['face', 'happy', 'excited', 'star'],
      emoticon: null,
    },
    {
      emoji: '🎭',
      label: 'performing arts',
      tags: ['theater', 'performance', 'drama', 'arts'],
      emoticon: null,
    },
  ],
}))

describe('EmojiPicker Search Functionality', () => {
  const mockProps = {
    currentEmoji: '😀',
    onEmojiSelect: vi.fn(),
    onClose: vi.fn(),
    playerNumber: 1 as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows all emojis by default (no search)', () => {
    render(<EmojiPicker {...mockProps} />)

    // Should show default header
    expect(screen.getByText('📝 All Available Characters')).toBeInTheDocument()

    // Should show emoji count
    expect(
      screen.getByText(new RegExp(`${PLAYER_EMOJIS.length} characters available`))
    ).toBeInTheDocument()

    // Should show emoji grid
    const emojiButtons = screen
      .getAllByRole('button')
      .filter(
        (button) =>
          button.textContent &&
          /[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
            button.textContent
          )
      )
    expect(emojiButtons.length).toBe(PLAYER_EMOJIS.length)
  })

  test('shows search results when searching for "cat"', () => {
    render(<EmojiPicker {...mockProps} />)

    const searchInput = screen.getByPlaceholderText(/Search:/)
    fireEvent.change(searchInput, { target: { value: 'cat' } })

    // Should show search header
    expect(screen.getByText(/🔍 Search Results for "cat"/)).toBeInTheDocument()

    // Should show results count
    expect(screen.getByText(/✓ \d+ found/)).toBeInTheDocument()

    // Should only show cat-related emojis (🐱, 🐯)
    const emojiButtons = screen
      .getAllByRole('button')
      .filter(
        (button) =>
          button.textContent &&
          /[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
            button.textContent
          )
      )

    // Verify only cat emojis are shown
    const displayedEmojis = emojiButtons.map((btn) => btn.textContent)
    expect(displayedEmojis).toContain('🐱')
    expect(displayedEmojis).toContain('🐯')
    expect(displayedEmojis).not.toContain('🤩')
    expect(displayedEmojis).not.toContain('🎭')
  })

  test('shows no results message when search has zero matches', () => {
    render(<EmojiPicker {...mockProps} />)

    const searchInput = screen.getByPlaceholderText(/Search:/)
    fireEvent.change(searchInput, { target: { value: 'nonexistentterm' } })

    // Should show no results indicator
    expect(screen.getByText('✗ No matches')).toBeInTheDocument()

    // Should show no results message
    expect(screen.getByText(/No emojis found for "nonexistentterm"/)).toBeInTheDocument()

    // Should NOT show any emoji buttons
    const emojiButtons = screen
      .queryAllByRole('button')
      .filter(
        (button) =>
          button.textContent &&
          /[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
            button.textContent
          )
      )
    expect(emojiButtons).toHaveLength(0)
  })

  test('returns to default view when clearing search', () => {
    render(<EmojiPicker {...mockProps} />)

    const searchInput = screen.getByPlaceholderText(/Search:/)

    // Search for something
    fireEvent.change(searchInput, { target: { value: 'cat' } })
    expect(screen.getByText(/🔍 Search Results for "cat"/)).toBeInTheDocument()

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } })

    // Should return to default view
    expect(screen.getByText('📝 All Available Characters')).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`${PLAYER_EMOJIS.length} characters available`))
    ).toBeInTheDocument()

    // Should show all emojis again
    const emojiButtons = screen
      .getAllByRole('button')
      .filter(
        (button) =>
          button.textContent &&
          /[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
            button.textContent
          )
      )
    expect(emojiButtons.length).toBe(PLAYER_EMOJIS.length)
  })

  test('clear search button works from no results state', () => {
    render(<EmojiPicker {...mockProps} />)

    const searchInput = screen.getByPlaceholderText(/Search:/)

    // Search for something with no results
    fireEvent.change(searchInput, { target: { value: 'nonexistentterm' } })
    expect(screen.getByText(/No emojis found/)).toBeInTheDocument()

    // Click clear search button
    const clearButton = screen.getByText(/Clear search to see all/)
    fireEvent.click(clearButton)

    // Should return to default view
    expect(searchInput).toHaveValue('')
    expect(screen.getByText('📝 All Available Characters')).toBeInTheDocument()
  })
})
