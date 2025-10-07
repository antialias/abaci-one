'use client'

import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { grid, hstack, stack } from '../../../../styled-system/patterns'

export function ReadingNumbersGuide() {
  const appConfig = useAbacusConfig()

  return (
    <div className={stack({ gap: '12' })}>
      {/* Section Introduction */}
      <div className={css({ textAlign: 'center' })}>
        <h2
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: 'gray.900',
            mb: '4',
          })}
        >
          🔍 Learning to Read Soroban Numbers
        </h2>
        <p
          className={css({
            fontSize: 'lg',
            color: 'gray.600',
            maxW: '3xl',
            mx: 'auto',
            lineHeight: 'relaxed',
          })}
        >
          Master the fundamentals of reading numbers on the soroban with step-by-step visual
          tutorials
        </p>
      </div>

      {/* Step 1: Basic Structure */}
      <div
        className={css({
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '8',
        })}
      >
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div
              className={css({
                w: '12',
                h: '12',
                bg: 'brand.600',
                color: 'white',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 'lg',
              })}
            >
              1
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              Understanding the Structure
            </h3>
          </div>

          <div className={stack({ gap: '6' })}>
            <p
              className={css({
                fontSize: 'lg',
                color: 'gray.700',
                lineHeight: 'relaxed',
              })}
            >
              The soroban consists of two main sections divided by a horizontal bar. Understanding
              this structure is fundamental to reading any number.
            </p>

            <div className={grid({ columns: { base: 1, md: 2 }, gap: '8' })}>
              <div
                className={css({
                  bg: 'blue.50',
                  border: '1px solid',
                  borderColor: 'blue.200',
                  rounded: 'xl',
                  p: '6',
                })}
              >
                <h4
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    color: 'blue.800',
                    mb: '3',
                  })}
                >
                  🌅 Heaven Beads (Top)
                </h4>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'blue.700',
                    lineHeight: 'relaxed',
                    pl: '4',
                  })}
                >
                  <li className={css({ mb: '2' })}>• Located above the horizontal bar</li>
                  <li className={css({ mb: '2' })}>• Each bead represents 5</li>
                  <li className={css({ mb: '2' })}>• Only one bead per column</li>
                  <li>• When pushed down = active/counted</li>
                </ul>
              </div>

              <div
                className={css({
                  bg: 'green.50',
                  border: '1px solid',
                  borderColor: 'green.200',
                  rounded: 'xl',
                  p: '6',
                })}
              >
                <h4
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    color: 'green.800',
                    mb: '3',
                  })}
                >
                  🌍 Earth Beads (Bottom)
                </h4>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'green.700',
                    lineHeight: 'relaxed',
                    pl: '4',
                  })}
                >
                  <li className={css({ mb: '2' })}>• Located below the horizontal bar</li>
                  <li className={css({ mb: '2' })}>• Each bead represents 1</li>
                  <li className={css({ mb: '2' })}>• Four beads per column</li>
                  <li>• When pushed up = active/counted</li>
                </ul>
              </div>
            </div>

            <div
              className={css({
                bg: 'yellow.50',
                border: '1px solid',
                borderColor: 'yellow.300',
                rounded: 'xl',
                p: '4',
                textAlign: 'center',
              })}
            >
              <p
                className={css({
                  fontSize: 'md',
                  color: 'yellow.800',
                  fontWeight: 'medium',
                })}
              >
                💡 Key Concept: Active beads are those touching the horizontal bar
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Single Digits */}
      <div
        className={css({
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '8',
        })}
      >
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div
              className={css({
                w: '12',
                h: '12',
                bg: 'brand.600',
                color: 'white',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 'lg',
              })}
            >
              2
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              Reading Single Digits (1-9)
            </h3>
          </div>

          <p
            className={css({
              fontSize: 'lg',
              color: 'gray.700',
              lineHeight: 'relaxed',
            })}
          >
            Let's learn to read single digits by understanding how heaven and earth beads combine to
            represent numbers 1 through 9.
          </p>

          <div className={grid({ columns: { base: 1, lg: 5 }, gap: '6' })}>
            {[
              { num: 0, desc: 'No beads active - all away from bar' },
              { num: 1, desc: 'One earth bead pushed up' },
              { num: 3, desc: 'Three earth beads pushed up' },
              { num: 5, desc: 'Heaven bead pushed down' },
              { num: 7, desc: 'Heaven bead + two earth beads' },
            ].map((example) => (
              <div
                key={example.num}
                className={css({
                  bg: 'gray.50',
                  border: '1px solid',
                  borderColor: 'gray.200',
                  rounded: 'lg',
                  p: '4',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                })}
              >
                <div
                  className={css({
                    fontSize: 'xl',
                    fontWeight: 'bold',
                    color: 'brand.600',
                    mb: '3',
                  })}
                >
                  {example.num}
                </div>

                {/* Aspect ratio container for soroban - roughly 1:3 ratio */}
                <div
                  className={css({
                    width: '100%',
                    aspectRatio: '1/2.8',
                    maxW: '120px',
                    bg: 'white',
                    border: '1px solid',
                    borderColor: 'gray.300',
                    rounded: 'md',
                    mb: '3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  })}
                >
                  <AbacusReact
                    value={example.num}
                    columns={1}
                    beadShape={appConfig.beadShape}
                    colorScheme={appConfig.colorScheme}
                    hideInactiveBeads={appConfig.hideInactiveBeads}
                    scaleFactor={0.8}
                    interactive={false}
                    showNumbers={false}
                    animated={true}
                  />
                </div>

                <p
                  className={css({
                    fontSize: '2xs',
                    color: 'gray.600',
                    lineHeight: 'tight',
                    textAlign: 'center',
                    mt: 'auto',
                  })}
                >
                  {example.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 3: Multi-digit Numbers */}
      <div
        className={css({
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '8',
        })}
      >
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div
              className={css({
                w: '12',
                h: '12',
                bg: 'brand.600',
                color: 'white',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 'lg',
              })}
            >
              3
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              Multi-Digit Numbers
            </h3>
          </div>

          <p
            className={css({
              fontSize: 'lg',
              color: 'gray.700',
              lineHeight: 'relaxed',
            })}
          >
            Reading larger numbers is simply a matter of reading each column from left to right,
            with each column representing a different place value.
          </p>

          <div
            className={css({
              bg: 'purple.50',
              border: '1px solid',
              borderColor: 'purple.200',
              rounded: 'xl',
              p: '6',
            })}
          >
            <h4
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'purple.800',
                mb: '4',
                textAlign: 'center',
              })}
            >
              📍 Reading Direction & Place Values
            </h4>
            <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
              <div>
                <h5 className={css({ fontWeight: 'semibold', mb: '2', color: 'purple.800' })}>
                  Reading Order:
                </h5>
                <ul className={css({ fontSize: 'sm', color: 'purple.700', pl: '4' })}>
                  <li className={css({ mb: '1' })}>• Always read from LEFT to RIGHT</li>
                  <li className={css({ mb: '1' })}>• Each column is one digit</li>
                  <li>• Combine digits to form the complete number</li>
                </ul>
              </div>
              <div>
                <h5 className={css({ fontWeight: 'semibold', mb: '2', color: 'purple.800' })}>
                  Place Values:
                </h5>
                <ul className={css({ fontSize: 'sm', color: 'purple.700', pl: '4' })}>
                  <li className={css({ mb: '1' })}>• Rightmost = Ones (1s)</li>
                  <li className={css({ mb: '1' })}>• Next left = Tens (10s)</li>
                  <li>• Continue for hundreds, thousands, etc.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Multi-digit Examples */}
          <div
            className={css({
              bg: 'blue.50',
              border: '1px solid',
              borderColor: 'blue.200',
              rounded: 'xl',
              p: '6',
            })}
          >
            <h4
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'blue.800',
                mb: '4',
                textAlign: 'center',
              })}
            >
              🔢 Multi-Digit Examples
            </h4>

            <div className={grid({ columns: { base: 1, md: 3 }, gap: '8' })}>
              {[
                { num: 23, desc: 'Two-digit: 2 in tens place + 3 in ones place' },
                { num: 58, desc: 'Heaven bead in tens (5) + heaven + earth beads in ones (8)' },
                { num: 147, desc: 'Three-digit: 1 hundred + 4 tens + 7 ones' },
              ].map((example) => (
                <div
                  key={example.num}
                  className={css({
                    bg: 'white',
                    border: '1px solid',
                    borderColor: 'blue.300',
                    rounded: 'lg',
                    p: '4',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  })}
                >
                  <div
                    className={css({
                      fontSize: '2xl',
                      fontWeight: 'bold',
                      color: 'blue.600',
                      mb: '3',
                    })}
                  >
                    {example.num}
                  </div>

                  {/* Larger container for multi-digit numbers */}
                  <div
                    className={css({
                      width: '100%',
                      aspectRatio: '3/4',
                      maxW: '180px',
                      bg: 'gray.50',
                      border: '1px solid',
                      borderColor: 'blue.200',
                      rounded: 'md',
                      mb: '3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    })}
                  >
                    <AbacusReact
                      value={example.num}
                      columns={'auto'}
                      beadShape={appConfig.beadShape}
                      colorScheme={appConfig.colorScheme}
                      hideInactiveBeads={appConfig.hideInactiveBeads}
                      scaleFactor={0.9}
                      interactive={false}
                      showNumbers={false}
                      animated={true}
                    />
                  </div>

                  <p
                    className={css({
                      fontSize: 'xs',
                      color: 'blue.700',
                      lineHeight: 'relaxed',
                      textAlign: 'center',
                    })}
                  >
                    {example.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step 4: Practice Tips */}
      <div
        className={css({
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '8',
        })}
      >
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div
              className={css({
                w: '12',
                h: '12',
                bg: 'brand.600',
                color: 'white',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 'lg',
              })}
            >
              4
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              Practice Strategy
            </h3>
          </div>

          <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
            <div
              className={css({
                bg: 'green.50',
                border: '1px solid',
                borderColor: 'green.200',
                rounded: 'xl',
                p: '6',
              })}
            >
              <h4
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  color: 'green.800',
                  mb: '4',
                })}
              >
                🎯 Learning Tips
              </h4>
              <ul
                className={css({
                  fontSize: 'sm',
                  color: 'green.700',
                  lineHeight: 'relaxed',
                  pl: '4',
                })}
              >
                <li className={css({ mb: '2' })}>• Start with single digits (0-9)</li>
                <li className={css({ mb: '2' })}>
                  • Practice identifying active vs. inactive beads
                </li>
                <li className={css({ mb: '2' })}>• Work on speed recognition</li>
                <li>• Progress to multi-digit numbers gradually</li>
              </ul>
            </div>

            <div
              className={css({
                bg: 'orange.50',
                border: '1px solid',
                borderColor: 'orange.200',
                rounded: 'xl',
                p: '6',
              })}
            >
              <h4
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  color: 'orange.800',
                  mb: '4',
                })}
              >
                ⚡ Quick Recognition
              </h4>
              <ul
                className={css({
                  fontSize: 'sm',
                  color: 'orange.700',
                  lineHeight: 'relaxed',
                  pl: '4',
                })}
              >
                <li className={css({ mb: '2' })}>• Numbers 1-4: Only earth beads</li>
                <li className={css({ mb: '2' })}>• Number 5: Only heaven bead</li>
                <li className={css({ mb: '2' })}>• Numbers 6-9: Heaven + earth beads</li>
                <li>• Zero: All beads away from bar</li>
              </ul>
            </div>
          </div>

          <div
            className={css({
              bg: 'blue.600',
              color: 'white',
              rounded: 'xl',
              p: '6',
              textAlign: 'center',
            })}
          >
            <h4
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                mb: '3',
              })}
            >
              🚀 Ready to Practice?
            </h4>
            <p
              className={css({
                mb: '4',
                opacity: '0.9',
              })}
            >
              Test your newfound knowledge with interactive flashcards
            </p>
            <Link
              href="/create"
              className={css({
                display: 'inline-block',
                px: '6',
                py: '3',
                bg: 'white',
                color: 'blue.600',
                fontWeight: 'semibold',
                rounded: 'lg',
                textDecoration: 'none',
                transition: 'all',
                _hover: { transform: 'translateY(-1px)', shadow: 'lg' },
              })}
            >
              Create Practice Flashcards →
            </Link>
          </div>
        </div>
      </div>

      {/* Step 5: Interactive Practice */}
      <div
        className={css({
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '8',
        })}
      >
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div
              className={css({
                w: '12',
                h: '12',
                bg: 'brand.600',
                color: 'white',
                rounded: 'full',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 'lg',
              })}
            >
              5
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              Interactive Practice
            </h3>
          </div>

          <p
            className={css({
              fontSize: 'lg',
              color: 'gray.700',
              lineHeight: 'relaxed',
            })}
          >
            Try the interactive abacus below! Click on the beads to activate them and watch the
            number change in real-time.
          </p>

          <div
            className={css({
              bg: 'orange.50',
              border: '1px solid',
              borderColor: 'orange.200',
              rounded: 'xl',
              p: '6',
            })}
          >
            <h4
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'orange.800',
                mb: '4',
                textAlign: 'center',
              })}
            >
              🎮 How to Use the Interactive Abacus
            </h4>
            <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
              <div>
                <h5 className={css({ fontWeight: 'semibold', mb: '2', color: 'orange.800' })}>
                  Heaven Beads (Top):
                </h5>
                <ul className={css({ fontSize: 'sm', color: 'orange.700', pl: '4' })}>
                  <li className={css({ mb: '1' })}>• Worth 5 points each</li>
                  <li className={css({ mb: '1' })}>• Click to toggle on/off</li>
                  <li>• Blue when active, gray when inactive</li>
                </ul>
              </div>
              <div>
                <h5 className={css({ fontWeight: 'semibold', mb: '2', color: 'orange.800' })}>
                  Earth Beads (Bottom):
                </h5>
                <ul className={css({ fontSize: 'sm', color: 'orange.700', pl: '4' })}>
                  <li className={css({ mb: '1' })}>• Worth 1 point each</li>
                  <li className={css({ mb: '1' })}>• Click to activate groups</li>
                  <li>• Green when active, gray when inactive</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Interactive Abacus Component */}
          <div
            className={css({
              bg: 'white',
              border: '2px solid',
              borderColor: 'brand.200',
              rounded: 'xl',
              p: '6',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
            })}
          >
            <AbacusReact
              value={0}
              columns={3}
              beadShape={appConfig.beadShape}
              colorScheme={appConfig.colorScheme}
              hideInactiveBeads={appConfig.hideInactiveBeads}
              scaleFactor={1.5}
              interactive={true}
              showNumbers={true}
              animated={true}
            />
          </div>

          <div
            className={css({
              bg: 'blue.600',
              color: 'white',
              rounded: 'xl',
              p: '6',
              textAlign: 'center',
            })}
          >
            <h4
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                mb: '3',
              })}
            >
              🚀 Ready to Practice?
            </h4>
            <p
              className={css({
                mb: '4',
                opacity: '0.9',
              })}
            >
              Test your newfound knowledge with interactive flashcards
            </p>
            <Link
              href="/create"
              className={css({
                display: 'inline-block',
                px: '6',
                py: '3',
                bg: 'white',
                color: 'blue.600',
                fontWeight: 'semibold',
                rounded: 'lg',
                textDecoration: 'none',
                transition: 'all',
                _hover: { transform: 'translateY(-1px)', shadow: 'lg' },
              })}
            >
              Create Practice Flashcards →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
