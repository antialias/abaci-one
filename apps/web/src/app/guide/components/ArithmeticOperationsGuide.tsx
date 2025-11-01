'use client'

import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import Link from 'next/link'
import { useMessages, useTranslations } from 'next-intl'
import { TutorialPlayer } from '@/components/tutorial/TutorialPlayer'
import { getTutorialForEditor } from '@/utils/tutorialConverter'
import { css } from '../../../../styled-system/css'
import { grid } from '../../../../styled-system/patterns'

export function ArithmeticOperationsGuide() {
  const appConfig = useAbacusConfig()
  const messages = useMessages() as any
  const t = useTranslations('guide.arithmetic')

  return (
    <div className={css({ maxW: '4xl', mx: 'auto' })}>
      <div
        className={css({
          bg: 'gradient-to-br',
          gradientFrom: 'purple.600',
          gradientTo: 'indigo.700',
          color: 'white',
          rounded: 'xl',
          p: { base: '6', md: '8' },
          mb: '8',
          textAlign: 'center',
        })}
      >
        <h2
          className={css({
            fontSize: { base: '2xl', md: '3xl' },
            fontWeight: 'bold',
            mb: '4',
          })}
        >
          {t('title')}
        </h2>
        <p
          className={css({
            fontSize: 'lg',
            opacity: '0.9',
          })}
        >
          {t('subtitle')}
        </p>
      </div>

      {/* Addition Section */}
      <div
        className={css({
          bg: 'white',
          rounded: 'xl',
          p: '6',
          mb: '6',
          shadow: 'sm',
          border: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'green.700',
            mb: '4',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          })}
        >
          {t('addition.title')}
        </h3>

        <p className={css({ mb: '6', color: 'gray.700' })}>{t('addition.description')}</p>

        <div className={css({ mb: '6' })}>
          <h4
            className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              mb: '3',
              color: 'green.600',
            })}
          >
            {t('addition.basicSteps.title')}
          </h4>
          <ol
            className={css({
              pl: '6',
              gap: '2',
              color: 'gray.700',
            })}
          >
            {(t.raw('addition.basicSteps.steps') as string[]).map((step, i) => (
              <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>

        <div
          className={css({
            bg: 'green.50',
            border: '1px solid',
            borderColor: 'green.200',
            rounded: 'lg',
            p: '4',
            mb: '4',
          })}
        >
          <h5
            className={css({
              fontWeight: 'semibold',
              color: 'green.800',
              mb: '2',
            })}
          >
            {t('addition.example.title')}
          </h5>
          <div className={grid({ columns: 3, gap: '4', alignItems: 'center' })}>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'green.700' })}>
                {t('addition.example.start')}
              </p>
              <div
                className={css({
                  width: '160px',
                  height: '240px',
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
                <AbacusReact
                  value={3}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
            <div className={css({ textAlign: 'center', fontSize: '2xl' })}>+</div>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'green.700' })}>
                {t('addition.example.result')}
              </p>
              <div
                className={css({
                  width: '160px',
                  height: '240px',
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
                <AbacusReact
                  value={7}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guided Addition Tutorial */}
      <div
        className={css({
          bg: 'white',
          rounded: 'xl',
          p: '6',
          mb: '6',
          shadow: 'sm',
          border: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'blue.700',
            mb: '4',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          })}
        >
          {t('guidedTutorial.title')}
        </h3>

        <p className={css({ mb: '6', color: 'gray.700' })}>{t('guidedTutorial.description')}</p>

        <div
          className={css({
            bg: 'blue.50',
            border: '1px solid',
            borderColor: 'blue.200',
            rounded: 'lg',
            p: 4,
            mb: 4,
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              color: 'blue.700',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            })}
          >
            <span>✏️</span>
            <strong>{t('guidedTutorial.editableNote')}</strong>
          </p>
          <p className={css({ fontSize: 'xs', color: 'blue.600' })}>
            {t('guidedTutorial.editableDesc')}{' '}
            <a
              href="/tutorial-editor"
              className={css({
                color: 'blue.700',
                textDecoration: 'underline',
                _hover: { color: 'blue.800' },
              })}
            >
              {t('guidedTutorial.editableLink')}
            </a>
          </p>
        </div>

        <TutorialPlayer
          tutorial={getTutorialForEditor(messages.tutorial || {})}
          isDebugMode={false}
          showDebugPanel={false}
        />
      </div>

      {/* Subtraction Section */}
      <div
        className={css({
          bg: 'white',
          rounded: 'xl',
          p: '6',
          mb: '6',
          shadow: 'sm',
          border: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'red.700',
            mb: '4',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          })}
        >
          {t('subtraction.title')}
        </h3>

        <p className={css({ mb: '6', color: 'gray.700' })}>{t('subtraction.description')}</p>

        <div className={css({ mb: '6' })}>
          <h4
            className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              mb: '3',
              color: 'red.600',
            })}
          >
            {t('subtraction.basicSteps.title')}
          </h4>
          <ol
            className={css({
              pl: '6',
              gap: '2',
              color: 'gray.700',
            })}
          >
            {(t.raw('subtraction.basicSteps.steps') as string[]).map((step, i) => (
              <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>

        <div
          className={css({
            bg: 'red.50',
            border: '1px solid',
            borderColor: 'red.200',
            rounded: 'lg',
            p: '4',
            mb: '4',
          })}
        >
          <h5
            className={css({
              fontWeight: 'semibold',
              color: 'red.800',
              mb: '2',
            })}
          >
            {t('subtraction.example.title')}
          </h5>
          <div className={grid({ columns: 3, gap: '4', alignItems: 'center' })}>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'red.700' })}>
                {t('subtraction.example.start')}
              </p>
              <div
                className={css({
                  width: '160px',
                  height: '240px',
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
                <AbacusReact
                  value={8}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
            <div className={css({ textAlign: 'center', fontSize: '2xl' })}>-</div>
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ fontSize: 'sm', mb: '2', color: 'red.700' })}>
                {t('subtraction.example.result')}
              </p>
              <div
                className={css({
                  width: '160px',
                  height: '240px',
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
                <AbacusReact
                  value={5}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multiplication & Division Section */}
      <div
        className={css({
          bg: 'white',
          rounded: 'xl',
          p: '6',
          mb: '6',
          shadow: 'sm',
          border: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'purple.700',
            mb: '4',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          })}
        >
          {t('multiplicationDivision.title')}
        </h3>

        <p className={css({ mb: '6', color: 'gray.700' })}>
          {t('multiplicationDivision.description')}
        </p>

        <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
          <div
            className={css({
              bg: 'purple.50',
              border: '1px solid',
              borderColor: 'purple.200',
              rounded: 'lg',
              p: '4',
            })}
          >
            <h4
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'purple.800',
                mb: '3',
              })}
            >
              {t('multiplicationDivision.multiplication.title')}
            </h4>
            <ul
              className={css({
                fontSize: 'sm',
                color: 'purple.700',
                pl: '4',
              })}
            >
              {(t.raw('multiplicationDivision.multiplication.points') as string[]).map(
                (point, i) => (
                  <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                    • {point}
                  </li>
                )
              )}
            </ul>
          </div>

          <div
            className={css({
              bg: 'indigo.50',
              border: '1px solid',
              borderColor: 'indigo.200',
              rounded: 'lg',
              p: '4',
            })}
          >
            <h4
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'indigo.800',
                mb: '3',
              })}
            >
              {t('multiplicationDivision.division.title')}
            </h4>
            <ul
              className={css({
                fontSize: 'sm',
                color: 'indigo.700',
                pl: '4',
              })}
            >
              {(t.raw('multiplicationDivision.division.points') as string[]).map((point, i) => (
                <li key={i} className={css({ mb: i < 3 ? '2' : '0' })}>
                  • {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Practice Tips */}
      <div
        className={css({
          bg: 'gradient-to-r',
          gradientFrom: 'purple.600',
          gradientTo: 'indigo.600',
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
          {t('practiceTips.title')}
        </h4>
        <p
          className={css({
            mb: '4',
            opacity: '0.9',
          })}
        >
          {t('practiceTips.description')}
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
            _hover: { transform: 'translateY(-1px)', shadow: 'lg' },
          })}
        >
          {t('practiceTips.button')}
        </Link>
      </div>
    </div>
  )
}
