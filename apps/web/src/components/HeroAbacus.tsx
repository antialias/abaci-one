'use client'

import { useEffect, useRef } from 'react'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { useHomeHero } from '../contexts/HomeHeroContext'

export function HeroAbacus() {
  const { subtitle, abacusValue, setAbacusValue, setIsHeroVisible } = useHomeHero()
  const appConfig = useAbacusConfig()
  const heroRef = useRef<HTMLDivElement>(null)

  // Detect when hero scrolls out of view
  useEffect(() => {
    if (!heroRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Hero is visible if more than 20% is in viewport
        setIsHeroVisible(entry.intersectionRatio > 0.2)
      },
      {
        threshold: [0, 0.2, 0.5, 1],
      }
    )

    observer.observe(heroRef.current)

    return () => observer.disconnect()
  }, [setIsHeroVisible])

  // Auto-cycle through random numbers (optional - user can also interact)
  useEffect(() => {
    const interval = setInterval(() => {
      const randomNum = Math.floor(Math.random() * 10000) // 0-9999
      setAbacusValue(randomNum)
    }, 4000)

    return () => clearInterval(interval)
  }, [setAbacusValue])

  return (
    <div
      ref={heroRef}
      className={css({
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(88, 28, 135, 0.3) 50%, rgba(17, 24, 39, 1) 100%)',
        position: 'relative',
        overflow: 'hidden',
        px: '4',
      })}
    >
      {/* Background pattern */}
      <div
        className={css({
          position: 'absolute',
          inset: 0,
          opacity: 0.1,
          backgroundImage:
            'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        })}
      />

      {/* Content */}
      <div
        className={css({
          position: 'relative',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8',
        })}
      >
        {/* Title */}
        <h1
          className={css({
            fontSize: { base: '4xl', md: '6xl', lg: '7xl' },
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            mb: '2',
          })}
        >
          🧮 Abaci One
        </h1>

        {/* Subtitle */}
        <p
          className={css({
            fontSize: { base: 'xl', md: '2xl' },
            fontWeight: 'medium',
            color: 'purple.300',
            fontStyle: 'italic',
            mb: '8',
          })}
        >
          {subtitle.text}
        </p>

        {/* Large Interactive Abacus */}
        <div
          className={css({
            transform: { base: 'scale(1.5)', md: 'scale(2)', lg: 'scale(2.5)' },
            transformOrigin: 'center center',
            mb: { base: '12', md: '16', lg: '20' },
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          })}
        >
          <AbacusReact
            value={abacusValue}
            columns={4}
            beadShape={appConfig.beadShape}
            showNumbers={true}
          />
        </div>

        {/* Subtle hint to scroll */}
        <div
          className={css({
            fontSize: 'sm',
            color: 'gray.400',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2',
            animation: 'bounce 2s ease-in-out infinite',
          })}
        >
          <span>Scroll to explore</span>
          <span>↓</span>
        </div>
      </div>

      {/* Keyframes for bounce animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes bounce {
              0%, 100% {
                transform: translateY(0);
                opacity: 0.7;
              }
              50% {
                transform: translateY(-10px);
                opacity: 1;
              }
            }
          `,
        }}
      />
    </div>
  )
}
