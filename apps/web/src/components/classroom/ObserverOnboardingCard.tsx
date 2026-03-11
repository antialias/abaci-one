'use client'

import { useState } from 'react'
import { useObserverCoPlayProfile } from '@/hooks/useObserverCoPlayProfile'
import { css } from '../../../styled-system/css'

// Curated emoji subset for quick observer avatar selection
const QUICK_EMOJIS = [
  '😊',
  '😎',
  '🤓',
  '🦊',
  '🐱',
  '🐶',
  '🦁',
  '🐼',
  '🌟',
  '🎯',
  '🎨',
  '🎵',
  '🚀',
  '💎',
  '🌈',
  '🦋',
]

const QUICK_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
]

interface ObserverOnboardingCardProps {
  isDark: boolean
  studentName: string
}

/**
 * Compact card shown during practice observation that lets the observer
 * set up a player profile for joining game breaks as a participant.
 */
export function ObserverOnboardingCard({ isDark, studentName }: ObserverOnboardingCardProps) {
  const { profile, isReady, updateProfile, clearProfile } = useObserverCoPlayProfile()
  const [isExpanded, setIsExpanded] = useState(false)
  const [editName, setEditName] = useState(profile?.name ?? '')

  // Collapsed: show ready status or invite to set up
  if (!isExpanded) {
    if (isReady && profile) {
      return (
        <div
          data-component="observer-onboarding-card"
          data-state="ready"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isDark ? 'green.800' : 'green.200',
            bg: isDark ? 'green.900/30' : 'green.50',
            fontSize: '0.875rem',
          })}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
            <span
              className={css({ fontSize: '1.25rem' })}
              style={{ filter: `drop-shadow(0 0 4px ${profile.color})` }}
            >
              {profile.emoji}
            </span>
            <span className={css({ color: isDark ? 'green.300' : 'green.700', fontWeight: '500' })}>
              Ready to play as {profile.name}
            </span>
          </div>
          <button
            data-action="edit-coplay-profile"
            onClick={() => {
              setEditName(profile.name)
              setIsExpanded(true)
            }}
            className={css({
              border: 'none',
              bg: 'transparent',
              color: isDark ? 'gray.400' : 'gray.500',
              cursor: 'pointer',
              fontSize: '0.75rem',
              _hover: { color: isDark ? 'gray.200' : 'gray.700' },
            })}
          >
            Edit
          </button>
        </div>
      )
    }

    return (
      <button
        data-component="observer-onboarding-card"
        data-state="collapsed"
        onClick={() => setIsExpanded(true)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.5rem 0.75rem',
          borderRadius: '12px',
          border: '1px dashed',
          borderColor: isDark ? 'indigo.700' : 'indigo.200',
          bg: isDark ? 'indigo.900/20' : 'indigo.50',
          cursor: 'pointer',
          fontSize: '0.875rem',
          color: isDark ? 'indigo.300' : 'indigo.600',
          fontWeight: '500',
          _hover: {
            borderColor: isDark ? 'indigo.500' : 'indigo.400',
            bg: isDark ? 'indigo.900/40' : 'indigo.100',
          },
          transition: 'all 0.15s',
        })}
      >
        <span className={css({ fontSize: '1rem' })}>🎮</span>
        Play along during game breaks
      </button>
    )
  }

  // Expanded: profile setup form
  const selectedEmoji = profile?.emoji ?? '😊'
  const selectedColor = profile?.color ?? '#6366f1'

  return (
    <div
      data-component="observer-onboarding-card"
      data-state="expanded"
      className={css({
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'indigo.700' : 'indigo.200',
        bg: isDark ? 'indigo.900/20' : 'indigo.50',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: '0.75rem',
        })}
      >
        <h4
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: isDark ? 'gray.100' : 'gray.800',
            margin: 0,
          })}
        >
          Set up your player
        </h4>
        <button
          data-action="close-onboarding"
          onClick={() => setIsExpanded(false)}
          className={css({
            border: 'none',
            bg: 'transparent',
            color: isDark ? 'gray.400' : 'gray.500',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
            _hover: { color: isDark ? 'gray.200' : 'gray.700' },
          })}
        >
          ✕
        </button>
      </div>

      <p
        className={css({
          fontSize: '0.75rem',
          color: isDark ? 'gray.400' : 'gray.500',
          mb: '0.75rem',
          margin: '0 0 0.75rem 0',
        })}
      >
        When {studentName} takes a game break, you can join in!
      </p>

      {/* Name */}
      <label
        className={css({
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: '500',
          color: isDark ? 'gray.300' : 'gray.600',
          mb: '0.25rem',
        })}
      >
        Your name
      </label>
      <input
        data-element="coplay-name-input"
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        placeholder="Mom, Dad, Teacher..."
        maxLength={20}
        className={css({
          width: '100%',
          padding: '0.5rem',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.300',
          bg: isDark ? 'gray.800' : 'white',
          color: isDark ? 'gray.100' : 'gray.800',
          fontSize: '0.875rem',
          mb: '0.75rem',
          _focus: { outline: 'none', borderColor: 'indigo.500' },
        })}
      />

      {/* Emoji */}
      <label
        className={css({
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: '500',
          color: isDark ? 'gray.300' : 'gray.600',
          mb: '0.25rem',
        })}
      >
        Avatar
      </label>
      <div
        data-element="coplay-emoji-grid"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          mb: '0.75rem',
        })}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => updateProfile({ emoji })}
            className={css({
              width: '2rem',
              height: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: '2px solid',
              borderColor: emoji === selectedEmoji ? 'indigo.500' : 'transparent',
              bg: emoji === selectedEmoji ? (isDark ? 'indigo.900' : 'indigo.100') : 'transparent',
              cursor: 'pointer',
              fontSize: '1.125rem',
              _hover: { bg: isDark ? 'gray.700' : 'gray.100' },
              transition: 'all 0.1s',
            })}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Color */}
      <label
        className={css({
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: '500',
          color: isDark ? 'gray.300' : 'gray.600',
          mb: '0.25rem',
        })}
      >
        Color
      </label>
      <div
        data-element="coplay-color-grid"
        className={css({
          display: 'flex',
          gap: '0.375rem',
          mb: '1rem',
        })}
      >
        {QUICK_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => updateProfile({ color })}
            className={css({
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '50%',
              border: '3px solid',
              borderColor:
                color === selectedColor ? (isDark ? 'white' : 'gray.800') : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.1s',
              _hover: { transform: 'scale(1.15)' },
            })}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Actions */}
      <div className={css({ display: 'flex', gap: '0.5rem' })}>
        <button
          data-action="save-coplay-profile"
          onClick={() => {
            const name = editName.trim()
            if (!name) return
            updateProfile({ name, emoji: selectedEmoji, color: selectedColor, isReady: true })
            setIsExpanded(false)
          }}
          disabled={!editName.trim()}
          className={css({
            flex: 1,
            padding: '0.5rem',
            borderRadius: '8px',
            border: 'none',
            bg: 'indigo.600',
            color: 'white',
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: 'pointer',
            _hover: { bg: 'indigo.700' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            transition: 'all 0.15s',
          })}
        >
          Ready to play!
        </button>
        {profile?.isReady && (
          <button
            data-action="clear-coplay-profile"
            onClick={() => {
              clearProfile()
              setEditName('')
              setIsExpanded(false)
            }}
            className={css({
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              bg: 'transparent',
              color: isDark ? 'gray.300' : 'gray.600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              _hover: { bg: isDark ? 'gray.800' : 'gray.100' },
            })}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
