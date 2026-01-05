import type { Meta, StoryObj } from '@storybook/react'
import { useState, useCallback } from 'react'
import { SimpleLetterKeyboard } from './SimpleLetterKeyboard'
import { getNthNonSpaceLetter } from '../Validator'

/**
 * Normalize accented characters to their base ASCII letters.
 * e.g., 'é' → 'e', 'ñ' → 'n', 'ü' → 'u', 'ç' → 'c'
 * This allows users to type accented region names with a regular keyboard.
 */
function normalizeToBaseLetter(char: string): string {
  return char
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Demo component that mimics the actual game's letter confirmation UI.
 * This is a standalone demo that shows exactly what users see when
 * playing Know Your World in Learning mode.
 */
function LetterConfirmationGameDemo({
  regionName,
  flagEmoji,
  requiredLetters = 3,
  isDark = true,
}: {
  regionName: string
  flagEmoji?: string
  requiredLetters?: number
  isDark?: boolean
}) {
  const [confirmedCount, setConfirmedCount] = useState(0)

  // Get the next expected letter (skipping spaces)
  const nextLetterInfo = getNthNonSpaceLetter(regionName, confirmedCount)
  const isComplete = confirmedCount >= requiredLetters

  const handleKeyPress = useCallback(
    (letter: string) => {
      if (isComplete || !nextLetterInfo) return

      // Use normalizeToBaseLetter so 'e' matches 'é', 'n' matches 'ñ', etc.
      if (letter.toLowerCase() === normalizeToBaseLetter(nextLetterInfo.char)) {
        setConfirmedCount((c) => c + 1)
      }
    },
    [isComplete, nextLetterInfo]
  )

  // Render the region name with the exact same styling as the game
  const renderRegionName = () => {
    let nonSpaceIndex = 0
    return regionName.split('').map((char, index) => {
      const isSpace = char === ' '
      const currentNonSpaceIndex = isSpace ? -1 : nonSpaceIndex

      if (!isSpace) {
        nonSpaceIndex++
      }

      // Spaces are always shown at full opacity
      if (isSpace) {
        return (
          <span key={index} style={{ transition: 'all 0.15s ease-out' }}>
            {char}
          </span>
        )
      }

      // For letters, check confirmation status using non-space index
      const needsConfirmation = currentNonSpaceIndex < requiredLetters
      const isConfirmed = currentNonSpaceIndex < confirmedCount
      const isNextToConfirm = currentNonSpaceIndex === confirmedCount && !isComplete

      return (
        <span
          key={index}
          style={{
            transition: 'all 0.15s ease-out',
            opacity: needsConfirmation && !isConfirmed ? 0.4 : 1,
            textDecoration: isNextToConfirm ? 'underline' : 'none',
            textDecorationColor: isNextToConfirm ? (isDark ? '#60a5fa' : '#3b82f6') : undefined,
            textUnderlineOffset: isNextToConfirm ? '4px' : undefined,
          }}
        >
          {char}
        </span>
      )
    })
  }

  const bgColor = isDark ? '#0f172a' : '#f1f5f9'
  const mapBgColor = isDark ? '#1e293b' : '#e2e8f0'

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '600px',
        background: bgColor,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Map placeholder background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: mapBgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#475569' : '#94a3b8',
          fontSize: '48px',
        }}
      >
        🗺️
      </div>

      {/* Takeover overlay - mimics the actual game */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: isComplete ? 'none' : 'auto',
          transition: 'opacity 0.3s ease-out',
          opacity: isComplete ? 0 : 1,
        }}
      >
        {/* Dark backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        />

        {/* Content container */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '32px',
          }}
        >
          {/* Region name with flag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {flagEmoji && <span style={{ fontSize: '40px' }}>{flagEmoji}</span>}
            <span>{renderRegionName()}</span>
          </div>

          {/* Type instruction */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fcd34d',
              fontSize: '18px',
            }}
          >
            <span>⌨️</span>
            <span>Type the underlined letter{requiredLetters > 1 ? 's' : ''}</span>
          </div>

          {/* Progress indicator */}
          <div
            style={{
              color: '#94a3b8',
              fontSize: '14px',
            }}
          >
            {confirmedCount} of {requiredLetters} letters confirmed
          </div>
        </div>
      </div>

      {/* Virtual keyboard at bottom - always visible in stories */}
      {!isComplete && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '500px',
            padding: '8px',
            zIndex: 160,
          }}
        >
          <SimpleLetterKeyboard
            uppercase={nextLetterInfo?.char.toUpperCase() === nextLetterInfo?.char}
            isDark={true}
            forceShow={true}
            onKeyPress={handleKeyPress}
          />
        </div>
      )}

      {/* Success state */}
      {isComplete && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(34, 197, 94, 0.2)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div style={{ fontSize: '72px', marginBottom: '16px' }}>✅</div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            Name confirmed! Now find it on the map.
          </div>
          <button
            type="button"
            onClick={() => setConfirmedCount(0)}
            style={{
              marginTop: '16px',
              padding: '8px 24px',
              background: 'white',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

const meta: Meta<typeof LetterConfirmationGameDemo> = {
  title: 'Arcade/KnowYourWorld/LetterConfirmation',
  component: LetterConfirmationGameDemo,
  parameters: {
    layout: 'padded',
  },
}

export default meta
type Story = StoryObj<typeof LetterConfirmationGameDemo>

// Main demo - US Virgin Islands (tests space-skipping)
export const USVirginIslands: Story = {
  args: {
    regionName: 'US Virgin Islands',
    flagEmoji: '🇻🇮',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests space-skipping behavior:**
- Region: "US Virgin Islands"
- Required letters: U, S, V (skipping spaces)
- The keyboard shows uppercase U first, then S, then V
- Spaces in the name are displayed but not counted

This is the exact UI users see in Learning mode on mobile devices.
        `,
      },
    },
  },
}

// Other regions with spaces
export const NewZealand: Story = {
  args: {
    regionName: 'New Zealand',
    flagEmoji: '🇳🇿',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Type N, E, W (skipping the space after "New")',
      },
    },
  },
}

export const SouthAfrica: Story = {
  args: {
    regionName: 'South Africa',
    flagEmoji: '🇿🇦',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Type S, O, U (first 3 letters are before the space)',
      },
    },
  },
}

export const UnitedKingdom: Story = {
  args: {
    regionName: 'United Kingdom',
    flagEmoji: '🇬🇧',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Type U, N, I (first 3 letters)',
      },
    },
  },
}

// Simple region (no spaces)
export const France: Story = {
  args: {
    regionName: 'France',
    flagEmoji: '🇫🇷',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Simple case - type F, R, A',
      },
    },
  },
}

// Edge case - very short name
export const Chad: Story = {
  args: {
    regionName: 'Chad',
    flagEmoji: '🇹🇩',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Short name - type C, H, A',
      },
    },
  },
}

// Light mode variant
export const LightMode: Story = {
  args: {
    regionName: 'US Virgin Islands',
    flagEmoji: '🇻🇮',
    requiredLetters: 3,
    isDark: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Light mode variant of the UI',
      },
    },
  },
}

// ============================================
// ACCENTED CHARACTER TESTS
// These test the normalizeToBaseLetter function
// ============================================

export const CoteDIvoire: Story = {
  args: {
    regionName: "Côte d'Ivoire",
    flagEmoji: '🇨🇮',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests accented character normalization (ô → o):**
- Region: "Côte d'Ivoire"
- Required letters: C, O (from ô), T
- Type 'C', 'O', 'T' on a regular keyboard
- The 'ô' is normalized to 'o' so typing 'o' works
        `,
      },
    },
  },
}

export const SaoTome: Story = {
  args: {
    regionName: 'São Tomé and Príncipe',
    flagEmoji: '🇸🇹',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests accented character normalization (ã → a):**
- Region: "São Tomé and Príncipe"
- Required letters: S, A (from ã), O
- Type 'S', 'A', 'O' on a regular keyboard
- The 'ã' is normalized to 'a' so typing 'a' works
        `,
      },
    },
  },
}

export const Curacao: Story = {
  args: {
    regionName: 'Curaçao',
    flagEmoji: '🇨🇼',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests accented character normalization (ç → c):**
- Region: "Curaçao"
- Required letters: C, U, R
- Type 'C', 'U', 'R' on a regular keyboard
- (The ç comes later, after the first 3 letters)
        `,
      },
    },
  },
}

export const Reunion: Story = {
  args: {
    regionName: 'Réunion',
    flagEmoji: '🇷🇪',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests accented character normalization (é → e):**
- Region: "Réunion"
- Required letters: R, E (from é), U
- Type 'R', 'E', 'U' on a regular keyboard
- The 'é' is normalized to 'e' so typing 'e' works
        `,
      },
    },
  },
}

export const Mexico: Story = {
  args: {
    regionName: 'México',
    flagEmoji: '🇲🇽',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests accented character normalization (é → e):**
- Region: "México"
- Required letters: M, E (from é), X
- Type 'M', 'E', 'X' on a regular keyboard
- The 'é' is normalized to 'e' so typing 'e' works
        `,
      },
    },
  },
}

export const Peru: Story = {
  args: {
    regionName: 'Perú',
    flagEmoji: '🇵🇪',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests accented character normalization (ú → u):**
- Region: "Perú"
- Required letters: P, E, R
- Type 'P', 'E', 'R' on a regular keyboard
- (The ú comes at position 4, after the required 3)
        `,
      },
    },
  },
}

export const SaintBarthelemy: Story = {
  args: {
    regionName: 'Saint Barthélemy',
    flagEmoji: '🇧🇱',
    requiredLetters: 3,
    isDark: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Tests space-skipping AND accented characters:**
- Region: "Saint Barthélemy"
- Required letters: S, A, I
- Type 'S', 'A', 'I' on a regular keyboard
- (The é comes later in Barthélemy)
        `,
      },
    },
  },
}
