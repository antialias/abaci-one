'use client'

import { useState } from 'react'
import Link from 'next/link'
import { css } from '../../../styled-system/css'
import { container, stack, hstack, grid } from '../../../styled-system/patterns'
import { ServerSorobanSVG } from '@/components/ServerSorobanSVG'

type TabType = 'reading' | 'arithmetic'

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<TabType>('reading')
  return (
    <div className={css({ minHeight: '100vh', bg: 'gray.50' })}>

      {/* Hero Section */}
      <div className={css({
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center',
        py: '20'
      })}>
        <div className={container({ maxW: '4xl', px: '4' })}>
          <h1 className={css({
            fontSize: '4xl',
            fontWeight: 'bold',
            mb: '4',
            textShadow: '0 4px 20px rgba(0,0,0,0.3)'
          })}>
            📚 Complete Soroban Mastery Guide
          </h1>
          <p className={css({
            fontSize: 'xl',
            opacity: '0.95',
            maxW: '2xl',
            mx: 'auto',
            lineHeight: 'relaxed'
          })}>
            From basic reading to advanced arithmetic - everything you need to master the Japanese abacus
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={css({
        bg: 'white',
        borderBottom: '1px solid',
        borderColor: 'gray.200'
      })}>
        <div className={container({ maxW: '7xl', px: '4' })}>
          <div className={hstack({ gap: '0' })}>
            <button
              onClick={() => setActiveTab('reading')}
              className={css({
                px: '6',
                py: '4',
                fontWeight: 'medium',
                borderBottom: '2px solid',
                borderColor: activeTab === 'reading' ? 'brand.600' : 'transparent',
                color: activeTab === 'reading' ? 'brand.600' : 'gray.600',
                bg: activeTab === 'reading' ? 'brand.50' : 'transparent',
                transition: 'all',
                cursor: 'pointer',
                _hover: {
                  bg: activeTab === 'reading' ? 'brand.50' : 'gray.50',
                  color: activeTab === 'reading' ? 'brand.600' : 'gray.800'
                }
              })}
            >
              📖 Reading Numbers
            </button>
            <button
              onClick={() => setActiveTab('arithmetic')}
              className={css({
                px: '6',
                py: '4',
                fontWeight: 'medium',
                borderBottom: '2px solid',
                borderColor: activeTab === 'arithmetic' ? 'brand.600' : 'transparent',
                color: activeTab === 'arithmetic' ? 'brand.600' : 'gray.600',
                bg: activeTab === 'arithmetic' ? 'brand.50' : 'transparent',
                transition: 'all',
                cursor: 'pointer',
                _hover: {
                  bg: activeTab === 'arithmetic' ? 'brand.50' : 'gray.50',
                  color: activeTab === 'arithmetic' ? 'brand.600' : 'gray.800'
                }
              })}
            >
              🧮 Arithmetic Operations
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={container({ maxW: '6xl', px: '4', py: '12' })}>
        <div className={css({
          bg: 'white',
          rounded: '2xl',
          shadow: 'card',
          p: '10'
        })}>
          {activeTab === 'reading' ? <ReadingNumbersGuide /> : <ArithmeticOperationsGuide />}
        </div>
      </div>
    </div>
  )
}

function ReadingNumbersGuide() {
  return (
    <div className={stack({ gap: '12' })}>
      {/* Section Introduction */}
      <div className={css({ textAlign: 'center' })}>
        <h2 className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
          color: 'gray.900',
          mb: '4'
        })}>
          🔍 Learning to Read Soroban Numbers
        </h2>
        <p className={css({
          fontSize: 'lg',
          color: 'gray.600',
          maxW: '3xl',
          mx: 'auto',
          lineHeight: 'relaxed'
        })}>
          Master the fundamentals of reading numbers on the soroban with step-by-step visual tutorials
        </p>
      </div>

      {/* Step 1: Basic Structure */}
      <div className={css({
        border: '1px solid',
        borderColor: 'gray.200',
        rounded: 'xl',
        p: '8'
      })}>
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div className={css({
              w: '12',
              h: '12',
              bg: 'brand.600',
              color: 'white',
              rounded: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 'lg'
            })}>
              1
            </div>
            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900'
            })}>
              Understanding the Structure
            </h3>
          </div>

          <div className={stack({ gap: '6' })}>
            <p className={css({
              fontSize: 'lg',
              color: 'gray.700',
              lineHeight: 'relaxed'
            })}>
              The soroban consists of two main sections divided by a horizontal bar. Understanding this structure is fundamental to reading any number.
            </p>

            <div className={grid({ columns: { base: 1, md: 2 }, gap: '8' })}>
              <div className={css({
                bg: 'blue.50',
                border: '1px solid',
                borderColor: 'blue.200',
                rounded: 'xl',
                p: '6'
              })}>
                <h4 className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  color: 'blue.800',
                  mb: '3'
                })}>
                  🌅 Heaven Beads (Top)
                </h4>
                <ul className={css({
                  fontSize: 'sm',
                  color: 'blue.700',
                  lineHeight: 'relaxed',
                  pl: '4'
                })}>
                  <li className={css({ mb: '2' })}>• Located above the horizontal bar</li>
                  <li className={css({ mb: '2' })}>• Each bead represents 5</li>
                  <li className={css({ mb: '2' })}>• Only one bead per column</li>
                  <li>• When pushed down = active/counted</li>
                </ul>
              </div>

              <div className={css({
                bg: 'green.50',
                border: '1px solid',
                borderColor: 'green.200',
                rounded: 'xl',
                p: '6'
              })}>
                <h4 className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  color: 'green.800',
                  mb: '3'
                })}>
                  🌍 Earth Beads (Bottom)
                </h4>
                <ul className={css({
                  fontSize: 'sm',
                  color: 'green.700',
                  lineHeight: 'relaxed',
                  pl: '4'
                })}>
                  <li className={css({ mb: '2' })}>• Located below the horizontal bar</li>
                  <li className={css({ mb: '2' })}>• Each bead represents 1</li>
                  <li className={css({ mb: '2' })}>• Four beads per column</li>
                  <li>• When pushed up = active/counted</li>
                </ul>
              </div>
            </div>

            <div className={css({
              bg: 'yellow.50',
              border: '1px solid',
              borderColor: 'yellow.300',
              rounded: 'xl',
              p: '4',
              textAlign: 'center'
            })}>
              <p className={css({
                fontSize: 'md',
                color: 'yellow.800',
                fontWeight: 'medium'
              })}>
                💡 Key Concept: Active beads are those touching the horizontal bar
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Single Digits */}
      <div className={css({
        border: '1px solid',
        borderColor: 'gray.200',
        rounded: 'xl',
        p: '8'
      })}>
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div className={css({
              w: '12',
              h: '12',
              bg: 'brand.600',
              color: 'white',
              rounded: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 'lg'
            })}>
              2
            </div>
            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900'
            })}>
              Reading Single Digits (1-9)
            </h3>
          </div>

          <p className={css({
            fontSize: 'lg',
            color: 'gray.700',
            lineHeight: 'relaxed'
          })}>
            Let's learn to read single digits by understanding how heaven and earth beads combine to represent numbers 1 through 9.
          </p>

          <div className={grid({ columns: { base: 1, lg: 5 }, gap: '6' })}>
            {[
              { num: 0, desc: 'No beads active - all away from bar' },
              { num: 1, desc: 'One earth bead pushed up' },
              { num: 3, desc: 'Three earth beads pushed up' },
              { num: 5, desc: 'Heaven bead pushed down' },
              { num: 7, desc: 'Heaven bead + two earth beads' }
            ].map((example) => (
              <div key={example.num} className={css({
                bg: 'gray.50',
                border: '1px solid',
                borderColor: 'gray.200',
                rounded: 'lg',
                p: '4',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              })}>
                <div className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: 'brand.600',
                  mb: '3'
                })}>
                  {example.num}
                </div>

                {/* Aspect ratio container for soroban - roughly 1:3 ratio */}
                <div className={css({
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
                  overflow: 'hidden'
                })}>
                  <ServerSorobanSVG
                    number={example.num}
                    width={120}
                    height={336}
                    colorScheme="place-value"
                    className={css({
                      w: 'full',
                      h: 'full',
                      '& svg': {
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }
                    })}
                  />
                </div>

                <p className={css({
                  fontSize: '2xs',
                  color: 'gray.600',
                  lineHeight: 'tight',
                  textAlign: 'center',
                  mt: 'auto'
                })}>
                  {example.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 3: Multi-digit Numbers */}
      <div className={css({
        border: '1px solid',
        borderColor: 'gray.200',
        rounded: 'xl',
        p: '8'
      })}>
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div className={css({
              w: '12',
              h: '12',
              bg: 'brand.600',
              color: 'white',
              rounded: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 'lg'
            })}>
              3
            </div>
            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900'
            })}>
              Multi-Digit Numbers
            </h3>
          </div>

          <p className={css({
            fontSize: 'lg',
            color: 'gray.700',
            lineHeight: 'relaxed'
          })}>
            Reading larger numbers is simply a matter of reading each column from left to right, with each column representing a different place value.
          </p>

          <div className={css({
            bg: 'purple.50',
            border: '1px solid',
            borderColor: 'purple.200',
            rounded: 'xl',
            p: '6'
          })}>
            <h4 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              color: 'purple.800',
              mb: '4',
              textAlign: 'center'
            })}>
              📍 Reading Direction & Place Values
            </h4>
            <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
              <div>
                <h5 className={css({ fontWeight: 'semibold', mb: '2', color: 'purple.800' })}>Reading Order:</h5>
                <ul className={css({ fontSize: 'sm', color: 'purple.700', pl: '4' })}>
                  <li className={css({ mb: '1' })}>• Always read from LEFT to RIGHT</li>
                  <li className={css({ mb: '1' })}>• Each column is one digit</li>
                  <li>• Combine digits to form the complete number</li>
                </ul>
              </div>
              <div>
                <h5 className={css({ fontWeight: 'semibold', mb: '2', color: 'purple.800' })}>Place Values:</h5>
                <ul className={css({ fontSize: 'sm', color: 'purple.700', pl: '4' })}>
                  <li className={css({ mb: '1' })}>• Rightmost = Ones (1s)</li>
                  <li className={css({ mb: '1' })}>• Next left = Tens (10s)</li>
                  <li>• Continue for hundreds, thousands, etc.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Multi-digit Examples */}
          <div className={css({
            bg: 'blue.50',
            border: '1px solid',
            borderColor: 'blue.200',
            rounded: 'xl',
            p: '6'
          })}>
            <h4 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              color: 'blue.800',
              mb: '4',
              textAlign: 'center'
            })}>
              🔢 Multi-Digit Examples
            </h4>

            <div className={grid({ columns: { base: 1, md: 3 }, gap: '8' })}>
              {[
                { num: 23, desc: 'Two-digit: 2 in tens place + 3 in ones place' },
                { num: 58, desc: 'Heaven bead in tens (5) + heaven + earth beads in ones (8)' },
                { num: 147, desc: 'Three-digit: 1 hundred + 4 tens + 7 ones' }
              ].map((example) => (
                <div key={example.num} className={css({
                  bg: 'white',
                  border: '1px solid',
                  borderColor: 'blue.300',
                  rounded: 'lg',
                  p: '4',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                })}>
                  <div className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: 'blue.600',
                    mb: '3'
                  })}>
                    {example.num}
                  </div>

                  {/* Larger container for multi-digit numbers */}
                  <div className={css({
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
                    overflow: 'hidden'
                  })}>
                    <ServerSorobanSVG
                      number={example.num}
                      width={180}
                      height={240}
                      colorScheme="place-value"
                      className={css({
                        w: 'full',
                        h: 'full',
                        '& svg': {
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }
                      })}
                    />
                  </div>

                  <p className={css({
                    fontSize: 'xs',
                    color: 'blue.700',
                    lineHeight: 'relaxed',
                    textAlign: 'center'
                  })}>
                    {example.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step 4: Practice Tips */}
      <div className={css({
        border: '1px solid',
        borderColor: 'gray.200',
        rounded: 'xl',
        p: '8'
      })}>
        <div className={stack({ gap: '6' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            <div className={css({
              w: '12',
              h: '12',
              bg: 'brand.600',
              color: 'white',
              rounded: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 'lg'
            })}>
              4
            </div>
            <h3 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900'
            })}>
              Practice Strategy
            </h3>
          </div>

          <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
            <div className={css({
              bg: 'green.50',
              border: '1px solid',
              borderColor: 'green.200',
              rounded: 'xl',
              p: '6'
            })}>
              <h4 className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'green.800',
                mb: '4'
              })}>
                🎯 Learning Tips
              </h4>
              <ul className={css({
                fontSize: 'sm',
                color: 'green.700',
                lineHeight: 'relaxed',
                pl: '4'
              })}>
                <li className={css({ mb: '2' })}>• Start with single digits (0-9)</li>
                <li className={css({ mb: '2' })}>• Practice identifying active vs. inactive beads</li>
                <li className={css({ mb: '2' })}>• Work on speed recognition</li>
                <li>• Progress to multi-digit numbers gradually</li>
              </ul>
            </div>

            <div className={css({
              bg: 'orange.50',
              border: '1px solid',
              borderColor: 'orange.200',
              rounded: 'xl',
              p: '6'
            })}>
              <h4 className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'orange.800',
                mb: '4'
              })}>
                ⚡ Quick Recognition
              </h4>
              <ul className={css({
                fontSize: 'sm',
                color: 'orange.700',
                lineHeight: 'relaxed',
                pl: '4'
              })}>
                <li className={css({ mb: '2' })}>• Numbers 1-4: Only earth beads</li>
                <li className={css({ mb: '2' })}>• Number 5: Only heaven bead</li>
                <li className={css({ mb: '2' })}>• Numbers 6-9: Heaven + earth beads</li>
                <li>• Zero: All beads away from bar</li>
              </ul>
            </div>
          </div>

          <div className={css({
            bg: 'blue.600',
            color: 'white',
            rounded: 'xl',
            p: '6',
            textAlign: 'center'
          })}>
            <h4 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              mb: '3'
            })}>
              🚀 Ready to Practice?
            </h4>
            <p className={css({
              mb: '4',
              opacity: '0.9'
            })}>
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
                _hover: { transform: 'translateY(-1px)', shadow: 'lg' }
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

function ArithmeticOperationsGuide() {
  return (
    <div className={css({ maxW: '4xl', mx: 'auto' })}>
      <div className={css({
        bg: 'gradient-to-br',
        gradientFrom: 'purple.600',
        gradientTo: 'indigo.700',
        color: 'white',
        rounded: 'xl',
        p: { base: '6', md: '8' },
        mb: '8',
        textAlign: 'center'
      })}>
        <h2 className={css({
          fontSize: { base: '2xl', md: '3xl' },
          fontWeight: 'bold',
          mb: '4'
        })}>
          🧮 Arithmetic Operations
        </h2>
        <p className={css({
          fontSize: 'lg',
          opacity: '0.9'
        })}>
          Master addition, subtraction, multiplication, and division on the soroban
        </p>
      </div>

      {/* Addition Section */}
      <div className={css({
        bg: 'white',
        rounded: 'xl',
        p: '6',
        mb: '6',
        shadow: 'sm',
        border: '1px solid',
        borderColor: 'gray.200'
      })}>
        <h3 className={css({
          fontSize: 'xl',
          fontWeight: 'bold',
          color: 'green.700',
          mb: '4',
          display: 'flex',
          alignItems: 'center',
          gap: '2'
        })}>
          <span>➕</span> Addition
        </h3>

        <p className={css({ mb: '6', color: 'gray.700' })}>
          Addition on the soroban follows the principle of moving beads toward the bar to increase values.
        </p>

        <div className={css({ mb: '6' })}>
          <h4 className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            mb: '3',
            color: 'green.600'
          })}>
            Basic Steps:
          </h4>
          <ol className={css({
            pl: '6',
            gap: '2',
            color: 'gray.700'
          })}>
            <li className={css({ mb: '2' })}>1. Set the first number on the soroban</li>
            <li className={css({ mb: '2' })}>2. Add the second number by moving beads toward the bar</li>
            <li className={css({ mb: '2' })}>3. Handle carries when a column exceeds 9</li>
            <li>4. Read the final result</li>
          </ol>
        </div>

        <div className={css({
          bg: 'green.50',
          border: '1px solid',
          borderColor: 'green.200',
          rounded: 'lg',
          p: '4',
          mb: '4'
        })}>
          <h5 className={css({
            fontWeight: 'semibold',
            color: 'green.800',
            mb: '2'
          })}>
            Example: 3 + 4 = 7
          </h5>
          <div className={grid({ columns: 3, gap: '4', alignItems: 'center' })}>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'green.700' })}>Start: 3</p>
              <ServerSorobanSVG number={3} width={80} height={120} />
            </div>
            <div className={css({ textAlign: 'center', fontSize: '2xl' })}>+</div>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'green.700' })}>Result: 7</p>
              <ServerSorobanSVG number={7} width={80} height={120} />
            </div>
          </div>
        </div>
      </div>

      {/* Subtraction Section */}
      <div className={css({
        bg: 'white',
        rounded: 'xl',
        p: '6',
        mb: '6',
        shadow: 'sm',
        border: '1px solid',
        borderColor: 'gray.200'
      })}>
        <h3 className={css({
          fontSize: 'xl',
          fontWeight: 'bold',
          color: 'red.700',
          mb: '4',
          display: 'flex',
          alignItems: 'center',
          gap: '2'
        })}>
          <span>➖</span> Subtraction
        </h3>

        <p className={css({ mb: '6', color: 'gray.700' })}>
          Subtraction involves moving beads away from the bar to decrease values.
        </p>

        <div className={css({ mb: '6' })}>
          <h4 className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            mb: '3',
            color: 'red.600'
          })}>
            Basic Steps:
          </h4>
          <ol className={css({
            pl: '6',
            gap: '2',
            color: 'gray.700'
          })}>
            <li className={css({ mb: '2' })}>1. Set the minuend (first number) on the soroban</li>
            <li className={css({ mb: '2' })}>2. Subtract by moving beads away from the bar</li>
            <li className={css({ mb: '2' })}>3. Handle borrowing when needed</li>
            <li>4. Read the final result</li>
          </ol>
        </div>

        <div className={css({
          bg: 'red.50',
          border: '1px solid',
          borderColor: 'red.200',
          rounded: 'lg',
          p: '4',
          mb: '4'
        })}>
          <h5 className={css({
            fontWeight: 'semibold',
            color: 'red.800',
            mb: '2'
          })}>
            Example: 8 - 3 = 5
          </h5>
          <div className={grid({ columns: 3, gap: '4', alignItems: 'center' })}>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'red.700' })}>Start: 8</p>
              <ServerSorobanSVG number={8} width={80} height={120} />
            </div>
            <div className={css({ textAlign: 'center', fontSize: '2xl' })}>-</div>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'red.700' })}>Result: 5</p>
              <ServerSorobanSVG number={5} width={80} height={120} />
            </div>
          </div>
        </div>
      </div>

      {/* Multiplication & Division Section */}
      <div className={css({
        bg: 'white',
        rounded: 'xl',
        p: '6',
        mb: '6',
        shadow: 'sm',
        border: '1px solid',
        borderColor: 'gray.200'
      })}>
        <h3 className={css({
          fontSize: 'xl',
          fontWeight: 'bold',
          color: 'purple.700',
          mb: '4',
          display: 'flex',
          alignItems: 'center',
          gap: '2'
        })}>
          <span>✖️➗</span> Multiplication & Division
        </h3>

        <p className={css({ mb: '6', color: 'gray.700' })}>
          Advanced operations that combine addition/subtraction with position shifting.
        </p>

        <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
          <div className={css({
            bg: 'purple.50',
            border: '1px solid',
            borderColor: 'purple.200',
            rounded: 'lg',
            p: '4'
          })}>
            <h4 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              color: 'purple.800',
              mb: '3'
            })}>
              Multiplication
            </h4>
            <ul className={css({
              fontSize: 'sm',
              color: 'purple.700',
              pl: '4'
            })}>
              <li className={css({ mb: '2' })}>• Break down into repeated addition</li>
              <li className={css({ mb: '2' })}>• Use position shifts for place values</li>
              <li className={css({ mb: '2' })}>• Master multiplication tables</li>
              <li>• Practice with single digits first</li>
            </ul>
          </div>

          <div className={css({
            bg: 'indigo.50',
            border: '1px solid',
            borderColor: 'indigo.200',
            rounded: 'lg',
            p: '4'
          })}>
            <h4 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              color: 'indigo.800',
              mb: '3'
            })}>
              Division
            </h4>
            <ul className={css({
              fontSize: 'sm',
              color: 'indigo.700',
              pl: '4'
            })}>
              <li className={css({ mb: '2' })}>• Use repeated subtraction method</li>
              <li className={css({ mb: '2' })}>• Estimate quotients carefully</li>
              <li className={css({ mb: '2' })}>• Handle remainders properly</li>
              <li>• Check results by multiplication</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Practice Tips */}
      <div className={css({
        bg: 'gradient-to-r',
        gradientFrom: 'purple.600',
        gradientTo: 'indigo.600',
        color: 'white',
        rounded: 'xl',
        p: '6',
        textAlign: 'center'
      })}>
        <h4 className={css({
          fontSize: 'lg',
          fontWeight: 'semibold',
          mb: '3'
        })}>
          💡 Master the Fundamentals
        </h4>
        <p className={css({
          mb: '4',
          opacity: '0.9'
        })}>
          Start with simple problems and gradually increase complexity
        </p>
        <Link
          href="/create"
          className={css({
            display: 'inline-block',
            px: '6',
            py: '3',
            bg: 'white',
            color: 'purple.600',
            fontWeight: 'semibold',
            rounded: 'lg',
            textDecoration: 'none',
            transition: 'all',
            _hover: { transform: 'translateY(-1px)', shadow: 'lg' }
          })}
        >
          Practice Arithmetic Operations →
        </Link>
      </div>
    </div>
  )
}