import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'

/**
 * Not Found page for invalid student IDs
 *
 * Shown when navigating to /practice/[studentId] with an ID that doesn't exist
 */
export default function StudentNotFound() {
  return (
    <PageWithNav>
      <main
        data-component="practice-not-found"
        className={css({
          minHeight: '100vh',
          backgroundColor: 'gray.50',
          paddingTop: 'calc(80px + 2rem)',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          paddingBottom: '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: '600px',
            margin: '0 auto',
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: 'md',
          })}
        >
          <div className={css({ fontSize: '3rem', marginBottom: '1rem' })}>🔍</div>
          <h1
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'gray.800',
              marginBottom: '0.5rem',
            })}
          >
            Student Not Found
          </h1>
          <p
            className={css({
              color: 'gray.600',
              marginBottom: '1.5rem',
            })}
          >
            We couldn't find a student with this ID. They may have been removed.
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
      </main>
    </PageWithNav>
  )
}
