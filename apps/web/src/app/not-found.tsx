'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { CustomBeadContent } from '@soroban/abacus-react'
import { AbacusReact, useAbacusDisplay } from '@soroban/abacus-react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../styled-system/css'
import { stack } from '../../styled-system/patterns'

// HTTP Status Code Easter Eggs with dynamic bead rendering
const STATUS_CODE_EASTER_EGGS: Record<
  number,
  { customBeadContent: CustomBeadContent; message: string }
> = {
  200: {
    customBeadContent: { type: 'emoji-function', value: (bead) => (bead.active ? '✅' : '⭕') },
    message: "Everything's counting perfectly!",
  },
  201: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => (bead.type === 'heaven' ? '🥚' : '🐣'),
    },
    message: 'Something new has been counted into existence!',
  },
  301: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => (bead.active ? '🚚' : '📦'),
    },
    message: 'These numbers have permanently relocated!',
  },
  400: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => (bead.active ? '❌' : '❓'),
    },
    message: "Those numbers don't make sense!",
  },
  401: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => (bead.active ? '🔒' : '🔑'),
    },
    message: 'These numbers are classified!',
  },
  403: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => (bead.type === 'heaven' ? '🚫' : '⛔'),
    },
    message: "You're not allowed to count these numbers!",
  },
  418: {
    customBeadContent: { type: 'emoji', value: '🫖' },
    message: "Perhaps you're pouring in the wrong direction?",
  },
  420: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => {
        const emojis = ['🌿', '🍃', '🌱', '🪴']
        return emojis[bead.position % emojis.length] || '🌿'
      },
    },
    message: 'Whoa dude, these numbers are like... relative, man',
  },
  451: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => (bead.active ? '🤐' : '▓'),
    },
    message: '[REDACTED] - This number has been removed by the Ministry of Mathematics',
  },
  500: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => {
        const fireEmojis = ['🔥', '💥', '⚠️']
        return bead.active ? fireEmojis[bead.position % fireEmojis.length] || '🔥' : '💨'
      },
    },
    message: 'The abacus has caught fire!',
  },
  503: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => {
        const tools = ['🔧', '🔨', '🪛', '⚙️']
        return bead.active ? tools[bead.placeValue % tools.length] || '🔧' : '⚪'
      },
    },
    message: "Pardon our dust, we're upgrading the beads!",
  },
  666: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => {
        const demons = ['😈', '👹', '👺', '💀']
        return bead.active ? demons[bead.position % demons.length] || '😈' : '🔥'
      },
    },
    message: 'Your soul now belongs to arithmetic!',
  },
  777: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => {
        const lucky = ['🎰', '🍀', '💰', '🎲', '⭐']
        return bead.active ? lucky[bead.placeValue % lucky.length] || '🎰' : '⚪'
      },
    },
    message: "Jackpot! You've mastered the soroban!",
  },
  911: {
    customBeadContent: {
      type: 'emoji-function',
      value: (bead) => {
        const emergency = ['🚨', '🚑', '🚒', '👮']
        return bead.active ? emergency[bead.position % emergency.length] || '🚨' : '⚫'
      },
    },
    message: 'EMERGENCY: Someone needs help with their math homework!',
  },
}

export default function NotFound() {
  const [abacusValue, setAbacusValue] = useState(404)
  const [activeEasterEgg, setActiveEasterEgg] = useState<number | null>(null)
  const { updateConfig, resetToDefaults } = useAbacusDisplay()

  // Easter egg activation - update global abacus config when special codes are entered
  useEffect(() => {
    const easterEgg = STATUS_CODE_EASTER_EGGS[abacusValue]

    if (easterEgg && activeEasterEgg !== abacusValue) {
      setActiveEasterEgg(abacusValue)

      // Update global abacus display config to use custom beads
      // This affects ALL abaci rendered in the app until page reload!
      updateConfig({
        beadShape: 'custom',
        customBeadContent: easterEgg.customBeadContent,
      })

      // Store active easter egg in window so it persists across navigation
      ;(window as any).__easterEggMode = abacusValue
    } else if (!easterEgg && activeEasterEgg !== null) {
      // User changed away from an easter egg code - reset to defaults
      setActiveEasterEgg(null)
      resetToDefaults()
      ;(window as any).__easterEggMode = null
    }
  }, [abacusValue, activeEasterEgg, updateConfig, resetToDefaults])

  return (
    <PageWithNav>
      <div
        className={css({
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'bg.canvas',
          padding: '2rem',
        })}
      >
        <div
          className={stack({
            gap: '2rem',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '600px',
          })}
        >
          {/* Interactive Abacus */}
          <div
            className={css({
              position: 'relative',
              width: '100%',
              maxWidth: { base: '90vw', sm: '500px', md: '600px', lg: '700px' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <div
              className={css({
                transform: {
                  base: 'scale(1.5)',
                  sm: 'scale(2)',
                  md: 'scale(2.5)',
                  lg: 'scale(3)',
                },
                transformOrigin: 'center',
              })}
            >
              <AbacusReact
                value={abacusValue}
                columns={3}
                showNumbers={false}
                onValueChange={setAbacusValue}
              />
            </div>
          </div>

          {/* Main message */}
          <div className={stack({ gap: '1rem' })}>
            <h1
              className={css({
                fontSize: '3rem',
                fontWeight: 'bold',
                color: 'text.primary',
                lineHeight: '1.2',
              })}
            >
              {activeEasterEgg
                ? STATUS_CODE_EASTER_EGGS[activeEasterEgg].message
                : "Oops! We've lost count."}
            </h1>
          </div>

          {/* Navigation links */}
          <div
            className={css({
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
            })}
          >
            <Link
              href="/"
              className={css({
                px: '2rem',
                py: '1rem',
                bg: 'blue.500',
                color: 'white',
                borderRadius: '0.5rem',
                fontWeight: 'semibold',
                textDecoration: 'none',
                transition: 'all 0.2s',
                _hover: {
                  bg: 'blue.600',
                  transform: 'translateY(-2px)',
                },
              })}
            >
              Home
            </Link>

            <Link
              href="/games"
              className={css({
                px: '2rem',
                py: '1rem',
                bg: 'purple.500',
                color: 'white',
                borderRadius: '0.5rem',
                fontWeight: 'semibold',
                textDecoration: 'none',
                transition: 'all 0.2s',
                _hover: {
                  bg: 'purple.600',
                  transform: 'translateY(-2px)',
                },
              })}
            >
              Games
            </Link>

            <Link
              href="/create"
              className={css({
                px: '2rem',
                py: '1rem',
                bg: 'green.500',
                color: 'white',
                borderRadius: '0.5rem',
                fontWeight: 'semibold',
                textDecoration: 'none',
                transition: 'all 0.2s',
                _hover: {
                  bg: 'green.600',
                  transform: 'translateY(-2px)',
                },
              })}
            >
              Create
            </Link>
          </div>

          {/* Easter egg hint */}
          <p
            className={css({
              fontSize: '0.875rem',
              color: 'text.secondary',
              opacity: 0.6,
              marginTop: '2rem',
            })}
          >
            Try other HTTP status codes...
          </p>
        </div>
      </div>
    </PageWithNav>
  )
}
