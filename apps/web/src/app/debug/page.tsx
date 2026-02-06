'use client'

import { Bug, Cable, Camera, Eye, Gamepad2, TestTube, Wifi } from 'lucide-react'
import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

interface DebugLink {
  href: string
  title: string
  description: string
  icon: React.ReactNode
}

interface DebugSection {
  title: string
  links: DebugLink[]
}

const DEBUG_SECTIONS: DebugSection[] = [
  {
    title: 'Infrastructure',
    links: [
      {
        href: '/debug/socket',
        title: 'Socket.IO Debug',
        description: 'Test WebSocket connections, join rooms, send events',
        icon: <Cable size={20} />,
      },
    ],
  },
  {
    title: 'Components',
    links: [
      {
        href: '/abacus-test',
        title: 'Abacus Test',
        description: 'Test abacus component rendering',
        icon: <TestTube size={20} />,
      },
      {
        href: '/test-static-abacus',
        title: 'Static Abacus Test',
        description: 'Test static abacus rendering',
        icon: <TestTube size={20} />,
      },
    ],
  },
  {
    title: 'Arcade',
    links: [
      {
        href: '/test-arcade',
        title: 'Arcade Test',
        description: 'Test arcade game functionality',
        icon: <Gamepad2 size={20} />,
      },
      {
        href: '/test/arcade-rooms',
        title: 'Arcade Rooms Test',
        description: 'Test arcade room creation and joining',
        icon: <Gamepad2 size={20} />,
      },
      {
        href: '/test-guard',
        title: 'Guard Test',
        description: 'Test route guards and authentication',
        icon: <TestTube size={20} />,
      },
      {
        href: '/debug/practice',
        title: 'Practice Debug',
        description: 'Create debug sessions with presets (game break test, etc.)',
        icon: <Gamepad2 size={20} />,
      },
    ],
  },
  {
    title: 'Vision Training',
    links: [
      {
        href: '/vision-training/quad-test',
        title: 'Quad Test',
        description: 'Test quadrilateral detection',
        icon: <Camera size={20} />,
      },
      {
        href: '/vision-training/loader-test',
        title: 'Loader Test',
        description: 'Test TensorFlow model loading',
        icon: <Eye size={20} />,
      },
      {
        href: '/vision-training/loader-test-v5',
        title: 'Loader Test V5',
        description: 'Latest loader implementation test',
        icon: <Eye size={20} />,
      },
    ],
  },
]

/**
 * Debug hub page - links to all debug/test pages in the app.
 * Only accessible in development or with ?debug=1 query param.
 */
export default function DebugHubPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <PageWithNav>
      <main
        data-component="debug-hub"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '800px', margin: '0 auto' })}>
          {/* Header */}
          <header data-element="debug-header" className={css({ marginBottom: '2rem' })}>
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.5rem',
              })}
            >
              <Bug size={28} className={css({ color: isDark ? 'yellow.400' : 'yellow.600' })} />
              <h1
                className={css({
                  fontSize: '1.75rem',
                  fontWeight: 'bold',
                  color: isDark ? 'white' : 'gray.800',
                })}
              >
                Debug Hub
              </h1>
            </div>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Developer tools and test pages
            </p>
          </header>

          {/* Sections */}
          {DEBUG_SECTIONS.map((section) => (
            <section
              key={section.title}
              data-section={section.title.toLowerCase().replace(/\s+/g, '-')}
              className={css({ marginBottom: '1.5rem' })}
            >
              <h2
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isDark ? 'gray.500' : 'gray.500',
                  marginBottom: '0.75rem',
                  paddingLeft: '0.5rem',
                })}
              >
                {section.title}
              </h2>
              <div
                className={css({
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  overflow: 'hidden',
                })}
              >
                {section.links.map((link, index) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-action={`debug-link-${link.href.replace(/\//g, '-')}`}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem 1.25rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      borderBottom: index < section.links.length - 1 ? '1px solid' : 'none',
                      borderColor: isDark ? 'gray.700' : 'gray.200',
                      transition: 'all 0.2s',
                      _hover: {
                        backgroundColor: isDark ? 'gray.700' : 'gray.50',
                      },
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'gray.700' : 'gray.100',
                        color: isDark ? 'yellow.400' : 'yellow.600',
                        flexShrink: 0,
                      })}
                    >
                      {link.icon}
                    </div>
                    <div className={css({ flex: 1 })}>
                      <div
                        className={css({
                          fontWeight: '500',
                          color: isDark ? 'white' : 'gray.800',
                          marginBottom: '0.25rem',
                        })}
                      >
                        {link.title}
                      </div>
                      <div
                        className={css({
                          fontSize: '0.875rem',
                          color: isDark ? 'gray.400' : 'gray.600',
                        })}
                      >
                        {link.description}
                      </div>
                    </div>
                    <div
                      className={css({
                        color: isDark ? 'gray.500' : 'gray.400',
                      })}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {/* API Endpoints Section */}
          <section data-section="api-endpoints" className={css({ marginBottom: '1.5rem' })}>
            <h2
              className={css({
                fontSize: '0.875rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: isDark ? 'gray.500' : 'gray.500',
                marginBottom: '0.75rem',
                paddingLeft: '0.5rem',
              })}
            >
              API Endpoints
            </h2>
            <div
              className={css({
                backgroundColor: isDark ? 'gray.800' : 'white',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
                padding: '1rem 1.25rem',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                })}
              >
                <ApiEndpoint href="/api/health" label="Health Check" isDark={isDark} />
                <ApiEndpoint href="/api/build-info" label="Build Info" isDark={isDark} />
                <ApiEndpoint
                  href="/api/debug/active-players"
                  label="Active Players"
                  isDark={isDark}
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </PageWithNav>
  )
}

function ApiEndpoint({ href, label, isDark }: { href: string; label: string; isDark: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        textDecoration: 'none',
        fontFamily: 'mono',
        fontSize: '0.875rem',
        color: isDark ? 'blue.400' : 'blue.600',
        backgroundColor: isDark ? 'gray.700/50' : 'gray.100',
        transition: 'all 0.2s',
        _hover: {
          backgroundColor: isDark ? 'gray.700' : 'gray.200',
        },
      })}
    >
      <Wifi size={14} />
      <span className={css({ flex: 1 })}>{href}</span>
      <span
        className={css({
          fontSize: '0.75rem',
          color: isDark ? 'gray.500' : 'gray.500',
        })}
      >
        {label}
      </span>
    </a>
  )
}
