'use client'

import emojiData from 'emojibase-data/en/data.json'
import { useMemo, useState } from 'react'
import { PLAYER_EMOJIS } from '@/constants/playerEmojis'
import { css } from '../../styled-system/css'

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
  emoticon?: string | string[]
}

export interface EmojiPickerProps {
  currentEmoji: string
  onEmojiSelect: (emoji: string) => void
  onClose: () => void
  /** Title shown in the header */
  title?: string
  /** Accent color for selected state */
  accentColor?: 'blue' | 'pink' | 'purple' | 'yellow' | 'green'
  /** Whether to use dark mode styling */
  isDark?: boolean
}

// Emoji group categories from emojibase (matching Unicode CLDR group IDs)
const EMOJI_GROUPS = {
  0: { name: 'Smileys & Emotion', icon: '😀' },
  1: { name: 'People & Body', icon: '👤' },
  3: { name: 'Animals & Nature', icon: '🐶' },
  4: { name: 'Food & Drink', icon: '🍎' },
  5: { name: 'Travel & Places', icon: '🚗' },
  6: { name: 'Activities', icon: '⚽' },
  7: { name: 'Objects', icon: '💡' },
  8: { name: 'Symbols', icon: '❤️' },
  9: { name: 'Flags', icon: '🏁' },
} as const

// Create a map of emoji to their searchable data and group
const emojiMap = new Map<string, { keywords: string[]; group: number }>()
;(emojiData as EmojibaseEmoji[]).forEach((emoji) => {
  if (emoji.emoji) {
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
        ...emoticons,
      ].filter(Boolean),
      group: emoji.group,
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

// Color configurations for different accent colors
const ACCENT_COLORS = {
  blue: {
    gradient: 'linear-gradient(135deg, #74b9ff, #0984e3)',
    selectedBg: 'blue.100',
    selectedBorder: 'blue.400',
    hoverBg: 'blue.200',
  },
  pink: {
    gradient: 'linear-gradient(135deg, #fd79a8, #e84393)',
    selectedBg: 'pink.100',
    selectedBorder: 'pink.400',
    hoverBg: 'pink.200',
  },
  purple: {
    gradient: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
    selectedBg: 'purple.100',
    selectedBorder: 'purple.400',
    hoverBg: 'purple.200',
  },
  yellow: {
    gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    selectedBg: 'yellow.100',
    selectedBorder: 'yellow.400',
    hoverBg: 'yellow.200',
  },
  green: {
    gradient: 'linear-gradient(135deg, #34d399, #10b981)',
    selectedBg: 'green.100',
    selectedBorder: 'green.400',
    hoverBg: 'green.200',
  },
}

export function EmojiPicker({
  currentEmoji,
  onEmojiSelect,
  onClose,
  title = 'Choose Avatar',
  accentColor = 'blue',
  isDark = false,
}: EmojiPickerProps) {
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null)
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 })

  const colors = ACCENT_COLORS[accentColor]

  const isSearching = searchFilter.trim().length > 0
  const isCategoryFiltered = selectedCategory !== null && !isSearching

  // Calculate which categories have emojis
  const availableCategories = useMemo(() => {
    const categoryCounts: Record<number, number> = {}
    PLAYER_EMOJIS.forEach((emoji) => {
      const data = emojiMap.get(emoji)
      if (data && data.group !== undefined) {
        categoryCounts[data.group] = (categoryCounts[data.group] || 0) + 1
      }
    })
    return Object.keys(EMOJI_GROUPS)
      .map(Number)
      .filter((groupId) => categoryCounts[groupId] > 0)
  }, [])

  const displayEmojis = useMemo(() => {
    let emojis = PLAYER_EMOJIS

    if (isCategoryFiltered) {
      emojis = emojis.filter((emoji) => {
        const data = emojiMap.get(emoji)
        return data && data.group === selectedCategory
      })
    }

    if (!isSearching) {
      return emojis
    }

    const searchTerm = searchFilter.toLowerCase().trim()

    const results = PLAYER_EMOJIS.filter((emoji) => {
      const keywords = getEmojiKeywords(emoji)
      return keywords.some((keyword) => keyword?.includes(searchTerm))
    })

    // Sort results by relevance
    const sortedResults = results.sort((a, b) => {
      const aKeywords = getEmojiKeywords(a)
      const bKeywords = getEmojiKeywords(b)

      const aExact = aKeywords.some((k) => k === searchTerm)
      const bExact = bKeywords.some((k) => k === searchTerm)

      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1

      const aStartsWithTerm = aKeywords.some((k) => k?.startsWith(searchTerm))
      const bStartsWithTerm = bKeywords.some((k) => k?.startsWith(searchTerm))

      if (aStartsWithTerm && !bStartsWithTerm) return -1
      if (!aStartsWithTerm && bStartsWithTerm) return 1

      const aScore = aKeywords.filter((k) => k?.includes(searchTerm)).length
      const bScore = bKeywords.filter((k) => k?.includes(searchTerm)).length

      return bScore - aScore
    })

    return sortedResults
  }, [searchFilter, isSearching, selectedCategory, isCategoryFiltered])

  return (
    <div
      data-component="emoji-picker"
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease',
        padding: '20px',
      })}
    >
      <div
        className={css({
          background: isDark ? 'gray.800' : 'white',
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
          flexDirection: 'column',
        })}
      >
        {/* Header */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '2px solid',
            borderColor: isDark ? 'gray.700' : 'gray.100',
            paddingBottom: '12px',
            flexShrink: 0,
          })}
        >
          <h3
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              margin: 0,
            })}
          >
            {title}
          </h3>
          <button
            type="button"
            className={css({
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: isDark ? 'gray.400' : 'gray.500',
              _hover: { color: isDark ? 'gray.200' : 'gray.700' },
              padding: '4px',
            })}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Current Selection & Search */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
            flexShrink: 0,
          })}
        >
          <div
            className={css({
              padding: '8px 12px',
              borderRadius: '12px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            })}
            style={{ background: colors.gradient }}
          >
            <div className={css({ fontSize: '24px' })}>{currentEmoji}</div>
            <div className={css({ fontSize: '12px', fontWeight: 'bold' })}>Current</div>
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
              borderColor: isDark ? 'gray.600' : 'gray.200',
              borderRadius: '12px',
              fontSize: '14px',
              bg: isDark ? 'gray.700' : 'white',
              color: isDark ? 'gray.100' : 'gray.800',
              _focus: {
                outline: 'none',
                borderColor: 'blue.400',
                boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.1)',
              },
            })}
          />

          {isSearching && (
            <div
              className={css({
                fontSize: '12px',
                color: isDark ? 'gray.300' : 'gray.600',
                flexShrink: 0,
                padding: '4px 8px',
                background: displayEmojis.length > 0 ? 'green.100' : 'red.100',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: displayEmojis.length > 0 ? 'green.300' : 'red.300',
              })}
            >
              {displayEmojis.length > 0 ? `✓ ${displayEmojis.length} found` : '✗ No matches'}
            </div>
          )}
        </div>

        {/* Category Tabs */}
        {!isSearching && (
          <div
            className={css({
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '8px',
              marginBottom: '12px',
              flexShrink: 0,
              '&::-webkit-scrollbar': {
                height: '6px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: isDark ? '#4a5568' : '#cbd5e1',
                borderRadius: '3px',
              },
            })}
          >
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={css({
                padding: '8px 16px',
                borderRadius: '20px',
                border: selectedCategory === null ? '2px solid #3b82f6' : '2px solid',
                borderColor:
                  selectedCategory === null ? 'blue.500' : isDark ? 'gray.600' : 'gray.200',
                background:
                  selectedCategory === null
                    ? isDark
                      ? 'blue.900'
                      : '#eff6ff'
                    : isDark
                      ? 'gray.700'
                      : 'white',
                color:
                  selectedCategory === null
                    ? isDark
                      ? 'blue.300'
                      : '#1e40af'
                    : isDark
                      ? 'gray.300'
                      : 'gray.600',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                _hover: {
                  transform: 'translateY(-1px)',
                },
              })}
            >
              ✨ All
            </button>
            {availableCategories.map((groupId) => {
              const group = EMOJI_GROUPS[groupId as keyof typeof EMOJI_GROUPS]
              return (
                <button
                  type="button"
                  key={groupId}
                  onClick={() => setSelectedCategory(Number(groupId))}
                  className={css({
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border:
                      selectedCategory === Number(groupId) ? '2px solid #3b82f6' : '2px solid',
                    borderColor:
                      selectedCategory === Number(groupId)
                        ? 'blue.500'
                        : isDark
                          ? 'gray.600'
                          : 'gray.200',
                    background:
                      selectedCategory === Number(groupId)
                        ? isDark
                          ? 'blue.900'
                          : '#eff6ff'
                        : isDark
                          ? 'gray.700'
                          : 'white',
                    color:
                      selectedCategory === Number(groupId)
                        ? isDark
                          ? 'blue.300'
                          : '#1e40af'
                        : isDark
                          ? 'gray.300'
                          : 'gray.600',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    _hover: {
                      transform: 'translateY(-1px)',
                    },
                  })}
                >
                  {group.icon} {group.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Status Header */}
        <div
          className={css({
            padding: '8px 12px',
            background: isSearching ? 'blue.50' : isDark ? 'gray.700' : 'gray.50',
            border: '1px solid',
            borderColor: isSearching ? 'blue.200' : isDark ? 'gray.600' : 'gray.200',
            borderRadius: '8px',
            marginBottom: '12px',
            flexShrink: 0,
          })}
        >
          <div
            className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: isSearching ? 'blue.700' : isDark ? 'gray.200' : 'gray.700',
              marginBottom: '4px',
            })}
          >
            {isSearching
              ? `🔍 Search Results for "${searchFilter}"`
              : selectedCategory !== null
                ? `${EMOJI_GROUPS[selectedCategory as keyof typeof EMOJI_GROUPS].icon} ${EMOJI_GROUPS[selectedCategory as keyof typeof EMOJI_GROUPS].name}`
                : '📝 All Available Characters'}
          </div>
          <div
            className={css({
              fontSize: '12px',
              color: isSearching ? 'blue.600' : isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {displayEmojis.length} emojis {selectedCategory !== null ? 'in category' : 'available'}
          </div>
        </div>

        {/* Emoji Grid */}
        {displayEmojis.length > 0 && (
          <div
            className={css({
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              '&::-webkit-scrollbar': {
                width: '10px',
              },
              '&::-webkit-scrollbar-track': {
                background: isDark ? '#2d3748' : '#f1f5f9',
                borderRadius: '5px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: isDark ? '#4a5568' : '#cbd5e1',
                borderRadius: '5px',
                '&:hover': {
                  background: isDark ? '#718096' : '#94a3b8',
                },
              },
            })}
          >
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(16, 1fr)',
                gap: '4px',
                padding: '4px',
                '@media (max-width: 1200px)': {
                  gridTemplateColumns: 'repeat(14, 1fr)',
                },
                '@media (max-width: 1000px)': {
                  gridTemplateColumns: 'repeat(12, 1fr)',
                },
                '@media (max-width: 800px)': {
                  gridTemplateColumns: 'repeat(10, 1fr)',
                },
                '@media (max-width: 600px)': {
                  gridTemplateColumns: 'repeat(8, 1fr)',
                },
              })}
            >
              {displayEmojis.map((emoji) => {
                const isSelected = emoji === currentEmoji
                return (
                  <button
                    type="button"
                    key={emoji}
                    className={css({
                      aspectRatio: '1',
                      background: isSelected ? colors.selectedBg : 'transparent',
                      border: '2px solid',
                      borderColor: isSelected ? colors.selectedBorder : 'transparent',
                      borderRadius: '6px',
                      fontSize: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      _hover: {
                        background: isSelected ? colors.hoverBg : isDark ? 'gray.600' : 'gray.100',
                        transform: 'scale(1.15)',
                        zIndex: 1,
                        fontSize: '24px',
                      },
                    })}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredEmoji(emoji)
                      setHoverPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      })
                    }}
                    onMouseLeave={() => setHoveredEmoji(null)}
                    onClick={() => {
                      onEmojiSelect(emoji)
                    }}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* No results message */}
        {isSearching && displayEmojis.length === 0 && (
          <div
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            <div className={css({ fontSize: '48px', marginBottom: '16px' })}>🔍</div>
            <div
              className={css({
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '8px',
              })}
            >
              No emojis found for "{searchFilter}"
            </div>
            <div className={css({ fontSize: '14px', marginBottom: '12px' })}>
              Try searching for "face", "smart", "heart", "animal", "food", etc.
            </div>
            <button
              type="button"
              className={css({
                background: 'blue.500',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                cursor: 'pointer',
                _hover: { background: 'blue.600' },
              })}
              onClick={() => setSearchFilter('')}
            >
              Clear search to see all {PLAYER_EMOJIS.length} emojis
            </button>
          </div>
        )}

        {/* Footer hint */}
        <div
          className={css({
            marginTop: '8px',
            padding: '6px 12px',
            background: isDark ? 'gray.700' : 'gray.50',
            borderRadius: '8px',
            fontSize: '11px',
            color: isDark ? 'gray.400' : 'gray.600',
            textAlign: 'center',
            flexShrink: 0,
          })}
        >
          💡 Powered by emojibase-data • Try: "face", "smart", "heart", "animal", "food" • Click to
          select
        </div>
      </div>

      {/* Magnifying Glass Preview */}
      {hoveredEmoji && (
        <div
          style={{
            position: 'fixed',
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y - 120}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10001,
            animation: 'magnifyIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-20px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
              animation: 'pulseGlow 2s ease-in-out infinite',
            }}
          />
          <div
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: '24px',
              padding: '20px',
              boxShadow:
                '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '120px',
              lineHeight: 1,
              minWidth: '160px',
              minHeight: '160px',
              position: 'relative',
              animation: 'emojiFloat 3s ease-in-out infinite',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                fontSize: '20px',
                animation: 'sparkle 1.5s ease-in-out infinite',
              }}
            >
              ✨
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '15px',
                left: '15px',
                fontSize: '16px',
                animation: 'sparkle 1.5s ease-in-out infinite',
                animationDelay: '0.5s',
              }}
            >
              ✨
            </div>
            {hoveredEmoji}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '14px solid transparent',
              borderRight: '14px solid transparent',
              borderTop: '14px solid white',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            }}
          />
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes magnifyIn {
          from {
            opacity: 0;
            transform: translateX(-50%) scale(0.5);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
        @keyframes emojiFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }
      `,
        }}
      />
    </div>
  )
}
