'use client'

import Link from 'next/link'
import { AppNavBar } from '@/components/AppNavBar'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

const toys = [
  {
    href: '/toys/number-line',
    icon: '📏',
    name: 'Number Line',
    description:
      'Explore numbers with pinch-to-zoom and drag. See tick marks at every power of 10.',
  },
  {
    href: '/toys/coordinate-plane',
    icon: '📐',
    name: 'Coordinate Plane',
    description:
      'Explore the 2D plane with pan and zoom. Magnitude-aware grid with smooth prominence scaling.',
  },
  {
    href: '/toys/dice',
    icon: '🎲',
    name: 'Dice Tray',
    description:
      'Throw colorful 3D dice with physics. Add multiple dice, roll them all, and see the sum.',
  },
  {
    href: '/toys/euclid',
    icon: '📐',
    name: 'Euclid',
    description: 'Compass and straightedge. Construct geometry from first principles.',
  },
]

export default function ToysPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <>
      <AppNavBar />
      <div
        data-component="toys-hub"
        className={css({
          minHeight: '100vh',
          paddingTop: 'var(--app-nav-height-full)',
        })}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '48px 16px',
          }}
        >
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: isDark ? 'rgba(243, 244, 246, 1)' : 'rgba(17, 24, 39, 1)',
              marginBottom: '8px',
              textAlign: 'center',
            }}
          >
            Toys
          </h1>
          <p
            style={{
              fontSize: '1rem',
              color: isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(107, 114, 128, 1)',
              marginBottom: '32px',
              textAlign: 'center',
            }}
          >
            Open-ended interactive explorations
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {toys.map((toy) => (
              <Link
                key={toy.href}
                href={toy.href}
                data-action={`navigate-${toy.name.toLowerCase().replace(/\s+/g, '-')}`}
                style={{
                  display: 'block',
                  padding: '24px',
                  borderRadius: '16px',
                  background: isDark ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                  border: isDark
                    ? '1px solid rgba(75, 85, 99, 0.5)'
                    : '1px solid rgba(209, 213, 219, 0.8)',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{toy.icon}</div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: isDark ? 'rgba(243, 244, 246, 1)' : 'rgba(17, 24, 39, 1)',
                    marginBottom: '8px',
                  }}
                >
                  {toy.name}
                </h2>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(107, 114, 128, 1)',
                    lineHeight: 1.5,
                  }}
                >
                  {toy.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
