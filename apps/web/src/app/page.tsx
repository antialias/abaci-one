'use client'

import { css } from '../../styled-system/css'
import { container, stack, hstack } from '../../styled-system/patterns'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className={css({ minHeight: '100vh', bg: 'gradient-to-br from-brand.50 to-brand.100' })}>
      {/* Header */}
      <header className={css({ py: '6', px: '4' })}>
        <div className={container({ maxW: '7xl' })}>
          <nav className={hstack({ justify: 'space-between', alignItems: 'center' })}>
            <h1 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'brand.800'
            })}>
              🧮 Soroban Generator
            </h1>
            <div className={hstack({ gap: '4' })}>
              <Link
                href="/create"
                className={css({
                  px: '4',
                  py: '2',
                  bg: 'brand.600',
                  color: 'white',
                  rounded: 'lg',
                  fontWeight: 'medium',
                  transition: 'all',
                  _hover: { bg: 'brand.700', transform: 'translateY(-1px)' }
                })}
              >
                Create Flashcards
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className={container({ maxW: '6xl', px: '4' })}>
        <div className={stack({ gap: '12', py: '16', align: 'center', textAlign: 'center' })}>
          {/* Hero Content */}
          <div className={stack({ gap: '6', maxW: '4xl' })}>
            <h1 className={css({
              fontSize: { base: '4xl', md: '6xl' },
              fontWeight: 'bold',
              color: 'gray.900',
              lineHeight: 'tight'
            })}>
              Beautiful Soroban{' '}
              <span className={css({ color: 'brand.600' })}>
                Flashcards
              </span>
            </h1>

            <p className={css({
              fontSize: { base: 'lg', md: 'xl' },
              color: 'gray.600',
              maxW: '2xl',
              mx: 'auto'
            })}>
              Create stunning, educational flashcards with authentic Japanese abacus representations.
              Perfect for teachers, students, and mental math enthusiasts.
            </p>

            <div className={hstack({ gap: '4', justify: 'center', mt: '8' })}>
              <Link
                href="/create"
                className={css({
                  px: '8',
                  py: '4',
                  bg: 'brand.600',
                  color: 'white',
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  rounded: 'xl',
                  shadow: 'card',
                  transition: 'all',
                  _hover: {
                    bg: 'brand.700',
                    transform: 'translateY(-2px)',
                    shadow: 'modal'
                  }
                })}
              >
                ✨ Start Creating →
              </Link>

              <Link
                href="/gallery"
                className={css({
                  px: '8',
                  py: '4',
                  bg: 'white',
                  color: 'brand.700',
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  rounded: 'xl',
                  shadow: 'card',
                  border: '2px solid',
                  borderColor: 'brand.200',
                  transition: 'all',
                  _hover: {
                    borderColor: 'brand.400',
                    transform: 'translateY(-2px)'
                  }
                })}
              >
                🖼️ View Examples
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1', md: '3' },
            gap: '8',
            mt: '16',
            w: 'full'
          })}>
            <FeatureCard
              icon="🎨"
              title="Beautiful Design"
              description="Vector graphics, color schemes, authentic bead positioning"
            />
            <FeatureCard
              icon="⚡"
              title="Instant Generation"
              description="Create PDFs, interactive HTML, PNGs, and SVGs in seconds"
            />
            <FeatureCard
              icon="🎯"
              title="Educational Focus"
              description="Perfect for teachers, students, and soroban enthusiasts"
            />
          </div>
        </div>
      </main>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className={css({
      p: '8',
      bg: 'white',
      rounded: '2xl',
      shadow: 'card',
      textAlign: 'center',
      transition: 'all',
      _hover: {
        transform: 'translateY(-4px)',
        shadow: 'modal'
      }
    })}>
      <div className={css({
        fontSize: '4xl',
        mb: '4'
      })}>
        {icon}
      </div>
      <h3 className={css({
        fontSize: 'xl',
        fontWeight: 'bold',
        color: 'gray.900',
        mb: '3'
      })}>
        {title}
      </h3>
      <p className={css({
        color: 'gray.600',
        lineHeight: 'relaxed'
      })}>
        {description}
      </p>
    </div>
  )
}