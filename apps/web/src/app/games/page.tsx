'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { css } from '../../../styled-system/css'
import { grid } from '../../../styled-system/patterns'
import { useUserProfile } from '../../contexts/UserProfileContext'
import { useGameMode } from '../../contexts/GameModeContext'
import { FullscreenProvider, useFullscreen } from '../../contexts/FullscreenContext'

function GamesPageContent() {
  const { profile } = useUserProfile()
  const { gameMode, getActivePlayer } = useGameMode()
  const { enterFullscreen } = useFullscreen()
  const router = useRouter()

  const handleGameClick = (gameType: string) => {
    // Navigate directly to games using the centralized game mode
    if (gameType === 'memory-lightning') {
      window.location.href = '/games/memory-quiz'
    } else if (gameType === 'battle-arena') {
      window.location.href = '/games/matching'
    }
  }

  return (
    <div className={css({
      minH: 'screen',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      py: '8',
      position: 'relative'
    })}>
      {/* Subtle background pattern */}
      <div className={css({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.05) 0%, transparent 50%)',
        pointerEvents: 'none'
      })} />

      <div className={css({ maxW: '6xl', mx: 'auto', px: { base: '4', md: '6' }, position: 'relative' })}>
        {/* Hero Section */}
        <div className={css({
          textAlign: 'center',
          mb: '12'
        })}>
          <div className={css({
            mb: '6'
          })}>
            <h1 className={css({
              fontSize: { base: '4xl', md: '6xl' },
              fontWeight: 'black',
              background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
              backgroundClip: 'text',
              color: 'transparent',
              mb: '4',
              letterSpacing: 'tight',
              position: 'relative',
              display: 'inline-block'
            })}>
              🕹️ Soroban Arcade
            </h1>

            {/* Floating score indicators */}
            <div className={css({
              position: 'relative',
              display: 'inline-block',
              ml: '4'
            })}>
              <div className={css({
                position: 'absolute',
                top: '-20px',
                right: '-40px',
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                color: 'white',
                px: '3',
                py: '1',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'bold',
                animation: 'float 3s ease-in-out infinite',
                boxShadow: '0 4px 15px rgba(251, 191, 36, 0.3)'
              })}>
                +100 XP
              </div>
              <div className={css({
                position: 'absolute',
                top: '10px',
                right: '-60px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                px: '2',
                py: '1',
                rounded: 'full',
                fontSize: 'xs',
                fontWeight: 'bold',
                animation: 'float 3s ease-in-out infinite 1s',
                boxShadow: '0 3px 10px rgba(239, 68, 68, 0.3)'
              })}>
                STREAK!
              </div>
            </div>
          </div>

          <p className={css({
            fontSize: { base: 'xl', md: '2xl' },
            color: 'gray.700',
            maxW: '2xl',
            mx: 'auto',
            fontWeight: 'medium',
            mb: '6'
          })}>
            Level up your mental math powers in the most fun way possible!
          </p>

          {/* Playful stats */}
          <div className={css({
            display: 'flex',
            justifyContent: 'center',
            gap: '8',
            flexWrap: 'wrap',
            mb: '2'
          })}>
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              background: 'rgba(255, 255, 255, 0.8)',
              px: '4',
              py: '2',
              rounded: 'full',
              border: '1px solid',
              borderColor: 'gray.200'
            })}>
              <span className={css({ fontSize: 'lg' })}>🎯</span>
              <span className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'gray.700' })}>
                Challenge Your Brain
              </span>
            </div>
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              background: 'rgba(255, 255, 255, 0.8)',
              px: '4',
              py: '2',
              rounded: 'full',
              border: '1px solid',
              borderColor: 'gray.200'
            })}>
              <span className={css({ fontSize: 'lg' })}>⚡</span>
              <span className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'gray.700' })}>
                Build Speed
              </span>
            </div>
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              background: 'rgba(255, 255, 255, 0.8)',
              px: '4',
              py: '2',
              rounded: 'full',
              border: '1px solid',
              borderColor: 'gray.200'
            })}>
              <span className={css({ fontSize: 'lg' })}>🏆</span>
              <span className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'gray.700' })}>
                Unlock Achievements
              </span>
            </div>
          </div>
        </div>

        {/* Enter Arcade Button */}
        <div className={css({
          mb: '16',
          textAlign: 'center'
        })}>
          <div className={css({
            background: 'white',
            rounded: '3xl',
            p: '8',
            border: '2px solid',
            borderColor: 'gray.200',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          })}>
            {/* Gradient background */}
            <div className={css({
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fef3c7 100%)',
              opacity: 0.5
            })} />

            <div className={css({
              position: 'relative',
              zIndex: 1
            })}>
              <h2 className={css({
                fontSize: { base: '2xl', md: '3xl' },
                fontWeight: 'bold',
                color: 'gray.900',
                mb: '4'
              })}>
                🏟️ Ready for the Arena?
              </h2>

              <p className={css({
                fontSize: 'lg',
                color: 'gray.700',
                mb: '8',
                maxW: 'xl',
                mx: 'auto'
              })}>
                Select your champions, choose your battles, and dive into full-screen arcade action!
              </p>

              <button
                onClick={async () => {
                  try {
                    await enterFullscreen()
                    // Set a flag so arcade knows to enter fullscreen
                    sessionStorage.setItem('enterArcadeFullscreen', 'true')
                    router.push('/arcade')
                  } catch (error) {
                    console.error('Failed to enter fullscreen:', error)
                    // Navigate anyway if fullscreen fails
                    sessionStorage.setItem('enterArcadeFullscreen', 'true')
                    router.push('/arcade')
                  }
                }}
                className={css({
                  px: '12',
                  py: '6',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  fontSize: '2xl',
                  fontWeight: 'bold',
                  rounded: '2xl',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    transform: 'translateY(-4px) scale(1.05)',
                    boxShadow: '0 20px 50px rgba(59, 130, 246, 0.4)',
                    '& .button-glow': {
                      opacity: 1
                    }
                  },
                  _active: {
                    transform: 'translateY(-2px) scale(1.02)'
                  }
                })}
              >
                {/* Button glow effect */}
                <div className={css({
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1))',
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                }) + ' button-glow'} />

                <span className={css({ position: 'relative', zIndex: 1 })}>
                  🚀 ENTER ARCADE
                </span>
              </button>

              <p className={css({
                fontSize: 'sm',
                color: 'gray.600',
                mt: '4'
              })}>
                Full-screen experience with immersive gameplay
              </p>
            </div>
          </div>
        </div>

        {/* Character Showcase Header */}
        <div className={css({
          mb: '16'
        })}>
          <div className={css({
            textAlign: 'center',
            mb: '8'
          })}>
            <h2 className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              color: 'gray.800',
              mb: '2'
            })}>
              🏆 Your Arcade Champions
            </h2>
            <p className={css({
              color: 'gray.600',
              fontSize: 'lg'
            })}>
              Track your progress and achievements!
            </p>
          </div>

          <div className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)' },
            gap: '6',
            maxW: '4xl',
            mx: 'auto'
          })}>
            {/* Player 1 Character Card */}
            <div className={css({
              position: 'relative',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              rounded: '2xl',
              p: '6',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              boxShadow: '0 20px 40px rgba(59, 130, 246, 0.1)',
              transition: 'all 0.4s ease',
              animation: 'characterFloat 4s ease-in-out infinite',
              _hover: {
                transform: 'translateY(-5px) scale(1.02)',
                boxShadow: '0 25px 50px rgba(59, 130, 246, 0.15)',
                '& .character-emoji': {
                  transform: 'scale(1.1) rotate(5deg)',
                  animation: 'characterBounce 0.6s ease-in-out'
                }
              }
            })}>
              {/* Player 1 Gradient Border */}
              <div className={css({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                borderRadius: '16px 16px 0 0'
              })} />

              {/* Character Display */}
              <div className={css({
                textAlign: 'center',
                mb: '4'
              })}>
                <div className={css({
                  fontSize: '4xl',
                  mb: '2',
                  transition: 'all 0.3s ease'
                }) + ' character-emoji'}>
                  {profile.player1Emoji}
                </div>
                <h3 className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: 'blue.800'
                })}>
                  {profile.player1Name}
                </h3>
              </div>

              {/* Stats */}
              <div className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '3'
              })}>
                <div className={css({
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                  p: '3',
                  rounded: 'lg',
                  border: '1px solid',
                  borderColor: 'blue.200'
                })}>
                  <div className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'blue.800'
                  })}>
                    {profile.gamesPlayed}
                  </div>
                  <div className={css({
                    fontSize: 'xs',
                    color: 'blue.600',
                    fontWeight: 'semibold'
                  })}>
                    GAMES PLAYED
                  </div>
                </div>

                <div className={css({
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                  p: '3',
                  rounded: 'lg',
                  border: '1px solid',
                  borderColor: 'yellow.200'
                })}>
                  <div className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'yellow.800'
                  })}>
                    {profile.totalWins}
                  </div>
                  <div className={css({
                    fontSize: 'xs',
                    color: 'yellow.700',
                    fontWeight: 'semibold'
                  })}>
                    VICTORIES
                  </div>
                </div>
              </div>

              {/* Level Progress */}
              <div className={css({
                mt: '4'
              })}>
                <div className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: '2'
                })}>
                  <span className={css({
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    color: 'blue.700'
                  })}>
                    Level {Math.floor(profile.gamesPlayed / 5) + 1}
                  </span>
                  <span className={css({
                    fontSize: 'xs',
                    color: 'blue.600'
                  })}>
                    {profile.gamesPlayed % 5}/5 XP
                  </span>
                </div>
                <div className={css({
                  w: 'full',
                  h: '2',
                  bg: 'blue.200',
                  rounded: 'full',
                  overflow: 'hidden'
                })}>
                  <div className={css({
                    h: 'full',
                    background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                    rounded: 'full',
                    transition: 'width 0.5s ease',
                    width: `${(profile.gamesPlayed % 5) * 20}%`
                  })} />
                </div>
              </div>

              {/* Quick Customize Button */}
              <button className={css({
                position: 'absolute',
                top: '3',
                right: '3',
                w: '8',
                h: '8',
                background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'sm',
                border: '1px solid',
                borderColor: 'gray.300',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                _hover: {
                  transform: 'scale(1.1)',
                  background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)'
                }
              })}>
                ⚙️
              </button>
            </div>

            {/* Player 2 Character Card */}
            <div className={css({
              position: 'relative',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              rounded: '2xl',
              p: '6',
              border: '2px solid rgba(139, 92, 246, 0.3)',
              boxShadow: '0 20px 40px rgba(139, 92, 246, 0.1)',
              transition: 'all 0.4s ease',
              animation: 'characterFloat 4s ease-in-out infinite 2s',
              _hover: {
                transform: 'translateY(-5px) scale(1.02)',
                boxShadow: '0 25px 50px rgba(139, 92, 246, 0.15)',
                '& .character-emoji': {
                  transform: 'scale(1.1) rotate(-5deg)',
                  animation: 'characterBounce 0.6s ease-in-out'
                }
              }
            })}>
              {/* Player 2 Gradient Border */}
              <div className={css({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
                borderRadius: '16px 16px 0 0'
              })} />

              {/* Character Display */}
              <div className={css({
                textAlign: 'center',
                mb: '4'
              })}>
                <div className={css({
                  fontSize: '4xl',
                  mb: '2',
                  transition: 'all 0.3s ease'
                }) + ' character-emoji'}>
                  {profile.player2Emoji}
                </div>
                <h3 className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: 'purple.800'
                })}>
                  {profile.player2Name}
                </h3>
              </div>

              {/* Stats */}
              <div className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '3'
              })}>
                <div className={css({
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #e9d5ff, #ddd6fe)',
                  p: '3',
                  rounded: 'lg',
                  border: '1px solid',
                  borderColor: 'purple.200'
                })}>
                  <div className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'purple.800'
                  })}>
                    {profile.gamesPlayed}
                  </div>
                  <div className={css({
                    fontSize: 'xs',
                    color: 'purple.600',
                    fontWeight: 'semibold'
                  })}>
                    GAMES PLAYED
                  </div>
                </div>

                <div className={css({
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                  p: '3',
                  rounded: 'lg',
                  border: '1px solid',
                  borderColor: 'green.200'
                })}>
                  <div className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'green.800'
                  })}>
                    {Math.floor(profile.totalWins / 2)}
                  </div>
                  <div className={css({
                    fontSize: 'xs',
                    color: 'green.700',
                    fontWeight: 'semibold'
                  })}>
                    VICTORIES
                  </div>
                </div>
              </div>

              {/* Level Progress */}
              <div className={css({
                mt: '4'
              })}>
                <div className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: '2'
                })}>
                  <span className={css({
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    color: 'purple.700'
                  })}>
                    Level {Math.floor(profile.gamesPlayed / 5) + 1}
                  </span>
                  <span className={css({
                    fontSize: 'xs',
                    color: 'purple.600'
                  })}>
                    {profile.gamesPlayed % 5}/5 XP
                  </span>
                </div>
                <div className={css({
                  w: 'full',
                  h: '2',
                  bg: 'purple.200',
                  rounded: 'full',
                  overflow: 'hidden'
                })}>
                  <div className={css({
                    h: 'full',
                    background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
                    rounded: 'full',
                    transition: 'width 0.5s ease',
                    width: `${(profile.gamesPlayed % 5) * 20}%`
                  })} />
                </div>
              </div>

              {/* Quick Customize Button */}
              <button className={css({
                position: 'absolute',
                top: '3',
                right: '3',
                w: '8',
                h: '8',
                background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'sm',
                border: '1px solid',
                borderColor: 'gray.300',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                _hover: {
                  transform: 'scale(1.1)',
                  background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)'
                }
              })}>
                ⚙️
              </button>
            </div>
          </div>
        </div>

        {/* Character vs Character Dashboard */}
        <div className={css({
          mb: '12'
        })}>
          <div className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', lg: 'repeat(3, 1fr)' },
            gap: '6',
            maxW: '7xl',
            mx: 'auto'
          })}>
            {/* Head-to-Head Stats */}
            <div className={css({
              background: 'white',
              backdropFilter: 'blur(10px)',
              rounded: '2xl',
              p: '6',
              border: '1px solid',
              borderColor: 'gray.200',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              _hover: {
                transform: 'translateY(-2px)',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.15)'
              }
            })}>
              <div className={css({
                textAlign: 'center',
                mb: '4'
              })}>
                <h3 className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: 'gray.800',
                  mb: '2'
                })}>
                  🥊 Head-to-Head
                </h3>
                <p className={css({
                  fontSize: 'sm',
                  color: 'gray.600'
                })}>
                  Battle Record
                </p>
              </div>

              <div className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: '4'
              })}>
                <div className={css({
                  textAlign: 'center'
                })}>
                  <div className={css({
                    fontSize: '2xl',
                    mb: '1'
                  })}>
                    {profile.player1Emoji}
                  </div>
                  <div className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'blue.600'
                  })}>
                    {Math.floor(profile.totalWins * 0.6)}
                  </div>
                  <div className={css({
                    fontSize: 'xs',
                    color: 'blue.600',
                    fontWeight: 'semibold'
                  })}>
                    WINS
                  </div>
                </div>

                <div className={css({
                  textAlign: 'center',
                  mx: '4'
                })}>
                  <div className={css({
                    fontSize: 'sm',
                    color: 'gray.500',
                    fontWeight: 'semibold'
                  })}>
                    VS
                  </div>
                </div>

                <div className={css({
                  textAlign: 'center'
                })}>
                  <div className={css({
                    fontSize: '2xl',
                    mb: '1'
                  })}>
                    {profile.player2Emoji}
                  </div>
                  <div className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'purple.600'
                  })}>
                    {Math.floor(profile.totalWins * 0.4)}
                  </div>
                  <div className={css({
                    fontSize: 'xs',
                    color: 'purple.600',
                    fontWeight: 'semibold'
                  })}>
                    WINS
                  </div>
                </div>
              </div>

              <div className={css({
                textAlign: 'center',
                fontSize: 'sm',
                color: 'gray.600'
              })}>
                Last played: Memory Lightning ⚡
              </div>
            </div>

            {/* Recent Achievements */}
            <div className={css({
              background: 'white',
              backdropFilter: 'blur(10px)',
              rounded: '2xl',
              p: '6',
              border: '1px solid',
              borderColor: 'gray.200',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              _hover: {
                transform: 'translateY(-2px)',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.15)'
              }
            })}>
              <div className={css({
                textAlign: 'center',
                mb: '4'
              })}>
                <h3 className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: 'gray.800',
                  mb: '2'
                })}>
                  🏆 Recent Achievements
                </h3>
                <p className={css({
                  fontSize: 'sm',
                  color: 'gray.600'
                })}>
                  Latest unlocks
                </p>
              </div>

              <div className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '3'
              })}>
                <div className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  p: '3',
                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                  rounded: 'lg',
                  border: '1px solid',
                  borderColor: 'yellow.200'
                })}>
                  <span className={css({ fontSize: 'lg' })}>{profile.player1Emoji}</span>
                  <div>
                    <div className={css({
                      fontSize: 'sm',
                      fontWeight: 'semibold',
                      color: 'yellow.800'
                    })}>
                      🔥 First Win!
                    </div>
                    <div className={css({
                      fontSize: 'xs',
                      color: 'yellow.700'
                    })}>
                      Victory in Battle Arena
                    </div>
                  </div>
                </div>

                <div className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  p: '3',
                  background: 'linear-gradient(135deg, #e9d5ff, #ddd6fe)',
                  rounded: 'lg',
                  border: '1px solid',
                  borderColor: 'purple.200'
                })}>
                  <span className={css({ fontSize: 'lg' })}>{profile.player2Emoji}</span>
                  <div>
                    <div className={css({
                      fontSize: 'sm',
                      fontWeight: 'semibold',
                      color: 'purple.800'
                    })}>
                      ⚡ Speed Demon
                    </div>
                    <div className={css({
                      fontSize: 'xs',
                      color: 'purple.700'
                    })}>
                      Sub-5 second memory
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Challenge System */}
            <div className={css({
              background: 'white',
              backdropFilter: 'blur(10px)',
              rounded: '2xl',
              p: '6',
              border: '1px solid',
              borderColor: 'gray.200',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              _hover: {
                transform: 'translateY(-2px)',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.15)'
              }
            })}>
              <div className={css({
                textAlign: 'center',
                mb: '4'
              })}>
                <h3 className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: 'gray.800',
                  mb: '2'
                })}>
                  ⚔️ Active Challenges
                </h3>
                <p className={css({
                  fontSize: 'sm',
                  color: 'gray.600'
                })}>
                  Friendly competition
                </p>
              </div>

              <div className={css({
                background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                rounded: 'lg',
                p: '4',
                border: '1px solid',
                borderColor: 'blue.200',
                mb: '4'
              })}>
                <div className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  mb: '2'
                })}>
                  <span className={css({ fontSize: 'lg' })}>{profile.player1Emoji}</span>
                  <span className={css({
                    fontSize: 'sm',
                    color: 'blue.800',
                    fontWeight: 'semibold'
                  })}>
                    challenges
                  </span>
                  <span className={css({ fontSize: 'lg' })}>{profile.player2Emoji}</span>
                </div>
                <div className={css({
                  fontSize: 'sm',
                  color: 'blue.700',
                  fontWeight: 'medium'
                })}>
                  "Beat my Memory Lightning score!"
                </div>
                <div className={css({
                  fontSize: 'xs',
                  color: 'blue.600',
                  mt: '1'
                })}>
                  Current best: 850 points
                </div>
              </div>

              <button className={css({
                w: 'full',
                py: '3',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                rounded: 'lg',
                fontSize: 'sm',
                fontWeight: 'semibold',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                _hover: {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)'
                }
              })}>
                🎯 Create New Challenge
              </button>
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
            🚀 Ready to Begin Your Journey?
          </h2>
          <p className={css({
            color: 'gray.600',
            mb: '6'
          })}>
            Start with our interactive guide and unlock the secrets of the ancient calculator!
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

// Refined animations for the sweet spot design
const globalAnimations = `
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
}

@keyframes gradientSlide {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
  }
}

@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translate3d(0, 0, 0);
  }
  40%, 43% {
    transform: translate3d(0, -5px, 0);
  }
  70% {
    transform: translate3d(0, -3px, 0);
  }
  90% {
    transform: translate3d(0, -1px, 0);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes characterFloat {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  33% {
    transform: translateY(-8px) rotate(1deg);
  }
  66% {
    transform: translateY(-4px) rotate(-1deg);
  }
}

@keyframes characterBounce {
  0% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.05) rotate(3deg);
  }
  50% {
    transform: scale(1.1) rotate(0deg);
  }
  75% {
    transform: scale(1.05) rotate(-3deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes slideInUp {
  0% {
    opacity: 0;
    transform: translateY(60px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
`

export default function GamesPage() {
  return <GamesPageContent />
}

// Inject refined animations into the page
if (typeof document !== 'undefined' && !document.getElementById('games-page-animations')) {
  const style = document.createElement('style')
  style.id = 'games-page-animations'
  style.textContent = globalAnimations
  document.head.appendChild(style)
}