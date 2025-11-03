'use client'

import { useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { HomeHeroContext } from '@/contexts/HomeHeroContext'
import { Z_INDEX } from '@/constants/zIndex'

export function MyAbacus() {
  const { isOpen, close, toggle } = useMyAbacus()
  const appConfig = useAbacusConfig()
  const pathname = usePathname()

  // Sync with hero context if on home page
  const homeHeroContext = useContext(HomeHeroContext)
  const [localAbacusValue, setLocalAbacusValue] = useState(1234)
  const abacusValue = homeHeroContext?.abacusValue ?? localAbacusValue
  const setAbacusValue = homeHeroContext?.setAbacusValue ?? setLocalAbacusValue

  // Determine display mode - only hero mode on actual home page
  const isOnHomePage =
    pathname === '/' ||
    pathname === '/en' ||
    pathname === '/de' ||
    pathname === '/ja' ||
    pathname === '/hi' ||
    pathname === '/es' ||
    pathname === '/la'
  const isHeroVisible = homeHeroContext?.isHeroVisible ?? false
  const isHeroMode = isOnHomePage && isHeroVisible && !isOpen

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, close])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Hero mode styles - white structural (from original HeroAbacus)
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

  // Trophy abacus styles - golden/premium look
  const trophyStyles = {
    columnPosts: {
      fill: '#fbbf24',
      stroke: '#f59e0b',
      strokeWidth: 3,
    },
    reckoningBar: {
      fill: '#fbbf24',
      stroke: '#f59e0b',
      strokeWidth: 4,
    },
  }

  return (
    <>
      {/* Blur backdrop - only visible when open */}
      {isOpen && (
        <div
          data-component="my-abacus-backdrop"
          style={{
            WebkitBackdropFilter: 'blur(12px)',
          }}
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            zIndex: Z_INDEX.MY_ABACUS_BACKDROP,
            animation: 'backdropFadeIn 0.4s ease-out',
          })}
          onClick={close}
        />
      )}

      {/* Close button - only visible when open */}
      {isOpen && (
        <button
          data-action="close-my-abacus"
          onClick={close}
          className={css({
            position: 'fixed',
            top: { base: '4', md: '8' },
            right: { base: '4', md: '8' },
            w: '12',
            h: '12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'full',
            color: 'white',
            fontSize: '2xl',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
            zIndex: Z_INDEX.MY_ABACUS + 1,
            animation: 'fadeIn 0.3s ease-out 0.2s both',
            _hover: {
              bg: 'rgba(255, 255, 255, 0.2)',
              borderColor: 'rgba(255, 255, 255, 0.4)',
              transform: 'scale(1.1)',
            },
          })}
        >
          ×
        </button>
      )}

      {/* Single abacus element that morphs between states */}
      <div
        data-component="my-abacus"
        data-mode={isOpen ? 'open' : isHeroMode ? 'hero' : 'button'}
        onClick={isOpen || isHeroMode ? undefined : toggle}
        className={css({
          position: isHeroMode ? 'absolute' : 'fixed',
          zIndex: Z_INDEX.MY_ABACUS,
          cursor: isOpen || isHeroMode ? 'default' : 'pointer',
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          // Three modes: hero (absolute - scrolls with document), button (fixed), open (fixed)
          ...(isOpen
            ? {
                // Open mode: fixed to center of viewport
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }
            : isHeroMode
              ? {
                  // Hero mode: absolute positioning - scrolls naturally with document
                  top: '60vh',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  // Button mode: fixed to bottom-right corner
                  bottom: { base: '4', md: '6' },
                  right: { base: '4', md: '6' },
                  transform: 'translate(0, 0)',
                }),
        })}
      >
        {/* Container that changes between hero, button, and open states */}
        <div
          className={css({
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isOpen || isHeroMode
              ? {
                  // Open/Hero state: no background, just the abacus
                  bg: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: '0',
                }
              : {
                  // Button state: button styling
                  bg: 'rgba(0, 0, 0, 0.7)',
                  backdropFilter: 'blur(8px)',
                  border: '3px solid rgba(251, 191, 36, 0.5)',
                  boxShadow: '0 8px 32px rgba(251, 191, 36, 0.4)',
                  borderRadius: 'xl',
                  w: { base: '80px', md: '100px' },
                  h: { base: '80px', md: '100px' },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 2s ease-in-out infinite',
                  _hover: {
                    transform: 'scale(1.1)',
                    boxShadow: '0 12px 48px rgba(251, 191, 36, 0.6)',
                    borderColor: 'rgba(251, 191, 36, 0.8)',
                  },
                }),
          })}
        >
          {/* The abacus itself - same element, scales between hero/button/open */}
          <div
            data-element="abacus-display"
            className={css({
              transform: isOpen
                ? { base: 'scale(2.5)', md: 'scale(3.5)', lg: 'scale(4.5)' }
                : isHeroMode
                  ? { base: 'scale(3)', md: 'scale(3.5)', lg: 'scale(4.25)' }
                  : 'scale(0.35)',
              transformOrigin: 'center center',
              transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), filter 0.6s ease',
              filter:
                isOpen || isHeroMode
                  ? 'drop-shadow(0 10px 40px rgba(251, 191, 36, 0.3))'
                  : 'drop-shadow(0 4px 12px rgba(251, 191, 36, 0.2))',
              pointerEvents: isOpen || isHeroMode ? 'auto' : 'none',
            })}
          >
            <AbacusReact
              key={isHeroMode ? 'hero' : isOpen ? 'open' : 'closed'}
              value={abacusValue}
              columns={isHeroMode ? 4 : 5}
              beadShape={appConfig.beadShape}
              showNumbers={isOpen || isHeroMode}
              interactive={isOpen || isHeroMode}
              animated={isOpen || isHeroMode}
              customStyles={isHeroMode ? structuralStyles : trophyStyles}
              onValueChange={setAbacusValue}
            />
          </div>
        </div>

        {/* Title and achievement info - only visible when open */}
        {isOpen && (
          <div
            className={css({
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              mt: { base: '16', md: '20', lg: '24' },
              textAlign: 'center',
              animation: 'fadeIn 0.5s ease-out 0.3s both',
              maxW: '600px',
              px: '8',
            })}
          >
            <h2
              className={css({
                fontSize: { base: '2xl', md: '3xl', lg: '4xl' },
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
                backgroundClip: 'text',
                color: 'transparent',
                mb: '3',
              })}
            >
              My Abacus
            </h2>
            <p
              className={css({
                fontSize: { base: 'md', md: 'lg' },
                color: 'gray.300',
                mb: '4',
                fontWeight: 'medium',
              })}
            >
              Your personal abacus grows with you
            </p>
            <p
              className={css({
                fontSize: { base: 'sm', md: 'md' },
                color: 'gray.400',
                lineHeight: '1.6',
              })}
            >
              Complete tutorials, play games, and earn achievements to unlock higher place values
            </p>
          </div>
        )}
      </div>

      {/* Keyframes for animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes backdropFadeIn {
              from { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
              to { opacity: 1; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pulse {
              0%, 100% { box-shadow: 0 8px 32px rgba(251, 191, 36, 0.4); }
              50% { box-shadow: 0 12px 48px rgba(251, 191, 36, 0.6); }
            }
          `,
        }}
      />
    </>
  )
}
