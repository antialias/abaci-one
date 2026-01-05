import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { stack } from '../../../../styled-system/patterns'

/**
 * Lightweight Not Found page for invalid student IDs
 *
 * Shown when navigating to /practice/[studentId] with an ID that doesn't exist.
 * Deliberately doesn't import PageWithNav or other heavy components to keep
 * the not-found bundle small (avoiding ~2.4MB of JS loaded on every page).
 */
export default function StudentNotFound() {
  return (
    <div
      data-component="practice-not-found"
      className={css({
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bg: 'gray.50',
        padding: '2rem',
      })}
    >
      <div
        className={stack({
          gap: '1rem',
          alignItems: 'center',
          textAlign: 'center',
        })}
      >
        <div className={css({ fontSize: '4rem' })}>🔍</div>
        <h1
          className={css({
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: 'gray.800',
          })}
        >
          Student Not Found
        </h1>
        <p className={css({ color: 'gray.600' })}>
          We couldn&apos;t find a student with this ID. They may have been removed.
        </p>
        <Link
          href="/practice"
          scroll={false}
          className={css({
            display: 'inline-block',
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: 'blue.500',
            borderRadius: '8px',
            textDecoration: 'none',
            _hover: { backgroundColor: 'blue.600' },
          })}
        >
          Select a Student
        </Link>
      </div>
    </div>
  )
}
