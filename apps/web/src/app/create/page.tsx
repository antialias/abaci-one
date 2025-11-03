'use client'

import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'

export default function CreateHubPage() {
  return (
    <PageWithNav navTitle="Create" navEmoji="✨">
      <div
        data-component="create-hub"
        className={css({
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          pt: 24,
          pb: 16,
          position: 'relative',
          overflow: 'hidden',
        })}
      >
        {/* Decorative background elements */}
        <div
          className={css({
            position: 'absolute',
            top: '10%',
            right: '5%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          })}
        />
        <div
          className={css({
            position: 'absolute',
            bottom: '15%',
            left: '10%',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          })}
        />

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
                color: 'white',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)',
                letterSpacing: 'tight',
              })}
            >
              Create Your Learning Tools
            </h1>
            <p
              className={css({
                fontSize: { base: 'lg', md: 'xl' },
                color: 'rgba(255, 255, 255, 0.95)',
                maxWidth: '2xl',
                mx: 'auto',
                lineHeight: '1.8',
                textShadow: '0 1px 3px rgba(0,0,0,0.1)',
              })}
            >
              Design custom flashcards or 3D printable abacus models to enhance your learning
              experience
            </p>
          </div>

          {/* Creator Cards */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: { base: '1fr', md: '1fr 1fr' },
              gap: 8,
            })}
          >
            {/* Flashcards Creator */}
            <Link href="/create/flashcards">
              <div
                data-element="flashcards-card"
                className={css({
                  bg: 'white',
                  borderRadius: '3xl',
                  p: 8,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
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
                    color: 'gray.900',
                    letterSpacing: 'tight',
                  })}
                >
                  Flashcard Creator
                </h2>

                {/* Description */}
                <p
                  className={css({
                    fontSize: 'md',
                    color: 'gray.600',
                    mb: 5,
                    lineHeight: '1.7',
                  })}
                >
                  Design custom flashcards with abacus visualizations. Perfect for learning and
                  teaching number recognition and arithmetic.
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
                      color: 'gray.700',
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
                    Customizable number ranges
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'gray.700',
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
                    Multiple styles and layouts
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'gray.700',
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
                    Print-ready PDF generation
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
                    <span>Create Flashcards</span>
                    <span className={css({ fontSize: 'lg' })}>→</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* 3D Abacus Creator */}
            <Link href="/create/abacus">
              <div
                data-element="abacus-card"
                className={css({
                  bg: 'white',
                  borderRadius: '3xl',
                  p: 8,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
                  },
                  _before: {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
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
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    boxShadow: '0 8px 24px rgba(240, 147, 251, 0.4)',
                  })}
                >
                  🖨️
                </div>

                {/* Title */}
                <h2
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'extrabold',
                    mb: 3,
                    color: 'gray.900',
                    letterSpacing: 'tight',
                  })}
                >
                  3D Abacus Creator
                </h2>

                {/* Description */}
                <p
                  className={css({
                    fontSize: 'md',
                    color: 'gray.600',
                    mb: 5,
                    lineHeight: '1.7',
                  })}
                >
                  Customize and download 3D printable abacus models. Choose your size, columns, and
                  colors for the perfect learning tool.
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
                      color: 'gray.700',
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
                        bg: 'pink.100',
                        color: 'pink.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    Adjustable size and columns
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'gray.700',
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
                        bg: 'pink.100',
                        color: 'pink.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    3MF color customization
                  </li>
                  <li
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'sm',
                      color: 'gray.700',
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
                        bg: 'pink.100',
                        color: 'pink.600',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                      })}
                    >
                      ✓
                    </span>
                    Live 3D preview
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
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: 'md',
                      boxShadow: '0 4px 15px rgba(240, 147, 251, 0.4)',
                      transition: 'all 0.3s',
                      _hover: {
                        boxShadow: '0 6px 20px rgba(240, 147, 251, 0.5)',
                        transform: 'translateX(4px)',
                      },
                    })}
                  >
                    <span>Create 3D Model</span>
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
