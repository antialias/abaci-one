'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { css } from '../../styled-system/css'
import { stack } from '../../styled-system/patterns'

// Simple fallback shown while loading (also renders if dynamic import fails)
function SimpleFallback() {
  return (
    <div
      className={css({
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bg: 'bg.canvas',
        padding: '2rem',
      })}
    >
      <div className={stack({ gap: '1rem', alignItems: 'center', textAlign: 'center' })}>
        <h1
          className={css({
            fontSize: '4rem',
            fontWeight: 'black',
            color: 'text.primary',
          })}
        >
          404
        </h1>
        <p className={css({ color: 'text.secondary', fontSize: '1.25rem' })}>
          {"Oops! We've lost count."}
        </p>
        <Link
          href="/"
          className={css({
            color: 'blue.500',
            textDecoration: 'underline',
            _hover: { color: 'blue.600' },
          })}
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}

// Lazy load the interactive 404 page - this component has heavy AbacusReact dependencies
// By using dynamic import with ssr: false, we avoid loading ~2.4MB of JS on every page just for the 404 case
// The heavy bundle is only loaded when a 404 actually occurs
const InteractiveNotFound = dynamic(
  () => import('@/components/InteractiveNotFound').then((mod) => mod.InteractiveNotFound),
  {
    loading: () => <SimpleFallback />,
    ssr: false,
  }
)

export default function NotFound() {
  return <InteractiveNotFound />
}
