'use client'

import Link from 'next/link'
import { css } from '../../../styled-system/css'
import { grid } from '../../../styled-system/patterns'

export default function GamesPage() {
  return (
    <div className={css({
      minH: 'screen',
      bg: 'gradient-to-br',
      gradientFrom: 'blue.50',
      gradientTo: 'purple.50',
      py: '8'
    })}>
      <div className={css({ maxW: '6xl', mx: 'auto', px: { base: '4', md: '6' } })}>
        {/* Hero Section */}
        <div className={css({
          textAlign: 'center',
          mb: '12'
        })}>
          <h1 className={css({
            fontSize: { base: '3xl', md: '5xl' },
            fontWeight: 'bold',
            color: 'gray.900',
            mb: '4'
          })}>
            🎮 Soroban Games
          </h1>
          <p className={css({
            fontSize: 'xl',
            color: 'gray.600',
            maxW: '2xl',
            mx: 'auto'
          })}>
            Master the soroban through interactive games and challenges
          </p>
        </div>

        {/* Games Grid */}
        <div className={grid({ columns: { base: 1, md: 2 }, gap: '8' })}>

          {/* Speed Memory Quiz */}
          <Link href="/games/memory-quiz" className={css({
            display: 'block',
            textDecoration: 'none',
            transition: 'all 0.3s',
            _hover: { transform: 'translateY(-4px)' }
          })}>
            <div className={css({
              bg: 'white',
              rounded: 'xl',
              p: '8',
              shadow: 'lg',
              border: '1px solid',
              borderColor: 'gray.200',
              h: 'full'
            })}>
              <div className={css({
                w: '16',
                h: '16',
                bg: 'gradient-to-br',
                gradientFrom: 'green.400',
                gradientTo: 'green.600',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: '6',
                fontSize: '2xl'
              })}>
                🧠
              </div>
              <h3 className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
                mb: '3'
              })}>
                Speed Memory Quiz
              </h3>
              <p className={css({
                color: 'gray.600',
                mb: '4',
                lineHeight: 'relaxed'
              })}>
                Flash cards appear briefly - memorize the abacus patterns and input the numbers you remember. Test your visual memory and speed recognition skills.
              </p>
              <div className={css({
                display: 'flex',
                gap: '2',
                flexWrap: 'wrap'
              })}>
                <span className={css({
                  px: '3',
                  py: '1',
                  bg: 'green.100',
                  color: 'green.700',
                  rounded: 'full',
                  fontSize: 'sm',
                  fontWeight: 'medium'
                })}>
                  Memory Training
                </span>
                <span className={css({
                  px: '3',
                  py: '1',
                  bg: 'blue.100',
                  color: 'blue.700',
                  rounded: 'full',
                  fontSize: 'sm',
                  fontWeight: 'medium'
                })}>
                  Beginner Friendly
                </span>
              </div>
            </div>
          </Link>

          {/* Matching Pairs Game */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '8',
            shadow: 'lg',
            border: '1px solid',
            borderColor: 'gray.200',
            opacity: '0.6'
          })}>
            <div className={css({
              w: '16',
              h: '16',
              bg: 'gradient-to-br',
              gradientFrom: 'purple.400',
              gradientTo: 'purple.600',
              rounded: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: '6',
              fontSize: '2xl'
            })}>
              🃏
            </div>
            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900',
              mb: '3'
            })}>
              Matching Pairs
              <span className={css({
                fontSize: 'sm',
                color: 'orange.600',
                ml: '2',
                bg: 'orange.100',
                px: '2',
                py: '1',
                rounded: 'md'
              })}>
                Coming Soon
              </span>
            </h3>
            <p className={css({
              color: 'gray.600',
              mb: '4',
              lineHeight: 'relaxed'
            })}>
              Match abacus patterns with their corresponding numbers in this memory-style card game. Perfect for building pattern recognition skills.
            </p>
            <div className={css({
              display: 'flex',
              gap: '2',
              flexWrap: 'wrap'
            })}>
              <span className={css({
                px: '3',
                py: '1',
                bg: 'purple.100',
                color: 'purple.700',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'medium'
              })}>
                Pattern Matching
              </span>
              <span className={css({
                px: '3',
                py: '1',
                bg: 'gray.100',
                color: 'gray.700',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'medium'
              })}>
                All Levels
              </span>
            </div>
          </div>

          {/* Speed Complement Race */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '8',
            shadow: 'lg',
            border: '1px solid',
            borderColor: 'gray.200',
            opacity: '0.6'
          })}>
            <div className={css({
              w: '16',
              h: '16',
              bg: 'gradient-to-br',
              gradientFrom: 'red.400',
              gradientTo: 'red.600',
              rounded: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: '6',
              fontSize: '2xl'
            })}>
              🏃
            </div>
            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900',
              mb: '3'
            })}>
              Speed Complement Race
              <span className={css({
                fontSize: 'sm',
                color: 'orange.600',
                ml: '2',
                bg: 'orange.100',
                px: '2',
                py: '1',
                rounded: 'md'
              })}>
                Coming Soon
              </span>
            </h3>
            <p className={css({
              color: 'gray.600',
              mb: '4',
              lineHeight: 'relaxed'
            })}>
              Race against time to find complement pairs that add to 5 or 10. Multiple game modes including practice, sprint, and survival challenges.
            </p>
            <div className={css({
              display: 'flex',
              gap: '2',
              flexWrap: 'wrap'
            })}>
              <span className={css({
                px: '3',
                py: '1',
                bg: 'red.100',
                color: 'red.700',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'medium'
              })}>
                Speed Challenge
              </span>
              <span className={css({
                px: '3',
                py: '1',
                bg: 'yellow.100',
                color: 'yellow.700',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'medium'
              })}>
                Advanced
              </span>
            </div>
          </div>

          {/* Card Sorting Challenge */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '8',
            shadow: 'lg',
            border: '1px solid',
            borderColor: 'gray.200',
            opacity: '0.6'
          })}>
            <div className={css({
              w: '16',
              h: '16',
              bg: 'gradient-to-br',
              gradientFrom: 'indigo.400',
              gradientTo: 'indigo.600',
              rounded: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: '6',
              fontSize: '2xl'
            })}>
              🔢
            </div>
            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900',
              mb: '3'
            })}>
              Card Sorting Challenge
              <span className={css({
                fontSize: 'sm',
                color: 'orange.600',
                ml: '2',
                bg: 'orange.100',
                px: '2',
                py: '1',
                rounded: 'md'
              })}>
                Coming Soon
              </span>
            </h3>
            <p className={css({
              color: 'gray.600',
              mb: '4',
              lineHeight: 'relaxed'
            })}>
              Drag and drop abacus cards to sort them from lowest to highest value. Develop number sense and comparison skills.
            </p>
            <div className={css({
              display: 'flex',
              gap: '2',
              flexWrap: 'wrap'
            })}>
              <span className={css({
                px: '3',
                py: '1',
                bg: 'indigo.100',
                color: 'indigo.700',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'medium'
              })}>
                Sorting & Logic
              </span>
              <span className={css({
                px: '3',
                py: '1',
                bg: 'green.100',
                color: 'green.700',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'medium'
              })}>
                Intermediate
              </span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className={css({
          mt: '16',
          textAlign: 'center',
          bg: 'white',
          rounded: 'xl',
          p: '8',
          shadow: 'sm'
        })}>
          <h2 className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            mb: '4'
          })}>
            New to Soroban?
          </h2>
          <p className={css({
            color: 'gray.600',
            mb: '6'
          })}>
            Learn the basics with our comprehensive guide before diving into games
          </p>
          <Link
            href="/guide"
            className={css({
              display: 'inline-block',
              px: '6',
              py: '3',
              bg: 'blue.600',
              color: 'white',
              fontWeight: 'semibold',
              rounded: 'lg',
              textDecoration: 'none',
              transition: 'all',
              _hover: { bg: 'blue.700', transform: 'translateY(-1px)' }
            })}
          >
            Start Learning →
          </Link>
        </div>
      </div>
    </div>
  )
}