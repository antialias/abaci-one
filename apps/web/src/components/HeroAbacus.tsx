'use client'

import { useEffect, useRef } from 'react'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { useHomeHero } from '../contexts/HomeHeroContext'

export function HeroAbacus() {
  const { subtitle, abacusValue, setAbacusValue, setIsHeroVisible } = useHomeHero()
  const appConfig = useAbacusConfig()
  const heroRef = useRef<HTMLDivElement>(null)

  // Dark theme styles for the abacus (matching the mini abacus on homepage)
  const darkStyles = {
    columnPosts: {
      fill: 'rgba(255, 255, 255, 0.3)',
      stroke: 'rgba(255, 255, 255, 0.2)',
      strokeWidth: 2,
    },
    reckoningBar: {
      fill: 'rgba(255, 255, 255, 0.4)',
      stroke: 'rgba(255, 255, 255, 0.25)',
      strokeWidth: 3,
    },
    heavenBeads: {
      fill: 'rgba(196, 181, 253, 0.8)',
      stroke: 'rgba(167, 139, 250, 0.9)',
      strokeWidth: 2,
    },
    earthBeads: {
      fill: 'rgba(167, 139, 250, 0.7)',
      stroke: 'rgba(139, 92, 246, 0.9)',
      strokeWidth: 2,
    },
  }

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
          justifyContent: 'space-between',
          height: '100%',
          py: '12',
        })}
      >
        {/* Title and Subtitle Section */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4',
          })}
        >
          <h1
            className={css({
              fontSize: { base: '4xl', md: '6xl', lg: '7xl' },
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            })}
          >
            Abaci One
          </h1>
          <p
            className={css({
              fontSize: { base: 'xl', md: '2xl' },
              fontWeight: 'medium',
              color: 'purple.300',
              fontStyle: 'italic',
            })}
          >
            {subtitle.text}
          </p>
        </div>

        {/* Large Interactive Abacus - centered in remaining space */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '1',
            width: '100%',
            py: { base: '12', md: '16', lg: '20' },
          })}
        >
          <div
            className={css({
              transform: { base: 'scale(2)', md: 'scale(3)', lg: 'scale(4)' },
              transformOrigin: 'center center',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            })}
          >
            <AbacusReact
              value={abacusValue}
              columns={4}
              beadShape={appConfig.beadShape}
              showNumbers={true}
              customStyles={darkStyles}
            />
          </div>
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
