'use client'

import { useState } from 'react'
import Link from 'next/link'
import { css } from '../../../styled-system/css'
import { grid } from '../../../styled-system/patterns'
import { useUserProfile } from '../../contexts/UserProfileContext'
import { useGameMode } from '../../contexts/GameModeContext'
import { ChampionArena } from '../../components/ChampionArena'

export default function GamesPage() {
  const { profile } = useUserProfile()
  const { gameMode, getActivePlayer } = useGameMode()

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

        {/* Champion Arena - Drag & Drop Interface */}
        <div className={css({
          mb: '16'
        })}>
          <ChampionArena onConfigurePlayer={() => {}} />
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

        {/* Games Grid */}
        <div className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)' },
          gap: '8',
          mb: '16'
        })}>

          {/* Speed Memory Quiz */}
          <div onClick={() => handleGameClick('memory-lightning')} className={css({
            display: 'block',
            textDecoration: 'none',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            _hover: {
              transform: 'translateY(-8px) scale(1.02)',
              '& .card-stack': {
                transform: 'rotateY(5deg)'
              },
              '& .timer-pulse': {
                animationDuration: '0.8s'
              },
              '& .speech-bubble': {
                opacity: 1,
                transform: 'translateY(0) scale(1)'
              }
            }
          })}>
            <div className={css({
              bg: 'white',
              rounded: '2xl',
              p: '8',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
              border: '1px solid',
              borderColor: 'green.200',
              h: 'full',
              position: 'relative',
              overflow: 'visible'
            })}>
              {/* Character Recommendation Speech Bubble */}
              <div className={css({
                position: 'absolute',
                top: '-10px',
                left: '16px',
                background: 'white',
                border: '2px solid',
                borderColor: 'green.300',
                borderRadius: '16px',
                px: '4',
                py: '2',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.15)',
                opacity: 0,
                transform: 'translateY(-10px) scale(0.95)',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                maxW: '200px',
                zIndex: 10,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: '-8px',
                  left: '20px',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid',
                  borderTopColor: 'green.300'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  bottom: '-6px',
                  left: '22px',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid white'
                }
              })} style={{ className: 'speech-bubble' }}>
                <div className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: 'green.800'
                })}>
                  <span className={css({ fontSize: 'lg' })}>{profile.player1Emoji}</span>
                  <span>"Memory Lightning is my jam! ⚡"</span>
                </div>
              </div>

              {/* Subtle top accent */}
              <div className={css({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: '16px 16px 0 0'
              })} />

              {/* Game representation: Flash card effect */}
              <div className={css({
                position: 'relative',
                w: '18',
                h: '18',
                mb: '6',
                perspective: '1000px'
              })} style={{ className: 'card-stack' }}>
                {/* Back card (slightly offset) */}
                <div className={css({
                  position: 'absolute',
                  top: '3px',
                  left: '3px',
                  w: 'full',
                  h: 'full',
                  bg: 'gray.400',
                  rounded: 'lg',
                  transition: 'all 0.3s ease'
                })} />

                {/* Front card with abacus */}
                <div className={css({
                  position: 'relative',
                  w: 'full',
                  h: 'full',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  rounded: 'lg',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2xl',
                  color: 'white',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.3s ease'
                })}>
                  🧮
                </div>

                {/* Timer indicator */}
                <div className={css({
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  w: '8',
                  h: '8',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  rounded: 'full',
                  animation: 'pulse 1.5s infinite',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
                })} style={{ className: 'timer-pulse' }} />
              </div>

              <h3 className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
                mb: '3'
              })}>
                Memory Lightning ⚡
              </h3>

              <p className={css({
                color: 'gray.600',
                mb: '6',
                lineHeight: 'relaxed'
              })}>
                Blink and you'll miss it! Cards flash faster than lightning - can you capture the patterns in your mind before they vanish? Perfect for building superhuman visual memory.
              </p>

              <div className={css({
                display: 'flex',
                gap: '2',
                flexWrap: 'wrap'
              })}>
                <span className={css({
                  px: '4',
                  py: '2',
                  background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                  color: 'green.800',
                  rounded: 'full',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  border: '1px solid',
                  borderColor: 'green.200'
                })}>
                  🧠 Memory Training
                </span>
                <span className={css({
                  px: '4',
                  py: '2',
                  background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                  color: 'blue.800',
                  rounded: 'full',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  border: '1px solid',
                  borderColor: 'blue.200'
                })}>
                  ⭐ Beginner Friendly
                </span>
              </div>
            </div>
          </div>

          {/* Matching Pairs Game */}
          <div onClick={() => handleGameClick('battle-arena')} className={css({
            display: 'block',
            textDecoration: 'none',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            _hover: {
              transform: 'translateY(-8px) scale(1.02)',
              '& .memory-grid': {
                '& .flipped-card': {
                  transform: 'rotateY(180deg) scale(1.1)'
                },
                '& .matched-card': {
                  animation: 'glow 0.8s ease-in-out'
                }
              },
              '& .new-badge': {
                animation: 'bounce 0.6s ease-in-out'
              },
              '& .speech-bubble': {
                opacity: 1,
                transform: 'translateY(0) scale(1)'
              }
            }
          })}>
            <div className={css({
              bg: 'white',
              rounded: '2xl',
              p: '8',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
              border: '1px solid',
              borderColor: 'purple.200',
              h: 'full',
              position: 'relative',
              overflow: 'visible'
            })}>
              {/* Character Recommendation Speech Bubble */}
              <div className={css({
                position: 'absolute',
                top: '-10px',
                right: '16px',
                background: 'white',
                border: '2px solid',
                borderColor: 'purple.300',
                borderRadius: '16px',
                px: '4',
                py: '2',
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.15)',
                opacity: 0,
                transform: 'translateY(-10px) scale(0.95)',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                maxW: '220px',
                zIndex: 10,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: '-8px',
                  right: '20px',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid',
                  borderTopColor: 'purple.300'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  bottom: '-6px',
                  right: '22px',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid white'
                }
              })} style={{ className: 'speech-bubble' }}>
                <div className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: 'purple.800'
                })}>
                  <span className={css({ fontSize: 'lg' })}>{profile.player2Emoji}</span>
                  <span>"Memory Pairs - let's crush some competition! 🧠"</span>
                </div>
              </div>

              {/* Animated top gradient border */}
              <div className={css({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #667eea, #764ba2, #a855f7, #667eea)',
                backgroundSize: '200% 100%',
                animation: 'gradientSlide 3s ease infinite',
                borderRadius: '16px 16px 0 0'
              })} />

              {/* Game representation: Memory cards grid */}
              <div className={css({
                position: 'relative',
                w: '18',
                h: '18',
                mb: '6'
              })} style={{ className: 'memory-grid' }}>
                {/* Grid of memory cards */}
                <div className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1.5',
                  w: 'full',
                  h: 'full'
                })}>
                  {/* Card 1 - face down */}
                  <div className={css({
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    rounded: 'md',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.3s ease'
                })}>
                    ❓
                  </div>

                  {/* Card 2 - matched (abacus) */}
                  <div className={css({
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    rounded: 'md',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.3s ease'
                  })} style={{ className: 'matched-card' }}>
                    🧮
                  </div>

                  {/* Card 3 - face down */}
                  <div className={css({
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    rounded: 'md',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.3s ease'
                  })}>
                    ❓
                  </div>

                  {/* Card 4 - matched (number) */}
                  <div className={css({
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    rounded: 'md',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    color: 'white',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.3s ease'
                  })} style={{ className: 'matched-card' }}>
                    5
                  </div>

                  {/* Card 5 - flipped (number) */}
                  <div className={css({
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    rounded: 'md',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    color: 'white',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    transition: 'all 0.3s ease',
                    transformStyle: 'preserve-3d'
                  })} style={{ className: 'flipped-card' }}>
                    3
                  </div>

                  {/* Card 6 - face down */}
                  <div className={css({
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    rounded: 'md',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.3s ease'
                  })}>
                    ❓
                  </div>
                </div>

                {/* Player emoji indicator */}
                <div className={css({
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  w: '8',
                  h: '8',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  rounded: 'full',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2xs',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(251, 191, 36, 0.4)'
                })}>
                  😀
                </div>
              </div>

              <h3 className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
                mb: '3',
                display: 'flex',
                alignItems: 'center',
                gap: '2'
              })}>
                Memory Pairs 🧠
                <span className={css({
                  fontSize: 'xs',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  px: '3',
                  py: '1',
                  rounded: 'full',
                  fontWeight: 'bold'
                })} style={{ className: 'new-badge' }}>
                  ✨ Hot!
                </span>
              </h3>

              <p className={css({
                color: 'gray.600',
                mb: '6',
                lineHeight: 'relaxed'
              })}>
                The ultimate memory showdown! Flip cards, claim territory, and show off your epic emoji. Challenge friends in explosive two-player battles where every match counts!
              </p>

              <div className={css({
                display: 'flex',
                gap: '2',
                flexWrap: 'wrap'
              })}>
                <span className={css({
                  px: '4',
                  py: '2',
                  background: 'linear-gradient(135deg, #e9d5ff, #ddd6fe)',
                  color: 'purple.800',
                  rounded: 'full',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  border: '1px solid',
                  borderColor: 'purple.200'
                })}>
                  🧠 Memory & Logic
                </span>
                <span className={css({
                  px: '4',
                  py: '2',
                  background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                  color: 'blue.800',
                  rounded: 'full',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  border: '1px solid',
                  borderColor: 'blue.200'
                })}>
                  👥 Two Players
                </span>
                <span className={css({
                  px: '4',
                  py: '2',
                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                  color: 'yellow.800',
                  rounded: 'full',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  border: '1px solid',
                  borderColor: 'yellow.200'
                })}>
                  🎆 Epic Animations
                </span>
              </div>
            </div>
          </div>

          {/* Speed Complement Race */}
          <div className={css({
            bg: 'white',
            rounded: '2xl',
            p: '8',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
            border: '1px solid',
            borderColor: 'red.200',
            h: 'full',
            opacity: '0.75',
            position: 'relative',
            overflow: 'visible',
            transition: 'all 0.3s ease',
            _hover: {
              opacity: '0.9',
              transform: 'translateY(-2px)',
              '& .speech-bubble': {
                opacity: 1,
                transform: 'translateY(0) scale(1)'
              }
            }
          })}>
            {/* Character Anticipation Speech Bubble */}
            <div className={css({
              position: 'absolute',
              top: '-10px',
              left: '16px',
              background: 'white',
              border: '2px solid',
              borderColor: 'red.300',
              borderRadius: '16px',
              px: '4',
              py: '2',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.15)',
              opacity: 0,
              transform: 'translateY(-10px) scale(0.95)',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              maxW: '200px',
              zIndex: 10,
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: '-8px',
                left: '20px',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid',
                borderTopColor: 'red.300'
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                bottom: '-6px',
                left: '22px',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid white'
              }
            })} style={{ className: 'speech-bubble' }}>
              <div className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: 'red.800'
              })}>
                <span className={css({ fontSize: 'lg' })}>{profile.player1Emoji}</span>
                <span>"I can't wait for this speed challenge! 🔥"</span>
              </div>
            </div>

            {/* Coming Soon Indicator */}
            <div className={css({
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              px: '3',
              py: '1',
              rounded: 'full',
              fontSize: 'xs',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
            })}>
              🚀 Coming Soon
            </div>

            {/* Game representation: Timer and pairs */}
            <div className={css({
              position: 'relative',
              w: '18',
              h: '18',
              mb: '6'
            })}>
              {/* Timer circle */}
              <div className={css({
                w: 'full',
                h: 'full',
                border: '4px solid',
                borderColor: 'red.300',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2xl',
                background: 'linear-gradient(135deg, #fef2f2, #fee2e2)'
              })}>
                ⏱️
              </div>

              {/* Complement pairs floating around */}
              <div className={css({
                position: 'absolute',
                top: '4px',
                left: '4px',
                w: '8',
                h: '8',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                rounded: 'md',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2xs',
                color: 'white',
                fontWeight: 'bold',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
              })}>
                5
              </div>

              <div className={css({
                position: 'absolute',
                bottom: '4px',
                right: '4px',
                w: '8',
                h: '8',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                rounded: 'md',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2xs',
                color: 'white',
                fontWeight: 'bold',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
              })}>
                5
              </div>
            </div>

            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.800',
              mb: '3'
            })}>
              Number Hunter 🎯
            </h3>

            <p className={css({
              color: 'gray.600',
              mb: '6',
              lineHeight: 'relaxed'
            })}>
              The clock is ticking! Hunt down complement pairs faster than ever. Can you beat the timer and become the ultimate number ninja?
            </p>

            <div className={css({
              display: 'flex',
              gap: '2',
              flexWrap: 'wrap'
            })}>
              <span className={css({
                px: '4',
                py: '2',
                background: 'linear-gradient(135deg, #fecaca, #fca5a5)',
                color: 'red.800',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'semibold',
                border: '1px solid',
                borderColor: 'red.200',
                opacity: 0.8
              })}>
                🔥 Speed Challenge
              </span>
              <span className={css({
                px: '4',
                py: '2',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                color: 'yellow.800',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'semibold',
                border: '1px solid',
                borderColor: 'yellow.200',
                opacity: 0.8
              })}>
                🎯 Advanced
              </span>
            </div>
          </div>

          {/* Card Sorting Challenge */}
          <div className={css({
            bg: 'white',
            rounded: '2xl',
            p: '8',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
            border: '1px solid',
            borderColor: 'indigo.200',
            h: 'full',
            opacity: '0.75',
            position: 'relative',
            overflow: 'visible',
            transition: 'all 0.3s ease',
            _hover: {
              opacity: '0.9',
              transform: 'translateY(-2px)',
              '& .speech-bubble': {
                opacity: 1,
                transform: 'translateY(0) scale(1)'
              }
            }
          })}>
            {/* Character Development Speech Bubble */}
            <div className={css({
              position: 'absolute',
              top: '-10px',
              right: '16px',
              background: 'white',
              border: '2px solid',
              borderColor: 'indigo.300',
              borderRadius: '16px',
              px: '4',
              py: '2',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)',
              opacity: 0,
              transform: 'translateY(-10px) scale(0.95)',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              maxW: '210px',
              zIndex: 10,
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: '-8px',
                right: '20px',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid',
                borderTopColor: 'indigo.300'
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                bottom: '-6px',
                right: '22px',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid white'
              }
            })} style={{ className: 'speech-bubble' }}>
              <div className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: 'indigo.800'
              })}>
                <span className={css({ fontSize: 'lg' })}>{profile.player2Emoji}</span>
                <span>"Organizing chaos is my superpower! 🎴"</span>
              </div>
            </div>

            {/* Coming Soon Indicator */}
            <div className={css({
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              px: '3',
              py: '1',
              rounded: 'full',
              fontSize: 'xs',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
            })}>
              🛠️ In Development
            </div>

            {/* Game representation: Sortable cards */}
            <div className={css({
              position: 'relative',
              w: '18',
              h: '18',
              mb: '6'
            })}>
              {/* Stack of cards to sort */}
              <div className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
                w: 'full',
                h: 'full'
              })}>
                {/* Card 1 - higher value (out of order) */}
                <div className={css({
                  w: 'full',
                  h: '5',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  rounded: 'md',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'sm',
                  color: 'white',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                })}>
                  8
                </div>

                {/* Card 2 - lower value (out of order) */}
                <div className={css({
                  w: 'full',
                  h: '5',
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  rounded: 'md',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'sm',
                  color: 'white',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                })}>
                  3
                </div>

                {/* Card 3 - middle value (out of order) */}
                <div className={css({
                  w: 'full',
                  h: '5',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  rounded: 'md',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'sm',
                  color: 'white',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                })}>
                  5
                </div>
              </div>

              {/* Drag indicator */}
              <div className={css({
                position: 'absolute',
                top: '2',
                right: '2',
                fontSize: 'sm',
                opacity: 0.7
              })}>
                ↕️
              </div>
            </div>

            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.800',
              mb: '3'
            })}>
              Master Organizer 🎴
            </h3>

            <p className={css({
              color: 'gray.600',
              mb: '6',
              lineHeight: 'relaxed'
            })}>
              Chaos to order! Drag and sort scattered number cards into perfect harmony. Can you organize the mathematical mayhem?
            </p>

            <div className={css({
              display: 'flex',
              gap: '2',
              flexWrap: 'wrap'
            })}>
              <span className={css({
                px: '4',
                py: '2',
                background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
                color: 'indigo.800',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'semibold',
                border: '1px solid',
                borderColor: 'indigo.200',
                opacity: 0.8
              })}>
                🧩 Sorting & Logic
              </span>
              <span className={css({
                px: '4',
                py: '2',
                background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                color: 'green.800',
                rounded: 'full',
                fontSize: 'sm',
                fontWeight: 'semibold',
                border: '1px solid',
                borderColor: 'green.200',
                opacity: 0.8
              })}>
                📈 Intermediate
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

// Inject refined animations into the page
if (typeof document !== 'undefined' && !document.getElementById('games-page-animations')) {
  const style = document.createElement('style')
  style.id = 'games-page-animations'
  style.textContent = globalAnimations
  document.head.appendChild(style)
}