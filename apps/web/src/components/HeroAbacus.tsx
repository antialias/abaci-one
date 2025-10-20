'use client'

import { useEffect, useRef } from 'react'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { useHomeHero } from '../contexts/HomeHeroContext'

export function HeroAbacus() {
  const { subtitle, abacusValue, setAbacusValue, setIsHeroVisible, isAbacusLoaded } = useHomeHero()
  const appConfig = useAbacusConfig()
  const heroRef = useRef<HTMLDivElement>(null)

  // Styling for structural elements (solid, no translucency)
  const structuralStyles = {
    columnPosts: {
      fill: 'rgb(255, 255, 255)',
      stroke: 'rgb(200, 200, 200)',
      strokeWidth: 2,
    },
    reckoningBar: {
      fill: 'rgb(255, 255, 255)',
      stroke: 'rgb(200, 200, 200)',
      strokeWidth: 3,
    },
  }

  // Detect when hero scrolls out of view with hysteresis to prevent thrashing
  useEffect(() => {
    if (!heroRef.current) return

    let currentlyVisible = true // Start as visible (hero starts at top)

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Use hysteresis: different thresholds for showing vs hiding
        // When scrolling down (becoming invisible): hide when < 10% visible
        // When scrolling up (becoming visible): show when > 30% visible
        const ratio = entry.intersectionRatio

        if (currentlyVisible && ratio < 0.1) {
          // Was visible, now scrolled far enough to hide nav branding
          currentlyVisible = false
          setIsHeroVisible(false)
        } else if (!currentlyVisible && ratio > 0.3) {
          // Was hidden, now scrolled far enough to show nav branding
          currentlyVisible = true
          setIsHeroVisible(true)
        }
      },
      {
        threshold: [0, 0.1, 0.3, 0.5, 1],
      }
    )

    observer.observe(heroRef.current)

    return () => observer.disconnect()
  }, [setIsHeroVisible])

  return (
    <div
      ref={heroRef}
      className={css({
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        background:
          'linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(88, 28, 135, 0.3) 50%, rgba(17, 24, 39, 1) 100%)',
        position: 'relative',
        overflow: 'hidden',
        px: '4',
        py: '12',
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

      {/* Title and Subtitle Section - DIRECT CHILD */}
      <div
        className={css({
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          zIndex: 10,
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
            marginBottom: '8',
          })}
        >
          {subtitle.text}
        </p>
      </div>

      {/* Large Interactive Abacus - DIRECT CHILD */}
      <div
        className={css({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '1',
          width: '100%',
          zIndex: 10,
          opacity: isAbacusLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
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
            interactive={true}
            animated={true}
            customStyles={structuralStyles}
            onValueChange={setAbacusValue}
          />
        </div>
      </div>

      {/* Subtle hint to scroll - DIRECT CHILD */}
      <div
        className={css({
          position: 'relative',
          fontSize: 'sm',
          color: 'gray.400',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          animation: 'bounce 2s ease-in-out infinite',
          zIndex: 10,
        })}
      >
        <span>Scroll to explore</span>
        <span>↓</span>
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
