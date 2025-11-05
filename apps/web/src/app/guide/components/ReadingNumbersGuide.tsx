'use client'

import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { css } from '../../../../styled-system/css'
import { grid, hstack, stack } from '../../../../styled-system/patterns'

export function ReadingNumbersGuide() {
  const appConfig = useAbacusConfig()
  const t = useTranslations('guide.reading')

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
          {t('title')}
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
          {t('subtitle')}
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
              {t('structure.number')}
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              {t('structure.title')}
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
              {t('structure.description')}
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
                  {t('structure.heaven.title')}
                </h4>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'blue.700',
                    lineHeight: 'relaxed',
                    pl: '4',
                  })}
                >
                  {(t.raw('structure.heaven.points') as string[]).map((point, i) => (
                    <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                      • {point}
                    </li>
                  ))}
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
                  {t('structure.earth.title')}
                </h4>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'green.700',
                    lineHeight: 'relaxed',
                    pl: '4',
                  })}
                >
                  {(t.raw('structure.earth.points') as string[]).map((point, i) => (
                    <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                      • {point}
                    </li>
                  ))}
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
                {t('structure.keyConcept')}
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
              {t('singleDigits.number')}
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              {t('singleDigits.title')}
            </h3>
          </div>

          <p
            className={css({
              fontSize: 'lg',
              color: 'gray.700',
              lineHeight: 'relaxed',
            })}
          >
            {t('singleDigits.description')}
          </p>

          <div className={grid({ columns: { base: 1, lg: 5 }, gap: '6' })}>
            {[
              { num: 0, descKey: '0' },
              { num: 1, descKey: '1' },
              { num: 3, descKey: '3' },
              { num: 5, descKey: '5' },
              { num: 7, descKey: '7' },
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

                {/* Fixed size container for consistent abacus rendering */}
                <div
                  className={css({
                    width: '200px',
                    height: '400px',
                    bg: 'white',
                    border: '1px solid',
                    borderColor: 'gray.300',
                    rounded: 'md',
                    mb: '3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    mx: 'auto',
                  })}
                >
                  <div className={css({ width: '100%', height: '100%' })}>
                    <AbacusReact
                      value={example.num}
                      columns={1}
                      beadShape={appConfig.beadShape}
                      colorScheme={appConfig.colorScheme}
                      hideInactiveBeads={appConfig.hideInactiveBeads}
                      scaleFactor={1.2}
                      interactive={false}
                      showNumbers={false}
                      animated={true}
                    />
                  </div>
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
                  {t(`singleDigits.examples.${example.descKey}`)}
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
              {t('multiDigit.number')}
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              {t('multiDigit.title')}
            </h3>
          </div>

          <p
            className={css({
              fontSize: 'lg',
              color: 'gray.700',
              lineHeight: 'relaxed',
            })}
          >
            {t('multiDigit.description')}
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
              {t('multiDigit.readingDirection.title')}
            </h4>
            <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
              <div>
                <h5
                  className={css({
                    fontWeight: 'semibold',
                    mb: '2',
                    color: 'purple.800',
                  })}
                >
                  {t('multiDigit.readingDirection.readingOrder.title')}
                </h5>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'purple.700',
                    pl: '4',
                  })}
                >
                  {(t.raw('multiDigit.readingDirection.readingOrder.points') as string[]).map(
                    (point, i) => (
                      <li key={i} className={css({ mb: i < 2 ? '1' : '0' })}>
                        • {point}
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div>
                <h5
                  className={css({
                    fontWeight: 'semibold',
                    mb: '2',
                    color: 'purple.800',
                  })}
                >
                  {t('multiDigit.readingDirection.placeValues.title')}
                </h5>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'purple.700',
                    pl: '4',
                  })}
                >
                  {(t.raw('multiDigit.readingDirection.placeValues.points') as string[]).map(
                    (point, i) => (
                      <li key={i} className={css({ mb: i < 2 ? '1' : '0' })}>
                        • {point}
                      </li>
                    )
                  )}
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
              {t('multiDigit.examples.title')}
            </h4>

            <div className={grid({ columns: { base: 1, md: 3 }, gap: '8' })}>
              {[
                { num: 23, descKey: '23' },
                { num: 58, descKey: '58' },
                { num: 147, descKey: '147' },
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

                  {/* Fixed size container for multi-digit numbers */}
                  <div
                    className={css({
                      width: '320px',
                      height: '350px',
                      bg: 'gray.50',
                      border: '1px solid',
                      borderColor: 'blue.200',
                      rounded: 'md',
                      mb: '3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      mx: 'auto',
                    })}
                  >
                    <div className={css({ width: '100%', height: '100%' })}>
                      <AbacusReact
                        value={example.num}
                        columns={'auto'}
                        beadShape={appConfig.beadShape}
                        colorScheme={appConfig.colorScheme}
                        hideInactiveBeads={appConfig.hideInactiveBeads}
                        scaleFactor={1.2}
                        interactive={false}
                        showNumbers={false}
                        animated={true}
                      />
                    </div>
                  </div>

                  <p
                    className={css({
                      fontSize: 'xs',
                      color: 'blue.700',
                      lineHeight: 'relaxed',
                      textAlign: 'center',
                    })}
                  >
                    {t(`multiDigit.examples.${example.descKey}`)}
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
              {t('practice.number')}
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              {t('practice.title')}
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
                {t('practice.learningTips.title')}
              </h4>
              <ul
                className={css({
                  fontSize: 'sm',
                  color: 'green.700',
                  lineHeight: 'relaxed',
                  pl: '4',
                })}
              >
                {(t.raw('practice.learningTips.points') as string[]).map((point, i) => (
                  <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                    • {point}
                  </li>
                ))}
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
                {t('practice.quickRecognition.title')}
              </h4>
              <ul
                className={css({
                  fontSize: 'sm',
                  color: 'orange.700',
                  lineHeight: 'relaxed',
                  pl: '4',
                })}
              >
                {(t.raw('practice.quickRecognition.points') as string[]).map((point, i) => (
                  <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                    • {point}
                  </li>
                ))}
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
              {t('practice.readyToPractice.title')}
            </h4>
            <p
              className={css({
                mb: '4',
                opacity: '0.9',
              })}
            >
              {t('practice.readyToPractice.description')}
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
              {t('practice.readyToPractice.button')}
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
              {t('interactive.number')}
            </div>
            <h3
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'gray.900',
              })}
            >
              {t('interactive.title')}
            </h3>
          </div>

          <p
            className={css({
              fontSize: 'lg',
              color: 'gray.700',
              lineHeight: 'relaxed',
            })}
          >
            {t('interactive.description')}
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
              {t('interactive.howToUse.title')}
            </h4>
            <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
              <div>
                <h5
                  className={css({
                    fontWeight: 'semibold',
                    mb: '2',
                    color: 'orange.800',
                  })}
                >
                  {t('interactive.howToUse.heaven.title')}
                </h5>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'orange.700',
                    pl: '4',
                  })}
                >
                  {(t.raw('interactive.howToUse.heaven.points') as string[]).map((point, i) => (
                    <li key={i} className={css({ mb: i < 2 ? '1' : '0' })}>
                      • {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5
                  className={css({
                    fontWeight: 'semibold',
                    mb: '2',
                    color: 'orange.800',
                  })}
                >
                  {t('interactive.howToUse.earth.title')}
                </h5>
                <ul
                  className={css({
                    fontSize: 'sm',
                    color: 'orange.700',
                    pl: '4',
                  })}
                >
                  {(t.raw('interactive.howToUse.earth.points') as string[]).map((point, i) => (
                    <li key={i} className={css({ mb: i < 2 ? '1' : '0' })}>
                      • {point}
                    </li>
                  ))}
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
              {t('interactive.readyToPractice.title')}
            </h4>
            <p
              className={css({
                mb: '4',
                opacity: '0.9',
              })}
            >
              {t('interactive.readyToPractice.description')}
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
              {t('interactive.readyToPractice.button')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
