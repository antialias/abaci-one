'use client'

import { useState, useMemo } from 'react'
import { PLAYER_EMOJIS } from '../../../../contexts/UserProfileContext'
import { css } from '../../../../../styled-system/css'
import emojiData from 'emojibase-data/en/data.json'

// Proper TypeScript interface for emojibase-data structure
interface EmojibaseEmoji {
  label: string
  hexcode: string
  tags?: string[]
  emoji: string
  text: string
  type: number
  order: number
  group: number
  subgroup: number
  version: number
  emoticon?: string | string[] // Can be string, array, or undefined
}

interface EmojiPickerProps {
  currentEmoji: string
  onEmojiSelect: (emoji: string) => void
  onClose: () => void
  playerNumber: 1 | 2
}

// Create a map of emoji to their searchable data
const emojiMap = new Map<string, { keywords: string[] }>()
;(emojiData as EmojibaseEmoji[]).forEach((emoji) => {
  if (emoji.emoji) {
    // Handle emoticon field which can be string, array, or undefined
    const emoticons: string[] = []
    if (emoji.emoticon) {
      if (Array.isArray(emoji.emoticon)) {
        emoticons.push(...emoji.emoticon.map((e) => e.toLowerCase()))
      } else {
        emoticons.push(emoji.emoticon.toLowerCase())
      }
    }

    emojiMap.set(emoji.emoji, {
      keywords: [
        emoji.label?.toLowerCase(),
        ...(emoji.tags || []).map((tag: string) => tag.toLowerCase()),
        ...emoticons
      ].filter(Boolean)
    })
  }
})

// Enhanced search function using emojibase-data
function getEmojiKeywords(emoji: string): string[] {
  const data = emojiMap.get(emoji)
  if (data) {
    return data.keywords
  }

  // Fallback categories for emojis not in emojibase-data
  if (/[\u{1F600}-\u{1F64F}]/u.test(emoji)) return ['face', 'emotion', 'person', 'expression']
  if (/[\u{1F400}-\u{1F43F}]/u.test(emoji)) return ['animal', 'nature', 'cute', 'pet']
  if (/[\u{1F440}-\u{1F4FF}]/u.test(emoji)) return ['object', 'symbol', 'tool']
  if (/[\u{1F300}-\u{1F3FF}]/u.test(emoji)) return ['nature', 'travel', 'activity', 'place']
  if (/[\u{1F680}-\u{1F6FF}]/u.test(emoji)) return ['transport', 'travel', 'vehicle']
  if (/[\u{2600}-\u{26FF}]/u.test(emoji)) return ['symbol', 'misc', 'sign']

  return ['misc', 'other']
}

export function EmojiPicker({ currentEmoji, onEmojiSelect, onClose, playerNumber }: EmojiPickerProps) {
  const [searchFilter, setSearchFilter] = useState('')

  // Enhanced search functionality - clear separation between default and search
  const isSearching = searchFilter.trim().length > 0

  const displayEmojis = useMemo(() => {
    if (!isSearching) {
      return PLAYER_EMOJIS
    }

    const searchTerm = searchFilter.toLowerCase().trim()

    const results = PLAYER_EMOJIS.filter(emoji => {
      const keywords = getEmojiKeywords(emoji)
      return keywords.some(keyword =>
        keyword && keyword.includes(searchTerm)
      )
    })

    // Sort results by relevance
    const sortedResults = results.sort((a, b) => {
      const aKeywords = getEmojiKeywords(a)
      const bKeywords = getEmojiKeywords(b)

      // Exact match priority
      const aExact = aKeywords.some(k => k === searchTerm)
      const bExact = bKeywords.some(k => k === searchTerm)

      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1

      // Word boundary matches (start of word)
      const aStartsWithTerm = aKeywords.some(k => k && k.startsWith(searchTerm))
      const bStartsWithTerm = bKeywords.some(k => k && k.startsWith(searchTerm))

      if (aStartsWithTerm && !bStartsWithTerm) return -1
      if (!aStartsWithTerm && bStartsWithTerm) return 1

      // Score by number of matching keywords
      const aScore = aKeywords.filter(k => k && k.includes(searchTerm)).length
      const bScore = bKeywords.filter(k => k && k.includes(searchTerm)).length

      return bScore - aScore
    })

    return sortedResults
  }, [searchFilter, isSearching])

  return (
    <div className={css({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease',
      padding: '20px'
    })}>
      <div className={css({
        background: 'white',
        borderRadius: '20px',
        padding: '24px',
        width: '90vw',
        height: '90vh',
        maxWidth: '1200px',
        maxHeight: '800px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      })}>

        {/* Header */}
        <div className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '2px solid',
          borderColor: 'gray.100',
          paddingBottom: '12px',
          flexShrink: 0
        })}>
          <h3 className={css({
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'gray.800',
            margin: 0
          })}>
            Choose Character for Player {playerNumber}
          </h3>
          <button
            className={css({
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'gray.500',
              _hover: { color: 'gray.700' },
              padding: '4px'
            })}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Current Selection & Search */}
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '16px',
          flexShrink: 0
        })}>
          <div className={css({
            padding: '8px 12px',
            background: playerNumber === 1
              ? 'linear-gradient(135deg, #74b9ff, #0984e3)'
              : 'linear-gradient(135deg, #fd79a8, #e84393)',
            borderRadius: '12px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0
          })}>
            <div className={css({ fontSize: '24px' })}>
              {currentEmoji}
            </div>
            <div className={css({ fontSize: '12px', fontWeight: 'bold' })}>
              Current
            </div>
          </div>

          <input
            type="text"
            placeholder="Search: face, smart, heart, animal, food..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={css({
              flex: 1,
              padding: '8px 12px',
              border: '2px solid',
              borderColor: 'gray.200',
              borderRadius: '12px',
              fontSize: '14px',
              _focus: {
                outline: 'none',
                borderColor: 'blue.400',
                boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.1)'
              }
            })}
          />

          {isSearching && (
            <div className={css({
              fontSize: '12px',
              color: 'gray.600',
              flexShrink: 0,
              padding: '4px 8px',
              background: displayEmojis.length > 0 ? 'green.100' : 'red.100',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: displayEmojis.length > 0 ? 'green.300' : 'red.300'
            })}>
              {displayEmojis.length > 0 ? `✓ ${displayEmojis.length} found` : '✗ No matches'}
            </div>
          )}
        </div>

        {/* Search Mode Header */}
        {isSearching && displayEmojis.length > 0 && (
          <div className={css({
            padding: '8px 12px',
            background: 'blue.50',
            border: '1px solid',
            borderColor: 'blue.200',
            borderRadius: '8px',
            marginBottom: '12px',
            flexShrink: 0
          })}>
            <div className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'blue.700',
              marginBottom: '4px'
            })}>
              🔍 Search Results for "{searchFilter}"
            </div>
            <div className={css({
              fontSize: '12px',
              color: 'blue.600'
            })}>
              Showing {displayEmojis.length} of {PLAYER_EMOJIS.length} emojis • Clear search to see all
            </div>
          </div>
        )}

        {/* Default Mode Header */}
        {!isSearching && (
          <div className={css({
            padding: '8px 12px',
            background: 'gray.50',
            border: '1px solid',
            borderColor: 'gray.200',
            borderRadius: '8px',
            marginBottom: '12px',
            flexShrink: 0
          })}>
            <div className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'gray.700',
              marginBottom: '4px'
            })}>
              📝 All Available Characters
            </div>
            <div className={css({
              fontSize: '12px',
              color: 'gray.600'
            })}>
              {PLAYER_EMOJIS.length} characters available • Use search to find specific emojis
            </div>
          </div>
        )}

        {/* Emoji Grid - Only show when there are emojis to display */}
        {displayEmojis.length > 0 && (
          <div className={css({
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(16, 1fr)',
            gap: '4px',
            alignContent: 'start',
            '@media (max-width: 1200px)': {
              gridTemplateColumns: 'repeat(14, 1fr)'
            },
            '@media (max-width: 1000px)': {
              gridTemplateColumns: 'repeat(12, 1fr)'
            },
            '@media (max-width: 800px)': {
              gridTemplateColumns: 'repeat(10, 1fr)'
            },
            '@media (max-width: 600px)': {
              gridTemplateColumns: 'repeat(8, 1fr)'
            }
          })}>
            {displayEmojis.map(emoji => {
              const isSelected = emoji === currentEmoji
              return (
                <button
                  key={emoji}
                  className={css({
                    aspectRatio: '1',
                    background: isSelected
                      ? (playerNumber === 1 ? 'blue.100' : 'pink.100')
                      : 'transparent',
                    border: '2px solid',
                    borderColor: isSelected
                      ? (playerNumber === 1 ? 'blue.400' : 'pink.400')
                      : 'transparent',
                    borderRadius: '6px',
                    fontSize: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    _hover: {
                      background: isSelected
                        ? (playerNumber === 1 ? 'blue.200' : 'pink.200')
                        : 'gray.100',
                      transform: 'scale(1.15)',
                      zIndex: 1,
                      fontSize: '24px'
                    }
                  })}
                  onClick={() => {
                    onEmojiSelect(emoji)
                  }}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        )}

        {/* No results message */}
        {isSearching && displayEmojis.length === 0 && (
          <div className={css({
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: 'gray.500'
          })}>
            <div className={css({ fontSize: '48px', marginBottom: '16px' })}>🔍</div>
            <div className={css({ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' })}>
              No emojis found for "{searchFilter}"
            </div>
            <div className={css({ fontSize: '14px', marginBottom: '12px' })}>
              Try searching for "face", "smart", "heart", "animal", "food", etc.
            </div>
            <button
              className={css({
                background: 'blue.500',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                cursor: 'pointer',
                _hover: { background: 'blue.600' }
              })}
              onClick={() => setSearchFilter('')}
            >
              Clear search to see all {PLAYER_EMOJIS.length} emojis
            </button>
          </div>
        )}

        {/* Quick selection hint */}
        <div className={css({
          marginTop: '8px',
          padding: '6px 12px',
          background: 'gray.50',
          borderRadius: '8px',
          fontSize: '11px',
          color: 'gray.600',
          textAlign: 'center',
          flexShrink: 0
        })}>
          💡 Powered by emojibase-data • Try: "face", "smart", "heart", "animal", "food" • Click to select
        </div>
      </div>
    </div>
  )
}

// Add fade in animation
const fadeInAnimation = `
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
`

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('emoji-picker-animations')) {
  const style = document.createElement('style')
  style.id = 'emoji-picker-animations'
  style.textContent = fadeInAnimation
  document.head.appendChild(style)
}