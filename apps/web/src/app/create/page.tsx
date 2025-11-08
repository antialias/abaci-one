'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'

export default function CreateHubPage() {
  const t = useTranslations('create.hub')

  return (
    <PageWithNav navTitle="Create" navEmoji="✨">
      <div
        data-component="create-hub"
        className={css({
          minHeight: '100vh',
          bg: 'bg.canvas',
          pt: 24,
          pb: 16,
          position: 'relative',
          overflow: 'hidden',
        })}
      >
        <div
          className={css({
            maxWidth: '1200px',
            mx: 'auto',
            px: 6,
            position: 'relative',
            zIndex: 1,
          })}
        >
          {/* Header */}
          <div
            className={css({
              textAlign: 'center',
              mb: 16,
            })}
          >
            <div
              className={css({
                fontSize: '6xl',
                mb: 4,
                animation: 'float 3s ease-in-out infinite',
              })}
            >
              ✨
            </div>
            <h1
              className={css({
                fontSize: { base: '3xl', md: '5xl' },
                fontWeight: 'extrabold',
                mb: 5,
                color: 'text.primary',
                letterSpacing: 'tight',
              })}
            >
              {t('pageTitle')}
            </h1>
            <p
              className={css({
                fontSize: { base: 'lg', md: 'xl' },
                color: 'text.secondary',
                maxWidth: '2xl',
                mx: 'auto',
                lineHeight: '1.8',
              })}
            >
              {t('pageSubtitle')}
            </p>
          </div>

          {/* Creator Cards */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: {
                base: '1fr',
                md: '1fr 1fr',
                lg: 'repeat(2, 1fr)',
                xl: 'repeat(4, 1fr)',
              },
              gap: 8,
            })}
          >
            {/* Flashcards Creator */}
            <Link href="/create/flashcards">
              <div
                data-element="flashcards-card"
                className={css({
                  bg: 'bg.surface',
                  borderRadius: '3xl',
                  p: 8,
                  border: '1px solid',
                  borderColor: 'border.default',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
                    borderColor: 'border.emphasized',
                  },
                  _before: {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  },
                })}
              >
                {/* Icon with gradient background */}
                <div
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '4xl',
                    mb: 5,
                    width: '80px',
                    height: '80px',
                    borderRadius: '2xl',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                  })}
                >
                  🃏
                </div>

                {/* Title */}
                <h2
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'extrabold',
                    mb: 3,
                    color: 'text.primary',
                    letterSpacing: 'tight',
                  })}
                >
                  {t('flashcards.title')}
                </h2>

                {/* Description */}
                <p
                  className={css({
                    fontSize: 'md',
                    color: 'text.secondary',
                    mb: 5,
                    lineHeight: '1.7',
                  })}
                >
                  {t('flashcards.description')}
                </p>

                {/* Features */}
                <ul
                  className={css({
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  })}
                >
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'purple.100',
                        color: 'purple.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('flashcards.feature1')}
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'purple.100',
                        color: 'purple.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('flashcards.feature2')}
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'purple.100',
                        color: 'purple.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('flashcards.feature3')}
                  </li>
                </ul>

                {/* CTA Button */}
                <div
                  className={css({
                    mt: 7,
                  })}
                >
                  <div
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 6,
                      py: 3,
                      borderRadius: 'xl',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: 'md',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s',
                      _hover: {
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                        transform: 'translateX(4px)',
                      },
                    })}
                  >
                    <span>{t('flashcards.button')}</span>
                    <span className={css({ fontSize: 'lg' })}>→</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Worksheet Creator */}
            <Link href="/create/worksheets/addition">
              <div
                data-element="worksheets-card"
                className={css({
                  bg: 'bg.surface',
                  borderRadius: '3xl',
                  p: 8,
                  border: '1px solid',
                  borderColor: 'border.default',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
                    borderColor: 'border.emphasized',
                  },
                  _before: {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  },
                })}
              >
                {/* Icon with gradient background */}
                <div
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '4xl',
                    mb: 5,
                    width: '80px',
                    height: '80px',
                    borderRadius: '2xl',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                  })}
                >
                  📝
                </div>

                {/* Title */}
                <h2
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'extrabold',
                    mb: 3,
                    color: 'text.primary',
                    letterSpacing: 'tight',
                  })}
                >
                  {t('worksheets.title')}
                </h2>

                {/* Description */}
                <p
                  className={css({
                    fontSize: 'md',
                    color: 'text.secondary',
                    mb: 5,
                    lineHeight: '1.7',
                  })}
                >
                  {t('worksheets.description')}
                </p>

                {/* Features */}
                <ul
                  className={css({
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  })}
                >
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'green.100',
                        color: 'green.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('worksheets.feature1')}
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'green.100',
                        color: 'green.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('worksheets.feature2')}
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'green.100',
                        color: 'green.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('worksheets.feature3')}
                  </li>
                </ul>

                {/* CTA Button */}
                <div
                  className={css({
                    mt: 7,
                  })}
                >
                  <div
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 6,
                      py: 3,
                      borderRadius: 'xl',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: 'md',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                      transition: 'all 0.3s',
                      _hover: {
                        boxShadow: '0 6px 20px rgba(16, 185, 129, 0.5)',
                        transform: 'translateX(4px)',
                      },
                    })}
                  >
                    <span>{t('worksheets.button')}</span>
                    <span className={css({ fontSize: 'lg' })}>→</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Calendar Creator */}
            <Link href="/create/calendar">
              <div
                data-element="calendar-card"
                className={css({
                  bg: 'bg.surface',
                  borderRadius: '3xl',
                  p: 8,
                  border: '1px solid',
                  borderColor: 'border.default',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
                    borderColor: 'border.emphasized',
                  },
                  _before: {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)',
                  },
                })}
              >
                {/* Icon with gradient background */}
                <div
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '4xl',
                    mb: 5,
                    width: '80px',
                    height: '80px',
                    borderRadius: '2xl',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    boxShadow: '0 8px 24px rgba(251, 191, 36, 0.4)',
                  })}
                >
                  📅
                </div>

                {/* Title */}
                <h2
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'extrabold',
                    mb: 3,
                    color: 'text.primary',
                    letterSpacing: 'tight',
                  })}
                >
                  {t('calendar.title')}
                </h2>

                {/* Description */}
                <p
                  className={css({
                    fontSize: 'md',
                    color: 'text.secondary',
                    mb: 5,
                    lineHeight: '1.7',
                  })}
                >
                  {t('calendar.description')}
                </p>

                {/* Features */}
                <ul
                  className={css({
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  })}
                >
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'yellow.100',
                        color: 'yellow.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('calendar.feature1')}
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'yellow.100',
                        color: 'yellow.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('calendar.feature2')}
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'text.secondary',
                    })}
                  >
                    <span
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'full',
                        bg: 'yellow.100',
                        color: 'yellow.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    {t('calendar.feature3')}
                  </li>
                </ul>

                {/* CTA Button */}
                <div
                  className={css({
                    mt: 7,
                  })}
                >
                  <div
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 6,
                      py: 3,
                      borderRadius: 'xl',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: 'md',
                      boxShadow: '0 4px 15px rgba(251, 191, 36, 0.4)',
                      transition: 'all 0.3s',
                      _hover: {
                        boxShadow: '0 6px 20px rgba(251, 191, 36, 0.5)',
                        transform: 'translateX(4px)',
                      },
                    })}
                  >
                    <span>{t('calendar.button')}</span>
                    <span className={css({ fontSize: 'lg' })}>→</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}
